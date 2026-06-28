# Engine Room — HTML/CSS/JS Edition

Pure HTML + CSS + Vanilla JS conversion of the Engine Room coaching platform.  
No Node.js. No React. Opens with any static file server.

---

## Project Structure

```
engine-room-html/
├── index.html          ← Landing page (sign-in / create account)
├── coach.html          ← Full coach dashboard (all sections)
├── client.html         ← Full client portal (all sections)
│
├── css/
│   ├── style.css       ← Full design system + dark theme
│   └── responsive.css  ← Mobile / tablet breakpoints
│
├── js/
│   ├── supabase.js     ← Supabase client + raw helpers
│   ├── auth.js         ← signUpClient / signInClient / signInCoach / signOutClient / signOutCoach
│   ├── storage.js      ← localStorage CRUD + utilities (formatDate, goalColor, toast, icon…)
│   ├── coach.js        ← Coach dashboard: overview, clients, plans, check-ins, messages
│   └── client.js       ← Client portal: overview, plan, check-in, progress, messages
│
├── supabase-schema.sql ← SQL to run in Supabase SQL Editor
└── README.md
```

---

## Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Give it a name, choose a region, set a database password

### 2. Run the SQL Schema

1. In your Supabase dashboard → **SQL Editor**
2. Paste the contents of `supabase-schema.sql` and click **Run**

### 3. Configure Supabase Keys

Open `js/supabase.js` and replace the placeholder values:

```js
const SUPABASE_URL      = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...your-anon-key...';
```

Both values are in Supabase → **Settings → API**.

### 4. Disable Email Confirmation (recommended for local use)

In Supabase → **Authentication → Providers → Email**  
Toggle **OFF** "Confirm email" so clients can sign in immediately after registering.

### 5. Create the First Coach Account

1. In Supabase → **Authentication → Users → Invite user** (enter your email)
2. Complete sign-up from the invite email
3. In **SQL Editor**, run:

```sql
insert into public.profiles (id, name, email, role)
values ('<your-auth-uuid>', 'Mohamed Mansour', 'coach@example.com', 'coach');
```

Replace `<your-auth-uuid>` with the UUID from Authentication → Users.

### 6. Serve the Files

Use any static file server. Options:

**VS Code Live Server** (recommended)  
Install the Live Server extension → right-click `index.html` → Open with Live Server

**Python**
```bash
cd engine-room-html
python3 -m http.server 3000
# Open http://localhost:3000
```

**npx serve**
```bash
npx serve engine-room-html
```

---

## Authentication Flow

| Role   | How to access                                              |
|--------|------------------------------------------------------------|
| Client | Click **Sign In** or **Create Account** on the landing page |
| Coach  | Tap the Engine Room logo **5 times** → Coach Access modal  |

---

## Data Storage

| Data           | Where                  |
|----------------|------------------------|
| Auth (users)   | Supabase Auth          |
| Profiles       | Supabase `profiles` table |
| Plans          | Browser `localStorage` |
| Check-ins      | Browser `localStorage` |
| Messages       | Browser `localStorage` |
| Payments       | Browser `localStorage` |

Plans, check-ins, and messages are stored in `localStorage` under `cd_` prefixed keys.  
This means data is per-device/per-browser, which matches the original Next.js version.

---

## Security Notes

- **Anon Key only** — the Service Role key is never exposed
- **Row Level Security** is enabled on `profiles`
- Passwords are handled entirely by Supabase Auth (bcrypt, never stored manually)
- Clients can only read/update their own profile row

---

## CDN Dependencies (loaded from unpkg/CDN — no install needed)

| Library             | Purpose                          |
|---------------------|----------------------------------|
| `@supabase/supabase-js` | Auth + database client        |
| `lucide`            | SVG icon set                     |
| `Chart.js`          | Weight progress chart (client)   |
