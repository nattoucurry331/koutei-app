import { useMemo, useState, useRef, useEffect } from 'react';
import type { Task, Bar, TimeUnit } from '../../types';
import { TASK_COLOR_PALETTE } from '../../types';
import { dayOfWeek, today, fromISO } from '../../utils/dates';
import { isHoliday, getHolidayName } from '../../utils/holidays';
import { uid } from '../../utils/storage';
import { buildCells, cellRangeToBarDates, dateToCellIndex } from '../../utils/units';
import './GanttChart.css';

interface Props {
  startDate: string;
  endDate: string;
  tasks: Task[];
  unit: TimeUnit;
  onTasksChange: (tasks: Task[]) => void;
  onAddTask: () => void;
  onUnitChange: (unit: TimeUnit) => void;
  tableRef?: React.RefObject<HTMLDivElement>;
}

interface DraftBar {
  taskId: string;
  startIdx: number;
  endIdx: number;
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export function GanttChart({
  startDate,
  endDate,
  tasks,
  unit,
  onTasksChange,
  onAddTask,
  onUnitChange,
  tableRef,
}: Props) {
  const cells = useMemo(() => buildCells(startDate, endDate, unit), [startDate, endDate, unit]);
  const [draft, setDraft] = useState<DraftBar | null>(null);
  const draftRef = useRef<DraftBar | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const todayStr = today();

  const setDraftBoth = (d: DraftBar | null) => {
    draftRef.current = d;
    setDraft(d);
  };

  // 列幅: 単位ごとに調整
  const colWidth = unit === 'day' ? 32 : unit === 'half' ? 22 : 56;

  // 月ごとのグループ化(月単位ヘッダー)
  const monthGroups = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    let current: { label: string; span: number } | null = null;
    for (const c of cells) {
      const label = c.monthLabel;
      if (current && current.label === label) current.span += 1;
      else {
        if (current) groups.push(current);
        current = { label, span: 1 };
      }
    }
    if (current) groups.push(current);
    return groups;
  }, [cells]);

  // ===== タスク操作 =====
  const updateTask = (id: string, patch: Partial<Task>) => {
    onTasksChange(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const deleteTask = (id: string) => {
    if (!confirm('この工種を削除しますか?')) return;
    onTasksChange(tasks.filter((t) => t.id !== id));
  };
  const moveTask = (id: string, direction: -1 | 1) => {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= tasks.length) return;
    const next = [...tasks];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onTasksChange(next);
  };

  const addBar = (taskId: string, startIdx: number, endIdx: number) => {
    const range = cellRangeToBarDates(cells, startIdx, endIdx);
    if (!range) return;
    const bar: Bar = { id: uid(), startDate: range.startDate, endDate: range.endDate };
    onTasksChange(tasks.map((t) => (t.id === taskId ? { ...t, bars: [...t.bars, bar] } : t)));
  };

  const deleteBar = (taskId: string, barId: string) => {
    onTasksChange(
      tasks.map((t) =>
        t.id === taskId ? { ...t, bars: t.bars.filter((b) => b.id !== barId) } : t
      )
    );
  };

  // ドラッグ操作 (バー作成)
  const handleCellMouseDown = (taskId: string, idx: number, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.gantt-bar')) return;
    e.preventDefault();
    setDraftBoth({ taskId, startIdx: idx, endIdx: idx });
  };
  const handleCellMouseEnter = (taskId: string, idx: number) => {
    const d = draftRef.current;
    if (!d || d.taskId !== taskId) return;
    setDraftBoth({ ...d, endIdx: idx });
  };
  useEffect(() => {
    const onUp = () => {
      const d = draftRef.current;
      if (d) {
        addBar(d.taskId, d.startIdx, d.endIdx);
        setDraftBoth(null);
      }
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, cells]);

  // ===== D&D 並び替え =====
  const handleRowDragStart = (taskId: string) => (e: React.DragEvent) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    // FF対策
    e.dataTransfer.setData('text/plain', taskId);
  };
  const handleRowDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(idx);
  };
  const handleRowDragEnd = () => {
    setDragTaskId(null);
    setDropIndex(null);
  };
  const handleRowDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragTaskId) return;
    const fromIdx = tasks.findIndex((t) => t.id === dragTaskId);
    if (fromIdx < 0 || fromIdx === idx) {
      handleRowDragEnd();
      return;
    }
    const next = [...tasks];
    const [moved] = next.splice(fromIdx, 1);
    // 取り除いた後のインデックス補正
    const insertAt = fromIdx < idx ? idx - 1 : idx;
    next.splice(insertAt, 0, moved);
    onTasksChange(next);
    handleRowDragEnd();
  };

  if (cells.length === 0) {
    return (
      <div className="gantt-empty">
        <p>工期を設定してください。</p>
      </div>
    );
  }

  const cellsWidth = `${colWidth * cells.length}px`;

  return (
    <div className="gantt-wrapper" style={{ ['--col-width' as never]: `${colWidth}px` }}>
      <div className="gantt-toolbar">
        <button className="btn btn-primary btn-sm" onClick={onAddTask}>
          + 工種を追加
        </button>
        <div className="unit-switch" role="tablist" aria-label="表示単位">
          {(['day', 'half', 'week'] as TimeUnit[]).map((u) => (
            <button
              key={u}
              role="tab"
              className={'unit-switch-btn' + (unit === u ? ' is-active' : '')}
              onClick={() => onUnitChange(u)}
            >
              {u === 'day' ? '日' : u === 'half' ? '半日' : '週'}
            </button>
          ))}
        </div>
        <span className="gantt-hint">
          セルをドラッグでバー作成 / バークリックで削除 / 工種行は左端の⋮⋮でドラッグ並び替え
        </span>
      </div>

      <div className="gantt-scroll">
        <div
          ref={tableRef}
          className="gantt-table"
          style={{ minWidth: `calc(var(--task-name-width) + ${cellsWidth})` }}
        >
          {/* 月行 */}
          <div className="gantt-row gantt-header-row">
            <div className="gantt-task-name gantt-corner">工種</div>
            <div className="gantt-cells gantt-month-row" style={{ width: cellsWidth }}>
              {monthGroups.map((g, i) => (
                <div
                  key={`m-${i}`}
                  className="gantt-month-cell"
                  style={{ width: `${colWidth * g.span}px` }}
                >
                  {g.label}
                </div>
              ))}
            </div>
          </div>

          {/* 日付/週ラベル行 */}
          <div className="gantt-row gantt-header-row gantt-header-row-day">
            <div className="gantt-task-name gantt-corner">
              {unit === 'week' ? '週' : '日付'}
            </div>
            <div className="gantt-cells" style={{ width: cellsWidth }}>
              {cells.map((c, i) => {
                if (c.weekEnd) {
                  return (
                    <div key={`w-${i}`} className="gantt-day-cell gantt-week-cell">
                      <div className="day-num">{c.weekLabel}</div>
                      <div className="day-wd">週</div>
                    </div>
                  );
                }
                const dow = dayOfWeek(c.date);
                const holiday = isHoliday(c.date);
                const isToday = c.date === todayStr;
                const date = fromISO(c.date);
                return (
                  <div
                    key={`d-${i}`}
                    className={
                      'gantt-day-cell' +
                      (dow === 0 || holiday ? ' is-sun' : dow === 6 ? ' is-sat' : '') +
                      (isToday ? ' is-today' : '') +
                      (c.half ? ' is-half' : '')
                    }
                    title={holiday ? getHolidayName(c.date) ?? '' : ''}
                  >
                    {c.half === 'pm' ? (
                      <div className="day-num half-label">PM</div>
                    ) : (
                      <>
                        <div className="day-num">{date.getDate()}</div>
                        <div className="day-wd">
                          {c.half === 'am' ? 'AM' : WEEKDAY_LABELS[dow]}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* タスク行 */}
          {tasks.map((task, taskIdx) => (
            <TaskRow
              key={task.id}
              task={task}
              taskIdx={taskIdx}
              taskCount={tasks.length}
              cells={cells}
              draft={draft && draft.taskId === task.id ? draft : null}
              todayStr={todayStr}
              cellsWidth={cellsWidth}
              colWidth={colWidth}
              isDragging={dragTaskId === task.id}
              showDropIndicator={dropIndex === taskIdx && dragTaskId !== task.id}
              onDragStart={handleRowDragStart(task.id)}
              onDragOver={handleRowDragOver(taskIdx)}
              onDrop={handleRowDrop(taskIdx)}
              onDragEnd={handleRowDragEnd}
              onUpdate={(patch) => updateTask(task.id, patch)}
              onDelete={() => deleteTask(task.id)}
              onMove={(dir) => moveTask(task.id, dir)}
              onCellMouseDown={(idx, e) => handleCellMouseDown(task.id, idx, e)}
              onCellMouseEnter={(idx) => handleCellMouseEnter(task.id, idx)}
              onDeleteBar={(barId) => deleteBar(task.id, barId)}
            />
          ))}

          {/* ドロップターゲット (末尾) */}
          {dragTaskId && (
            <div
              className={'gantt-drop-target' + (dropIndex === tasks.length ? ' is-active' : '')}
              onDragOver={handleRowDragOver(tasks.length)}
              onDrop={handleRowDrop(tasks.length)}
            >
              ここへドロップ
            </div>
          )}

          {tasks.length === 0 && (
            <div className="gantt-empty-row">
              <p>工種がまだありません。「+ 工種を追加」から作成してください。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  taskIdx: number;
  taskCount: number;
  cells: ReturnType<typeof buildCells>;
  draft: DraftBar | null;
  todayStr: string;
  cellsWidth: string;
  colWidth: number;
  isDragging: boolean;
  showDropIndicator: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onCellMouseDown: (idx: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (idx: number) => void;
  onDeleteBar: (barId: string) => void;
}

function TaskRow({
  task,
  taskIdx,
  taskCount,
  cells,
  draft,
  todayStr,
  cellsWidth,
  colWidth,
  isDragging,
  showDropIndicator,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onUpdate,
  onDelete,
  onMove,
  onCellMouseDown,
  onCellMouseEnter,
  onDeleteBar,
}: TaskRowProps) {
  const [editingName, setEditingName] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [draggable, setDraggable] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  // バーをセル列にマッピング
  const barRanges = task.bars
    .map((bar) => {
      let startIdx = dateToCellIndex(cells, bar.startDate, 'am');
      let endIdx = dateToCellIndex(cells, bar.endDate, 'pm');
      // 範囲外カット
      if (startIdx === -1) {
        startIdx = bar.startDate < cells[0].date ? 0 : -1;
      }
      if (endIdx === -1) {
        const lastDate = cells[cells.length - 1].weekEnd ?? cells[cells.length - 1].date;
        endIdx = bar.endDate > lastDate ? cells.length - 1 : -1;
      }
      if (startIdx === -1 || endIdx === -1) return null;
      return { bar, startIdx, endIdx };
    })
    .filter((b): b is { bar: Bar; startIdx: number; endIdx: number } => b !== null);

  const draftRange = draft
    ? {
        startIdx: Math.min(draft.startIdx, draft.endIdx),
        endIdx: Math.max(draft.startIdx, draft.endIdx),
      }
    : null;

  return (
    <>
      {showDropIndicator && <div className="gantt-drop-line" />}
      <div
        className={'gantt-row gantt-task-row' + (isDragging ? ' is-dragging' : '')}
        draggable={draggable}
        onDragStart={(e) => {
          if (!draggable) {
            e.preventDefault();
            return;
          }
          onDragStart(e);
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={() => {
          setDraggable(false);
          onDragEnd();
        }}
      >
        <div className="gantt-task-name" style={{ borderLeft: `4px solid ${task.color}` }}>
          <button
            className="task-drag-handle"
            title="ドラッグで並び替え"
            onMouseDown={() => setDraggable(true)}
            onMouseUp={() => setDraggable(false)}
          >
            ⋮⋮
          </button>
          <div className="task-name-inner">
            {editingName ? (
              <input
                ref={nameRef}
                className="task-name-input"
                value={task.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false);
                }}
              />
            ) : (
              <button
                className="task-name-text"
                onClick={() => setEditingName(true)}
                title="クリックで編集"
              >
                {task.name}
              </button>
            )}
          </div>
          <div className="task-name-actions">
            <button
              className="task-color-swatch"
              style={{ background: task.color }}
              onClick={() => setShowColorPicker((v) => !v)}
              title="色を変更"
            />
            <button
              className="task-action-btn"
              disabled={taskIdx === 0}
              onClick={() => onMove(-1)}
              title="上へ"
            >
              ▲
            </button>
            <button
              className="task-action-btn"
              disabled={taskIdx === taskCount - 1}
              onClick={() => onMove(1)}
              title="下へ"
            >
              ▼
            </button>
            <button className="task-action-btn task-action-delete" onClick={onDelete} title="削除">
              ×
            </button>
          </div>
          {showColorPicker && (
            <div className="color-picker-popover">
              {TASK_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  className="color-picker-swatch"
                  style={{
                    background: c,
                    outline: c === task.color ? '2px solid #1f2937' : 'none',
                  }}
                  onClick={() => {
                    onUpdate({ color: c });
                    setShowColorPicker(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="gantt-cells gantt-task-cells" style={{ width: cellsWidth }}>
          {cells.map((c, idx) => {
            const dow = c.weekEnd ? null : dayOfWeek(c.date);
            const holiday = c.weekEnd ? false : isHoliday(c.date);
            const isToday = !c.weekEnd && c.date === todayStr;
            return (
              <div
                key={`${task.id}-${idx}`}
                className={
                  'gantt-cell' +
                  (dow === 0 || holiday ? ' is-sun' : dow === 6 ? ' is-sat' : '') +
                  (isToday ? ' is-today' : '') +
                  (c.half === 'pm' ? ' is-half-pm' : c.half === 'am' ? ' is-half-am' : '')
                }
                onMouseDown={(e) => onCellMouseDown(idx, e)}
                onMouseOver={() => onCellMouseEnter(idx)}
              />
            );
          })}

          {barRanges.map(({ bar, startIdx, endIdx }) => (
            <button
              key={bar.id}
              className="gantt-bar"
              style={{
                left: `${colWidth * startIdx + 2}px`,
                width: `${colWidth * (endIdx - startIdx + 1) - 4}px`,
                background: task.color,
              }}
              title={`${bar.startDate} 〜 ${bar.endDate}（クリックで削除）`}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('このバーを削除しますか?')) onDeleteBar(bar.id);
              }}
            />
          ))}
          {draftRange && (
            <div
              className="gantt-bar-draft"
              style={{
                left: `${colWidth * draftRange.startIdx + 2}px`,
                width: `${colWidth * (draftRange.endIdx - draftRange.startIdx + 1) - 4}px`,
                background: task.color,
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
