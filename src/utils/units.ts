// 表示単位ごとのセル定義
// バーは内部的には常に startDate / endDate (YYYY-MM-DD) で保持し、
// 表示時にだけ単位ごとにセル列にマッピングする。

import type { TimeUnit } from '../types';
import { addDays, fromISO, toISO, dayOfWeek } from './dates';

export interface CellDef {
  // セルの開始日 (YYYY-MM-DD) — 半日セルなら同じ日に2つ
  date: string;
  // 半日のとき AM/PM を区別する
  half?: 'am' | 'pm';
  // 週セルのとき期間終了日 (週末日)
  weekEnd?: string;
  // ラベル(月行など)
  monthLabel: string;
  weekLabel?: string;
}

/** 工期 [start..end] からセル配列を生成する */
export function buildCells(start: string, end: string, unit: TimeUnit): CellDef[] {
  if (!start || !end || start > end) return [];
  const out: CellDef[] = [];
  if (unit === 'day') {
    let cur = start;
    let safety = 0;
    while (cur <= end && safety < 365 * 5) {
      const d = fromISO(cur);
      out.push({ date: cur, monthLabel: `${d.getFullYear()}年${d.getMonth() + 1}月` });
      cur = addDays(cur, 1);
      safety++;
    }
  } else if (unit === 'half') {
    let cur = start;
    let safety = 0;
    while (cur <= end && safety < 365 * 5) {
      const d = fromISO(cur);
      const monthLabel = `${d.getFullYear()}年${d.getMonth() + 1}月`;
      out.push({ date: cur, half: 'am', monthLabel });
      out.push({ date: cur, half: 'pm', monthLabel });
      cur = addDays(cur, 1);
      safety++;
    }
  } else {
    // week: 月曜始まり。最初のセルは start を含む週の月曜から、最後は end を含む週の日曜まで
    const startMonday = mondayOf(start);
    let cur = startMonday;
    let safety = 0;
    while (cur <= end && safety < 200) {
      const sunday = addDays(cur, 6);
      const d = fromISO(cur);
      const month = d.getMonth() + 1;
      out.push({
        date: cur,
        weekEnd: sunday,
        monthLabel: `${d.getFullYear()}年${month}月`,
        weekLabel: `${month}/${d.getDate()}`,
      });
      cur = addDays(cur, 7);
      safety++;
    }
  }
  return out;
}

function mondayOf(iso: string): string {
  const d = fromISO(iso);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, offset);
}

/** 日付(YYYY-MM-DD)が含まれるセルのインデックスを返す */
export function dateToCellIndex(cells: CellDef[], date: string, half: 'am' | 'pm' = 'am'): number {
  if (cells.length === 0) return -1;
  const first = cells[0];
  if (first.weekEnd) {
    // 週セル
    for (let i = 0; i < cells.length; i++) {
      if (date >= cells[i].date && date <= (cells[i].weekEnd as string)) return i;
    }
    return -1;
  }
  if (first.half) {
    // 半日セル
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].date === date && cells[i].half === half) return i;
    }
    return -1;
  }
  // 日セル
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].date === date) return i;
  }
  return -1;
}

/** セルインデックスから (startDate, endDate) を求める。半日対応 */
export function cellRangeToBarDates(
  cells: CellDef[],
  startIdx: number,
  endIdx: number
): { startDate: string; endDate: string } | null {
  if (cells.length === 0) return null;
  const [s, e] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  const a = cells[s];
  const b = cells[e];
  if (!a || !b) return null;
  // 週セルの場合: 週の月曜〜日曜
  if (a.weekEnd && b.weekEnd) {
    return { startDate: a.date, endDate: b.weekEnd };
  }
  // 半日 or 日: バーは日単位で持つ
  return { startDate: a.date, endDate: b.date };
}

/** 1日が何セルか */
export function cellsPerDay(unit: TimeUnit): number {
  if (unit === 'half') return 2;
  return 1;
}

/** 単位ラベル */
export function unitLabel(unit: TimeUnit): string {
  return unit === 'day' ? '日' : unit === 'half' ? '半日' : '週';
}

/** セルのCSSクラス用の祝日フラグ計算 */
export function cellWeekday(cell: CellDef): number | null {
  // 週セルの場合は曜日色付けしない
  if (cell.weekEnd) return null;
  return dayOfWeek(cell.date);
}

export { toISO };
