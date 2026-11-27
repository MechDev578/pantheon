import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Search, Server, ShieldCheck, X } from 'lucide-react';
import { PROVIDER_MODELS } from '../../../engine/pantheonRoster';
import type {
  AIProvider,
  PantheonSettings,
  SearchProvider,
  ServerCapabilities,
} from '../../types/bot';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  settings: PantheonSettings;
  capabilities: ServerCapabilities | null;
  onUpdateSettings: (updater: (prev: PantheonSettings) => PantheonSettings) => void;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  settings,
  capabilities,
  onUpdateSettings,
  onClose,
}: SettingsModalProps) {
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const activeProviderMeta = PROVIDER_MODELS[settings.provider];
  const serverHasActiveKey = Boolean(capabilities?.configuredProviders[settings.provider]);

  const handleProviderChange = (provider: AIProvider) => {
    onUpdateSettings((prev) => ({
      ...prev,
      provider,
      model: PROVIDER_MODELS[provider].defaultModel,
    }));
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Pantheon Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-modal">
        <div className="settings-header">
          <div className="settings-title-group">
            <span className="settings-icon-wrap">
              <KeyRound size={15} strokeWidth={1.7} />
            </span>
            <div>
              <h2 className="settings-title">Pantheon v2.2.1 settings</h2>
              <p className="settings-subtitle">
                Choose your AI provider (Gemini, OpenAI, or Claude) and optional search keys.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={16} strokeWidth={1.6} />
          </button>
        </div>

        <div className="settings-body scroll-quiet">
          <div className="settings-status-card">
            <Server size={15} strokeWidth={1.6} />
            <div className="status-card-text">
              <strong>
                {capabilities?.runtime === 'local'
                  ? 'Local engine connected (unlimited runtime & deep crawl)'
                  : capabilities?.runtime === 'cloud'
                    ? 'Netlify cloud engine connected (live serverless streaming)'
                    : 'Offline demo mode only (run `npm run dev` locally or deploy to Netlify)'}
              </strong>
              <span>
                API keys entered below stay strictly in your browser&apos;s localStorage and are never committed to Git.
              </span>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">AI provider</label>
            <div className="provider-grid">
              {(['gemini', 'openai', 'anthropic'] as const).map((prov) => {
                const envReady = Boolean(capabilities?.configuredProviders[prov]);
                const localReady = Boolean(settings.apiKeys[prov]?.trim());
                return (
                  <button
                    key={prov}
                    type="button"
                    className={`provider-card ${settings.provider === prov ? 'is-selected' : ''}`}
                    onClick={() => handleProviderChange(prov)}
                  >
                    <span className="provider-name">{PROVIDER_MODELS[prov].label}</span>
                    <span className={`provider-badge ${envReady || localReady ? 'is-ready' : ''}`}>
                      {envReady ? 'Server .env ready' : localReady ? 'Key saved' : 'Key needed'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-field">
              <label className="settings-label" htmlFor="pantheon-model-select">
                Model
              </label>
              <select
                id="pantheon-model-select"
                className="settings-input"
                value={
                  activeProviderMeta.models.includes(settings.model)
                    ? settings.model
                    : '__custom__'
                }
                onChange={(e) => {
                  if (e.target.value !== '__custom__') {
                    onUpdateSettings((prev) => ({ ...prev, model: e.target.value }));
                  }
                }}
              >
                {activeProviderMeta.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="__custom__">Custom model ID…</option>
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-label" htmlFor="pantheon-model-custom">
                Model ID override
              </label>
              <input
                id="pantheon-model-custom"
                type="text"
                className="settings-input mono"
                value={settings.model}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({ ...prev, model: e.target.value }))
                }
                placeholder={activeProviderMeta.defaultModel}
              />
            </div>
          </div>

          <div className="settings-field">
            <div className="settings-label-row">
              <label className="settings-label" htmlFor="pantheon-api-key">
                {activeProviderMeta.label} API key
              </label>
              {serverHasActiveKey && (
                <span className="env-detected-pill">
                  <CheckCircle2 size={11} />
                  Detected from server .env (optional override)
                </span>
              )}
            </div>
            <div className="key-input-wrap">
              <input
                id="pantheon-api-key"
                type={showKey ? 'text' : 'password'}
                className="settings-input mono"
                value={settings.apiKeys[settings.provider]}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    apiKeys: {
                      ...prev.apiKeys,
                      [prev.provider]: e.target.value,
                    },
                  }))
                }
                placeholder={
                  serverHasActiveKey
                    ? 'Using server .env key — paste here to override'
                    : activeProviderMeta.keyPlaceholder
                }
                autoComplete="off"
              />
              <button
                type="button"
                className="btn btn-ghost btn-icon key-eye-btn"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="settings-divider" />

          <div className="settings-row">
            <div className="settings-field">
              <label className="settings-label" htmlFor="pantheon-search-provider">
                <Search size={11} /> Web search engine
              </label>
              <select
                id="pantheon-search-provider"
                className="settings-input"
                value={settings.searchProvider}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    searchProvider: e.target.value as SearchProvider,
                  }))
                }
              >
                <option value="auto">Auto (DuckDuckGo built-in, or Brave/Tavily if key set)</option>
                <option value="duckduckgo">DuckDuckGo + Deep Scraper (Free, no key)</option>
                <option value="tavily">Tavily Search API</option>
                <option value="brave">Brave Search API</option>
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-label" htmlFor="pantheon-search-key">
                Optional search API key (Tavily / Brave)
              </label>
              <input
                id="pantheon-search-key"
                type={showKey ? 'text' : 'password'}
                className="settings-input mono"
                value={settings.searchApiKey}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({ ...prev, searchApiKey: e.target.value }))
                }
                placeholder="Optional — leave blank for built-in DuckDuckGo"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <span className="settings-privacy-note">
            <ShieldCheck size={13} />
            Keys remain local to your browser / .env file.
          </span>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
