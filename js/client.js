// ─── Client app module ─────────────────────────────────────────────────────

let clientId = null;
let weightChart = null;
let clientPendingImage = null;
let checkinPhotos = [];

const PLAN_META = {
  workout:    { label: 'Workout Plan',          color: '#3b82f6', icon: 'dumbbell' },
  nutrition:  { label: 'Nutrition Plan',         color: '#22c55e', icon: 'apple' },
  supplement: { label: 'Vitamins & Supplements', color: '#a855f7', icon: 'pill' },
};

// ─── Nav ───────────────────────────────────────────────────────────────────
function showClientSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active','active-green'));
  document.getElementById('sec-' + name).classList.add('active');
  const nav = document.querySelector(`[data-section="${name}"]`);
  if (nav) nav.classList.add('active','active-green');

  if (name === 'overview')  renderOverview();
  if (name === 'plan')      renderPlan();
  if (name === 'checkin')   renderCheckin();
  if (name === 'progress')  renderProgress();
  if (name === 'messages')  renderClientMessages();
  refreshIcons();
}

// ─── Init ──────────────────────────────────────────────────────────────────
function initClientApp(id) {
  clientId = id;

  document.getElementById('client-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-section]');
    if (btn) showClientSection(btn.dataset.section);
  });

  document.getElementById('client-signout-btn').addEventListener('click', async () => {
    await signOutClient();
    window.location.href = 'index.html';
  });

  renderOverview();
}

// ══════════════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════════════
function renderOverview() {
  const client   = getClientById(clientId);
  if (!client) return;

  const plans    = getPlansByClient(clientId);
  const checkins = getCheckinsByClient(clientId);
  const msgs     = getMessageThread(clientId);
  const unread   = msgs.filter(m => m.senderId === 'coach' && !m.read).length;

  // Check-in due?
  const thisWeek    = getWeekStart();
  const hasThisWeek = checkins.some(c => c.weekDate === thisWeek);
  const checkinDay  = client.checkinDay ?? 1;
  const todayDay    = new Date().getDay();
  const isDueDay    = todayDay >= checkinDay || todayDay === 0;
  const checkinDue  = !hasThisWeek && isDueDay;

  // Welcome
  document.getElementById('overview-welcome').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
      <div class="avatar avatar-lg" style="background:${goalColor(client.goal)}22;color:${goalColor(client.goal)}">${client.name[0]}</div>
      <div>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:var(--text)">Welcome back, ${client.name.split(' ')[0]}!</h1>
        <p style="margin:0;color:var(--muted-foreground);font-size:14px">
          Goal: <span style="color:${goalColor(client.goal)};font-weight:600">${goalLabel(client.goal)}</span>
        </p>
      </div>
    </div>
  `;

  // Due banner
  const dueEl = document.getElementById('overview-checkin-due');
  dueEl.innerHTML = checkinDue ? `
    <div class="alert alert-warning" style="margin-bottom:20px">
      <div style="font-weight:600;font-size:14px">⏰ Your weekly check-in is due!</div>
      <button class="btn btn-sm" style="background:#f59e0b;color:#000;font-weight:700"
        onclick="showClientSection('checkin')">Submit Now</button>
    </div>
  ` : '';

  // Stats
  const lastCheckin = checkins[0];
  document.getElementById('overview-stats').innerHTML = `
    ${clientStatCard('Active Plans', plans.length, 'clipboard-list', '#3b82f6')}
    ${clientStatCard('Total Check-ins', checkins.length, 'check-square', '#22c55e')}
    ${clientStatCard('Unread Messages', unread, 'message-square', '#f59e0b')}
    ${lastCheckin ? clientStatCard('Last Weight', `${lastCheckin.weight}kg`, 'trending-up', '#a855f7', formatDate(lastCheckin.weekDate)) : ''}
  `;

  // Plans overview
  const workout    = plans.find(p => p.type === 'workout');
  const nutrition  = plans.find(p => p.type === 'nutrition');
  const supplement = plans.find(p => p.type === 'supplement');
  document.getElementById('overview-plans').innerHTML = `
    <div class="two-col" style="margin-bottom:20px">
      ${planCard(workout, 'workout')}
      ${planCard(nutrition, 'nutrition')}
      ${supplement ? `<div style="grid-column:1/-1">${planCard(supplement, 'supplement')}</div>` : ''}
    </div>
  `;

  // Last check-in
  const lcEl = document.getElementById('overview-last-checkin');
  if (lastCheckin) {
    lcEl.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Last Check-in</span>
          <button class="link-btn" style="color:var(--accent);font-size:13px"
            onclick="showClientSection('progress')">View progress →</button>
        </div>
        <div style="font-size:12px;color:var(--muted-foreground);margin-bottom:14px">Week of ${formatDate(lastCheckin.weekDate)}</div>
        <div class="mini-stats">
          ${[['Weight',`${lastCheckin.weight}kg`],['Energy',`${lastCheckin.energy}/10`],['Sleep',`${lastCheckin.sleep}/10`],['Adherence',`${lastCheckin.adherence}/10`]].map(([l,v]) => `
            <div class="mini-stat"><div class="mini-stat-label">${l}</div><div class="mini-stat-value">${v}</div></div>
          `).join('')}
        </div>
        ${lastCheckin.coachFeedback ? `
          <div class="feedback-block feedback-block-green" style="margin-top:14px">
            <div class="feedback-label" style="color:#22c55e">Coach Feedback</div>
            <p style="margin:0;font-size:14px;color:var(--text);line-height:1.6">${lastCheckin.coachFeedback}</p>
          </div>
        ` : ''}
      </div>
    `;
  } else { lcEl.innerHTML = ''; }

  refreshIcons();
}

function clientStatCard(label, value, iconName, color, sub = '') {
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

function planCard(plan, type) {
  const meta = PLAN_META[type];
  if (!plan) return `
    <div class="card" style="text-align:center;color:var(--muted-foreground)">
      <i data-lucide="${meta.icon}" style="width:24px;height:24px;margin-bottom:8px"></i>
      <div style="font-size:14px">No ${meta.label.toLowerCase()} assigned yet</div>
    </div>
  `;
  return `
    <div class="card" onclick="showClientSection('plan')" style="cursor:pointer;transition:border-color 0.2s"
      onmouseover="this.style.borderColor='${meta.color}'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <i data-lucide="${meta.icon}" style="width:20px;height:20px;color:${meta.color}"></i>
        <span style="font-weight:700;color:var(--text);font-size:15px">${meta.label}</span>
      </div>
      <div style="font-size:13px;color:var(--text);margin-bottom:8px">${plan.title}</div>
      <div style="font-size:12px;color:var(--muted-foreground)">View full plan →</div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
// MY PLAN
// ══════════════════════════════════════════════════════════════
function renderPlan() {
  const plans = getPlansByClient(clientId);
  const tabEl = document.getElementById('plan-tabs');
  const contentEl = document.getElementById('plan-content');

  if (!plans.length) {
    tabEl.style.display = 'none';
    contentEl.innerHTML = `
      <div class="empty-state">
        <i data-lucide="clipboard-list" style="width:40px;height:40px"></i>
        <div class="empty-title">No plan assigned yet</div>
        <div class="empty-sub">Your coach will add your plan soon. Check back later!</div>
      </div>
    `;
    refreshIcons(); return;
  }

  const types = ['workout','nutrition','supplement'].filter(t => plans.some(p => p.type === t));
  let activeType = types[0];

  tabEl.style.display = 'flex';
  tabEl.innerHTML = types.map(t => {
    const m = PLAN_META[t];
    return `
      <button class="tab-btn ${t === activeType ? 'active-green' : ''}" data-plan-type="${t}"
        style="--plan-color:${m.color}">
        <i data-lucide="${m.icon}" style="width:15px;height:15px"></i> ${m.label}
      </button>
    `;
  }).join('');

  tabEl.querySelectorAll('.tab-btn').forEach(btn => {
    btn.style.setProperty('--plan-color', PLAN_META[btn.dataset.planType].color);
    btn.addEventListener('click', () => {
      tabEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-green'));
      btn.classList.add('active-green');
      const color = PLAN_META[btn.dataset.planType].color;
      btn.style.borderBottomColor = color;
      btn.style.color = color;
      showPlanContent(plans, btn.dataset.planType);
    });
  });

  showPlanContent(plans, activeType);
}

function showPlanContent(plans, type) {
  const plan = plans.find(p => p.type === type);
  const contentEl = document.getElementById('plan-content');
  const meta = PLAN_META[type];

  if (!plan) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <i data-lucide="clipboard-list" style="width:40px;height:40px"></i>
        <div class="empty-title">No plan assigned yet</div>
        <div class="empty-sub">Your coach will add your ${meta.label.toLowerCase()} soon.</div>
      </div>
    `;
    refreshIcons(); return;
  }

  contentEl.innerHTML = `
    <div class="card" style="max-width:760px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <i data-lucide="${meta.icon}" style="width:22px;height:22px;color:${meta.color}"></i>
        <h2 style="margin:0;font-size:20px;font-weight:800;color:var(--text)">${plan.title}</h2>
      </div>
      <div style="font-size:12px;color:var(--muted-foreground);margin-bottom:28px">Last updated ${formatDate(plan.createdAt)}</div>
      <div class="plan-body">${renderPlanBody(plan.content, meta.color)}</div>
      ${plan.notes ? `
        <div style="margin-top:28px;background:${meta.color}10;border:1px solid ${meta.color}30;border-radius:10px;padding:16px">
          <div style="font-size:11px;font-weight:600;color:${meta.color};text-transform:uppercase;margin-bottom:6px">Notes</div>
          <p style="margin:0;font-size:14px;color:var(--text);line-height:1.7">${plan.notes}</p>
        </div>
      ` : ''}
      ${renderPlanAttachmentsClient(plan.attachments, meta.color)}
    </div>
  `;
  refreshIcons();
}

function renderPlanBody(content, color) {
  return content.split('\n').map(line => {
    if (line.startsWith('## '))
      return `<div class="plan-h3" style="color:${color};border-bottom-color:${color}20">${line.slice(3)}</div>`;
    if (/^\*\*(.+)\*\*$/.test(line))
      return `<div class="plan-bold">${line.slice(2,-2)}</div>`;
    if (line.startsWith('- '))
      return `<div class="plan-li" style="--bullet-color:${color}">${line.slice(2)}</div>`;
    if (!line.trim())
      return `<div class="plan-gap"></div>`;
    // Inline bold
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return `<div style="color:#cbd5e1">${parts.map(p =>
      p.startsWith('**')&&p.endsWith('**')
        ? `<strong style="color:var(--text)">${p.slice(2,-2)}</strong>`
        : p
    ).join('')}</div>`;
  }).join('');
}

function renderPlanAttachmentsClient(attachments, color) {
  if (!attachments?.length) return '';
  return `
    <div class="attachments-list" style="margin-top:20px">
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
// CHECK-IN
// ══════════════════════════════════════════════════════════════
function renderCheckin() {
  const thisWeek  = getWeekStart();
  const existing  = getCheckinForWeek(clientId, thisWeek);
  const contentEl = document.getElementById('checkin-content');
  checkinPhotos   = [];

  if (existing) {
    contentEl.innerHTML = `
      <div class="checkin-success">
        <div style="width:72px;height:72px;background:#22c55e22;border-radius:50%;display:flex;align-items:center;justify-content:center">
          <i data-lucide="check-circle" style="width:36px;height:36px;color:#22c55e"></i>
        </div>
        <h2 style="margin:0;font-size:20px;font-weight:700;color:var(--text)">Check-in submitted!</h2>
        <p style="margin:0;color:var(--muted-foreground);font-size:14px">
          You've already submitted your check-in for the week of ${formatDate(thisWeek)}.<br>
          Come back next week!
        </p>
        <div class="mini-stats" style="margin-top:8px">
          ${[['Weight',`${existing.weight}kg`],['Energy',`${existing.energy}/10`],['Sleep',`${existing.sleep}/10`],['Adherence',`${existing.adherence}/10`]].map(([l,v]) => `
            <div class="mini-stat"><div class="mini-stat-label">${l}</div><div class="mini-stat-value">${v}</div></div>
          `).join('')}
        </div>
        ${existing.coachFeedback ? `
          <div class="feedback-block feedback-block-green" style="width:100%;max-width:500px;text-align:left">
            <div class="feedback-label" style="color:#22c55e">Coach Feedback</div>
            <p style="margin:0;font-size:14px;color:var(--text);line-height:1.6">${existing.coachFeedback}</p>
          </div>
        ` : `<p style="color:var(--muted-foreground);font-size:13px;margin:0">Waiting for coach feedback…</p>`}
      </div>
    `;
    refreshIcons(); return;
  }

  // Form
  contentEl.innerHTML = `
    <div class="card" style="max-width:600px">
      <p style="margin:0 0 24px;font-size:14px;color:var(--muted-foreground)">Week of <strong style="color:var(--text)">${formatDate(thisWeek)}</strong></p>

      <!-- Weight -->
      <div class="form-group">
        <label class="form-label">Current Weight (kg)</label>
        <input type="number" class="form-input" id="ci-weight" placeholder="e.g. 85.5" step="0.1" min="20" max="300" />
      </div>

      <!-- Rating sliders -->
      <div id="ci-energy-wrap"></div>
      <div id="ci-sleep-wrap"></div>
      <div id="ci-adherence-wrap"></div>

      <!-- Notes -->
      <div class="form-group">
        <label class="form-label">Notes / How are you feeling?</label>
        <textarea class="form-textarea" id="ci-notes" placeholder="How was your week? Any challenges or wins?"></textarea>
      </div>

      <!-- Photos -->
      <div class="form-group">
        <label class="form-label">Progress Photos <span style="color:var(--muted-foreground);font-weight:400;text-transform:none;letter-spacing:0">(optional, max 3)</span></label>
        <div class="photos-grid" id="ci-photos-grid">
          <label class="photo-add-btn" id="ci-photo-add" for="ci-photo-input">
            <i data-lucide="camera" style="width:20px;height:20px"></i>
            <span>Add photo</span>
            <input type="file" id="ci-photo-input" accept="image/*" multiple style="display:none" />
          </label>
        </div>
      </div>

      <button class="btn btn-green btn-full" id="ci-submit-btn">
        <i data-lucide="send" style="width:16px;height:16px"></i>
        Submit Check-in
      </button>
    </div>
  `;

  // Inject sliders
  buildSlider('ci-energy-wrap', 'Energy Level', 'ci-energy', 7);
  buildSlider('ci-sleep-wrap',  'Sleep Quality', 'ci-sleep',  7);
  buildSlider('ci-adherence-wrap', 'Plan Adherence', 'ci-adherence', 7);

  // Photo input
  document.getElementById('ci-photo-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (checkinPhotos.length >= 3) break;
      try { checkinPhotos.push(await resizePhoto(file)); } catch {}
    }
    renderPhotosGrid();
    e.target.value = '';
  });

  // Submit
  document.getElementById('ci-submit-btn').addEventListener('click', handleCheckinSubmit);
  refreshIcons();
}

function buildSlider(wrapperId, label, id, defaultVal) {
  const wrapper = document.getElementById(wrapperId);
  wrapper.innerHTML = `
    <div class="rating-wrap">
      <div class="rating-header">
        <span class="rating-label">${label}</span>
        <span class="rating-val" id="${id}-val">${defaultVal}/10</span>
      </div>
      <div class="rating-track">
        <div class="rating-fill" id="${id}-fill" style="width:${defaultVal*10}%"></div>
        <div class="rating-thumb" id="${id}-thumb" style="left:${defaultVal*10}%"></div>
        <input type="range" id="${id}" min="1" max="10" value="${defaultVal}"
          oninput="updateSlider('${id}',this.value)" />
      </div>
    </div>
  `;
}

function updateSlider(id, val) {
  document.getElementById(`${id}-val`).textContent  = `${val}/10`;
  document.getElementById(`${id}-fill`).style.width = `${val*10}%`;
  document.getElementById(`${id}-thumb`).style.left = `${val*10}%`;
}

function renderPhotosGrid() {
  const grid = document.getElementById('ci-photos-grid');
  grid.innerHTML = checkinPhotos.map((src, i) => `
    <div class="photo-thumb">
      <img src="${src}" alt="Photo ${i+1}" />
      <button class="photo-remove" onclick="removePhoto(${i})">✕</button>
    </div>
  `).join('');
  if (checkinPhotos.length < 3) {
    grid.innerHTML += `
      <label class="photo-add-btn" for="ci-photo-input">
        <i data-lucide="camera" style="width:20px;height:20px"></i>
        <span>Add photo</span>
      </label>
    `;
  }
  refreshIcons();
}

function removePhoto(i) {
  checkinPhotos.splice(i, 1);
  renderPhotosGrid();
}

function handleCheckinSubmit() {
  const weight = parseFloat(document.getElementById('ci-weight').value);
  if (!weight || weight < 20 || weight > 300) { toast('Please enter a valid weight', 'error'); return; }

  const energy    = parseInt(document.getElementById('ci-energy').value);
  const sleep     = parseInt(document.getElementById('ci-sleep').value);
  const adherence = parseInt(document.getElementById('ci-adherence').value);
  const notes     = document.getElementById('ci-notes').value.trim();

  const checkin = {
    id: generateId(), clientId,
    weekDate: getWeekStart(),
    weight, energy, sleep, adherence, notes,
    photos: checkinPhotos.length ? [...checkinPhotos] : undefined,
    coachFeedback: '',
    createdAt: new Date().toISOString(),
  };
  saveCheckin(checkin);
  toast('Check-in submitted! 🎉', 'success');
  renderCheckin();
}

// ══════════════════════════════════════════════════════════════
// PROGRESS
// ══════════════════════════════════════════════════════════════
function renderProgress() {
  const checkins = getCheckinsByClient(clientId).reverse(); // oldest first

  // Destroy old chart
  if (weightChart) { weightChart.destroy(); weightChart = null; }

  if (!checkins.length) {
    document.getElementById('weight-chart').style.display = 'none';
    document.getElementById('progress-list').innerHTML = `
      <div class="empty-state">
        <i data-lucide="trending-up" style="width:40px;height:40px"></i>
        <div class="empty-title">No check-ins yet</div>
        <div class="empty-sub">Submit your first check-in to start tracking progress.</div>
      </div>
    `;
    refreshIcons(); return;
  }

  document.getElementById('weight-chart').style.display = '';

  // Chart
  const ctx = document.getElementById('weight-chart').getContext('2d');
  weightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: checkins.map(c => formatDate(c.weekDate)),
      datasets: [{
        label: 'Weight (kg)',
        data: checkins.map(c => c.weight),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.08)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#22c55e',
        pointRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#71717a', font: { family: 'Inter' } } },
      },
      scales: {
        x: { ticks: { color: '#71717a', font: { family: 'Inter', size: 11 } }, grid: { color: '#2a2a2a' } },
        y: { ticks: { color: '#71717a', font: { family: 'Inter', size: 11 } }, grid: { color: '#2a2a2a' } },
      },
    },
  });

  // Check-in cards (newest first)
  const sorted = [...checkins].reverse();
  document.getElementById('progress-list').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      ${sorted.map(ci => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-weight:700;color:var(--text)">Week of ${formatDate(ci.weekDate)}</div>
            <span style="font-size:12px;color:var(--muted-foreground)">${formatDate(ci.createdAt)}</span>
          </div>
          <div class="mini-stats">
            ${[['Weight',`${ci.weight}kg`],['Energy',`${ci.energy}/10`],['Sleep',`${ci.sleep}/10`],['Adherence',`${ci.adherence}/10`]].map(([l,v]) => `
              <div class="mini-stat"><div class="mini-stat-label">${l}</div><div class="mini-stat-value">${v}</div></div>
            `).join('')}
          </div>
          ${ci.photos?.length ? `
            <div class="photos-grid" style="margin-top:10px">
              ${ci.photos.map((src,i) => `
                <div class="photo-thumb" onclick="openLightboxClient('${src}')">
                  <img src="${src}" alt="Photo ${i+1}" />
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${ci.notes ? `<div class="notes-box">"${ci.notes}"</div>` : ''}
          ${ci.coachFeedback ? `
            <div class="feedback-block feedback-block-green" style="margin-top:12px">
              <div class="feedback-label" style="color:#22c55e">Coach Feedback</div>
              <p style="margin:0;font-size:14px;color:var(--text);line-height:1.6">${ci.coachFeedback}</p>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
  refreshIcons();
}

// ══════════════════════════════════════════════════════════════
// MESSAGES
// ══════════════════════════════════════════════════════════════
function renderClientMessages() {
  const thread = getMessageThread(clientId);
  const mainEl = document.getElementById('client-chat-main');

  mainEl.innerHTML = `
    <!-- Header -->
    <div class="chat-header">
      <div class="avatar avatar-sm" style="background:#3b82f622;color:#3b82f6">C</div>
      <div>
        <div style="font-weight:600;color:var(--text);font-size:14px">Coach Mohamed Mansour</div>
        <div style="font-size:11px;color:var(--muted-foreground)">Your Coach</div>
      </div>
    </div>

    <!-- Messages -->
    <div class="chat-messages" id="client-chat-msgs">
      ${!thread.length ? `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--muted-foreground)">
          <i data-lucide="message-square" style="width:32px;height:32px;opacity:0.3"></i>
          <p style="margin:0">No messages yet. Say hello!</p>
        </div>
      ` : thread.map(m => {
        const isClient = m.senderId === clientId;
        return `
          <div class="msg ${isClient ? 'msg-right' : 'msg-left'}">
            <div class="msg-bubble ${isClient ? 'coach' : 'client'}">
              ${m.content ? `<div>${m.content}</div>` : ''}
              ${m.attachment ? `<img class="msg-img" src="${m.attachment.dataUrl}" alt="${m.attachment.name}" onclick="openLightboxClient('${m.attachment.dataUrl}')" />` : ''}
              <div class="msg-time ${isClient ? 'coach' : 'client'}">${formatDateTime(m.createdAt)}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Pending image preview -->
    <div id="client-pending-bar"></div>

    <!-- Input bar -->
    <div class="chat-input-bar">
      <label class="img-picker-btn" title="Attach image">
        <i data-lucide="image" style="width:18px;height:18px"></i>
        <input type="file" id="client-img-input" accept="image/*" style="display:none" />
      </label>
      <textarea class="chat-textarea" id="client-chat-input" rows="1"
        placeholder="Message Coach Mohamed Mansour…"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();clientSendMessage();}"
      ></textarea>
      <button class="chat-send-btn" id="client-send-btn" onclick="clientSendMessage()" disabled>
        <i data-lucide="send" style="width:16px;height:16px;color:#fff"></i>
      </button>
    </div>
  `;

  // Image input
  document.getElementById('client-img-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    clientPendingImage = { id: generateId(), name: file.name, mimeType: file.type, dataUrl, size: file.size };
    renderClientPendingImage();
    updateClientSendBtn();
    e.target.value = '';
  });

  document.getElementById('client-chat-input').addEventListener('input', updateClientSendBtn);

  // Scroll to bottom
  setTimeout(() => {
    const msgs = document.getElementById('client-chat-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }, 50);

  refreshIcons();
}

function renderClientPendingImage() {
  const bar = document.getElementById('client-pending-bar');
  if (!bar) return;
  if (!clientPendingImage) { bar.innerHTML = ''; return; }
  bar.innerHTML = `
    <div class="pending-img-bar">
      <div class="pending-img-thumb">
        <img src="${clientPendingImage.dataUrl}" alt="${clientPendingImage.name}" />
        <button class="pending-img-remove" onclick="clearClientPendingImage()">
          <i data-lucide="x" style="width:10px;height:10px;color:#fff"></i>
        </button>
      </div>
      <span style="font-size:12px;color:var(--muted-foreground)">${clientPendingImage.name}</span>
    </div>
  `;
  refreshIcons();
}

function clearClientPendingImage() {
  clientPendingImage = null;
  renderClientPendingImage();
  updateClientSendBtn();
}

function updateClientSendBtn() {
  const btn   = document.getElementById('client-send-btn');
  const input = document.getElementById('client-chat-input');
  if (!btn || !input) return;
  btn.disabled = !input.value.trim() && !clientPendingImage;
}

function clientSendMessage() {
  const input = document.getElementById('client-chat-input');
  const text  = input?.value.trim() || '';
  if (!text && !clientPendingImage) return;

  const msg = {
    id: generateId(),
    senderId: clientId,
    receiverId: 'coach',
    content: text,
    ...(clientPendingImage ? { attachment: clientPendingImage } : {}),
    createdAt: new Date().toISOString(),
    read: false,
  };
  saveMessage(msg);
  clientPendingImage = null;
  input.value = '';
  renderClientMessages();
}

// ─── Shared file-to-dataUrl ───────────────────────────────────────────────
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

// ─── Lightbox ─────────────────────────────────────────────────────────────
function openLightboxClient(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').style.display = 'flex';
}
