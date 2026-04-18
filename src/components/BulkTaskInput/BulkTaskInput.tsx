import { useState } from 'react';
import './BulkTaskInput.css';

interface Props {
  onClose: () => void;
  onSubmit: (taskNames: string[]) => void;
}

export function BulkTaskInput({ onClose, onSubmit }: Props) {
  const [text, setText] = useState('');

  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const handleSubmit = () => {
    if (lines.length === 0) {
      alert('1つ以上の工種名を入力してください');
      return;
    }
    onSubmit(lines);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal bulk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">工種を一括追加</div>
        <div className="modal-body">
          <p className="bulk-hint">
            1行に1つずつ工種名を入力してください。コピー&ペーストもOKです。
            空行は無視されます。
          </p>
          <textarea
            className="bulk-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'例:\n足場\n基礎工事\n鉄筋工事\n型枠工事\nコンクリート打設'}
            autoFocus
            rows={10}
          />
          <div className="bulk-counter">
            {lines.length > 0 ? (
              <span>
                <strong>{lines.length}件</strong> の工種を追加します
              </span>
            ) : (
              <span className="bulk-counter-empty">入力待ち...</span>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={lines.length === 0}
          >
            {lines.length > 0 ? `${lines.length}件追加` : '追加'}
          </button>
        </div>
      </div>
    </div>
  );
}
