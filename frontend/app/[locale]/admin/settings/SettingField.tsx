'use client';

import type { ReactNode } from 'react';
import { JSON_KEYS, WORDLIST_KEYS, SELECT_FIELD_OPTIONS, type Setting } from './categories';

const TEXTAREA_ROWS: Record<string, number> = {
  welcome_pm_body: 6,
  announcement_text: 4,
  footer_text: 4,
  login_message: 3,
  site_description: 3,
};

const IMAGE_KEYS = new Set(['site_logo_url', 'site_favicon_url']);

interface Props {
  setting: Setting;
  value: string;
  onChange: (key: string, value: string) => void;
  onUpload?: (key: string, file: File) => void;
  error?: string;
}

const inputClass =
  'w-full border border-current/20 rounded bg-transparent px-3 py-1.5 text-sm ' +
  'focus:outline-none focus:border-current/40';

export function SettingField({ setting, value, onChange, onUpload, error }: Props) {
  const { key, type, label } = setting;

  let input: ReactNode;

  if (key in SELECT_FIELD_OPTIONS) {
    input = (
      <select
        value={value}
        onChange={e => onChange(key, e.target.value)}
        className={inputClass}
        style={{ color: 'var(--text-primary)' }}
      >
        {SELECT_FIELD_OPTIONS[key].map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  } else if (IMAGE_KEYS.has(key)) {
    input = (
      <label className="inline-flex items-center gap-3 cursor-pointer">
        {value && <img src={value} alt="" className="h-8 w-auto rounded" />}
        <span
          className="px-3 py-1.5 rounded border border-current/20 text-sm hover:border-current/40 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          {value ? 'Replace' : 'Upload image'}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={e => { const f = e.target.files?.[0]; if (f && onUpload) onUpload(key, f); }}
          className="sr-only"
        />
      </label>
    );
  } else if (key in TEXTAREA_ROWS) {
    input = (
      <textarea
        rows={TEXTAREA_ROWS[key]}
        value={value}
        onChange={e => onChange(key, e.target.value)}
        className={inputClass}
        style={{ color: 'var(--text-primary)', resize: 'vertical' }}
      />
    );
  } else if (WORDLIST_KEYS.has(key)) {
    // Convert JSON array ↔ one word per line for easy editing
    let lines = '';
    try { lines = (JSON.parse(value) as string[]).join('\n'); } catch { lines = value; }
    input = (
      <div className="space-y-1">
        <textarea
          rows={12}
          value={lines}
          onChange={e => {
            const words = e.target.value
              .split('\n')
              .map(w => w.trim().toLowerCase())
              .filter(w => w.length > 0);
            onChange(key, JSON.stringify(words));
          }}
          placeholder="One word per line"
          className={`${inputClass} font-mono text-xs`}
          style={{ color: 'var(--text-primary)', resize: 'vertical' }}
        />
        <p className="text-xs opacity-40">One word per line. Changes take effect within 5 minutes (Redis TTL).</p>
      </div>
    );
  } else if (JSON_KEYS.has(key)) {
    input = (
      <textarea
        rows={4}
        value={value}
        onChange={e => onChange(key, e.target.value)}
        className={`${inputClass} font-mono text-xs`}
        style={{ color: 'var(--text-primary)', resize: 'vertical' }}
      />
    );
  } else if (type === 'bool') {
    input = (
      <select
        value={value}
        onChange={e => onChange(key, e.target.value)}
        className={inputClass}
        style={{ color: 'var(--text-primary)' }}
      >
        <option value="true">Enabled</option>
        <option value="false">Disabled</option>
      </select>
    );
  } else {
    input = (
      <input
        type={type === 'int' ? 'number' : 'text'}
        value={value}
        onChange={e => onChange(key, e.target.value)}
        className={inputClass}
        style={{ color: 'var(--text-primary)' }}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium" title={key} style={{ color: 'var(--text-primary)' }}>
        {label}
      </p>
      {input}
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}
