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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Zeus Clarifying Questions">
      <div className="clarify-modal">
        <div className="clarify-header">
          <div className="clarify-title-row">
            <span className="clarify-icon">
              <Crown size={18} />
            </span>
            <div>
              <h2 className="clarify-title">Zeus Needs Quick Context</h2>
              <p className="clarify-subtitle">
                Answer to sharpen the Pantheon's search & scraping — or skip to let Zeus assume defaults.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Minimize clarification modal"
          >
            <X size={16} />
          </button>
        </div>

        {mission.contextSummary && (
          <div className="clarify-context-brief">
            <span className="clarify-brief-label">Understood Mission Scope</span>
            <p>{mission.contextSummary}</p>
          </div>
        )}

        <form className="clarify-form" onSubmit={handleSubmit}>
          <div className="clarify-questions">
            {mission.questions.map((q, idx) => (
              <div key={q.id} className="clarify-q-card">
                <label className="clarify-q-label" htmlFor={`clarify-${q.id}`}>
                  <span className="clarify-q-num">{idx + 1}</span>
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
                  placeholder="Type your answer (or pick a suggestion above)…"
                />
              </div>
            ))}
          </div>

          <div className="clarify-footer">
            <button
              type="button"
              className="clarify-skip-btn"
              disabled={isSubmitting}
              onClick={() => onSubmit({}, true)}
            >
              <Brain size={14} />
              <span>Skip — Assume Context & Deploy</span>
            </button>

            <button
              type="submit"
              className="clarify-submit-btn"
              disabled={isSubmitting}
            >
              <Send size={14} />
              <span>{isSubmitting ? 'Deploying Pantheon…' : 'Submit & Deploy Pantheon'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
