// KidQuest 2.0 전역 설정
export const APP_VERSION = '2.0.0';

// Firebase Realtime Database (가족 데이터 실시간 동기화)
// 보안 규칙: /families/{가족코드}, /media/{가족코드} 경로는 24자 이상의 가족 코드를 아는 기기만 읽기/쓰기 가능
export const DB_URL = 'https://kidquest-family-default-rtdb.asia-southeast1.firebasedatabase.app';

// 3D 이모지 에셋 (Microsoft Fluent Emoji, MIT License)
export const EMOJI_BASE = (typeof window !== 'undefined' && window.KQ_ASSET_BASE) || './assets/emoji/';

export const TALENT_NAME = '달란트';
