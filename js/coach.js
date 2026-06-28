// ─── Coach app module ──────────────────────────────────────────────────────

let currentClientId = null;  // for client detail view
let chatActiveClientId = null;
let planAttachments = [];
let feedbackCheckinId = null;
let pendingImage = null;     // for messages

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const PLAN_META = {
  workout:    { label: 'Workout',    color: '#3b82f6', icon: 'dumbbell' },
  nutrition:  { label: 'Nutrition',  color: '#22c55e', icon: 'apple' },
  supplement: { label: 'Supplement', color: '#a855f7', icon: 'pill' },
};

// ─── Navigation ────────────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.remove('active','active-blue');
  });
  const sec = document.getElementById('sec-' + name.replace('-', '-'));
  if (sec) sec.classList.add('active');
  const nav = document.querySelector(`[data-section="${name}"]`);
  if (nav) nav.classList.add('active','active-blue');

  // Load section data
  if (name === 'overview')  renderOverview();
  if (name === 'clients')   renderClients();
  if (name === 'plans')     renderAllPlans();
  if (name === 'checkins')  renderAllCheckins();
  if (name === 'messages')  renderMessages();
  refreshIcons();
}

// ─── Modals ────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); refreshIcons(); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// backdrop click
document.querySelectorAll && document.addEventListener('DOMContentLoaded', () => {});
window.addEventListener('click', (e) => {
  ['add-client-modal','add-plan-modal','feedback-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) closeModal(id);
  });
});

// ─── Init ──────────────────────────────────────────────────────────────────
function initCoachApp() {
  // Nav
  document.getElementById('coach-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-section]');
    if (btn) showSection(btn.dataset.section);
  });

  // Sign out
  document.getElementById('coach-signout-btn').addEventListener('click', async () => {
    await signOutCoach();
    window.location.href = 'index.html';
  });

  // Add client
  document.getElementById('add-client-btn').addEventListener('click', () => openModal('add-client-modal'));
  document.getElementById('ac-submit-btn').addEventListener('click', handleAddClient);

  // Add plan
  document.getElementById('plan-submit-btn').addEventListener('click', handleAddPlan);
  document.getElementById('plan-file-input').addEventListener('change', handlePlanFile);

  // Feedback
  document.getElementById('feedback-submit-btn').addEventListener('click', handleFeedback);

  // Search
  document.getElementById('clients-search').addEventListener('input', renderClients);

  // Detail tabs
  document.getElementById('tab-plans-btn').addEventListener('click', () => switchDetailTab('plans'));
  document.getElementById('tab-checkins-btn').addEventListener('click', () => switchDetailTab('checkins'));

  renderOverview();
}

// ══════════════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════════════
function renderOverview() {
  const clients  = getClients();
  const plans    = getPlans();
  const checkins = getCheckins();
  const active   = clients.filter(c => c.isActive).length;
  const pending  = checkins.filter(c => !c.coachFeedback).length;

  // Stats
  document.getElementById('overview-stats').innerHTML = `
    ${statCard('Active Clients', active, 'users', '#3b82f6')}
    ${statCard('Total Plans', plans.length, 'clipboard-list', '#22c55e')}
    ${statCard('Pending Reviews', pending, 'check-square', '#f59e0b', 'Check-ins awaiting feedback')}
  `;

  // Clients list
  const clientsEl = document.getElementById('overview-clients-list');
  if (!clients.length) { clientsEl.innerHTML = `<p style="color:var(--muted-foreground);font-size:14px;padding:12px 0">No clients yet.</p>`; }
  else {
    clientsEl.innerHTML = clients.map(c => `
      <div onclick="openClientDetail('${c.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="avatar avatar-md" style="background:${goalColor(c.goal)}22;color:${goalColor(c.goal)}">${c.name[0]}</div>
          <div>
            <div style="font-weight:600;color:var(--text);font-size:14px">${c.name}</div>
            <div style="font-size:12px;color:var(--muted-foreground)">${c.phone || c.email || ''}</div>
          </div>
        </div>
        <span class="badge badge-${c.goal}">${goalLabel(c.goal)}</span>
      </div>
    `).join('');
  }

  // Recent check-ins
  const ciEl = document.getElementById('overview-checkins-list');
  const recent = [...checkins]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  if (!recent.length) { ciEl.innerHTML = `<p style="color:var(--muted-foreground);font-size:14px;padding:12px 0">No check-ins yet.</p>`; }
  else {
    ciEl.innerHTML = recent.map(ci => {
      const client = getClientById(ci.clientId);
      return `
        <div style="padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-weight:600;color:var(--text);font-size:14px">${client?.name ?? 'Unknown'}</div>
              <div style="font-size:12px;color:var(--muted-foreground);display:flex;gap:12px;margin-top:3px">
                <span>⚖️ ${ci.weight}kg</span><span>⚡ ${ci.energy}/10</span><span>📋 ${ci.adherence}/10</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:11px;color:var(--muted-foreground)">${formatDate(ci.weekDate)}</span>
              ${!ci.coachFeedback ? `<span class="badge badge-review">Needs review</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  refreshIcons();
}

function statCard(label, value, iconName, color, sub = '') {
  return `
    <div class="stat-card">
      <div class="stat-icon" style="background:${color}22">
        <i data-lucide="${iconName}" style="width:20px;height:20px;color:${color}"></i>
      </div>
      <div>
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
        ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
// CLIENTS LIST
// ══════════════════════════════════════════════════════════════
function renderClients() {
  const filter = (document.getElementById('clients-search')?.value || '').toLowerCase();
  const clients = getClients().filter(c =>
    c.name.toLowerCase().includes(filter) ||
    (c.goal || '').includes(filter)
  );

  document.getElementById('clients-count-label').textContent =
    `${getClients().length} total client${getClients().length !== 1 ? 's' : ''}`;

  if (!clients.length) {
    document.getElementById('clients-table-wrap').innerHTML = `
      <div class="empty-state">
        <i data-lucide="users" style="width:40px;height:40px"></i>
        <div class="empty-title">No clients yet</div>
        <div class="empty-sub">Add your first client to get started.</div>
      </div>
    `;
    refreshIcons(); return;
  }

  document.getElementById('clients-table-wrap').innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Client</th><th>Phone</th><th>Goal</th><th>Status</th><th>Joined</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${clients.map(c => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:12px">
                  <div class="avatar avatar-md" style="background:${goalColor(c.goal)}22;color:${goalColor(c.goal)}">${c.name[0]}</div>
                  <div>
                    <div style="font-weight:600;color:var(--text);font-size:14px">${c.name}</div>
                    ${c.notes ? `<div style="font-size:12px;color:var(--muted-foreground);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.notes}</div>` : ''}
                  </div>
                </div>
              </td>
              <td style="color:var(--muted-foreground);font-size:14px">${c.phone || '—'}</td>
              <td><span class="badge badge-${c.goal}">${goalLabel(c.goal)}</span></td>
              <td><span class="badge ${c.isActive ? 'badge-active' : 'badge-archived'}">${c.isActive ? 'Active' : 'Archived'}</span></td>
              <td style="color:var(--muted-foreground);font-size:14px">${formatDate(c.createdAt)}</td>
              <td>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-secondary btn-sm" onclick="openClientDetail('${c.id}')">
                    <i data-lucide="eye" style="width:13px;height:13px"></i> View
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="handleDeleteClient('${c.id}','${c.name}')">
                    <i data-lucide="trash-2" style="width:13px;height:13px"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  refreshIcons();
}

// ─── Add client ───────────────────────────────────────────────────────────
function handleAddClient() {
  const name  = document.getElementById('ac-name').value.trim();
  const email = document.getElementById('ac-email').value.trim();
  const phone = document.getElementById('ac-phone').value.trim();
  const goal  = document.getElementById('ac-goal').value;
  const notes = document.getElementById('ac-notes').value.trim();

  if (!name) { toast('Name is required', 'error'); return; }

  const client = {
    id: generateId(), name, email: email || undefined, phone, goal, notes,
    isActive: true, createdAt: new Date().toISOString(),
  };
  saveClient(client);
  closeModal('add-client-modal');
  document.getElementById('ac-name').value = '';
  document.getElementById('ac-email').value = '';
  document.getElementById('ac-phone').value = '';
  document.getElementById('ac-notes').value = '';
  document.getElementById('ac-goal').value = 'bulk';
  renderClients();
  toast(`${name} added successfully!`, 'success');
}

function handleDeleteClient(id, name) {
  if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
  deleteClient(id);
  renderClients();
  toast(`${name} deleted`, 'info');
}

// ══════════════════════════════════════════════════════════════
// CLIENT DETAIL
// ══════════════════════════════════════════════════════════════
function openClientDetail(id) {
  currentClientId = id;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active','active-blue'));
  document.getElementById('sec-client-detail').classList.add('active');
  renderClientDetail(id);
  refreshIcons();
}

function renderClientDetail(id) {
  const client   = getClientById(id);
  if (!client) { document.getElementById('detail-profile-card').innerHTML = '<p style="color:var(--muted-foreground)">Client not found.</p>'; return; }

  const plans    = getPlansByClient(id);
  const checkins = getCheckinsByClient(id);

  // Page header
  document.getElementById('detail-page-header').innerHTML = `
    <div class="page-header-left">
      <h1>${client.name}</h1>
      <p>${client.phone || ''} ${client.phone && client.goal ? '·' : ''} ${goalLabel(client.goal)} goal</p>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn ${client.isActive ? 'btn-secondary' : 'btn-green'} btn-sm"
        onclick="toggleClientArchive('${id}')">
        ${client.isActive ? 'Archive' : 'Reactivate'}
      </button>
      <button class="btn btn-primary btn-sm" onclick="openAddPlan('${id}')">
        <i data-lucide="plus" style="width:14px;height:14px"></i> Add Plan
      </button>
    </div>
  `;

  // Profile card
  const checkinDay = client.checkinDay ?? 1;
  document.getElementById('detail-profile-card').innerHTML = `
    <div style="display:flex;gap:24px;flex-wrap:wrap">
      <div class="avatar avatar-xl" style="background:${goalColor(client.goal)}22;color:${goalColor(client.goal)}">${client.name[0]}</div>
      <div style="flex:1">
        <div class="meta-row">
          <div class="meta-item">
            <div class="meta-item-label">Goal</div>
            <span class="badge badge-${client.goal}">${goalLabel(client.goal)}</span>
          </div>
          <div class="meta-item">
            <div class="meta-item-label">Status</div>
            <span class="badge ${client.isActive ? 'badge-active' : 'badge-archived'}">${client.isActive ? 'Active' : 'Archived'}</span>
          </div>
          <div class="meta-item">
            <div class="meta-item-label">Joined</div>
            <div class="meta-item-value">${formatDate(client.createdAt)}</div>
          </div>
          <div class="meta-item">
            <div class="meta-item-label">Check-ins</div>
            <div class="meta-item-value">${checkins.length} total</div>
          </div>
        </div>
        ${client.notes ? `<p style="color:var(--muted-foreground);font-size:14px;line-height:1.6;margin-bottom:16px">${client.notes}</p>` : ''}
        <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:${client.notes ? '0' : '0'}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <i data-lucide="calendar" style="width:14px;height:14px;color:var(--muted-foreground)"></i>
            <span style="font-size:12px;font-weight:600;color:var(--muted-foreground);text-transform:uppercase;letter-spacing:0.05em">Check-in Day</span>
          </div>
          <div class="day-pills">
            ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i) => `
              <button class="day-pill ${checkinDay === i ? 'active' : ''}"
                onclick="setClientCheckinDay('${id}', ${i})">${d}</button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Render plans
  renderDetailPlans(plans);

  // Render checkins
  renderDetailCheckins(checkins, client);

  refreshIcons();
}

function renderDetailPlans(plans) {
  const el = document.getElementById('detail-plans-content');
  if (!plans.length) {
    el.innerHTML = `<div style="color:var(--muted-foreground);text-align:center;padding:40px">No plans yet. Add one above.</div>`;
    return;
  }
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px">${plans.map(p => {
    const meta = PLAN_META[p.type];
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px">
            <i data-lucide="${meta.icon}" style="width:18px;height:18px;color:${meta.color}"></i>
            <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text)">${p.title}</h3>
          </div>
          <span class="badge" style="background:${meta.color}22;color:${meta.color}">${meta.label}</span>
        </div>
        <pre style="margin:0;font-size:13px;color:var(--muted-foreground);white-space:pre-wrap;font-family:inherit;line-height:1.6">${p.content}</pre>
        ${p.notes ? `<div style="margin-top:12px;font-size:13px;color:var(--muted-foreground);font-style:italic;border-top:1px solid var(--border);padding-top:12px">📝 ${p.notes}</div>` : ''}
        ${renderAttachments(p.attachments, meta.color)}
        <div style="margin-top:10px;font-size:11px;color:#3f3f3f">Created ${formatDate(p.createdAt)}</div>
      </div>
    `;
  }).join('')}</div>`;
  refreshIcons();
}

function renderDetailCheckins(checkins, client) {
  const el = document.getElementById('detail-checkins-content');
  if (!checkins.length) {
    el.innerHTML = `<div style="color:var(--muted-foreground);text-align:center;padding:40px">No check-ins submitted yet.</div>`;
    return;
  }
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px">${checkins.map(ci => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <div style="font-weight:700;color:var(--text);font-size:15px">Week of ${formatDate(ci.weekDate)}</div>
          <div style="font-size:12px;color:var(--muted-foreground);margin-top:4px">Submitted ${formatDate(ci.createdAt)}</div>
        </div>
        ${!ci.coachFeedback ? `
          <button class="btn btn-primary btn-sm" onclick="openFeedback('${ci.id}','${formatDate(ci.weekDate)}')">
            <i data-lucide="edit-2" style="width:13px;height:13px"></i> Leave Feedback
          </button>
        ` : ''}
      </div>
      <div class="mini-stats">
        ${[['Weight',`${ci.weight}kg`],['Energy',`${ci.energy}/10`],['Sleep',`${ci.sleep}/10`],['Adherence',`${ci.adherence}/10`]].map(([l,v]) => `
          <div class="mini-stat"><div class="mini-stat-label">${l}</div><div class="mini-stat-value">${v}</div></div>
        `).join('')}
      </div>
      ${ci.photos?.length ? `
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          ${ci.photos.map((src,i) => `
            <div class="photo-thumb" onclick="openLightbox('${src}')">
              <img src="${src}" alt="Photo ${i+1}" />
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${ci.notes ? `<p style="margin:0 0 12px;font-size:14px;color:var(--muted-foreground);font-style:italic">"${ci.notes}"</p>` : ''}
      ${ci.coachFeedback ? `
        <div class="feedback-block">
          <div class="feedback-label" style="color:var(--accent)">Coach Feedback</div>
          <p style="margin:0;font-size:14px;color:var(--text);line-height:1.6">${ci.coachFeedback}</p>
        </div>
      ` : ''}
    </div>
  `).join('')}</div>`;
  refreshIcons();
}

function switchDetailTab(tab) {
  const isPlans = tab === 'plans';
  document.getElementById('detail-plans-content').style.display   = isPlans ? '' : 'none';
  document.getElementById('detail-checkins-content').style.display = isPlans ? 'none' : '';
  document.getElementById('tab-plans-btn').classList.toggle('active-blue', isPlans);
  document.getElementById('tab-checkins-btn').classList.toggle('active-blue', !isPlans);
}

function toggleClientArchive(id) {
  const c = getClientById(id);
  if (!c) return;
  saveClient({ ...c, isActive: !c.isActive });
  renderClientDetail(id);
  toast(c.isActive ? 'Client archived' : 'Client reactivated', 'info');
}

function setClientCheckinDay(id, day) {
  const c = getClientById(id);
  if (!c) return;
  saveClient({ ...c, checkinDay: day });
  renderClientDetail(id);
  toast(`Check-in day set to ${DAY_NAMES[day]}`, 'success');
}

// ══════════════════════════════════════════════════════════════
// PLANS (coach view — all plans)
// ══════════════════════════════════════════════════════════════
function renderAllPlans() {
  const plans = getPlans();
  const clients = getClients();
  const el = document.getElementById('all-plans-list');

  if (!plans.length) {
    el.innerHTML = `<div class="empty-state">
      <i data-lucide="clipboard-list" style="width:40px;height:40px"></i>
      <div class="empty-title">No plans yet</div>
      <div class="empty-sub">Add plans from a client's profile page.</div>
    </div>`;
    refreshIcons(); return;
  }

  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">${plans.map(p => {
    const meta   = PLAN_META[p.type];
    const client = clients.find(c => c.id === p.clientId);
    return `
      <div class="card" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="width:36px;height:36px;border-radius:8px;background:${meta.color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i data-lucide="${meta.icon}" style="width:18px;height:18px;color:${meta.color}"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--text);font-size:14px">${p.title}</div>
          <div style="font-size:12px;color:var(--muted-foreground);margin-top:2px">${client?.name ?? 'Unknown client'} · ${meta.label}</div>
        </div>
        <div style="font-size:12px;color:var(--muted-foreground)">${formatDate(p.createdAt)}</div>
        <button class="btn btn-secondary btn-sm" onclick="openClientDetail('${p.clientId}')">
          <i data-lucide="eye" style="width:13px;height:13px"></i> View Client
        </button>
      </div>
    `;
  }).join('')}</div>`;
  refreshIcons();
}

// ──── Add plan ────────────────────────────────────────────────
function openAddPlan(clientId) {
  currentClientId = clientId;
  planAttachments = [];
  document.getElementById('plan-type').value = 'workout';
  document.getElementById('plan-title').value = '';
  document.getElementById('plan-content').value = '';
  document.getElementById('plan-notes').value = '';
  document.getElementById('plan-attachments-list').innerHTML = '';
  openModal('add-plan-modal');
}

function handleAddPlan() {
  const type    = document.getElementById('plan-type').value;
  const title   = document.getElementById('plan-title').value.trim();
  const content = document.getElementById('plan-content').value.trim();
  const notes   = document.getElementById('plan-notes').value.trim();

  if (!title || !content) { toast('Title and content are required', 'error'); return; }

  savePlan({
    id: generateId(), clientId: currentClientId,
    type, title, content, notes, attachments: planAttachments,
    createdAt: new Date().toISOString(),
  });
  closeModal('add-plan-modal');
  renderClientDetail(currentClientId);
  toast('Plan created!', 'success');
}

async function handlePlanFile(e) {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    planAttachments.push({ id: generateId(), name: file.name, mimeType: file.type, dataUrl, size: file.size });
  }
  renderPlanAttachments();
  e.target.value = '';
}

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function renderPlanAttachments() {
  document.getElementById('plan-attachments-list').innerHTML = planAttachments.map((a, i) => `
    <div class="attachment-item">
      <i data-lucide="paperclip" style="width:14px;height:14px;color:var(--muted-foreground)"></i>
      <span class="attachment-name">${a.name}</span>
      <span class="attachment-size">${(a.size/1024).toFixed(0)}KB</span>
      <button class="btn btn-danger btn-sm" onclick="removePlanAttachment(${i})">✕</button>
    </div>
  `).join('');
  refreshIcons();
}

function removePlanAttachment(i) {
  planAttachments.splice(i, 1);
  renderPlanAttachments();
}

function renderAttachments(attachments, color) {
  if (!attachments?.length) return '';
  return `
    <div class="attachments-list">
      ${attachments.map(a => `
        <a class="attachment-item" href="${a.dataUrl}" download="${a.name}">
          <i data-lucide="paperclip" style="width:14px;height:14px;color:${color}"></i>
          <span class="attachment-name">${a.name}</span>
          <span class="attachment-size">${(a.size/1024).toFixed(0)}KB</span>
        </a>
      `).join('')}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
// CHECK-INS (coach view — all)
// ══════════════════════════════════════════════════════════════
function renderAllCheckins() {
  const checkins = getCheckins().sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  const el = document.getElementById('all-checkins-list');

  if (!checkins.length) {
    el.innerHTML = `<div class="empty-state">
      <i data-lucide="check-square" style="width:40px;height:40px"></i>
      <div class="empty-title">No check-ins yet</div>
      <div class="empty-sub">Clients submit check-ins weekly from their portal.</div>
    </div>`;
    refreshIcons(); return;
  }

  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">${checkins.map(ci => {
    const client = getClientById(ci.clientId);
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="avatar avatar-md" style="background:${goalColor(client?.goal||'bulk')}22;color:${goalColor(client?.goal||'bulk')}">${(client?.name??'?')[0]}</div>
            <div>
              <div style="font-weight:600;color:var(--text);font-size:14px">${client?.name ?? 'Unknown'}</div>
              <div style="font-size:12px;color:var(--muted-foreground)">Week of ${formatDate(ci.weekDate)}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${!ci.coachFeedback ? `
              <span class="badge badge-review">Needs review</span>
              <button class="btn btn-primary btn-sm" onclick="openFeedback('${ci.id}','${formatDate(ci.weekDate)}')">
                <i data-lucide="edit-2" style="width:13px;height:13px"></i> Leave Feedback
              </button>
            ` : `<span class="badge badge-done">Reviewed</span>`}
          </div>
        </div>
        <div class="mini-stats">
          ${[['Weight',`${ci.weight}kg`],['Energy',`${ci.energy}/10`],['Sleep',`${ci.sleep}/10`],['Adherence',`${ci.adherence}/10`]].map(([l,v]) => `
            <div class="mini-stat"><div class="mini-stat-label">${l}</div><div class="mini-stat-value">${v}</div></div>
          `).join('')}
        </div>
        ${ci.notes ? `<p style="margin:8px 0 0;font-size:13px;color:var(--muted-foreground);font-style:italic">"${ci.notes}"</p>` : ''}
      </div>
    `;
  }).join('')}</div>`;
  refreshIcons();
}

// ─── Feedback ─────────────────────────────────────────────────────────────
function openFeedback(checkinId, weekLabel) {
  feedbackCheckinId = checkinId;
  document.getElementById('feedback-week-label').innerHTML =
    `Responding to check-in for week of <strong style="color:var(--text)">${weekLabel}</strong>`;
  document.getElementById('feedback-text').value = '';
  openModal('feedback-modal');
}

function handleFeedback() {
  const text = document.getElementById('feedback-text').value.trim();
  if (!text) { toast('Feedback cannot be empty', 'error'); return; }

  const ci = getCheckins().find(c => c.id === feedbackCheckinId);
  if (!ci) return;

  saveCheckin({ ...ci, coachFeedback: text });
  closeModal('feedback-modal');

  // Re-render whichever view is active
  renderAllCheckins();
  if (currentClientId) renderDetailCheckins(getCheckinsByClient(currentClientId), getClientById(currentClientId));
  toast('Feedback saved!', 'success');
}

// ══════════════════════════════════════════════════════════════
// MESSAGES
// ══════════════════════════════════════════════════════════════
function renderMessages() {
  const clients = getClients();
  const listEl  = document.getElementById('chat-clients-list');

  if (!clients.length) {
    listEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted-foreground);font-size:13px">No clients yet</div>`;
    return;
  }

  listEl.innerHTML = clients.map(c => `
    <button class="chat-client-btn ${chatActiveClientId === c.id ? 'active' : ''}"
      onclick="selectChatClient('${c.id}')">
      <div class="avatar avatar-md" style="background:#3b82f622;color:#3b82f6">${c.name[0]}</div>
      <div style="min-width:0">
        <div class="chat-client-name">${c.name}</div>
        <div class="chat-client-goal">${c.goal}</div>
      </div>
    </button>
  `).join('');

  if (!chatActiveClientId && clients.length) selectChatClient(clients[0].id);
  else if (chatActiveClientId) renderChat(chatActiveClientId);
}

function selectChatClient(clientId) {
  chatActiveClientId = clientId;
  markMessagesRead(clientId);
  pendingImage = null;

  // Update sidebar active state
  document.querySelectorAll('.chat-client-btn').forEach(btn => {
    btn.classList.toggle('active', btn.onclick?.toString().includes(clientId));
  });

  renderChat(clientId);
}

function renderChat(clientId) {
  const client = getClientById(clientId);
  if (!client) return;
  const thread = getMessageThread(clientId);
  const mainEl = document.getElementById('chat-main');

  mainEl.innerHTML = `
    <!-- Header -->
    <div class="chat-header">
      <div class="avatar avatar-sm" style="background:#3b82f622;color:#3b82f6">${client.name[0]}</div>
      <div>
        <div style="font-weight:600;color:var(--text);font-size:14px">${client.name}</div>
        <div style="font-size:11px;color:var(--muted-foreground)">${client.phone || client.email || ''}</div>
      </div>
    </div>

    <!-- Messages -->
    <div class="chat-messages" id="coach-chat-msgs">
      ${!thread.length ? `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--muted-foreground)">
          <i data-lucide="message-square" style="width:32px;height:32px;opacity:0.3"></i>
          <p style="margin:0">No messages yet. Say hello!</p>
        </div>
      ` : thread.map(m => {
        const isCoach = m.senderId === 'coach';
        return `
          <div class="msg ${isCoach ? 'msg-right' : 'msg-left'}">
            <div class="msg-bubble ${isCoach ? 'coach' : 'client'}">
              ${m.content ? `<div>${m.content}</div>` : ''}
              ${m.attachment ? `<img class="msg-img" src="${m.attachment.dataUrl}" alt="${m.attachment.name}" onclick="openLightbox('${m.attachment.dataUrl}')" />` : ''}
              <div class="msg-time ${isCoach ? 'coach' : 'client'}">${formatDateTime(m.createdAt)}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Pending image preview (injected by JS) -->
    <div id="coach-pending-bar"></div>

    <!-- Input bar -->
    <div class="chat-input-bar">
      <label class="img-picker-btn" title="Attach image">
        <i data-lucide="image" style="width:18px;height:18px"></i>
        <input type="file" id="coach-img-input" accept="image/*" style="display:none" />
      </label>
      <textarea class="chat-textarea" id="coach-chat-input" rows="1"
        placeholder="Message ${client.name}…"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();coachSendMessage();}"
      ></textarea>
      <button class="chat-send-btn" id="coach-send-btn" onclick="coachSendMessage()" disabled>
        <i data-lucide="send" style="width:16px;height:16px;color:#fff"></i>
      </button>
    </div>
  `;

  // Bind image input
  document.getElementById('coach-img-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    pendingImage = { id: generateId(), name: file.name, mimeType: file.type, dataUrl, size: file.size };
    renderPendingImage();
    updateSendBtn();
    e.target.value = '';
  });

  // Textarea → update send btn
  document.getElementById('coach-chat-input').addEventListener('input', updateSendBtn);

  // Scroll to bottom
  setTimeout(() => {
    const msgs = document.getElementById('coach-chat-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }, 50);

  refreshIcons();
}

function renderPendingImage() {
  const bar = document.getElementById('coach-pending-bar');
  if (!bar) return;
  if (!pendingImage) { bar.innerHTML = ''; return; }
  bar.innerHTML = `
    <div class="pending-img-bar">
      <div class="pending-img-thumb">
        <img src="${pendingImage.dataUrl}" alt="${pendingImage.name}" />
        <button class="pending-img-remove" onclick="clearPendingImage()">
          <i data-lucide="x" style="width:10px;height:10px;color:#fff"></i>
        </button>
      </div>
      <span style="font-size:12px;color:var(--muted-foreground)">${pendingImage.name}</span>
    </div>
  `;
  refreshIcons();
}

function clearPendingImage() {
  pendingImage = null;
  renderPendingImage();
  updateSendBtn();
}

function updateSendBtn() {
  const btn   = document.getElementById('coach-send-btn');
  const input = document.getElementById('coach-chat-input');
  if (!btn || !input) return;
  const canSend = !!(input.value.trim() || pendingImage);
  btn.disabled = !canSend;
}

function coachSendMessage() {
  const input  = document.getElementById('coach-chat-input');
  const text   = input?.value.trim() || '';
  if (!text && !pendingImage) return;

  const msg = {
    id: generateId(),
    senderId: 'coach',
    receiverId: chatActiveClientId,
    content: text,
    ...(pendingImage ? { attachment: pendingImage } : {}),
    createdAt: new Date().toISOString(),
    read: false,
  };
  saveMessage(msg);
  pendingImage = null;
  input.value = '';
  renderChat(chatActiveClientId);
}

// ─── Lightbox ─────────────────────────────────────────────────────────────
function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = src;
  lb.style.display = 'flex';
}
