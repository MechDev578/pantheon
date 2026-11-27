import { useEffect, useState, type FormEvent } from 'react';
import { Brain, Crown, Send, X } from 'lucide-react';
import type { MissionState } from '../../types/bot';
import './ClarificationModal.css';

interface ClarificationModalProps {
  mission: MissionState;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (answers: Record<string, string>, skipAndAssume?: boolean) => void;
}

export function ClarificationModal({
  mission,
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}: ClarificationModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setAnswers({ ...mission.answers });
  }, [mission.id, mission.answers]);

  if (!isOpen || mission.questions.length === 0) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(answers, false);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Zeus Clarifying Questions"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="clarify-modal">
        <div className="clarify-header">
          <div className="clarify-title-row">
            <span className="clarify-icon">
              <Crown size={16} strokeWidth={1.7} />
            </span>
            <div>
              <h2 className="clarify-title">Zeus needs quick context</h2>
              <p className="clarify-subtitle">
                Answer to sharpen the Pantheon&apos;s search and scraping, or skip to let Zeus assume defaults.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Minimize clarification modal"
          >
            <X size={16} strokeWidth={1.6} />
          </button>
        </div>

        {mission.contextSummary && (
          <div className="clarify-context-brief">
            <span className="clarify-brief-label">Understood mission scope</span>
            <p>{mission.contextSummary}</p>
          </div>
        )}

        <form className="clarify-form" onSubmit={handleSubmit}>
          <div className="clarify-questions scroll-quiet">
            {mission.questions.map((q, idx) => (
              <div key={q.id} className="clarify-q-card">
                <label className="clarify-q-label" htmlFor={`clarify-${q.id}`}>
                  <span className="clarify-q-num mono">{idx + 1}</span>
                  <span>{q.question}</span>
                </label>
                {q.reason && <p className="clarify-q-reason">{q.reason}</p>}

                {q.suggestedOptions && q.suggestedOptions.length > 0 && (
                  <div className="clarify-options">
                    {q.suggestedOptions.map((opt) => {
                      const active = answers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          className={`clarify-opt-chip ${active ? 'is-selected' : ''}`}
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [q.id]: active ? '' : opt,
                            }))
                          }
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                <input
                  id={`clarify-${q.id}`}
                  type="text"
                  className="clarify-input"
                  value={answers[q.id] ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  placeholder="Type your answer or pick a suggestion above…"
                />
              </div>
            ))}
          </div>

          <div className="clarify-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSubmitting}
              onClick={() => onSubmit({}, true)}
            >
              <Brain size={14} />
              <span>Skip &amp; auto-assume</span>
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              <Send size={14} />
              <span>{isSubmitting ? 'Deploying Pantheon…' : 'Submit & deploy'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
