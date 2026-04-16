// 日付ユーティリティ
// すべて YYYY-MM-DD のローカル日付文字列で扱う(タイムゾーン依存を避ける)

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISO(new Date());
}

export function addDays(s: string, days: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function diffDays(start: string, end: string): number {
  // end - start (両端含むカウントではなく差分)
  const a = fromISO(start).getTime();
  const b = fromISO(end).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function rangeDates(start: string, end: string): string[] {
  if (!start || !end) return [];
  const out: string[] = [];
  let cur = start;
  // 安全のため上限を設定 (5年)
  let safety = 0;
  while (cur <= end && safety < 365 * 5) {
    out.push(cur);
    cur = addDays(cur, 1);
    safety++;
  }
  return out;
}

export function dayOfWeek(s: string): number {
  // 0=Sun, 6=Sat
  return fromISO(s).getDay();
}

export function isWeekend(s: string): boolean {
  const d = dayOfWeek(s);
  return d === 0 || d === 6;
}

export function formatJP(s: string, opts?: { withWeekday?: boolean }): string {
  const d = fromISO(s);
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  const base = `${d.getMonth() + 1}/${d.getDate()}`;
  return opts?.withWeekday ? `${base}(${w})` : base;
}

export function formatJPLong(s: string): string {
  if (!s) return '';
  const d = fromISO(s);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
