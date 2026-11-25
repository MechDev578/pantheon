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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Pantheon Settings">
      <div className="settings-modal">
        <div className="settings-header">
          <div className="settings-title-group">
            <KeyRound size={17} className="settings-icon" />
            <div>
              <h2 className="settings-title">Pantheon v2 Engine Settings</h2>
              <p className="settings-subtitle">
                Choose your AI brain (Gemini, OpenAI, or Claude) and optional search keys.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-status-card">
            <Server size={15} />
            <div className="status-card-text">
              <strong>
                {capabilities?.runtime === 'local'
                  ? 'Local Mac Engine Connected (Unlimited Runtime & Deep Crawl)'
                  : capabilities?.runtime === 'cloud'
                    ? 'Netlify Cloud Engine Connected (Live Serverless Streaming)'
                    : 'Offline / Demo Mode Only (Start with `npm run dev` locally or deploy to Netlify)'}
              </strong>
              <span>
                API keys entered below stay strictly in your browser&apos;s localStorage and are never committed to Git.
              </span>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">AI Provider</label>
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
                Model ID Override
              </label>
              <input
                id="pantheon-model-custom"
                type="text"
                className="settings-input"
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
                {activeProviderMeta.label} API Key
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
                className="settings-input"
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
                className="key-eye-btn"
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
                <Search size={11} /> Web Search Engine
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
                Optional Search API Key (Tavily / Brave)
              </label>
              <input
                id="pantheon-search-key"
                type={showKey ? 'text' : 'password'}
                className="settings-input"
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
          <button type="button" className="settings-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
