import { useState } from 'react';
import type { Project, Task, Bar } from '../../types';
import { TASK_COLOR_PALETTE } from '../../types';
import { uid } from '../../utils/storage';
import { today, diffDays, formatJP, formatJPLong, addDays } from '../../utils/dates';
import './MobileTaskList.css';

interface Props {
  project: Project;
  onChange: (project: Project) => void;
  onAddTask: () => void;
}

export function MobileTaskList({ project, onChange, onAddTask }: Props) {
  const todayStr = today();

  const updateField = <K extends keyof Project>(key: K, value: Project[K]) => {
    onChange({ ...project, [key]: value });
  };
  const updateTasks = (tasks: Task[]) => updateField('tasks', tasks);

  // 本日アクティブな工種
  const todayActive = project.tasks.filter((t) =>
    t.bars.some((b) => todayStr >= b.startDate && todayStr <= b.endDate)
  );

  // 期間日数
  const periodDays =
    project.startDate && project.endDate
      ? Math.max(0, diffDays(project.startDate, project.endDate)) + 1
      : 0;

  return (
    <div className="mobile-list">
      {/* === ヘッダー === */}
      <div className="m-header">
        <input
          className="m-title"
          value={project.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="現場名・工事名"
        />
        <div className="m-meta">
          <div className="m-meta-row">
            <span className="m-meta-label">元請</span>
            <input
              className="m-meta-input"
              value={project.contractor}
              onChange={(e) => updateField('contractor', e.target.value)}
              placeholder="元請会社名"
            />
          </div>
          <div className="m-meta-row">
            <span className="m-meta-label">工期</span>
            <input
              type="date"
              className="m-meta-input m-meta-date"
              value={project.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
            />
            <span className="m-meta-sep">〜</span>
            <input
              type="date"
              className="m-meta-input m-meta-date"
              value={project.endDate}
              onChange={(e) => updateField('endDate', e.target.value)}
            />
          </div>
          {periodDays > 0 && (
            <div className="m-meta-period">
              {formatJPLong(project.startDate)} 〜 {formatJPLong(project.endDate)} ({periodDays}日間)
            </div>
          )}
        </div>
      </div>

      {/* === 本日の工程 === */}
      <section className="m-section">
        <div className="m-section-header">
          <h3 className="m-section-title">📌 本日の工程</h3>
          <span className="m-section-sub">{formatJP(todayStr, { withWeekday: true })}</span>
        </div>
        {todayActive.length > 0 ? (
          <div className="m-today-list">
            {todayActive.map((t) => (
              <div
                key={t.id}
                className="m-today-card"
                style={{ borderLeftColor: t.color }}
              >
                <span className="m-today-name">{t.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="m-empty-card">本日の作業予定はありません</div>
        )}
      </section>

      {/* === 工種一覧 === */}
      <section className="m-section">
        <div className="m-section-header">
          <h3 className="m-section-title">📋 工種一覧 ({project.tasks.length}件)</h3>
          <button className="btn btn-primary btn-sm" onClick={onAddTask}>
            + 追加
          </button>
        </div>
        {project.tasks.length === 0 ? (
          <div className="m-empty-card">「+ 追加」から工種を作成してください</div>
        ) : (
          <div className="m-task-list">
            {project.tasks.map((task, idx) => (
              <TaskCard
                key={task.id}
                task={task}
                taskIdx={idx}
                taskCount={project.tasks.length}
                onUpdate={(patch) =>
                  updateTasks(project.tasks.map((t) => (t.id === task.id ? { ...t, ...patch } : t)))
                }
                onDelete={() => {
                  if (!confirm(`「${task.name}」を削除しますか?`)) return;
                  updateTasks(project.tasks.filter((t) => t.id !== task.id));
                }}
                onMove={(dir) => {
                  const i = project.tasks.findIndex((t) => t.id === task.id);
                  const j = i + dir;
                  if (j < 0 || j >= project.tasks.length) return;
                  const next = [...project.tasks];
                  [next[i], next[j]] = [next[j], next[i]];
                  updateTasks(next);
                }}
                onAddBar={(start, end) => {
                  if (!start || !end) return;
                  const [s, e] = start <= end ? [start, end] : [end, start];
                  const bar: Bar = { id: uid(), startDate: s, endDate: e };
                  updateTasks(
                    project.tasks.map((t) =>
                      t.id === task.id ? { ...t, bars: [...t.bars, bar] } : t
                    )
                  );
                }}
                onUpdateBar={(barId, patch) => {
                  updateTasks(
                    project.tasks.map((t) =>
                      t.id === task.id
                        ? { ...t, bars: t.bars.map((b) => (b.id === barId ? { ...b, ...patch } : b)) }
                        : t
                    )
                  );
                }}
                onDeleteBar={(barId) => {
                  updateTasks(
                    project.tasks.map((t) =>
                      t.id === task.id ? { ...t, bars: t.bars.filter((b) => b.id !== barId) } : t
                    )
                  );
                }}
                projectStartDate={project.startDate}
                projectEndDate={project.endDate}
              />
            ))}
          </div>
        )}
      </section>

      {/* === 備考 === */}
      <section className="m-section">
        <h3 className="m-section-title">📝 備考</h3>
        <textarea
          className="m-memo"
          value={project.memo}
          onChange={(e) => updateField('memo', e.target.value)}
          placeholder="工程全体に関するメモ・注意事項・連絡先など"
          rows={4}
        />
      </section>

      <p className="m-pdf-hint">
        💡 PDF出力・ガントチャート編集はPCでご利用ください
      </p>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  taskIdx: number;
  taskCount: number;
  projectStartDate: string;
  projectEndDate: string;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddBar: (start: string, end: string) => void;
  onUpdateBar: (barId: string, patch: Partial<Bar>) => void;
  onDeleteBar: (barId: string) => void;
}

function TaskCard({
  task,
  taskIdx,
  taskCount,
  projectStartDate,
  projectEndDate,
  onUpdate,
  onDelete,
  onMove,
  onAddBar,
  onUpdateBar,
  onDeleteBar,
}: TaskCardProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [addingBar, setAddingBar] = useState(false);
  const [newStart, setNewStart] = useState(projectStartDate);
  const [newEnd, setNewEnd] = useState(addDays(projectStartDate || today(), 2));

  const handleAdd = () => {
    if (!newStart || !newEnd) return;
    onAddBar(newStart, newEnd);
    setAddingBar(false);
    // Next default: 翌日から
    setNewStart(addDays(newEnd, 1));
    setNewEnd(addDays(newEnd, 3));
  };

  return (
    <div className="m-task-card" style={{ borderLeftColor: task.color }}>
      <div className="m-task-header">
        <input
          className="m-task-name"
          value={task.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="工種名"
        />
        <button
          className="m-task-color"
          style={{ background: task.color }}
          onClick={() => setShowColorPicker((v) => !v)}
          aria-label="色を変更"
        />
      </div>
      {showColorPicker && (
        <div className="m-color-row">
          {TASK_COLOR_PALETTE.map((c) => (
            <button
              key={c}
              className="m-color-chip"
              style={{ background: c, outline: c === task.color ? '2px solid #1f2937' : 'none' }}
              onClick={() => {
                onUpdate({ color: c });
                setShowColorPicker(false);
              }}
            />
          ))}
        </div>
      )}

      <div className="m-task-bars">
        {task.bars.length === 0 ? (
          <div className="m-task-bars-empty">期間が未設定</div>
        ) : (
          task.bars.map((bar) => (
            <BarRow
              key={bar.id}
              bar={bar}
              onUpdate={(patch) => onUpdateBar(bar.id, patch)}
              onDelete={() => onDeleteBar(bar.id)}
            />
          ))
        )}
      </div>

      {addingBar ? (
        <div className="m-bar-form">
          <div className="m-bar-form-row">
            <span className="m-bar-form-label">開始</span>
            <input
              type="date"
              className="m-bar-form-input"
              value={newStart}
              min={projectStartDate || undefined}
              max={projectEndDate || undefined}
              onChange={(e) => setNewStart(e.target.value)}
            />
          </div>
          <div className="m-bar-form-row">
            <span className="m-bar-form-label">終了</span>
            <input
              type="date"
              className="m-bar-form-input"
              value={newEnd}
              min={projectStartDate || undefined}
              max={projectEndDate || undefined}
              onChange={(e) => setNewEnd(e.target.value)}
            />
          </div>
          <div className="m-bar-form-actions">
            <button className="btn btn-sm" onClick={() => setAddingBar(false)}>
              キャンセル
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleAdd}>
              追加
            </button>
          </div>
        </div>
      ) : (
        <button className="m-add-bar-btn" onClick={() => setAddingBar(true)}>
          + 期間を追加
        </button>
      )}

      <div className="m-task-actions">
        <button
          className="m-task-action-btn"
          disabled={taskIdx === 0}
          onClick={() => onMove(-1)}
        >
          ▲ 上へ
        </button>
        <button
          className="m-task-action-btn"
          disabled={taskIdx === taskCount - 1}
          onClick={() => onMove(1)}
        >
          ▼ 下へ
        </button>
        <button className="m-task-action-btn m-task-action-delete" onClick={onDelete}>
          × 削除
        </button>
      </div>
    </div>
  );
}

function BarRow({
  bar,
  onUpdate,
  onDelete,
}: {
  bar: Bar;
  onUpdate: (patch: Partial<Bar>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const days = diffDays(bar.startDate, bar.endDate) + 1;

  if (editing) {
    return (
      <div className="m-bar-form m-bar-form-inline">
        <div className="m-bar-form-row">
          <span className="m-bar-form-label">開始</span>
          <input
            type="date"
            className="m-bar-form-input"
            value={bar.startDate}
            onChange={(e) => onUpdate({ startDate: e.target.value })}
          />
        </div>
        <div className="m-bar-form-row">
          <span className="m-bar-form-label">終了</span>
          <input
            type="date"
            className="m-bar-form-input"
            value={bar.endDate}
            onChange={(e) => onUpdate({ endDate: e.target.value })}
          />
        </div>
        <div className="m-bar-form-actions">
          <button className="btn btn-sm" onClick={() => setEditing(false)}>
            完了
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="m-bar-row">
      <button className="m-bar-info" onClick={() => setEditing(true)} title="タップで編集">
        <span className="m-bar-icon">📅</span>
        <span className="m-bar-dates">
          {formatJP(bar.startDate, { withWeekday: true })} 〜{' '}
          {formatJP(bar.endDate, { withWeekday: true })}
        </span>
        <span className="m-bar-days">{days}日間</span>
      </button>
      <button className="m-bar-delete" onClick={onDelete} title="削除">
        ×
      </button>
    </div>
  );
}
