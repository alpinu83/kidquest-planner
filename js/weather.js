import { KOREAN_CITIES } from '../data/presets.js';

const WEATHER_CACHE_KEY = 'kidquest_weather_cache_v1';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2시간 캐시

// WMO Weather interpretation codes
export function describeWeatherCode(code) {
  if (code === 0) return { label: '맑음', icon: 'sun' };
  if (code >= 1 && code <= 3) return { label: '구름 조금', icon: 'partly' };
  if (code === 45 || code === 48) return { label: '안개', icon: 'cloud' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { label: '비', icon: 'rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: '눈', icon: 'snow' };
  if (code >= 95) return { label: '천둥번개', icon: 'storm' };
  return { label: '흐림', icon: 'cloud' };
}

export function buildWeatherAdvice(dayData) {
  if (!dayData) return [];
  const tips = [];
  const { minTemp, maxTemp, precipProb, weatherCode } = dayData;
  const isRainy = precipProb >= 40 || (weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82) || weatherCode >= 95;
  const isSnowy = (weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86;

  if (isSnowy) {
    tips.push({ level: 'alert', badge: '눈·방한', text: `눈 소식 (강수확률 ${precipProb}%) — 우산과 미끄럼 방지 신발, 장갑 챙기기!` });
  } else if (isRainy) {
    tips.push({ level: 'alert', badge: '우산 필수', text: `내일 비 예보 (강수확률 ${precipProb}%) — 접이식 우산 꼭 가방에 넣기!` });
  }

  if (minTemp <= 4) {
    tips.push({ level: 'cold', badge: '패딩·두꺼운 외투', text: `아침 최저 ${Math.round(minTemp)}°C로 추워요 — 두꺼운 외투와 목도리 챙기세요.` });
  } else if (minTemp <= 12) {
    tips.push({ level: 'cool', badge: '따뜻한 겉옷', text: `아침 ${Math.round(minTemp)}°C로 쌀쌀해요 — 자켓이나 가디건을 꼭 챙기세요.` });
  } else if (maxTemp >= 27) {
    tips.push({ level: 'warm', badge: '시원한 복장·물통', text: `낮 최고 ${Math.round(maxTemp)}°C로 더워요 — 얇은 반팔과 물통 준비하세요.` });
  }

  if (maxTemp - minTemp >= 10) {
    tips.push({ level: 'gap', badge: '일교차 주의', text: `일교차 ${Math.round(maxTemp - minTemp)}°C! 벗기 편한 겉옷을 겹쳐 입으세요.` });
  }

  if (tips.length === 0) {
    tips.push({ level: 'ok', badge: '활동하기 좋은 날', text: `비 걱정 없이 쾌적한 날씨예요 (${Math.round(minTemp)}°~${Math.round(maxTemp)}°C).` });
  }
  return tips;
}

export async function fetchWeatherForecast(cityId = 'seoul', forceRefresh = false) {
  const city = KOREAN_CITIES.find(c => c.id === cityId) || KOREAN_CITIES[0];

  if (!forceRefresh) {
    try {
      const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
      if (cached && cached.cityId === city.id && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.data;
      }
    } catch (_) {}
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=Asia%2FSeoul&forecast_days=3`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const d = json.daily;
    const days = d.time.map((date, idx) => ({
      date,
      weatherCode: d.weather_code[idx],
      maxTemp: d.temperature_2m_max[idx],
      minTemp: d.temperature_2m_min[idx],
      precipProb: d.precipitation_probability_max[idx] ?? 0,
      precipSum: d.precipitation_sum[idx] ?? 0
    }));

    const payload = {
      source: 'Open-Meteo 실시간',
      isFallback: false,
      cityName: city.name,
      today: days[0],
      tomorrow: days[1],
      dayAfter: days[2]
    };

    try {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
        cityId: city.id,
        fetchedAt: Date.now(),
        data: payload
      }));
    } catch (_) {}
    return payload;
  } catch (err) {
    // 오프라인/네트워크 제한 환경에서도 UI가 깨지지 않도록 안내용 예시 데이터 반환
    const now = new Date();
    const fmt = (offset) => {
      const x = new Date(now);
      x.setDate(x.getDate() + offset);
      return x.toISOString().slice(0, 10);
    };
    return {
      source: '오프라인 예시 데이터 (인터넷 연결 시 자동 갱신)',
      isFallback: true,
      cityName: city.name,
      today: { date: fmt(0), weatherCode: 2, minTemp: 7, maxTemp: 16, precipProb: 15, precipSum: 0 },
      tomorrow: { date: fmt(1), weatherCode: 61, minTemp: 6, maxTemp: 13, precipProb: 75, precipSum: 8.5 },
      dayAfter: { date: fmt(2), weatherCode: 0, minTemp: 4, maxTemp: 15, precipProb: 5, precipSum: 0 }
    };
  }
}

export function renderWeatherIconSvg(iconType, size = 38) {
  if (iconType === 'sun') {
    return `<svg viewBox="0 0 48 48" width="${size}" height="${size}"><circle cx="24" cy="24" r="10" fill="#FBBF24" stroke="#D97706" stroke-width="2"/><g stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"><line x1="24" y1="4" x2="24" y2="9"/><line x1="24" y1="39" x2="24" y2="44"/><line x1="4" y1="24" x2="9" y2="24"/><line x1="39" y1="24" x2="44" y2="24"/><line x1="10" y1="10" x2="13.5" y2="13.5"/><line x1="34.5" y1="34.5" x2="38" y2="38"/><line x1="38" y1="10" x2="34.5" y2="13.5"/><line x1="13.5" y1="34.5" x2="10" y2="38"/></g></svg>`;
  }
  if (iconType === 'rain' || iconType === 'storm') {
    return `<svg viewBox="0 0 48 48" width="${size}" height="${size}"><path d="M14 29h21a7 7 0 0 0 1.2-13.9A10 10 0 0 0 17 12.5 8 8 0 0 0 14 29Z" fill="#94A3B8" stroke="#475569" stroke-width="2"/><line x1="17" y1="34" x2="14" y2="41" stroke="#0284C7" stroke-width="2.6" stroke-linecap="round"/><line x1="25" y1="34" x2="22" y2="41" stroke="#0284C7" stroke-width="2.6" stroke-linecap="round"/><line x1="33" y1="34" x2="30" y2="41" stroke="#0284C7" stroke-width="2.6" stroke-linecap="round"/></svg>`;
  }
  if (iconType === 'snow') {
    return `<svg viewBox="0 0 48 48" width="${size}" height="${size}"><path d="M14 28h21a7 7 0 0 0 1.2-13.9A10 10 0 0 0 17 11.5 8 8 0 0 0 14 28Z" fill="#CBD5E1" stroke="#64748B" stroke-width="2"/><circle cx="17" cy="36" r="2.5" fill="#38BDF8"/><circle cx="25" cy="39" r="2.5" fill="#38BDF8"/><circle cx="33" cy="36" r="2.5" fill="#38BDF8"/></svg>`;
  }
  if (iconType === 'partly') {
    return `<svg viewBox="0 0 48 48" width="${size}" height="${size}"><circle cx="18" cy="18" r="8" fill="#FBBF24"/><path d="M15 34h19a6.5 6.5 0 0 0 1-12.9A9 9 0 0 0 17.5 19 7.5 7.5 0 0 0 15 34Z" fill="#E2E8F0" stroke="#64748B" stroke-width="2"/></svg>`;
  }
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}"><path d="M13 33h22a7 7 0 0 0 1.2-13.9A10 10 0 0 0 17 16.5 8 8 0 0 0 13 33Z" fill="#CBD5E1" stroke="#64748B" stroke-width="2"/></svg>`;
}
