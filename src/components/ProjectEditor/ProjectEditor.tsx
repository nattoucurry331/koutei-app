import { lazy, Suspense, useRef, useState } from 'react';
import type { Project, Task, TimeUnit } from '../../types';
import { TASK_COLOR_PALETTE } from '../../types';
import { uid } from '../../utils/storage';
import { TASK_PRESETS } from '../../utils/presets';
import { GanttChart } from '../GanttChart/GanttChart';
import { ShareExport } from '../ShareExport/ShareExport';
import './ProjectEditor.css';

// PDFPreview は jsPDF + html2canvas を含む大きなコンポーネントなので遅延ロード
const PDFPreview = lazy(() =>
  import('../PDFPreview/PDFPreview').then((m) => ({ default: m.PDFPreview }))
);

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

export function ProjectEditor({ project, onChange }: Props) {
  const [showInfo, setShowInfo] = useState(true);
  const [showPresets, setShowPresets] = useState(false);
  const [showPDF, setShowPDF] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const ganttRef = useRef<HTMLDivElement>(null);

  const unit: TimeUnit = project.unit ?? 'day';

  const updateField = <K extends keyof Project>(key: K, value: Project[K]) => {
    onChange({ ...project, [key]: value });
  };

  const addTaskWithName = (name: string) => {
    const color = TASK_COLOR_PALETTE[project.tasks.length % TASK_COLOR_PALETTE.length];
    const task: Task = { id: uid(), name, color, bars: [] };
    updateField('tasks', [...project.tasks, task]);
  };

  const handleAddTask = () => addTaskWithName('新しい工種');
  const handleUpdateTasks = (tasks: Task[]) => updateField('tasks', tasks);
  const handleUnitChange = (u: TimeUnit) => updateField('unit', u);

  return (
    <div className="project-editor">
      <div className="editor-info-bar">
        <button className="btn btn-ghost btn-sm" onClick={() => setShowInfo((v) => !v)}>
          {showInfo ? '▼' : '▶'} プロジェクト情報
        </button>
        <div className="editor-info-actions">
          <button className="btn btn-sm" onClick={() => setShowPresets(true)}>
            📋 プリセット工種
          </button>
          <button className="btn btn-sm" onClick={() => setShowShare(true)}>
            📤 共有書き出し
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowPDF(true)}>
            🖨 PDF出力
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="editor-info-panel">
          <div className="info-grid">
            <div>
              <label className="label">現場名・工事名</label>
              <input
                className="input"
                value={project.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>
            <div>
              <label className="label">元請会社名</label>
              <input
                className="input"
                value={project.contractor}
                onChange={(e) => updateField('contractor', e.target.value)}
              />
            </div>
            <div>
              <label className="label">工期開始</label>
              <input
                type="date"
                className="input"
                value={project.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="label">工期終了</label>
              <input
                type="date"
                className="input"
                value={project.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">全体備考</label>
            <textarea
              className="textarea"
              value={project.memo}
              onChange={(e) => updateField('memo', e.target.value)}
              placeholder="工程全体に関するメモを記載..."
            />
          </div>
        </div>
      )}

      <GanttChart
        startDate={project.startDate}
        endDate={project.endDate}
        tasks={project.tasks}
        unit={unit}
        onTasksChange={handleUpdateTasks}
        onAddTask={handleAddTask}
        onUnitChange={handleUnitChange}
        tableRef={ganttRef}
      />

      {showPresets && (
        <div className="modal-backdrop" onClick={() => setShowPresets(false)}>
          <div className="modal preset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">プリセットから工種を追加</div>
            <div className="modal-body preset-body">
              {TASK_PRESETS.map((cat) => (
                <div key={cat.category} className="preset-category">
                  <div className="preset-category-name">{cat.category}</div>
                  <div className="preset-chips">
                    {cat.items.map((name) => (
                      <button
                        key={name}
                        className="preset-chip"
                        onClick={() => addTaskWithName(name)}
                      >
                        + {name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowPresets(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {showPDF && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal" style={{padding: '24px', textAlign: 'center'}}>PDF機能を読み込み中…</div></div>}>
          <PDFPreview project={project} ganttEl={ganttRef.current} onClose={() => setShowPDF(false)} />
        </Suspense>
      )}

      {showShare && <ShareExport project={project} onClose={() => setShowShare(false)} />}
    </div>
  );
}
