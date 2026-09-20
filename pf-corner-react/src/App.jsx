import { useEffect, useMemo, useState } from 'react';
import './styles.css';

import { useStore, mergeLang } from './lib/store.js';
import { useLang, useRoute } from './lib/hooks.js';
import { ToastProvider, ScrollProgress, useToast } from './components/Ui.jsx';
import { Header, Footer, WhatsAppButton, Seo } from './components/Chrome.jsx';
import { Home, Services, About } from './pages/Pages.jsx';
import { Contact } from './pages/Contact.jsx';
import { Admin } from './admin/Admin.jsx';
import { onStorageFull } from './lib/store.js';

const ROUTES = ['home', 'services', 'about', 'contact', 'admin'];

function Shell() {
  const s = useStore();
  const lang = useLang();
  const raw = useRoute();
  const route = ROUTES.includes(raw) ? raw : 'home';
  const toast = useToast();
  const [fading, setFading] = useState(false);

  /* the English record merged with the chosen translation */
  const content = useMemo(
    () => (lang === 'en' ? s.c : mergeLang(s.c, s.tr[lang])),
    [s, lang]
  );

  /* warn once if the browser runs out of local storage */
  useEffect(() => {
    onStorageFull(() => toast('Storage is full. Remove some uploaded images or old enquiries.', 'bad'));
  }, [toast]);

  /* short cross-fade between pages, and back to the top */
  useEffect(() => {
    setFading(true);
    const t = setTimeout(() => {
      setFading(false);
      if (route !== 'admin') scrollTo({ top: 0, behavior: 'instant' });
    }, 30);
    return () => clearTimeout(t);
  }, [route, lang]);

  const pages = {
    home: <Home content={content} />,
    services: <Services content={content} />,
    about: <About content={content} />,
    contact: <Contact content={content} lang={lang} />,
    admin: <Admin />
  };

  return (
    <>
      <ScrollProgress />
      <Seo content={content} route={route} lang={lang} theme={s.theme} accent={s.accent} />
      <a className="skip" href="#app">Skip to main content</a>

      <Header content={content} lang={lang} route={route} />

      <main id="app" className={fading ? 'out' : ''} key={route + lang}>
        {pages[route]}
      </main>

      <Footer content={content} />
      <WhatsAppButton content={content} hidden={route === 'admin'} />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
