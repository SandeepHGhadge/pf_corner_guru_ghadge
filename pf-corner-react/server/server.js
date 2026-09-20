/**
 * PF Corner — notification server
 * ---------------------------------------------------------------------------
 * Receives enquiries from the website and sends them out by
 *   • email   — to the admin, plus a confirmation to the customer (Gmail app password)
 *   • WhatsApp— WhatsApp Cloud API
 *   • SMS     — Twilio, Fast2SMS or MSG91
 *   • Telegram
 * It also keeps a copy of every enquiry in leads.json.
 *
 * Start:  npm install && npm start
 */
'use strict';

const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

/* read .env without needing an extra package */
(function loadEnv() {
  try {
    const f = path.join(__dirname, '.env');
    if (!fs.existsSync(f)) return;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach(line => {
      if (/^\s*(#|$)/.test(line)) return;
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) return;
      const v = m[2].trim().replace(/^["']|["']$/g, '');
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  } catch (e) { console.error('.env could not be read:', e.message); }
})();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data');
const CFG_FILE = path.join(DATA, 'config.json');
const LEADS_FILE = path.join(DATA, 'leads.json');
const VERSION = '2.0.0';

fs.mkdirSync(DATA, { recursive: true });

/* ------------------------------------------------------------------ config */
const envCfg = () => ({
  email: {
    enabled: process.env.MAIL_ENABLED !== 'false',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || '465',
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.GMAIL_USER || '',
    appPassword: process.env.GMAIL_APP_PASSWORD || '',
    fromName: process.env.MAIL_FROM_NAME || 'PF Corner',
    adminTo: process.env.ADMIN_EMAIL || '',
    cc: process.env.ADMIN_CC || '',
    adminSubject: 'New enquiry from {name}',
    autoReply: process.env.AUTO_REPLY !== 'false',
    replySubject: 'Thank you for contacting PF Corner',
    replyBody: 'Hello {name},\n\nThank you for contacting PF Corner. We have received your enquiry and our team will get back to you within one working day.\n\nYour message:\n{msg}\n\nRegards,\nPF Corner'
  },
  whatsapp: {
    enabled: String(process.env.WA_ENABLED || 'false') === 'true',
    mode: process.env.WA_MODE || 'cloud',
    adminNumber: process.env.WA_ADMIN_NUMBER || '',
    phoneId: process.env.WA_PHONE_ID || '',
    token: process.env.WA_TOKEN || ''
  },
  sms: {
    enabled: String(process.env.SMS_ENABLED || 'false') === 'true',
    provider: process.env.SMS_PROVIDER || 'twilio',
    adminNumber: process.env.SMS_ADMIN_NUMBER || '',
    sid: process.env.TWILIO_SID || '',
    token: process.env.TWILIO_TOKEN || '',
    from: process.env.TWILIO_FROM || '',
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || '',
    templateId: process.env.SMS_TEMPLATE_ID || ''
  },
  telegram: {
    enabled: String(process.env.TG_ENABLED || 'false') === 'true',
    botToken: process.env.TG_BOT_TOKEN || '',
    chatId: process.env.TG_CHAT_ID || ''
  }
});

/* deep merge that ignores empty values coming from the admin panel */
function merge(base, extra) {
  const out = JSON.parse(JSON.stringify(base));
  for (const k in extra) {
    const v = extra[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = merge(out[k] || {}, v);
    else if (v !== '' && v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

let CFG = envCfg();
try {
  if (fs.existsSync(CFG_FILE)) CFG = merge(CFG, JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')));
} catch (e) { console.error('config.json could not be read:', e.message); }

const saveCfg = () => fs.writeFileSync(CFG_FILE, JSON.stringify(CFG, null, 2));

const readLeads = () => { try { return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); } catch (e) { return []; } };
const addLead = l => {
  const all = readLeads();
  all.unshift(l);
  fs.writeFileSync(LEADS_FILE, JSON.stringify(all.slice(0, 2000), null, 1));
};

/* -------------------------------------------------------------- middleware */
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  const allow = process.env.ALLOWED_ORIGIN || '*';
  res.set('Access-Control-Allow-Origin', allow);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* very small rate limiter: 20 requests per IP per 10 minutes on /api/lead */
const hits = new Map();
function limited(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'x';
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 6e5) { rec.n = 0; rec.t = now; }
  rec.n++;
  hits.set(ip, rec);
  return rec.n > 20;
}

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
function auth(req, res, next) {
  const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!ADMIN_TOKEN) return res.status(500).json({ error: 'ADMIN_TOKEN is not set on the server.' });
  if (given !== ADMIN_TOKEN) return res.status(401).json({ error: 'Not authorised.' });
  next();
}

/* ------------------------------------------------------------------ helpers */
const clean = s => String(s == null ? '' : s).slice(0, 4000);
const escHtml = s => clean(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fill(tpl, l, site) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => ({
    name: l.name, phone: l.phone, email: l.email || '-', msg: l.msg,
    date: new Date(l.ts || Date.now()).toLocaleString('en-IN'),
    brand: (site && site.brand) || 'PF Corner',
    sitePhone: (site && site.phone) || '',
    siteEmail: (site && site.email) || ''
  }[k] ?? m));
}

const plain = (l, site) =>
  'New enquiry — ' + ((site && site.brand) || 'PF Corner') +
  '\nName: ' + l.name + '\nPhone: ' + l.phone + '\nEmail: ' + (l.email || '-') +
  '\nLanguage: ' + String(l.lang || 'en').toUpperCase() +
  '\nReceived: ' + new Date(l.ts || Date.now()).toLocaleString('en-IN') +
  '\n\nMessage:\n' + l.msg;

function adminHtml(l, site) {
  const row = (k, v) => '<tr><td style="padding:8px 14px;color:#587075;font:600 13px Arial">' + k +
    '</td><td style="padding:8px 14px;font:400 15px Arial;color:#12262b">' + v + '</td></tr>';
  const wa = String(l.phone || '').replace(/\D/g, '');
  return '<div style="background:#f6faf9;padding:26px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:560px;margin:auto;background:#fff;border:1px solid #d7e5e3;border-radius:14px;overflow:hidden">' +
    '<div style="background:#0b5e63;color:#fff;padding:18px 24px;font:700 18px Arial">New enquiry received</div>' +
    '<table style="width:100%;border-collapse:collapse">' +
      row('Name', escHtml(l.name)) +
      row('Phone', '<a href="tel:' + escHtml(l.phone) + '" style="color:#0b5e63">' + escHtml(l.phone) + '</a>') +
      row('Email', l.email ? '<a href="mailto:' + escHtml(l.email) + '" style="color:#0b5e63">' + escHtml(l.email) + '</a>' : '—') +
      row('Language', escHtml(String(l.lang || 'en').toUpperCase())) +
      row('Received', escHtml(new Date(l.ts || Date.now()).toLocaleString('en-IN'))) +
      row('Message', escHtml(l.msg).replace(/\n/g, '<br>')) +
    '</table>' +
    (wa ? '<div style="padding:18px 24px"><a href="https://wa.me/' + (wa.length === 10 ? '91' + wa : wa) +
      '" style="background:#25d366;color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font:700 14px Arial">Reply on WhatsApp</a></div>' : '') +
    '</div></div>';
}

let transporter = null, transporterKey = '';
function mailer() {
  const e = CFG.email;
  const key = [e.host, e.port, e.secure, e.user, e.appPassword].join('|');
  if (!e.user || !e.appPassword) return null;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host: e.host || 'smtp.gmail.com',
      port: +e.port || 465,
      secure: String(e.secure) !== 'false' && +e.port !== 587,
      auth: { user: e.user, pass: String(e.appPassword).replace(/\s+/g, '') }
    });
    transporterKey = key;
  }
  return transporter;
}

/* ------------------------------------------------------------- send methods */
async function sendAdminMail(l, site) {
  const e = CFG.email;
  if (!e.enabled) return 'off';
  const tx = mailer();
  if (!tx) return 'not configured';
  const to = (e.adminTo || e.user).split(/[;,]/).map(s => s.trim()).filter(Boolean);
  if (!to.length) return 'no recipient';
  await tx.sendMail({
    from: '"' + (e.fromName || 'PF Corner') + '" <' + e.user + '>',
    to, cc: (e.cc || '').split(/[;,]/).map(s => s.trim()).filter(Boolean),
    replyTo: l.email || undefined,
    subject: fill(e.adminSubject || 'New enquiry from {name}', l, site),
    text: plain(l, site),
    html: adminHtml(l, site)
  });
  return 'sent';
}

async function sendCustomerMail(l, site) {
  const e = CFG.email;
  if (!e.enabled || !e.autoReply) return 'off';
  if (!l.email) return 'no customer email';
  const tx = mailer();
  if (!tx) return 'not configured';
  const body = fill(e.replyBody, l, site);
  await tx.sendMail({
    from: '"' + (e.fromName || 'PF Corner') + '" <' + e.user + '>',
    to: l.email,
    subject: fill(e.replySubject || 'Thank you for contacting us', l, site),
    text: body,
    html: '<div style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#12262b">' +
      escHtml(body).replace(/\n/g, '<br>') + '</div>'
  });
  return 'sent';
}

async function sendWhatsApp(l, site) {
  const w = CFG.whatsapp;
  if (!w.enabled) return 'off';
  if (w.mode !== 'cloud' || !w.token || !w.phoneId || !w.adminNumber) return 'not configured';
  const r = await fetch('https://graph.facebook.com/v20.0/' + w.phoneId + '/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + w.token },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: String(w.adminNumber).replace(/\D/g, ''),
      type: 'text', text: { body: plain(l, site) }
    })
  });
  return r.ok ? 'sent' : 'failed (' + r.status + ')';
}

async function sendSMS(l, site) {
  const s = CFG.sms;
  if (!s.enabled) return 'off';
  const to = String(s.adminNumber || '').replace(/\D/g, '');
  if (!to) return 'no number';
  const text = 'New PF Corner enquiry. ' + l.name + ', ' + l.phone + '. ' + String(l.msg).slice(0, 90);

  if (s.provider === 'twilio') {
    if (!s.sid || !s.token || !s.from) return 'not configured';
    const body = new URLSearchParams({ To: to.length === 10 ? '+91' + to : '+' + to, From: s.from, Body: text });
    const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + s.sid + '/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(s.sid + ':' + s.token).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    return r.ok ? 'sent' : 'failed (' + r.status + ')';
  }
  if (s.provider === 'fast2sms') {
    if (!s.apiKey) return 'not configured';
    const r = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { authorization: s.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'q', message: text, numbers: to.slice(-10), flash: 0 })
    });
    return r.ok ? 'sent' : 'failed (' + r.status + ')';
  }
  if (s.provider === 'msg91') {
    if (!s.apiKey || !s.templateId) return 'not configured';
    const r = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: s.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: s.templateId, short_url: '0',
        recipients: [{ mobiles: to.length === 10 ? '91' + to : to, name: l.name, phone: l.phone }]
      })
    });
    return r.ok ? 'sent' : 'failed (' + r.status + ')';
  }
  return 'unknown provider';
}

async function sendTelegram(l, site) {
  const t = CFG.telegram;
  if (!t.enabled) return 'off';
  if (!t.botToken || !t.chatId) return 'not configured';
  const r = await fetch('https://api.telegram.org/bot' + t.botToken + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: t.chatId, text: plain(l, site) })
  });
  return r.ok ? 'sent' : 'failed (' + r.status + ')';
}

const settle = async (name, fn) => {
  try { return await fn(); }
  catch (e) { console.error(name, 'failed:', e.message); return 'failed: ' + e.message; }
};

/* ------------------------------------------------------------------ routes */
app.all('/api/health', (req, res) => {
  const e = CFG.email;
  res.json({
    ok: true, version: VERSION,
    mailReady: !!(e.user && e.appPassword),
    channels: {
      email: !!e.enabled, whatsapp: !!CFG.whatsapp.enabled,
      sms: !!CFG.sms.enabled, telegram: !!CFG.telegram.enabled
    }
  });
});

app.post('/api/login', (req, res) => {
  const { user, pass } = req.body || {};
  const U = process.env.ADMIN_USER || 'admin';
  const P = process.env.ADMIN_PASS || '';
  if (!P) return res.status(500).json({ error: 'ADMIN_PASS is not set on the server.' });
  if (user !== U || pass !== P) return res.status(401).json({ error: 'Wrong username or password.' });
  res.json({ ok: true, token: ADMIN_TOKEN });
});

app.post('/api/config', auth, (req, res) => {
  const inc = (req.body && req.body.config) || {};
  CFG = merge(CFG, {
    email: inc.email, whatsapp: inc.whatsapp, sms: inc.sms, telegram: inc.telegram
  });
  transporter = null;
  saveCfg();
  res.json({ ok: true, saved: true });
});

app.get('/api/leads', auth, (req, res) => res.json({ ok: true, leads: readLeads() }));

app.post('/api/lead', async (req, res) => {
  if (limited(req)) return res.status(429).json({ error: 'Too many messages. Please try again later.' });
  const b = req.body || {};
  const src = b.lead || {};
  if (b.company) return res.json({ ok: true, channels: {} });        /* honeypot */

  const lead = {
    id: clean(src.id) || String(Date.now()),
    ts: src.ts || Date.now(),
    name: clean(src.name).slice(0, 120),
    phone: clean(src.phone).slice(0, 30),
    email: clean(src.email).slice(0, 160),
    msg: clean(src.msg).slice(0, 3000),
    lang: clean(src.lang) || 'en',
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
  };
  if (!lead.name || !lead.phone || !lead.msg) return res.status(400).json({ error: 'Name, phone and message are required.' });

  const site = b.site || {};
  const [email, customer, whatsapp, sms, telegram] = await Promise.all([
    settle('admin email', () => sendAdminMail(lead, site)),
    settle('customer email', () => sendCustomerMail(lead, site)),
    settle('whatsapp', () => sendWhatsApp(lead, site)),
    settle('sms', () => sendSMS(lead, site)),
    settle('telegram', () => sendTelegram(lead, site))
  ]);
  const channels = { email, customer, whatsapp, sms, telegram };
  if (!b.test) addLead(Object.assign({}, lead, { channels }));
  const ok = Object.values(channels).some(v => v === 'sent');
  res.json({ ok, channels });
});

app.post('/api/test', auth, async (req, res) => {
  const ch = (req.body && req.body.channel) || 'email';
  const lead = Object.assign({
    id: 'test', ts: Date.now(), name: 'Test enquiry', phone: '0000000000',
    email: CFG.email.adminTo || CFG.email.user, msg: 'Test message from the PF Corner admin panel.', lang: 'en'
  }, (req.body && req.body.lead) || {});
  const site = (req.body && req.body.site) || {};
  const map = {
    email: () => sendAdminMail(lead, site),
    customer: () => sendCustomerMail(lead, site),
    whatsapp: () => sendWhatsApp(lead, site),
    sms: () => sendSMS(lead, site),
    telegram: () => sendTelegram(lead, site)
  };
  if (!map[ch]) return res.status(400).json({ error: 'Unknown channel.' });
  const r = await settle(ch, map[ch]);
  res.json({ ok: r === 'sent', message: ch + ': ' + r });
});

/* serve the website itself if index.html sits next to server.js */
app.use(express.static(__dirname));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log('PF Corner notification server ' + VERSION + ' on port ' + PORT);
  console.log('Mail:', CFG.email.user ? CFG.email.user + ' (ready)' : 'not configured yet');
});
