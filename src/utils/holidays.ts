// 日本の祝日判定 (簡易版)
// 春分・秋分は天文学的に変動するが、近年の値で近似

import { fromISO } from './dates';

// 月日固定の祝日
const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': '元日',
  '02-11': '建国記念の日',
  '02-23': '天皇誕生日',
  '04-29': '昭和の日',
  '05-03': '憲法記念日',
  '05-04': 'みどりの日',
  '05-05': 'こどもの日',
  '08-11': '山の日',
  '11-03': '文化の日',
  '11-23': '勤労感謝の日',
};

// n番目のweekday (0=Sun..6=Sat) を取得
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month - 1, 1).getDay();
  const offset = (weekday - first + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}

function springEquinox(year: number): number {
  // 1980-2099 用近似式
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

export function getHolidayName(iso: string): string | null {
  const d = fromISO(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const mmdd = `${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (FIXED_HOLIDAYS[mmdd]) return FIXED_HOLIDAYS[mmdd];

  // ハッピーマンデー
  if (m === 1 && day === nthWeekday(y, 1, 1, 2)) return '成人の日';
  if (m === 7 && day === nthWeekday(y, 7, 1, 3)) return '海の日';
  if (m === 9 && day === nthWeekday(y, 9, 1, 3)) return '敬老の日';
  if (m === 10 && day === nthWeekday(y, 10, 1, 2)) return 'スポーツの日';

  // 春分・秋分
  if (m === 3 && day === springEquinox(y)) return '春分の日';
  if (m === 9 && day === autumnEquinox(y)) return '秋分の日';

  return null;
}

export function isHoliday(iso: string): boolean {
  return getHolidayName(iso) !== null;
}
