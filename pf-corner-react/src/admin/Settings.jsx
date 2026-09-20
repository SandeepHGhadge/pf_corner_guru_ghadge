import { useState } from 'react';
import { Icon, useToast } from '../components/Ui.jsx';
import { useStore, update, replaceState, DEFAULTS, fillMissing } from '../lib/store.js';
import { sha256, download, formatDate, session, clearLoginLock } from '../lib/hooks.js';
import { api, hasServer, notify } from '../lib/notify.js';
import { Setting } from './Fields.jsx';

/* ---------------------------------------------------------- Notifications */
export function Notifications() {
  const s = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const cfg = s.cfg;

  const ping = async () => {
    if (!hasServer()) return toast('Add the server address first.', 'bad');
    setBusy('ping');
    try {
      const r = await api('/api/health', {});
      toast('Server is running. ' + (r.version ? 'Version ' + r.version + '. ' : '') +
        (r.mailReady ? 'Mail is configured.' : 'Mail is not configured yet.'), 'ok');
    } catch (e) {
      toast('Could not reach the server: ' + e.message, 'bad');
    }
    setBusy('');
  };

  const push = async () => {
    if (!hasServer()) return toast('Add the server address first.', 'bad');
    setBusy('push');
    try {
      await api('/api/config', { config: cfg }, true);
      update(st => {
        st.cfg.email.appPassword = '';
        st.cfg.whatsapp.token = '';
        st.cfg.sms.token = '';
        st.cfg.sms.apiKey = '';
        st.cfg.telegram.botToken = '';
      });
      toast('Settings saved on the server. Secrets were cleared from this browser.', 'ok');
    } catch (e) {
      toast('Could not save: ' + e.message, 'bad');
    }
    setBusy('');
  };

  const test = async channel => {
    const sample = {
      id: 'test', ts: Date.now(), name: 'Test enquiry',
      phone: s.c.site.phone, email: cfg.email.adminTo || s.c.site.email,
      msg: 'This is a test message sent from the PF Corner admin panel.',
      lang: 'en', status: 'new'
    };
    setBusy(channel);
    try {
      if (channel === 'all') {
        const r = await notify(sample, true);
        toast(Object.keys(r.channels).map(k => k + ': ' + r.channels[k]).join(' · '), r.ok ? 'ok' : 'bad');
      } else if (hasServer()) {
        const r = await api('/api/test', { channel, lead: sample, site: s.c.site }, true);
        toast(r.message || 'Test sent.', r.ok ? 'ok' : 'bad');
      } else if (channel === 'whatsapp' || channel === 'telegram') {
        const r = await notify(sample, false);
        toast(channel + ': ' + (r.channels[channel] || 'off'), r.ok ? 'ok' : 'bad');
      } else {
        toast('Email and SMS need the helper server. Add its address above.', 'bad');
      }
    } catch (e) {
      toast('Test failed: ' + e.message, 'bad');
    }
    setBusy('');
  };

  return (
    <>
      <div className="ah">
        <div>
          <h2>Notifications</h2>
          <p className="sub">Who gets told when someone sends the contact form.</p>
        </div>
        <div className="acts">
          <button className="sm" disabled={busy === 'ping'} onClick={ping}>Check server</button>
          <button className="btn sm2" disabled={busy === 'push'} onClick={push}>Save to server</button>
        </div>
      </div>

      <div className="note">
        <b>How this works.</b> A browser cannot log in to Gmail by itself, so real email is sent by the
        small helper server included with this project. Paste its address below, save your settings to it
        once, and every enquiry then goes out by email, WhatsApp and SMS automatically. Without the server
        the site still records every enquiry here and opens a pre-filled WhatsApp message.
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}><Icon name="globe" size={20} /> Helper server</h3>
        <p className="hint">The address where server.js is running, for example https://pf-notify.onrender.com</p>
        <div className="grid2">
          <Setting path="cfg.server.base" label="Server address" />
          <Setting path="cfg.server.token" label="Server admin token" type="password" />
        </div>
        <p className="hint">
          <span className={'dot ' + (hasServer() ? 'g' : 'y')} />
          {hasServer() ? 'Address set.' : 'Not set — email is switched off until you add it.'}
        </p>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}><Icon name="mail" size={20} /> Email (Gmail app password)</h3>
        <Setting path="cfg.email.enabled" label="Send email for every new enquiry" type="switch" />
        <p className="hint">
          In your Google account turn on 2-step verification, create an app password for “Mail”, and paste
          the 16 characters below. Your normal Gmail password will not work.
        </p>
        <div className="grid2">
          <Setting path="cfg.email.user" label="Gmail address to send from" type="email" />
          <Setting path="cfg.email.appPassword" label="App password (16 characters)" type="password" />
          <Setting path="cfg.email.fromName" label="Sender name shown to people" />
          <Setting path="cfg.email.adminTo" label="Send alerts to" />
          <Setting path="cfg.email.cc" label="Also copy to (optional)" />
          <Setting path="cfg.email.adminSubject" label="Subject of the alert" />
          <Setting path="cfg.email.host" label="SMTP host" />
          <Setting path="cfg.email.port" label="SMTP port" type="number" />
        </div>
        <Setting path="cfg.email.secure" label="Use SSL (port 465). Switch off for port 587." type="switch" />
        <button className="sm" disabled={busy === 'email'} onClick={() => test('email')}>Send a test email</button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}><Icon name="document" size={20} /> Reply sent to the customer</h3>
        <Setting path="cfg.email.autoReply" label="Email the customer a confirmation" type="switch" />
        <p className="hint">
          Use {'{name}'}, {'{msg}'}, {'{phone}'}, {'{date}'}, {'{brand}'}, {'{sitePhone}'} and {'{siteEmail}'} anywhere in the text.
        </p>
        <Setting path="cfg.email.replySubject" label="Subject" />
        <Setting path="cfg.email.replyBody" label="Message" type="textarea" />
        <button className="sm" disabled={busy === 'customer'} onClick={() => test('customer')}>
          Send a test confirmation
        </button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}><Icon name="phone" size={20} /> WhatsApp alert</h3>
        <Setting path="cfg.whatsapp.enabled" label="Send a WhatsApp alert" type="switch" />
        <div className="grid2">
          <Setting path="cfg.whatsapp.mode" label="How to send" type="select" options={[
            ['link', 'Open a pre-filled chat (free, needs a tap)'],
            ['cloud', 'WhatsApp Cloud API (automatic)']
          ]} />
          <Setting path="cfg.whatsapp.adminNumber" label="Your WhatsApp number with country code" />
        </div>
        {cfg.whatsapp.mode === 'cloud' && (
          <div className="grid2">
            <Setting path="cfg.whatsapp.phoneId" label="Phone number ID" />
            <Setting path="cfg.whatsapp.token" label="Permanent access token" type="password" />
          </div>
        )}
        <button className="sm" disabled={busy === 'whatsapp'} onClick={() => test('whatsapp')}>
          Send a test message
        </button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}><Icon name="bell" size={20} /> SMS to your phone</h3>
        <Setting path="cfg.sms.enabled" label="Send an SMS for every new enquiry" type="switch" />
        <div className="grid2">
          <Setting path="cfg.sms.provider" label="SMS provider" type="select" options={[
            ['twilio', 'Twilio'], ['fast2sms', 'Fast2SMS (India)'], ['msg91', 'MSG91 (India)']
          ]} />
          <Setting path="cfg.sms.adminNumber" label="Phone number to alert" />
        </div>
        {cfg.sms.provider === 'twilio' ? (
          <div className="grid2">
            <Setting path="cfg.sms.sid" label="Account SID" />
            <Setting path="cfg.sms.token" label="Auth token" type="password" />
            <Setting path="cfg.sms.from" label="Twilio number" />
          </div>
        ) : (
          <div className="grid2">
            <Setting path="cfg.sms.apiKey" label="API key" type="password" />
            <Setting path="cfg.sms.senderId" label="Sender ID" />
            {cfg.sms.provider === 'msg91' && (
              <Setting path="cfg.sms.templateId" label="Template / flow ID" />
            )}
          </div>
        )}
        <button className="sm" disabled={busy === 'sms'} onClick={() => test('sms')}>Send a test SMS</button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Telegram (optional)</h3>
        <Setting path="cfg.telegram.enabled" label="Also post enquiries to Telegram" type="switch" />
        <div className="grid2">
          <Setting path="cfg.telegram.botToken" label="Bot token" type="password" />
          <Setting path="cfg.telegram.chatId" label="Chat ID" />
        </div>
        <button className="sm" disabled={busy === 'telegram'} onClick={() => test('telegram')}>
          Send a test message
        </button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Try the whole thing</h3>
        <p className="hint">Sends one sample enquiry through every channel you switched on.</p>
        <button className="btn" disabled={busy === 'all'} onClick={() => test('all')}>
          Send a test enquiry
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- Account */
export function Account({ onSignOut }) {
  const s = useStore();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const current = session.get();

  const changePassword = async () => {
    if (pw.length < 8) return toast('Use at least 8 characters.', 'bad');
    if (pw !== pw2) return toast('The two passwords do not match.', 'bad');
    const hash = await sha256(pw);
    update(st => { st.pw = hash; });
    clearLoginLock();
    setPw(''); setPw2('');
    toast('Password changed. Use it the next time you sign in.', 'ok');
  };

  const exportBackup = () => {
    download(new Blob([JSON.stringify(s, null, 1)], { type: 'application/json' }), 'pf-corner-backup.json');
    toast('Backup downloaded.', 'ok');
  };

  const importBackup = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    file.text().then(text => {
      try {
        const data = JSON.parse(text);
        if (!data || !data.c) throw new Error('bad file');
        replaceState(data);
        toast('Backup restored.', 'ok');
      } catch (err) {
        toast('That file is not a PF Corner backup.', 'bad');
      }
    });
  };

  const reset = () => {
    if (!confirm('Reset all content, design and settings back to the original? Enquiries are kept.')) return;
    const fresh = DEFAULTS();
    fresh.pw = s.pw;
    fresh.leads = s.leads;
    replaceState(fillMissing(DEFAULTS(), fresh));
    toast('Content reset.', 'ok');
  };

  return (
    <>
      <div className="ah">
        <div><h2>Account &amp; security</h2><p className="sub">Password, session and backups.</p></div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}><Icon name="lockic" size={20} /> Password</h3>
        <p className="hint">
          At least 8 characters. Only the fingerprint of the password is stored, never the password itself.
        </p>
        <div className="grid2">
          <label>New password
            <input type="password" value={pw} autoComplete="new-password"
              onChange={e => setPw(e.target.value)} />
          </label>
          <label>Repeat new password
            <input type="password" value={pw2} autoComplete="new-password"
              onChange={e => setPw2(e.target.value)} />
          </label>
        </div>
        <button className="btn" onClick={changePassword}>Change password</button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Session</h3>
        <p className="hint">
          You are signed out automatically after a period of no activity, and always when the browser tab is closed.
        </p>
        <Setting path="security.idleMinutes" label="Sign me out after" type="select" options={[
          ['5', '5 minutes'], ['10', '10 minutes'], ['20', '20 minutes'], ['60', '1 hour']
        ]} />
        {current && <p className="hint">This session ends at {formatDate(current.exp)} unless you keep working.</p>}
        <button className="sm dg" onClick={onSignOut}>Sign out now</button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Backup</h3>
        <p className="hint">
          The backup holds your content, translations, design and enquiries. Keep it somewhere safe.
        </p>
        <div className="acts">
          <button className="sm" onClick={exportBackup}>Download backup</button>
          <label className="sm" style={{ display: 'inline-block', margin: 0 }}>
            Restore backup
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={importBackup} />
          </label>
          <button className="sm dg" onClick={reset}>Reset content to original</button>
        </div>
      </div>
    </>
  );
}
