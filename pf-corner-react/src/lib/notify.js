import { state, update, getPath } from './store.js';
import { uid, formatDate } from './hooks.js';

export const apiBase = () => (state().cfg.server.base || '').trim().replace(/\/+$/, '');
export const hasServer = () => !!apiBase();

export async function api(path, body, authed) {
  const base = apiBase();
  if (!base) throw new Error('No server address is set in Notifications.');
  const headers = { 'Content-Type': 'application/json' };
  if (authed) headers.Authorization = 'Bearer ' + (state().cfg.server.token || '');
  const res = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  let data = {};
  try { data = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok) throw new Error(data.error || 'Server replied ' + res.status);
  return data;
}

/* Replace {name}, {msg} and friends in a template. */
export function fillTemplate(tpl, lead) {
  const site = state().c.site;
  const map = {
    name: lead.name, phone: lead.phone, email: lead.email || '-', msg: lead.msg,
    date: formatDate(lead.ts), brand: site.brand, sitePhone: site.phone, siteEmail: site.email
  };
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}

export const leadAsText = lead => {
  const site = state().c.site;
  return [
    'New enquiry — ' + site.brand,
    'Name: ' + lead.name,
    'Phone: ' + lead.phone,
    'Email: ' + (lead.email || '-'),
    'Language: ' + String(lead.lang || 'en').toUpperCase(),
    'Received: ' + formatDate(lead.ts),
    '',
    'Message:',
    lead.msg
  ].join('\n');
};

/**
 * Sends one enquiry to every channel the admin switched on.
 * With the helper server configured it is a single call and email,
 * WhatsApp and SMS all go out from there. Without it the browser can still
 * reach the WhatsApp Cloud API and Telegram, and otherwise opens a
 * pre-filled WhatsApp chat.
 */
export async function notify(lead, isTest) {
  const channels = { email: 'off', customer: 'off', whatsapp: 'off', sms: 'off', telegram: 'off' };
  const cfg = state().cfg;

  if (hasServer()) {
    try {
      const data = await api('/api/lead', { lead, test: !!isTest, site: state().c.site });
      Object.assign(channels, data.channels || {});
      return { ok: !!data.ok, channels, via: 'server', waLink: '' };
    } catch (e) {
      channels.email = 'failed: ' + e.message;
    }
  } else if (cfg.email.enabled) {
    channels.email = 'needs server';
    channels.customer = 'needs server';
  }

  const text = leadAsText(lead);

  if (cfg.whatsapp.enabled && cfg.whatsapp.mode === 'cloud'
      && cfg.whatsapp.token && cfg.whatsapp.phoneId && cfg.whatsapp.adminNumber) {
    try {
      const res = await fetch('https://graph.facebook.com/v20.0/' + cfg.whatsapp.phoneId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.whatsapp.token },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: String(cfg.whatsapp.adminNumber).replace(/\D/g, ''),
          type: 'text', text: { body: text }
        })
      });
      channels.whatsapp = res.ok ? 'sent' : 'failed (' + res.status + ')';
    } catch (e) { channels.whatsapp = 'blocked by browser'; }
  }

  if (cfg.telegram.enabled && cfg.telegram.botToken && cfg.telegram.chatId) {
    try {
      const res = await fetch('https://api.telegram.org/bot' + cfg.telegram.botToken + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cfg.telegram.chatId, text })
      });
      channels.telegram = res.ok ? 'sent' : 'failed (' + res.status + ')';
    } catch (e) { channels.telegram = 'blocked by browser'; }
  }

  let waLink = '';
  if (cfg.whatsapp.enabled && cfg.whatsapp.mode === 'link' && channels.whatsapp === 'off' && !isTest) {
    const n = String(cfg.whatsapp.adminNumber || state().c.site.whatsapp || '').replace(/\D/g, '');
    if (n) {
      waLink = 'https://wa.me/' + n + '?text=' + encodeURIComponent(text);
      const win = window.open(waLink, '_blank', 'noopener');
      channels.whatsapp = win ? 'chat opened' : 'popup blocked';
    }
  }

  const ok = Object.values(channels).some(v => /sent|opened|queued/i.test(v));
  return { ok, channels, via: 'browser', waLink: channels.whatsapp === 'popup blocked' ? waLink : '' };
}

/* Stores the enquiry locally first, then sends it out. */
export async function submitLead(values, lang) {
  const lead = {
    id: uid(),
    ts: Date.now(),
    name: values.name.trim(),
    phone: values.phone.trim(),
    email: (values.email || '').trim(),
    msg: values.msg.trim(),
    lang,
    status: 'new',
    channels: {}
  };

  update(s => {
    s.leads.unshift(lead);
    if (s.leads.length > 400) s.leads.length = 400;
  });

  let result = { ok: false, channels: {}, waLink: '' };
  try { result = await notify(lead); }
  catch (e) { result.channels = { email: 'failed: ' + e.message }; }

  update(s => {
    const stored = s.leads.find(l => l.id === lead.id);
    if (stored) stored.channels = result.channels;
  });

  return result;
}

export { getPath };
