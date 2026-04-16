import { lazy, Suspense, useRef, useState } from 'react';
import type { Project, Task, TimeUnit } from '../../types';
import { TASK_COLOR_PALETTE } from '../../types';
import { uid } from '../../utils/storage';
import { TASK_PRESETS } from '../../utils/presets';
import { GanttChart } from '../GanttChart/GanttChart';
import { ShareExport } from '../ShareExport/ShareExport';
import './ProjectEditor.css';

// PDFPreview は jsPDF + html2canvas を含むので遅延ロード
const PDFPreview = lazy(() =>
  import('../PDFPreview/PDFPreview').then((m) => ({ default: m.PDFPreview }))
);

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

export function ProjectEditor({ project, onChange }: Props) {
  const [showPresets, setShowPresets] = useState(false);
  const [showPDF, setShowPDF] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

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
      {/* === 編集ツールバー (PDFには出ない) === */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <button className="btn btn-primary btn-sm" onClick={handleAddTask}>
            + 工種を追加
          </button>
          <div className="unit-switch" role="tablist" aria-label="表示単位">
            {(['day', 'half', 'week'] as TimeUnit[]).map((u) => (
              <button
                key={u}
                role="tab"
                className={'unit-switch-btn' + (unit === u ? ' is-active' : '')}
                onClick={() => handleUnitChange(u)}
              >
                {u === 'day' ? '日' : u === 'half' ? '半日' : '週'}
              </button>
            ))}
          </div>
          <button className="btn btn-sm" onClick={() => setShowPresets(true)}>
            📋 プリセット
          </button>
        </div>
        <div className="editor-toolbar-right">
          <button className="btn btn-sm" onClick={() => setShowShare(true)}>
            📤 共有書き出し
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowPDF(true)}>
            🖨 PDF出力
          </button>
        </div>
      </div>

      {/* === 印刷エリア (これがPDFになる) === */}
      <div className="print-area-scroll">
        <div ref={printAreaRef} className="print-area">
          {/* 印刷ヘッダー: 現場名・元請・工期 */}
          <div className="print-header">
            <input
              className="print-title"
              value={project.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="現場名・工事名"
            />
            <div className="print-meta-row">
              <div className="print-meta-field">
                <span className="print-meta-label">元請</span>
                <input
                  className="print-meta-input"
                  value={project.contractor}
                  onChange={(e) => updateField('contractor', e.target.value)}
                  placeholder="元請会社名"
                />
              </div>
              <div className="print-meta-field">
                <span className="print-meta-label">工期</span>
                <input
                  type="date"
                  className="print-meta-input print-meta-date"
                  value={project.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                />
                <span className="print-meta-sep">〜</span>
                <input
                  type="date"
                  className="print-meta-input print-meta-date"
                  value={project.endDate}
                  onChange={(e) => updateField('endDate', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ガントチャート */}
          <GanttChart
            startDate={project.startDate}
            endDate={project.endDate}
            tasks={project.tasks}
            unit={unit}
            onTasksChange={handleUpdateTasks}
          />

          {/* 印刷フッター: 備考 */}
          <div className="print-footer">
            <div className="print-footer-label">備考</div>
            <textarea
              className="print-memo"
              value={project.memo}
              onChange={(e) => updateField('memo', e.target.value)}
              placeholder="工程全体に関するメモ・注意事項・連絡先などを記載..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* === モーダル群 === */}
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
        <Suspense
          fallback={
            <div className="modal-backdrop">
              <div className="modal" style={{ padding: '24px', textAlign: 'center' }}>
                PDF機能を読み込み中…
              </div>
            </div>
          }
        >
          <PDFPreview
            project={project}
            ganttEl={printAreaRef.current}
            onClose={() => setShowPDF(false)}
          />
        </Suspense>
      )}

      {showShare && <ShareExport project={project} onClose={() => setShowShare(false)} />}
    </div>
  );
}
