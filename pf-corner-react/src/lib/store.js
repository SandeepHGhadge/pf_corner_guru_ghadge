import { useEffect, useState } from 'react';
import { CONTENT } from '../data/content.js';
import { TR } from '../data/translations.js';

const KEY = 'pfc_site_v2';

export const clone = o =>
  typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o));

/* Keys that are never translated: they are shared from the English record. */
export const NT = /^(img|photo|logo|icon|heroImg|phone|email|whatsapp|facebook|instagram)$/i;

export const DEFAULTS = () => ({
  pw: '',
  c: clone(CONTENT),
  tr: clone(TR),
  theme: 'ocean',
  accent: '',
  leads: [],
  cfg: {
    server: { base: '', token: '' },
    email: {
      enabled: true,
      host: 'smtp.gmail.com',
      port: '465',
      secure: true,
      user: '',
      appPassword: '',
      fromName: 'PF Corner',
      adminTo: 'pfcorner100@gmail.com',
      cc: '',
      adminSubject: 'New enquiry from {name}',
      autoReply: true,
      replySubject: 'Thank you for contacting PF Corner',
      replyBody:
        'Hello {name},\n\nThank you for contacting PF Corner. We have received your enquiry and our team will get back to you within one working day.\n\nYour message:\n{msg}\n\nRegards,\nPF Corner\nPhone: {sitePhone}\nEmail: {siteEmail}'
    },
    whatsapp: { enabled: true, mode: 'link', adminNumber: '918380920789', phoneId: '', token: '' },
    sms: {
      enabled: false, provider: 'twilio', adminNumber: '',
      sid: '', token: '', from: '', apiKey: '', senderId: '', templateId: ''
    },
    telegram: { enabled: false, botToken: '', chatId: '' }
  },
  security: { idleMinutes: '20' }
});

/* Fill in any key a saved record is missing, so old backups keep working. */
export function fillMissing(def, target) {
  for (const k in def) {
    if (target[k] == null) target[k] = clone(def[k]);
    else if (!Array.isArray(def[k]) && def[k] && typeof def[k] === 'object') fillMissing(def[k], target[k]);
  }
  return target;
}

/* Give a translation record the same shape as the English one. */
export function syncShape(target, source) {
  for (const k in source) {
    if (NT.test(k)) continue;
    const v = source[k];
    if (Array.isArray(v)) {
      target[k] = target[k] || [];
      v.forEach((item, i) => { target[k][i] = target[k][i] || {}; syncShape(target[k][i], item); });
    } else if (v && typeof v === 'object') {
      target[k] = target[k] || {};
      syncShape(target[k], v);
    } else if (target[k] == null) target[k] = '';
  }
  return target;
}

/* English merged with a translation. An empty translated field shows English. */
export function mergeLang(english, translation) {
  if (!translation) return english;
  if (Array.isArray(english)) return english.map((x, i) => mergeLang(x, translation[i]));
  if (english && typeof english === 'object') {
    const out = {};
    for (const k in english) out[k] = mergeLang(english[k], translation[k]);
    return out;
  }
  return translation === '' || translation == null ? english : translation;
}

/* ---------------------------------------------------------------- the store */
function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* ignore */ }
  const state = saved || DEFAULTS();
  fillMissing(DEFAULTS(), state);
  if (!Array.isArray(state.leads)) state.leads = [];
  return state;
}

let S = load();
const listeners = new Set();
let onFull = null;

export const state = () => S;
export const onStorageFull = fn => { onFull = fn; };

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch (e) { if (onFull) onFull(); return false; }
}

/* Mutate the state and tell every component about it. */
export function update(mutator) {
  mutator(S);
  persist();
  listeners.forEach(fn => fn());
}

export function replaceState(next) {
  S = fillMissing(DEFAULTS(), next);
  if (!Array.isArray(S.leads)) S.leads = [];
  persist();
  listeners.forEach(fn => fn());
}

/* Read or write any value by dotted path, e.g. "c.home.title". */
export const getPath = p => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), S);
export function setPath(p, value) {
  const parts = p.split('.');
  const last = parts.pop();
  const parent = parts.reduce((o, k) => (o == null ? undefined : o[k]), S);
  if (parent) update(() => { parent[last] = value; });
}

/* Subscribe a component to the store. */
export function useStore() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump(n => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return S;
}
