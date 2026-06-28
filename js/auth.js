// ─── Auth module ───────────────────────────────────────────────────────────
// Wraps Supabase auth + syncs to localStorage for offline-first reads.

async function signUpClient({ email, password, name, phone, goal, notes }) {
  const { data, error } = await supaSignUp(email, password);

  if (error) {
    const msg = error.message.toLowerCase().includes('already registered')
      ? 'An account with this email already exists. Sign in instead.'
      : error.message;
    return { error: msg };
  }
  if (!data.user) return { error: 'Sign-up failed. Please try again.' };

  // Insert profile row
  const { error: profileError } = await supaInsertProfile({
    id: data.user.id,
    name,
    email: email.toLowerCase().trim(),
    phone,
    goal,
    notes,
    role: 'client',
    is_active: true,
    checkin_day: 1,
  });

  if (profileError) {
    await supaSignOut();
    return { error: 'Failed to save your profile. Please try again.' };
  }

  // Sync to localStorage
  const client = {
    id:         data.user.id,
    name,
    email:      email.toLowerCase().trim(),
    phone,
    goal,
    notes,
    isActive:   true,
    createdAt:  new Date().toISOString(),
  };
  saveClient(client);
  setActiveClientId(client.id);

  return { id: client.id };
}

async function signInClient(email, password) {
  const { data, error } = await supaSignUp(email, password);

console.log("SIGNUP DATA:", data);
console.log("SIGNUP ERROR:", error);

  if (error) return { error: 'Incorrect email or password.' };
  if (!data.user) return { error: 'Sign-in failed. Please try again.' };

  const { data: profile, error: profileError } = await supaGetProfile(data.user.id);

  if (profileError || !profile) {
    await supaSignOut();
    return { error: 'Profile not found. Please create an account.' };
  }

  if (profile.role === 'coach') {
    // Coach should go through coach login, not client login
    await supaSignOut();
    return { error: 'This is a coach account. Use the coach portal.' };
  }

  if (!profile.is_active) {
    await supaSignOut();
    return { error: 'Your account is inactive. Contact your coach.' };
  }

  const client = {
    id:         data.user.id,
    name:       profile.name,
    email:      data.user.email,
    phone:      profile.phone ?? '',
    goal:       profile.goal,
    notes:      profile.notes ?? '',
    isActive:   profile.is_active,
    checkinDay: profile.checkin_day ?? 1,
    createdAt:  profile.created_at,
  };
  saveClient(client);
  setActiveClientId(client.id);

  return { id: client.id };
}

async function signInCoach(email, password) {
  const { data, error } = await supaSignIn(email, password);

  if (error) return { error: 'Incorrect email or password.' };
  if (!data.user) return { error: 'Sign-in failed.' };

  const { data: profile } = await supaGetProfile(data.user.id);
  if (!profile || profile.role !== 'coach') {
    await supaSignOut();
    return { error: 'No coach account found for this email.' };
  }

  sessionStorage.setItem('cd_coach_session', JSON.stringify({ id: data.user.id, email: data.user.email, name: profile.name }));
  return { ok: true };
}

async function signOutClient() {
  await supaSignOut();
  localStorage.removeItem('cd_active_client');
}

async function signOutCoach() {
  await supaSignOut();
  sessionStorage.removeItem('cd_coach_session');
}

async function restoreSession() {
  const { data } = await supaGetSession();
  if (!data.session?.user) return null;

  const { data: profile } = await supaGetProfile(data.session.user.id);
  if (!profile) return null;

  if (profile.role === 'client') {
    const client = {
      id:         data.session.user.id,
      name:       profile.name,
      email:      data.session.user.email,
      phone:      profile.phone ?? '',
      goal:       profile.goal,
      notes:      profile.notes ?? '',
      isActive:   profile.is_active,
      checkinDay: profile.checkin_day ?? 1,
      createdAt:  profile.created_at,
    };
    saveClient(client);
    setActiveClientId(client.id);
    return { role: 'client', id: client.id };
  }

  if (profile.role === 'coach') {
    sessionStorage.setItem('cd_coach_session', JSON.stringify({ id: data.session.user.id, email: data.session.user.email, name: profile.name }));
    return { role: 'coach' };
  }

  return null;
}

function getCoachSession() {
  try { return JSON.parse(sessionStorage.getItem('cd_coach_session') || 'null'); } catch { return null; }
}
