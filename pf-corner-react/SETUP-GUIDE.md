# PF Corner — setup guide

Two files do the work:

| File | What it is | Where it goes |
|---|---|---|
| the built `dist/` folder | The whole website and the admin panel | Any static host: Hostinger, Netlify, Vercel, GitHub Pages, cPanel |
| `server/` (`server.js`, `package.json`, `.env`) | The small helper that actually sends email, WhatsApp and SMS | Render, Railway, Fly.io, a VPS, or the same cPanel if it runs Node |

The website works on its own. Every enquiry is saved and shown in the admin panel, and WhatsApp opens pre-filled. **Email needs the helper server** — a browser cannot log in to Gmail by itself, so nothing on the internet can send real email from a plain HTML file.

---

## 1. Put the website online

```bash
npm install
npm run build
```

Upload everything inside `dist/` to your host. That is all — open it and the site works.

The admin panel is at `yoursite.com/#/admin`.
First sign in: **admin / admin@123** — change it immediately under *Account & security*.

## 2. Create a Gmail app password

1. Open your Google Account → **Security**.
2. Turn on **2-Step Verification** (required — app passwords do not exist without it).
3. Back in Security, open **App passwords**.
4. Choose app **Mail**, device **Other**, name it "PF Corner website".
5. Google shows 16 characters like `abcd efgh ijkl mnop`. Copy them.

Your normal Gmail password will never work for this. Only the app password does.

Gmail's free limit is roughly 500 emails a day, which is far more than a consultancy website needs.

## 3. Run the helper server

```bash
cd server
cp .env.example .env      # then edit .env
npm install
npm start
```

In `.env` the three things you must set:

```
ADMIN_PASS=your-admin-password
ADMIN_TOKEN=any-long-random-string
GMAIL_USER=pfcorner100@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop     # no spaces
ADMIN_EMAIL=pfcorner100@gmail.com
```

### Free hosting on Render

1. Push the `server` folder to a GitHub repository.
2. render.com → **New → Web Service** → pick the repo.
3. Build command `npm install`, start command `npm start`.
4. Add each line of `.env` under **Environment → Environment Variables**.
5. Render gives you an address like `https://pf-notify.onrender.com`.

Set `ALLOWED_ORIGIN` to your website address once it is live, so no other site can use your server.

## 4. Connect the two

In the admin panel → **Notifications**:

1. Paste the server address into **Server address**.
2. Paste your `ADMIN_TOKEN` into **Server admin token**.
3. Press **Check server** — it should say the server is running.
4. Fill in the email section and press **Save to server**.
   The secrets are stored on the server and wiped from this browser.
5. Press **Send a test email**.

From then on every contact form submission sends:

- an alert email to you, with a Reply-on-WhatsApp button, and **Reply-To** set to the customer so hitting reply goes straight to them;
- a confirmation email to the customer;
- a WhatsApp message and an SMS if you switched those on;
- a row in **Enquiries** in the admin panel.

## 5. WhatsApp options

**Free (default).** Mode "Open a pre-filled chat". The site opens WhatsApp with the enquiry already typed; you press send. No setup, no cost.

**Automatic.** Mode "WhatsApp Cloud API". You need a Meta developer app with WhatsApp added; copy the **Phone number ID** and a **permanent access token** into the admin panel. Meta gives 1,000 free service conversations a month.

## 6. SMS options

| Provider | Good for | What you need |
|---|---|---|
| Twilio | Anywhere | Account SID, auth token, Twilio number |
| Fast2SMS | India, cheapest | API key |
| MSG91 | India, DLT-registered | API key + flow/template ID |

Indian SMS needs DLT registration of your sender ID and template before delivery works.

---

## The admin panel

| Tab | What you do there |
|---|---|
| **Dashboard** | Counts, the latest enquiries, and a green/red check of every notification channel |
| **Enquiries** | Every submission, searchable and filterable, with status (new → contacted → done), call/WhatsApp/reply buttons and CSV download |
| **Content & SEO** | Language → page → section. Pick English, Marathi or Hindi, then a page, then the exact section you want to change |
| **Design** | Four colour themes plus your own brand colour |
| **Notifications** | Email, WhatsApp, SMS and Telegram settings with a test button for each |
| **Account & security** | Password, auto sign-out time, backup and restore |

### How the admin session is protected

- The session lives in `sessionStorage`, so closing the tab signs you out.
- No activity for the chosen number of minutes (5 to 60) also signs you out.
- Five wrong passwords lock the sign-in form for a minute.
- Only the SHA-256 fingerprint of your password is stored, never the password.
- The admin page is marked `noindex, nofollow` so Google never lists it.

Be clear-eyed about one thing: anything that runs in a browser can be read in a browser. This login keeps a casual visitor out of your content. For real protection put the site behind your host's password protection (`.htpasswd` on cPanel, or Netlify's password option), which asks for a password before the page is even downloaded.

### Content and translations

English is the source. Marathi and Hindi hold only the words — a field you leave empty falls back to the English text, and images, icons, phone numbers, email and social links always come from English so you only maintain them once. Adding or removing a service is done in English and the other languages follow.

### Backups

`Account & security → Download backup` gives you one JSON file with all content, translations, design and enquiries. Do this before any big edit. Everything lives in this browser's local storage, so clearing browser data without a backup loses it.

---

## Troubleshooting

**"Email needs the helper server"** — the server address is empty or wrong in Notifications.

**Test email says "not configured"** — the Gmail address or app password did not reach the server. Press *Save to server* again, or set them in `.env` and restart.

**"Invalid login: 535"** in the server log — the app password is wrong, has spaces in it, or 2-Step Verification is off.

**Nothing arrives but the test says sent** — check the spam folder and add your own address to contacts.

**Port 465 blocked by your host** — set `SMTP_PORT=587` and `SMTP_SECURE=false`.

**The form works but the admin panel is empty on another device** — enquiries are stored per browser. The server keeps its own copy in `data/leads.json`, and `GET /api/leads` with your admin token returns it.
