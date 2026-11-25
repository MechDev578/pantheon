import { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Globe, Sparkles, X } from 'lucide-react';
import type { MissionState, ScrapedSource } from '../../types/bot';
import './MissionReportModal.css';

interface MissionReportModalProps {
  mission: MissionState | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MissionReportModal({ mission, isOpen, onClose }: MissionReportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !mission || !mission.finalReport) return null;

  const allSourcesMap = new Map<string, ScrapedSource>();
  for (const bot of Object.values(mission.bots)) {
    for (const src of bot.sources) {
      if (src.status === 'ok' && !allSourcesMap.has(src.url)) {
        allSourcesMap.set(src.url, src);
      }
    }
  }
  const uniqueSources = Array.from(allSourcesMap.values());

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mission.finalReport ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownload = () => {
    const blob = new Blob([mission.finalReport ?? ''], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mission.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) || 'pantheon-report'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Mission Final Report">
      <div className="report-modal">
        <div className="report-header">
          <div className="report-title-group">
            <span className="report-badge">
              <Sparkles size={14} />
              <span>Apollo Final Report</span>
            </span>
            <h2 className="report-title">{mission.title}</h2>
            <p className="report-meta">
              {Object.keys(mission.bots).length} Olympians · {uniqueSources.length} verified websites scraped ·{' '}
              {mission.provider}/{mission.model}
            </p>
          </div>
          <div className="report-actions">
            <button type="button" className="report-btn" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy MD'}</span>
            </button>
            <button type="button" className="report-btn" onClick={handleDownload}>
              <Download size={14} />
              <span>Download .md</span>
            </button>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close report"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="report-content">
          {mission.assumptions.length > 0 && (
            <div className="report-assumptions">
              <div className="report-section-tag">Assumptions Logged</div>
              <ul>
                {mission.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <pre className="report-markdown">{mission.finalReport}</pre>

          {uniqueSources.length > 0 && (
            <div className="report-sources">
              <div className="report-section-tag">
                <Globe size={12} />
                <span>Verified Scraped Websites ({uniqueSources.length})</span>
              </div>
              <div className="report-source-grid">
                {uniqueSources.map((src) => (
                  <a
                    key={src.id}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="report-source-card"
                  >
                    <div className="report-source-top">
                      <span className="report-source-domain">{src.domain}</span>
                      <ExternalLink size={11} />
                    </div>
                    <span className="report-source-title">{src.title}</span>
                    <span className="report-source-stats">
                      {src.wordCount} words · depth {src.depth}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
