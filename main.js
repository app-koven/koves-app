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

  if ((name === 'activity' || name === 'roulette') && !state.currentGroupId) {
    showToast('Selecciona o únete a un grupo primero.');
    return;
  }

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

  // FAB solo en la pantalla de planes y si hay grupo
  const fab = document.getElementById('fab-create');
  if (fab) fab.style.display = (name === 'plans' && state.currentGroupId) ? 'flex' : 'none';
  
  // Ocultar barra inferior en pantallas de detalle
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) {
    bottomNav.style.display = DETAIL_SCREENS.includes(name) ? 'none' : 'grid';
  }
  
  window.scrollTo(0, 0);

  if (name === 'activity') {
    if (window.loadActivityFeed) window.loadActivityFeed();
  }
  if (name === 'roulette') {
    if (window.loadRouletteHistory) window.loadRouletteHistory();
  }
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

window.getProfileName = function(id) {
  const m = state.members ? state.members.find(x => x.user_id === id || (x.profiles && x.profiles.id === id)) : null;
  return m ? (m.profiles?.full_name || m.profiles?.name || 'Usuario') : 'Usuario';
};

window.openPlan = async function openPlan(id) {
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
  
  // Guardar el ID del plan activo globalmente
  state.currentPlanId = id;
  
  // --- Asistencia ---
  document.querySelectorAll('#attendance-grid .action-btn').forEach(b => b.classList.remove('selected'));
  
  // Calculate group attendance stats
  const att = p.plan_attendance || [];
  let counts = { voy: 0, tarde: 0, quizas: 0, novoy: 0 };
  let myStatus = null;
  
  att.forEach(a => {
    if (counts[a.status] !== undefined) counts[a.status]++;
    if (a.user_id === state.currentUserId) myStatus = a.status;
  });
  
  const totalGroupMembers = state.members ? state.members.length : 1;
  const totalVoted = att.length;
  
  const pctVoy = totalVoted > 0 ? (counts.voy / totalVoted) * 100 : 0;
  const pctTarde = totalVoted > 0 ? (counts.tarde / totalVoted) * 100 : 0;
  const pctQuizas = totalVoted > 0 ? (counts.quizas / totalVoted) * 100 : 0;
  const pctNovoy = totalVoted > 0 ? (counts.novoy / totalVoted) * 100 : 0;
  
  document.getElementById('att-count-voy').textContent = counts.voy;
  document.getElementById('att-bar-voy').style.width = pctVoy + '%';
  document.getElementById('att-count-tarde').textContent = counts.tarde;
  document.getElementById('att-bar-tarde').style.width = pctTarde + '%';
  document.getElementById('att-count-quizas').textContent = counts.quizas;
  document.getElementById('att-bar-quizas').style.width = pctQuizas + '%';
  document.getElementById('att-count-novoy').textContent = counts.novoy;
  document.getElementById('att-bar-novoy').style.width = pctNovoy + '%';
  
  const pctTotal = totalGroupMembers > 0 ? (totalVoted / totalGroupMembers) * 100 : 0;
  document.getElementById('att-total-bar').style.width = pctTotal + '%';
  document.getElementById('att-total-text').textContent = `${totalVoted} de ${totalGroupMembers} han votado su asistencia`;
  
  if (myStatus) {
    const btn = document.getElementById('btn-att-' + myStatus);
    if (btn) btn.classList.add('selected');
    updateAttendanceBlink(false);
  } else {
    updateAttendanceBlink(true);
  }
  
  const isPast = new Date(p.event_date) < new Date();
  if (isPast) {
    // Disable attendance changes for past plans
    document.querySelectorAll('#attendance-grid .action-btn').forEach(b => {
      b.onclick = () => showToast('No puedes cambiar asistencia de un plan pasado');
    });
    // Hide propose card button
    const proposeBtn = document.getElementById('btn-propose-card');
    if (proposeBtn) proposeBtn.style.display = 'none';
    // Disable comment input
    const commentInput = document.getElementById('comment-input');
    if (commentInput) {
      commentInput.disabled = true;
      commentInput.placeholder = 'Comentarios cerrados (plan pasado)';
    }
    const sendBtn = document.getElementById('comment-send-btn');
    if (sendBtn) sendBtn.style.display = 'none';
  } else {
    // Re-enable everything if it's a future plan
    document.querySelectorAll('#attendance-grid .action-btn').forEach(b => {
      const st = b.id.replace('btn-att-', '');
      b.onclick = () => selectAttendance(st);
    });
    const proposeBtn = document.getElementById('btn-propose-card');
    if (proposeBtn) proposeBtn.style.display = 'block';
    const commentInput = document.getElementById('comment-input');
    if (commentInput) {
      commentInput.disabled = false;
      commentInput.placeholder = 'Añade un comentario...';
    }
    const sendBtn = document.getElementById('comment-send-btn');
    if (sendBtn) sendBtn.style.display = 'block';
  }
  // ------------------
  
  // Cargar las fotos reales
  try { loadPlanPhotos(id); } catch(e){}
  // Cargar tarjetas propuestas
  if (window.loadPlanCards) { try { loadPlanCards(id); } catch(e){} }
  if (window.loadPlanComments) { try { loadPlanComments(id); } catch(e){} }
  if (window.loadPlanExpenses) { try { loadPlanExpenses(id); } catch(e){} }
  try { loadPlanLikes(id); } catch(e){}
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
window.selectAttendance = async function selectAttendance(status) {
  if (!state.currentPlanId || !state.currentUserId) return;
  
  const p = state.plans.find(x => x.id === state.currentPlanId);
  const existing = p?.plan_attendance?.find(a => a.user_id === state.currentUserId);
  const isToggleOff = existing && existing.status === status;

  document.querySelectorAll('#attendance-grid .action-btn').forEach(b => b.classList.remove('selected'));
  
  if (isToggleOff) {
    updateAttendanceBlink(true);
    // Delete from Supabase
    const { error } = await supabase.from('plan_attendance')
      .delete()
      .eq('plan_id', state.currentPlanId)
      .eq('user_id', state.currentUserId);
      
    if (error) {
      showToast('Error al quitar asistencia');
      console.error(error);
      return;
    }
    
    showToast('Asistencia eliminada (pendiente)');
    
    // Update local state
    if (p && p.plan_attendance) {
      p.plan_attendance = p.plan_attendance.filter(a => a.user_id !== state.currentUserId);
    }
  } else {
    const btn = document.getElementById('btn-att-' + status);
    if (btn) btn.classList.add('selected');
    updateAttendanceBlink(false);
    
    // Always DELETE first to prevent duplicates and bypass any missing UPDATE RLS policies
    await supabase.from('plan_attendance')
      .delete()
      .eq('plan_id', state.currentPlanId)
      .eq('user_id', state.currentUserId);

    // Then INSERT the new choice
    const { error } = await supabase.from('plan_attendance')
      .insert([{ plan_id: state.currentPlanId, user_id: state.currentUserId, status: status }]);
    
    if (error) {
      showToast('Error al actualizar asistencia');
      console.error(error);
      return;
    }
    
    showToast('Asistencia actualizada ✓');
    
    // Update local state
    if (p) {
      if (!p.plan_attendance) p.plan_attendance = [];
      const ex = p.plan_attendance.find(a => a.user_id === state.currentUserId);
      if (ex) ex.status = status;
      else p.plan_attendance.push({ plan_id: state.currentPlanId, user_id: state.currentUserId, status: status });
    }
  }
  
  openPlan(state.currentPlanId); // refresh stats
  renderCalendar(); // refresh calendar
  if (window.updatePlanKPIs) window.updatePlanKPIs(); // recalculate top numbers and refresh lists
}

// ── LIKE PLAN ──
window.loadPlanLikes = async function loadPlanLikes(planId) {
  const span = document.getElementById('like-count');
  const btn = document.getElementById('pd-like-btn');
  if (!span || !btn) return;
  
  span.textContent = '...';
  
  const { data: likes, error } = await supabase.from('plan_likes').select('user_id').eq('plan_id', planId);
  if (error) {
    span.textContent = '0';
    return;
  }
  
  span.textContent = likes.length;
  const myLike = likes.find(l => l.user_id === state.currentUserId);
  
  if (myLike) {
    btn.style.background = 'var(--ink)';
    btn.style.color = '#fff';
    btn.dataset.liked = '1';
  } else {
    btn.style.background = '';
    btn.style.color = '';
    delete btn.dataset.liked;
  }
}

window.toggleLike = async function toggleLike(btn) {
  if (!state.currentPlanId || !state.currentUserId) return;
  const span = document.getElementById('like-count');
  const count = parseInt(span.textContent) || 0;
  
  if (btn.dataset.liked) {
    span.textContent = count - 1;
    btn.style.background = '';
    btn.style.color = '';
    delete btn.dataset.liked;
    
    await supabase.from('plan_likes').delete().match({ plan_id: state.currentPlanId, user_id: state.currentUserId });
  } else {
    span.textContent = count + 1;
    btn.style.background = 'var(--ink)';
    btn.style.color = '#fff';
    btn.dataset.liked = '1';
    
    await supabase.from('plan_likes').insert({ plan_id: state.currentPlanId, user_id: state.currentUserId });
  }
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
  
  let proofUrl = null;
  const fileInput = document.getElementById('exp-receipt-input');
  const file = fileInput.files[0];
  
  if (!file) {
    showToast('La foto del comprobante es obligatoria');
    return;
  }
  
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const filePath = `${state.currentGroupId}/${fileName}`;
  
  showGlobalLoading('Subiendo y guardando gasto...');

  try {
    const { error: uploadError } = await supabase.storage
      .from('expense-proofs')
      .upload(filePath, file);
      
    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from('expense-proofs')
        .getPublicUrl(filePath);
      proofUrl = publicUrlData.publicUrl;
    } else {
      throw new Error('Error al subir el comprobante');
    }

    // Usar "rpc" para inserción atómica o hacerlo secuencialmente con control de errores fuerte
    // Create expense
    const { data: exp, error: err1 } = await supabase
      .from('expenses')
      .insert([{
        group_id: state.currentGroupId,
        payer_id: state.currentUserId,
        title: title,
        amount: amount,
        plan_id: planId || null,
        status: 'validated', // Auto-validate for MVP
        proof_url: proofUrl
      }])
      .select()
      .single();

    if (err1) throw err1;

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
      // Rollback manual
      await supabase.from('expenses').delete().eq('id', exp.id);
      throw err2;
    }

    closeModal('modal-expense');
    showToast('Gasto añadido ✓');
    
    if (window.loadExpenses) window.loadExpenses();
    if (planId && state.currentPlanId === planId && window.loadPlanExpenses) {
      loadPlanExpenses(planId);
    }
  } catch (error) {
    console.error(error);
    showToast('Error interno al añadir gasto');
  } finally {
    hideGlobalLoading();
  }
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
    ${d.proof_url ? `<button class="btn btn-secondary btn-full" onclick="openPhotoViewer('${d.proof_url}')" style="margin-bottom:8px;">📎 Ver comprobante</button>` : ''}
    <button class="btn btn-primary btn-full" onclick="reviewExpense('${id}')" style="margin-bottom:8px;">Reclamar gasto</button>
    <button class="btn btn-secondary btn-full" onclick="closeModal('modal-expense-detail')">Cerrar</button>
  `;
  document.getElementById('modal-expense-detail').classList.add('open');
}

// Revisar un gasto/pago del plan: genera una reclamación para el admin.
// Solo se puede reclamar un pago si asististe al plan.
window.reviewExpense = function reviewExpense(id) {
  closeModal('modal-expense-detail');
  const d = (state.expenses || []).find(e => e.id === id);
  // En esta demo el usuario asistió al plan actual; en real se comprobaría.
  const asististe = true;
  if (!asististe) {
    showToast('Solo puedes reclamar pagos de planes a los que asististe');
    return;
  }
  const planName = state.plans?.find(p => p.id === state.currentPlanId)?.title || d?.title || 'gasto';
  openReclamFor('gasto', 'Pago del plan · ' + planName, id);
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

window.showCalModal = async function showCalModal(y, m, day, isFuture) {
  window.calModalYear = y;
  window.calModalMonth = m;
  window.calModalDay = day;
  document.getElementById('cal-modal-title').firstChild.textContent = `Día ${day} de ${meses[m]}`;
  const content = document.getElementById('cal-modal-content');
  content.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--ink3);">Cargando...</div>';
  document.getElementById('modal-cal').classList.add('open');
  
  // Buscar planes para este día en state.plans
  const plans = (state.plans || []).filter(p => {
    if (p.status === 'cancelled') return false;
    const pd = new Date(p.event_date);
    return pd.getFullYear() === y && pd.getMonth() === m && pd.getDate() === day;
  });

  // El botón de crear plan solo tiene sentido en días de hoy/futuros
  const createBtn = document.getElementById('cal-create-btn');
  if (createBtn) createBtn.style.display = (isFuture === false) ? 'none' : 'block';

  if (!plans.length) {
    content.innerHTML = `<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">Sin planes este día</div><div class="empty-sub">${isFuture ? 'Puedes crear uno nuevo.' : 'No hubo planes este día.'}</div></div>`;
    return;
  }

  let html = '';
  for (const p of plans) {
    const isPast = new Date(p.event_date) < new Date();
    const statusLabel = isPast ? 'Finalizado' : (p.status === 'active' ? 'Confirmado' : 'Propuesto');
    const statusCls = isPast ? 'status-finalizado' : (p.status === 'active' ? 'pill-dark' : 'pill-outline');
    
    html += `
    <div class="card-row" style="border:1px solid var(--line);border-radius:var(--r);margin-bottom:8px;background:var(--surface);" onclick="closeModal('modal-cal');openPlan('${p.id}')">
      <div class="card-content">
        <div class="card-name">${p.title}</div>
        <div class="card-sub">${p.description || ''}</div>
      </div>
      <span class="pill ${statusCls}">${statusLabel}</span>
    </div>
    `;

    if (isPast) {
      try {
        // Buscar sanciones (tarjetas) asociadas a este plan
        const { data: cards, error } = await supabase
          .from('assigned_cards')
          .select('*, group_cards(*)')
          .eq('plan_id', p.id);

        if (error) throw error;

        if (cards && cards.length > 0) {
          html += '<div style="margin-left:14px;border-left:2px solid var(--line);padding-left:12px;margin-bottom:14px;margin-top:-4px;">';
          cards.forEach(c => {
            const memberObj = state.members?.find(x => x.id === c.target_user_id);
            const targetName = memberObj ? memberObj.name : 'Usuario';
            const cardDef = c.group_cards || {};
            const cColor = cardDef.color || '#D02020';
            const cName = cardDef.name || 'Tarjeta';
            
            let statusLabelCard = 'Aprobada';
            if (c.status === 'rejected') statusLabelCard = 'Rechazada';
            if (c.status === 'pending') statusLabelCard = 'Pendiente';

            html += `
              <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
                <div style="width:12px;height:16px;border-radius:2px;background:${cColor};flex-shrink:0;margin-top:2px;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.1);"></div>
                <div style="min-width:0;">
                  <div style="font-size:12px;font-weight:700;color:var(--ink);">${targetName}</div>
                  <div style="font-size:11px;color:var(--ink3);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.reason || cName} · ${statusLabelCard}</div>
                </div>
              </div>
            `;
          });
          html += '</div>';
        }
      } catch (err) {
        console.error('Error loading cards for plan', p.id, err);
      }
    }
  }

  content.innerHTML = html;
}

// ── MODALS GENERAL ──
window.closeModal = function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'modal-photo-viewer') {
    document.body.style.overflow = '';
  }
}
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { 
    if (e.target === m) {
      m.classList.remove('open');
      if (m.id === 'modal-photo-viewer') {
        document.body.style.overflow = '';
      }
    }
  });
});

// ── GLOBAL LOADER ──
window.showGlobalLoading = function(text = 'Procesando...') {
  const el = document.getElementById('global-loader');
  const txt = document.getElementById('global-loader-text');
  if (el && txt) {
    txt.textContent = text;
    el.style.display = 'flex';
  }
};

window.hideGlobalLoading = function() {
  const el = document.getElementById('global-loader');
  if (el) el.style.display = 'none';
};

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

window.openUserSheet = async function openUserSheet() {
  if (!state.isLoggedIn) {
    document.getElementById('modal-auth').classList.add('open');
    return;
  }
  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', state.currentUserId).single();
    if (profile) {
      const fullName = profile.full_name || profile.username || 'Usuario';
      const initials = (fullName.substring(0, 2)).toUpperCase();
      document.getElementById('us-avatar').textContent = profile.avatar_url ? '' : initials;
      document.getElementById('us-avatar').style.background = profile.avatar_url || '#0A0A0A';
      document.getElementById('us-name').textContent = fullName;
      document.getElementById('us-handle').textContent = profile.username ? '@' + profile.username : '';
    }
  } catch (err) {
    console.error('Error al cargar perfil para el menú:', err);
  }
  document.getElementById('modal-user').classList.add('open');
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

window.doLogout = async function doLogout() {
  await supabase.auth.signOut();
  closeModal('modal-logout');
  showToast('Sesión cerrada ✓');
  window.location.reload();
}

/* ════════════════════════════════════════════════════════════════
   PERFIL DE USUARIO
   ════════════════════════════════════════════════════════════════ */

window.uploadAvatar = async function uploadAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileExt = file.name.split('.').pop();
  const fileName = `${state.currentUserId}-${Date.now()}.${fileExt}`;
  const filePath = `avatars/${fileName}`;

  showToast('Subiendo foto...');
  try {
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    
    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: `url(${data.publicUrl}) center/cover` })
      .eq('id', state.currentUserId);
      
    if (updateError) throw updateError;
    
    // Update UI immediately
    document.getElementById('ep-avatar').style.background = `url(${data.publicUrl}) center/cover`;
    document.getElementById('ep-avatar').textContent = '';
    document.getElementById('us-avatar').style.background = `url(${data.publicUrl}) center/cover`;
    document.getElementById('us-avatar').textContent = '';
    
    // If header avatar exists
    const hdrAvatar = document.getElementById('hdr-user-avatar');
    if (hdrAvatar) {
      hdrAvatar.style.background = `url(${data.publicUrl}) center/cover`;
      hdrAvatar.textContent = '';
    }
    
    showToast('Foto actualizada ✓');
  } catch (error) {
    console.error('Error uploading avatar:', error);
    showToast('Error al subir la foto');
  }
}

window.openEditProfile = async function openEditProfile() {
  closeModal('modal-user');
  const { data: acc } = await supabase.from('profiles').select('*').eq('id', state.currentUserId).single();
  setTimeout(() => {
    if (acc) {
      const fullName = acc.full_name || acc.username || 'Usuario';
      const initials = (fullName.substring(0, 2)).toUpperCase();
      document.getElementById('ep-avatar').textContent = acc.avatar_url ? '' : initials;
      document.getElementById('ep-avatar').style.background = acc.avatar_url || '#0A0A0A';
      document.getElementById('ep-name').value = acc.full_name || '';
      document.getElementById('ep-handle').value = acc.username || '';
      document.getElementById('ep-phone').value = acc.phone || '';
      document.getElementById('ep-bio').value = acc.bio || '';
    }
    document.getElementById('modal-edit-profile').classList.add('open');
  }, 200);
}

window.submitEditProfile = async function submitEditProfile() {
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
    
    // Update local UI
    const hdrAvatar = document.getElementById('hdr-user-avatar');
    if (hdrAvatar) {
      if (!hdrAvatar.style.backgroundImage || hdrAvatar.style.backgroundImage === 'none') {
        hdrAvatar.textContent = newName.substring(0,2).toUpperCase();
      }
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
  if (state.currentUserId) {
    openMemberProfile(state.currentUserId);
  } else {
    showToast('No has iniciado sesión');
  }
}

window.openNotifications = function openNotifications() {
  closeModal('modal-user');
  setTimeout(() => {
    document.getElementById('modal-notif').classList.add('open');
    if (window.loadNotifications) window.loadNotifications();
  }, 200);
}

window.loadNotifications = async function loadNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  // PURGA INMEDIATA
  list.innerHTML = '<div style="font-size:11px;color:var(--ink3);text-align:center;padding:16px;">Cargando notificaciones...</div>';

  const { data: notifs, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', state.currentUserId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--red);font-size:13px;">Error al cargar notificaciones</div>';
    return;
  }

  // Actualizar KPI
  const unreadCount = (notifs || []).filter(n => !n.read).length;
  // TODO: Si hubiera una campana en la cabecera, actualizaríamos su badge aquí.

  if (!notifs || notifs.length === 0) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--ink3);font-size:13px;">No tienes notificaciones nuevas.</div>';
    return;
  }

  let html = '';
  notifs.forEach(n => {
    const isUnread = !n.read;
    const timeStr = new Date(n.created_at).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
    html += `<div class="feed-item" style="opacity: ${isUnread ? '1' : '0.6'};">
      <div class="feed-num" style="color:${isUnread ? 'var(--blue)' : 'transparent'};">●</div>
      <div class="feed-body">
        <strong>${n.title}</strong>
        <p>${n.body || ''}</p>
      </div>
      <div class="feed-time">${timeStr}</div>
    </div>`;
  });

  list.innerHTML = html;
}

window.markAllNotifAsRead = async function markAllNotifAsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', state.currentUserId)
    .eq('read', false);

  if (!error) {
    showToast('Notificaciones marcadas como leídas');
    if (window.loadNotifications) window.loadNotifications();
    closeModal('modal-notif');
  }
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
  if (window.applyAdminVisibility) window.applyAdminVisibility();
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
  
  showGlobalLoading('Buscando grupo...');
  
  try {
    // 1. Buscar el código en group_invites
    const { data: invite, error: inviteErr } = await supabase
      .from('group_invites')
      .select('group_id')
      .eq('invite_code', code)
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
  } finally {
    hideGlobalLoading();
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
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  showGlobalLoading('Creando grupo...');
  
  try {
    // 1. Insert Group
    const { data: newGroup, error: gError } = await supabase.from('groups').insert([{
      name: name,
      initials: initials,
      color: color,
      created_by: state.currentUserId
    }]).select().single();
    if (gError) throw gError;

    // 2. Insert Admin Member
    const groupId = newGroup.id;
    const { error: mError } = await supabase.from('group_members').insert([{
      group_id: groupId,
      user_id: state.currentUserId,
      role: 'admin'
    }]);
    if (mError) throw mError;

    // 3. Insert Settings
    await supabase.from('group_settings').insert([{ group_id: groupId }]);

    // 4. Generate & Insert Invite Code
    const { error: iError } = await supabase.from('group_invites').insert([{
      group_id: groupId,
      invite_code: inviteCode,
      created_by: state.currentUserId
    }]);
    if (iError) console.error('Error creating invite code:', iError);

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
  } finally {
    hideGlobalLoading();
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

window.openMemberProfile = async function openMemberProfile(id) {
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
  
  // Load real stats
  setText('mp-attended', 'Cargando...');
  setText('mp-groups', 'Cargando...');
  
  // Plans attended by member (voy)
  const { count: attended } = await supabase.from('plan_attendance').select('*', { count: 'exact', head: true }).eq('user_id', id).eq('status', 'voy');
  // Total plans of this group
  const { count: groupPlans } = await supabase.from('plans').select('*', { count: 'exact', head: true }).eq('group_id', state.currentGroupId);
  setText('mp-attended', `${attended || 0}/${groupPlans || 0}`);
  
  // Total groups of member
  const { count: groupsCount } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('user_id', id);
  setText('mp-groups', `${groupsCount || 0}`);

  // Labels won (Vitrina) -> MVP and Tardón from plan_rankings
  const { data: rankings } = await supabase
    .from('plan_rankings')
    .select('category, position')
    .eq('target_user_id', id);
    
  let mvpCount = 0;
  let tardonCount = 0;
  if (rankings) {
    rankings.forEach(r => {
      if (r.category === 'mvp') mvpCount++;
      if (r.category === 'tardon') tardonCount++;
    });
  }
    
  const labelsList = document.getElementById('mp-labels-list');
  if (labelsList) {
    if (mvpCount === 0 && tardonCount === 0) {
      labelsList.innerHTML = `<span style="font-size:11px;color:var(--ink3);">No ha ganado etiquetas semanales aún.</span>`;
    } else {
      let html = '';
      if (mvpCount > 0) html += `<span class="pill" style="font-size:12px;padding:6px 10px;background:var(--amber-bg, #FFFBEB);color:var(--amber, #D97706);border:1px solid var(--amber, #D97706);">🏆 MVP x${mvpCount}</span>`;
      if (tardonCount > 0) html += `<span class="pill" style="font-size:12px;padding:6px 10px;background:var(--red-bg, #FEF2F2);color:var(--red, #DC2626);border:1px solid var(--red, #DC2626);">🐌 Tardón x${tardonCount}</span>`;
      labelsList.innerHTML = html;
    }
  }

  // Cards received (Activas & Historial)
  const { data: sanctionsData } = await supabase
    .from('sanctions')
    .select('*')
    .eq('target_user_id', id)
    .in('status', ['active', 'history'])
    .order('created_at', { ascending: false });
    
  const actualList = document.getElementById('mp-cards-actual-list');
  const historialList = document.getElementById('mp-cards-historial-list');
  
  let actualHtml = '';
  let historialHtml = '';
  
  if (sanctionsData && sanctionsData.length > 0) {
    sanctionsData.forEach(c => {
      const cDate = new Date(c.created_at);
      const isActual = c.status === 'active';
      const color = c.type === 'roja' ? '#991B1B' : '#EAB308';
      const name = c.type === 'roja' ? 'Tarjeta Roja' : 'Tarjeta Amarilla';
      
      const htmlItem = `
        <div class="discipline-item" style="border-bottom:1px solid var(--line2);">
          <div class="disc-avatar" style="background:${color};"></div>
          <div class="disc-body"><div class="disc-name">${name}</div><div style="font-size:10px;color:var(--ink3);">${c.reason}</div></div>
          <span class="pill pill-outline" style="font-size:10px;">${cDate.toLocaleDateString()}</span>
        </div>
      `;
      if (isActual) {
        actualHtml += htmlItem;
      } else {
        historialHtml += htmlItem;
      }
    });
  }
  
  if (actualList) {
    actualList.innerHTML = actualHtml || `<div class="discipline-item" style="border-bottom:0; justify-content:center;"><span style="font-size:11px;color:var(--ink3);">Sin tarjetas activas.</span></div>`;
  }
  if (historialList) {
    historialList.innerHTML = historialHtml || `<div class="discipline-item" style="border-bottom:0; justify-content:center;"><span style="font-size:11px;color:var(--ink3);">Sin historial de tarjetas.</span></div>`;
  }
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
  if (window.loadMemberPlans) loadMemberPlans(id);
  
  showScreen('member');
}

/* ════════════════════════════════════════════════════════════════
   CREAR PLAN
   ════════════════════════════════════════════════════════════════ */

window.openCreatePlan = function openCreatePlan() {
  // Preset fecha
  let targetDate = new Date();
  if (window.calModalYear !== undefined && window.calModalMonth !== undefined && window.calModalDay !== undefined) {
    targetDate = new Date(window.calModalYear, window.calModalMonth, window.calModalDay);
    // Clear global state so it doesn't affect future clicks from elsewhere
    window.calModalYear = undefined;
    window.calModalMonth = undefined;
    window.calModalDay = undefined;
  }
  
  // Format as YYYY-MM-DD local time
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  
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

  const btn = document.querySelector('#modal-create-plan .btn-primary');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creando...';
  }

  try {
    const { data: newPlan, error } = await supabase.from('plans').insert([{
      group_id: state.currentGroupId,
      title: title,
      description: desc,
      location: place,
      type: typeStr,
      event_date: isoDate,
      status: status,
      mode: modeDb,
      created_by: state.currentUserId
    }]).select().single();

    if (error) throw error;
    
    // Auto-confirm attendance for creator
    await supabase.from('plan_attendance').insert([{
      plan_id: newPlan.id,
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
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Crear Plan';
    }
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
  const privacy = document.getElementById('rules-privacy') ? document.getElementById('rules-privacy').value : 'private';
  const showInfo = document.getElementById('rules-show-info') ? document.getElementById('rules-show-info').value === 'true' : true;
  const allowInvites = document.getElementById('rules-allow-invites') ? document.getElementById('rules-allow-invites').value : 'all';

  showGlobalLoading('Guardando reglas...');

  try {
    const { error } = await supabase
      .from('group_settings')
      .update({
        yellow_card_amount: yellowAmount,
        red_card_amount: redAmount,
        privacy: privacy,
        show_info_if_private: showInfo,
        allow_invites: allowInvites
      })
      .eq('group_id', state.currentGroupId);

    if (error) throw error;

    state.groupSettings = { ...state.groupSettings, yellow_card_amount: yellowAmount, red_card_amount: redAmount, privacy: privacy, show_info_if_private: showInfo, allow_invites: allowInvites };
    loadGroupSettings();
    closeModal('modal-rules');
    showToast('Reglas guardadas ✓');
  } catch (err) {
    console.error(err);
    showToast('Error al guardar las reglas');
  } finally {
    hideGlobalLoading();
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
  state.groupSettings = data || { yellow_card_amount: 2, red_card_amount: 10, pot_goal: 'Cena de grupo', privacy: 'private', show_info_if_private: true, allow_invites: 'all' };
  
  if (document.getElementById('rules-yellow-amount')) document.getElementById('rules-yellow-amount').value = state.groupSettings.yellow_card_amount;
  if (document.getElementById('rules-red-amount')) document.getElementById('rules-red-amount').value = state.groupSettings.red_card_amount;
  if (document.getElementById('rules-privacy')) document.getElementById('rules-privacy').value = state.groupSettings.privacy || 'private';
  if (document.getElementById('rules-show-info')) document.getElementById('rules-show-info').value = state.groupSettings.show_info_if_private ? 'true' : 'false';
  if (document.getElementById('rules-allow-invites')) document.getElementById('rules-allow-invites').value = state.groupSettings.allow_invites || 'all';

  window.togglePrivacySettings();

  // Render rules
  const list = document.getElementById('rules-list');
  if (list) {
    const { data: invite } = await supabase
      .from('group_invites')
      .select('code')
      .eq('group_id', state.currentGroupId)
      .eq('is_active', true)
      .maybeSingle();
      
    const inviteCodeStr = invite ? invite.code : 'No hay código';

    list.innerHTML = `
      <div class="card-row" style="cursor:default;">
        <div class="card-content" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div>
            <div class="card-name" style="font-size:13px;">Código de Invitación</div>
            <div class="card-sub">Pásale este código a tus amigos para que se unan</div>
          </div>
          <div style="font-size:16px; font-weight:800; letter-spacing:2px; color:var(--blue); background:var(--bg); padding:6px 12px; border-radius:6px; user-select:all;">${inviteCodeStr}</div>
        </div>
      </div>
      <div class="card-row" style="cursor:default;">
        <div class="card-content">
          <div class="card-name" style="font-size:13px;">Privacidad</div>
          <div class="card-sub">${state.groupSettings.privacy === 'public' ? 'Público (cualquiera puede ver el grupo)' : 'Privado (solo miembros invitados)'}</div>
        </div>
      </div>
      <div class="card-row" style="cursor:default;border-bottom:0;">
        <div class="card-content">
          <div class="card-name" style="font-size:13px;">Invitaciones</div>
          <div class="card-sub">${state.groupSettings.allow_invites === 'admins' ? 'Solo administradores pueden invitar' : 'Cualquier miembro puede invitar'}</div>
        </div>
      </div>
    `;
  }
  
  // Render KPIs as well here since we are loading group data
  if (window.renderGroupKPIs) window.renderGroupKPIs();
}

window.togglePrivacySettings = function() {
  const p = document.getElementById('rules-privacy');
  const r = document.getElementById('row-show-info');
  if (p && r) {
    r.style.display = (p.value === 'private') ? 'flex' : 'none';
  }
}

window.renderGroupKPIs = async function renderGroupKPIs() {
  if (!state.currentGroupId) return;
  
  // 1. Members
  const numMembers = state.members ? state.members.length : 0;
  document.getElementById('kpi-members').textContent = numMembers;
  
  // 2. Plans
  const { count: plansCount } = await supabase.from('plans').select('*', { count: 'exact', head: true }).eq('group_id', state.currentGroupId);
  document.getElementById('kpi-plans').textContent = plansCount || 0;
  
  // 3. Attendance
  const { count: myAttended } = await supabase.from('plan_participants').select('*', { count: 'exact', head: true }).eq('user_id', state.currentUserId);
  let attendancePct = 0;
  if (plansCount > 0) {
    attendancePct = Math.round((myAttended / plansCount) * 100);
  }
  document.getElementById('kpi-attendance').textContent = attendancePct + '%';
  document.getElementById('kpi-attendance-bar').style.width = attendancePct + '%';
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

    // PURGA INMEDIATA
    state.expenses = [];
    if (window.renderExpensesList) window.renderExpensesList();
    
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
    let totalAssisted = 0;
    let paidByMe = 0;
    let owedToMe = 0;
    let oweToOthers = 0;

    const me = state.currentUserId;

    // Planes a los que he asistido
    const attendedPlans = new Set();
    (state.plans || []).forEach(p => {
      const myAtt = p.plan_attendance?.find(a => a.user_id === me);
      if (myAtt && (myAtt.status === 'voy' || myAtt.status === 'tarde')) {
        attendedPlans.add(p.id);
      }
    });

    state.expenses.forEach(exp => {
      totalGroup += exp.amount;
      if (exp.plan_id && attendedPlans.has(exp.plan_id)) {
        totalAssisted += exp.amount;
      }
      if (exp.payer_id === me) {
        paidByMe += exp.amount;
      }
      
      const splits = exp.expense_splits || [];
      splits.forEach(split => {
        if (split.status !== 'paid') {
          if (split.debtor_id === me && exp.payer_id !== me) {
            oweToOthers += split.amount;
          }
          if (exp.payer_id === me && split.debtor_id !== me) {
            owedToMe += split.amount;
          }
        }
      });
    });

    const balance = paidByMe - oweToOthers;

    document.getElementById('kpi-exp-total').textContent = totalGroup.toFixed(2) + '€';
    document.getElementById('kpi-exp-assisted').textContent = totalAssisted.toFixed(2) + '€';
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
          // Te deben: Tú pagaste y el deudor no eres tú
          if (exp.payer_id === me && split.debtor_id !== me) {
            if (!owedByMap[split.debtor_id]) owedByMap[split.debtor_id] = { total: 0, pending: [], requested: [] };
            owedByMap[split.debtor_id].total += split.amount;
            if (split.status === 'requested') owedByMap[split.debtor_id].requested.push(split);
            else owedByMap[split.debtor_id].pending.push(split);
          }
          // Tú debes: Tú eres el deudor y el pagador no eres tú
          if (split.debtor_id === me && exp.payer_id !== me) {
            if (!oweToMap[exp.payer_id]) oweToMap[exp.payer_id] = { total: 0, pending: [], requested: [] };
            oweToMap[exp.payer_id].total += split.amount;
            if (split.status === 'requested') oweToMap[exp.payer_id].requested.push(split);
            else oweToMap[exp.payer_id].pending.push(split);
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
      for (const [uid, data] of Object.entries(owedByMap)) {
        html += `<div class="card" style="padding:14px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:13px;font-weight:600;">${getProfileName(uid)} te debe</div>
            <div style="font-size:15px;font-weight:900;color:var(--green);">+${data.total.toFixed(2)}€</div>
          </div>`;
        if (data.requested.length > 0) {
          html += `<div style="margin-top:12px;"><button class="btn btn-secondary btn-full" style="padding:8px;font-size:12px;" onclick="openRevisarPago('${uid}', ${data.total})">Revisar pago enviado</button></div>`;
        }
        html += `</div>`;
      }
      cTeDeben.innerHTML = html;
    }

    const cTuDebes = document.getElementById('pendientes-tu-debes');
    if (Object.keys(oweToMap).length === 0) {
      cTuDebes.innerHTML = '<div class="card" style="padding:14px;text-align:center;color:var(--ink3);font-size:12px;">No tienes deudas pendientes.</div>';
    } else {
      let html = '';
      for (const [uid, data] of Object.entries(oweToMap)) {
        html += `<div class="card" style="padding:14px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:13px;font-weight:600;">Debes a ${getProfileName(uid)}</div>
            <div style="font-size:15px;font-weight:900;color:var(--red);">${data.total.toFixed(2)}€</div>
          </div>`;
        if (data.pending.length > 0) {
          html += `<div style="margin-top:12px;"><button class="btn btn-primary btn-full" style="padding:8px;font-size:12px;" onclick="openLiquidarItem('${uid}', ${data.total})">Liquidar</button></div>`;
        } else if (data.requested.length > 0) {
          html += `<div style="margin-top:12px;font-size:11px;color:var(--ink3);text-align:center;">Pendiente de que confirmen tu pago</div>`;
        }
        html += `</div>`;
      }
      cTuDebes.innerHTML = html;
    }

    // Historial se renderiza por separado
    window.renderHistorialExpenses();
  }

  window.renderHistorialExpenses = function renderHistorialExpenses() {
    const histGastos = [];
    const histTrans = [];
    const now = new Date();
    // Use the offset defined globally (histExpOffset)
    const targetY = now.getFullYear();
    const targetM = now.getMonth() + (window.histExpOffset || 0);
    // targetDate normalizes month overflow/underflow
    const targetDate = new Date(targetY, targetM, 1);
    const filterY = targetDate.getFullYear();
    const filterM = targetDate.getMonth();

    state.expenses.forEach(exp => {
      const eDate = new Date(exp.created_at);
      if (eDate.getFullYear() === filterY && eDate.getMonth() === filterM) {
        histGastos.push(exp);
      }
      
      const splits = exp.expense_splits || [];
      splits.forEach(split => {
        if (split.status === 'paid') {
          const tDate = new Date(split.created_at);
          if (tDate.getFullYear() === filterY && tDate.getMonth() === filterM) {
            histTrans.push({ exp, split });
          }
        }
      });
    });

    const getProfileName = (id) => {
      const m = state.members.find(x => x.id === id);
      return m ? m.name : 'Usuario';
    };

    const listGastos = document.getElementById('historial-gastos');
    if (listGastos) {
      if (histGastos.length === 0) {
        listGastos.innerHTML = '<div class="card" style="padding:14px;text-align:center;color:var(--ink3);font-size:12px;">No hay gastos en este mes.</div>';
      } else {
        let html = '';
        histGastos.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).forEach(exp => {
          html += `<div class="card" style="padding:0 14px;margin-bottom:14px;">
            <div class="expense-item" style="border-bottom:0;" onclick="openExpenseDetail('${exp.id}')">
              <div class="exp-left">
                <div class="exp-icon">🧾</div>
                <div class="exp-info">
                  <div class="exp-name">${exp.title}</div>
                  <div class="exp-sub">Pagado por ${getProfileName(exp.payer_id)}</div>
                </div>
              </div>
              <div class="exp-amount">${exp.amount.toFixed(2)}€</div>
            </div>
          </div>`;
        });
        listGastos.innerHTML = html;
      }
    }

    const listTrans = document.getElementById('historial-transferencias');
    if (listTrans) {
      if (histTrans.length === 0) {
        listTrans.innerHTML = '<div class="card" style="padding:14px;text-align:center;color:var(--ink3);font-size:12px;">No hay transferencias este mes.</div>';
      } else {
        let html = '';
        histTrans.sort((a,b) => new Date(b.split.created_at) - new Date(a.split.created_at)).forEach(t => {
          html += `<div class="card" style="padding:0 14px;margin-bottom:14px;">
            <div class="expense-item" style="border-bottom:0;">
              <div class="exp-left">
                <div class="exp-icon" style="background:var(--bg3);color:var(--ink2);">💸</div>
                <div class="exp-info">
                  <div class="exp-name">${getProfileName(t.split.debtor_id)} a ${getProfileName(t.exp.payer_id)}</div>
                  <div class="exp-sub">Liquidado · ${new Date(t.split.created_at).toLocaleDateString('es-ES')}</div>
                </div>
              </div>
              <div class="exp-amount positive">+${t.split.amount.toFixed(2)}€</div>
            </div>
          </div>`;
        });
        listTrans.innerHTML = html;
      }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${state.currentUserId}` }, payload => {
        if (window.loadNotifications) window.loadNotifications();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🔗 Suscrito en tiempo real al grupo', state.currentGroupId);
        }
      });
  }

  // Carga paralela de componentes al cambiar de contexto o iniciar
  



/* ════════════════════════════════════════════════════════════════
   V5: AGENDA TAB SWITCH (compatibilidad — pantalla agenda eliminada)
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

  // Create planMap dynamically from state.plans
  const planMap = {};
  if (state.plans && state.plans.length) {
    state.plans.forEach(plan => {
      if (plan.status !== 'cancelled') {
        const pd = new Date(plan.event_date);
        if (pd.getFullYear() === y && pd.getMonth() === m) {
          const day = pd.getDate();
          const myAtt = plan.plan_attendance?.find(a => a.user_id === state.currentUserId);
          let att = 'pendiente';
          if (myAtt) {
            att = 'confirmado'; // Cualquiera de las 4 opciones cuenta como confirmado
          }
          planMap[day] = att;
        }
      }
    });
  }

  const todayKey = `${todayY}-${todayM}`;
  const currentKey = `${y}-${m}`;
  const lastDate = new Date(y, m + 1, 0).getDate();

  for (let day = 1; day <= lastDate; day++) {
    const isToday = (currentKey === todayKey && day === todayD);
    const dayDate = new Date(y, m, day);
    const isPastDay = dayDate < new Date(todayY, todayM, todayD);
    const attendance = planMap[day];   
    let dayCls = 'cal-day';
    if (isToday) dayCls += ' today';
    else if (isPastDay) dayCls += ' past';
    
    if (attendance) dayCls += ' has-plan att-' + attendance;
    
    const isFuture = !isPastDay;
    html += `<div class="${dayCls}" onclick="showCalModal(${y}, ${m}, ${day}, ${isFuture})">${day}</div>`;
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
  if (window.renderPlanLists) window.renderPlanLists();
}

// Navegador de meses de planes activos — sincronizado con el calendario
window.plansMonthNav = function plansMonthNav(delta) {
  state.calendarMonthOffset += delta;
  renderCalendar();
  syncMonthLabels();
  syncHistPlansLabel();
  if (window.renderPlanLists) window.renderPlanLists();
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
  if (window.renderPlanLists) window.renderPlanLists();
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
  
  const now = new Date();
  const futurePlans = (state.plans || []).filter(p => new Date(p.event_date) >= now);
  const pastPlans = (state.plans || []).filter(p => new Date(p.event_date) < now);

  if (kind === 'pendientes') {
    title.firstChild.textContent = 'Planes pendientes ';
    // Planes activos en los que aún NO has marcado tu asistencia
    planes = futurePlans.filter(p => {
      const att = (p.plan_attendance || []).find(a => a.user_id === state.currentUserId);
      return !att || !att.status;
    });
  } else if (kind === 'activos') {
    title.firstChild.textContent = 'Planes activos ';
    // Planes activos en los que SÍ has marcado tu asistencia (confirmados)
    planes = futurePlans.filter(p => {
      const att = (p.plan_attendance || []).find(a => a.user_id === state.currentUserId);
      return att && att.status;
    });
  } else {
    title.firstChild.textContent = 'Histórico ';
    // Planes pasados a los que asististe (voy o tarde)
    planes = pastPlans.filter(p => {
      const att = (p.plan_attendance || []).find(a => a.user_id === state.currentUserId);
      return att && (att.status === 'voy' || att.status === 'tarde');
    });
  }
  
  const planesMapped = planes.map(p => {
    const d = new Date(p.event_date);
    const dateStr = d.toLocaleString('es-ES', {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
    
    const att = (p.plan_attendance || []).find(a => a.user_id === state.currentUserId);
    const myStatus = att ? att.status : null;
    let tag = 'Pendiente';
    let tagCls = 'attendance-tag pendiente';
    if (myStatus === 'voy') { tag = '✓ Voy'; tagCls = 'attendance-tag voy'; }
    else if (myStatus === 'tarde') { tag = '⏱️ Llego tarde'; tagCls = 'attendance-tag voy'; }
    else if (myStatus === 'novoy') { tag = '✗ No voy'; tagCls = 'attendance-tag novoy'; }
    else if (myStatus === 'quizas') { tag = '? Quizás'; tagCls = 'attendance-tag quizas'; }
    
    return { id: p.id, label: dateStr, name: p.title || 'Plan sin título', tag, tagCls };
  });

  content.innerHTML = planesMapped.length ? planesMapped.map(p => `
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



window.loadPlanComments = async function loadPlanComments(planId) {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;font-size:12px;color:var(--ink3);padding:10px;">Cargando comentarios...</div>';

  const { data: comments, error } = await supabase
    .from('plan_comments')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loadPlanComments:', error);
    list.innerHTML = '<div style="text-align:center;font-size:12px;color:var(--red);padding:10px;">Error al cargar comentarios</div>';
    return;
  }

  const countEl = document.getElementById('comment-count-2');
  const countElIcon = document.getElementById('comment-count');
  const cLen = comments ? comments.length : 0;
  if (countEl) countEl.textContent = cLen;
  if (countElIcon) countElIcon.textContent = cLen;

  if (!comments || comments.length === 0) {
    list.innerHTML = '<div style="text-align:center;font-size:12px;color:var(--ink3);padding:10px;">No hay comentarios aún.</div>';
    return;
  }

  // Build tree
  const roots = comments.filter(c => !c.parent_comment_id);
  const replies = comments.filter(c => c.parent_comment_id);

  let html = '';
  try {
    roots.forEach(r => {
      html += generateCommentHtml(r, replies.filter(rep => rep.parent_comment_id === r.id));
    });
  } catch (err) {
    console.error('Error generating comment html:', err);
    html = '<div style="text-align:center;font-size:12px;color:var(--red);padding:10px;">Error al mostrar comentarios</div>';
  }

  list.innerHTML = html;
}

function generateCommentHtml(comment, thread = []) {
  const name = getProfileName(comment.user_id) || 'Usuario';
  const initials = name.length >= 2 ? name.substring(0,2).toUpperCase() : 'US';
  const time = comment.created_at ? new Date(comment.created_at).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}) : '';
  const authorHandle = '@' + (name.split(' ')[0] || 'usuario').toLowerCase();
  
  let html = `
    <div class="comment" data-author="${authorHandle}" data-comment-id="${comment.id}">
      <div class="comment-header">
        <div class="comment-avatar" style="background:var(--blue);">${initials}</div>
        <div class="comment-author">${name}</div>
        <div class="comment-time">${time}</div>
      </div>
      <div class="comment-text">${comment.text || ''}</div>
      <div class="comment-actions">
        <span class="comment-action" onclick="likeComment('${comment.id}')">❤ ${comment.likes_count || 0}</span>
        <span class="comment-action" onclick="startReply('${authorHandle}','${comment.id}')">Responder</span>
      </div>`;

  if (thread.length > 0) {
    html += '<div class="comment-reply-thread">';
    thread.forEach(rep => {
      const rname = getProfileName(rep.user_id) || 'Usuario';
      const rinitials = rname.length >= 2 ? rname.substring(0,2).toUpperCase() : 'US';
      const rtime = rep.created_at ? new Date(rep.created_at).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}) : '';
      const rauthorHandle = '@' + (rname.split(' ')[0] || 'usuario').toLowerCase();
      html += `
        <div class="comment-reply" data-author="${rauthorHandle}" data-comment-id="${rep.id}">
          <div class="comment-header">
            <div class="comment-avatar" style="background:var(--green);">${rinitials}</div>
            <div class="comment-author">${rname}</div>
            <div class="comment-time">${rtime}</div>
          </div>
          <div class="comment-text">${rep.text || ''}</div>
          <div class="comment-actions">
            <span class="comment-action" onclick="likeComment('${rep.id}')">❤ ${rep.likes_count || 0}</span>
            <span class="comment-action" onclick="startReply('${rauthorHandle}','${comment.id}')">Responder</span>
          </div>
        </div>`;
    });
    html += '</div>';
  } else {
    html += '<div class="comment-reply-thread"></div>';
  }

  html += `</div>`;
  return html;
}

window.addComment = async function addComment() {
  const input = document.getElementById('comment-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) { showToast('Escribe algo antes de enviar'); return; }

  const startsWithMention = /^@[\w]+\s/.test(val);
  const parentId = (startsWithMention && pendingReplyRootId) ? pendingReplyRootId : null;

  input.value = 'Enviando...';
  input.disabled = true;

  try {
    const { error } = await supabase.from('plan_comments').insert([{
      plan_id: state.currentPlanId,
      user_id: state.currentUserId,
      text: val,
      parent_comment_id: parentId
    }]);

    if (error) throw error;

    // Increment the counters immediately for snappy UI
    const countEl = document.getElementById('comment-count-2');
    const countElIcon = document.getElementById('comment-count');
    if (countEl) countEl.textContent = parseInt(countEl.textContent || 0) + 1;
    if (countElIcon) countElIcon.textContent = parseInt(countElIcon.textContent || 0) + 1;
    loadPlanComments(state.currentPlanId);
  } catch (err) {
    console.error('Error insertando comentario:', err);
    showToast('Error al enviar el comentario');
  } finally {
    input.value = '';
    input.disabled = false;
    pendingReplyRootId = null;
  }
}

window.likeComment = async function likeComment(commentId) {
  const { error } = await supabase.rpc('increment_like', { row_id: commentId });
  if (error) {
    console.error('Error liking comment:', error);
    showToast('Error al dar me gusta');
  } else {
    loadPlanComments(state.currentPlanId);
  }
}

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
  if (planSelect) {
    if (fromPlan) {
      planSelect.innerHTML = `<option value="${state.currentPlanId}">Plan Actual</option>`;
      planSelect.value = state.currentPlanId;
    } else {
      planSelect.innerHTML = '<option value="">Sin plan asociado</option>';
      if (state.plans) {
        state.plans.forEach(p => {
          const d = new Date(p.event_date);
          const dateStr = d.toLocaleString('es-ES', {month:'short', day:'numeric'});
          planSelect.innerHTML += `<option value="${p.id}">${p.title} · ${dateStr}</option>`;
        });
      }
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
  try {
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
  } catch (err) {
    console.error('Error opening chat:', err);
    showToast('Error al abrir el chat');
  }
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

window.loadActivityFeed = async function loadActivityFeed() {
  if (!state.currentGroupId) return;
  
  // Usar allSettled asegura que si una falla, las demás sigan cargando.
  await Promise.allSettled([
    loadActivityPlans(),
    loadActivityTribunal(),
    loadActivityClaims()
  ]);
}

window.loadActivityPlans = async function loadActivityPlans() {
  const container = document.getElementById('feed-list');
  if (!container) return;
  
  if (container) container.innerHTML = '<div style="font-size:11px;color:var(--ink3);text-align:center;padding:16px;">Cargando planes...</div>';

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('group_id', state.currentGroupId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error loadActivityPlans:', error);
    container.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--ink3);">Error al cargar planes.</div>';
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--ink3);">Aún no hay planes en este grupo.</div>';
    return;
  }

  let html = '';
  data.forEach(p => {
    const d = new Date(p.date + 'T' + (p.time || '00:00:00'));
    const dateStr = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    const isPast = d < new Date();
    
    html += `
      <div class="feed-item card">
        <div class="feed-icon">\uD83D\uDCC5</div>
        <div class="feed-content" onclick="openPlan('${p.id}')">
          <div class="feed-header">
            <span>${p.title}</span>
            <span class="feed-time">${dateStr}</span>
          </div>
          <div class="feed-body">
            <p>${p.description || 'Sin descripción'}</p>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

window.loadActivityTribunal = async function loadActivityTribunal() {
  const container = document.getElementById('tribunal-activas');
  if (!container) return;
  
  if (container) container.innerHTML = '<div style="font-size:11px;color:var(--ink3);text-align:center;padding:16px;">Cargando tarjetas...</div>';
  
  const { data, error } = await supabase
    .from('assigned_cards')
    .select('*, group_cards(name, color, description), profiles!assigned_cards_target_user_id_fkey(name, username), proposed_by_profile:profiles!assigned_cards_proposed_by_fkey(name)')
    .eq('group_id', state.currentGroupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  let votes = [];
  if (data && data.length > 0) {
    const cardIds = data.map(c => c.id);
    const { data: vData } = await supabase
      .from('assigned_card_votes')
      .select('*')
      .in('assigned_card_id', cardIds);
    votes = vData || [];
  }

  if (error) {
    console.error('Error loadActivityTribunal:', error);
    container.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--ink3);">Error al cargar tribunal.</div>';
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--ink3);">No hay votaciones activas en este grupo.</div>';
    return;
  }

  let html = '';
  data.forEach(c => {
    const cardColor = c.group_cards?.color || '#C07000';
    const cardName = c.group_cards?.name || 'Tarjeta';
    const targetName = c.profiles?.name || 'Usuario';
    const proposedByName = c.proposed_by_profile?.name || 'Alguien';

    const cardVotes = votes.filter(v => v.assigned_card_id === c.id);
    const favor = cardVotes.filter(v => v.vote === 'favor').length;
    const contra = cardVotes.filter(v => v.vote === 'contra').length;
    const hasVoted = cardVotes.some(v => v.user_id === state.currentUserId);

    let voteUI = '';
    if (hasVoted) {
      voteUI = `<div style="font-size:11px;font-weight:700;color:var(--ink3);text-align:center;">Ya has votado. A favor: ${favor} | En contra: ${contra}</div>`;
    } else {
      voteUI = `
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" style="flex:1;background:var(--ok);color:#fff;" onclick="voteCard('${c.id}', 'favor', this)">A favor (${favor})</button>
          <button class="btn btn-primary" style="flex:1;background:var(--alert);color:#fff;" onclick="voteCard('${c.id}', 'contra', this)">En contra (${contra})</button>
        </div>
      `;
    }
    
    html += `
      <div class="card" style="margin-bottom:12px;padding:14px;border:1px solid ${cardColor};">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:12px;height:16px;border-radius:2px;background:${cardColor};"></div>
            <div style="font-size:13px;font-weight:800;">${cardName} a ${targetName}</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--ink2);margin-bottom:12px;">Propuesta por ${proposedByName}. ¿Estás de acuerdo?</div>
        ${voteUI}
        <div style="margin-top:12px;">
          <button class="btn btn-secondary" style="width:100%;font-size:11px;padding:8px;background:#25D366;color:#fff;border:none;" onclick="shareToWhatsApp('🚨 ¡ATENCIÓN! He propuesto una ${cardName} para ${targetName}. ¡Entrad todos a votar al Tribunal de KOves!')">
            Compartir al Grupo de WhatsApp 💬
          </button>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

window.shareToWhatsApp = function shareToWhatsApp(text) {
  const url = encodeURIComponent('https://koves.app'); // Update with actual URL when deployed
  const encodedText = encodeURIComponent(text + '\n\nLink: ' + url);
  window.open(`https://wa.me/?text=${encodedText}`, '_blank');
}

window.sharePlanToWhatsApp = function sharePlanToWhatsApp() {
  const p = state.plans.find(x => x.id === state.currentPlanId);
  if (!p) return;
  const dateStr = new Date(p.event_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' });
  const text = `📅 ¡Plan propuesto: ${p.title}!\nCuándo: ${dateStr}\n\nApúntate en KOves para saber cuántos somos:`;
  shareToWhatsApp(text);
}

window.voteCard = async function voteCard(cardId, voteType, btnElement) {
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.textContent = 'Votando...';
  }
  const { error } = await supabase.from('assigned_card_votes').insert({
    assigned_card_id: cardId,
    user_id: state.currentUserId,
    vote: voteType
  });
  if (error) {
    if (error.code === '23505') {
      showToast('Ya has votado esta tarjeta');
    } else {
      showToast('Error al votar');
      console.error(error);
    }
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.textContent = voteType === 'favor' ? 'A favor' : 'En contra';
    }
  } else {
    showToast('Voto registrado ✓');
    if (window.loadActivityTribunal) window.loadActivityTribunal();
  }
}

window.loadActivityClaims = async function loadActivityClaims() {
  const container = document.getElementById('reclam-activas');
  if (!container) return;
  
  container.innerHTML = '<div style="font-size:11px;color:var(--ink3);text-align:center;padding:16px;">Cargando reclamos...</div>';

  const { data, error } = await supabase
    .from('claims')
    .select('*, profiles(name, username)')
    .eq('group_id', state.currentGroupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loadActivityClaims:', error);
    container.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--ink3);">Error al cargar reclamaciones.</div>';
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--ink3);">No hay reclamaciones activas.</div>';
    return;
  }

  let html = '';
  data.forEach(c => {
    const creatorName = c.profiles?.name || 'Usuario';
    const amount = c.amount || 0;
    
    let adminButtons = '';
    if (state.isAdmin) {
      adminButtons = `
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn btn-secondary" style="flex:1;font-size:12px;padding:6px;" onclick="resolveClaim('${c.id}', 'approved')">Aprobar</button>
          <button class="btn btn-secondary" style="flex:1;font-size:12px;padding:6px;" onclick="resolveClaim('${c.id}', 'rejected')">Rechazar</button>
        </div>
      `;
    }

    html += `
      <div class="card" style="padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:800;">${creatorName}</div>
          <div style="font-size:13px;font-weight:800;color:var(--brand);">${amount}€</div>
        </div>
        <div style="font-size:12px;color:var(--ink2);">Reclama que ha pagado gastos del grupo o similar. Concepto: ${c.description || 'N/A'}</div>
        ${adminButtons}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

window.resolveClaim = async function resolveClaim(claimId, newStatus) {
  showGlobalLoading(newStatus === 'approved' ? 'Aprobando...' : 'Rechazando...');

  try {
    const { error } = await supabase.from('claims').update({ status: newStatus }).eq('id', claimId);
    if (error) {
      showToast('Error al resolver la reclamación');
      console.error(error);
    } else {
      showToast('Reclamación ' + (newStatus === 'approved' ? 'aprobada ✓' : 'rechazada ✗'));
      loadActivityClaims();
    }
  } catch (err) {
    console.error(err);
  } finally {
    hideGlobalLoading();
  }
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
let newReclamRefId = null;
window.openReclamFor = function openReclamFor(type, contextLabel, refId = null) {
  newReclamType = type;
  newReclamContext = contextLabel || '';
  newReclamRefId = refId;
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
window.submitReclam = async function submitReclam() {
  const motivo = document.getElementById('reclam-motivo').value.trim();
  if (!motivo) { showToast('Debes explicar el motivo de la reclamación'); return; }
  
  const btn = document.querySelector('#modal-new-reclam .btn-primary');
  if (btn) btn.textContent = 'Enviando...';

  const typeValue = newReclamType === 'pago' ? 'gasto' : newReclamType;
  const { error } = await supabase.from('claims').insert([{
    claimant_id: state.currentUserId,
    group_id: state.currentGroupId,
    type: typeValue,
    reference_id: newReclamRefId || state.currentPlanId || '00000000-0000-0000-0000-000000000000',
    reason: `[${newReclamContext}] ${motivo}`,
    status: 'active'
  }]);

  if (btn) btn.textContent = 'Enviar reclamación';

  if (error) {
    console.error(error);
    showToast('Error al enviar la reclamación');
  } else {
    closeModal('modal-new-reclam');
    showToast('Reclamación enviada · Pendiente de revisión del admin ✓');
    if (window.loadActivityClaims) window.loadActivityClaims();
  }
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
  if (!state.currentGroupId) {
    showToast('Selecciona o únete a un grupo primero.');
    return;
  }
  const g = state.myGroups.find(x => x.id === state.currentGroupId);
  const name = g ? g.name : 'Grupo';
  const initials = g ? g.initials : 'G';
  const color = g ? g.color : '#0A0A0A';
  openChat(state.currentGroupId, name, initials, color, 'group');
}

// Liquidar deuda individual
window.openLiquidarItem = function openLiquidarItem(toId, amount) {
  liqCurrentTo = toId;
  const m = state.members.find(x => x.id === toId);
  const name = m ? m.name : 'Usuario';
  document.getElementById('liq-item-name').textContent = 'Debes a ' + name;
  document.getElementById('liq-item-amount').textContent = '−' + amount.toFixed(2) + '€';
  document.getElementById('liq-proof-input').value = ''; // Reset input
  document.getElementById('modal-liquidar-item').classList.add('open');
}

let liqCurrentTo = null;

window.confirmLiquidar = async function confirmLiquidar() {
  const fileInput = document.getElementById('liq-proof-input');
  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('Debes adjuntar el comprobante primero');
    return;
  }
  
  const file = fileInput.files[0];
  const fileExt = file.name.split('.').pop();
  const fileName = `${state.currentUserId}-${Date.now()}.${fileExt}`;
  const filePath = `${state.currentGroupId}/${fileName}`;

  const btn = document.getElementById('liq-confirm-btn');
  const prevText = btn.textContent;
  btn.textContent = 'Subiendo...';
  btn.disabled = true;
  
  // Subir archivo al bucket
  const { error: uploadError } = await supabase.storage
    .from('expense-proofs')
    .upload(filePath, file);

  if (uploadError) {
    console.error(uploadError);
    showToast('Error al subir comprobante');
    btn.textContent = prevText;
    btn.disabled = false;
    return;
  }

  // Buscar todos los splits pendientes que le debes a esta persona
  const splitIds = [];
  state.expenses.forEach(exp => {
    if (exp.payer_id === liqCurrentTo) {
      const splits = exp.expense_splits || [];
      splits.forEach(split => {
        if (split.debtor_id === state.currentUserId && split.status === 'pending') {
          splitIds.push(split.id);
        }
      });
    }
  });

  if (splitIds.length > 0) {
    const { error: updateError } = await supabase
      .from('expense_splits')
      .update({ status: 'requested', proof_url: filePath })
      .in('id', splitIds);

    if (updateError) {
      console.error(updateError);
      showToast('Error al actualizar deudas');
    } else {
      showToast('Pago enviado ✓');
      closeModal('modal-liquidar-item');
      if (window.loadExpenses) window.loadExpenses();
    }
  }
  
  btn.textContent = prevText;
  btn.disabled = false;
}

window.revisarCurrentFrom = null;
window.revisarSplitIds = [];

window.openRevisarPago = async function openRevisarPago(fromId, amount) {
  let proofPath = null;
  const splitIds = [];
  
  state.expenses.forEach(exp => {
    if (exp.payer_id === state.currentUserId) {
      const splits = exp.expense_splits || [];
      splits.forEach(split => {
        if (split.debtor_id === fromId && split.status === 'requested') {
          splitIds.push(split.id);
          if (!proofPath && split.proof_url) proofPath = split.proof_url;
        }
      });
    }
  });

  if (splitIds.length === 0) return;

  window.revisarCurrentFrom = fromId;
  window.revisarSplitIds = splitIds;

  const m = state.members.find(x => x.id === fromId);
  const name = m ? m.name : 'Usuario';
  document.getElementById('rev-item-name').textContent = name + ' te ha pagado';
  document.getElementById('rev-item-amount').textContent = '+' + amount.toFixed(2) + '€';
  
  const container = document.getElementById('rev-proof-container');
  container.innerHTML = '<div style="padding:20px;color:var(--ink3);">Cargando comprobante...</div>';
  document.getElementById('modal-revisar-pago').classList.add('open');

  if (proofPath) {
    const { data, error } = await supabase.storage.from('expense-proofs').createSignedUrl(proofPath, 3600);
    if (data && data.signedUrl) {
      container.innerHTML = `<img src="${data.signedUrl}" style="width:100%; border-radius:12px; max-height:400px; object-fit:contain; background:#f0f0f0;">`;
    } else {
      container.innerHTML = '<div style="padding:20px;color:var(--red);">Error al cargar comprobante</div>';
    }
  } else {
    container.innerHTML = '<div style="padding:20px;color:var(--ink3);">No se adjuntó comprobante</div>';
  }
}

window.confirmRecepcion = async function confirmRecepcion() {
  if (window.revisarSplitIds.length === 0) return;
  
  const { error } = await supabase
    .from('expense_splits')
    .update({ status: 'paid' })
    .in('id', window.revisarSplitIds);

  if (error) {
    console.error(error);
    showToast('Error al confirmar');
  } else {
    showToast('Recepción confirmada ✓');
    closeModal('modal-revisar-pago');
    if (window.loadExpenses) window.loadExpenses();
  }
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
  
  // Cargar planes reales
  if (window.loadMemberPlans && currentMemberId) {
    loadMemberPlans(currentMemberId);
  }
}

window.loadMemberPlans = async function loadMemberPlans(memberId) {
  const listEl = document.getElementById('mp-plans-list');
  if (!listEl) return;
  
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + memberPlansMonthOffset, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + memberPlansMonthOffset + 1, 0);
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  // PURGA INMEDIATA
  listEl.innerHTML = '<div style="font-size:11px;color:var(--ink3);text-align:center;padding:16px;">Cargando planes...</div>';

  const { data, error } = await supabase
    .from('plan_participants')
    .select('*, plans(*, groups(name))')
    .eq('user_id', memberId);

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<div class="card" style="padding:18px 14px;text-align:center;"><div style="font-size:12px;color:var(--ink3);">No hay planes en este mes.</div></div>`;
    return;
  }

  // Filtrar por fecha en JS para evitar problemas con foreign tables en PostgREST
  const validPlans = data
    .filter(d => d.plans && d.plans.date >= startStr && d.plans.date <= endStr)
    .sort((a,b) => new Date(b.plans.date) - new Date(a.plans.date));
  
  if (validPlans.length === 0) {
    listEl.innerHTML = `<div class="card" style="padding:18px 14px;text-align:center;"><div style="font-size:12px;color:var(--ink3);">No hay planes en este mes.</div></div>`;
    return;
  }

  let html = '';
  validPlans.forEach(row => {
    const p = row.plans;
    const gName = p.groups ? p.groups.name : 'Grupo';
    const d = new Date(p.date + 'T' + (p.time || '00:00:00'));
    const dateStr = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    html += `
      <div class="card" style="padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:var(--r-sm);background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:20px;">📅</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:800;margin-bottom:2px;">${p.title}</div>
          <div style="font-size:11px;color:var(--ink3);">${dateStr} · ${gName}</div>
        </div>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

// ── CARGAR GASTOS DEL PLAN ──
window.loadPlanExpenses = async function loadPlanExpenses(planId) {
  const list = document.getElementById('plan-expenses-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;font-size:12px;color:var(--ink3);padding:14px 0;">Cargando gastos...</div>';
  
  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('*, expense_splits(*)')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false });
    
  if (!error && expenses) {
    if (!state.expenses) state.expenses = [];
    expenses.forEach(ex => {
      const idx = state.expenses.findIndex(x => x.id === ex.id);
      if (idx >= 0) state.expenses[idx] = ex;
      else state.expenses.push(ex);
    });
  }

  if (error || !expenses || expenses.length === 0) {
    list.innerHTML = '<div style="text-align:center;font-size:12px;color:var(--ink3);padding:14px 0;">No hay gastos registrados.</div>';
    return;
  }
  
  let html = '';
  expenses.forEach(e => {
    const creatorName = getProfileName(e.payer_id);
    const amountStr = parseFloat(e.amount).toFixed(2).replace(/\.00$/, '') + '€';
    const participantsCount = e.expense_splits ? e.expense_splits.length : 0;
    const thumbnail = e.proof_url ? `<img src="${e.proof_url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '🍽️';
    
    html += `
      <div class="expense-item" onclick="openExpenseDetail('${e.id}')">
        <div class="exp-left">
          <div class="exp-icon" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;">${thumbnail}</div>
          <div class="exp-info">
            <div class="exp-name">${e.title}</div>
            <div class="exp-sub">Pagado por ${creatorName.split(' ')[0]} · ${participantsCount} participantes</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="exp-amount">${amountStr}</div>
          <div style="margin-top:3px;"><span class="pill pill-green" style="font-size:10px;padding:2px 6px;">Validado</span></div>
        </div>
      </div>
    `;
  });
  list.innerHTML = html;
}

// ── CARGAR TARJETAS DEL PLAN ──


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
    <div style="aspect-ratio:1;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--line);background-image:url('${p.photo_url}');background-size:cover;background-position:center;cursor:pointer;" onclick="openPhotoViewer('${p.photo_url}')"></div>
  `).join('');
}

window.openPhotoViewer = function openPhotoViewer(url) {
  const img = document.getElementById('photo-viewer-img');
  if (img) {
    img.src = url;
    img.style.transform = 'scale(0.95)';
    img.style.opacity = '0';
    setTimeout(() => {
      img.style.transform = 'scale(1)';
      img.style.opacity = '1';
    }, 10);
  }
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-photo-viewer').classList.add('open');
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
window.histExpOffset = 0;
window.histExpNav = function histExpNav(delta) {
  const n = window.histExpOffset + delta;
  if (n > 0) return;
  window.histExpOffset = n;
  const next = document.getElementById('hist-exp-next');
  if (next) next.classList.toggle('disabled', window.histExpOffset >= 0);
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + window.histExpOffset, 1);
  const lbl = document.getElementById('hist-exp-month');
  if (lbl) lbl.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
  
  if (window.renderHistorialExpenses) {
    window.renderHistorialExpenses();
  }
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
window.openSettingSub = async function openSettingSub(kind) {
  let email = 'tu_usuario@correo.com';
  let phone = '+34 600 000 000';
  if (kind === 'cuenta') {
    const { data: userData } = await supabase.auth.getUser();
    if (userData && userData.user && userData.user.email) email = userData.user.email;
    
    if (state.currentUserId) {
      const { data: profile } = await supabase.from('profiles').select('phone').eq('id', state.currentUserId).single();
      if (profile && profile.phone) phone = profile.phone;
      else phone = 'No establecido';
    }
  }
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
          <div class="card-row" style="cursor:pointer;" onclick="setTheme('light')"><div class="card-content"><div class="card-name" style="font-size:13px;">Claro</div><div class="card-sub">Fondo blanco</div></div><span class="pill pill-dark" id="tema-claro-pill">Activo</span></div>
          <div class="card-row" style="cursor:pointer;border-bottom:0;" onclick="setTheme('dark')"><div class="card-content"><div class="card-name" style="font-size:13px;">Oscuro</div><div class="card-sub">Fondo negro</div></div><span class="pill pill-outline" id="tema-oscuro-pill">—</span></div>
        </div>
        <script>
          // update UI on render
          setTimeout(() => {
            const isDark = localStorage.getItem('koves_theme') === 'dark';
            if (isDark) {
              document.getElementById('tema-claro-pill').className = 'pill pill-outline';
              document.getElementById('tema-claro-pill').textContent = '—';
              document.getElementById('tema-oscuro-pill').className = 'pill pill-dark';
              document.getElementById('tema-oscuro-pill').textContent = 'Activo';
            }
          }, 50);
        </script>`,
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
          <div class="card-row" style="cursor:pointer;" onclick="showToast('Correo verificado ✓')"><div class="card-content"><div class="card-name" style="font-size:13px;">Correo</div><div class="card-sub">${email}</div></div><span class="pill pill-green">Verificado</span></div>
          <div class="card-row" style="cursor:pointer;" onclick="showToast('Teléfono verificado ✓')"><div class="card-content"><div class="card-name" style="font-size:13px;">Teléfono</div><div class="card-sub">${phone}</div></div><span class="pill pill-green">Verificado</span></div>
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

window.setTheme = function setTheme(mode) {
  if (mode === 'dark') {
    document.body.classList.add('dark-theme');
    localStorage.setItem('koves_theme', 'dark');
    const pC = document.getElementById('tema-claro-pill');
    const pO = document.getElementById('tema-oscuro-pill');
    if (pC && pO) {
      pC.className = 'pill pill-outline'; pC.textContent = '—';
      pO.className = 'pill pill-dark'; pO.textContent = 'Activo';
    }
  } else {
    document.body.classList.remove('dark-theme');
    localStorage.setItem('koves_theme', 'light');
    const pC = document.getElementById('tema-claro-pill');
    const pO = document.getElementById('tema-oscuro-pill');
    if (pC && pO) {
      pC.className = 'pill pill-dark'; pC.textContent = 'Activo';
      pO.className = 'pill pill-outline'; pO.textContent = '—';
    }
  }
}

// Inicializar tema al arrancar
if (localStorage.getItem('koves_theme') === 'dark') {
  document.body.classList.add('dark-theme');
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
  setTimeout(async () => {
    rouletteSpinning = false;
    document.getElementById('roulette-spin-btn').disabled = false;
    const res = document.getElementById('roulette-result');
    res.textContent = `🎉 ${rouletteOptions[winner]}`;
    
    // Guardar en DB
    if (state.currentGroupId) {
      const payload = {
        group_id: state.currentGroupId,
        title: 'Decisión del grupo',
        winner: rouletteOptions[winner],
        options: rouletteOptions,
        spun_by: state.currentUserId
      };
      
      try {
        const { error } = await supabase.from('roulette_spins').insert([payload]);
        if (error) {
          console.warn('Ruleta: Error al guardar en DB, pero el resultado es válido localmente.', error);
          showToast('Resultado local (Error de conexión)');
        } else {
          if (window.loadRouletteHistory) window.loadRouletteHistory();
        }
      } catch(err) {
        console.error('Network error on roulette:', err);
      }
    }
  }, 4100);
}

window.loadRouletteHistory = async function loadRouletteHistory() {
  if (!state.currentGroupId) return;
  const hist = document.getElementById('roulette-history');
  if (!hist) return;
  
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + rouletteHistOffset, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + rouletteHistOffset + 1, 0);
  end.setHours(23, 59, 59, 999);

  // PURGA INMEDIATA
  hist.innerHTML = '<div style="font-size:11px;color:var(--ink3);text-align:center;padding:16px;">Cargando...</div>';

  const { data, error } = await supabase
    .from('roulette_spins')
    .select('*, profiles(name)')
    .eq('group_id', state.currentGroupId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false });
    
  if (error || !data || data.length === 0) {
    hist.innerHTML = `<div class="expense-item" style="border-bottom:0; justify-content:center;"><span style="font-size:11px;color:var(--ink3);">Sin historial de tiradas.</span></div>`;
    return;
  }
  
  hist.innerHTML = data.map(spin => {
    const d = new Date(spin.created_at);
    const dateStr = d.toLocaleDateString();
    const optsCount = spin.options ? spin.options.length : 0;
    
    // Simulate caching decision for detail page
    const decisionId = spin.id;
    rouletteDecisions[decisionId] = {
      title: spin.title,
      meta: `${dateStr} · ${optsCount} opciones`,
      winner: spin.winner,
      options: spin.options,
      by: spin.profiles ? `Lanzada por ${spin.profiles.name}` : 'Lanzada por un miembro',
    };
    
    return `
      <div class="expense-item" style="cursor:pointer;border-bottom:1px solid var(--line2);" onclick="openRouletteDetail('${decisionId}')">
        <div class="exp-left"><div class="exp-icon">🎲</div><div class="exp-info"><div class="exp-name">${spin.title}</div><div class="exp-sub">${dateStr} · ${optsCount} opciones</div></div></div>
        <span class="pill pill-dark">${spin.winner}</span>
      </div>
    `;
  }).join('');
}


// Navegador de meses del historial de la ruleta
let rouletteHistOffset = 0;
window.rouletteHistNav = function rouletteHistNav(delta) {
  const n = rouletteHistOffset + delta;
  if (n > 0) return;
  rouletteHistOffset = n;
  const next = document.getElementById('roulette-hist-next');
  if (next) next.classList.toggle('disabled', rouletteHistOffset >= 0);
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth() + rouletteHistOffset, 1);
  const lbl = document.getElementById('roulette-hist-month');
  if (lbl) lbl.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
  
  if (window.loadRouletteHistory) loadRouletteHistory();
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
    if (window.loadRouletteHistory) window.loadRouletteHistory();
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
    
    // PURGA INMEDIATA
    state.members = [];
    renderMembersList();

    const { data, error } = await supabase
      .from('group_members')
      .select('*, profiles(id, full_name, username)')
      .eq('group_id', state.currentGroupId);
    
    if (error) {
      console.error('Error fetching members:', error);
      showToast('Error al cargar los miembros', 'error');
      return;
    }
    state.members = data || [];
    
    // Update isAdmin flag
    const myMember = state.members.find(m => m.user_id === state.currentUserId);
    state.isAdmin = myMember ? (myMember.role === 'admin') : false;
    if (window.applyAdminVisibility) window.applyAdminVisibility();
    
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
    
    // PURGA INMEDIATA: Evitar ghosting
    state.plans = [];
    if (window.updatePlanKPIs) window.updatePlanKPIs();
    const actList = document.getElementById('plans-activos-list');
    if (actList) actList.innerHTML = '<div style="font-size:11px;color:var(--ink3);text-align:center;padding:16px;">Cargando planes...</div>';
    
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
    if (window.updatePlanKPIs) window.updatePlanKPIs();
  }

  window.updatePlanKPIs = function updatePlanKPIs() {
    if (!state.plans) return;
    
    // Calcular KPIs reales de MI cuenta
    const now = new Date();
    let pendingCount = 0;
    let activeCount = 0;
    let historicCount = 0;
    let totalFuture = 0;
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
        if (myStatus) {
          activeCount++; // Confirmado (cualquier opción)
        }
        if (!myStatus) {
          pendingCount++; // Pendiente de confirmación
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
    
    if (window.renderPlanLists) window.renderPlanLists();
    
    // Refresh calendar so dots appear correctly after loading plans
    if (window.renderCalendar) window.renderCalendar();
  }

  window.renderPlanLists = function renderPlanLists() {
    const listActivos = document.getElementById('plans-activos-list');
    const listHistorial = document.getElementById('plans-historial-list');
    if (!listActivos && !listHistorial) return;

    const now = new Date();
    const offset = state.calendarMonthOffset || 0;
    const targetDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const targetY = targetDate.getFullYear();
    const targetM = targetDate.getMonth();

    let activosHTML = '';
    let historialHTML = '';
    
    (state.plans || []).forEach(p => {
      const d = new Date(p.event_date);
      // Filter by the selected month
      if (d.getFullYear() !== targetY || d.getMonth() !== targetM) return;

      const isPast = d < now;
      const dateStr = d.toLocaleString('es-ES', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
      
      const att = (p.plan_attendance || []).find(a => a.user_id === state.currentUserId);
      const myStatus = att ? att.status : null;
      let attBadge = `<span class="attendance-tag pendiente">Pendiente</span>`;
      if (myStatus === 'voy') attBadge = `<span class="attendance-tag voy">✓ Voy</span>`;
      else if (myStatus === 'tarde') attBadge = `<span class="attendance-tag voy">⏱️ Llego tarde</span>`;
      else if (myStatus === 'novoy') attBadge = `<span class="attendance-tag novoy">✗ No voy</span>`;
      else if (myStatus === 'quizas') attBadge = `<span class="attendance-tag quizas">? Quizás</span>`;

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

    if (listActivos) {
      listActivos.innerHTML = activosHTML || '<div class="notice" style="margin-bottom:16px;">No hay planes activos en este mes. ¡Crea uno!</div>';
    }
    
    if (listHistorial) {
      listHistorial.innerHTML = historialHTML || '<div style="text-align:center;font-size:12px;color:var(--ink3);margin-top:16px;">No hay historial de planes en este mes.</div>';
    }
  };

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
    
    // START TOUR si no se ha hecho
    setTimeout(() => {
      if (window.TourManager && !localStorage.getItem('koves_tour_done')) {
        TourManager.start();
      }
    }, 1500);
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

  // PURGA INMEDIATA
  list.innerHTML = '<div style="font-size:11px;color:var(--ink3);text-align:center;padding:16px;">Cargando tarjetas...</div>';

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
    .select('*, group_cards(*), profiles!assigned_cards_target_user_id_fkey(full_name, username), proposer:profiles!assigned_cards_proposed_by_fkey(full_name, username)')
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
    if (ac.status === 'pending') {
       if (hasVoted) {
         voteUI = `<div style="font-size:11px;font-weight:700;color:var(--ink3);text-align:center;margin-top:8px;padding:8px 0;">Ya has votado. A favor: ${favor} | En contra: ${contra}</div>`;
       } else {
         voteUI = `
           <div style="display:flex;gap:6px;" id="plan-card-vote-btns">
             <button class="btn btn-primary" style="flex:1;font-size:11px;padding:8px;" onclick="votePlanCard('${ac.id}','favor')">A favor (${favor})</button>
             <button class="btn btn-secondary" style="flex:1;font-size:11px;padding:8px;" onclick="votePlanCard('${ac.id}','contra')">En contra (${contra})</button>
           </div>
           <div style="font-size:10px;color:var(--ink3);margin-top:8px;text-align:center;">Votación anónima. Cierra a las 24h.</div>
         `;
       }
    } else {
       const statusText = {
         'active': 'Aprobada y Activa',
         'history': 'Historial (Pagada)',
         'rejected': 'Rechazada'
       };
       voteUI = `<div style="font-size:11px;font-weight:700;color:var(--ink2);text-align:center;margin-top:8px;display:flex;flex-direction:column;align-items:center;gap:6px;">
         <div>${statusText[ac.status]}</div>
         ${ac.status === 'active' ? `<button class="btn btn-secondary" style="font-size:10px;padding:4px 8px;" onclick="reclamarTarjeta('${ac.id}')">Reclamar Tarjeta</button>` : ''}
       </div>`;
    }

    const targetName = ac.profiles?.full_name || ac.profiles?.username || 'Usuario';
    const proposerName = ac.proposer?.full_name || ac.proposer?.username || 'Usuario';
    const cardColor = ac.group_cards?.color || '#ccc';
    const cardName = ac.group_cards?.name || 'Tarjeta eliminada';

    html += `
      <div class="card" style="padding:14px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:24px;height:34px;border-radius:4px;background:${cardColor};"></div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;">${targetName} · ${cardName}</div>
            <div style="font-size:11px;color:var(--ink3);">Propuesto por ${proposerName}</div>
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
  const selectCard = document.getElementById('propose-type-input');
  
  // Llenar asistentes reales (voy, tarde)
  const p = state.plans.find(x => x.id === state.currentPlanId);
  let attendees = [];
  if (p && p.plan_attendance) {
    const attendeesVotes = p.plan_attendance.filter(a => a.status === 'voy' || a.status === 'tarde');
    attendees = attendeesVotes.map(a => {
      const m = state.members.find(mem => mem.user_id === a.user_id);
      return { user_id: a.user_id, profiles: m ? m.profiles : { full_name: 'Usuario', username: '' } };
    });
  } else if (state.members) {
    attendees = state.members.map(m => ({ user_id: m.profiles.id, profiles: m.profiles }));
  }

  let tHtml = '<option value="">Selecciona un asistente</option>';
  attendees.forEach(a => {
    const un = a.profiles.username ? `@${a.profiles.username}` : (a.profiles.full_name || 'Asistente');
    tHtml += `<option value="${a.user_id}">${un}</option>`;
  });
  selectTarget.innerHTML = tHtml;

  // Llenar tarjetas del grupo en el custom select
  const optionsContainer = document.getElementById('custom-card-options');
  const selectedContainer = document.getElementById('custom-card-selected');
  const hiddenInput = document.getElementById('propose-type-input');
  
  hiddenInput.value = '';
  selectedContainer.innerHTML = '<span style="color:var(--ink3);">Selecciona una tarjeta</span>';
  
  if (state.groupCards && state.groupCards.length > 0) {
    let cHtml = '';
    state.groupCards.forEach(c => {
      cHtml += `
        <div style="padding:8px;display:flex;align-items:center;gap:8px;border-radius:var(--r-sm);" onclick="selectCustomCard('${c.id}', '${c.name}', '${c.color}')">
          <div style="width:16px;height:24px;border-radius:3px;background:${c.color};"></div>
          <div style="font-size:14px;color:var(--ink);">${c.name}</div>
        </div>
      `;
    });
    optionsContainer.innerHTML = cHtml;
  } else {
    optionsContainer.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--ink3);">No hay tarjetas configuradas</div>';
  }

  document.getElementById('propose-reason-input').value = '';

  document.getElementById('modal-propose-card').classList.add('open');
};

window.toggleCustomCardSelect = function() {
  const opts = document.getElementById('custom-card-options');
  opts.style.display = opts.style.display === 'none' ? 'flex' : 'none';
};

window.selectCustomCard = function(id, name, color) {
  document.getElementById('propose-type-input').value = id;
  document.getElementById('custom-card-selected').innerHTML = `
    <div style="width:16px;height:24px;border-radius:3px;background:${color};"></div>
    <div style="font-size:14px;color:var(--ink);">${name}</div>
  `;
  document.getElementById('custom-card-options').style.display = 'none';
  if (window.event) window.event.stopPropagation();
};

window.submitProposeCard = async function submitProposeCard() {
  const targetId = document.getElementById('propose-target-input').value;
  const reason = document.getElementById('propose-reason-input').value.trim();
  const cardId = document.getElementById('propose-type-input').value;

  if (!targetId || !reason || !cardId) {
    showToast('Selecciona a quién, qué tarjeta y escribe un motivo');
    return;
  }
  
  const btn = document.querySelector('#modal-propose-card .btn-primary');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Proponiendo...';
  }

  const payload = {
    plan_id: state.currentPlanId,
    target_user_id: targetId,
    proposed_by: state.currentUserId,
    group_card_id: cardId,
    reason: reason,
    status: 'pending'
  };

  try {
    const { error } = await supabase.from('assigned_cards').insert([payload]);

    if (error) {
      console.error('Error proposing card:', error);
      showToast('Error al proponer la tarjeta');
      return;
    }

    closeModal('modal-propose-card');
    showToast('Tarjeta propuesta ✓');
    if (window.loadPlanCards) loadPlanCards();
  } catch (err) {
    console.error('Submit card crash:', err);
    showToast('Error interno al proponer');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Proponer tarjeta';
    }
  }
};

window.reclamarTarjeta = async function reclamarTarjeta(assignedCardId) {
  showToast('Reclamación enviada al grupo. Queda en revisión.');
  // Aquí se podría cambiar el status a 'reclaimed' o generar una notificación
};

window.votePlanCard = async function votePlanCard(cardId, voteType) {
  if (!state.currentUserId) return;

  const { error } = await supabase.from('assigned_card_votes').insert({
    assigned_card_id: cardId,
    user_id: state.currentUserId,
    vote: voteType
  });

  if (error) {
    if (error.code === '23505') {
      showToast('Ya has votado esta tarjeta');
    } else {
      console.error('Error al votar:', error);
      showToast('Error al votar');
    }
    return;
  }

  showToast('Voto anónimo registrado ✓');
  if (window.loadPlanCards) loadPlanCards();
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

  // PURGA INMEDIATA
  list.innerHTML = '<div style="font-size:11px;color:var(--ink3);text-align:center;padding:16px;">Cargando...</div>';

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

  showGlobalLoading('Guardando etiqueta...');

  try {
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
  } finally {
    hideGlobalLoading();
  }
};

window.loadWeeklyVotingStatus = async function loadWeeklyVotingStatus() {
  if (!state.currentGroupId) return;
  const statusText = document.getElementById('voting-status-text');
  const actionBtn = document.getElementById('voting-action-btn');
  if (!statusText || !actionBtn) return;

  const now = new Date();
  const isSunday = now.getDay() === 0;
  const hours = now.getHours();
  const isVotingWindow = isSunday && hours >= 12 && hours < 18;

  if (isVotingWindow) {
    statusText.textContent = 'La votación semanal está abierta. ¡Vota ahora!';
    statusText.style.color = 'var(--green)';
    statusText.style.opacity = '1';
    actionBtn.textContent = 'Ir a Votar';
    actionBtn.onclick = openWeeklyVoting;
    actionBtn.classList.remove('disabled');
    actionBtn.disabled = false;
  } else {
    statusText.textContent = 'La votación está cerrada. Abre el domingo de 12:00 a 18:00.';
    statusText.style.color = 'var(--ink3)';
    statusText.style.opacity = '.7';
    actionBtn.textContent = 'Votación cerrada';
    actionBtn.onclick = null;
    actionBtn.classList.add('disabled');
    actionBtn.disabled = true;
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
  const now = new Date();
  const isSunday = now.getDay() === 0;
  const isVotingTime = isSunday && now.getHours() >= 12 && now.getHours() < 18;

  if (!isVotingTime && localStorage.getItem('force_voting_open') !== 'true') {
    showToast('La votación solo abre los domingos de 12:00 a 18:00');
    return;
  }

  const { data: labels } = await supabase.from('group_labels').select('*').eq('group_id', state.currentGroupId);
  const members = state.members || [];

  const container = document.getElementById('voting-labels-container');
  
  if (!labels || labels.length === 0) {
    container.innerHTML = '<div style="font-size:13px;color:var(--ink3);text-align:center;padding:20px;">El grupo no tiene etiquetas creadas.</div>';
    document.getElementById('voting-submit-container').style.display = 'none';
    showScreen('voting');
    return;
  }

  // Calcular el lunes de esta semana para usarlo como week_start_date
  const d = new Date();
  const day = d.getDay() || 7; // 1-7
  d.setDate(d.getDate() - day + 1);
  const weekStartStr = d.toISOString().split('T')[0];
  state.currentVotingWeek = weekStartStr;

  // Cargar mis votos anteriores
  const { data: myVotes } = await supabase
    .from('weekly_votes')
    .select('*')
    .eq('group_id', state.currentGroupId)
    .eq('week_start_date', weekStartStr)
    .eq('voter_id', state.currentUserId);

  let html = '';
  labels.forEach(label => {
    const existingVote = (myVotes || []).find(v => v.label_id === label.id);
    let optionsHtml = '<option value="">Ninguno</option>';
    members.forEach(m => {
      const selected = (existingVote && existingVote.voted_user_id === m.id) ? 'selected' : '';
      optionsHtml += `<option value="${m.id}" ${selected}>${m.name}</option>`;
    });

    html += `
      <div class="card" style="padding:14px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="font-size:28px;">${label.emoji || '🏆'}</div>
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

  container.innerHTML = html;
  document.getElementById('voting-submit-container').style.display = 'block';
  showScreen('voting');
};

window.submitWeeklyVotes = async function submitWeeklyVotes() {
  if (!state.currentVotingWeek || !state.currentGroupId) return;

  const selects = document.querySelectorAll('.voting-select');
  const votesToInsert = [];

  selects.forEach(select => {
    const targetUserId = select.value;
    const labelId = select.getAttribute('data-label-id');
    if (targetUserId) {
      votesToInsert.push({
        group_id: state.currentGroupId,
        week_start_date: state.currentVotingWeek,
        label_id: labelId,
        voter_id: state.currentUserId,
        voted_user_id: targetUserId
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
    .eq('group_id', state.currentGroupId)
    .eq('week_start_date', state.currentVotingWeek)
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

// ── ONBOARDING & TOUR MANAGER ──
window.TourManager = {
  steps: [
    {
      targetId: 'nav-group',
      text: '¡Bienvenido a KOves! El primer paso es crear un Grupo para ti y tus amigos, o unirte a uno con tu código de invitación.'
    },
    {
      targetId: 'nav-plans',
      text: 'Aquí propondrás las fiestas, votarás fechas y verás quién asiste al próximo evento.'
    },
    {
      targetId: 'nav-expenses',
      text: 'Sube tus tickets de compra aquí. Nosotros calculamos automáticamente quién debe dinero a quién.'
    }
  ],
  currentStep: 0,
  
  start: function() {
    if (localStorage.getItem('koves_tour_done')) return;
    this.currentStep = 0;
    document.getElementById('spotlight-overlay').style.display = 'block';
    document.getElementById('spotlight-tooltip').style.display = 'block';
    this.showStep();
  },

  showStep: function() {
    if (this.currentStep >= this.steps.length) {
      this.finish();
      return;
    }
    
    const step = this.steps[this.currentStep];
    const target = document.getElementById(step.targetId);
    
    if (!target) {
      this.currentStep++;
      this.showStep();
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const hole = document.getElementById('spotlight-hole');
      const tooltip = document.getElementById('spotlight-tooltip');
      const textEl = document.getElementById('spotlight-text');
      
      hole.style.top = (rect.top - 10) + 'px';
      hole.style.left = (rect.left - 10) + 'px';
      hole.style.width = (rect.width + 20) + 'px';
      hole.style.height = (rect.height + 20) + 'px';
      
      textEl.textContent = step.text;
      
      let tooltipTop = rect.bottom + 20;
      if (tooltipTop + 150 > window.innerHeight) {
        tooltipTop = Math.max(20, rect.top - 150);
      }
      
      tooltip.style.top = tooltipTop + 'px';
      tooltip.style.left = Math.max(20, Math.min(window.innerWidth - 300, rect.left + (rect.width/2) - 140)) + 'px';
    }, 300);
  },
  
  next: function() {
    this.currentStep++;
    this.showStep();
  },
  
  finish: function() {
    document.getElementById('spotlight-overlay').style.display = 'none';
    document.getElementById('spotlight-tooltip').style.display = 'none';
    localStorage.setItem('koves_tour_done', 'true');
    showToast('¡Tour completado! Eres libre de usar KOves.');
  }
};

document.getElementById('spotlight-next-btn')?.addEventListener('click', () => TourManager.next());
