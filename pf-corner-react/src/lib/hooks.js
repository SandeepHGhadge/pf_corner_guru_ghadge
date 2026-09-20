import { useEffect, useState } from 'react';
import { state, update } from './store.js';

/* ------------------------------------------------------------------ utils */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const formatDate = t =>
  new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return 'b64:' + btoa(unescape(encodeURIComponent(text)));
  }
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* Shrink an uploaded image so it fits in local storage. */
export function shrinkImage(file, done, fail) {
  const reader = new FileReader();
  reader.onload = () => {
    const i = new Image();
    i.onload = () => {
      const scale = Math.min(1, 1100 / Math.max(i.width, i.height));
      const c = document.createElement('canvas');
      c.width = Math.round(i.width * scale);
      c.height = Math.round(i.height * scale);
      c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
      done(c.toDataURL('image/jpeg', 0.82));
    };
    i.onerror = () => fail && fail();
    i.src = reader.result;
  };
  reader.onerror = () => fail && fail();
  reader.readAsDataURL(file);
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches;

/* --------------------------------------------------------------- language */
const LANGS = ['en', 'mr', 'hi'];

function initialLang() {
  try {
    const saved = localStorage.getItem('pfc_lang');
    if (saved && LANGS.includes(saved)) return saved;
  } catch (e) { /* ignore */ }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return /^(hi|mr)/.test(nav) ? nav.slice(0, 2) : 'en';
}

let currentLang = initialLang();
const langListeners = new Set();

export const getLang = () => currentLang;
export function setLang(l) {
  if (!LANGS.includes(l)) return;
  currentLang = l;
  try { localStorage.setItem('pfc_lang', l); } catch (e) { /* ignore */ }
  langListeners.forEach(fn => fn(l));
}
export function useLang() {
  const [l, setL] = useState(currentLang);
  useEffect(() => {
    langListeners.add(setL);
    return () => langListeners.delete(setL);
  }, []);
  return l;
}

/* ----------------------------------------------------------------- router */
export function useRoute() {
  const read = () => (location.hash.replace(/^#\/?/, '') || 'home');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const fn = () => setRoute(read());
    addEventListener('hashchange', fn);
    return () => removeEventListener('hashchange', fn);
  }, []);
  return route;
}

/* ---------------------------------------------------------------- session */
const SESSION_KEY = 'pfc_ses';
const LOCK_KEY = 'pfc_lock';
const sessionListeners = new Set();

export const session = {
  idleMs() { return (+state().security.idleMinutes || 20) * 60000; },
  get() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s) return null;
      if (Date.now() > s.exp) { sessionStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch (e) { return null; }
  },
  start(token) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ t: token || 'local', exp: Date.now() + this.idleMs() }));
    sessionListeners.forEach(fn => fn());
  },
  touch() {
    const s = this.get();
    if (!s) return;
    s.exp = Date.now() + this.idleMs();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  },
  end() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionListeners.forEach(fn => fn());
  }
};

/* Keeps a component in step with the session, and expires it on idle. */
export function useSession(active) {
  const [s, setS] = useState(() => session.get());
  useEffect(() => {
    const refresh = () => setS(session.get());
    sessionListeners.add(refresh);
    const timer = setInterval(refresh, 15000);
    const touch = () => { if (active) session.touch(); };
    ['click', 'keydown', 'scroll'].forEach(ev => addEventListener(ev, touch, { passive: true }));
    return () => {
      sessionListeners.delete(refresh);
      clearInterval(timer);
      ['click', 'keydown', 'scroll'].forEach(ev => removeEventListener(ev, touch));
    };
  }, [active]);
  return s;
}

export function lockSecondsLeft() {
  try {
    const l = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    if (l.until > Date.now()) return Math.ceil((l.until - Date.now()) / 1000);
  } catch (e) { /* ignore */ }
  return 0;
}
export function recordFailedLogin() {
  let l = {};
  try { l = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}'); } catch (e) { /* ignore */ }
  l.n = (l.n || 0) + 1;
  if (l.n >= 5) { l.until = Date.now() + 60000; l.n = 0; }
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(l)); } catch (e) { /* ignore */ }
}
export const clearLoginLock = () => {
  try { localStorage.removeItem(LOCK_KEY); } catch (e) { /* ignore */ }
};

/* Re-export so screens can import everything from one place. */
export { state, update };
