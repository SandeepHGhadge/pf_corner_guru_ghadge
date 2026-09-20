import { useEffect, useState } from 'react';
import { Icon, useToast } from '../components/Ui.jsx';
import { useStore, update } from '../lib/store.js';
import {
  sha256, session, useSession, lockSecondsLeft, recordFailedLogin, clearLoginLock
} from '../lib/hooks.js';
import { api, hasServer } from '../lib/notify.js';
import { Dashboard, Leads, ContentTab, Design } from './Tabs.jsx';
import { Notifications, Account } from './Settings.jsx';

const TABS = [
  ['dash', 'Dashboard', 'gauge'],
  ['leads', 'Enquiries', 'inbox'],
  ['content', 'Content & SEO', 'pencil'],
  ['theme', 'Design', 'palette'],
  ['notify', 'Notifications', 'bell'],
  ['account', 'Account & security', 'lockic']
];

/* ------------------------------------------------------------------ login */
function Login({ expired, onSignedIn }) {
  const s = useStore();
  const toast = useToast();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [locked, setLocked] = useState(lockSecondsLeft());

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setLocked(lockSecondsLeft()), 1000);
    return () => clearInterval(t);
  }, [locked]);

  async function submit(e) {
    e.preventDefault();
    if (lockSecondsLeft()) return toast('Too many attempts. Please wait.', 'bad');

    const hash = await sha256(pass);
    const ok = user === 'admin' && (s.pw ? hash === s.pw : pass === 'admin@123');
    if (!ok) {
      recordFailedLogin();
      setLocked(lockSecondsLeft());
      return toast('Wrong username or password.', 'bad');
    }

    clearLoginLock();
    let token = 'local';
    if (hasServer()) {
      try {
        const r = await api('/api/login', { user, pass });
        if (r.token) {
          token = r.token;
          update(st => { st.cfg.server.token = r.token; });
        }
      } catch (err) {
        /* the local password still governs this panel */
      }
    }
    session.start(token);
    setPass('');
    onSignedIn();
    toast('Welcome back.', 'ok');
  }

  return (
    <section className="sec">
      <div className="w lg-box">
        <div className="panel fade-up">
          <h2 style={{ marginTop: 0 }}>Admin sign in</h2>
          <p className="hint">This area is for PF Corner staff only.</p>

          {expired && <div className="note bad">Your session ended. Please sign in again.</div>}
          {locked > 0 && (
            <div className="note bad">Too many wrong attempts. Try again in {locked} seconds.</div>
          )}

          <form onSubmit={submit}>
            <label>Username
              <input value={user} onChange={e => setUser(e.target.value)}
                autoComplete="username" required />
            </label>
            <label>Password
              <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                autoComplete="current-password" required />
            </label>
            <button className="btn" disabled={locked > 0}>Sign in</button>
          </form>

          {!s.pw && (
            <p className="hint" style={{ marginTop: 14 }}>
              First sign in: <b>admin</b> / <b>admin@123</b> — change it in Account &amp; security straight away.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ shell */
export function Admin() {
  const s = useStore();
  const toast = useToast();
  const [tab, setTab] = useState('dash');
  const [expired, setExpired] = useState(false);
  const [, bump] = useState(0);
  const current = useSession(true);

  /* Notice the moment the session times out. */
  useEffect(() => {
    if (!current && tab !== 'dash') setTab('dash');
  }, [current, tab]);

  if (!current) {
    return <Login expired={expired} onSignedIn={() => { setExpired(false); bump(n => n + 1); }} />;
  }

  const signOut = () => {
    session.end();
    setTab('dash');
    setExpired(false);
    toast('Signed out.');
  };

  const waiting = s.leads.filter(l => l.status === 'new').length;
  const minutesLeft = Math.max(0, Math.round((current.exp - Date.now()) / 60000));

  const views = {
    dash: <Dashboard goTo={setTab} />,
    leads: <Leads />,
    content: <ContentTab />,
    theme: <Design />,
    notify: <Notifications />,
    account: <Account onSignOut={signOut} />
  };

  return (
    <div className="w adm">
      <aside className="side">
        <h4>PF CORNER ADMIN</h4>
        <div className="tabs">
          {TABS.map(([id, label, icon]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <Icon name={icon} size={18} />
              {label}
              {id === 'leads' && waiting > 0 && (
                <span className="tag new" style={{ marginLeft: 'auto' }}>{waiting}</span>
              )}
            </button>
          ))}
          <div className="sep" />
          <a href="#/" className="sm" style={{ justifyContent: 'center' }}>View website</a>
          <button onClick={signOut}>Sign out</button>
          <div className="sess">Session ends in {minutesLeft} min</div>
        </div>
      </aside>

      <div className="pnl fade-up">{views[tab]}</div>
    </div>
  );
}
