import { useState } from 'react';
import { Icon, Reveal, useToast } from '../components/Ui.jsx';
import { submitLead } from '../lib/notify.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

const EMPTY = { name: '', phone: '', email: '', msg: '', company: '' };

export function Contact({ content, lang }) {
  const [values, setValues] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const toast = useToast();

  const c = content.contact;
  const site = content.site;
  const field = k => e => setValues(v => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    if (values.company) return;                       /* honeypot: silently drop bots */

    const phone = values.phone.replace(/\D/g, '');
    if (values.name.trim().length < 2) return setNote({ text: 'Please enter your name.' });
    if (phone.length < 10) return setNote({ text: 'Please enter a valid phone number.' });
    if (values.email && !EMAIL_RE.test(values.email)) return setNote({ text: 'Please check the email address.' });
    if (values.msg.trim().length < 5) return setNote({ text: 'Please tell us a little about what you need.' });

    setNote(null);
    setBusy(true);
    const res = await submitLead(values, lang);
    setBusy(false);
    setValues(EMPTY);
    toast(content.ui.thanks, 'ok');
    setNote({ text: content.ui.thanks, link: res.waLink });
  }

  return (
    <section className="sec">
      <div className="w two">
        <Reveal kind="left">
          <h1>{c.title}</h1>
          <p>{c.text}</p>
          <p className="ci">
            <Icon name="pin" size={22} />
            <span><b>{content.ui.addr}</b><br />{site.address}</span>
          </p>
          <p className="ci">
            <Icon name="phone" size={22} />
            <span><b>{content.ui.phone}</b><br /><a href={'tel:' + site.phone}>{site.phone}</a></span>
          </p>
          <p className="ci">
            <Icon name="mail" size={22} />
            <span><b>{content.ui.email}</b><br /><a href={'mailto:' + site.email}>{site.email}</a></span>
          </p>
        </Reveal>

        <Reveal as="form" kind="right" delay={0.08} onSubmit={onSubmit} noValidate>
          <label>{content.ui.name} *
            <input name="name" value={values.name} onChange={field('name')} autoComplete="name" required />
          </label>
          <label>{content.ui.phone} *
            <input name="phone" type="tel" inputMode="tel" value={values.phone}
              onChange={field('phone')} autoComplete="tel" required />
          </label>
          <label>{content.ui.email}
            <input name="email" type="email" value={values.email}
              onChange={field('email')} autoComplete="email" />
          </label>
          <label>{content.ui.msg} *
            <textarea name="msg" rows="4" value={values.msg} onChange={field('msg')} required />
          </label>

          {/* Bots fill this in; people never see it. */}
          <input className="hp" name="company" tabIndex={-1} autoComplete="off"
            aria-hidden="true" value={values.company} onChange={field('company')} />

          <button className="btn" disabled={busy}>{busy ? '…' : c.btn}</button>

          {note && (
            <p style={{ margin: '12px 0 0', fontSize: '.9rem', color: 'var(--mut)' }}>
              {note.text}{' '}
              {note.link && (
                <a href={note.link} target="_blank" rel="noopener">{content.ui.chat}</a>
              )}
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
