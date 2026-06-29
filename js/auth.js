// ─── Auth module ───────────────────────────────────────────────────────────
// Supabase Auth is the ONLY source of truth for who is logged in. The
// session itself is persisted by the supabase-js client (in its own
// localStorage key) — that's Supabase's mechanism, not a custom one. We
// never store credentials, session flags, or "logged in" pointers ourselves.
//
// Profiles are created automatically by a DB trigger (handle_new_user) when
// a row is inserted into auth.users — see supabase-schema.sql. We just wait
// for it to appear and read it back.

function profileToClient(profile) {
  return {
    id:         profile.id,
    name:       profile.name,
    email:      profile.email,
    phone:      profile.phone ?? '',
    goal:       profile.goal,
    notes:      profile.notes ?? '',
    isActive:   profile.is_active,
    checkinDay: profile.checkin_day ?? 1,
    createdAt:  profile.created_at,
  };
}

// Trigger-created row may lag the signUp response by a beat — poll briefly.
async function waitForProfile(userId, attempts = 5, delayMs = 400) {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supaGetProfile(userId);
    if (!error && data) return data;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}

// Turns Supabase's deliberately generic "Invalid login credentials" into a
// precise message via a read-only existence check. Every other error
// (unconfirmed email, rate limiting, network, etc.) is passed through
// honestly instead of being swallowed, so real failures are debuggable.
async function describeSignInError(email, error) {
  const msg = (error.message || '').toLowerCase();

  if (msg.includes('invalid login credentials')) {
    const exists = await supaCheckEmailExists(email);
    if (exists === true)  return 'Incorrect password.';
    if (exists === false) return 'Account does not exist.';
    return 'Account does not exist or password is incorrect.'; // existence check itself failed
  }

  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email before signing in. Check your inbox for the confirmation link.';
  }

  return error.message;
}

async function signUpClient({ email, password, name, phone, goal, notes }) {
  const { data, error } = await supaSignUp(email, password, {
    name, phone, goal, notes, role: 'client',
  });

  if (error) {
    const msg = error.message.toLowerCase().includes('already registered')
      ? 'An account with this email already exists. Sign in instead.'
      : error.message;
    return { error: msg };
  }
  if (!data.user) return { error: 'Sign-up failed. Please try again.' };

  const profile = await waitForProfile(data.user.id);
  if (!profile) {
    return { error: 'Account created, but profile setup is still finishing. Please sign in again in a moment.' };
  }

  cacheUpsertClient(profileToClient(profile));
  return { id: profile.id };
}

async function signInClient(email, password) {
  const { data, error } = await supaSignIn(email, password);

  if (error) return { error: await describeSignInError(email, error) };
  if (!data.user) return { error: 'Sign-in failed. Please try again.' };

  const { data: profile, error: profileError } = await supaGetProfile(data.user.id);

  if (profileError || !profile) {
    await supaSignOut();
    return { error: 'Profile not found. Please create an account.' };
  }

  if (profile.role === 'coach') {
    await supaSignOut();
    return { error: 'This is a coach account. Use the coach portal.' };
  }

  if (!profile.is_active) {
    await supaSignOut();
    return { error: 'Your account is inactive. Contact your coach.' };
  }

  cacheUpsertClient(profileToClient(profile));
  return { id: profile.id };
}

async function signInCoach(email, password) {
  const { data, error } = await supaSignIn(email, password);

  if (error) return { error: await describeSignInError(email, error) };
  if (!data.user) return { error: 'Sign-in failed.' };

  const { data: profile } = await supaGetProfile(data.user.id);
  if (!profile || profile.role !== 'coach') {
    await supaSignOut();
    return { error: 'No coach account found for this email.' };
  }

  return { ok: true };
}

async function signOutClient() {
  await supaSignOut();
}

async function signOutCoach() {
  await supaSignOut();
}

// Reads the live Supabase session (not anything we stored ourselves) and
// resolves the signed-in user's role + profile.
async function restoreSession() {
  const { data } = await supaGetSession();
  if (!data.session?.user) return null;

  const { data: profile } = await supaGetProfile(data.session.user.id);
  if (!profile) return null;

  if (profile.role === 'client') {
    cacheUpsertClient(profileToClient(profile));
    return { role: 'client', id: profile.id };
  }

  if (profile.role === 'coach') {
    return { role: 'coach', id: profile.id, name: profile.name, email: profile.email };
  }

  return null;
}
