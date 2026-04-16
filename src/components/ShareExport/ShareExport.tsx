import { useState } from 'react';
import type { Project } from '../../types';
import { downloadJSON } from '../../utils/storage';
import './ShareExport.css';

interface Props {
  project: Project;
  onClose: () => void;
}

export function ShareExport({ project, onClose }: Props) {
  const [includeName, setIncludeName] = useState(true);
  const [includeContractor, setIncludeContractor] = useState(true);
  const [includeMemo, setIncludeMemo] = useState(true);

  const handleExport = () => {
    const out: Project = {
      ...project,
      name: includeName ? project.name : '',
      contractor: includeContractor ? project.contractor : '',
      memo: includeMemo ? project.memo : '',
    };
    downloadJSON(`${(includeName && project.name) || 'koutei'}.json`, out);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">JSONで共有書き出し</div>
        <div className="modal-body share-body">
          <p className="share-hint">
            含める項目を選んでください。協力会社など外部に渡す場合、不要な情報を省略できます。
          </p>

          <label className="share-check">
            <input
              type="checkbox"
              checked={includeName}
              onChange={(e) => setIncludeName(e.target.checked)}
            />
            <div>
              <div className="share-check-title">現場名・工事名</div>
              <div className="share-check-value">{project.name || '(空)'}</div>
            </div>
          </label>

          <label className="share-check">
            <input
              type="checkbox"
              checked={includeContractor}
              onChange={(e) => setIncludeContractor(e.target.checked)}
            />
            <div>
              <div className="share-check-title">元請会社名</div>
              <div className="share-check-value">{project.contractor || '(空)'}</div>
            </div>
          </label>

          <label className="share-check">
            <input
              type="checkbox"
              checked={includeMemo}
              onChange={(e) => setIncludeMemo(e.target.checked)}
            />
            <div>
              <div className="share-check-title">全体備考</div>
              <div className="share-check-value share-check-memo">
                {project.memo ? project.memo.slice(0, 60) + (project.memo.length > 60 ? '…' : '') : '(空)'}
              </div>
            </div>
          </label>

          <div className="share-always">
            <strong>常に含まれる項目:</strong> 工期(開始/終了)・工種一覧・バー・色・単位
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={handleExport}>
            ⬇ 書き出し
          </button>
        </div>
      </div>
    </div>
  );
}
