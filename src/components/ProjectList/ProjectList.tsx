import { useRef, useState } from 'react';
import type { Project, Task } from '../../types';
import { TASK_COLOR_PALETTE } from '../../types';
import { downloadJSON, readJSONFile, uid } from '../../utils/storage';
import { today, addDays, formatJPLong } from '../../utils/dates';
import { PROJECT_TEMPLATES, findTemplate, type ProjectTemplate } from '../../utils/projectTemplates';
import './ProjectList.css';

interface Props {
  projects: Project[];
  onOpen: (id: string) => void;
  onCreate: (project: Project) => void;
  onDelete: (id: string) => void;
  onImport: (project: Project) => void;
  onDuplicate: (id: string) => void;
}

interface NewProjectForm {
  templateId: string;
  name: string;
  contractor: string;
  startDate: string;
  endDate: string;
}

const initialForm = (): NewProjectForm => ({
  templateId: 'blank',
  name: '',
  contractor: '',
  startDate: today(),
  endDate: addDays(today(), 30),
});

/** テンプレートを基にプロジェクトを生成 */
function buildProjectFromTemplate(form: NewProjectForm, template: ProjectTemplate): Project {
  const now = new Date().toISOString();
  const tasks: Task[] = template.tasks.map((t, i) => ({
    id: uid(),
    name: t.name,
    color: TASK_COLOR_PALETTE[i % TASK_COLOR_PALETTE.length],
    bars: [
      {
        id: uid(),
        startDate: addDays(form.startDate, t.startOffset),
        endDate: addDays(form.startDate, t.startOffset + t.duration - 1),
      },
    ],
  }));
  return {
    id: uid(),
    name: form.name.trim(),
    contractor: form.contractor.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    tasks,
    memo: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function ProjectList({ projects, onOpen, onCreate, onDelete, onImport, onDuplicate }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewProjectForm>(initialForm);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSelectTemplate = (templateId: string) => {
    const tpl = findTemplate(templateId);
    if (!tpl) return;
    // 工期終了をテンプレートのデフォルト日数に合わせて自動更新
    setForm((f) => ({
      ...f,
      templateId,
      endDate: addDays(f.startDate, tpl.defaultDurationDays - 1),
    }));
  };

  const handleStartDateChange = (newStart: string) => {
    // 開始日変更時、テンプレートが選ばれていれば終了日も連動
    setForm((f) => {
      const tpl = findTemplate(f.templateId);
      if (tpl && tpl.id !== 'blank') {
        return { ...f, startDate: newStart, endDate: addDays(newStart, tpl.defaultDurationDays - 1) };
      }
      return { ...f, startDate: newStart };
    });
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      alert('現場名を入力してください');
      return;
    }
    const tpl = findTemplate(form.templateId) ?? findTemplate('blank')!;
    const project = buildProjectFromTemplate(form, tpl);
    onCreate(project);
    setShowCreate(false);
    setForm(initialForm());
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = (await readJSONFile(file)) as Partial<Project>;
      if (!data || typeof data !== 'object' || !data.name) {
        throw new Error('不正なファイル形式');
      }
      const project: Project = {
        id: data.id ?? uid(),
        name: data.name ?? '無題',
        contractor: data.contractor ?? '',
        startDate: data.startDate ?? today(),
        endDate: data.endDate ?? addDays(today(), 30),
        tasks: data.tasks ?? [],
        memo: data.memo ?? '',
        createdAt: data.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onImport(project);
    } catch (err) {
      alert('ファイルの読み込みに失敗しました: ' + (err as Error).message);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="project-list-page">
      <div className="project-list-toolbar">
        <div>
          <h2 className="page-title">工程表一覧</h2>
          <p className="page-subtitle">{projects.length}件の工程表</p>
        </div>
        <div className="toolbar-actions">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <button className="btn" onClick={handleImportClick}>
            📂 JSONを開く
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + 新規作成
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="landing">
          <div className="landing-hero">
            <div className="landing-badge">建設業の現場のための無料ツール</div>
            <h1 className="landing-title">
              工程表を、もっと速く、<br />
              <span className="landing-title-accent">もっと軽く。</span>
            </h1>
            <p className="landing-lead">
              個人事業主・中小企業の現場担当者向け。<br />
              ガントチャートをドラッグだけで作って、PDFでさっと共有。
            </p>
            <div className="landing-cta">
              <button className="btn btn-primary btn-lg" onClick={() => setShowCreate(true)}>
                + 工程表を作る
              </button>
              <button className="btn btn-lg" onClick={handleImportClick}>
                📂 JSONから読み込む
              </button>
            </div>
            <div className="landing-meta">
              無料・ログイン不要・データは手元のPC内で完結
            </div>
          </div>

          <div className="landing-features">
            <div className="landing-feature">
              <div className="landing-feature-icon">⏱</div>
              <div className="landing-feature-title">日 / 半日 / 週で表示</div>
              <div className="landing-feature-desc">
                短期工事は日単位、長期は週単位。状況に合わせて表示を切替えられます。
              </div>
            </div>
            <div className="landing-feature">
              <div className="landing-feature-icon">🖨</div>
              <div className="landing-feature-title">A4横でPDF出力</div>
              <div className="landing-feature-desc">
                収まらない工程は週圧縮 / 月分割を自動提案。表紙ページ付きで元請提出にもそのまま。
              </div>
            </div>
            <div className="landing-feature">
              <div className="landing-feature-icon">🔒</div>
              <div className="landing-feature-title">データは手元に</div>
              <div className="landing-feature-desc">
                サーバーに送信ゼロ。すべてブラウザに保存され、JSONで自由に持ち運べます。
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <div key={p.id} className="project-card">
              <div className="project-card-body" onClick={() => onOpen(p.id)}>
                <div className="project-card-name">{p.name}</div>
                {p.contractor && <div className="project-card-sub">{p.contractor}</div>}
                <div className="project-card-meta">
                  <span className="meta-label">工期</span>
                  <span>{formatJPLong(p.startDate)} 〜 {formatJPLong(p.endDate)}</span>
                </div>
                <div className="project-card-meta">
                  <span className="meta-label">工種</span>
                  <span>{p.tasks.length}件</span>
                </div>
              </div>
              <div className="project-card-actions">
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(p.id);
                  }}
                  title="複製"
                >
                  ⎘ 複製
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadJSON(`${p.name || 'koutei'}.json`, p);
                  }}
                  title="JSONとして書き出し"
                >
                  ⬇ 書出し
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`「${p.name}」を削除しますか?`)) onDelete(p.id);
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">新規工程表の作成</div>
            <div className="modal-body">
              {/* テンプレート選択 */}
              <div>
                <label className="label">ベースを選ぶ</label>
                <div className="template-grid">
                  {PROJECT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className={
                        'template-card' + (form.templateId === tpl.id ? ' is-selected' : '')
                      }
                      onClick={() => handleSelectTemplate(tpl.id)}
                    >
                      <div className="template-icon">{tpl.icon ?? '📄'}</div>
                      <div className="template-name">{tpl.name}</div>
                      <div className="template-meta">
                        {tpl.tasks.length === 0
                          ? '工種なし'
                          : `${tpl.tasks.length}工種・約${tpl.defaultDurationDays}日`}
                      </div>
                    </button>
                  ))}
                </div>
                {form.templateId !== 'blank' && (
                  <div className="template-desc">
                    {findTemplate(form.templateId)?.description}
                  </div>
                )}
              </div>

              <div>
                <label className="label">現場名・工事名 *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例: ○○ビル新築工事"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">元請会社名</label>
                <input
                  className="input"
                  value={form.contractor}
                  onChange={(e) => setForm({ ...form, contractor: e.target.value })}
                  placeholder="例: ○○建設"
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">工期開始</label>
                  <input
                    type="date"
                    className="input"
                    value={form.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">工期終了</label>
                  <input
                    type="date"
                    className="input"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowCreate(false)}>
                キャンセル
              </button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {findTemplate(form.templateId) && findTemplate(form.templateId)!.tasks.length > 0
                  ? `作成 (${findTemplate(form.templateId)!.tasks.length}工種をセット)`
                  : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
