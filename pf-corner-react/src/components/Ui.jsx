import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IC } from '../lib/iconData.js';
import { prefersReducedMotion } from '../lib/hooks.js';

/* ------------------------------------------------------------------- Icon */
export function Icon({ name, size = 24 }) {
  const path = IC[name];
  if (!path) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path }} />
  );
}

/* A value that is either an icon name or an image link. */
export function Media({ value, alt = '', fallback }) {
  const [broken, setBroken] = useState(false);
  if (value && /^(https?:|data:|\/)/.test(value) && !broken) {
    return <img src={value} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
  }
  if (value && IC[value]) return <Icon name={value} />;
  return fallback ? <Icon name={fallback} /> : null;
}

/* ------------------------------------------------------------------ Toast */
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();

  const show = useCallback((message, kind) => {
    clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = setTimeout(() => setToast(null), 4600);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div id="toast" role="status" aria-live="polite"
        className={toast ? 'show ' + (toast.kind || '') : ''}>
        {toast ? toast.message : ''}
      </div>
    </ToastContext.Provider>
  );
}

/* ----------------------------------------------------------------- Reveal */
/* Wraps any block so it animates in the first time it scrolls into view. */
export function Reveal({ as: Tag = 'div', kind = 'up', delay = 0, className = '', style, children, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (shown || !ref.current || !('IntersectionObserver' in window)) { setShown(true); return; }
    const node = ref.current;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        setShown(true);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    io.observe(node);
    return () => io.disconnect();
  }, [shown]);

  const classes = [className, 'rv', shown ? 'in' : ''].filter(Boolean).join(' ');
  return (
    <Tag ref={ref} className={classes} data-rv={kind} style={{ '--d': delay + 's', ...style }} {...rest}>
      {children}
    </Tag>
  );
}

/* ----------------------------------------------------------- CountUp stat */
export function CountUp({ value }) {
  const ref = useRef(null);
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
    const digits = String(value).replace(/[^\d]/g, '');
    if (!digits || prefersReducedMotion() || !ref.current) return;
    const target = +digits;
    const suffix = String(value).replace(/[\d,]/g, '');
    let start;
    let raf;
    const step = ts => {
      start = start || ts;
      const p = Math.min((ts - start) / 1200, 1);
      setText(Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('en-IN') + suffix);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <b className="cn" ref={ref}>{text}</b>;
}

/* --------------------------------------------------- scroll progress bar */
export function ScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const fn = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      setPct(h > 0 ? (scrollY / h) * 100 : 0);
    };
    addEventListener('scroll', fn, { passive: true });
    fn();
    return () => removeEventListener('scroll', fn);
  }, []);
  return <div id="pgbar" style={{ width: pct + '%' }} />;
}
