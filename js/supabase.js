// ─── Supabase Configuration ────────────────────────────────────────────────
// Replace these with your actual Supabase project values from:
// Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://xafvocnrepuuvxgaquil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhZnZvY25yZXB1dXZ4Z2FxdWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2Nzg3OTgsImV4cCI6MjA5ODI1NDc5OH0.Kl0lOPcFK_Q9cv_FVDJ2Bb_bC5UDAAI_rZhWgN-RXX0';

// Initialize the Supabase client using the CDN version
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Auth helpers ──────────────────────────────────────────────────────────
async function supaSignUp(email, password) {
  return sb.auth.signUp({ email, password });
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
async function supaInsertProfile(profile) {
  return sb.from('profiles').insert(profile);
}

async function supaGetProfile(userId) {
  return sb.from('profiles').select('*').eq('id', userId).single();
}

async function supaUpdateProfile(userId, updates) {
  return sb.from('profiles').update(updates).eq('id', userId);
}

// ─── Coach helpers (reads all profiles — requires coach RLS policy) ────────
async function supaGetAllProfiles() {
  return sb.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false });
}
