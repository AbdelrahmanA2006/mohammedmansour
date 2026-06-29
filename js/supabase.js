// ─── Supabase Configuration ────────────────────────────────────────────────
// Anon key only — safe to expose in client code. Never put the service_role
// key here; privileged operations (invite/delete) go through Edge Functions.
const SUPABASE_URL = 'https://xafvocnrepuuvxgaquil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhZnZvY25yZXB1dXZ4Z2FxdWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2Nzg3OTgsImV4cCI6MjA5ODI1NDc5OH0.Kl0lOPcFK_Q9cv_FVDJ2Bb_bC5UDAAI_rZhWgN-RXX0';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Auth helpers ──────────────────────────────────────────────────────────
async function supaSignUp(email, password, metadata = {}) {
  return sb.auth.signUp({ email, password, options: { data: metadata } });
}

async function supaSignIn(email, password) {
  return sb.auth.signInWithPassword({ email, password });
}

async function supaSignOut() {
  return sb.auth.signOut();
}

async function supaGetSession() {
  return sb.auth.getSession();
}

async function supaGetUser() {
  const { data } = await sb.auth.getUser();
  return data?.user ?? null;
}

// ─── Profile CRUD ──────────────────────────────────────────────────────────
async function supaGetProfile(userId) {
  return sb.from('profiles').select('*').eq('id', userId).single();
}

async function supaUpdateProfile(userId, updates) {
  return sb.from('profiles').update(updates).eq('id', userId).select().single();
}

// Coach-only: every client profile
async function supaGetAllClientProfiles() {
  return sb.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false });
}

// Single-coach app: fetch the one coach profile
async function supaGetCoachProfile() {
  return sb.from('profiles').select('*').eq('role', 'coach').limit(1).maybeSingle();
}

// ─── Plans ─────────────────────────────────────────────────────────────────
async function supaGetPlans() {
  return sb.from('plans').select('*').order('created_at', { ascending: false });
}

async function supaInsertPlan(plan) {
  return sb.from('plans').insert(plan).select().single();
}

async function supaDeletePlan(id) {
  return sb.from('plans').delete().eq('id', id);
}

// ─── Check-ins ─────────────────────────────────────────────────────────────
async function supaGetCheckins() {
  return sb.from('check_ins').select('*').order('week_date', { ascending: false });
}

async function supaInsertCheckin(checkin) {
  return sb.from('check_ins').insert(checkin).select().single();
}

async function supaUpdateCheckin(id, updates) {
  return sb.from('check_ins').update(updates).eq('id', id).select().single();
}

// ─── Messages ──────────────────────────────────────────────────────────────
async function supaGetMessages() {
  return sb.from('messages').select('*').order('created_at', { ascending: true });
}

async function supaInsertMessage(message) {
  return sb.from('messages').insert(message).select().single();
}

async function supaMarkMessagesRead(senderId, receiverId) {
  return sb.from('messages').update({ read: true })
    .eq('sender_id', senderId).eq('receiver_id', receiverId).eq('read', false);
}

// ─── Payments ──────────────────────────────────────────────────────────────
async function supaGetPayments() {
  return sb.from('payments').select('*').order('paid_date', { ascending: false });
}

async function supaInsertPayment(payment) {
  return sb.from('payments').insert(payment).select().single();
}

// ─── Edge Functions (privileged ops — service_role stays server-side) ─────
async function supaInviteUser({ email, name, phone, goal, notes, role, redirectTo }) {
  const { data, error } = await sb.functions.invoke('invite-user', {
    body: { email, name, phone, goal, notes, role, redirectTo },
  });
  if (error) return { error: error.message || 'Failed to send invite.' };
  if (data?.error) return { error: data.error };
  return { ok: true, userId: data?.userId };
}

async function supaDeleteUser(userId) {
  const { data, error } = await sb.functions.invoke('delete-user', {
    body: { userId },
  });
  if (error) return { error: error.message || 'Failed to delete user.' };
  if (data?.error) return { error: data.error };
  return { ok: true };
}

// Read-only existence check (no password involved) — used only to turn a
// failed sign-in's generic "Invalid login credentials" into a precise
// "Account does not exist." vs "Incorrect password." message.
async function supaCheckEmailExists(email) {
  const { data, error } = await sb.functions.invoke('check-email-exists', {
    body: { email },
  });
  if (error || data?.error) return null; // unknown — caller falls back to a generic message
  return !!data?.exists;
}
