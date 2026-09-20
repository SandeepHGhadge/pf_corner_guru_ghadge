import { useMemo, useState } from 'react';
import { Icon, useToast } from '../components/Ui.jsx';
import { useStore, update, setPath, syncShape, state } from '../lib/store.js';
import { formatDate, download } from '../lib/hooks.js';
import { hasServer, apiBase } from '../lib/notify.js';
import { AnyField, CONTENT_TREE, findPage } from './Fields.jsx';

const LANG_TABS = [['en', 'English'], ['mr', 'मराठी'], ['hi', 'हिन्दी']];

/* ------------------------------------------------------------- Dashboard */
export function Dashboard({ goTo }) {
  const s = useStore();
  const week = Date.now() - 6048e5;
  const waiting = s.leads.filter(l => l.status === 'new').length;
  const recent = s.leads.slice(0, 5);
  const cfg = s.cfg;

  const Check = ({ ready, on, label, where }) => (
    <li>
      <span className={'dot ' + (!on ? 'y' : ready ? 'g' : 'r')} />
      {label} — {!on ? 'switched off' : ready ? 'ready' : 'needs setup in ' + where}
    </li>
  );

  return (
    <>
      <div className="ah">
        <div>
          <h2>Dashboard</h2>
          <p className="sub">Everything at a glance.</p>
        </div>
        <button className="sm" onClick={() => goTo('leads')}>Open enquiries</button>
      </div>

      <div className="kpi">
        <div><b>{s.leads.length}</b><span>Total enquiries</span></div>
        <div><b>{waiting}</b><span>Waiting for reply</span></div>
        <div><b>{s.leads.filter(l => l.ts > week).length}</b><span>Last 7 days</span></div>
        <div><b>3</b><span>Languages live</span></div>
      </div>

      <div className="panel">
        <h3><Icon name="bell" size={20} /> Notification status</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 2 }}>
          <li>
            <span className={'dot ' + (hasServer() ? 'g' : 'y')} />
            Mail server — {hasServer()
              ? 'connected to ' + apiBase()
              : 'not connected. Email needs the helper server (see the setup guide).'}
          </li>
          <Check on={cfg.email.enabled} where="Notifications" label="Email to admin & customer"
            ready={!!(cfg.email.user && cfg.email.appPassword) || hasServer()} />
          <Check on={cfg.whatsapp.enabled} where="Notifications" label="WhatsApp alert"
            ready={cfg.whatsapp.mode === 'link'
              ? !!cfg.whatsapp.adminNumber
              : !!(cfg.whatsapp.token && cfg.whatsapp.phoneId)} />
          <Check on={cfg.sms.enabled} where="Notifications" label="SMS / phone alert"
            ready={!!cfg.sms.adminNumber} />
        </ul>
      </div>

      <div className="panel">
        <h3><Icon name="inbox" size={20} /> Latest enquiries</h3>
        {recent.length ? (
          <div className="scrollx">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Phone</th><th>When</th><th>Status</th></tr></thead>
              <tbody>
                {recent.map(l => (
                  <tr key={l.id}>
                    <td><b>{l.name}</b></td>
                    <td>{l.phone}</td>
                    <td>{formatDate(l.ts)}</td>
                    <td><span className={'tag ' + l.status}>{l.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">No enquiries yet. They appear here the moment someone sends the contact form.</p>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- Enquiries */
export function Leads() {
  const s = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState('');

  const list = useMemo(() => {
    const q = query.toLowerCase();
    return s.leads.filter(l =>
      (filter === 'all' || l.status === filter) &&
      (!q || (l.name + ' ' + l.phone + ' ' + l.email + ' ' + l.msg).toLowerCase().includes(q)));
  }, [s.leads, filter, query, s.leads.length]);

  const setStatus = (id, value) => {
    update(st => {
      const lead = st.leads.find(l => l.id === id);
      if (lead) lead.status = value;
    });
    toast('Marked as ' + value + '.');
  };

  const remove = id => {
    if (!confirm('Delete this enquiry? It cannot be undone.')) return;
    update(st => { st.leads = st.leads.filter(l => l.id !== id); });
    toast('Enquiry deleted.');
  };

  const clearAll = () => {
    if (!confirm('Delete every enquiry? Download a CSV first if you need them.')) return;
    update(st => { st.leads = []; });
    toast('All enquiries removed.');
  };

  const exportCsv = () => {
    const head = ['Date', 'Name', 'Phone', 'Email', 'Language', 'Status', 'Message'];
    const rows = [head].concat(s.leads.map(l =>
      [formatDate(l.ts), l.name, l.phone, l.email, l.lang, l.status, l.msg]));
    const body = rows
      .map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(','))
      .join('\r\n');
    download(new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' }), 'pf-corner-enquiries.csv');
    toast('CSV downloaded.', 'ok');
  };

  const waNumber = phone => {
    const n = String(phone || '').replace(/\D/g, '');
    return n.length === 10 ? '91' + n : n;
  };

  return (
    <>
      <div className="ah">
        <div>
          <h2>Enquiries</h2>
          <p className="sub">Every contact form submission is stored here.</p>
        </div>
        <div className="acts">
          <button className="sm" onClick={exportCsv}>Download CSV</button>
          <button className="sm dg" onClick={clearAll}>Clear all</button>
        </div>
      </div>

      <div className="panel">
        <div className="strip">
          {[['all', 'All (' + s.leads.length + ')'], ['new', 'New'], ['contacted', 'Contacted'], ['done', 'Done']]
            .map(([v, l]) => (
              <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>{l}</button>
            ))}
        </div>

        <label style={{ marginBottom: 16 }}>Search
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Name, phone, email or message" />
        </label>

        {list.length ? (
          <div className="scrollx">
            <table className="tbl">
              <thead>
                <tr><th>Who</th><th>Contact</th><th>Message</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {list.map(l => {
                  const open = openId === l.id;
                  const channels = l.channels || {};
                  return (
                    <tr key={l.id}>
                      <td>
                        <b>{l.name}</b><br />
                        <span style={{ color: 'var(--mut)', fontSize: '.82rem' }}>
                          {formatDate(l.ts)} · {String(l.lang || 'en').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <a href={'tel:' + l.phone}>{l.phone}</a>
                        {l.email && <><br /><a href={'mailto:' + l.email}>{l.email}</a></>}
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        {open ? l.msg : l.msg.slice(0, 70) + (l.msg.length > 70 ? '…' : '')}
                        {open && (
                          <div style={{ marginTop: 8, color: 'var(--mut)', fontSize: '.82rem' }}>
                            Sent: {Object.keys(channels).map(k => k + ': ' + channels[k]).join(' · ') || 'not recorded'}
                          </div>
                        )}
                        <br />
                        <button className="sm" style={{ marginTop: 6 }}
                          onClick={() => setOpenId(open ? '' : l.id)}>
                          {open ? 'Show less' : 'Show full'}
                        </button>
                      </td>
                      <td>
                        <select className="sm" style={{ width: 'auto', margin: 0, padding: '6px 8px' }}
                          value={l.status} onChange={e => setStatus(l.id, e.target.value)}>
                          <option value="new">new</option>
                          <option value="contacted">contacted</option>
                          <option value="done">done</option>
                        </select>
                      </td>
                      <td>
                        <div className="acts">
                          {waNumber(l.phone) && (
                            <a className="sm" target="_blank" rel="noopener"
                              href={'https://wa.me/' + waNumber(l.phone)}>WhatsApp</a>
                          )}
                          {l.email && (
                            <a className="sm"
                              href={'mailto:' + l.email + '?subject=' +
                                encodeURIComponent('Re: your enquiry to PF Corner')}>Reply</a>
                          )}
                          <button className="sm dg" onClick={() => remove(l.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">Nothing here yet. New enquiries land at the top of this list.</p>
        )}
      </div>
    </>
  );
}

/* --------------------------------------------------------- Content & SEO */
export function ContentTab() {
  useStore();
  const [lang, setLang] = useState('en');
  const [page, setPage] = useState('home');
  const [sections, setSections] = useState({});

  let root = 'c';
  if (lang !== 'en') {
    syncShape(state().tr[lang], state().c);
    root = 'tr.' + lang;
  }

  const pageDef = findPage(page);
  const sectionList = pageDef[2];
  let sectionId = sections[page] || sectionList[0][0];
  if (!sectionList.some(s => s[0] === sectionId)) sectionId = sectionList[0][0];
  const section = sectionList.find(s => s[0] === sectionId);

  const fields = section[2]
    .map(([path, label]) => <AnyField key={path} path={root + '.' + path} label={label} />)
    .filter(Boolean);

  const langLabel = LANG_TABS.find(l => l[0] === lang)[1];

  return (
    <>
      <div className="ah">
        <div>
          <h2>Content &amp; SEO</h2>
          <p className="sub">
            Pick a language, then a page, then the section you want to change. Edits save as you type.
          </p>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginBottom: 12 }}><Icon name="globe" size={20} /> Language</h3>
        <div className="strip">
          {LANG_TABS.map(([code, label]) => (
            <button key={code} className={lang === code ? 'on' : ''}
              onClick={() => setLang(code)}>{label}</button>
          ))}
        </div>

        {lang !== 'en' && (
          <div className="note">
            You are editing the <b>{langLabel}</b> version. Leave a field empty to show the English text.
            Images, icons, phone, email and social links come from English.
          </div>
        )}

        <h3 style={{ margin: '22px 0 12px' }}>Page</h3>
        <div className="strip">
          {CONTENT_TREE.map(p => (
            <button key={p[0]} className={page === p[0] ? 'on' : ''}
              onClick={() => setPage(p[0])}>{p[1]}</button>
          ))}
        </div>

        <h3 style={{ margin: '22px 0 12px' }}>Section of {pageDef[1]}</h3>
        <div className="strip l2">
          {sectionList.map(s => (
            <button key={s[0]} className={sectionId === s[0] ? 'on' : ''}
              onClick={() => setSections(v => ({ ...v, [page]: s[0] }))}>{s[1]}</button>
          ))}
        </div>
      </div>

      <div className="panel">
        <p className="crumb">{langLabel} › {pageDef[1]} › {section[1]}</p>
        <h3 style={{ marginTop: 0 }}>{section[1]}</h3>
        {fields.length ? fields : (
          <p className="hint">
            Nothing to translate in this section — images, links and phone numbers are shared from English.
          </p>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Design */
export function Design() {
  const s = useStore();
  return (
    <>
      <div className="ah">
        <div><h2>Design</h2><p className="sub">Colours used across every page.</p></div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Colour theme</h3>
        <div className="th">
          {['ocean', 'indigo', 'emerald', 'night'].map(t => (
            <button key={t} className={s.theme === t ? 'on' : ''}
              onClick={() => update(st => { st.theme = t; })}>{t}</button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Brand colour</h3>
        <p className="hint">Overrides the theme colour on buttons, links and headings.</p>
        <label style={{ maxWidth: 220 }}>Pick a colour
          <input type="color" value={s.accent || '#0b5e63'} style={{ height: 48, padding: 4 }}
            onChange={e => setPath('accent', e.target.value)} />
        </label>
        <button className="sm" onClick={() => update(st => { st.accent = ''; })}>
          Use the theme colour
        </button>
      </div>
    </>
  );
}
