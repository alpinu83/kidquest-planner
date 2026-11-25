# KidQuest 저녁 남은 숙제 알림 + 일요일 주간 공부 리포트 (GitHub Actions에서 15분마다 실행)
# - 설정: 앱의 부모 관리 → 설정 → "숙제 알림 · 주간 리포트" (settings/push/homework, settings/push/weekly)
# - 발송: Cloudflare Worker 발송기 (kind: direct) → 알림을 켠 가족 기기 중 대상 구성원에게만
import json, os, re, sys, urllib.request, datetime

DB = "https://kidquest-family-default-rtdb.asia-southeast1.firebasedatabase.app"
FAMILY = os.environ.get("FAMILY_CODE", "").strip()
PUSH_URL = os.environ.get("PUSH_URL", "").strip() or "https://kidquest-push.alpinu83.workers.dev/"
APP_URL = "https://alpinu83.github.io/kidquest-planner/"
FORCE = os.environ.get("FORCE", "").strip()  # "homework" | "weekly" | "" (테스트용 즉시 발송)
DRY = os.environ.get("DRY_RUN", "") == "true"
TODAY = os.environ.get("TODAY", "").strip()  # 테스트용 날짜 지정 (YYYY-MM-DD)
PARENTS = ["dad", "mom"]
STUDY_SUBJ = ["수학", "영어", "국어", "과학", "사회", "학습지", "숙제", "영단어"]
STUDY_WORDS = re.compile(r"(풀기|풀이|읽기|문제|숙제|공부|학습|쓰기|복습|예습|구몬|빠작|단어|독해|연산|p\.\s?\d)")


def get(url):
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def put(url, value):
    req = urllib.request.Request(url, data=json.dumps(value).encode("utf-8"), method="PUT")
    urllib.request.urlopen(req, timeout=20).read()


def s2d(s):
    return datetime.date.fromisoformat(s)


def dow(s):
    return (s2d(s).weekday() + 1) % 7  # 앱 요일 번호 (0=일)


def add(s, n):
    return (s2d(s) + datetime.timedelta(days=n)).isoformat()


def vals(o):
    if isinstance(o, dict):
        return [v for v in o.values() if v]
    if isinstance(o, list):
        return [v for v in o if v]
    return []


def is_study(t):
    if t.get("noTimer"):
        return False
    return t.get("source") == "workbook" or (t.get("subject") or "") in STUDY_SUBJ or bool(STUDY_WORDS.search(str(t.get("title") or "")))


def workbook_task(wb, date):
    days = [int(x) for x in (wb.get("days") or [])]
    if not wb.get("active") or dow(date) not in days:
        return None
    base = wb.get("baseDate") or date
    if date < base:
        return None
    steps, cur = 0, base
    while cur < date:
        if dow(cur) in days:
            steps += 1
        cur = add(cur, 1)
    ppd = int(wb.get("pagesPerDay") or 1)
    start = int(wb.get("startPage") or 1) + steps * ppd
    total = int(wb.get("totalPages") or 0)
    if start > total:
        return None
    end = min(total, start + ppd - 1)
    return {"id": f"wb_{wb.get('id')}_{date.replace('-', '')}", "title": f"{wb.get('title')} " + (f"p.{start}" if start == end else f"p.{start}~{end}"),
            "subject": wb.get("subject"), "source": "workbook", "done": False}


def tasks_for(kid, date):
    """앱 model.tasksFor와 같은 규칙 (저장된 할 일 + 문제집 + 반복 습관)"""
    stored = (kid.get("tasks") or {}).get(date) or {}
    out = {}
    for tid, t in (stored.items() if isinstance(stored, dict) else []):
        if t:
            out[tid] = {**t, "id": tid}
    for wb in vals(kid.get("workbooks")):
        t = workbook_task(wb, date)
        if t and t["id"] not in out:
            out[t["id"]] = t
    dw = dow(date)
    habits = {f"habit_{h.get('id')}": h for h in vals(kid.get("habits"))}
    for tid, t in out.items():  # 저장된 습관 완료 기록에도 주 1회 여부 표시
        h = habits.get(tid)
        if h and h.get("weekly") and h.get("days"):
            t["weekly"] = True
    for tid, h in habits.items():
        if not h.get("active"):
            continue
        if h.get("dueDow") not in (None, ""):
            # 마감형: 마감 요일까지 window일 동안 보이고 그 사이 한 번만 하면 완료 (앱 model.tasksFor와 같은 규칙)
            if (h.get("from") and date < h["from"]) or (h.get("until") and date > h["until"]) or tid in out:
                if tid in out:
                    out[tid]["dueDate"] = add(date, (int(h["dueDow"]) - dw + 7) % 7)
                    out[tid]["due"] = True
                continue
            due_dow, win = int(h["dueDow"]), max(1, min(7, int(h.get("window") or 6)))
            k = (due_dow - dw + 7) % 7
            if k > win - 1:
                continue
            due_date = add(date, k)
            start = add(due_date, -(win - 1))
            t = {"id": tid, "title": h.get("title"), "subject": h.get("subject") or "숙제", "source": "habit", "done": False, "due": True, "dueDate": due_date, "noTimer": bool(h.get("noTimer"))}
            for i in range(win):
                d2 = add(start, i)
                if d2 != date and (((kid.get("tasks") or {}).get(d2) or {}).get(tid) or {}).get("done"):
                    t["done"] = True
                    t["lockedDone"] = True
                    break
            out[tid] = t
            continue
        days = [int(x) for x in (h.get("days") or [])] or None
        if days and dw not in days:
            continue
        if (h.get("from") and date < h["from"]) or (h.get("until") and date > h["until"]):
            continue
        if tid in out:
            continue
        t = {"id": tid, "title": h.get("title"), "subject": h.get("subject") or "생활", "source": "habit", "done": False, "weekly": bool(h.get("weekly") and days), "noTimer": bool(h.get("noTimer"))}
        if t["weekly"]:
            monday = add(date, -((dw + 6) % 7))
            for i in range(7):
                d = add(monday, i)
                if d != date and (((kid.get("tasks") or {}).get(d) or {}).get(tid) or {}).get("done"):
                    t["done"] = True
                    t["lockedDone"] = True
                    break
        out[tid] = t
    return [t for t in out.values() if not t.get("deleted")]


def timer_sec(tm, now_ms):
    if not tm:
        return 0
    s = max(0, int(tm.get("total") or 0))
    if tm.get("startedAt"):
        s += min(3 * 3600, max(0, int((now_ms - int(tm["startedAt"])) / 1000)))  # 앱과 같게 한 번에 최대 3시간
    return s


def fmt(sec):
    sec = int(sec)
    h, m = sec // 3600, (sec % 3600) // 60
    if h:
        return f"{h}시간 {m}분" if m else f"{h}시간"
    return f"{m}분" if m else ("0분" if sec == 0 else f"{sec}초")


def studied_on(kid, date, now_ms):
    return sum(timer_sec(tm, now_ms) for tm in vals(((kid.get("timers") or {}).get(date)) or {}))


def due(cfg, default_time, last_key, today, now, push):
    if cfg.get("enabled") is False:
        return False
    if push.get(last_key) == today:
        return False
    hh, mm = [int(x) for x in (cfg.get("time") or default_time).split(":")]
    target = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    return target <= now < target + datetime.timedelta(hours=3)


def send(messages):
    if not messages:
        print("No messages.")
        return
    for m in messages:
        print(m["members"], "|", m["title"], "|", m["body"].replace("\n", " / "))
    if DRY:
        return
    req = urllib.request.Request(PUSH_URL, data=json.dumps({"family": FAMILY, "kind": "direct", "base": APP_URL, "messages": messages}).encode("utf-8"),
                                 method="POST", headers={"Content-Type": "application/json", "User-Agent": "KidQuest-Study/1.0"})
    print(urllib.request.urlopen(req, timeout=30).read().decode("utf-8")[:300])


if not FAMILY:
    print("FAMILY_CODE secret is not set. Skip.")
    sys.exit(0)

if os.environ.get("FAM_JSON"):  # 테스트용: 저장해 둔 가족 데이터 파일로 실행
    with open(os.environ["FAM_JSON"], encoding="utf-8") as f:
        fam = json.load(f)
else:
    fam = get(f"{DB}/families/{FAMILY}.json") or {}
push = ((fam.get("settings") or {}).get("push")) or {}
now = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9)
now_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
today = TODAY or now.strftime("%Y-%m-%d")
kids = sorted([{**k, "id": kid_id} for kid_id, k in (fam.get("kids") or {}).items() if k and k.get("profile")], key=lambda k: -((k["profile"].get("grade")) or 0))


def name(k):
    return k["profile"].get("name") or k["id"]


# ---------- 1) 저녁 남은 숙제 알림 ----------
hw = push.get("homework") or {}
if FORCE == "homework" or (not FORCE and due(hw, "20:00", "hwLastSent", today, now, push)):
    msgs, parent_lines, all_done = [], [], True
    for k in kids:
        tasks = tasks_for(k, today)
        left = [t for t in tasks if not t.get("done") and not (t.get("due") and t.get("dueDate", today) > today)]
        study_left = [t for t in left if is_study(t)]
        other_left = [t for t in left if not is_study(t)]
        sec = studied_on(k, today, now_ms)
        studied = f" · 공부 {fmt(sec)}" if sec >= 60 else ""
        if study_left:
            all_done = False
            titles = ", ".join(t["title"] for t in study_left[:4]) + (f" 외 {len(study_left) - 4}개" if len(study_left) > 4 else "")
            body = titles + (f"\n그 밖에 할 일 {len(other_left)}개도 남았어요" if other_left else "") + "\n타이머 켜고 시작해 볼까요?"
            msgs.append({"members": [k["id"]], "title": f"숙제가 {len(study_left)}개 남았어요", "body": body, "url": f"#/kid/{k['id']}/missions", "tag": "kq-hw"})
            parent_lines.append(f"{name(k)}: {len(study_left)}개 남음 ({', '.join(t['title'] for t in study_left[:3])}{' 등' if len(study_left) > 3 else ''}){studied}")
        elif tasks:
            parent_lines.append(f"{name(k)}: 숙제 다 했어요{studied}" + (f" (생활 할 일 {len(other_left)}개 남음)" if other_left else ""))
    if parent_lines:
        msgs.append({"members": PARENTS, "title": "오늘 숙제 모두 끝!" if all_done else "오늘 숙제 현황", "body": "\n".join(parent_lines), "url": "#/parent/overview", "tag": "kq-hw"})
    # 먼저 보낸 날짜를 기록해서 발송 중 오류가 나도 15분마다 같은 알림이 반복되지 않게
    if not FORCE and not DRY:
        put(f"{DB}/families/{FAMILY}/settings/push/hwLastSent.json", today)
    try:
        send(msgs)
    except Exception as e:
        print("homework push failed:", e)

# ---------- 2) 일요일 주간 공부 리포트 ----------
wk = push.get("weekly") or {}
if FORCE == "weekly" or (not FORCE and dow(today) == 0 and due(wk, "20:30", "weeklyLastSent", today, now, push)):
    monday = add(today, -((dow(today) + 6) % 7))
    msgs, parent_lines = [], []
    for k in kids:
        total = done = secs = 0
        subj, weekly_seen, books = {}, {}, []
        # 앱을 쓰기 시작한 날 이전은 셈하지 않음 (앱 리포트 화면과 같은 기준)
        first = min([e.get("date") for e in vals(k.get("ledger")) if e.get("date")] +
                    [d for d, ts in (k.get("tasks") or {}).items() if any(t and t.get("done") for t in vals(ts))] or [today])
        for i in range(7):
            d = add(monday, i)
            if d > today:
                break
            if d < first:
                continue
            for tm in vals(((k.get("timers") or {}).get(d)) or {}):
                s = timer_sec(tm, now_ms)
                if s > 0:
                    secs += s
                    key = tm.get("subject") or "기타"
                    key = "기타" if key == "생활" else key
                    subj[key] = subj.get(key, 0) + s
            for t in tasks_for(k, d):
                if t.get("weekly") or t.get("due"):
                    key = t["id"] + ("|" + t.get("dueDate", "") if t.get("due") else "")
                    prev = weekly_seen.get(key, {"done": False, "due": t.get("dueDate") if t.get("due") else None})
                    prev["done"] = prev["done"] or (bool(t.get("done")) and not t.get("lockedDone"))
                    weekly_seen[key] = prev
                    continue
                total += 1
                done += 1 if t.get("done") else 0
            for t in vals(((k.get("tasks") or {}).get(d)) or {}):
                rec = t.get("rec") if isinstance(t, dict) else None
                if t.get("done") and rec and rec.get("book"):
                    books.append(rec)
        counted = [v for v in weekly_seen.values() if v["done"] or not (v["due"] and v["due"] > today)]
        total += len(counted)
        done += sum(1 for v in counted if v["done"])
        rate = round(done * 100 / total) if total else 0
        top = sorted(subj.items(), key=lambda x: -x[1])[:3]
        subj_txt = ", ".join(f"{s} {fmt(v)}" for s, v in top)
        def book_txt(b):
            t = int(b.get("total") or 0)
            return f"「{b.get('book')}」" + (f" {int(b.get('correct') or 0)}/{t}({round(int(b.get('correct') or 0) * 100 / t)}점)" if t else "")
        books_txt = ", ".join(book_txt(b) for b in books)
        parent_lines.append(f"{name(k)}: 공부 {fmt(secs)} · 숙제 {rate}% ({done}/{total})" + (f" · {subj_txt}" if subj_txt else "") + (f"\n  영어책 {books_txt}" if books_txt else ""))
        cheer = "정말 잘했어요!" if rate >= 90 else "다음 주도 화이팅!"
        msgs.append({"members": [k["id"]], "title": "이번 주 공부 리포트", "body": f"공부 {fmt(secs)} · 숙제 {rate}% 완료 ({done}/{total})" + (f"\n영어책 {books_txt}" if books_txt else "") + f"\n{cheer}", "url": f"#/kid/{k['id']}", "tag": "kq-week"})
    m1, m2 = s2d(monday), s2d(add(monday, 6))
    msgs.append({"members": PARENTS, "title": f"주간 공부 리포트 ({m1.month}/{m1.day}~{m2.month}/{m2.day})", "body": "\n".join(parent_lines), "url": "#/parent/report", "tag": "kq-week"})
    send(msgs)
    if not FORCE and not DRY:
        put(f"{DB}/families/{FAMILY}/settings/push/weeklyLastSent.json", today)

print("Done.")
