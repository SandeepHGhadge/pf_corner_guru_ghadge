import { useEffect, useState } from 'react';
import { Icon, Media } from './Ui.jsx';
import { setLang } from '../lib/hooks.js';

const NAV = [
  ['#/', 'home'],
  ['#/services', 'services'],
  ['#/about', 'about'],
  ['#/contact', 'contact']
];

const LANG_BUTTONS = [['en', 'EN'], ['mr', 'मराठी'], ['hi', 'हिन्दी']];

export function Header({ content, lang, route }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(scrollY > 10);
    addEventListener('scroll', fn, { passive: true });
    return () => removeEventListener('scroll', fn);
  }, []);

  useEffect(() => { setOpen(false); }, [route]);

  const site = content.site;
  const here = '#/' + (route === 'home' ? '' : route);

  return (
    <header className={scrolled ? 'sc' : ''}>
      <div className="w bar">
        <a className="brand" href="#/">
          <span><Media value={site.logo} alt={site.brand} fallback="shield" /></span>
          {site.brand}
        </a>

        <button id="bg" aria-expanded={open} aria-controls="nv" onClick={() => setOpen(v => !v)}>
          {content.ui.menu}
        </button>

        <nav id="nv" className={open ? 'open' : ''} aria-label="Main">
          {NAV.map(([href, key]) => (
            <a key={key} href={href} className={here === href ? 'on' : ''}>{content.ui[key]}</a>
          ))}
        </nav>

        <div className="lg" role="group" aria-label="Language">
          {LANG_BUTTONS.map(([code, label]) => (
            <button key={code} lang={code} className={lang === code ? 'on' : ''}
              onClick={() => setLang(code)}>{label}</button>
          ))}
        </div>
      </div>
    </header>
  );
}

export function Footer({ content }) {
  const site = content.site;
  return (
    <footer>
      <div className="w">
        <div>
          <b>{site.brand}</b>
          <p>{site.tagline}</p>
        </div>
        <address style={{ fontStyle: 'normal' }}>
          <p>
            {site.address}<br />
            <a href={'tel:' + site.phone}>{site.phone}</a><br />
            <a href={'mailto:' + site.email}>{site.email}</a>
          </p>
        </address>
        <p>
          <a href={site.facebook} rel="noopener" target="_blank">Facebook</a>{' · '}
          <a href={site.instagram} rel="noopener" target="_blank">Instagram</a>{' · '}
          <a href={'https://wa.me/' + site.whatsapp} rel="noopener" target="_blank">WhatsApp</a><br />
        </p>
      </div>
    </footer>
  );
}

export function WhatsAppButton({ content, hidden }) {
  if (hidden) return null;
  return (
    <a className="wa" target="_blank" rel="noopener"
      href={'https://wa.me/' + content.site.whatsapp}>
      {content.ui.chat}
    </a>
  );
}

/* Keeps the document title, meta tags and structured data in step. */
export function Seo({ content, route, lang, theme, accent }) {
  useEffect(() => {
    const meta = content.seo[route] || content.seo.home;
    const site = content.site;

    document.title = meta.title;
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = theme;
    if (accent) document.documentElement.style.setProperty('--brand', accent);
    else document.documentElement.style.removeProperty('--brand');

    const put = (selector, attr, value) => {
      const el = document.querySelector(selector);
      if (el) el[attr] = value;
    };
    put('meta[name=description]', 'content', meta.description || '');
    put('meta[property="og:title"]', 'content', meta.title);
    put('meta[property="og:description"]', 'content', meta.description || '');
    put('meta[name=robots]', 'content', route === 'admin' ? 'noindex,nofollow' : 'index,follow');
    put('link[rel=canonical]', 'href',
      location.origin + location.pathname + (route === 'home' ? '' : '#/' + route));

    const ld = document.getElementById('ld');
    if (ld) {
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ProfessionalService',
        name: site.brand,
        description: meta.description,
        telephone: site.phone,
        email: site.email,
        address: {
          '@type': 'PostalAddress',
          streetAddress: site.address,
          addressLocality: 'Phaltan',
          addressRegion: 'Maharashtra',
          postalCode: '415523',
          addressCountry: 'IN'
        },
        sameAs: [site.facebook, site.instagram],
        founder: { '@type': 'Person', name: 'Gurudas Ghadge' }
      });
    }
  }, [content, route, lang, theme, accent]);

  return null;
}

export { Icon };
