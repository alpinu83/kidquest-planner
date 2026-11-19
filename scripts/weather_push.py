# KidQuest 내일 날씨·준비물 푸시 (GitHub Actions에서 15분마다 실행)
# - 가족 설정(settings/push)의 알림 시간이 되면 하루 한 번만, 알림을 켠 가족 기기로 앱 알림을 보냄 (Cloudflare Worker 발송기)
# - 알림 시간은 앱의 부모 관리 → 설정에서 바꿀 수 있음 (기본 21:00)
import json, os, sys, urllib.request, urllib.parse, datetime

DB = "https://kidquest-family-default-rtdb.asia-southeast1.firebasedatabase.app"
FAMILY = os.environ.get("FAMILY_CODE", "").strip()
PUSH_URL = os.environ.get("PUSH_URL", "").strip() or "https://kidquest-push.alpinu83.workers.dev/"
APP_URL = "https://alpinu83.github.io/kidquest-planner/"
FORCE = os.environ.get("FORCE", "") == "true"
CITIES = {
    "seoul": (37.5665, 126.978, "서울"), "gangnam": (37.4979, 127.0276, "서울 강남·서초"), "bundang": (37.3827, 127.1189, "성남·분당"),
    "dongtan": (37.2006, 127.0736, "화성·동탄"), "suwon": (37.2636, 127.0286, "수원"), "incheon": (37.4563, 126.7052, "인천"),
    "yongin": (37.2411, 127.1776, "용인"), "daejeon": (36.3504, 127.3845, "대전"), "daegu": (35.8714, 128.6014, "대구"),
    "busan": (35.1796, 129.0756, "부산"), "gwangju": (35.1595, 126.8526, "광주"), "jeju": (33.4996, 126.5312, "제주"),
}
DAYS = ["월", "화", "수", "목", "금", "토", "일"]


def get(url):
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def put(url, value):
    req = urllib.request.Request(url, data=json.dumps(value).encode("utf-8"), method="PUT")
    urllib.request.urlopen(req, timeout=20).read()


if not FAMILY:
    print("FAMILY_CODE secret is not set. Skip.")
    sys.exit(0)

fam = get(f"{DB}/families/{FAMILY}.json") or {}
settings = fam.get("settings") or {}
push = settings.get("push") or {}
if push.get("enabled") is False and not FORCE:
    print("Push disabled.")
    sys.exit(0)

now = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9)
today = now.strftime("%Y-%m-%d")
hh, mm = [int(x) for x in (push.get("time") or "21:00").split(":")]
target = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
if not FORCE:
    if push.get("lastSent") == today:
        print("Already sent today.")
        sys.exit(0)
    if not (target <= now < target + datetime.timedelta(hours=3)):
        print(f"Not time yet (now {now:%H:%M}, push {hh:02d}:{mm:02d}).")
        sys.exit(0)

lat, lon, city = CITIES.get(settings.get("cityId") or "seoul", CITIES["seoul"])
w = get(
    f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=2"
)["daily"]
tmin, tmax = round(w["temperature_2m_min"][1]), round(w["temperature_2m_max"][1])
prob, code = w["precipitation_probability_max"][1] or 0, w["weather_code"][1]
snow = 71 <= code <= 77 or code in (85, 86)
tips = []
if snow:
    tips.append("눈 소식 · 우산과 미끄럼 안 되는 신발")
elif prob >= 40 or 51 <= code <= 67 or 80 <= code <= 82 or code >= 95:
    tips.append(f"우산 꼭 챙기기 (비 {prob}%)")
if tmin <= 4:
    tips.append("두꺼운 외투·목도리")
elif tmin <= 12:
    tips.append("따뜻한 겉옷")
elif tmax >= 27:
    tips.append("시원한 옷·물통")
if tmax - tmin >= 10:
    tips.append(f"일교차 {tmax - tmin}도 · 겉옷 겹쳐 입기")
if not tips:
    tips.append("비 걱정 없는 날")

tomorrow = now + datetime.timedelta(days=1)
dow_js = (tomorrow.weekday() + 1) % 7  # 앱의 요일 번호 (0=일)
lines = [
    f"{city} 내일({tomorrow.month}/{tomorrow.day} {DAYS[tomorrow.weekday()]}) {tmin}°~{tmax}°C · 비 {prob}%",
    "준비물: " + ", ".join(tips),
]
kids = sorted((fam.get("kids") or {}).values(), key=lambda k: -((k.get("profile") or {}).get("grade") or 0))
for kid in kids:
    name = (kid.get("profile") or {}).get("name")
    acs = [a for a in (kid.get("academies") or {}).values() if a and dow_js in [int(d) for d in (a.get("days") or [])]]
    acs.sort(key=lambda a: a.get("start", ""))
    if name and acs:
        lines.append(f"{name}: " + ", ".join(f"{a.get('start')} {a.get('title')}" + (f"({a.get('note')})" if a.get("note") else "") for a in acs))
msg = "\n".join(lines)
print(msg)

title = ("\u2602 " if "우산" in msg else "") + "내일 날씨·준비물"
req = urllib.request.Request(
    PUSH_URL,
    data=json.dumps({"family": FAMILY, "kind": "weather", "title": title, "text": msg, "base": APP_URL}).encode("utf-8"),
    method="POST",
    headers={"Content-Type": "application/json", "User-Agent": "KidQuest-Weather/1.0"},
)
print(urllib.request.urlopen(req, timeout=30).read().decode("utf-8")[:300])
if not FORCE:
    put(f"{DB}/families/{FAMILY}/settings/push/lastSent.json", today)
print("Sent.")
