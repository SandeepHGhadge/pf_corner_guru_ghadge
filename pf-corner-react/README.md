# PF Corner — React app

The PF Corner website and its admin panel, built with React 18 and Vite. Three languages, a full content editor, enquiry management, and email / WhatsApp / SMS notifications.

```
pf-corner-react/
├── index.html              page shell, fonts, meta tags
├── vite.config.js
├── package.json
├── src/
│   ├── main.jsx            entry point
│   ├── App.jsx             routing, language merge, page shell
│   ├── styles.css          the whole design system and animations
│   ├── data/
│   │   ├── content.js      English source content
│   │   └── translations.js Marathi and Hindi
│   ├── lib/
│   │   ├── store.js        state, persistence, language merging
│   │   ├── hooks.js        language, router, session, utilities
│   │   ├── notify.js       server client and channel fan-out
│   │   └── iconData.js     inline SVG icons
│   ├── components/
│   │   ├── Ui.jsx          Icon, Media, Toast, Reveal, CountUp
│   │   └── Chrome.jsx      Header, Footer, WhatsApp button, SEO
│   ├── pages/
│   │   ├── Pages.jsx       Home, Services, About
│   │   └── Contact.jsx     enquiry form
│   └── admin/
│       ├── Admin.jsx       login guard, sidebar, tab routing
│       ├── Fields.jsx      field editors and the content map
│       ├── Tabs.jsx        Dashboard, Enquiries, Content & SEO, Design
│       └── Settings.jsx    Notifications, Account & security
└── server/                 the notification server (separate package)
    ├── server.js
    ├── package.json
    └── .env.example
```

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production files land in dist/
npm run preview      # check the production build locally
```

Upload the contents of `dist/` to any static host. `base: './'` in `vite.config.js` means it works from a subfolder too.

The admin panel is at `/#/admin`. First sign in: **admin / admin@123** — change it in *Account & security* immediately.

## Run the notification server

```bash
cd server
cp .env.example .env     # then fill in GMAIL_USER, GMAIL_APP_PASSWORD, ADMIN_PASS, ADMIN_TOKEN
npm install
npm start
```

Then in the admin panel → **Notifications**, paste the server address and your `ADMIN_TOKEN`, press **Check server**, fill in the email section, press **Save to server**, and finally **Send a test email**.

A browser cannot log in to Gmail by itself, which is why the server exists. Without it the site still records every enquiry and opens a pre-filled WhatsApp chat — only real email needs the server.

See `SETUP-GUIDE.md` for the Gmail app password steps, free hosting on Render, WhatsApp Cloud API and the SMS providers.

## How a few things work

**Language.** English in `data/content.js` is the source. `mergeLang()` in `store.js` overlays a translation and falls back to English for any empty field, so a half-finished translation never shows blanks. Images, icons, phone numbers, email and social links are marked non-translatable (`NT`) and always come from English.

**State.** One plain object in `localStorage`, exposed through `useStore()`. Components subscribe with a small listener set rather than a context tree, so editing a single field does not re-render the whole app. `getPath` / `setPath` address any value by a dotted path like `c.home.title`, which is what lets the admin editor be generic.

**Content editor.** `CONTENT_TREE` in `admin/Fields.jsx` maps page → section → fields. Adding a new editable field is one line there; the right control (text, textarea, image upload, icon picker, list editor) is chosen from the key name and value.

**Animations.** The `Reveal` component wraps any block and animates it in the first time it scrolls into view, with a direction and delay you pass in. `prefers-reduced-motion` short-circuits everything to visible.

**Session.** Lives in `sessionStorage`, so closing the tab signs you out. Idle timeout is configurable from 5 to 60 minutes, five wrong passwords lock the form for a minute, and only the SHA-256 fingerprint of the password is stored.

Be clear-eyed about that last point: anything running in a browser can be read in a browser. This keeps casual visitors out of your content. For real protection, put the site behind your host's password protection.
