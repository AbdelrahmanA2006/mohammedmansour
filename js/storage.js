// ─── localStorage keys ─────────────────────────────────────────────────────
const KEYS = {
  clients:      'cd_clients',
  plans:        'cd_plans',
  checkins:     'cd_checkins',
  messages:     'cd_messages',
  payments:     'cd_payments',
  activeClient: 'cd_active_client',
};

// ─── Generic helpers ───────────────────────────────────────────────────────
function lsRead(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function lsWrite(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Active client ─────────────────────────────────────────────────────────
function getActiveClientId() { return localStorage.getItem(KEYS.activeClient); }
function setActiveClientId(id) { localStorage.setItem(KEYS.activeClient, id); }

// ─── Clients ───────────────────────────────────────────────────────────────
function getClients() { return lsRead(KEYS.clients); }

function saveClient(client) {
  const list = getClients();
  const idx  = list.findIndex(c => c.id === client.id);
  if (idx >= 0) list[idx] = client; else list.push(client);
  lsWrite(KEYS.clients, list);
}

function deleteClient(id) {
  lsWrite(KEYS.clients, getClients().filter(c => c.id !== id));
}

function getClientById(id) {
  return getClients().find(c => c.id === id);
}

// ─── Plans ─────────────────────────────────────────────────────────────────
function getPlans() {
  return lsRead(KEYS.plans).map(p => ({
    ...p,
    notes: p.notes ?? '',
    attachments: p.attachments ?? [],
  }));
}

function getPlansByClient(clientId) {
  return getPlans().filter(p => p.clientId === clientId);
}

function savePlan(plan) {
  const list = getPlans();
  const idx  = list.findIndex(p => p.id === plan.id);
  if (idx >= 0) list[idx] = plan; else list.push(plan);
  lsWrite(KEYS.plans, list);
}

function deletePlan(id) {
  lsWrite(KEYS.plans, getPlans().filter(p => p.id !== id));
}

// ─── Check-ins ─────────────────────────────────────────────────────────────
function getCheckins() { return lsRead(KEYS.checkins); }

function getCheckinsByClient(clientId) {
  return getCheckins()
    .filter(c => c.clientId === clientId)
    .sort((a, b) => new Date(b.weekDate) - new Date(a.weekDate));
}

function saveCheckin(checkin) {
  const list = getCheckins();
  const idx  = list.findIndex(c => c.id === checkin.id);
  if (idx >= 0) list[idx] = checkin; else list.push(checkin);
  lsWrite(KEYS.checkins, list);
}

function getCheckinForWeek(clientId, weekDate) {
  return getCheckins().find(c => c.clientId === clientId && c.weekDate === weekDate);
}

// ─── Messages ──────────────────────────────────────────────────────────────
function getMessages() { return lsRead(KEYS.messages); }

function getMessageThread(clientId) {
  return getMessages()
    .filter(m =>
      (m.senderId === 'coach' && m.receiverId === clientId) ||
      (m.senderId === clientId && m.receiverId === 'coach')
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function saveMessage(message) {
  const list = getMessages();
  list.push(message);
  lsWrite(KEYS.messages, list);
}

function markMessagesRead(clientId) {
  const msgs = getMessages().map(m => {
    if (m.senderId === clientId && m.receiverId === 'coach') return { ...m, read: true };
    return m;
  });
  lsWrite(KEYS.messages, msgs);
}

function getUnreadCount(clientId) {
  return getMessages().filter(
    m => m.senderId === 'coach' && m.receiverId === clientId && !m.read
  ).length;
}

function getClientUnreadCount(clientId) {
  return getMessages().filter(
    m => m.senderId === 'coach' && m.receiverId === clientId && !m.read
  ).length;
}

// ─── Payments ──────────────────────────────────────────────────────────────
function getPayments() { return lsRead(KEYS.payments); }

function getPaymentsByClient(clientId) {
  return getPayments()
    .filter(p => p.clientId === clientId)
    .sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate));
}

function savePayment(payment) {
  const list = getPayments();
  const idx  = list.findIndex(p => p.id === payment.id);
  if (idx >= 0) list[idx] = payment; else list.push(payment);
  lsWrite(KEYS.payments, list);
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

// Refresh all lucide icons in the DOM
function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}
