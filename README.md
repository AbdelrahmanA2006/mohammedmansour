# Engine Room — HTML/CSS/JS Edition

Pure HTML + CSS + Vanilla JS coaching platform, fully backed by Supabase.
No Node.js required to run the frontend — opens with any static file server.

---

## Project Structure

```
engine-room-html/
├── index.html          ← Landing page (sign-in / create account)
├── coach.html          ← Coach dashboard
├── client.html         ← Client portal
├── set-password.html   ← Invite-acceptance page (set password → auto login)
│
├── css/
│   ├── style.css
│   └── responsive.css
│
├── js/
│   ├── supabase.js     ← Supabase client + all DB/Edge Function calls
│   ├── auth.js         ← signUpClient / signInClient / signInCoach / signOut* / restoreSession
│   ├── storage.js      ← In-memory cache + async read/write helpers (replaces localStorage)
│   ├── coach.js        ← Coach dashboard logic
│   └── client.js        ← Client portal logic
│
├── supabase/
│   └── functions/
│       ├── invite-user/         ← Edge Function: sends Supabase invite (service_role, server-side only)
│       ├── delete-user/         ← Edge Function: deletes a user + all their data
│       └── check-email-exists/  ← Edge Function: read-only existence check for precise sign-in errors
│
├── supabase-schema.sql ← Full SQL schema (tables, trigger, RLS) — already applied
└── README.md
```

---

## Architecture

- **Auth**: Supabase Auth (email/password). Client code only ever uses the **anon key**.
- **Profiles**: `public.profiles`, one row per `auth.users` row, created automatically by a
  `handle_new_user` trigger — never inserted directly from the browser.
- **Data**: `plans`, `check_ins`, `messages`, `payments` — all in Postgres, all protected by
  Row Level Security. `js/storage.js` loads everything into an in-memory cache once per
  session (`loadAllData()`) so the existing render functions stay synchronous; writes go to
  Supabase first, then update the cache.
- **Invites & deletion**: these require the `service_role` key, which **never** reaches the
  browser. Two Edge Functions (`invite-user`, `delete-user`) hold that key server-side, verify
  the caller is a coach, then perform the privileged operation.
- **Sign-in errors**: `supabase.auth.signInWithPassword()` deliberately returns the same
  "Invalid login credentials" error whether the email doesn't exist or the password is wrong
  (this prevents user enumeration). Since this app wants distinct "Account does not exist." /
  "Incorrect password." messages, a third Edge Function (`check-email-exists`) does a read-only
  existence lookup (no password involved) to pick the right message — called *after* the actual
  sign-in attempt has already failed, never to perform auth itself. It must be callable without
  a JWT (the user isn't signed in yet), so it's deployed with `verify_jwt: false`. Trade-off:
  this does allow probing whether an email is registered. Acceptable for this app's scale and the
  explicit UX requirement; if that's ever a concern, rate-limit the function or remove this
  feature and fall back to a single generic error.
- **Single-coach model**: the app has exactly one coach account; any row with `role = 'coach'`
  in `profiles` can read/write all client data (see RLS policies in `supabase-schema.sql`).

---

## Already Configured (this Supabase project)

The connected project (`xafvocnrepuuvxgaquil`) has already had the following applied:

- Full schema from `supabase-schema.sql` (profiles, plans, check_ins, messages, payments,
  trigger, RLS policies).
- Edge Functions `invite-user` and `delete-user` deployed.
- `js/supabase.js` already points at this project's URL + anon key.

If you're pointing this code at a **different** Supabase project, follow the steps below.

---

## Setup From Scratch (new Supabase project)

### 1. Create a Supabase Project
[supabase.com](https://supabase.com) → **New Project**.

### 2. Run the SQL Schema
Supabase Dashboard → **SQL Editor** → paste all of `supabase-schema.sql` → **Run**.

### 3. Deploy the Edge Functions
Using the Supabase CLI:
```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy invite-user
supabase functions deploy delete-user
```
No secrets to set manually — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the Edge Runtime.

### 4. Configure the Frontend
Open `js/supabase.js` and set:
```js
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...your-anon-key...';
```
Both values are in Supabase → **Settings → API**.

### 5. Set the redirect URL for invites
Supabase Dashboard → **Authentication → URL Configuration** → add the URL where
`set-password.html` will be served (e.g. `http://localhost:3000/set-password.html` or
your production domain) to **Redirect URLs**.

### 6. Create the First Coach Account
1. Supabase Dashboard → **Authentication → Users → Add user → Send invite** (your email).
2. Complete sign-up from the invite email (lands on `set-password.html`, sets a password,
   logs you in automatically).
3. In **SQL Editor**, promote yourself to coach:
   ```sql
   update public.profiles set role = 'coach' where email = 'you@example.com';
   ```
4. Sign out and sign back in (or just reload `coach.html`) so the role takes effect.

### 7. Serve the Files
Any static file server works:
```bash
npx serve engine-room-html
# or: python3 -m http.server 3000
# or: VS Code Live Server extension
```

---

## Testing the Full Flow

1. **Create account** — On the landing page, click **Create Account**, fill the form, submit.
   You're redirected straight to `client.html`.
2. **Invite a user** — Sign in as the coach (tap the logo 5×, or go straight to
   `coach.html` if already signed in) → **Clients → Add Client** → fill name + email → submit.
   An invite email is sent via Supabase Auth.
3. **Set password** — Open the invite email, click the link → lands on `set-password.html`
   → choose a password → confirm.
4. **Login** — After setting the password you're automatically signed in and redirected to
   the correct dashboard (client or coach) based on `profiles.role`.
5. **Access dashboard** — Confirm the coach dashboard shows the new client under **Clients**,
   and the client portal shows their assigned plans / check-in form.
6. **Test database operations**:
   - Coach: add a plan to the client → client should see it under **My Plan**.
   - Client: submit a weekly check-in → coach should see it under **Check-ins**.
   - Coach: leave feedback on the check-in → client should see it.
   - Either side: send a chat message → confirm it appears for the other side.
   - Coach: click **Delete** on a client → confirm the auth user, profile, and all their
     plans/check-ins/messages/payments are gone (cascade delete).

---

## Security Notes

- **Anon key only** in client code — the `service_role` key only exists inside the two Edge
  Functions, injected automatically by Supabase, never committed to source.
- **Row Level Security** is enabled on every table (`profiles`, `plans`, `check_ins`,
  `messages`, `payments`).
- Clients can only read/update their own profile and their own data; the coach role can
  read/write everything (single-coach model).
- Passwords are handled entirely by Supabase Auth (bcrypt, never stored manually).
- Recommended: Supabase Dashboard → **Authentication → Policies → Password** → enable
  "Leaked password protection".

---

## CDN Dependencies

| Library                  | Purpose                        |
|---------------------------|---------------------------------|
| `@supabase/supabase-js`  | Auth + database + functions client |
| `lucide`                 | SVG icon set                    |
| `Chart.js`               | Weight progress chart (client)  |
