import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Project, Task, TimeUnit } from '../../types';
import { TASK_COLOR_PALETTE } from '../../types';
import { uid } from '../../utils/storage';
import { TASK_PRESETS } from '../../utils/presets';
import { formatJPLong, diffDays } from '../../utils/dates';
import { GanttChart } from '../GanttChart/GanttChart';
import { MobileTaskList } from '../MobileTaskList/MobileTaskList';
import { ShareExport } from '../ShareExport/ShareExport';
import { BulkTaskInput } from '../BulkTaskInput/BulkTaskInput';
import './ProjectEditor.css';

// 画面幅監視 (CSS @media と同期)
function useIsMobile(breakpoint = 720): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoint;
  });
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= breakpoint);
    update();
    window.addEventListener('resize', update);
    // matchMedia は OS のフォントサイズ変更等にも反応する
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    mq.addEventListener('change', update);
    return () => {
      window.removeEventListener('resize', update);
      mq.removeEventListener('change', update);
    };
  }, [breakpoint]);
  return isMobile;
}

// PDFPreview は jsPDF + html2canvas を含むので遅延ロード
const PDFPreview = lazy(() =>
  import('../PDFPreview/PDFPreview').then((m) => ({ default: m.PDFPreview }))
);

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

function formatDateShort(iso: string): string {
  if (!iso) return '';
  const d = iso.slice(0, 10).split('-');
  if (d.length !== 3) return iso.slice(0, 10);
  return `${d[0]}/${parseInt(d[1], 10)}/${parseInt(d[2], 10)}`;
}

export function ProjectEditor({ project, onChange }: Props) {
  const [showPresets, setShowPresets] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showPDF, setShowPDF] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile(720);

  // タイトル: 内容変更時に高さ調整
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [project.name]);

  // タイトル: 印刷エリア幅が変わったら(単位切替・ウィンドウサイズ変更等)再計算
  useEffect(() => {
    const el = titleRef.current;
    const printArea = printAreaRef.current;
    if (!el || !printArea) return;
    let rafId = 0;
    const update = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };
    update();
    const ro = new ResizeObserver(onResize);
    ro.observe(printArea);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  const unit: TimeUnit = project.unit ?? 'day';

  const updateField = <K extends keyof Project>(key: K, value: Project[K]) => {
    onChange({ ...project, [key]: value });
  };

  const addTaskWithName = (name: string) => {
    const color = TASK_COLOR_PALETTE[project.tasks.length % TASK_COLOR_PALETTE.length];
    const task: Task = { id: uid(), name, color, bars: [] };
    updateField('tasks', [...project.tasks, task]);
  };

  const addTasksBulk = (names: string[]) => {
    const baseIdx = project.tasks.length;
    const newTasks: Task[] = names.map((name, i) => ({
      id: uid(),
      name,
      color: TASK_COLOR_PALETTE[(baseIdx + i) % TASK_COLOR_PALETTE.length],
      bars: [],
    }));
    updateField('tasks', [...project.tasks, ...newTasks]);
  };

  const handleAddTask = () => addTaskWithName('新しい工種');
  const handleUpdateTasks = (tasks: Task[]) => updateField('tasks', tasks);
  const handleUnitChange = (u: TimeUnit) => updateField('unit', u);

  // 工期日数 (両端含む)
  const periodDays =
    project.startDate && project.endDate
      ? Math.max(0, diffDays(project.startDate, project.endDate)) + 1
      : 0;
  const periodDisplay =
    project.startDate && project.endDate
      ? `${formatJPLong(project.startDate)} 〜 ${formatJPLong(project.endDate)} (${periodDays}日間)`
      : '';

  return (
    <div className="project-editor">
      {/* === 編集ツールバー (PDFには出ない) === */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          {!isMobile && (
            <>
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
            </>
          )}
          <button className="btn btn-sm" onClick={() => setShowPresets(true)}>
            📋 プリセット
          </button>
          <button className="btn btn-sm" onClick={() => setShowBulk(true)}>
            📝 一括追加
          </button>
        </div>
        <div className="editor-toolbar-right">
          <button className="btn btn-sm" onClick={() => setShowShare(true)}>
            📤 共有書き出し
          </button>
          {!isMobile && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowPDF(true)}>
              🖨 PDF出力
            </button>
          )}
        </div>
      </div>

      {/* === スマホ縦画面: タスクリスト表示 === */}
      {isMobile && (
        <MobileTaskList
          project={project}
          onChange={onChange}
          onAddTask={handleAddTask}
          onBulkAdd={() => setShowBulk(true)}
        />
      )}

      {/* === 印刷エリア (これがPDFになる; モバイルでは非表示) === */}
      <div className="print-area-scroll" hidden={isMobile}>
        <div ref={printAreaRef} className="print-area">
          {/* 印刷ヘッダー */}
          <header className="print-header">
            {/* 上段: 「工程表」ラベル + 作成/更新日 */}
            <div className="print-header-top">
              <span className="print-doc-label">工 程 表</span>
              <span className="print-doc-dates">
                <span>作成 {formatDateShort(project.createdAt)}</span>
                <span className="print-doc-dates-sep">/</span>
                <span>更新 {formatDateShort(project.updatedAt)}</span>
              </span>
            </div>

            {/* タイトル(中央寄せ・大きく・複数行自動対応) */}
            <textarea
              ref={titleRef}
              className="print-title"
              value={project.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="現場名・工事名を入力"
              rows={1}
              spellCheck={false}
              onKeyDown={(e) => {
                // Enter で改行を許可しない (シンプルな1〜2行タイトルとして使う)
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />

            {/* メタ行(中央寄せ) */}
            <div className="print-meta-row">
              <div className="print-meta-field">
                <span className="print-meta-label">元請会社</span>
                <input
                  className="print-meta-input"
                  value={project.contractor}
                  onChange={(e) => updateField('contractor', e.target.value)}
                  placeholder="元請会社名"
                />
              </div>
              <div className="print-meta-field print-meta-period">
                <span className="print-meta-label">工期</span>
                {/* 編集用: date inputs (PDFでは非表示にしてフォーマット済みspanで置換) */}
                <span className="print-meta-period-edit">
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
                </span>
                {/* 印刷専用: 日本語フォーマット済み(エディタでは非表示) */}
                <span className="print-only-period" data-print-display={periodDisplay}>
                  {periodDisplay}
                </span>
              </div>
            </div>
          </header>

          {/* ガントチャート */}
          <GanttChart
            startDate={project.startDate}
            endDate={project.endDate}
            tasks={project.tasks}
            unit={unit}
            onTasksChange={handleUpdateTasks}
          />

          {/* 印刷フッター: 備考 */}
          <footer className="print-footer">
            <div className="print-footer-label">備考</div>
            <textarea
              className="print-memo"
              value={project.memo}
              onChange={(e) => updateField('memo', e.target.value)}
              placeholder="工程全体に関するメモ・注意事項・連絡先などを記載..."
              rows={3}
            />
          </footer>
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

      {showBulk && (
        <BulkTaskInput
          onClose={() => setShowBulk(false)}
          onSubmit={(names) => addTasksBulk(names)}
        />
      )}
    </div>
  );
}
