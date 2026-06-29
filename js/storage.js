// ─── Data layer ─────────────────────────────────────────────────────────────
// All reads (getClients, getPlans, …) are synchronous and read from an
// in-memory cache. Writes (saveClient, savePlan, …) are async: they hit
// Supabase first, then update the cache so the UI re-renders with fresh data.
// loadAllData() populates the cache once at app init.

const cache = {
  clients: [],   // client profiles (role = 'client')
  plans: [],
  checkins: [],
  messages: [],
  payments: [],
  coachId: null,
};

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Mappers: snake_case (DB) <-> camelCase (app) ──────────────────────────
function mapClient(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    goal: row.goal,
    notes: row.notes,
    isActive: row.is_active,
    checkinDay: row.checkin_day,
    createdAt: row.created_at,
  };
}

function mapPlan(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    type: row.type,
    title: row.title,
    content: row.content,
    notes: row.notes ?? '',
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
  };
}

function mapCheckin(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    weekDate: row.week_date,
    weight: row.weight,
    energy: row.energy,
    sleep: row.sleep,
    adherence: row.adherence,
    notes: row.notes ?? '',
    photos: row.photos ?? [],
    coachFeedback: row.coach_feedback ?? '',
    createdAt: row.created_at,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    content: row.content,
    attachment: row.attachment ?? undefined,
    read: row.read,
    createdAt: row.created_at,
  };
}

function mapPayment(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    paidDate: row.paid_date,
    notes: row.notes ?? '',
    createdAt: row.created_at,
  };
}

// ─── Load everything once at app init ──────────────────────────────────────
async function loadAllData() {
  const { data: coach } = await supaGetCoachProfile();
  cache.coachId = coach?.id ?? null;

  const [clientsRes, plansRes, checkinsRes, messagesRes, paymentsRes] = await Promise.all([
    supaGetAllClientProfiles(),
    supaGetPlans(),
    supaGetCheckins(),
    supaGetMessages(),
    supaGetPayments(),
  ]);

  // A transient fetch error must never silently wipe out previously loaded
  // data — only replace each cache slice when its fetch actually succeeded.
  if (!clientsRes.error)  cache.clients  = (clientsRes.data  ?? []).map(mapClient);
  if (!plansRes.error)    cache.plans    = (plansRes.data    ?? []).map(mapPlan);
  if (!checkinsRes.error) cache.checkins = (checkinsRes.data ?? []).map(mapCheckin);
  if (!messagesRes.error) cache.messages = (messagesRes.data ?? []).map(mapMessage);
  if (!paymentsRes.error) cache.payments = (paymentsRes.data ?? []).map(mapPayment);

  const firstError = [clientsRes, plansRes, checkinsRes, messagesRes, paymentsRes]
    .map(r => r.error).find(Boolean);
  if (firstError) throw firstError;
}

function getCoachId() { return cache.coachId; }

// ─── Clients ───────────────────────────────────────────────────────────────
function getClients() { return cache.clients; }
function getClientById(id) { return cache.clients.find(c => c.id === id); }

async function saveClient(client) {
  const { data, error } = await supaUpdateProfile(client.id, {
    name: client.name,
    phone: client.phone,
    goal: client.goal,
    notes: client.notes,
    is_active: client.isActive,
    checkin_day: client.checkinDay,
  });
  if (error) throw error;
  const mapped = mapClient(data);
  const idx = cache.clients.findIndex(c => c.id === mapped.id);
  if (idx >= 0) cache.clients[idx] = mapped; else cache.clients.push(mapped);
  return mapped;
}

// Local-only cache write (no DB call) — used right after signup/login when
// the row already matches what's in the DB.
function cacheUpsertClient(client) {
  const idx = cache.clients.findIndex(c => c.id === client.id);
  if (idx >= 0) cache.clients[idx] = client; else cache.clients.push(client);
}

async function deleteClient(id) {
  const { error } = await supaDeleteUser(id);
  if (error) throw new Error(error);
  cache.clients = cache.clients.filter(c => c.id !== id);
}

// ─── Plans ─────────────────────────────────────────────────────────────────
function getPlans() { return cache.plans; }
function getPlansByClient(clientId) { return cache.plans.filter(p => p.clientId === clientId); }

async function savePlan(plan) {
  const { data, error } = await supaInsertPlan({
    client_id: plan.clientId,
    type: plan.type,
    title: plan.title,
    content: plan.content,
    notes: plan.notes,
    attachments: plan.attachments ?? [],
  });
  if (error) throw error;
  const mapped = mapPlan(data);
  cache.plans.unshift(mapped);
  return mapped;
}

async function deletePlan(id) {
  const { error } = await supaDeletePlan(id);
  if (error) throw error;
  cache.plans = cache.plans.filter(p => p.id !== id);
}

// ─── Check-ins ─────────────────────────────────────────────────────────────
function getCheckins() { return cache.checkins; }

function getCheckinsByClient(clientId) {
  return cache.checkins
    .filter(c => c.clientId === clientId)
    .sort((a, b) => new Date(b.weekDate) - new Date(a.weekDate));
}

function getCheckinForWeek(clientId, weekDate) {
  return cache.checkins.find(c => c.clientId === clientId && c.weekDate === weekDate);
}

async function saveCheckin(checkin) {
  const existing = cache.checkins.find(c => c.id === checkin.id);

  if (existing) {
    const { data, error } = await supaUpdateCheckin(checkin.id, {
      coach_feedback: checkin.coachFeedback,
    });
    if (error) throw error;
    const mapped = mapCheckin(data);
    const idx = cache.checkins.findIndex(c => c.id === mapped.id);
    cache.checkins[idx] = mapped;
    return mapped;
  }

  const { data, error } = await supaInsertCheckin({
    client_id: checkin.clientId,
    week_date: checkin.weekDate,
    weight: checkin.weight,
    energy: checkin.energy,
    sleep: checkin.sleep,
    adherence: checkin.adherence,
    notes: checkin.notes,
    photos: checkin.photos ?? [],
  });
  if (error) throw error;
  const mapped = mapCheckin(data);
  cache.checkins.push(mapped);
  return mapped;
}

// ─── Messages ──────────────────────────────────────────────────────────────
function getMessages() { return cache.messages; }

function getMessageThread(clientId) {
  const coachId = cache.coachId;
  return cache.messages
    .filter(m =>
      (m.senderId === coachId && m.receiverId === clientId) ||
      (m.senderId === clientId && m.receiverId === coachId)
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

async function saveMessage(message) {
  const { data, error } = await supaInsertMessage({
    sender_id: message.senderId,
    receiver_id: message.receiverId,
    content: message.content,
    attachment: message.attachment ?? null,
    read: false,
  });
  if (error) throw error;
  const mapped = mapMessage(data);
  cache.messages.push(mapped);
  return mapped;
}

async function markMessagesRead(clientId) {
  const coachId = cache.coachId;
  const { error } = await supaMarkMessagesRead(clientId, coachId);
  if (error) throw error;
  cache.messages = cache.messages.map(m =>
    (m.senderId === clientId && m.receiverId === coachId) ? { ...m, read: true } : m
  );
}

function getUnreadCount(clientId) {
  const coachId = cache.coachId;
  return cache.messages.filter(m => m.senderId === coachId && m.receiverId === clientId && !m.read).length;
}

function getClientUnreadCount(clientId) {
  return getUnreadCount(clientId);
}

// ─── Payments ──────────────────────────────────────────────────────────────
function getPayments() { return cache.payments; }

function getPaymentsByClient(clientId) {
  return cache.payments
    .filter(p => p.clientId === clientId)
    .sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate));
}

async function savePayment(payment) {
  const { data, error } = await supaInsertPayment({
    client_id: payment.clientId,
    amount: payment.amount,
    currency: payment.currency ?? 'USD',
    status: payment.status ?? 'paid',
    paid_date: payment.paidDate,
    notes: payment.notes ?? '',
  });
  if (error) throw error;
  const mapped = mapPayment(data);
  cache.payments.unshift(mapped);
  return mapped;
}

// ─── Utils ─────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getWeekStart(date = new Date()) {
  const d   = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function goalLabel(goal) {
  return { bulk: 'Bulk', cut: 'Cut', maintain: 'Maintain' }[goal] ?? goal;
}

function goalColor(goal) {
  return { bulk: '#22c55e', cut: '#ef4444', maintain: '#3b82f6' }[goal] ?? '#71717a';
}

// ─── Photo resize ──────────────────────────────────────────────────────────
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 960;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
        else { width = Math.round((width / height) * MAX); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
    img.src = url;
  });
}

// ─── Toast ─────────────────────────────────────────────────────────────────
function toast(msg, type = 'default') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ─── Lucide icon helper ────────────────────────────────────────────────────
function icon(name, size = 16, style = '') {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px;vertical-align:middle;${style}"></i>`;
}

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}
