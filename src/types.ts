export interface Bar {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (inclusive)
}

export interface Task {
  id: string;
  name: string;
  color: string;
  bars: Bar[];
}

export type TimeUnit = 'day' | 'half' | 'week';

export interface Project {
  id: string;
  name: string;        // 現場名/工事名
  contractor: string;  // 元請会社名
  startDate: string;   // 工期開始
  endDate: string;     // 工期終了
  tasks: Task[];
  memo: string;
  unit?: TimeUnit;     // 表示単位 (デフォルト: day)
  createdAt: string;
  updatedAt: string;
}

export const TASK_COLOR_PALETTE = [
  '#4F46E5', // indigo
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo-500
];
