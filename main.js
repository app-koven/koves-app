import { supabase } from './supabaseClient.js';

/* ════════════════════════════════════════════════════════════════
   GROUPOS V4 — ESTADO Y LÓGICA
   ════════════════════════════════════════════════════════════════ */

// ── ESTADO GLOBAL ──
let isLoginMode = true; // Auth mode

const state = {
  isLoggedIn: false,
  currentUserId: 'tu',
  currentGroupId: null,
  plans: [],
  members: [],
  // Cuentas guardadas (como Instagram: varias cuentas en el mismo dispositivo)
  accounts: [],
  // Grupos del usuario actual
  myGroups: [],  // V5: Cuál es el miembro actualmente en perfil (para chat)
  currentMemberId: 'carlos',
  // V5: Chat actual abierto
  currentChat: null,  // V5: Mensajes simulados por chat
  chatMessages: {},
  // V5: Members para podium picker (asistentes al plan actual)
  planAttendees: [],
  // V6: Historial de standings por mes (offset → array de jugadores)
  // pts = pj + mvp + trd - 2*am - 5*rj
  // (Mock data de standingsHistory y boteHistory eliminados)  // V6: ¿Eres admin del grupo actual? (controla la edición de reglas)
  isAdmin: true,
  // V6: Offset del mes mostrado en el calendario de planes
  calendarMonthOffset: 0,
};

let currentMemberId = 'carlos'; // accesible globalmente para chat desde perfil

// (Mock data eliminado — datos reales desde Supabase)

// ── NAVEGACIÓN ──
// ── NAVEGACIÓN (con pila de historial) ──
let currentScreen = 'plans';
let navStack = [];                      // pila de pantallas para "atrás"
const MAIN_SCREENS = ['plans', 'expenses', 'group'];
const DETAIL_SCREENS = ['plan-detail', 'member', 'conversation', 'activity', 'roulette', 'roulette-detail'];

window.showScreen = function showScreen(name, opts) {
  opts = opts || {};
  const sEl = document.getElementById('s-' + name);
  if (!sEl) return;
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    // Limpiar cualquier transform/sombra residual de un gesto a medias
    s.style.transform = '';
    s.style.transition = '';
    s.style.boxShadow = '';
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  sEl.classList.add('active');

  // Gestión de la pila de navegación
  if (!opts.isBack && name !== currentScreen) {
    navStack.push(currentScreen);
    if (navStack.length > 25) navStack.shift();
  }
  currentScreen = name;

  // Marcar nav activo: si es pantalla principal, ella misma; si es detalle, su "padre"
  let navTarget = name;
  if (DETAIL_SCREENS.includes(name)) {
    navTarget = (name === 'expenses') ? 'expenses' : 'plans';
    if (name === 'member' || name === 'activity') navTarget = 'group';
    if (name === 'plan-detail') navTarget = 'plans';
  }
  const navEl = document.getElementById('nav-' + navTarget);
  if (navEl) navEl.classList.add('active');

  // FAB solo en la pantalla de planes
  const fab = document.getElementById('fab-create');
  if (fab) fab.style.display = (name === 'plans') ? 'flex' : 'none';
  window.scrollTo(0, 0);
}

window.goBack = function goBack() {
  // Sacar de la pila la última pantalla válida
  let target = null;
  while (navStack.length) {
    const candidate = navStack.pop();
    if (candidate && candidate !== currentScreen && document.getElementById('s-' + candidate)) {
      target = candidate;
      break;
    }
  }
  if (!target) target = 'plans';  // fallback seguro
  showScreen(target, { isBack: true });
}

window.openPlan = function openPlan(id) {
  const p = state.plans.find(x => x.id === id);
  if (!p) return;
  
  const statusStr = p.status === 'active' ? 'Confirmado' : 'Propuesto';
  document.getElementById('pd-status').textContent = statusStr;
  document.getElementById('pd-title').innerHTML = p.title;
  document.getElementById('pd-desc').textContent = p.description || 'Sin descripción';
  
  const cr = document.getElementById('pd-creator');
  // We can look up the creator in state.accounts or group members if we have them, for now just placeholder
  if (cr) cr.textContent = 'Organizador';
  
  showScreen('plan-detail');
  
  document.querySelectorAll('#attendance-grid .action-btn').forEach(b => b.classList.remove('selected'));
  
  // TODO: Check if user attendance is pending by fetching plan_attendance
  updateAttendanceBlink(true);
  
  // Guardar el ID del plan activo globalmente
  state.currentPlanId = id;
  // Cargar las fotos reales
  loadPlanPhotos(id);
  // Cargar tarjetas propuestas
  if (window.loadPlanCards) window.loadPlanCards();
}

window.openHistorial = function openHistorial() {
  // Compatibilidad: el historial abre el detalle del plan
  openPlan('quedada');
}

// ── FECHA (deprecated en V6, queda como no-op para compatibilidad) ──
window.setHeaderDate = function setHeaderDate() {
  // El header ya no muestra fecha en V6, lleva el botón de actividad
}

// ── TABS PLANES ──
window.switchPlansTab = function switchPlansTab(el, name) {
  document.querySelectorAll('#s-plans .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['activos','historial'].forEach(t => {
    const el2 = document.getElementById('plans-' + t);
    if (el2) el2.style.display = t === name ? 'block' : 'none';
  });
}

// ── ASISTENCIA ──
window.selectAttendance = function selectAttendance(btn) {
  document.querySelectorAll('#attendance-grid .action-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  // Al votar asistencia, el plan deja de estar pendiente: parar parpadeo
  updateAttendanceBlink(false);
  showToast('Asistencia actualizada ✓');
}

// ── LIKE ──
window.toggleLike = function toggleLike(btn) {
  const span = document.getElementById('like-count');
  const count = parseInt(span.textContent);
  if (btn.dataset.liked) {
    span.textContent = count - 1;
    btn.style.background = '';
    btn.style.borderColor = '';
    delete btn.dataset.liked;
  } else {
    span.textContent = count + 1;
    btn.style.background = 'var(--ink)';
    btn.style.color = '#fff';
    btn.dataset.liked = '1';
    showToast('❤ Te gusta este plan');
  }
}

window.likeComment = function likeComment(el) {
  const parts = el.textContent.split(' ');
  const n = parseInt(parts[1]);
  el.textContent = '❤ ' + (n + 1);
  el.style.color = 'var(--red)';
}

window.escapeHtml = function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── VOTE ──
window.showVoteModal = function showVoteModal() { document.getElementById('modal-vote').classList.add('open'); }

window.castVote = function castVote(type, btn) {
  document.querySelectorAll('#modal-vote .action-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  showToast(type === 'si' ? '✓ Voto registrado: Voy' : '✗ Voto registrado: No voy');
  setTimeout(() => closeModal('modal-vote'), 900);
}

// ── DISCIPLINE ──






// ── EXPENSE ──
window.showAddExpenseLegacy = function showAddExpenseLegacy() { document.getElementById('modal-expense').classList.add('open'); }

window.toggleParticipant = function toggleParticipant(el) {
  if (el.classList.contains('pill-dark')) {
    el.classList.remove('pill-dark');
    el.classList.add('pill-outline');
  } else {
    el.classList.remove('pill-outline');
    el.classList.add('pill-dark');
  }
}

window.openAddExpense = null;

window.submitExpense = async function submitExpense() {
  const title = document.getElementById('exp-title-input').value.trim();
  const amountStr = document.getElementById('exp-amount-input').value.trim();
  const amount = parseFloat(amountStr);
  const planId = document.getElementById('exp-plan-input').value;
  
  if (!title || !amount || isNaN(amount)) {
    showToast('Faltan datos o el importe no es válido');
    return;
  }

  const selectedPills = Array.from(document.querySelectorAll('#exp-participants .pill-dark'));
  if (selectedPills.length === 0) {
    showToast('Debes seleccionar al menos 1 participante');
    return;
  }

  const splitAmount = amount / selectedPills.length;
  
  // Create expense
  const { data: exp, error: err1 } = await supabase
    .from('expenses')
    .insert([{
      group_id: state.currentGroupId,
      payer_id: state.currentUserId,
      title: title,
      amount: amount,
      plan_id: planId || null,
      status: 'validated' // Auto-validate for MVP
    }])
    .select()
    .single();

  if (err1) {
    console.error(err1);
    showToast('Error al guardar el gasto');
    return;
  }

  // Create splits
  const splits = selectedPills.map(p => {
    return {
      expense_id: exp.id,
      debtor_id: p.getAttribute('data-id'),
      amount: splitAmount,
      status: p.getAttribute('data-id') === state.currentUserId ? 'paid' : 'pending' // payer is already paid
    }
  });

  const { error: err2 } = await supabase.from('expense_splits').insert(splits);
  
  if (err2) {
    console.error(err2);
    showToast('Error al dividir el gasto');
    return;
  }

  closeModal('modal-expense');
  showToast('Gasto guardado ✓');
  if (window.loadExpenses) window.loadExpenses();
}

window.openExpenseDetail = function openExpenseDetail(id) {
  // Buscar en state.expenses (datos reales de Supabase)
  const d = (state.expenses || []).find(e => e.id === id);
  if (!d) { showToast('Gasto no encontrado'); return; }
  
  const getProfile = (uid) => {
    const mem = state.members.find(m => m.profiles && m.profiles.id === uid);
    return mem ? mem.profiles : { full_name: 'Usuario', username: '' };
  };
  const payer = getProfile(d.payer_id);
  const payerName = payer.full_name || payer.username || 'Usuario';
  const dateStr = new Date(d.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const splitsCount = d.expense_splits ? d.expense_splits.length : 0;
  const isValidated = d.status === 'validated';

  const body = document.getElementById('exd-body');
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:14px;">
      <div style="font-size:46px;margin-bottom:6px;">💰</div>
      <div style="font-size:24px;font-weight:900;letter-spacing:-.04em;font-family:'DM Mono',monospace;">${Number(d.amount).toFixed(2)}€</div>
      <div style="font-size:13px;color:var(--ink3);">${d.title}</div>
    </div>
    <div class="card" style="padding:0 14px;margin-bottom:14px;">
      <div class="card-row" style="cursor:default;">
        <div class="card-content"><div class="card-name" style="font-size:12px;">Fecha</div></div>
        <div style="font-size:13px;font-weight:700;">${dateStr}</div>
      </div>
      <div class="card-row" style="cursor:default;">
        <div class="card-content"><div class="card-name" style="font-size:12px;">Pagado por</div></div>
        <div style="font-size:13px;font-weight:700;">${payerName}</div>
      </div>
      <div class="card-row" style="cursor:default;">
        <div class="card-content"><div class="card-name" style="font-size:12px;">Participantes</div></div>
        <div style="font-size:13px;font-weight:700;">${splitsCount} personas</div>
      </div>
      <div class="card-row" style="cursor:default;border-bottom:0;">
        <div class="card-content"><div class="card-name" style="font-size:12px;">Estado</div></div>
        ${isValidated ? '<span class="pill pill-green">Validado</span>' : '<span class="pill pill-amber">Pendiente</span>'}
      </div>
    </div>
    ${d.proof_url ? '<button class="btn btn-secondary btn-full" onclick="showToast(\'Comprobante mostrado\')" style="margin-bottom:8px;">📎 Ver comprobante</button>' : ''}
    <button class="btn btn-primary btn-full" onclick="reviewExpense('${id}')" style="margin-bottom:8px;">Revisar gasto</button>
    <button class="btn btn-secondary btn-full" onclick="closeModal('modal-expense-detail')">Cerrar</button>
  `;
  document.getElementById('modal-expense-detail').classList.add('open');
}

// Revisar un gasto/pago del plan: genera una reclamación para el admin.
// Solo se puede reclamar un pago si asististe al plan.
window.reviewExpense = function reviewExpense(id) {
  closeModal('modal-expense-detail');
  // En esta demo el usuario asistió al plan actual; en real se comprobaría.
  const asististe = true;
  if (!asististe) {
    showToast('Solo puedes reclamar pagos de planes a los que asististe');
    return;
  }
  openReclamFor('pago', 'Pago del plan · ' + (id || 'gasto'));
}

window.openLiquidar = function openLiquidar() {
  document.getElementById('modal-liquidar').classList.add('open');
}

window.markPaid = function markPaid(btn, name, amount) {
  btn.textContent = '✓ Pagado';
  btn.classList.remove('btn-primary');
  btn.classList.add('btn-secondary');
  btn.disabled = true;
  showToast(`Pago de ${amount} a ${name} marcado ✓`);
}

// ── CALENDAR MODAL ──
// Planes por día del mes actual (clave = número de día)
const calPlanData = {
  '22': [{ planId: 'cena-italiana', title: 'Cena italiana', meta: 'Jueves · 21:00 · 6 asistentes', status: 'status-finalizado', statusLabel: 'Finalizado' }],
  '23': [{ planId: 'quedada', title: 'Quedada en el piso', meta: 'Hoy · 22:30 · 7 asistentes', status: 'pill-dark', statusLabel: 'Hoy' }],
  '27': [{ planId: 'fiesta-ana', title: 'Cena de mitad de semana', meta: 'Miércoles · 20:00 · 3 asistentes', status: 'pill-outline', statusLabel: 'Activo' }],
  '29': [{ planId: 'fiesta-ana', title: 'Escapada a Porto', meta: 'Viernes–Domingo · Viaje', status: 'pill-amber', statusLabel: 'Viaje' }],
};

let calModalDay = null;
window.showCalModal = function showCalModal(day, isFuture) {
  calModalDay = day;
  const plans = calPlanData[day] || [];
  document.getElementById('cal-modal-title').firstChild.textContent = `Día ${day} de Mayo`;
  const content = document.getElementById('cal-modal-content');
  if (plans.length) {
    content.innerHTML = plans.map(p => `
      <div class="card-row" style="border:1px solid var(--line);border-radius:var(--r);margin-bottom:8px;" onclick="closeModal('modal-cal');openPlan('${p.planId}')">
        <div class="card-content">
          <div class="card-name">${p.title}</div>
          <div class="card-sub">${p.meta}</div>
        </div>
        <span class="pill ${p.status}">${p.statusLabel}</span>
      </div>
    `).join('');
  } else {
    content.innerHTML = `<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">Sin planes este día</div><div class="empty-sub">${isFuture ? 'Puedes crear uno nuevo.' : 'No hubo planes este día.'}</div></div>`;
  }
  // El botón de crear plan solo tiene sentido en días de hoy/futuros
  const createBtn = document.getElementById('cal-create-btn');
  if (createBtn) createBtn.style.display = (isFuture === false) ? 'none' : 'block';
  document.getElementById('modal-cal').classList.add('open');
}

// ── MODALS GENERAL ──
window.closeModal = function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ── TOAST ──
window.showToast = function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2200);
}

/* ════════════════════════════════════════════════════════════════
   USUARIO Y CUENTAS (estilo Instagram)
   ════════════════════════════════════════════════════════════════ */

window.openUserSheet = function openUserSheet() {
  if (!state.isLoggedIn) {
    document.getElementById('modal-auth').classList.add('open');
    return;
  }
  // Actualizar header del sheet con el usuario actual
  const acc = state.accounts.find(a => a.id === state.currentUserId);
  if (acc) {
    document.getElementById('us-avatar').textContent = acc.initials;
    document.getElementById('us-avatar').style.background = acc.avatarColor;
    document.getElementById('us-name').textContent = acc.name;
    document.getElementById('us-handle').textContent = acc.handle;
  }
  document.getElementById('modal-user').classList.add('open');
}

window.openSwitchAccount = function openSwitchAccount() {
  closeModal('modal-user');
  setTimeout(() => {
    renderAccountList();
    document.getElementById('modal-switch').classList.add('open');
  }, 200);
}

window.renderAccountList = function renderAccountList() {
  const list = document.getElementById('account-list');
  list.innerHTML = state.accounts.map(a => `
    <div class="account-item" onclick="switchAccount('${a.id}')">
      <div class="account-avatar" style="background:${a.avatarColor};">${a.initials}</div>
      <div class="account-info">
        <div class="account-name">${a.name}</div>
        <div class="account-handle">${a.handle}</div>
      </div>
      <div class="account-check">${a.id === state.currentUserId ? '✓' : ''}</div>
    </div>
  `).join('');
}

window.switchAccount = function switchAccount(id) {
  if (id === state.currentUserId) {
    closeModal('modal-switch');
    return;
  }
  const acc = state.accounts.find(a => a.id === id);
  if (!acc) return;
  state.currentUserId = id;
  // Actualizar avatar de la cabecera
  document.getElementById('hdr-user-avatar').textContent = acc.initials;
  document.getElementById('hdr-user-avatar').style.background = acc.avatarColor;
  closeModal('modal-switch');
  showToast(`Has cambiado a ${acc.name} ✓`);
}

window.openAddAccount = function openAddAccount() {
  closeModal('modal-switch');
  setTimeout(() => {
    document.getElementById('modal-auth').classList.add('open');
  }, 200);
}

window.submitAddAccount = function submitAddAccount() {
  const userInput = document.getElementById('add-acc-user').value.trim();
  if (!userInput) {
    showToast('Introduce un usuario');
    return;
  }
  // Crear cuenta nueva mock
  const handle = userInput.startsWith('@') ? userInput : '@' + userInput;
  const cleanName = handle.replace('@','');
  const initials = cleanName.substring(0,2).toUpperCase();
  const colors = ['#1A4B8A','#7A5800','#991B1B','#1A6B3A','#0A0A0A'];
  const newAcc = {
    id: 'acc_' + Date.now(),
    name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
    handle: handle,
    initials: initials,
    avatarColor: colors[state.accounts.length % colors.length],
  };
  state.accounts.push(newAcc);
  state.currentUserId = newAcc.id;
  // Actualizar cabecera
  document.getElementById('hdr-user-avatar').textContent = newAcc.initials;
  document.getElementById('hdr-user-avatar').style.background = newAcc.avatarColor;
  document.getElementById('add-acc-user').value = '';
  closeModal('modal-add-account');
  showToast(`Cuenta ${newAcc.handle} añadida ✓`);
}

window.confirmLogout = function confirmLogout() {
  closeModal('modal-user');
  setTimeout(() => {
    document.getElementById('modal-logout').classList.add('open');
  }, 200);
}

window.doLogout = function doLogout() {
  // Quitar la cuenta actual
  state.accounts = state.accounts.filter(a => a.id !== state.currentUserId);
  if (state.accounts.length === 0) {
    // Re-añadir la cuenta por defecto para que no se quede vacío en demo
    state.accounts = [{ id: 'tu', name: 'Tu cuenta', handle: '@tu_usuario', initials: 'TU', avatarColor: '#0A0A0A' }];
  }
  state.currentUserId = state.accounts[0].id;
  const acc = state.accounts[0];
  document.getElementById('hdr-user-avatar').textContent = acc.initials;
  document.getElementById('hdr-user-avatar').style.background = acc.avatarColor;
  closeModal('modal-logout');
  showToast('Sesión cerrada ✓');
}

/* ════════════════════════════════════════════════════════════════
   PERFIL DE USUARIO
   ════════════════════════════════════════════════════════════════ */

window.openEditProfile = function openEditProfile() {
  closeModal('modal-user');
  setTimeout(() => {
    const acc = state.accounts.find(a => a.id === state.currentUserId);
    if (acc) {
      document.getElementById('ep-avatar').textContent = acc.initials;
      document.getElementById('ep-avatar').style.background = acc.avatarColor;
      document.getElementById('ep-name').value = acc.name === 'Tu cuenta' ? '' : acc.name;
      document.getElementById('ep-handle').value = acc.handle.replace('@', '');
      document.getElementById('ep-phone').value = acc.phone || '';
      document.getElementById('ep-bio').value = acc.bio || '';
    }
    document.getElementById('modal-edit-profile').classList.add('open');
  }, 200);
}

window.submitEditProfile = async function submitEditProfile() {
  const acc = state.accounts.find(a => a.id === state.currentUserId);
  const newName = document.getElementById('ep-name').value.trim();
  const newHandle = document.getElementById('ep-handle').value.trim().replace('@', '');
  const newPhone = document.getElementById('ep-phone').value.trim();
  const newBio = document.getElementById('ep-bio').value.trim();
  
  if (!newName) {
    showToast('El nombre es obligatorio');
    return;
  }
  
  try {
    const { error } = await supabase.from('profiles').update({
      full_name: newName,
      username: newHandle || 'user_' + state.currentUserId.substring(0,8),
      phone: newPhone || null,
      bio: newBio || null
    }).eq('id', state.currentUserId);
    
    if (error) throw error;
    
    // Update local state
    if (acc) {
      acc.name = newName;
      acc.handle = '@' + (newHandle || 'user_' + state.currentUserId.substring(0,8));
      acc.phone = newPhone;
      acc.bio = newBio;
      acc.initials = newName.substring(0,2).toUpperCase();
      document.getElementById('hdr-user-avatar').textContent = acc.initials;
    }
    
    closeModal('modal-edit-profile');
    showToast('Perfil actualizado ✓');
  } catch (error) {
    console.error(error);
    showToast('Error al guardar el perfil');
  }
}

window.openMyStats = function openMyStats() {
  closeModal('modal-user');
  setTimeout(() => document.getElementById('modal-stats').classList.add('open'), 200);
}

window.openNotifications = function openNotifications() {
  closeModal('modal-user');
  setTimeout(() => document.getElementById('modal-notif').classList.add('open'), 200);
}

window.openSettings = function openSettings() {
  closeModal('modal-user');
  setTimeout(() => document.getElementById('modal-settings').classList.add('open'), 200);
}

window.openHelp = function openHelp() {
  closeModal('modal-user');
  setTimeout(() => document.getElementById('modal-help').classList.add('open'), 200);
}

/* ════════════════════════════════════════════════════════════════
   GRUPOS
   ════════════════════════════════════════════════════════════════ */

window.openGroupSheet = function openGroupSheet() {
  renderGroupList();
  document.getElementById('modal-group').classList.add('open');
}

window.renderGroupList = function renderGroupList() {
  const list = document.getElementById('group-list');
  list.innerHTML = state.myGroups.map(g => `
    <div class="group-item" onclick="switchGroup('${g.id}')">
      <div class="group-avatar" style="background:${g.color};">${g.initials}</div>
      <div class="group-info">
        <div class="group-name-row">
          <span class="group-name">${g.name}</span>
          ${g.id === state.currentGroupId ? '<span class="group-active-dot"></span>' : ''}
        </div>
        <div class="group-meta">${g.members} miembros · ${g.plans} planes</div>
      </div>
      ${g.id === state.currentGroupId ? '<span class="pill pill-dark">Activo</span>' : '<span class="pill pill-outline">Cambiar</span>'}
    </div>
  `).join('');
}

window.switchGroup = function switchGroup(id) {
  if (id === state.currentGroupId) {
    closeModal('modal-group');
    return;
  }
  const g = state.myGroups.find(x => x.id === id);
  if (!g) return;
  state.currentGroupId = id;
  // Actualizar cabecera
  document.getElementById('hdr-group-name').textContent = g.name;
  document.getElementById('hdr-group-avatar').textContent = g.initials;
  document.getElementById('hdr-group-avatar').style.background = g.color;
  // Actualizar pantalla de grupo
  document.getElementById('group-name-hero').textContent = g.name;
  document.getElementById('group-meta-hero').textContent = g.desc;
  closeModal('modal-group');
  showToast(`Cambiado a "${g.name}" ✓`);
  
  // Refrescar TODOS los módulos del nuevo grupo
  if (window.loadMembers) window.loadMembers();
  if (window.loadPlans) window.loadPlans();
  if (window.loadExpenses) window.loadExpenses();
  if (window.loadFeed) window.loadFeed();
  if (window.loadRankings) window.loadRankings();
  if (window.loadGroupSettings) window.loadGroupSettings();
  // Reiniciar WebSocket para el nuevo grupo
  if (window.initRealtime) window.initRealtime();
}

window.openSearchGroups = function openSearchGroups() {
  closeModal('modal-group');
  setTimeout(() => document.getElementById('modal-search-groups').classList.add('open'), 200);
}

window.openJoinCode = function openJoinCode() {
  closeModal('modal-group');
  setTimeout(() => document.getElementById('modal-join-code').classList.add('open'), 200);
}

window.submitJoinCode = async function submitJoinCode() {
  const inp = document.querySelector('#modal-join-code .form-input');
  const code = (inp.value || '').toUpperCase().trim();
  if (code.length !== 6) {
    showToast('El código debe tener 6 caracteres');
    return;
  }
  
  try {
    // 1. Buscar el código en group_invites
    const { data: invite, error: inviteErr } = await supabase
      .from('group_invites')
      .select('group_id')
      .eq('code', code)
      .eq('is_active', true)
      .single();
      
    if (inviteErr || !invite) {
      showToast('Código inválido o caducado');
      return;
    }
    
    // 2. Comprobar si ya es miembro
    const { data: member } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', invite.group_id)
      .eq('user_id', state.currentUserId)
      .single();
      
    if (member) {
      showToast('Ya eres miembro de este grupo');
      closeModal('modal-join-code');
      return;
    }

    // 3. Unirse al grupo
    const { error: joinErr } = await supabase
      .from('group_members')
      .insert([{
        group_id: invite.group_id,
        user_id: state.currentUserId,
        role: 'member'
      }]);
      
    if (joinErr) throw joinErr;
    
    showToast(`¡Te has unido al grupo! ✓`);
    closeModal('modal-join-code');
    inp.value = '';
    
    // Reset to force UI refresh
    state.currentGroupId = null;
    await loadUserGroups();
    if (window.switchGroup) window.switchGroup(invite.group_id);
    else window.renderAll();
    
  } catch (error) {
    console.error(error);
    showToast('Error al unirse al grupo');
  }
}

window.requestJoinGroup = function requestJoinGroup(name) {
  closeModal('modal-search-groups');
  showToast(`Solicitud enviada a "${name}" ✓`);
}

window.openCreateGroup = function openCreateGroup() {
  closeModal('modal-group');
  setTimeout(() => document.getElementById('modal-create-group').classList.add('open'), 200);
}

window.submitCreateGroup = async function submitCreateGroup() {
  const name = document.getElementById('cg-name').value.trim();
  const initialsInput = document.getElementById('cg-initials').value.trim().toUpperCase();
  if (!name) {
    showToast('Pon un nombre al grupo');
    return;
  }
  const initials = initialsInput || name.substring(0,2).toUpperCase();
  const colors = ['#1A4B8A','#7A5800','#991B1B','#1A6B3A','#C07000'];
  const color = colors[state.myGroups.length % colors.length];
  
  try {
    // 1. Insert Group
    const groupId = crypto.randomUUID();
    const { error: gError } = await supabase.from('groups').insert([{
      id: groupId,
      name: name,
      initials: initials,
      color: color,
      created_by: state.currentUserId
    }]);
    if (gError) throw gError;

    // 2. Insert Admin Member
    const { error: mError } = await supabase.from('group_members').insert([{
      group_id: groupId,
      user_id: state.currentUserId,
      role: 'admin'
    }]);
    if (mError) throw mError;

    // 3. Insert Settings
    await supabase.from('group_settings').insert([{ group_id: groupId }]);

    // 4. Generate & Insert Invite Code
    const code = Math.random().toString(36).substring(2,8).toUpperCase();
    await supabase.from('group_invites').insert([{
      group_id: groupId,
      code: code,
      created_by: state.currentUserId
    }]);

    showToast('Grupo creado correctamente');
    document.getElementById('cg-name').value = '';
    document.getElementById('cg-initials').value = '';
    closeModal('modal-create-group');
    
    // Reset currentGroupId so switchGroup forces a refresh
    state.currentGroupId = null;
    await loadUserGroups();
    if (window.switchGroup) window.switchGroup(groupId);
    else window.renderAll();

  } catch (error) {
    console.error(error);
    showToast('Error al crear el grupo');
  }
}

window.openInviteSheet = function openInviteSheet() {
  const g = state.myGroups.find(x => x.id === state.currentGroupId);
  if (g) document.getElementById('invite-code').textContent = g.code;
  document.getElementById('modal-invite').classList.add('open');
}

window.copyInviteCode = function copyInviteCode() {
  const code = document.getElementById('invite-code').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => showToast(`Código ${code} copiado ✓`));
  } else {
    showToast(`Código: ${code}`);
  }
}

window.shareInviteLink = function shareInviteLink() {
  const g = state.myGroups.find(x => x.id === state.currentGroupId);
  const link = `koves.app/join/${g.code}`;
  if (navigator.share) {
    navigator.share({ title: `Únete a ${g.name}`, text: `Te invito a unirte a ${g.name} en KOves`, url: 'https://' + link }).catch(()=>{});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(() => showToast(`Enlace copiado: ${link}`));
  } else {
    showToast(link);
  }
}

/* ════════════════════════════════════════════════════════════════
   MEMBER PROFILE
   ════════════════════════════════════════════════════════════════ */

window.openMemberProfile = function openMemberProfile(id) {
  const memberRecord = state.members.find(m => m.profiles && m.profiles.id === id);
  if (!memberRecord) return;
  const m = memberRecord.profiles;
  currentMemberId = id;
  state.currentMemberId = id;
  const setText = (elId, val) => { const e = document.getElementById(elId); if (e) e.textContent = val; };
  const setHtml = (elId, val) => { const e = document.getElementById(elId); if (e) e.innerHTML = val; };

  const fullName = m.full_name || m.username || 'Usuario';
  const initials = (fullName.substring(0, 2)).toUpperCase();
  const avatarBg = m.avatar_url || '#0A0A0A';
  const handle = m.username ? `@${m.username}` : '';
  const isAdmin = memberRecord.role === 'admin';

  const av = document.getElementById('mp-avatar');
  if (av) { av.textContent = initials; av.style.background = avatarBg; }
  setText('mp-name', fullName);
  setText('mp-handle', handle);
  setText('mp-bio', m.bio || '');
  setText('mp-phone', m.phone ? '📱 ' + m.phone : '📱 —');
  
  let pillsHtml = '';
  if (isAdmin) pillsHtml += `<span class="pill pill-outline">Admin</span>`;
  setHtml('mp-pills', pillsHtml);
  
  // KPI ampliado (Por ahora simulado a 0 hasta implementar las consultas de stats)
  setText('mp-attended', '0');
  setText('mp-mvps', '0');
  setText('mp-trds', '0');
  setText('mp-yellows', '0');
  setText('mp-reds', '0');
  // Reset navegación de planes del perfil
  memberPlansMonthOffset = 0;
  const mpNext = document.getElementById('mp-plans-next');
  if (mpNext) mpNext.classList.add('disabled');
  const mpMonth = document.getElementById('mp-plans-month');
  if (mpMonth) {
    const today = new Date();
    mpMonth.textContent = `${meses[today.getMonth()]} ${today.getFullYear()} · Mes actual · Todos los grupos`;
  }
  
  if (window.loadMemberLabels) window.loadMemberLabels(id);
  
  showScreen('member');
}

/* ════════════════════════════════════════════════════════════════
   CREAR PLAN
   ════════════════════════════════════════════════════════════════ */

window.openCreatePlan = function openCreatePlan() {
  // Preset fecha de hoy
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  document.getElementById('cp-date').value = dateStr;
  document.getElementById('cp-time').value = '22:00';
  document.getElementById('modal-create-plan').classList.add('open');
}

window.selectCreateMode = function selectCreateMode(btn, mode) {
  document.querySelectorAll('#modal-create-plan .action-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  btn.dataset.mode = mode;
}

window.submitCreatePlan = async function submitCreatePlan() {
  const title = document.getElementById('cp-title').value.trim();
  if (!title) {
    showToast('Pon un título al plan');
    return;
  }
  const date = document.getElementById('cp-date').value;
  const time = document.getElementById('cp-time').value;
  const place = document.getElementById('cp-place').value.trim();
  const desc = document.getElementById('cp-desc').value.trim();
  const typeStr = document.getElementById('cp-type').value.toLowerCase();
  
  const modeBtn = document.querySelector('#modal-create-plan .action-btn.selected');
  const mode = modeBtn ? modeBtn.dataset.mode : 'confirmado'; 
  
  if (!date || !time) {
    showToast('La fecha y la hora son obligatorias');
    return;
  }

  const status = mode === 'confirmado' ? 'active' : 'pending';
  const modeDb = mode === 'confirmado' ? 'confirmed' : 'proposed';
  
  const isoDate = new Date(`${date}T${time}`).toISOString();

  try {
    const planId = crypto.randomUUID();
    const { error } = await supabase.from('plans').insert([{
      id: planId,
      group_id: state.currentGroupId,
      title: title,
      description: desc,
      location: place,
      type: typeStr,
      event_date: isoDate,
      status: status,
      mode: modeDb,
      created_by: state.currentUserId
    }]);

    if (error) throw error;
    
    // Auto-confirm attendance for creator
    await supabase.from('plan_attendance').insert([{
      plan_id: planId,
      user_id: state.currentUserId,
      status: 'voy'
    }]);

    showToast(`Plan "${title}" creado ✓`);
    closeModal('modal-create-plan');
    
    // Limpiar form
    document.getElementById('cp-title').value = '';
    document.getElementById('cp-date').value = '';
    document.getElementById('cp-time').value = '';
    document.getElementById('cp-place').value = '';
    document.getElementById('cp-desc').value = '';
    
    if (window.loadPlans) await window.loadPlans();

  } catch(error) {
    console.error(error);
    showToast('Error al crear el plan');
  }
}

/* ════════════════════════════════════════════════════════════════
   REGLAS
   ════════════════════════════════════════════════════════════════ */

window.openEditRules = function openEditRules() {
  // Pre-fill con los datos cargados
  if (state.groupSettings) {
    const yEl = document.getElementById('rules-yellow-amount');
    const rEl = document.getElementById('rules-red-amount');
    if (yEl) yEl.value = state.groupSettings.yellow_card_amount || 2;
    if (rEl) rEl.value = state.groupSettings.red_card_amount || 10;
  }
  document.getElementById('modal-rules').classList.add('open');
}

window.submitRules = async function submitRules() {
  if (!state.currentGroupId) return;
  const yellowAmount = parseFloat(document.getElementById('rules-yellow-amount').value) || 2;
  const redAmount = parseFloat(document.getElementById('rules-red-amount').value) || 10;

  try {
    const { error } = await supabase
      .from('group_settings')
      .update({
        yellow_card_amount: yellowAmount,
        red_card_amount: redAmount
      })
      .eq('group_id', state.currentGroupId);

    if (error) throw error;

    state.groupSettings = { ...state.groupSettings, yellow_card_amount: yellowAmount, red_card_amount: redAmount };
    closeModal('modal-rules');
    showToast('Reglas guardadas ✓');
  } catch (err) {
    console.error(err);
    showToast('Error al guardar las reglas');
  }
}

window.loadGroupSettings = async function loadGroupSettings() {
  if (!state.currentGroupId) return;
  const { data, error } = await supabase
    .from('group_settings')
    .select('*')
    .eq('group_id', state.currentGroupId)
    .maybeSingle();

  if (error) {
    console.error('Error loading settings:', error);
    return;
  }
  state.groupSettings = data || { yellow_card_amount: 2, red_card_amount: 10 };
}



/* ════════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════
   V6: VOTACIÓN DE TARJETAS DISCIPLINA
   ════════════════════════════════════════════════════════════════ */
window.voteDiscipline = function voteDiscipline(btn, side) {
  const card = btn.closest('.card');
  if (!card) return;
  // marcar card como votada
  card.style.opacity = '0.6';
  card.style.pointerEvents = 'none';
  showToast(side === 'favor' ? 'Voto a favor registrado ✓' : 'Voto en contra registrado ✓');
}

/* ════════════════════════════════════════════════════════════════
   V6: BOTE DE SANCIONES
   ════════════════════════════════════════════════════════════════ */
  window.loadExpenses = async function loadExpenses() {
    if (!state.currentGroupId) return;
    const { data: expenses, error: err1 } = await supabase
      .from('expenses')
      .select('*, expense_splits(*)')
      .eq('group_id', state.currentGroupId);
      
    if (err1) {
      console.error(err1);
      return;
    }
    
    state.expenses = expenses || [];
    renderExpenses();
  }

  window.renderExpenses = function renderExpenses() {
    let totalGroup = 0;
    let paidByMe = 0;
    let owedToMe = 0;
    let oweToOthers = 0;

    const me = state.currentUserId;

    state.expenses.forEach(exp => {
      totalGroup += exp.amount;
      if (exp.paid_by === me) {
        paidByMe += exp.amount;
      }
      
      const splits = exp.expense_splits || [];
      splits.forEach(split => {
        if (split.user_id === me && exp.paid_by !== me && split.status !== 'paid') {
          oweToOthers += split.amount;
        }
        if (exp.paid_by === me && split.user_id !== me && split.status !== 'paid') {
          owedToMe += split.amount;
        }
      });
    });

    const balance = paidByMe - oweToOthers;

    document.getElementById('kpi-exp-total').textContent = totalGroup.toFixed(2) + '€';
    document.getElementById('kpi-exp-paid').textContent = paidByMe.toFixed(2) + '€';
    document.getElementById('kpi-exp-owed').textContent = owedToMe.toFixed(2) + '€';
    document.getElementById('kpi-exp-owe').textContent = oweToOthers.toFixed(2) + '€';
    
    const balEl = document.getElementById('kpi-exp-balance');
    balEl.textContent = (balance > 0 ? '+' : '') + balance.toFixed(2) + '€';
    if (balance > 0) balEl.style.color = 'var(--green)';
    else if (balance < 0) balEl.style.color = 'var(--red)';
    else balEl.style.color = 'var(--ink)';

    // Popular listas de deudas individuales
    // 1. Te deben
    const owedByMap = {};
    // 2. Tú debes
    const oweToMap = {};

    state.expenses.forEach(exp => {
      const splits = exp.expense_splits || [];
      splits.forEach(split => {
        if (split.status !== 'paid') {
          if (exp.paid_by === me && split.user_id !== me) {
            owedByMap[split.user_id] = (owedByMap[split.user_id] || 0) + split.amount;
          }
          if (split.user_id === me && exp.paid_by !== me) {
            oweToMap[exp.paid_by] = (oweToMap[exp.paid_by] || 0) + split.amount;
          }
        }
      });
    });

    const getProfileName = (id) => {
      const m = state.members.find(x => x.id === id);
      return m ? m.name : 'Usuario';
    };

    const cTeDeben = document.getElementById('pendientes-te-deben');
    if (Object.keys(owedByMap).length === 0) {
      cTeDeben.innerHTML = '<div class="card" style="padding:14px;text-align:center;color:var(--ink3);font-size:12px;">No hay pagos pendientes a tu favor.</div>';
    } else {
      let html = '';
      for (const [uid, amount] of Object.entries(owedByMap)) {
        html += `<div class="card" style="padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:13px;font-weight:600;">${getProfileName(uid)} te debe</div>
          <div style="font-size:15px;font-weight:900;color:var(--green);">+${amount.toFixed(2)}€</div>
        </div>`;
      }
      cTeDeben.innerHTML = html;
    }

    const cTuDebes = document.getElementById('pendientes-tu-debes');
    if (Object.keys(oweToMap).length === 0) {
      cTuDebes.innerHTML = '<div class="card" style="padding:14px;text-align:center;color:var(--ink3);font-size:12px;">No tienes deudas pendientes.</div>';
    } else {
      let html = '';
      for (const [uid, amount] of Object.entries(oweToMap)) {
        html += `<div class="card" style="padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:13px;font-weight:600;">Debes a ${getProfileName(uid)}</div>
          <div style="font-size:15px;font-weight:900;color:var(--red);">${amount.toFixed(2)}€</div>
        </div>`;
      }
      cTuDebes.innerHTML = html;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // TIEMPO REAL (WEBSOCKETS)
  // ════════════════════════════════════════════════════════════════
  let realtimeChannel = null;
  window.initRealtime = function initRealtime() {
    if (!state.currentGroupId) return;
    // Desuscribirse del canal anterior si existe
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    realtimeChannel = supabase.channel(`group_${state.currentGroupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `group_id=eq.${state.currentGroupId}` }, payload => {
        if (window.loadFeed) window.loadFeed();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${state.currentGroupId}` }, payload => {
        if (window.loadExpenses) window.loadExpenses();
        if (window.loadFeed) window.loadFeed();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans', filter: `group_id=eq.${state.currentGroupId}` }, payload => {
        if (window.loadPlans) window.loadPlans();
        if (window.loadFeed) window.loadFeed();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🔗 Suscrito en tiempo real al grupo', state.currentGroupId);
        }
      });
  }

  // Carga paralela de componentes al cambiar de contexto o iniciar
  



/* ════════════════════════════════════════════════════════════════
   V5/V6: AGENDA TAB SWITCH (compatibilidad — pantalla agenda eliminada)
   ════════════════════════════════════════════════════════════════ */
window.switchAgendaTab = function switchAgendaTab(el, name) {
  // noop — la pantalla de agenda ya no existe en V6
}

/* ════════════════════════════════════════════════════════════════
   V6: CALENDARIO MENSUAL CON FLECHAS LATERALES
   ════════════════════════════════════════════════════════════════ */
const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
// Días con plan por mes (clave: 'YYYY-M')
// Cada día con plan lleva tu estado de asistencia:
// voy = verde · novoy = rojo · quizas = azul · tarde = ámbar oscuro
const planDays = {
  '2026-2': { 12: 'voy', 22: 'novoy' },
  '2026-3': { 5: 'voy', 19: 'novoy' },
  '2026-4': { 2: 'voy', 10: 'voy', 22: 'tarde', 23: 'voy', 27: 'quizas', 29: 'novoy' },
  '2026-5': { 14: 'voy', 20: 'quizas' },
  '2026-6': { 5: 'voy' },
};

window.renderCalendar = function renderCalendar() {
  const grid = document.getElementById('cal-month-grid');
  const label = document.getElementById('cal-month-label');
  if (!grid || !label) return;

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();
  const offset = state.calendarMonthOffset;

  const d = new Date(todayY, todayM + offset, 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  const key = `${y}-${m}`;

  label.textContent = `${meses[m]} ${y}${offset === 0 ? '' : ''}`;

  let html = '<div class="cal-dayname">L</div><div class="cal-dayname">M</div><div class="cal-dayname">X</div><div class="cal-dayname">J</div><div class="cal-dayname">V</div><div class="cal-dayname">S</div><div class="cal-dayname">D</div>';

  // Primer día del mes ajustado a lunes=0
  const firstDay = new Date(y, m, 1).getDay();
  let leadingEmpty = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < leadingEmpty; i++) html += `<div></div>`;

  const lastDate = new Date(y, m + 1, 0).getDate();
  const planMap = planDays[key] || {};
  const todayKey = `${todayY}-${todayM}`;

  for (let day = 1; day <= lastDate; day++) {
    const isToday = (key === todayKey && day === todayD);
    const dayDate = new Date(y, m, day);
    const isPastDay = dayDate < new Date(todayY, todayM, todayD);
    const attendance = planMap[day];   // 'voy' | 'novoy' | 'quizas' | 'tarde' | undefined
    let dayCls = 'cal-day';
    if (isToday) dayCls += ' today';
    else if (isPastDay) dayCls += ' past';
    if (attendance) dayCls += ' has-plan att-' + attendance;
    const isFuture = !isPastDay;
    html += `<div class="${dayCls}" onclick="showCalModal('${day}', ${isFuture})">${day}</div>`;
  }
  grid.innerHTML = html;
}

// Estado de mes compartido entre el calendario y los planes activos
window.syncMonthLabels = function syncMonthLabels() {
  const offset = state.calendarMonthOffset;
  const d = new Date(2026, 4 + offset, 1);
  const label = `${meses[d.getMonth()]} ${d.getFullYear()}`;
  const calLbl = document.getElementById('cal-month-label');
  const planLbl = document.getElementById('plans-act-month');
  if (calLbl) calLbl.textContent = label;
  if (planLbl) planLbl.textContent = label;
}

window.calendarNav = function calendarNav(delta) {
  state.calendarMonthOffset += delta;
  renderCalendar();
  syncMonthLabels();
  syncHistPlansLabel();
}

// Navegador de meses de planes activos — sincronizado con el calendario
window.plansMonthNav = function plansMonthNav(delta) {
  state.calendarMonthOffset += delta;
  renderCalendar();
  syncMonthLabels();
  syncHistPlansLabel();
}

// Mantener la etiqueta del historial de planes alineada con el offset del calendario
window.syncHistPlansLabel = function syncHistPlansLabel() {
  histPlansOffset = state.calendarMonthOffset;
  const d = new Date(2026, 4 + histPlansOffset, 1);
  const lbl = document.getElementById('hist-plans-month');
  if (lbl) lbl.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
  const next = document.getElementById('hist-plans-next');
  if (next) next.classList.toggle('disabled', histPlansOffset >= 0);
}

// Navegador de meses del historial de planes
let histPlansOffset = 0;
window.histPlansNav = function histPlansNav(delta) {
  const n = histPlansOffset + delta;
  if (n > 0) return;
  histPlansOffset = n;
  const next = document.getElementById('hist-plans-next');
  if (next) next.classList.toggle('disabled', histPlansOffset >= 0);
  const d = new Date(2026, 4 + histPlansOffset, 1);
  const lbl = document.getElementById('hist-plans-month');
  if (lbl) lbl.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
  // Sincronizar el calendario con el historial
  state.calendarMonthOffset = histPlansOffset;
  renderCalendar();
  syncMonthLabels();
}

// Popup de detalle de estadística del perfil de miembro
window.openStatSheet = function openStatSheet(kind) {
  const cfg = {
    asistidos: {
      title: 'Planes asistidos',
      intro: 'Todos los planes a los que ha asistido, de todos sus grupos.',
      items: [
        { l: '10 May · EL CLUB', n: 'Cumpleaños de Carlos', t: '✓', tc: 'pill-green' },
        { l: '2 May · EL CLUB', n: 'Cena italiana', t: '✓', tc: 'pill-green' },
        { l: '18 Abr · La Cuadrilla', n: 'Fútbol y cañas', t: '✓', tc: 'pill-green' },
        { l: '12 Abr · Equipo BBVA', n: 'Comida de empresa', t: '✓', tc: 'pill-green' },
      ],
    },
    mvps: {
      title: 'MVPs conseguidos',
      intro: 'Planes en los que fue elegido MVP.',
      items: [
        { l: '2 May · EL CLUB', n: 'Cena italiana', t: 'MVP', tc: 'pill-dark' },
        { l: '5 Abr · La Cuadrilla', n: 'Escapada a la playa', t: 'MVP', tc: 'pill-dark' },
        { l: '8 Mar · EL CLUB', n: 'Karaoke nocturno', t: 'MVP', tc: 'pill-dark' },
      ],
    },
    trds: {
      title: 'Veces más tardón',
      intro: 'Planes en los que fue el más tardón.',
      items: [
        { l: '19 Abr · EL CLUB', n: 'Concierto + fiesta', t: 'TRD', tc: 'pill-red' },
        { l: '22 Mar · Equipo BBVA', n: 'Cena de empresa', t: 'TRD', tc: 'pill-red' },
      ],
    },
    amarillas: {
      title: 'Tarjetas amarillas',
      intro: 'Amarillas recibidas, indicando el grupo.',
      items: [
        { l: '10 May · EL CLUB', n: 'Llegó 2h tarde', t: 'Amarilla', tc: 'pill-amber' },
        { l: '15 Abr · La Cuadrilla', n: 'No pagó su parte', t: 'Amarilla', tc: 'pill-amber' },
        { l: '2 Mar · EL CLUB', n: 'Faltó sin avisar', t: 'Amarilla', tc: 'pill-amber' },
      ],
    },
    rojas: {
      title: 'Tarjetas rojas',
      intro: 'Rojas recibidas, indicando el grupo.',
      items: [
        { l: '28 Abr · EL CLUB', n: 'Ofensa al grupo', t: 'Roja', tc: 'pill-red' },
      ],
    },
  };
  const c = cfg[kind];
  if (!c) return;
  document.getElementById('stat-modal-title').firstChild.textContent = c.title + ' ';
  document.getElementById('stat-modal-content').innerHTML = `
    <div class="notice" style="margin-bottom:12px;">${c.intro}</div>
    <div class="card" style="padding:0 14px;">
      ${c.items.map((it, i) => `
        <div class="expense-item" ${i === c.items.length - 1 ? 'style="border-bottom:0;"' : ''}>
          <div class="exp-left"><div class="exp-info"><div class="exp-name">${it.n}</div><div class="exp-sub">${it.l}</div></div></div>
          <span class="pill ${it.tc}">${it.t}</span>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('modal-stat').classList.add('open');
}

// Popup de KPI: lista de planes pendientes o activos
window.openKpiSheet = function openKpiSheet(kind) {
  const title = document.getElementById('kpi-modal-title');
  const content = document.getElementById('kpi-modal-content');
  let planes = [];
  if (kind === 'pendientes') {
    title.firstChild.textContent = 'Planes pendientes ';
    // Planes activos en los que aún NO has marcado tu asistencia
    planes = [
      { id: 'quedada', label: 'Hoy · 22:30', name: 'Quedada en el piso', tag: 'Pendiente', tagCls: 'attendance-tag pendiente' },
    ];
  } else {
    title.firstChild.textContent = 'Planes activos ';
    // Solo los planes a los que has dicho que asistirás (✓ Voy)
    planes = [
      { id: 'fiesta-ana', label: 'Sáb 14 Jun · 23:00', name: 'Fiesta en casa de Ana', tag: '✓ Voy', tagCls: 'attendance-tag voy' },
    ];
  }
  content.innerHTML = planes.length ? planes.map(p => `
    <div class="card-row" style="border:1px solid var(--line);border-radius:var(--r);margin-bottom:8px;" onclick="closeModal('modal-kpi');openPlan('${p.id}')">
      <div class="card-content">
        <div class="card-label">${p.label}</div>
        <div class="card-name">${p.name}</div>
      </div>
      <span class="${p.tagCls}">${p.tag}</span>
    </div>
  `).join('') : `<div class="empty"><div class="empty-icon">📭</div><div class="empty-title">Nada por aquí</div></div>`;
  document.getElementById('modal-kpi').classList.add('open');
}

// Expulsar miembro (solo admin)
window.kickMember = function kickMember(btn, name) {
  const row = btn.closest('.member-row');
  if (row) {
    row.style.transition = 'opacity .25s, transform .25s';
    row.style.opacity = '0';
    row.style.transform = 'translateX(40px)';
    setTimeout(() => row.remove(), 260);
  }
  showToast(`${name} ha sido expulsado del grupo`);
}

// Salir del grupo
window.leaveGroup = function leaveGroup() {
  if (state.isAdmin) {
    // Un grupo no puede quedarse sin administrador
    openTransferAdmin();
  } else {
    showToast('Has salido del grupo (simulado)');
  }
}

// Traspaso de admin obligatorio al salir
window.openTransferAdmin = function openTransferAdmin() {
  const body = document.getElementById('transfer-admin-body');
  // Miembros candidatos (todos menos tú y los que ya son admin distintos)
  const candidates = [
    { id: 'mario', name: 'Mario', initials: 'MR', bg: '#C07000' },
    { id: 'pablo', name: 'Pablo', initials: 'PB', bg: 'var(--ink)' },
    { id: 'lucas', name: 'Lucas', initials: 'LC', bg: 'var(--line2)' },
    { id: 'sergio', name: 'Sergio', initials: 'SR', bg: 'var(--ink)' },
    { id: 'marta', name: 'Marta', initials: 'MT', bg: 'var(--ink)' },
  ];
  body.innerHTML = `
    <div class="notice" style="margin-bottom:14px;">Eres administrador de este grupo. Antes de salir debes nombrar a otro administrador: un grupo no puede quedarse sin admin.</div>
    <div class="card" style="padding:0 14px;">
      ${candidates.map((c, i) => `
        <div class="account-item" ${i === candidates.length - 1 ? 'style="border-bottom:0;"' : ''} onclick="confirmTransferAdmin('${c.name}')">
          <div class="account-avatar" style="background:${c.bg};">${c.initials}</div>
          <div class="account-info"><div class="account-name">${c.name}</div><div class="account-handle">Nombrar admin y salir</div></div>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('modal-transfer-admin').classList.add('open');
}
window.confirmTransferAdmin = function confirmTransferAdmin(name) {
  closeModal('modal-transfer-admin');
  showToast(`${name} es el nuevo administrador · Has salido del grupo`);
}

/* ════════════════════════════════════════════════════════════════
   V8: COMENTARIOS — REPLY ESTILO INSTAGRAM (por comment-id exacto)
   ════════════════════════════════════════════════════════════════ */
let pendingReplyTo = null;       // @handle al que se responde
let pendingReplyRootId = null;   // id del comentario RAÍZ donde anidar el hilo
let commentSeq = 100;            // generador de IDs únicos

// startReply recibe el handle y el id del comentario donde se pulsó "Responder".
// Si ese comentario es una respuesta, se sube hasta el comentario raíz para
// que TODO el hilo quede bajo el comentario original (igual que Instagram),
// pero la mención @ es la de la persona a la que realmente respondiste.
window.startReply = function startReply(authorHandle, commentId) {
  pendingReplyTo = authorHandle;
  // Buscar el elemento exacto por su data-comment-id
  let el = document.querySelector(`[data-comment-id="${commentId}"]`);
  if (el) {
    // Si es una respuesta, subir al comentario raíz contenedor
    const rootComment = el.closest('.comment');
    pendingReplyRootId = rootComment ? rootComment.dataset.commentId : commentId;
  } else {
    pendingReplyRootId = commentId;
  }
  const input = document.getElementById('comment-input');
  if (input) {
    input.value = `${authorHandle} `;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

window.addComment = function addComment() {
  const input = document.getElementById('comment-input');
  const val = input.value.trim();
  if (!val) { showToast('Escribe algo antes de enviar'); return; }

  const acc = state.accounts.find(a => a.id === state.currentUserId);
  const name = (acc.name === 'Tu cuenta') ? 'Tú' : acc.name.split(' ')[0];
  const time = `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2,'0')}`;
  const authorHandle = '@' + (acc.handle.replace('@','').toLowerCase());
  const valHtml = escapeHtml(val).replace(/@([\w]+)/g, '<strong style="color:var(--ink);">@$1</strong>');
  const newId = 'c' + (commentSeq++);

  const startsWithMention = /^@[\w]+\s/.test(val);

  if (startsWithMention && pendingReplyRootId) {
    // Es una respuesta: anidar en el hilo del comentario RAÍZ correcto
    const rootComment = document.querySelector(`.comment[data-comment-id="${pendingReplyRootId}"]`);
    if (rootComment) {
      let thread = rootComment.querySelector('.comment-reply-thread');
      if (!thread) {
        thread = document.createElement('div');
        thread.className = 'comment-reply-thread';
        rootComment.appendChild(thread);
      }
      const reply = document.createElement('div');
      reply.className = 'comment-reply';
      reply.dataset.author = authorHandle;
      reply.dataset.commentId = newId;
      reply.innerHTML = `
        <div class="comment-header">
          <div class="comment-avatar" style="background:var(--blue);">${acc.initials}</div>
          <div class="comment-author">${name}</div>
          <div class="comment-time">${time}</div>
        </div>
        <div class="comment-text">${valHtml}</div>
        <div class="comment-actions">
          <span class="comment-action" onclick="likeComment(this)">❤ 0</span>
          <span class="comment-action" onclick="startReply('${authorHandle}','${newId}')">Responder</span>
        </div>
      `;
      thread.appendChild(reply);
    }
  } else {
    // Comentario nuevo de primer nivel
    const list = document.getElementById('comments-list');
    const div = document.createElement('div');
    div.className = 'comment';
    div.dataset.author = authorHandle;
    div.dataset.commentId = newId;
    div.innerHTML = `
      <div class="comment-header">
        <div class="comment-avatar" style="background:var(--blue);">${acc.initials}</div>
        <div class="comment-author">${name}</div>
        <div class="comment-time">${time}</div>
      </div>
      <div class="comment-text">${valHtml}</div>
      <div class="comment-actions">
        <span class="comment-action" onclick="likeComment(this)">❤ 0</span>
        <span class="comment-action" onclick="startReply('${authorHandle}','${newId}')">Responder</span>
      </div>
      <div class="comment-reply-thread"></div>
    `;
    list.appendChild(div);
  }

  input.value = '';
  pendingReplyTo = null;
  pendingReplyRootId = null;
  const cnt = document.getElementById('comment-count');
  const cnt2 = document.getElementById('comment-count-2');
  if (cnt) cnt.textContent = parseInt(cnt.textContent) + 1;
  if (cnt2) cnt2.textContent = parseInt(cnt2.textContent) + 1;
  showToast('Comentario publicado ✓');
}

/* ════════════════════════════════════════════════════════════════
   V5: PODIUM PICKER (MVP / TARDÓN)
   ════════════════════════════════════════════════════════════════ */
let currentPodium = { type: 'mvp', position: 1 };



window.pickPodium = function pickPodium(name) {
  const { type, position } = currentPodium;
  state.ranking[type][position - 1] = name;
  // Actualizar UI
  const slot = document.getElementById(`${type}-slot-${position}`);
  if (slot) {
    slot.textContent = name;
    slot.classList.remove('podium-empty');
    slot.parentElement.parentElement.classList.add('filled');
  }
  closeModal('modal-podium-picker');
}



// Lista dinámica de tardones (N personas, -2 pts cada una)
window.renderTardonList = function renderTardonList() {
  const wrap = document.getElementById('tardon-list');
  if (!wrap) return;
  const list = state.ranking.tardon || [];
  if (!list.length) {
    wrap.innerHTML = '<div style="font-size:11px;color:var(--ink3);padding:8px 0;">Nadie marcado como tardón.</div>';
    return;
  }
  wrap.innerHTML = list.map((name, idx) => `
    <div class="podium-slot filled" style="cursor:default;">
      <div class="podium-pos" style="background:#FFE4E4;color:var(--red);">${name.substring(0,2).toUpperCase()}</div>
      <div style="flex:1;"><div class="podium-name">${name}</div></div>
      <div class="podium-pts" style="color:var(--red);">−2 PTS</div>
      <span class="comment-action" style="margin-left:8px;" onclick="removeTardonPerson(${idx})">Quitar</span>
    </div>
  `).join('');
}



window.addTardonPerson = function addTardonPerson(name) {
  if (!state.ranking.tardon) state.ranking.tardon = [];
  if (!state.ranking.tardon.includes(name)) state.ranking.tardon.push(name);
  renderTardonList();
  closeModal('modal-podium-picker');
}

window.removeTardonPerson = function removeTardonPerson(idx) {
  state.ranking.tardon.splice(idx, 1);
  renderTardonList();
}



/* ════════════════════════════════════════════════════════════════
   V5: showAddExpense con flag para ocultar selector "Asociado al plan"
   ════════════════════════════════════════════════════════════════ */
window.showAddExpense = function showAddExpense(fromPlan = false) {
  document.getElementById('exp-title-input').value = '';
  document.getElementById('exp-amount-input').value = '';

  const selector = document.getElementById('exp-plan-selector');
  if (selector) selector.style.display = fromPlan ? 'none' : 'block';

  // Populate plans
  const planSelect = document.getElementById('exp-plan-input');
  if (planSelect && !fromPlan) {
    planSelect.innerHTML = '<option value="">Sin plan asociado</option>';
    if (state.plans) {
      state.plans.forEach(p => {
        const d = new Date(p.event_date);
        const dateStr = d.toLocaleString('es-ES', {month:'short', day:'numeric'});
        planSelect.innerHTML += `<option value="${p.id}">${p.title} · ${dateStr}</option>`;
      });
    }
  }

  // Populate participants
  const partContainer = document.getElementById('exp-participants');
  if (partContainer) {
    partContainer.innerHTML = '';
    state.members.forEach(m => {
      if (m.profiles) {
        const name = m.profiles.full_name || m.profiles.username || 'Usuario';
        partContainer.innerHTML += `<div class="pill pill-dark" data-id="${m.profiles.id}" style="cursor:pointer;" onclick="toggleParticipant(this)">${name}</div>`;
      }
    });
  }

  document.getElementById('modal-expense').classList.add('open');
}

/* ════════════════════════════════════════════════════════════════
   V5: CHATS
   ════════════════════════════════════════════════════════════════ */
window.openChat = async function openChat(chatId, name, initials, color, kind) {
  state.currentChat = chatId;
  state.currentChatKind = kind;
  document.getElementById('conv-avatar').textContent = initials;
  document.getElementById('conv-avatar').style.background = color;
  document.getElementById('conv-name').textContent = name;
  document.getElementById('conv-sub').textContent = kind === 'group' ? `${state.myGroups.find(g=>g.id===state.currentGroupId)?.members || 0} miembros` : 'Activo ahora';
  
  // Cargar mensajes reales de Supabase
  await loadChatMessages(chatId, kind);
  renderConversation();
  showScreen('conversation');
}

async function loadChatMessages(chatId, kind) {
  let query;
  if (kind === 'group') {
    // Chat grupal: mensajes con group_id y sin recipient_id
    query = supabase
      .from('messages')
      .select('*, profiles:sender_id(full_name, username)')
      .eq('group_id', state.currentGroupId)
      .is('recipient_id', null)
      .order('created_at', { ascending: true })
      .limit(100);
  } else {
    // Chat privado: mensajes entre yo y el otro usuario
    query = supabase
      .from('messages')
      .select('*, profiles:sender_id(full_name, username)')
      .or(`and(sender_id.eq.${state.currentUserId},recipient_id.eq.${chatId}),and(sender_id.eq.${chatId},recipient_id.eq.${state.currentUserId})`)
      .order('created_at', { ascending: true })
      .limit(100);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error loading chat:', error);
    state.chatMessages[chatId] = [];
    return;
  }

  state.chatMessages[chatId] = (data || []).map(m => ({
    from: m.sender_id === state.currentUserId ? 'me' : m.sender_id,
    fromName: m.profiles ? (m.profiles.full_name || m.profiles.username || 'Usuario') : 'Usuario',
    text: m.text,
    time: new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }));
}

window.backFromChat = function backFromChat() {
  goBack();
}

window.renderConversation = function renderConversation() {
  const body = document.getElementById('conv-body');
  const msgs = state.chatMessages[state.currentChat] || [];
  const isGroup = state.currentChatKind === 'group';

  if (msgs.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:40px 20px;font-size:12px;color:var(--ink3);">No hay mensajes. ¡Sé el primero en escribir!</div>';
    return;
  }

  body.innerHTML = msgs.map(m => {
    const mine = m.from === 'me';
    let authorName = '';
    if (isGroup && !mine) {
      authorName = `<div class="msg-author">${m.fromName}</div>`;
    }
    return `
      <div class="msg-group ${mine ? 'me' : 'them'}">
        ${authorName}
        <div class="msg-bubble ${mine ? 'me' : 'them'}">${escapeHtml(m.text)}</div>
        <div class="msg-time" style="text-align:${mine ? 'right' : 'left'};">${m.time}</div>
      </div>
    `;
  }).join('');
  setTimeout(() => body.scrollIntoView({ block: 'end' }), 50);
}

window.sendChatMessage = async function sendChatMessage() {
  const input = document.getElementById('conv-input');
  const val = input.value.trim();
  if (!val) return;
  input.value = '';

  const isGroup = state.currentChatKind === 'group';
  const msgData = {
    sender_id: state.currentUserId,
    text: val,
  };

  if (isGroup) {
    msgData.group_id = state.currentGroupId;
  } else {
    msgData.recipient_id = state.currentChat;
  }

  // Insertar optimistamente en la UI
  if (!state.chatMessages[state.currentChat]) state.chatMessages[state.currentChat] = [];
  const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  state.chatMessages[state.currentChat].push({ from: 'me', fromName: 'Tú', text: val, time });
  renderConversation();

  // Guardar en Supabase
  const { error } = await supabase.from('messages').insert([msgData]);
  if (error) {
    console.error('Error sending message:', error);
    showToast('Error al enviar mensaje');
  }
}

window.openChatWith = function openChatWith(memberId) {
  // Buscar en state.members (datos reales de Supabase)
  const memberRecord = state.members.find(m => m.profiles && m.profiles.id === memberId);
  if (!memberRecord || !memberRecord.profiles) {
    showToast('Miembro no encontrado');
    return;
  }
  const p = memberRecord.profiles;
  const name = p.full_name || p.username || 'Usuario';
  const initials = name.substring(0, 2).toUpperCase();
  const color = p.avatar_url || '#0A0A0A';
  openChat(memberId, name, initials, color, 'private');
}

/* ════════════════════════════════════════════════════════════════
   V5: STANDINGS (CLASIFICACIÓN tipo Liga)
   ════════════════════════════════════════════════════════════════ */
// (Old renderStandings with mock standingsHistory removed — using Supabase-connected version below)

/* ════════════════════════════════════════════════════════════════
   V6: ESTADISTICAS Y RANKINGS
   ════════════════════════════════════════════════════════════════ */


/* ════════════════════════════════════════════════════════════════
   V6: SWITCHES DE PESTAÑAS NUEVAS
   ════════════════════════════════════════════════════════════════ */
window.switchPendientesTab = function switchPendientesTab(el, name) {
  const wrap = el.closest('.section');
  wrap.querySelectorAll('.split-toggle-item').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('pendientes-te-deben').style.display = name === 'te-deben' ? 'block' : 'none';
  document.getElementById('pendientes-tu-debes').style.display = name === 'tu-debes' ? 'block' : 'none';
}

window.switchHistorialTab = function switchHistorialTab(el, name) {
  const wrap = el.closest('.section');
  wrap.querySelectorAll('.split-toggle-item').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('historial-gastos').style.display = name === 'gastos' ? 'block' : 'none';
  document.getElementById('historial-transferencias').style.display = name === 'transferencias' ? 'block' : 'none';
}



window.switchActivityTab = function switchActivityTab(el, name) {
  el.parentElement.querySelectorAll('.split-toggle-item').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('activity-planes').style.display = name === 'planes' ? 'block' : 'none';
  document.getElementById('activity-disciplina').style.display = name === 'disciplina' ? 'block' : 'none';
  document.getElementById('activity-reclamaciones').style.display = name === 'reclamaciones' ? 'block' : 'none';
}

// Sub-selector Activas / Historial de reclamaciones
window.switchReclamTab = function switchReclamTab(el, name) {
  el.parentElement.querySelectorAll('.split-toggle-item').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('reclam-activas').style.display = name === 'activas' ? 'block' : 'none';
  document.getElementById('reclam-historial').style.display = name === 'historial' ? 'block' : 'none';
}

// Navegador de meses del historial de reclamaciones
let reclamHistOffset = -1;
window.reclamHistNav = function reclamHistNav(delta) {
  const n = reclamHistOffset + delta;
  if (n >= 0) return;
  reclamHistOffset = n;
  const d = new Date(2026, 4 + reclamHistOffset, 1);
  const lbl = document.getElementById('reclam-hist-month');
  if (lbl) lbl.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// Resolver una reclamación (solo admin)
window.resolveReclam = function resolveReclam(btn, action) {
  if (!state.isAdmin) { showToast('Solo el administrador puede resolver reclamaciones'); return; }
  const card = btn.closest('.card');
  if (card) {
    card.style.transition = 'opacity .25s';
    card.style.opacity = '.5';
    const btnRow = btn.parentElement;
    if (btnRow) btnRow.innerHTML = `<span class="pill ${action === 'validar' ? 'pill-green' : 'pill-outline'}" style="margin:0 auto;">${action === 'validar' ? '✓ Validada' : 'Rechazada'}</span>`;
  }
  showToast(action === 'validar' ? 'Reclamación validada ✓' : 'Reclamación rechazada');
}

// Nueva reclamación — siempre se inicia desde un plan (un pago o una tarjeta)
let newReclamType = 'gasto';
let newReclamContext = '';
window.openReclamFor = function openReclamFor(type, contextLabel) {
  newReclamType = type;
  newReclamContext = contextLabel || '';
  const motivo = document.getElementById('reclam-motivo');
  if (motivo) motivo.value = '';
  // Mostrar el contexto en el modal
  const ctxEl = document.getElementById('reclam-context');
  if (ctxEl) {
    const typeLabel = type === 'tarjeta' ? 'Tarjeta' : (type === 'pago' ? 'Pago' : 'Gasto');
    ctxEl.innerHTML = `<span class="pill ${type === 'tarjeta' ? 'pill-red' : 'pill-amber'}">${typeLabel}</span> <span style="font-size:12px;color:var(--ink3);">${newReclamContext}</span>`;
  }
  document.getElementById('modal-new-reclam').classList.add('open');
}
window.submitReclam = function submitReclam() {
  const motivo = document.getElementById('reclam-motivo').value.trim();
  if (!motivo) { showToast('Debes explicar el motivo de la reclamación'); return; }
  closeModal('modal-new-reclam');
  showToast('Reclamación enviada · Pendiente de revisión del admin ✓');
}

// Aplicar visibilidad de admin a las reclamaciones
window.applyReclamAdminVisibility = function applyReclamAdminVisibility() {
  const isAdmin = state.isAdmin;
  document.querySelectorAll('#activity-reclamaciones .btn-primary, #activity-reclamaciones .btn-secondary').forEach(b => {
    if (b.textContent === 'Validar' || b.textContent === 'Rechazar') {
      b.disabled = !isAdmin;
      b.style.opacity = isAdmin ? '1' : '.45';
    }
  });
  document.querySelectorAll('.reclam-admin-only').forEach(h => {
    h.style.display = isAdmin ? 'none' : 'block';
  });
}

/* ════════════════════════════════════════════════════════════════
   V6: REGLAS — mostrar/ocultar editar según admin
   ════════════════════════════════════════════════════════════════ */
window.applyAdminVisibility = function applyAdminVisibility() {
  const btn = document.getElementById('rules-edit-btn');
  const hint = document.getElementById('rules-admin-hint');
  if (!btn || !hint) return;
  if (state.isAdmin) {
    btn.style.display = '';
    hint.textContent = 'Solo los administradores pueden modificar las reglas. Tú eres admin en este grupo.';
  } else {
    btn.style.display = 'none';
    hint.textContent = 'Solo los administradores pueden modificar las reglas. Tú no eres admin en este grupo.';
  }
}

/* ════════════════════════════════════════════════════════════════
   V7: NUEVAS FUNCIONES
   ════════════════════════════════════════════════════════════════ */

// Abrir chat grupal directamente desde el header
window.openGroupChat = function openGroupChat() {
  if (!state.currentGroupId) return;
  const g = state.myGroups.find(x => x.id === state.currentGroupId);
  const name = g ? g.name : 'Grupo';
  const initials = g ? g.initials : 'G';
  const color = g ? g.color : '#0A0A0A';
  openChat('group', name, initials, color, 'group');
}

// Liquidar deuda individual
window.openLiquidarItem = function openLiquidarItem(toId, amount) {
  const nameMap = { carlos: 'Carlos', mario: 'Mario', pablo: 'Pablo', ana: 'Ana', lucas: 'Lucas', javi: 'Javi', sergio: 'Sergio', marta: 'Marta' };
  liqCurrentTo = toId;
  document.getElementById('liq-item-name').textContent = 'Debes a ' + (nameMap[toId] || toId);
  document.getElementById('liq-item-amount').textContent = '−' + amount;
  document.getElementById('modal-liquidar-item').classList.add('open');
}

let liqUploaded = false;
let liqCurrentTo = null;
window.handleLiqUpload = function handleLiqUpload() {
  liqUploaded = true;
  const zone = document.getElementById('liq-upload-zone');
  if (zone) { zone.style.borderColor = 'var(--green)'; zone.innerHTML = '<div class="upload-label" style="color:var(--green)">✓ Comprobante adjuntado</div>'; }
}
window.confirmLiquidar = function confirmLiquidar() {
  if (!liqUploaded) { showToast('Debes adjuntar el comprobante primero'); return; }
  closeModal('modal-liquidar-item');
  liqUploaded = false;
  // El botón de esa deuda pasa a "Liquidado"
  if (liqCurrentTo) {
    const btn = document.getElementById('liq-btn-' + liqCurrentTo);
    if (btn) {
      btn.textContent = '✓ Liquidado';
      btn.disabled = true;
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
      btn.onclick = null;
    }
  }
  showToast('Pago liquidado · La otra persona debe confirmar la recepción ✓');
}

// Parpadeo de pendientes: activar/desactivar según número
window.initPendingBlink = function initPendingBlink() {
  const numEl = document.getElementById('kpi-pending-num');
  const num = parseInt(numEl?.textContent || '0');
  const bar = document.getElementById('kpi-pending-bar');
  const cards = document.querySelectorAll('#s-plans .card.pending-border');
  if (num > 0) {
    // KPI: solo número y barra
    if (numEl) numEl.classList.add('pending-blink');
    if (bar) bar.classList.add('pending-blink');
    // Cards: el borde parpadea + el tag "Pendiente" parpadea
    cards.forEach(c => {
      c.classList.add('pending-blink');
      const tag = c.querySelector('.attendance-tag.pendiente');
      if (tag) tag.classList.add('pending-blink');
    });
  } else {
    if (numEl) numEl.classList.remove('pending-blink');
    if (bar) bar.classList.remove('pending-blink');
    cards.forEach(c => {
      c.classList.remove('pending-blink');
      const tag = c.querySelector('.attendance-tag.pendiente');
      if (tag) tag.classList.remove('pending-blink');
    });
  }
}

// Navegación de planes del perfil de miembro por mes
let memberPlansMonthOffset = 0;
window.memberPlansNav = function memberPlansNav(delta) {
  memberPlansMonthOffset += delta;
  const next = document.getElementById('mp-plans-next');
  if (next) next.classList.toggle('disabled', memberPlansMonthOffset >= 0);
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth() + memberPlansMonthOffset, 1);
  const label = `${meses[d.getMonth()]} ${d.getFullYear()}${memberPlansMonthOffset === 0 ? ' · Mes actual' : ''}`;
  const labelEl = document.getElementById('mp-plans-month');
  if (labelEl) labelEl.textContent = label + ' · Todos los grupos';
  // En una app real aquí se recargarían los planes; mostramos un placeholder
  if (memberPlansMonthOffset < 0) {
    const listEl = document.getElementById('mp-plans-list');
    if (listEl) listEl.innerHTML = `<div class="card" style="padding:18px 14px;text-align:center;"><div style="font-size:12px;color:var(--ink3);">Cargando planes de ${meses[d.getMonth()]}…</div></div>`;
  }
}

// Cargar fotos reales del plan
window.loadPlanPhotos = async function loadPlanPhotos(planId) {
  const grid = document.getElementById('plan-photos-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;font-size:12px;color:var(--ink3);">Cargando fotos...</div>';

  const { data: photos, error } = await supabase
    .from('plan_photos')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading photos:', error);
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;font-size:12px;color:var(--ink3);">Error al cargar fotos</div>';
    return;
  }

  if (!photos || photos.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;font-size:12px;color:var(--ink3);">No hay fotos todavía.</div>';
    return;
  }

  grid.innerHTML = photos.map(p => `
    <div style="aspect-ratio:1;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--line);background-image:url('${p.photo_url}');background-size:cover;background-position:center;"></div>
  `).join('');
}

// Subir foto real a Supabase Storage
window.handleRealPhotoUpload = async function handleRealPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!state.currentPlanId) {
    showToast('Abre un plan primero');
    return;
  }

  const grid = document.getElementById('plan-photos-grid');
  const tempDiv = document.createElement('div');
  tempDiv.style.cssText = 'aspect-ratio:1;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink3);';
  tempDiv.innerHTML = 'Subiendo...';
  if (grid.innerHTML.includes('No hay fotos todavía')) grid.innerHTML = '';
  grid.prepend(tempDiv);

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${state.currentPlanId}_${Date.now()}.${fileExt}`;
    const filePath = `${state.currentUserId}/${fileName}`;

    // Subir a Storage (bucket 'plan-photos')
    const { error: uploadError } = await supabase.storage
      .from('plan-photos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Obtener la URL pública
    const { data: publicUrlData } = supabase.storage
      .from('plan-photos')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // Insertar en la tabla plan_photos
    const { error: dbError } = await supabase
      .from('plan_photos')
      .insert([{
        plan_id: state.currentPlanId,
        user_id: state.currentUserId,
        photo_url: publicUrl
      }]);

    if (dbError) throw dbError;

    showToast('Foto subida correctamente ✓');
    loadPlanPhotos(state.currentPlanId);
  } catch (error) {
    console.error('Upload error:', error);
    tempDiv.remove();
    showToast('Error al subir la foto');
  } finally {
    event.target.value = ''; // reset input
  }
}

// Confirmar pago en bote (deudor)
window.confirmBoteDeudor = function confirmBoteDeudor(id, offset) {
  const data = state.boteHistory[offset];
  if (!data) return;
  if (!data.confirmDeudores) data.confirmDeudores = {};
  data.confirmDeudores[id] = !data.confirmDeudores[id];
  renderBote();
  showToast(data.confirmDeudores[id] ? 'Pago confirmado ✓' : 'Confirmación retirada');
}

// Confirmar cobro en bote (ganador)
window.confirmBoteGanador = function confirmBoteGanador(id, offset) {
  const data = state.boteHistory[offset];
  if (!data) return;
  if (!data.confirmGanadores) data.confirmGanadores = {};
  data.confirmGanadores[id] = !data.confirmGanadores[id];
  renderBote();
  showToast(data.confirmGanadores[id] ? 'Cobro confirmado ✓' : 'Confirmación retirada');
}

// Finalizar reparto del bote
window.finalizeBote = function finalizeBote(offset) {
  const data = state.boteHistory[offset];
  if (!data) return;
  data.finalized = true;
  data.status = 'Finalizado';
  renderBote();
  showToast('Reparto finalizado ✓');
}

/* ════════════════════════════════════════════════════════════════
   V8: NUEVAS FUNCIONES
   ════════════════════════════════════════════════════════════════ */

// Votar tarjeta de disciplina dentro del propio plan
window.votePlanDiscipline = function votePlanDiscipline(btn, side) {
  const row = document.getElementById('plan-disc-vote-btns');
  if (!row) return;
  row.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.opacity = '.5'; });
  btn.style.opacity = '1';
  btn.style.outline = '2px solid var(--ink)';
  showToast(side === 'favor' ? 'Has votado a favor de la tarjeta ✓' : 'Has votado en contra de la tarjeta ✓');
}

// Marcar deuda como recibida (en "Te deben") — muestra comprobante primero
let receivedCtx = null;
window.markReceived = function markReceived(btn, fromName, amount, hasProof) {
  receivedCtx = { btn, fromName, amount };
  // Mostrar el comprobante que subió el otro
  document.getElementById('proof-from').textContent = `Comprobante de ${fromName}`;
  document.getElementById('proof-amount').textContent = amount;
  document.getElementById('modal-proof').classList.add('open');
}
window.confirmReceived = function confirmReceived() {
  if (!receivedCtx) return;
  const { btn, fromName, amount } = receivedCtx;
  const item = btn.closest('.expense-item');
  // Eliminar la fila de pendientes (ya está confirmada por ambas partes)
  if (item) {
    item.style.transition = 'opacity .25s';
    item.style.opacity = '0';
    setTimeout(() => item.remove(), 260);
  }
  closeModal('modal-proof');
  // Añadir la transacción al historial de Transferencias
  const list = document.getElementById('transferencias-list');
  if (list) {
    const row = document.createElement('div');
    row.className = 'expense-item';
    const today = new Date();
    const fecha = `${today.getDate()} ${meses[today.getMonth()].substring(0,3)}`;
    row.innerHTML = `
      <div class="exp-left"><div class="exp-icon">💰</div><div class="exp-info"><div class="exp-name">${fromName} te pagó</div><div class="exp-sub">${fecha} · <span class="pill pill-green" style="font-size:10px;padding:2px 6px;">Confirmado</span></div></div></div>
      <div class="exp-amount positive">+${amount}</div>
    `;
    list.insertBefore(row, list.firstChild);
  }
  showToast(`Confirmado: ${fromName} te pagó ${amount} · Movido a Transferencias ✓`);
  receivedCtx = null;
}

// Menú de añadir foto (estilo Instagram)
window.openPhotoMenu = function openPhotoMenu() {
  document.getElementById('modal-photo-menu').classList.add('open');
}
window.pickPhotoSource = function pickPhotoSource(source) {
  closeModal('modal-photo-menu');
  const fileInput = document.getElementById('real-photo-input');
  
  if (source === 'camara') {
    fileInput.setAttribute('capture', 'environment');
  } else {
    fileInput.removeAttribute('capture');
  }
  
  fileInput.click();
}

// Parpadeo del título "Tu asistencia" si el plan está pendiente
window.updateAttendanceBlink = function updateAttendanceBlink(isPending) {
  const title = document.getElementById('pd-attendance-title');
  if (!title) return;
  if (isPending) title.classList.add('pending-blink');
  else title.classList.remove('pending-blink');
}

/* ════════════════════════════════════════════════════════════════
   V9: NUEVAS FUNCIONES
   ════════════════════════════════════════════════════════════════ */

// Navegador de meses del historial de gastos
let histExpOffset = 0;
window.histExpNav = function histExpNav(delta) {
  const n = histExpOffset + delta;
  if (n > 0) return;
  histExpOffset = n;
  const next = document.getElementById('hist-exp-next');
  if (next) next.classList.toggle('disabled', histExpOffset >= 0);
  const d = new Date(2026, 4 + histExpOffset, 1);
  const lbl = document.getElementById('hist-exp-month');
  if (lbl) lbl.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// Navegador de meses del historial de disciplina del grupo
let discHistOffset = -1;


// Navegador de meses de disciplina del perfil de miembro
let memberDiscOffset = -1;


// Selector Actual/Historial de disciplina en el perfil de miembro


// Ajustes de invitaciones del grupo
// Visibilidad del grupo (público/privado)
let groupType = 'privado';
window.openGroupVisibility = function openGroupVisibility() {
  document.getElementById('modal-group-visibility').classList.add('open');
  updateGroupInfoBlock();
}
window.setGroupType = function setGroupType(el, type) {
  groupType = type;
  const pub = document.getElementById('gtype-publico');
  const priv = document.getElementById('gtype-privado');
  if (type === 'publico') {
    pub.className = 'pill pill-dark'; pub.textContent = 'Activo';
    priv.className = 'pill pill-outline'; priv.textContent = 'Inactivo';
  } else {
    priv.className = 'pill pill-dark'; priv.textContent = 'Activo';
    pub.className = 'pill pill-outline'; pub.textContent = 'Inactivo';
  }
  updateGroupInfoBlock();
}
window.updateGroupInfoBlock = function updateGroupInfoBlock() {
  // El subajuste de "información pública" solo tiene sentido si el grupo es privado
  const block = document.getElementById('group-info-visibility-block');
  if (block) block.style.display = (groupType === 'privado') ? 'block' : 'none';
}
window.saveGroupVisibility = function saveGroupVisibility() {
  const infoPublic = document.getElementById('group-info-public').checked;
  const sub = document.getElementById('group-visibility-sub');
  if (sub) {
    if (groupType === 'publico') {
      sub.textContent = 'Público · cualquiera puede unirse';
    } else {
      sub.textContent = infoPublic ? 'Privado · información visible para todos' : 'Privado · información no visible';
    }
  }
  closeModal('modal-group-visibility');
  showToast('Visibilidad del grupo guardada ✓');
}

window.openGroupInvitesSettings = function openGroupInvitesSettings() {
  document.getElementById('modal-invite-settings').classList.add('open');
}
window.setInviteVisibility = function setInviteVisibility(el, mode) {
  const todos = document.getElementById('inv-vis-todos');
  const admins = document.getElementById('inv-vis-admins');
  if (mode === 'todos') {
    todos.className = 'pill pill-dark'; todos.textContent = 'Activo';
    admins.className = 'pill pill-outline'; admins.textContent = 'Inactivo';
  } else {
    admins.className = 'pill pill-dark'; admins.textContent = 'Activo';
    todos.className = 'pill pill-outline'; todos.textContent = 'Inactivo';
  }
}
window.resetInviteCode = function resetInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById('invite-settings-code').textContent = code;
  const mainCode = document.getElementById('invite-code');
  if (mainCode) mainCode.textContent = code;
  showToast('Código de invitación renovado ✓');
}

/* ════════════════════════════════════════════════════════════════
   V11: SUBSECCIONES DE CONFIGURACIÓN Y AYUDA
   ════════════════════════════════════════════════════════════════ */
window.openSettingSub = function openSettingSub(kind) {
  const cfg = {
    idioma: {
      title: 'Idioma',
      html: `
        <div class="card" style="padding:0 14px;">
          <div class="card-row" style="cursor:pointer;" onclick="showToast('Idioma: Español')"><div class="card-content"><div class="card-name" style="font-size:13px;">Español</div></div><span class="pill pill-dark">Activo</span></div>
          <div class="card-row" style="cursor:pointer;" onclick="showToast('Language: English')"><div class="card-content"><div class="card-name" style="font-size:13px;">English</div></div><span class="pill pill-outline">—</span></div>
          <div class="card-row" style="cursor:pointer;border-bottom:0;" onclick="showToast('Idioma: Galego')"><div class="card-content"><div class="card-name" style="font-size:13px;">Galego</div></div><span class="pill pill-outline">—</span></div>
        </div>`,
    },
    tema: {
      title: 'Tema',
      html: `
        <div class="card" style="padding:0 14px;">
          <div class="card-row" style="cursor:pointer;" onclick="showToast('Tema: Claro')"><div class="card-content"><div class="card-name" style="font-size:13px;">Claro</div><div class="card-sub">Fondo blanco</div></div><span class="pill pill-dark">Activo</span></div>
          <div class="card-row" style="cursor:pointer;" onclick="showToast('Tema: Oscuro (próximamente)')"><div class="card-content"><div class="card-name" style="font-size:13px;">Oscuro</div><div class="card-sub">Próximamente</div></div><span class="pill pill-outline">—</span></div>
          <div class="card-row" style="cursor:pointer;border-bottom:0;" onclick="showToast('Tema: Automático')"><div class="card-content"><div class="card-name" style="font-size:13px;">Automático</div><div class="card-sub">Según el sistema</div></div><span class="pill pill-outline">—</span></div>
        </div>`,
    },
    push: {
      title: 'Notificaciones push',
      html: `
        <div class="card" style="padding:0 14px;">
          <div class="card-row" style="cursor:default;"><div class="card-content"><div class="card-name" style="font-size:13px;">Nuevos planes</div></div><label class="switch-mini"><input type="checkbox" checked><span class="switch-mini-slider"></span></label></div>
          <div class="card-row" style="cursor:default;"><div class="card-content"><div class="card-name" style="font-size:13px;">Comentarios y respuestas</div></div><label class="switch-mini"><input type="checkbox" checked><span class="switch-mini-slider"></span></label></div>
          <div class="card-row" style="cursor:default;"><div class="card-content"><div class="card-name" style="font-size:13px;">Pagos y liquidaciones</div></div><label class="switch-mini"><input type="checkbox" checked><span class="switch-mini-slider"></span></label></div>
          <div class="card-row" style="cursor:default;border-bottom:0;"><div class="card-content"><div class="card-name" style="font-size:13px;">Tarjetas y sanciones</div></div><label class="switch-mini"><input type="checkbox"><span class="switch-mini-slider"></span></label></div>
        </div>`,
    },
    privacidad: {
      title: 'Privacidad',
      html: `
        <div class="card" style="padding:0 14px;">
          <div class="card-row" style="cursor:default;"><div class="card-content"><div class="card-name" style="font-size:13px;">Teléfono visible</div><div class="card-sub">Para miembros de tus grupos</div></div><label class="switch-mini"><input type="checkbox" checked><span class="switch-mini-slider"></span></label></div>
          <div class="card-row" style="cursor:default;"><div class="card-content"><div class="card-name" style="font-size:13px;">Estadísticas visibles</div><div class="card-sub">Otros pueden ver tu perfil</div></div><label class="switch-mini"><input type="checkbox" checked><span class="switch-mini-slider"></span></label></div>
          <div class="card-row" style="cursor:default;border-bottom:0;"><div class="card-content"><div class="card-name" style="font-size:13px;">Grupos visibles</div><div class="card-sub">Mostrar a qué grupos perteneces</div></div><label class="switch-mini"><input type="checkbox"><span class="switch-mini-slider"></span></label></div>
        </div>`,
    },
    cuenta: {
      title: 'Cuenta',
      html: `
        <div class="card" style="padding:0 14px;">
          <div class="card-row" style="cursor:pointer;" onclick="showToast('Correo verificado ✓')"><div class="card-content"><div class="card-name" style="font-size:13px;">Correo</div><div class="card-sub">tu_usuario@correo.com</div></div><span class="pill pill-green">Verificado</span></div>
          <div class="card-row" style="cursor:pointer;" onclick="showToast('Teléfono verificado ✓')"><div class="card-content"><div class="card-name" style="font-size:13px;">Teléfono</div><div class="card-sub">+34 600 000 000</div></div><span class="pill pill-green">Verificado</span></div>
          <div class="card-row" style="cursor:pointer;border-bottom:0;" onclick="showToast('Te enviaremos un enlace para cambiar la contraseña')"><div class="card-content"><div class="card-name" style="font-size:13px;">Cambiar contraseña</div></div><span style="color:var(--ink3);">›</span></div>
        </div>`,
    },
    datos: {
      title: 'Descargar mis datos',
      html: `
        <div class="notice" style="margin-bottom:12px;">Te enviaremos un archivo con toda tu información: planes, gastos, mensajes y estadísticas.</div>
        <button class="btn btn-primary btn-full" onclick="showToast('Solicitud enviada · Recibirás tus datos por correo')">Solicitar mis datos</button>`,
    },
  };
  const c = cfg[kind];
  if (!c) return;
  document.getElementById('setting-sub-title').firstChild.textContent = c.title + ' ';
  document.getElementById('setting-sub-body').innerHTML = c.html;
  document.getElementById('modal-setting-sub').classList.add('open');
}

window.openHelpSub = function openHelpSub(kind) {
  const cfg = {
    planes: {
      title: 'Cómo crear un plan',
      steps: ['Pulsa el botón + en la pantalla de Planes.', 'Pon título, fecha, hora y una descripción.', 'El plan aparece en Activos y en el calendario.', 'Cada miembro marca su asistencia.'],
    },
    rankings: {
      title: 'Cómo funcionan los rankings',
      steps: ['Al acabar un plan se abre la votación, durante 24h.', 'Eliges 3 MVPs: 3, 2 y 1 puntos.', 'Marcas a los tardones: −2 puntos cada uno.', 'La votación es siempre anónima.'],
    },
    gastos: {
      title: 'Sistema de gastos',
      steps: ['Los gastos se añaden desde cada plan.', 'Todo gasto requiere un comprobante.', 'Para saldar deudas, quien debe pulsa Liquidar.', 'Quien recibe confirma con Recibido.'],
    },
    disciplina: {
      title: 'Tarjetas y disciplina',
      steps: ['Cualquier asistente puede proponer una tarjeta.', 'Se valida con la mayoría de los asistentes.', '2 amarillas activas equivalen a una roja.', 'Las sanciones en € van al bote del mes.'],
    },
  };
  const c = cfg[kind];
  if (!c) return;
  document.getElementById('help-sub-title').firstChild.textContent = c.title + ' ';
  document.getElementById('help-sub-body').innerHTML = `
    <div class="card" style="padding:0 14px;">
      ${c.steps.map((s, i) => `
        <div class="expense-item" ${i === c.steps.length - 1 ? 'style="border-bottom:0;"' : ''}>
          <div class="exp-left">
            <div class="exp-icon" style="background:var(--ink);color:#fff;font-weight:800;">${i + 1}</div>
            <div class="exp-info"><div class="exp-name" style="font-weight:500;font-size:13px;">${s}</div></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('modal-help-sub').classList.add('open');
}
let rouletteOptions = [];
let rouletteSpinning = false;
let rouletteAngle = 0;

window.renderRouletteOptions = function renderRouletteOptions() {
  const list = document.getElementById('roulette-options-list');
  const count = document.getElementById('roulette-count');
  if (count) count.textContent = `${rouletteOptions.length} / 100`;
  if (!list) return;
  if (!rouletteOptions.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--ink3);padding:8px 0;">Aún no has añadido opciones.</div>';
    return;
  }
  list.innerHTML = rouletteOptions.map((opt, i) => `
    <div class="card-row" style="cursor:default;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-sm);margin-bottom:6px;">
      <div class="card-content"><div class="card-name" style="font-size:13px;">${opt}</div></div>
      <span class="comment-action" onclick="removeRouletteOption(${i})">Quitar</span>
    </div>
  `).join('');
}

window.addRouletteOption = function addRouletteOption() {
  const input = document.getElementById('roulette-input');
  const val = input.value.trim();
  if (!val) { showToast('Escribe una opción'); return; }
  if (rouletteOptions.length >= 100) { showToast('Máximo 100 opciones'); return; }
  rouletteOptions.push(val);
  input.value = '';
  renderRouletteOptions();
}

window.removeRouletteOption = function removeRouletteOption(i) {
  rouletteOptions.splice(i, 1);
  renderRouletteOptions();
}

window.startRoulette = function startRoulette() {
  if (rouletteOptions.length < 2) { showToast('Necesitas al menos 2 opciones'); return; }
  document.getElementById('roulette-setup').style.display = 'none';
  document.getElementById('roulette-wheel-section').style.display = 'block';
  drawRouletteWheel();
}

window.resetRoulette = function resetRoulette() {
  document.getElementById('roulette-setup').style.display = 'block';
  document.getElementById('roulette-wheel-section').style.display = 'none';
  document.getElementById('roulette-result').textContent = '';
}

window.drawRouletteWheel = function drawRouletteWheel() {
  const svg = document.getElementById('roulette-svg');
  const n = rouletteOptions.length;
  const cx = 100, cy = 100, r = 100;
  const colors = ['#0A0A0A', '#3A3A3A', '#6A6A6A', '#9A9A9A', '#C5C5C5'];
  let html = '';
  const seg = 360 / n;
  for (let i = 0; i < n; i++) {
    const a0 = (i * seg - 90) * Math.PI / 180;
    const a1 = ((i + 1) * seg - 90) * Math.PI / 180;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = seg > 180 ? 1 : 0;
    html += `<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z" fill="${colors[i % colors.length]}" stroke="#fff" stroke-width="1"/>`;
    // Texto
    const am = (a0 + a1) / 2;
    const tx = cx + (r * 0.62) * Math.cos(am), ty = cy + (r * 0.62) * Math.sin(am);
    const label = rouletteOptions[i].length > 9 ? rouletteOptions[i].substring(0, 8) + '…' : rouletteOptions[i];
    html += `<text x="${tx}" y="${ty}" fill="#fff" font-size="8" font-weight="700" text-anchor="middle" dominant-baseline="middle" transform="rotate(${am * 180 / Math.PI + 90},${tx},${ty})">${label}</text>`;
  }
  svg.innerHTML = html;
  svg.style.transition = 'none';
  svg.style.transform = 'rotate(0deg)';
  rouletteAngle = 0;
}

window.spinRoulette = function spinRoulette() {
  if (rouletteSpinning) return;
  rouletteSpinning = true;
  const svg = document.getElementById('roulette-svg');
  const n = rouletteOptions.length;
  const winner = Math.floor(Math.random() * n);
  const seg = 360 / n;
  const target = 360 * 5 + (360 - (winner * seg + seg / 2));
  rouletteAngle += target;
  svg.style.transition = 'transform 4s cubic-bezier(.17,.67,.2,1)';
  svg.style.transform = `rotate(${rouletteAngle}deg)`;
  document.getElementById('roulette-result').textContent = '';
  document.getElementById('roulette-spin-btn').disabled = true;
  setTimeout(() => {
    rouletteSpinning = false;
    document.getElementById('roulette-spin-btn').disabled = false;
    const res = document.getElementById('roulette-result');
    res.textContent = `🎉 ${rouletteOptions[winner]}`;
    // Guardar la decisión (para su subpágina) e insertarla en el historial
    const decisionId = 'rd-' + Date.now();
    rouletteDecisions[decisionId] = {
      title: 'Decisión del grupo',
      meta: `Hoy · ${n} opciones`,
      winner: rouletteOptions[winner],
      options: rouletteOptions.slice(),
      by: 'Lanzada por ti. El resultado lo eligió el azar.',
    };
    const hist = document.getElementById('roulette-history');
    if (hist) {
      const row = document.createElement('div');
      row.className = 'expense-item';
      row.style.cursor = 'pointer';
      row.setAttribute('onclick', `openRouletteDetail('${decisionId}')`);
      row.innerHTML = `
        <div class="exp-left"><div class="exp-icon">🎲</div><div class="exp-info"><div class="exp-name">Decisión del grupo</div><div class="exp-sub">Ahora · ${n} opciones</div></div></div>
        <span class="pill pill-dark">${rouletteOptions[winner]}</span>
      `;
      hist.insertBefore(row, hist.firstChild);
    }
  }, 4100);
}

// Navegador de meses del historial de la ruleta
let rouletteHistOffset = 0;
window.rouletteHistNav = function rouletteHistNav(delta) {
  const n = rouletteHistOffset + delta;
  if (n > 0) return;
  rouletteHistOffset = n;
  const next = document.getElementById('roulette-hist-next');
  if (next) next.classList.toggle('disabled', rouletteHistOffset >= 0);
  const d = new Date(2026, 4 + rouletteHistOffset, 1);
  const lbl = document.getElementById('roulette-hist-month');
  if (lbl) lbl.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// Decisiones guardadas de la ruleta (para sus subpáginas)
const rouletteDecisions = {
  cena: { title: '¿Dónde cenamos?', meta: 'Hace 2 días · 4 opciones', winner: 'Pizzería',
    options: ['Pizzería', 'Hamburguesería', 'Sushi', 'Tapas'], by: 'Lanzada por Carlos. El resultado lo eligió el azar.' },
  ronda: { title: '¿Quién paga la ronda?', meta: '12 May · 6 opciones', winner: 'Mario',
    options: ['Carlos', 'Mario', 'Pablo', 'Lucas', 'Ana', 'Sergio'], by: 'Lanzada por Ana. El resultado lo eligió el azar.' },
};

window.openRouletteDetail = function openRouletteDetail(id) {
  const d = rouletteDecisions[id];
  if (!d) return;
  document.getElementById('rd-title').textContent = d.title;
  document.getElementById('rd-meta').textContent = d.meta;
  document.getElementById('rd-winner').textContent = d.winner;
  document.getElementById('rd-by').textContent = d.by;
  document.getElementById('rd-options').innerHTML = d.options.map((opt, i) => `
    <div class="expense-item" ${i === d.options.length - 1 ? 'style="border-bottom:0;"' : ''}>
      <div class="exp-left"><div class="exp-info"><div class="exp-name">${opt}</div></div></div>
      ${opt === d.winner ? '<span class="pill pill-dark">Ganadora</span>' : '<span class="pill pill-outline">—</span>'}
    </div>
  `).join('');
  showScreen('roulette-detail');
}

/* ════════════════════════════════════════════════════════════════
   V10: GESTOS TÁCTILES ESTILO iPHONE (mejorados)
   ════════════════════════════════════════════════════════════════ */

// ── 1. POPUPS ARRASTRABLES — siguen el dedo y bloquean el scroll del fondo ──
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  const sheet = overlay.querySelector('.modal-sheet');
  if (!sheet) return;
  let startY = 0, curY = 0, dragging = false, fromTop = false;

  // Bloquear scroll del fondo cuando el modal está abierto
  const mo = new MutationObserver(() => {
    if (overlay.classList.contains('open')) {
      document.body.style.overflow = 'hidden';
    } else {
      // Solo liberar si no queda ningún otro modal abierto
      if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
    }
  });
  mo.observe(overlay, { attributes: true, attributeFilter: ['class'] });

  function onStart(e) {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = sheet.getBoundingClientRect();
    // Zona de arrastre: handle + cabecera (primeros 90px del sheet)
    fromTop = (y - rect.top) <= 90;
    startY = y; curY = y; dragging = true;
    sheet.style.transition = 'none';
  }
  function onMove(e) {
    if (!dragging) return;
    curY = e.touches ? e.touches[0].clientY : e.clientY;
    let diff = curY - startY;
    if (diff < 0) diff = 0;
    // Si el arrastre no empezó en la cabecera, aplicar resistencia (cuesta más)
    const applied = fromTop ? diff : diff * 0.32;
    sheet.style.transform = `translateY(${applied}px)`;
    // Atenuar el fondo según el arrastre
    const op = Math.max(0, 1 - applied / 400);
    overlay.style.background = `rgba(0,0,0,${0.45 * op})`;
    if (e.cancelable && diff > 0) e.preventDefault();
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = 'transform .26s cubic-bezier(.22,.61,.36,1)';
    overlay.style.background = '';
    const diff = curY - startY;
    const threshold = fromTop ? 95 : 220;
    if (diff > threshold) {
      sheet.style.transform = 'translateY(100%)';
      setTimeout(() => {
        overlay.classList.remove('open');
        sheet.style.transform = '';
        sheet.style.transition = '';
      }, 240);
    } else {
      sheet.style.transform = '';
    }
  }
  sheet.addEventListener('touchstart', onStart, { passive: true });
  sheet.addEventListener('touchmove', onMove, { passive: false });
  sheet.addEventListener('touchend', onEnd);
});

// ── 2 y 3. SWIPE FLUIDO: las pantallas siguen el dedo en tiempo real ──
(function () {
  const wrap = document.querySelector('.app-body') || document.body;
  let startX = 0, startY = 0, curX = 0;
  let tracking = false, decided = false, horizontal = false;
  let fromEdge = false;

  function screensFor(dir) {
    // Devuelve {prev, next} de pantallas principales según la actual
    const idx = MAIN_SCREENS.indexOf(currentScreen);
    return {
      prev: idx > 0 ? MAIN_SCREENS[idx - 1] : null,
      next: idx >= 0 && idx < MAIN_SCREENS.length - 1 ? MAIN_SCREENS[idx + 1] : null,
    };
  }

  function onStart(e) {
    if (e.touches.length !== 1) { tracking = false; return; }
    if (document.querySelector('.modal-overlay.open')) { tracking = false; return; }
    startX = curX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true; decided = false; horizontal = false;
    fromEdge = startX < 30;
  }

  function onMove(e) {
    if (!tracking) return;
    curX = e.touches[0].clientX;
    const dx = curX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!decided) {
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
        decided = true;
        horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
      }
      return;
    }
    if (!horizontal) return;

    const activeScreen = document.getElementById('s-' + currentScreen);
    if (!activeScreen) return;
    const isDetail = DETAIL_SCREENS.includes(currentScreen);

    if (isDetail || fromEdge) {
      // Arrastre de "atrás": la pantalla actual sigue el dedo hacia la derecha
      if (dx > 0) {
        activeScreen.style.transition = 'none';
        activeScreen.style.transform = `translateX(${dx}px)`;
        activeScreen.style.boxShadow = '-12px 0 24px rgba(0,0,0,.12)';
      }
    } else if (MAIN_SCREENS.includes(currentScreen)) {
      // Movimiento entre pantallas principales: la actual se desplaza con el dedo
      const { prev, next } = screensFor();
      if (dx > 0 && !prev) return;
      if (dx < 0 && !next) return;
      activeScreen.style.transition = 'none';
      activeScreen.style.transform = `translateX(${dx}px)`;
    }
    if (e.cancelable) e.preventDefault();
  }

  function onEnd() {
    if (!tracking) { return; }
    tracking = false;
    if (!horizontal) return;
    const dx = curX - startX;
    const activeScreen = document.getElementById('s-' + currentScreen);
    if (!activeScreen) return;
    const w = window.innerWidth || 400;
    const isDetail = DETAIL_SCREENS.includes(currentScreen);

    activeScreen.style.transition = 'transform .28s cubic-bezier(.22,.61,.36,1)';

    if (isDetail || fromEdge) {
      if (dx > w * 0.32) {
        // Completar el "atrás"
        activeScreen.style.transform = `translateX(${w}px)`;
        setTimeout(() => {
          activeScreen.style.transition = 'none';
          activeScreen.style.transform = '';
          activeScreen.style.boxShadow = '';
          goBack();
        }, 270);
      } else {
        activeScreen.style.transform = '';
        setTimeout(() => { activeScreen.style.boxShadow = ''; }, 280);
      }
    } else if (MAIN_SCREENS.includes(currentScreen)) {
      const { prev, next } = screensFor();
      if (dx > w * 0.28 && prev) {
        activeScreen.style.transform = `translateX(${w}px)`;
        setTimeout(() => {
          activeScreen.style.transition = 'none';

          activeScreen.style.transform = '';
          showScreen(prev);
        }, 270);
      } else if (dx < -w * 0.28 && next) {
        activeScreen.style.transform = `translateX(${-w}px)`;
        setTimeout(() => {
          activeScreen.style.transition = 'none';
          activeScreen.style.transform = '';
          showScreen(next);
        }, 270);
      } else {
        activeScreen.style.transform = '';
      }
    }
  }

  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);

  // ── INICIALIZACIÓN ──
  async function initApp() {
    // Configurar listeners de la pantalla de login
    // auth-form removed

    // Check current session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
      state.isLoggedIn = true;
      await loadUserProfile(session.user);
    } else {
      state.isLoggedIn = false;
      state.currentUserId = 'tu';
    }
    window.renderAll();

    // Escuchar cambios de sesión
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session) {
          state.isLoggedIn = true;
          document.getElementById('auth-screen').style.display = 'none';
          document.getElementById('main-app').style.display = 'block';
          await loadUserProfile(session.user);
          window.renderAll();
        }
      } else if (event === 'SIGNED_OUT') {
        state.isLoggedIn = false;
        state.currentUserId = 'tu';
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
      }
    });
    
    if (!state.isLoggedIn) {
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('main-app').style.display = 'none';
    } else {
      document.getElementById('auth-screen').style.display = 'none';
      document.getElementById('main-app').style.display = 'block';
    }
  }

  window.renderAll = function() {
    safeInit('setHeaderDate', () => setHeaderDate());
    safeInit('fab', () => { const f = document.getElementById('fab-create'); if (f) f.style.display = 'flex'; });
    safeInit('renderGroupList', () => renderGroupList());
    if (window.loadMembers) window.loadMembers();
    if (window.loadPlans) window.loadPlans();
    if (window.loadFeed) window.loadFeed();
    if (window.loadExpenses) window.loadExpenses();
    if (window.loadGroupSettings) window.loadGroupSettings();
    if (window.loadGroupCards) window.loadGroupCards();
    if (window.loadGroupLabels) window.loadGroupLabels();
    if (window.loadWeeklyVotingStatus) window.loadWeeklyVotingStatus();
    if (window.initRealtime) window.initRealtime();
    safeInit('renderCalendar', () => renderCalendar());
    safeInit('applyAdminVisibility', () => applyAdminVisibility());
    safeInit('initPendingBlink', () => initPendingBlink());
    safeInit('renderRouletteOptions', () => renderRouletteOptions());
    safeInit('applyReclamAdminVisibility', () => applyReclamAdminVisibility());
  };

  // ── AUTH LOGIC ──
  window.toggleAuthMode = function() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta';
    document.getElementById('auth-submit-btn').innerText = isLoginMode ? 'Entrar' : 'Registrarse';
    document.getElementById('auth-switch-text').innerText = isLoginMode ? 'Regístrate' : 'Inicia Sesión';
    document.getElementById('auth-name-field').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('auth-error').innerText = '';
  };

  window.signInWithGoogle = async function() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      document.getElementById('auth-error').innerText = err.message;
    }
  };

  window.handleAuthSubmit = async function(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;
    const errorEl = document.getElementById('auth-error');
    
    errorEl.innerText = '';
    document.getElementById('auth-submit-btn').disabled = true;

    try {
      if (isLoginMode) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { full_name: name, username: name.toLowerCase().replace(/\s/g, '') + Math.floor(Math.random()*1000) }
          }
        });
        if (error) throw error;
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          errorEl.innerText = "El correo ya está registrado.";
        }
      }
    } catch (err) {
      errorEl.innerText = err.message;
    } finally {
      document.getElementById('auth-submit-btn').disabled = false;
    }
  };

  window.logout = async function() {
    await supabase.auth.signOut();
  };

  async function loadUserProfile(user) {
    state.currentUserId = user.id;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      // Añadir o actualizar la cuenta en el array mock por ahora
      const existingIdx = state.accounts.findIndex(a => a.id === user.id);
      const newAcc = { 
        id: user.id, 
        name: data.full_name || 'Sin nombre', 
        handle: '@' + (data.username || 'usuario'), 
        initials: (data.full_name || 'U').substring(0,2).toUpperCase(), 
        avatarColor: '#0A0A0A' 
      };
      if (existingIdx >= 0) {
        state.accounts[existingIdx].phone = data.phone;
        state.accounts[existingIdx].bio = data.bio;
      }
      if (existingIdx >= 0) state.accounts[existingIdx] = newAcc;
      else state.accounts.push(newAcc);
    } else {
      // Si acaba de registrarse y no le dio tiempo al trigger, simulamos
      const newAcc = { 
        id: user.id, 
        name: user.user_metadata?.full_name || 'Tú', 
        handle: '@' + (user.user_metadata?.username || 'usuario'), 
        initials: (user.user_metadata?.full_name || 'T').substring(0,2).toUpperCase(), 
        avatarColor: '#0A0A0A' 
      };
      state.accounts.push(newAcc);
    }
    await loadUserGroups();
  }

  window.loadMembers = async function() {
    if (!state.currentGroupId) {
      state.members = [];
      renderMembersList();
      return;
    }
    const { data, error } = await supabase
      .from('group_members')
      .select('*, profiles(*)')
      .eq('group_id', state.currentGroupId);
    
    if (error) {
      console.error('Error fetching members:', error);
      showToast('Error al cargar los miembros', 'error');
      return;
    }
    state.members = data || [];
    renderMembersList();
  };

  function renderMembersList() {
    const list = document.getElementById('group-members-list');
    if (!list) return;
    
    // Update count in header
    const titleEl = list.previousElementSibling.querySelector('.section-title');
    if (titleEl) {
      titleEl.innerText = `Miembros · ${state.members.length}`;
    }

    if (state.members.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--ink3);">No hay miembros.</div>';
      return;
    }

    // Check if I am admin
    const myMemberRecord = state.members.find(m => m.profiles && m.profiles.id === state.currentUserId);
    const iAmAdmin = myMemberRecord && myMemberRecord.role === 'admin';

    list.innerHTML = state.members.map(m => {
      const p = m.profiles || {};
      const fullName = p.full_name || p.username || 'Usuario';
      const handle = p.username ? `@${p.username}` : '';
      const initials = (fullName.substring(0, 2)).toUpperCase();
      const color = p.avatar_url || '#0A0A0A'; // using avatar_url as color for now
      const isAdmin = m.role === 'admin';
      const isMe = p.id === state.currentUserId;
      
      let badges = '';
      if (isAdmin) badges += ` <span class="pill pill-outline" style="font-size:8px;padding:1px 5px;">Admin</span>`;

      let kickBtn = '';
      if (iAmAdmin && !isMe) {
        kickBtn = `<button class="btn btn-secondary" style="font-size:10px;padding:4px 9px;" onclick="kickMember(this, '${p.id}')">Expulsar</button>`;
      }

      return `
        <div class="member-row">
          <div class="avatar" style="background:${color};color:#fff;">${initials}</div>
          <div class="member-info" onclick="openMemberProfile('${p.id}')" style="cursor:pointer;">
            <div class="member-name">${isMe ? 'Tú' : fullName} <span style="color:var(--ink3);font-weight:500;font-size:10px;">(${handle})</span>${badges}</div>
          </div>
          ${kickBtn}
        </div>
      `;
    }).join('');
    
    const kickHint = document.getElementById('kick-hint');
    if (kickHint) kickHint.style.display = iAmAdmin ? 'block' : 'none';
  }

  window.loadPlans = async function loadPlans() {
    if (!state.currentGroupId) {
      const list = document.getElementById('plans-activos-list');
      if (list) list.innerHTML = '<div class="notice" style="margin-bottom:16px;">No tienes grupos. Crea uno o únete para ver los planes.</div>';
      return;
    }
    
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*, plan_attendance(*)')
      .eq('group_id', state.currentGroupId)
      .order('event_date', { ascending: true });
      
    if (error) {
      console.error(error);
      return;
    }
    
    state.plans = plans || [];
    
    // Calcular KPIs reales de MI cuenta
    const now = new Date();
    let pendingCount = 0;
    let activeCount = 0;
    let historicCount = 0;
    let totalFuture = 0;
    let totalAll = state.plans.length;
    let totalPast = 0;

    state.plans.forEach(p => {
      const isPast = new Date(p.event_date) < now;
      const att = (p.plan_attendance || []).find(a => a.user_id === state.currentUserId);
      const myStatus = att ? att.status : null; // 'voy', 'novoy', 'quizas', 'tarde'

      if (isPast) {
        totalPast++;
        if (myStatus === 'voy' || myStatus === 'tarde') {
          historicCount++;
        }
      } else {
        totalFuture++;
        if (myStatus === 'voy' || myStatus === 'tarde') {
          activeCount++;
        } else if (!myStatus || myStatus === 'quizas') {
          pendingCount++;
        }
      }
    });

    const pendingPct = totalFuture ? Math.round((pendingCount / totalFuture) * 100) : 0;
    const activePct = totalFuture ? Math.round((activeCount / totalFuture) * 100) : 0;
    const histPct = totalPast ? Math.round((historicCount / totalPast) * 100) : 0;

    const el = (id) => document.getElementById(id);
    if (el('kpi-pending-num')) el('kpi-pending-num').textContent = pendingCount;
    if (el('kpi-pending-pct')) el('kpi-pending-pct').textContent = pendingPct + '%';
    if (el('kpi-pending-fill')) el('kpi-pending-fill').style.width = pendingPct + '%';

    if (el('kpi-active-num')) el('kpi-active-num').textContent = `${activeCount}/${totalFuture}`;
    if (el('kpi-active-pct')) el('kpi-active-pct').textContent = activePct + '%';
    if (el('kpi-active-fill')) el('kpi-active-fill').style.width = activePct + '%';

    if (el('kpi-hist-num')) el('kpi-hist-num').textContent = `${historicCount}/${totalPast}`;
    if (el('kpi-hist-pct')) el('kpi-hist-pct').textContent = histPct + '%';
    if (el('kpi-hist-fill')) el('kpi-hist-fill').style.width = histPct + '%';
    
    let activosHTML = '';
    let historialHTML = '';
    
    state.plans.forEach(p => {
      const d = new Date(p.event_date);
      const isPast = d < now;
      const dateStr = d.toLocaleString('es-ES', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
      
      const att = (p.plan_attendance || []).find(a => a.user_id === state.currentUserId);
      const myStatus = att ? att.status : null;
      let attBadge = `<span class="attendance-tag pendiente">${p.status === 'active' ? 'Confirmado' : 'Propuesto'}</span>`;
      if (myStatus === 'voy' || myStatus === 'tarde') attBadge = `<span class="attendance-tag voy">✓ Voy</span>`;
      else if (myStatus === 'novoy') attBadge = `<span class="attendance-tag novoy">✗ No voy</span>`;

      const html = `
        <div class="card pending-border" style="margin-bottom:8px;">
          <div class="card-row" onclick="openPlan('${p.id}')" style="cursor:pointer;">
            <div class="card-content">
              <div class="card-label">${dateStr}</div>
              <div class="card-name">${p.title}</div>
              <div class="card-sub card-sub-1line">${p.description || 'Sin descripción'}</div>
            </div>
            <div class="card-right">
              ${attBadge}
            </div>
          </div>
        </div>
      `;
      if (isPast) {
        historialHTML += html;
      } else {
        activosHTML += html;
      }
    });

    const listActivos = document.getElementById('plans-activos-list');
    if (listActivos) {
      listActivos.innerHTML = activosHTML || '<div class="notice" style="margin-bottom:16px;">No hay planes activos. ¡Crea el primero!</div>';
    }
    
    const listHistorial = document.getElementById('plans-historial-list');
    if (listHistorial) {
      listHistorial.innerHTML = historialHTML || '<div style="text-align:center;font-size:12px;color:var(--ink3);margin-top:16px;">No hay historial de planes.</div>';
    }
  }

  async function loadUserGroups() {
    state.myGroups = [];
    const { data, error } = await supabase
      .from('group_members')
      .select('groups(*)')
      .eq('user_id', state.currentUserId);
      
    if (data && data.length > 0) {
      for (const item of data) {
        if (!item.groups) continue;
        const g = item.groups;
        
        // Fetch counts and invite
        const { count: mCount } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id);
        const { count: pCount } = await supabase.from('plans').select('*', { count: 'exact', head: true }).eq('group_id', g.id);
        const { data: invite } = await supabase.from('group_invites').select('code').eq('group_id', g.id).limit(1).maybeSingle();

        state.myGroups.push({
          id: g.id,
          name: g.name,
          initials: g.initials || g.name.substring(0, 2).toUpperCase(),
          color: g.color || '#0A0A0A',
          members: mCount || 1,
          plans: pCount || 0,
          desc: g.description || 'Sin descripción',
          code: invite ? invite.code : '------'
        });
      }
      
      if (!state.currentGroupId && state.myGroups.length > 0) {
        const firstId = state.myGroups[0].id;
        state.currentGroupId = null; // force update in switchGroup
        if (window.switchGroup) window.switchGroup(firstId);
      }
      
      if (window.renderGroupList) window.renderGroupList();
    } else {
      // Empty groups state
      state.currentGroupId = null;
      document.getElementById('hdr-group-name').textContent = 'Sin grupos';
      document.getElementById('hdr-group-avatar').textContent = '+';
      document.getElementById('hdr-group-avatar').style.background = 'var(--ink)';
      document.getElementById('group-name-hero').textContent = 'Bienvenido a KOves';
      document.getElementById('group-meta-hero').textContent = 'Crea tu primer grupo para empezar';
      
      const list = document.getElementById('plans-activos-list');
      if (list) list.innerHTML = '<div class="notice" style="margin-bottom:16px;">No tienes grupos. Crea uno o únete para ver los planes.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();

/* ════════════════════════════════════════════════════════════════
   INICIALIZACIÓN — al final, tras definir todas las funciones.
   Cada paso protegido para que un fallo no corte el resto.
   ════════════════════════════════════════════════════════════════ */
window.safeInit = function safeInit(label, fn) {
  try { fn(); } catch (e) { console.error('Init error en ' + label + ':', e); }
}

// ── TARJETAS DEL GRUPO (FASE 2) ──

window.loadGroupCards = async function loadGroupCards() {
  if (!state.currentGroupId) return;
  const list = document.getElementById('group-cards-list');
  if (!list) return;

  const { data, error } = await supabase
    .from('group_cards')
    .select('*')
    .eq('group_id', state.currentGroupId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading group cards:', error);
    return;
  }

  state.groupCards = data || []; // Guardamos en state para usar al proponer

  if (!data || data.length === 0) {
    list.innerHTML = `
      <div class="card-row" style="cursor:default;">
        <div class="card-content"><div class="card-name" style="font-size:13px;color:var(--ink3);">No hay tarjetas definidas</div></div>
      </div>
    `;
    return;
  }

  let html = '';
  data.forEach(card => {
    html += `
      <div class="card-row" style="cursor:pointer;" onclick="openEditGroupCard('${card.id}')">
        <div class="card-content">
          <div class="card-name" style="font-size:13px;font-weight:700;">${card.name}</div>
          ${card.description ? `<div class="card-sub" style="font-size:11px;color:var(--ink3);">${card.description}</div>` : ''}
        </div>
        <div style="width:20px;height:28px;border-radius:4px;background:${card.color};"></div>
      </div>
    `;
  });
  list.innerHTML = html;
};

window.openCreateGroupCard = function openCreateGroupCard() {
  state.editingCardId = null;
  document.getElementById('create-card-title').innerHTML = 'Nueva Tarjeta <span class="modal-close" onclick="closeModal(\'modal-create-card\')">Cancelar</span>';
  document.getElementById('card-name-input').value = '';
  document.getElementById('card-desc-input').value = '';
  selectCardColor(document.querySelector('.color-picker-opt'), '#C07000'); // default
  document.getElementById('modal-create-card').classList.add('open');
};

window.openEditGroupCard = function openEditGroupCard(cardId) {
  const card = state.groupCards.find(c => c.id === cardId);
  if (!card) return;
  state.editingCardId = cardId;
  document.getElementById('create-card-title').innerHTML = 'Editar Tarjeta <span class="modal-close" onclick="closeModal(\'modal-create-card\')">Cancelar</span>';
  document.getElementById('card-name-input').value = card.name;
  document.getElementById('card-desc-input').value = card.description || '';
  
  // Encontrar el color y seleccionarlo
  const opts = document.querySelectorAll('.color-picker-opt');
  let selected = false;
  opts.forEach(opt => {
    if (opt.getAttribute('onclick').includes(card.color)) {
      selectCardColor(opt, card.color);
      selected = true;
    }
  });
  if (!selected) selectCardColor(opts[0], '#C07000');

  document.getElementById('modal-create-card').classList.add('open');
};

window.selectCardColor = function selectCardColor(el, color) {
  document.querySelectorAll('.color-picker-opt').forEach(opt => {
    opt.style.borderColor = 'transparent';
  });
  el.style.borderColor = 'var(--ink)';
  state.selectedCardColor = color;
};

window.saveGroupCard = async function saveGroupCard() {
  const name = document.getElementById('card-name-input').value.trim();
  const desc = document.getElementById('card-desc-input').value.trim();
  const color = state.selectedCardColor || '#C07000';

  if (!name) {
    showToast('El nombre de la tarjeta es obligatorio');
    return;
  }

  const payload = {
    group_id: state.currentGroupId,
    name: name,
    description: desc,
    color: color,
    created_by: state.currentUserId
  };

  let error;
  if (state.editingCardId) {
    const res = await supabase.from('group_cards').update(payload).eq('id', state.editingCardId);
    error = res.error;
  } else {
    const res = await supabase.from('group_cards').insert([payload]);
    error = res.error;
  }

  if (error) {
    console.error('Error saving group card:', error);
    showToast('Error al guardar la tarjeta');
    return;
  }

  closeModal('modal-create-card');
  showToast('Tarjeta guardada ✓');
  loadGroupCards();
};

// ── PROPONER Y VOTAR TARJETAS EN PLANES (FASE 2) ──

window.loadPlanCards = async function loadPlanCards() {
  if (!state.currentPlanId) return;
  const list = document.getElementById('plan-cards-list');
  if (!list) return;

  // Cargar tarjetas asignadas a este plan
  const { data: cards, error } = await supabase
    .from('assigned_cards')
    .select('*, group_cards(*), profiles!assigned_cards_target_user_id_fkey(name), proposer:profiles!assigned_cards_proposed_by_fkey(name)')
    .eq('plan_id', state.currentPlanId);

  if (error) {
    console.error('Error loading plan cards:', error);
    return;
  }

  // Cargar votos
  const cardIds = cards.map(c => c.id);
  const { data: votes } = await supabase
    .from('assigned_card_votes')
    .select('*')
    .in('assigned_card_id', cardIds);

  if (cards.length === 0) {
    list.innerHTML = `<div style="font-size:11px;color:var(--ink3);text-align:center;">No hay tarjetas propuestas en este plan.</div>`;
    return;
  }

  let html = '';
  cards.forEach(ac => {
    const cardVotes = (votes || []).filter(v => v.assigned_card_id === ac.id);
    const favor = cardVotes.filter(v => v.vote === 'favor').length;
    const contra = cardVotes.filter(v => v.vote === 'contra').length;
    const totalVotes = favor + contra;
    const favorPct = totalVotes > 0 ? (favor / totalVotes) * 100 : 0;
    const contraPct = totalVotes > 0 ? (contra / totalVotes) * 100 : 0;
    const hasVoted = cardVotes.some(v => v.user_id === state.currentUserId);
    
    // Si la tarjeta ya está activa, history o rejected, mostramos estado en vez de botones
    let voteUI = '';
    if (ac.status === 'voting') {
       voteUI = `
         <div style="display:flex;gap:6px;" id="plan-card-vote-btns">
           <button class="btn btn-primary" style="flex:1;font-size:11px;padding:8px;" onclick="votePlanCard('${ac.id}','favor')" ${hasVoted ? 'disabled' : ''}>A favor (${favor})</button>
           <button class="btn btn-secondary" style="flex:1;font-size:11px;padding:8px;" onclick="votePlanCard('${ac.id}','contra')" ${hasVoted ? 'disabled' : ''}>En contra (${contra})</button>
         </div>
         <div style="font-size:10px;color:var(--ink3);margin-top:8px;text-align:center;">Tu voto es público. Cierra a las 24h.</div>
       `;
    } else {
       const statusText = {
         'active': 'Aprobada y Activa',
         'history': 'Historial',
         'rejected': 'Rechazada'
       };
       voteUI = `<div style="font-size:11px;font-weight:700;color:var(--ink2);text-align:center;margin-top:8px;">${statusText[ac.status]}</div>`;
    }

    html += `
      <div class="card" style="padding:14px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:24px;height:34px;border-radius:4px;background:${ac.group_cards.color};"></div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;">${ac.profiles.name} · ${ac.group_cards.name}</div>
            <div style="font-size:11px;color:var(--ink3);">Propuesto por ${ac.proposer.name}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;">
          <div style="flex:1;height:6px;background:var(--line);border-radius:3px;overflow:hidden;display:flex;">
            <div style="width:${favorPct}%;background:var(--green);"></div>
            <div style="width:${contraPct}%;background:var(--red);"></div>
          </div>
          <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--ink3);">${favor}/${totalVotes}</span>
        </div>
        ${voteUI}
      </div>
    `;
  });
  list.innerHTML = html;
};

window.openProposeCard = async function openProposeCard() {
  const selectTarget = document.getElementById('propose-target-input');
  const selectCard = document.getElementById('propose-card-input');
  
  // Llenar asistentes (fallback a state.members si no hay attendees reales aún)
  let attendees = state.currentPlanAttendees || [];
  if (attendees.length === 0 && state.members) {
    attendees = state.members.map(m => ({ user_id: m.id, profiles: { name: m.name } }));
  }
  let tHtml = '<option value="">Selecciona un asistente</option>';
  attendees.forEach(a => {
    tHtml += `<option value="${a.user_id}">${a.profiles.name}</option>`;
  });
  selectTarget.innerHTML = tHtml;

  // Llenar tarjetas del grupo
  const cards = state.groupCards || [];
  let cHtml = '<option value="">Selecciona una tarjeta del grupo</option>';
  cards.forEach(c => {
    cHtml += `<option value="${c.id}">${c.name}</option>`;
  });
  selectCard.innerHTML = cHtml;

  document.getElementById('modal-propose-card').classList.add('open');
};

window.submitProposeCard = async function submitProposeCard() {
  const targetId = document.getElementById('propose-target-input').value;
  const cardId = document.getElementById('propose-card-input').value;

  if (!targetId || !cardId) {
    showToast('Selecciona a quién y qué tarjeta proponer');
    return;
  }

  const { error } = await supabase.from('assigned_cards').insert([{
    group_id: state.currentGroupId,
    plan_id: state.currentPlanId,
    card_id: cardId,
    target_user_id: targetId,
    proposed_by: state.currentUserId,
    status: 'voting'
  }]);

  if (error) {
    console.error('Error proposing card:', error);
    showToast('Error al proponer la tarjeta');
    return;
  }

  closeModal('modal-propose-card');
  showToast('Tarjeta propuesta ✓');
  loadPlanCards();
};

window.votePlanCard = async function votePlanCard(assignedCardId, voteType) {
  const { error } = await supabase.from('assigned_card_votes').insert([{
    assigned_card_id: assignedCardId,
    user_id: state.currentUserId,
    vote: voteType
  }]);

  if (error) {
    if (error.code === '23505') showToast('Ya has votado');
    else showToast('Error al votar');
    return;
  }

  showToast('Voto registrado ✓');
  loadPlanCards();
};

// ── TARJETAS RECIBIDAS (MEMBER PROFILE) ──
window.switchMemberCardsTab = function switchMemberCardsTab(el, type) {
  document.querySelectorAll('#s-member .split-toggle-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('mp-cards-actual').style.display = type === 'actual' ? 'block' : 'none';
  document.getElementById('mp-cards-historial').style.display = type === 'historial' ? 'block' : 'none';
};

window.memberCardsNav = function memberCardsNav(delta) {
  showToast('Navegación de historial mockeada');
};


// ── ETIQUETAS SEMANALES (FASE 3) ──

window.loadGroupLabels = async function loadGroupLabels() {
  if (!state.currentGroupId) return;
  const list = document.getElementById('group-labels-list');
  if (!list) return;

  const { data, error } = await supabase
    .from('group_labels')
    .select('*')
    .eq('group_id', state.currentGroupId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading group labels:', error);
    return;
  }

  state.groupLabels = data || [];

  if (!data || data.length === 0) {
    list.innerHTML = `<span style="font-size:13px;color:var(--ink3);">No hay etiquetas definidas</span>`;
    return;
  }

  let html = '';
  data.forEach(label => {
    html += `
      <div style="background:var(--surface2);border:1px solid var(--line);border-radius:16px;padding:6px 12px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="openEditGroupLabel('${label.id}')">
        <span style="font-size:16px;">${label.emoji}</span>
        <span>${label.name}</span>
      </div>
    `;
  });
  list.innerHTML = html;
};

window.openCreateGroupLabel = function openCreateGroupLabel() {
  state.editingLabelId = null;
  document.getElementById('create-label-title').innerHTML = 'Nueva Etiqueta <span class="modal-close" onclick="closeModal(\'modal-create-label\')">Cancelar</span>';
  document.getElementById('label-emoji-input').value = '';
  document.getElementById('label-name-input').value = '';
  document.getElementById('modal-create-label').classList.add('open');
};

window.openEditGroupLabel = function openEditGroupLabel(labelId) {
  const label = state.groupLabels.find(l => l.id === labelId);
  if (!label) return;
  state.editingLabelId = labelId;
  document.getElementById('create-label-title').innerHTML = 'Editar Etiqueta <span class="modal-close" onclick="closeModal(\'modal-create-label\')">Cancelar</span>';
  document.getElementById('label-emoji-input').value = label.emoji;
  document.getElementById('label-name-input').value = label.name;
  document.getElementById('modal-create-label').classList.add('open');
};

window.saveGroupLabel = async function saveGroupLabel() {
  const emoji = document.getElementById('label-emoji-input').value.trim();
  const name = document.getElementById('label-name-input').value.trim();

  if (!emoji || !name) {
    showToast('El emoji y el nombre son obligatorios');
    return;
  }

  const payload = {
    group_id: state.currentGroupId,
    name: name,
    emoji: emoji,
    created_by: state.currentUserId
  };

  let error;
  if (state.editingLabelId) {
    const res = await supabase.from('group_labels').update(payload).eq('id', state.editingLabelId);
    error = res.error;
  } else {
    const res = await supabase.from('group_labels').insert([payload]);
    error = res.error;
  }

  if (error) {
    console.error('Error saving group label:', error);
    showToast('Error al guardar la etiqueta');
    return;
  }

  closeModal('modal-create-label');
  showToast('Etiqueta guardada ✓');
  loadGroupLabels();
};

window.loadWeeklyVotingStatus = async function loadWeeklyVotingStatus() {
  if (!state.currentGroupId) return;
  const statusText = document.getElementById('voting-status-text');
  const actionBtn = document.getElementById('voting-action-btn');
  if (!statusText || !actionBtn) return;

  const { data, error } = await supabase
    .from('weekly_votings')
    .select('*')
    .eq('group_id', state.currentGroupId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error loading voting status:', error);
    return;
  }

  const currentVoting = data && data.length > 0 ? data[0] : null;
  state.currentVoting = currentVoting;

  if (currentVoting) {
    statusText.textContent = 'La votación semanal está abierta. ¡Vota ahora!';
    statusText.style.color = 'var(--green)';
    statusText.style.opacity = '1';
    actionBtn.textContent = 'Ir a Votar';
    actionBtn.onclick = openWeeklyVoting;
  } else {
    statusText.textContent = 'La votación está cerrada.';
    statusText.style.color = 'var(--bg)';
    statusText.style.opacity = '0.8';
    actionBtn.textContent = 'Abrir votación (Admin)';
    actionBtn.onclick = openAdminVoting;
  }
};

window.openAdminVoting = async function openAdminVoting() {
  // Solo admins pueden abrir votaciones. Por ahora lo abrimos directamente.
  const { data, error } = await supabase
    .from('weekly_votings')
    .insert([{ group_id: state.currentGroupId, status: 'open' }])
    .select();

  if (error) {
    showToast('Error al abrir votación');
    return;
  }
  
  showToast('Votación abierta ✓');
  loadWeeklyVotingStatus();
};

window.openWeeklyVoting = async function openWeeklyVoting() {
  if (!state.currentVoting) return;

  const container = document.getElementById('voting-labels-container');
  const labels = state.groupLabels || [];
  const members = state.members || [];

  if (labels.length === 0) {
    container.innerHTML = '<div style="font-size:13px;color:var(--ink3);text-align:center;padding:20px;">El grupo no tiene etiquetas creadas.</div>';
    document.getElementById('voting-submit-container').style.display = 'none';
    showScreen('voting');
    return;
  }

  // Cargar mis votos anteriores si los hay
  const { data: myVotes } = await supabase
    .from('weekly_votes')
    .select('*')
    .eq('voting_id', state.currentVoting.id)
    .eq('voter_id', state.currentUserId);

  let html = '';
  labels.forEach(label => {
    const existingVote = (myVotes || []).find(v => v.label_id === label.id);
    let optionsHtml = '<option value="">Ninguno</option>';
    members.forEach(m => {
      const selected = (existingVote && existingVote.target_user_id === m.id) ? 'selected' : '';
      optionsHtml += `<option value="${m.id}" ${selected}>${m.name}</option>`;
    });

    html += `
      <div class="card" style="padding:14px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="font-size:28px;">${label.emoji}</div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:800;">${label.name}</div>
          </div>
        </div>
        <select class="form-input voting-select" data-label-id="${label.id}">
          ${optionsHtml}
        </select>
      </div>
    `;
  });

  html += `
    <button class="btn btn-secondary btn-full" style="margin-top:20px;" onclick="closeWeeklyVotingAdmin()">Cerrar Votación (Admin)</button>
  `;

  container.innerHTML = html;
  document.getElementById('voting-submit-container').style.display = 'block';
  showScreen('voting');
};

window.submitWeeklyVotes = async function submitWeeklyVotes() {
  if (!state.currentVoting) return;

  const selects = document.querySelectorAll('.voting-select');
  const votesToInsert = [];

  selects.forEach(select => {
    const targetUserId = select.value;
    const labelId = select.getAttribute('data-label-id');
    if (targetUserId) {
      votesToInsert.push({
        voting_id: state.currentVoting.id,
        label_id: labelId,
        voter_id: state.currentUserId,
        target_user_id: targetUserId
      });
    }
  });

  if (votesToInsert.length === 0) {
    showToast('No has votado a nadie');
    return;
  }

  // Primero borrar mis votos anteriores en esta votación
  await supabase
    .from('weekly_votes')
    .delete()
    .eq('voting_id', state.currentVoting.id)
    .eq('voter_id', state.currentUserId);

  // Insertar nuevos votos
  const { error } = await supabase.from('weekly_votes').insert(votesToInsert);

  if (error) {
    console.error('Error saving votes:', error);
    showToast('Error al guardar votos');
  } else {
    showToast('Votos enviados ✓');
    goBack();
  }
};

window.closeWeeklyVotingAdmin = async function closeWeeklyVotingAdmin() {
  if (!state.currentVoting) return;

  // 1. Marcar como cerrada
  const { error: updateErr } = await supabase
    .from('weekly_votings')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', state.currentVoting.id);

  if (updateErr) {
    showToast('Error al cerrar la votación');
    return;
  }

  // 2. Calcular ganadores
  const { data: allVotes } = await supabase
    .from('weekly_votes')
    .select('*')
    .eq('voting_id', state.currentVoting.id);

  if (allVotes && allVotes.length > 0) {
    const labels = state.groupLabels || [];
    const awarded = [];

    labels.forEach(label => {
      const votesForLabel = allVotes.filter(v => v.label_id === label.id);
      if (votesForLabel.length > 0) {
        // Contar votos por usuario
        const voteCounts = {};
        votesForLabel.forEach(v => {
          voteCounts[v.target_user_id] = (voteCounts[v.target_user_id] || 0) + 1;
        });

        // Encontrar el ganador (o ganadores en caso de empate, para simplificar cogemos el primero)
        let winnerId = null;
        let maxVotes = 0;
        for (const [uid, count] of Object.entries(voteCounts)) {
          if (count > maxVotes) {
            maxVotes = count;
            winnerId = uid;
          }
        }

        if (winnerId) {
          awarded.push({
            user_id: winnerId,
            group_id: state.currentGroupId,
            label_id: label.id,
            voting_id: state.currentVoting.id
          });
        }
      }
    });

    if (awarded.length > 0) {
      await supabase.from('awarded_labels').insert(awarded);
    }
  }

  showToast('Votación cerrada ✓ Resultados publicados');
  goBack();
  loadWeeklyVotingStatus();
};

window.loadMemberLabels = async function loadMemberLabels(memberId) {
  const list = document.getElementById('mp-labels-list');
  if (!list) return;

  const { data, error } = await supabase
    .from('awarded_labels')
    .select('*, group_labels(emoji, name)')
    .eq('user_id', memberId)
    .eq('group_id', state.currentGroupId);

  if (error) {
    console.error('Error loading member labels:', error);
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<span style="font-size:11px;color:var(--ink3);">No ha ganado ninguna etiqueta en este grupo aún.</span>`;
    return;
  }

  // Agrupar por etiqueta
  const counts = {};
  data.forEach(row => {
    const lbl = row.group_labels;
    if (!lbl) return;
    const key = lbl.name;
    if (!counts[key]) counts[key] = { emoji: lbl.emoji, name: lbl.name, count: 0 };
    counts[key].count++;
  });

  let html = '';
  Object.values(counts).forEach(c => {
    html += `
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:6px 10px;display:flex;align-items:center;gap:6px;">
        <span style="font-size:18px;">${c.emoji}</span>
        <span style="font-size:12px;font-weight:700;">x${c.count}</span>
      </div>
    `;
  });
  list.innerHTML = html;
};


window.openCreateGroupModal = function() {
  document.getElementById('modal-create-group').classList.add('open');
};

window.openJoinGroupModal = function() {
  document.getElementById('modal-join-code').classList.add('open');
};
