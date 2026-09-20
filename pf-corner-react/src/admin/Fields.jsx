import { IC } from '../lib/iconData.js';
import { Icon, useToast } from '../components/Ui.jsx';
import { getPath, setPath, update, NT, clone } from '../lib/store.js';
import { shrinkImage } from '../lib/hooks.js';

export const humanise = key =>
  key.replace(/([A-Z])/g, ' $1')
    .replace(/^n(\d)$/, 'Number $1')
    .replace(/^l(\d)$/, 'Label $1')
    .replace(/^./, c => c.toUpperCase());

const isSecret = k => /pass|token|apikey|^sid$|^key$/i.test(k);
const isLong = (k, v) =>
  String(v).length > 80 || /text$|^welcome[12]$|description|body|address|quote$|^msg$|^sub$/i.test(k);

/* ------------------------------------------------------------ image input */
function ImageInput({ path, label }) {
  const value = String(getPath(path) ?? '');
  const uploaded = value.startsWith('data:');
  const toast = useToast();

  const onFile = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    shrinkImage(file, data => { setPath(path, data); toast('Image added.', 'ok'); },
      () => toast('That file is not an image.', 'bad'));
  };

  return (
    <>
      <label>
        {label} <span style={{ fontWeight: 500, color: 'var(--mut)' }}>(image link, or upload below)</span>
        <input value={uploaded ? '(uploaded image)' : value} readOnly={uploaded}
          onChange={e => setPath(path, e.target.value)} />
      </label>
      {/^(https?:|data:)/.test(value) && <img className="pv" src={value} alt="" />}
      <label style={{ fontWeight: 500, fontSize: '.84rem' }}>
        Upload a file
        <input type="file" accept="image/*" onChange={onFile} />
      </label>
      {uploaded && (
        <button className="sm dg" onClick={() => setPath(path, '')}>Remove uploaded image</button>
      )}
    </>
  );
}

/* ------------------------------------------------------------- icon input */
function IconInput({ path, label }) {
  const value = String(getPath(path) ?? '');
  const toast = useToast();

  const onFile = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    shrinkImage(file, data => { setPath(path, data); toast('Image added.', 'ok'); },
      () => toast('That file is not an image.', 'bad'));
  };

  return (
    <>
      <label>{label}
        <select value={value} onChange={e => setPath(path, e.target.value)}>
          {Object.keys(IC).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span className="pv" style={{ display: 'grid', placeItems: 'center', color: 'var(--brand)' }}>
        <Icon name={value} size={30} />
      </span>
      <label style={{ fontWeight: 500, fontSize: '.84rem' }}>
        Or upload your own image
        <input type="file" accept="image/*" onChange={onFile} />
      </label>
    </>
  );
}

/* ----------------------------------------------------------- single value */
export function Field({ path, label }) {
  const key = path.split('.').pop();
  const value = getPath(path);
  if (value === undefined) return null;

  const text = label || humanise(key);

  if (/^(icon|logo)$/i.test(key) && !/^(https?:|data:)/.test(String(value))) {
    return <IconInput path={path} label={text} />;
  }
  if (/img|photo|logo|icon/i.test(key)) {
    return <ImageInput path={path} label={text} />;
  }
  if (isLong(key, value)) {
    return (
      <label>{text}
        <textarea rows={String(value).length > 260 ? 6 : 4} value={value}
          onChange={e => setPath(path, e.target.value)} />
      </label>
    );
  }
  return (
    <label>{text}
      <input type={isSecret(key) ? 'password' : 'text'} value={value}
        autoComplete={isSecret(key) ? 'off' : undefined}
        onChange={e => setPath(path, e.target.value)} />
    </label>
  );
}

/* ------------------------------------------ object and list (recursive) */
export function Editor({ path }) {
  const value = getPath(path);
  if (value == null) return null;
  const locked = path.startsWith('tr.');

  return (
    <>
      {Object.keys(value).map(k => {
        if (locked && NT.test(k)) return null;
        const child = value[k];
        const childPath = path + '.' + k;
        if (Array.isArray(child)) return <ListEditor key={k} path={childPath} label={humanise(k)} />;
        if (child && typeof child === 'object') {
          return (
            <fieldset key={k}>
              <legend>{humanise(k)}</legend>
              <Editor path={childPath} />
            </fieldset>
          );
        }
        return <Field key={k} path={childPath} />;
      })}
    </>
  );
}

export function ListEditor({ path, label }) {
  const list = getPath(path);
  const locked = path.startsWith('tr.');
  const toast = useToast();
  if (!Array.isArray(list)) return null;

  const add = () => {
    const blank = clone(list[0] || {});
    (function blankOut(o) {
      for (const k in o) {
        if (o[k] && typeof o[k] === 'object') blankOut(o[k]);
        else o[k] = '';
      }
    })(blank);
    update(() => { list.push(blank); });
  };

  const remove = i => {
    if (list.length < 2) return toast('Keep at least one item.', 'bad');
    if (!confirm('Remove this item?')) return;
    update(s => {
      /* keep the translations lined up with the English list */
      const parts = path.split('.');
      if (parts[0] === 'c') {
        for (const lang of ['mr', 'hi']) {
          const tail = parts.slice(1);
          const arr = tail.reduce((o, k) => (o == null ? undefined : o[k]), s.tr[lang]);
          if (Array.isArray(arr)) arr.splice(i, 1);
        }
      }
      list.splice(i, 1);
    });
  };

  return (
    <fieldset>
      <legend>{label}</legend>
      {list.map((_, i) => (
        <div className="item" key={i}>
          <b>Item {i + 1}</b>
          {!locked && (
            <button className="sm dg" style={{ float: 'right', marginTop: '-30px' }}
              onClick={() => remove(i)}>Remove</button>
          )}
          <Editor path={path + '.' + i} />
        </div>
      ))}
      {!locked && <><br /><button className="sm" onClick={add}>Add item</button></>}
    </fieldset>
  );
}

/* Renders whatever sits at a path: single value, object or list. */
export function AnyField({ path, label }) {
  const value = getPath(path);
  if (value === undefined) return null;
  const key = path.split('.').pop();
  if (path.startsWith('tr.') && NT.test(key)) return null;

  if (Array.isArray(value)) return <ListEditor path={path} label={label || humanise(key)} />;
  if (value && typeof value === 'object') {
    return (
      <fieldset>
        <legend>{label || humanise(key)}</legend>
        <Editor path={path} />
      </fieldset>
    );
  }
  return <Field path={path} label={label} />;
}

/* ------------------------------------------ settings control (config tab) */
export function Setting({ path, label, type = 'text', options, hint }) {
  const value = getPath(path);

  if (type === 'switch') {
    return (
      <label className="sw">
        <input type="checkbox" checked={!!value} onChange={e => setPath(path, e.target.checked)} />
        {label}
      </label>
    );
  }
  if (type === 'select') {
    return (
      <label>{label}
        <select value={String(value)} onChange={e => setPath(path, e.target.value)}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    );
  }
  if (type === 'textarea') {
    return (
      <label>{label}
        <textarea rows="7" value={value} onChange={e => setPath(path, e.target.value)} />
      </label>
    );
  }
  const inputType = type === 'password' ? 'password' : type === 'number' ? 'number' : type === 'email' ? 'email' : 'text';
  return (
    <label>{label}
      <input type={inputType} value={value}
        autoComplete={type === 'password' ? 'new-password' : undefined}
        onChange={e => setPath(path, e.target.value)} />
      {hint && <span style={{ fontWeight: 500, color: 'var(--mut)', fontSize: '.82rem' }}>{hint}</span>}
    </label>
  );
}

/* ----------------------------------------------------------- CONTENT MAP */
/* page tab -> section tab -> the fields of that section.
   Paths are relative to the content root ("c" or "tr.<lang>"). */
export const CONTENT_TREE = [
  ['site', 'Global', [
    ['brand', 'Business name & logo', [
      ['site.brand', 'Business name'],
      ['site.logo', 'Logo'],
      ['site.tagline', 'Tagline']
    ]],
    ['reach', 'Contact details', [
      ['site.phone', 'Phone number'],
      ['site.email', 'Email address'],
      ['site.whatsapp', 'WhatsApp number (with country code)'],
      ['site.address', 'Address']
    ]],
    ['social', 'Social links', [
      ['site.facebook', 'Facebook page link'],
      ['site.instagram', 'Instagram profile link']
    ]]
  ]],
  ['home', 'Home page', [
    ['hero', 'Hero (top banner)', [
      ['home.title', 'Main heading'],
      ['home.sub', 'Sub heading'],
      ['home.cta1', 'First button'],
      ['home.cta2', 'Second button'],
      ['home.heroImg', 'Banner image']
    ]],
    ['stats', 'Numbers strip', [
      ['home.n1', 'Number 1'], ['home.l1', 'Label 1'],
      ['home.n2', 'Number 2'], ['home.l2', 'Label 2']
    ]],
    ['welcome', 'Welcome section', [
      ['home.welcomeKicker', 'Small line above heading'],
      ['home.welcomeTitle', 'Heading'],
      ['home.welcome1', 'Paragraph 1'],
      ['home.welcome2', 'Paragraph 2'],
      ['home.welcomeCta', 'Button text']
    ]],
    ['svcs', 'Services shown on home', [
      ['home.svcTitle', 'Section heading'],
      ['homeSvcs', 'Service blocks']
    ]],
    ['quote', 'Quote band', [
      ['home.quote', 'Quote'],
      ['home.quoteBy', 'Quote author']
    ]],
    ['seo', 'Search engine listing', [['seo.home', 'Home page SEO']]]
  ]],
  ['services', 'Services page', [
    ['head', 'Page heading', [['services.title', 'Page heading']]],
    ['cards', 'Service cards', [['services.items', 'Services and pricing']]],
    ['band', 'Question band', [
      ['services.qTitle', 'Heading'],
      ['services.qText', 'Text'],
      ['services.qCta', 'Button text']
    ]],
    ['seo', 'Search engine listing', [['seo.services', 'Services page SEO']]]
  ]],
  ['about', 'About page', [
    ['intro', 'Founder introduction', [
      ['about.title', 'Heading'],
      ['about.sub', 'Sub heading'],
      ['about.text', 'About text']
    ]],
    ['photo', 'Founder photo', [['about.photo', 'Photo']]],
    ['seo', 'Search engine listing', [['seo.about', 'About page SEO']]]
  ]],
  ['contact', 'Contact page', [
    ['intro', 'Heading & intro', [
      ['contact.title', 'Heading'],
      ['contact.text', 'Intro text']
    ]],
    ['form', 'Enquiry form', [
      ['contact.btn', 'Send button'],
      ['ui.name', 'Name field label'],
      ['ui.phone', 'Phone field label'],
      ['ui.email', 'Email field label'],
      ['ui.msg', 'Message field label'],
      ['ui.thanks', 'Thank you message']
    ]],
    ['seo', 'Search engine listing', [['seo.contact', 'Contact page SEO']]]
  ]],
  ['menu', 'Menu & buttons', [
    ['nav', 'Menu labels', [
      ['ui.home', 'Home'], ['ui.services', 'Services'],
      ['ui.about', 'About'], ['ui.contact', 'Contact'],
      ['ui.menu', 'Mobile menu button']
    ]],
    ['misc', 'Other labels', [
      ['ui.learn', 'Learn more link'],
      ['ui.addr', 'Address label'],
      ['ui.chat', 'WhatsApp float button']
    ]]
  ]]
];

export const findPage = id => CONTENT_TREE.find(p => p[0] === id) || CONTENT_TREE[1];
