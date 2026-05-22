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
  // Cuentas guardadas (como Instagram: varias cuentas en el mismo dispositivo)
  accounts: [
    { id: 'tu', name: 'Tu cuenta', handle: '@tu_usuario', initials: 'TU', avatarColor: '#0A0A0A' },
    { id: 'carlos', name: 'Carlos Sánchez', handle: '@carlossanz', initials: 'CS', avatarColor: '#1A6B3A' },
  ],
  // Grupos del usuario actual
  myGroups: [],
  // V5: Votación de ranking del plan actual
  ranking: { mvp: [null, null, null], tardon: [] },
  // V5: Cuál es el miembro actualmente en perfil (para chat)
  currentMemberId: 'carlos',
  // V5: Chat actual abierto
  currentChat: null,
  // V5: Selector de mes en standings (0 = actual, -1 = mes anterior, etc)
  standingsMonthOffset: 0,
  // V5: Mensajes simulados por chat
  chatMessages: {
    'group': [
      { from: 'ana', text: '¿Alguien trae las cervezas para esta noche?', time: '21:30' },
      { from: 'mario', text: 'Yo llevo el vino tinto', time: '21:31' },
      { from: 'me', text: 'Yo traigo el postre', time: '21:32' },
      { from: 'carlos', text: 'Sois grandes 🙌', time: '21:33' },
    ],
    'carlos': [
      { from: 'carlos', text: 'Oye, ¿a qué hora venís hoy?', time: '20:42' },
      { from: 'me', text: 'Sobre las 22:00 más o menos', time: '20:43' },
      { from: 'carlos', text: 'Perfecto', time: '20:44' },
      { from: 'me', text: 'Vale, te esperamos para el arroz', time: '20:45' },
    ],
    'mario': [
      { from: 'mario', text: 'Llego a las 22:45, tengo lío en el curro', time: '19:11' },
      { from: 'me', text: 'Tranquilo, te guardamos sitio', time: '19:12' },
      { from: 'mario', text: 'gracias crack', time: '19:12' },
    ],
    'pablo': [
      { from: 'pablo', text: 'Te paso los detalles del hotel de Porto', time: 'Ayer 18:00' },
      { from: 'pablo', text: '180€ por noche, desayuno incluido', time: 'Ayer 18:01' },
      { from: 'me', text: 'Buena pinta, lo veo bien', time: 'Ayer 18:30' },
    ],
    'ana': [
      { from: 'ana', text: 'Gracias por la tarta del cumple 🎂', time: 'Ayer 12:00' },
      { from: 'me', text: 'De nada, me alegro de que gustara', time: 'Ayer 12:05' },
    ],
    'lucas': [
      { from: 'lucas', text: 'Te debo 6€, te lo paso esta noche por Bizum', time: 'Lun 22:00' },
      { from: 'me', text: 'Sin prisa', time: 'Lun 22:01' },
    ],
    'javi': [
      { from: 'javi', text: 'Estoy castigado 4 días más, ya os contaré', time: '15 May 23:00' },
    ],
  },
  // V5: Members para podium picker (asistentes al plan actual)
  planAttendees: ['Carlos', 'Mario', 'Pablo', 'Lucas', 'Ana', 'Sergio'],
  // V6: Historial de standings por mes (offset → array de jugadores)
  // pts = pj + mvp + trd - 2*am - 5*rj
  standingsHistory: {
    0: [ // Mayo 2026 (actual) — prevPos = posición antes del último plan
      { id: 'pablo',  name: 'Pablo',  initials: 'PB', color: 'var(--ink)',    pj: 4, mvp: 8, trd: 0,  am: 0, rj: 0, prevPos: 2 },
      { id: 'carlos', name: 'Carlos', initials: 'CS', color: 'var(--green)',  pj: 5, mvp: 5, trd: 0,  am: 0, rj: 0, prevPos: 1 },
      { id: 'ana',    name: 'Ana',    initials: 'AN', color: 'var(--ink)',    pj: 4, mvp: 5, trd: -1, am: 0, rj: 0, prevPos: 3 },
      { id: 'sergio', name: 'Sergio', initials: 'SR', color: 'var(--ink)',    pj: 4, mvp: 2, trd: 0,  am: 0, rj: 0, prevPos: 6 },
      { id: 'tu',     name: 'Tú',     initials: 'TU', color: 'var(--blue)',   pj: 3, mvp: 2, trd: 0,  am: 0, rj: 0, prevPos: 4 },
      { id: 'marta',  name: 'Marta',  initials: 'MT', color: 'var(--ink)',    pj: 3, mvp: 1, trd: 0,  am: 0, rj: 0, prevPos: 5 },
      { id: 'lucas',  name: 'Lucas',  initials: 'LC', color: 'var(--line2)',  pj: 3, mvp: 0, trd: -1, am: 1, rj: 0, prevPos: 7 },
      { id: 'mario',  name: 'Mario',  initials: 'MR', color: '#C07000',       pj: 3, mvp: 0, trd: -5, am: 1, rj: 0, prevPos: 8 },
      { id: 'javi',   name: 'Javi',   initials: 'JV', color: 'var(--line2)',  pj: 1, mvp: 0, trd: -3, am: 0, rj: 1, prevPos: 9 },
    ],
    [-1]: [ // Abril 2026
      { id: 'carlos', name: 'Carlos', initials: 'CS', color: 'var(--green)',  pj: 6, mvp: 9, trd: 0,  am: 0, rj: 0 },
      { id: 'ana',    name: 'Ana',    initials: 'AN', color: 'var(--ink)',    pj: 6, mvp: 6, trd: 0,  am: 0, rj: 0 },
      { id: 'pablo',  name: 'Pablo',  initials: 'PB', color: 'var(--ink)',    pj: 5, mvp: 4, trd: -1, am: 0, rj: 0 },
      { id: 'lucas',  name: 'Lucas',  initials: 'LC', color: 'var(--line2)',  pj: 5, mvp: 3, trd: 0,  am: 0, rj: 0 },
      { id: 'tu',     name: 'Tú',     initials: 'TU', color: 'var(--blue)',   pj: 5, mvp: 1, trd: 0,  am: 0, rj: 0 },
      { id: 'sergio', name: 'Sergio', initials: 'SR', color: 'var(--ink)',    pj: 5, mvp: 1, trd: 0,  am: 0, rj: 0 },
      { id: 'marta',  name: 'Marta',  initials: 'MT', color: 'var(--ink)',    pj: 4, mvp: 1, trd: 0,  am: 0, rj: 0 },
      { id: 'mario',  name: 'Mario',  initials: 'MR', color: '#C07000',       pj: 4, mvp: 0, trd: -3, am: 1, rj: 0 },
      { id: 'javi',   name: 'Javi',   initials: 'JV', color: 'var(--line2)',  pj: 3, mvp: 0, trd: -4, am: 0, rj: 1 },
    ],
    [-2]: [ // Marzo 2026
      { id: 'ana',    name: 'Ana',    initials: 'AN', color: 'var(--ink)',    pj: 5, mvp: 7, trd: 0,  am: 0, rj: 0 },
      { id: 'carlos', name: 'Carlos', initials: 'CS', color: 'var(--green)',  pj: 5, mvp: 5, trd: 0,  am: 0, rj: 0 },
      { id: 'pablo',  name: 'Pablo',  initials: 'PB', color: 'var(--ink)',    pj: 4, mvp: 4, trd: 0,  am: 0, rj: 0 },
      { id: 'tu',     name: 'Tú',     initials: 'TU', color: 'var(--blue)',   pj: 4, mvp: 3, trd: 0,  am: 0, rj: 0 },
      { id: 'sergio', name: 'Sergio', initials: 'SR', color: 'var(--ink)',    pj: 4, mvp: 2, trd: 0,  am: 0, rj: 0 },
      { id: 'marta',  name: 'Marta',  initials: 'MT', color: 'var(--ink)',    pj: 3, mvp: 1, trd: 0,  am: 0, rj: 0 },
      { id: 'mario',  name: 'Mario',  initials: 'MR', color: '#C07000',       pj: 4, mvp: 1, trd: -2, am: 1, rj: 0 },
      { id: 'lucas',  name: 'Lucas',  initials: 'LC', color: 'var(--line2)',  pj: 3, mvp: 0, trd: -1, am: 0, rj: 0 },
      { id: 'javi',   name: 'Javi',   initials: 'JV', color: 'var(--line2)',  pj: 2, mvp: 0, trd: -2, am: 0, rj: 1 },
    ],
    [-3]: [ // Febrero 2026
      { id: 'pablo',  name: 'Pablo',  initials: 'PB', color: 'var(--ink)',    pj: 5, mvp: 8, trd: 0,  am: 0, rj: 0 },
      { id: 'carlos', name: 'Carlos', initials: 'CS', color: 'var(--green)',  pj: 5, mvp: 4, trd: 0,  am: 0, rj: 0 },
      { id: 'tu',     name: 'Tú',     initials: 'TU', color: 'var(--blue)',   pj: 5, mvp: 3, trd: 0,  am: 0, rj: 0 },
      { id: 'ana',    name: 'Ana',    initials: 'AN', color: 'var(--ink)',    pj: 4, mvp: 3, trd: 0,  am: 0, rj: 0 },
      { id: 'sergio', name: 'Sergio', initials: 'SR', color: 'var(--ink)',    pj: 4, mvp: 2, trd: 0,  am: 0, rj: 0 },
      { id: 'lucas',  name: 'Lucas',  initials: 'LC', color: 'var(--line2)',  pj: 4, mvp: 1, trd: 0,  am: 0, rj: 0 },
      { id: 'marta',  name: 'Marta',  initials: 'MT', color: 'var(--ink)',    pj: 3, mvp: 0, trd: 0,  am: 0, rj: 0 },
      { id: 'mario',  name: 'Mario',  initials: 'MR', color: '#C07000',       pj: 3, mvp: 0, trd: -2, am: 1, rj: 0 },
      { id: 'javi',   name: 'Javi',   initials: 'JV', color: 'var(--line2)',  pj: 2, mvp: 0, trd: -1, am: 0, rj: 0 },
    ],
  },
  // V6: Bote de sanciones por mes
  boteHistory: {
    0: {
      label: 'Mayo 2026 · Mes actual',
      status: 'En curso',
      total: 14,
      closed: false,
      deudores: [
        { id: 'mario', name: 'Mario', initials: 'MR', color: '#C07000', amount: 2, reason: '1 amarilla' },
        { id: 'lucas', name: 'Lucas', initials: 'LC', color: 'var(--line2)', amount: 2, reason: '1 amarilla' },
        { id: 'javi',  name: 'Javi',  initials: 'JV', color: 'var(--line2)', amount: 10, reason: '1 roja' },
      ],
      reparto: [
        { id: 'pablo',  name: 'Pablo',  initials: 'PB', color: 'var(--ink)',   amount: 7, pct: '50%' },
        { id: 'carlos', name: 'Carlos', initials: 'CS', color: 'var(--green)', amount: 4.2, pct: '30%' },
        { id: 'ana',    name: 'Ana',    initials: 'AN', color: 'var(--ink)',   amount: 2.8, pct: '20%' },
      ],
    },
    [-1]: {
      label: 'Abril 2026',
      status: 'Repartido',
      total: 18,
      closed: true,
      deudores: [
        { id: 'mario', name: 'Mario', initials: 'MR', color: '#C07000', amount: 2, reason: '1 amarilla' },
        { id: 'javi',  name: 'Javi',  initials: 'JV', color: 'var(--line2)', amount: 10, reason: '1 roja' },
        { id: 'sergio', name: 'Sergio', initials: 'SR', color: 'var(--ink)', amount: 6, reason: '3 amarillas' },
      ],
      reparto: [
        { id: 'carlos', name: 'Carlos', initials: 'CS', color: 'var(--green)', amount: 9, pct: '50%' },
        { id: 'ana',    name: 'Ana',    initials: 'AN', color: 'var(--ink)',   amount: 5.4, pct: '30%' },
        { id: 'pablo',  name: 'Pablo',  initials: 'PB', color: 'var(--ink)',   amount: 3.6, pct: '20%' },
      ],
    },
    [-2]: {
      label: 'Marzo 2026',
      status: 'Repartido',
      total: 12,
      closed: true,
      deudores: [
        { id: 'mario', name: 'Mario', initials: 'MR', color: '#C07000', amount: 2, reason: '1 amarilla' },
        { id: 'javi',  name: 'Javi',  initials: 'JV', color: 'var(--line2)', amount: 10, reason: '1 roja' },
      ],
      reparto: [
        { id: 'ana',    name: 'Ana',    initials: 'AN', color: 'var(--ink)',   amount: 6, pct: '50%' },
        { id: 'carlos', name: 'Carlos', initials: 'CS', color: 'var(--green)', amount: 3.6, pct: '30%' },
        { id: 'pablo',  name: 'Pablo',  initials: 'PB', color: 'var(--ink)',   amount: 2.4, pct: '20%' },
      ],
    },
    [-3]: {
      label: 'Febrero 2026',
      status: 'Repartido',
      total: 4,
      closed: true,
      deudores: [
        { id: 'mario', name: 'Mario', initials: 'MR', color: '#C07000', amount: 4, reason: '2 amarillas' },
      ],
      reparto: [
        { id: 'pablo',  name: 'Pablo',  initials: 'PB', color: 'var(--ink)',   amount: 2, pct: '50%' },
        { id: 'carlos', name: 'Carlos', initials: 'CS', color: 'var(--green)', amount: 1.2, pct: '30%' },
        { id: 'tu',     name: 'Tú',     initials: 'TU', color: 'var(--blue)',  amount: 0.8, pct: '20%' },
      ],
    },
  },
  // V6: Offset del mes mostrado en el bote
  boteMonthOffset: 0,
  // V6: ¿Eres admin del grupo actual? (controla la edición de reglas)
  isAdmin: true,
  // V6: Offset del mes mostrado en el calendario de planes
  calendarMonthOffset: 0,
};

let currentMemberId = 'carlos'; // accesible globalmente para chat desde perfil

// Datos de planes para abrir detalle (mock)
const planData = {
  'quedada': { status: 'Plan confirmado · Hoy 22:30', title: 'Quedada<br>en el piso', desc: 'Cena, música y después se decide si salir.', creator: 'Creado por Carlos', pending: true },
  'fiesta-ana': { status: 'Plan confirmado · Sáb 14 Jun', title: 'Fiesta<br>en casa de Ana', desc: 'Fiesta temática. Llevar bebida.', creator: 'Creado por Ana · hace 3 días', pending: false },
  'cena-miercoles': { status: 'Plan propuesto · Mié 27 May 20:00', title: 'Cena de<br>mitad de semana', desc: 'Cena tranquila para descansar antes del fin de semana.', creator: 'Creado por Ana', pending: false },
  'porto': { status: 'Plan propuesto · 29–31 Mayo', title: 'Escapada<br>a Porto', desc: 'Tres días en Porto. Pendiente confirmar alojamiento.', creator: 'Creado por Pablo', pending: true },
};

// Datos de miembros para ficha
const memberData = {
  'carlos': { name: 'Carlos', handle: '@carlossanz · Admin de EL CLUB', initials: 'CS', avatarBg: 'var(--green)', bio: 'Siempre el primero en organizar, el último en irse 🎉', phone: '+34 612 345 678', pills: [{cls:'pill-dark',txt:'MVP global'},{cls:'pill-green',txt:'Admin'}], stats: {attended:'21/23', mvps:5, trds:1, yellows:2, reds:0}, discipline:{ icon:'★', bg:'var(--ink3)', name:'Sin sanciones', reason:'Historial limpio en EL CLUB', pill:{cls:'pill-green',txt:'Limpio'} } },
  'mario': { name: 'Mario', handle: '@mariorz · Miembro de EL CLUB', initials: 'MR', avatarBg: '#C07000', bio: 'El que siempre llega tarde pero con buena excusa 😅', phone: '+34 622 111 222', pills: [{cls:'pill-amber',txt:'1 amarilla'},{cls:'pill-outline',txt:'Más tardón'}], stats: {attended:'18/23', mvps:1, trds:4, yellows:3, reds:0}, discipline:{ icon:'MR', bg:'#C07000', name:'Amarilla activa', reason:'Llegó 2h tarde a la quedada del piso', pill:{cls:'pill-amber',txt:'Amarilla'} } },
  'pablo': { name: 'Pablo', handle: '@pablobc · Miembro de EL CLUB', initials: 'PB', avatarBg: 'var(--ink)', bio: 'Logística y viajes. Si hay escapada, la monto yo ✈️', phone: '+34 633 444 555', pills: [{cls:'pill-green',txt:'Mejor organizador'},{cls:'pill-outline',txt:'Top ranking'}], stats: {attended:'20/23', mvps:3, trds:0, yellows:0, reds:0}, discipline:{ icon:'★', bg:'var(--ink3)', name:'Sin sanciones', reason:'Historial limpio', pill:{cls:'pill-green',txt:'Limpio'} } },
  'lucas': { name: 'Lucas', handle: '@lucascv · Miembro de EL CLUB', initials: 'LC', avatarBg: 'var(--line2)', bio: 'Aquí para pasarlo bien 🍻', phone: '+34 644 777 888', pills: [{cls:'pill-red',txt:'Debe 6€'}], stats: {attended:'14/23', mvps:0, trds:1, yellows:1, reds:0}, discipline:{ icon:'LC', bg:'#C07000', name:'Amarilla activa', reason:'Cena italiana · No pagó su parte', pill:{cls:'pill-amber',txt:'Amarilla'} } },
  'ana': { name: 'Ana', handle: '@anam · Admin de EL CLUB', initials: 'AN', avatarBg: 'var(--ink)', bio: 'Organizadora oficial de cumpleaños del grupo 🎂', phone: '+34 655 999 000', pills: [{cls:'pill-green',txt:'Mejor organizadora'},{cls:'pill-dark',txt:'Admin'}], stats: {attended:'19/23', mvps:4, trds:1, yellows:0, reds:0}, discipline:{ icon:'★', bg:'var(--ink3)', name:'Sin sanciones', reason:'Historial limpio', pill:{cls:'pill-green',txt:'Limpio'} } },
  'javi': { name: 'Javi', handle: '@javiv · Miembro de EL CLUB', initials: 'JV', avatarBg: 'var(--line2)', bio: 'De vuelta tras el parón 😎', phone: '+34 666 222 333', pills: [{cls:'pill-red',txt:'Expulsado 4 días'}], stats: {attended:'11/23', mvps:0, trds:3, yellows:0, reds:1}, discipline:{ icon:'JV', bg:'var(--red)', name:'Roja activa', reason:'Fiesta del sábado · Expulsión 7 días', pill:{cls:'pill-red',txt:'Roja'} } },
  'sergio': { name: 'Sergio', handle: '@sergiog · Miembro de EL CLUB', initials: 'SR', avatarBg: 'var(--ink)', bio: 'El fotógrafo del grupo 📸', phone: '+34 677 888 999', pills: [{cls:'pill-green',txt:'Sin sanciones'}], stats: {attended:'16/23', mvps:2, trds:0, yellows:0, reds:0}, discipline:{ icon:'★', bg:'var(--ink3)', name:'Sin sanciones', reason:'Historial limpio', pill:{cls:'pill-green',txt:'Limpio'} } },
  'marta': { name: 'Marta', handle: '@martal · Miembro de EL CLUB', initials: 'MT', avatarBg: 'var(--ink)', bio: 'Nueva en el grupo, encantada de conoceros 👋', phone: '+34 688 333 444', pills: [{cls:'pill-outline',txt:'Reciente'}], stats: {attended:'9/23', mvps:0, trds:0, yellows:0, reds:0}, discipline:{ icon:'★', bg:'var(--ink3)', name:'Sin sanciones', reason:'Historial limpio', pill:{cls:'pill-green',txt:'Limpio'} } },
  'tu': { name: 'Tú', handle: '@tu_usuario · Miembro de EL CLUB', initials: 'TU', avatarBg: 'var(--blue)', bio: 'Tu perfil en el grupo', phone: '+34 600 000 000', pills: [{cls:'pill-dark',txt:'Tu perfil'}], stats: {attended:'18/23', mvps:2, trds:0, yellows:0, reds:0}, discipline:{ icon:'★', bg:'var(--ink3)', name:'Sin sanciones', reason:'Historial limpio', pill:{cls:'pill-green',txt:'Limpio'} } },
};

// Datos de gastos para detalle
const expenseData = {
  'lucas-carlos': { title:'Lucas debe a Carlos', icon:'🍽️', amount:'6€', plan:'Quedada en el piso', date:'Hoy', payer:'Carlos', who:'Lucas', validated:true, parts:5 },
  'mario-carlos': { title:'Mario debe a Carlos', icon:'🍽️', amount:'4€', plan:'Quedada en el piso', date:'Hoy', payer:'Carlos', who:'Mario', validated:true, parts:5 },
  'javi-tu': { title:'Javi te debe a ti', icon:'🎂', amount:'14€', plan:'Cumpleaños de Carlos', date:'10 May', payer:'Tú', who:'Javi', validated:true, parts:9 },
  'cena-conjunta': { title:'Cena conjunta', icon:'🍽️', amount:'27€', plan:'Quedada en el piso', date:'Hoy', payer:'Carlos', who:'5 personas', validated:true, parts:5 },
  'tarta': { title:'Tarta cumpleaños', icon:'🎂', amount:'42€', plan:'Cumpleaños de Carlos', date:'10 May', payer:'Tú', who:'9 personas', validated:true, parts:9 },
  'pizzas': { title:'Pizzas cena italiana', icon:'🍕', amount:'67€', plan:'Cena italiana', date:'2 May', payer:'Ana', who:'6 personas', validated:false, parts:6 },
};

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
  const p = planData[id] || planData['quedada'];
  document.getElementById('pd-status').textContent = p.status;
  document.getElementById('pd-title').innerHTML = p.title;
  document.getElementById('pd-desc').textContent = p.desc;
  const cr = document.getElementById('pd-creator');
  if (cr) cr.textContent = p.creator || '';
  showScreen('plan-detail');
  // Si el plan está pendiente de tu asistencia, parpadea el título y ningún botón seleccionado
  document.querySelectorAll('#attendance-grid .action-btn').forEach(b => b.classList.remove('selected'));
  updateAttendanceBlink(!!p.pending);
  renderTardonList();
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
window.showDisciplineModal = function showDisciplineModal(type) {
  const titles = { amarilla: '🟡 Sacar amarilla', roja: '🔴 Sacar tarjeta roja', motivo: '📝 Añadir motivo', votar: '🗳️ Votar sanción' };
  document.getElementById('disc-modal-title').firstChild.textContent = titles[type] || 'Sanción';
  document.getElementById('modal-discipline').classList.add('open');
}

window.selectDiscMember = function selectDiscMember(row, name) {
  document.querySelectorAll('#disc-member-list .card-row').forEach(r => {
    r.style.borderColor = 'var(--line)';
    r.style.background = '';
  });
  row.style.borderColor = 'var(--ink)';
  row.style.background = 'var(--surface2)';
}

window.submitSanction = function submitSanction() {
  closeModal('modal-discipline');
  showToast('Sanción enviada a votación grupal ✓');
}

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

window.submitExpense = function submitExpense() {
  closeModal('modal-expense');
  showToast('Gasto guardado. Pendiente de validación ✓');
}

window.openExpenseDetail = function openExpenseDetail(id) {
  const d = expenseData[id];
  if (!d) return;
  const body = document.getElementById('exd-body');
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:14px;">
      <div style="font-size:46px;margin-bottom:6px;">${d.icon}</div>
      <div style="font-size:24px;font-weight:900;letter-spacing:-.04em;font-family:'DM Mono',monospace;">${d.amount}</div>
      <div style="font-size:13px;color:var(--ink3);">${d.title}</div>
    </div>
    <div class="card" style="padding:0 14px;margin-bottom:14px;">
      <div class="card-row" style="cursor:default;">
        <div class="card-content"><div class="card-name" style="font-size:12px;">Plan asociado</div></div>
        <div style="font-size:13px;font-weight:700;">${d.plan}</div>
      </div>
      <div class="card-row" style="cursor:default;">
        <div class="card-content"><div class="card-name" style="font-size:12px;">Fecha</div></div>
        <div style="font-size:13px;font-weight:700;">${d.date}</div>
      </div>
      <div class="card-row" style="cursor:default;">
        <div class="card-content"><div class="card-name" style="font-size:12px;">Pagado por</div></div>
        <div style="font-size:13px;font-weight:700;">${d.payer}</div>
      </div>
      <div class="card-row" style="cursor:default;">
        <div class="card-content"><div class="card-name" style="font-size:12px;">Participantes</div></div>
        <div style="font-size:13px;font-weight:700;">${d.parts} personas</div>
      </div>
      <div class="card-row" style="cursor:default;border-bottom:0;">
        <div class="card-content"><div class="card-name" style="font-size:12px;">Estado</div></div>
        ${d.validated ? '<span class="pill pill-green">Validado</span>' : '<span class="pill pill-amber">Pendiente</span>'}
      </div>
    </div>
    <button class="btn btn-secondary btn-full" onclick="showToast('Comprobante mostrado')" style="margin-bottom:8px;">📎 Ver comprobante</button>
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
      document.getElementById('ep-handle').value = acc.handle;
    }
    document.getElementById('modal-edit-profile').classList.add('open');
  }, 200);
}

window.submitEditProfile = function submitEditProfile() {
  const acc = state.accounts.find(a => a.id === state.currentUserId);
  const newName = document.getElementById('ep-name').value.trim();
  const newHandle = document.getElementById('ep-handle').value.trim();
  if (newName) acc.name = newName;
  if (newHandle) acc.handle = newHandle.startsWith('@') ? newHandle : '@' + newHandle;
  if (newName) {
    acc.initials = newName.substring(0,2).toUpperCase();
    document.getElementById('hdr-user-avatar').textContent = acc.initials;
  }
  closeModal('modal-edit-profile');
  showToast('Perfil actualizado ✓');
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
  
  // Refrescar planes del nuevo grupo
  if (window.loadPlans) window.loadPlans();
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
    const { data: group, error: gError } = await supabase.from('groups').insert([{
      name: name,
      initials: initials,
      color: color,
      created_by: state.currentUserId
    }]).select().single();
    if (gError) throw gError;

    // 2. Insert Admin Member
    const { error: mError } = await supabase.from('group_members').insert([{
      group_id: group.id,
      user_id: state.currentUserId,
      role: 'admin'
    }]);
    if (mError) throw mError;

    // 3. Insert Settings
    await supabase.from('group_settings').insert([{ group_id: group.id }]);

    // 4. Generate & Insert Invite Code
    const code = Math.random().toString(36).substring(2,8).toUpperCase();
    await supabase.from('group_invites').insert([{
      group_id: group.id,
      code: code,
      created_by: state.currentUserId
    }]);

    showToast('Grupo creado correctamente');
    document.getElementById('cg-name').value = '';
    document.getElementById('cg-initials').value = '';
    closeModal('modal-create-group');
    
    await loadUserGroups();
    if (window.switchGroup) window.switchGroup(group.id);
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
  const m = memberData[id];
  if (!m) return;
  currentMemberId = id;
  state.currentMemberId = id;
  const setText = (elId, val) => { const e = document.getElementById(elId); if (e) e.textContent = val; };
  const setHtml = (elId, val) => { const e = document.getElementById(elId); if (e) e.innerHTML = val; };

  const av = document.getElementById('mp-avatar');
  if (av) { av.textContent = m.initials; av.style.background = m.avatarBg; }
  setText('mp-name', m.name);
  setText('mp-handle', m.handle);
  setText('mp-bio', m.bio || '');
  setText('mp-phone', '📱 ' + (m.phone || '—'));
  setHtml('mp-pills', m.pills.map(p => `<span class="pill ${p.cls}">${p.txt}</span>`).join(''));
  // KPI ampliado
  setText('mp-attended', m.stats.attended);
  setText('mp-mvps', m.stats.mvps);
  setText('mp-trds', m.stats.trds);
  setText('mp-yellows', m.stats.yellows);
  setText('mp-reds', m.stats.reds);
  // Reset navegación de planes del perfil
  memberPlansMonthOffset = 0;
  const mpNext = document.getElementById('mp-plans-next');
  if (mpNext) mpNext.classList.add('disabled');
  const mpMonth = document.getElementById('mp-plans-month');
  if (mpMonth) {
    const today = new Date();
    mpMonth.textContent = `${meses[today.getMonth()]} ${today.getFullYear()} · Mes actual · Todos los grupos`;
  }
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
    const { data: plan, error } = await supabase.from('plans').insert([{
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
      plan_id: plan.id,
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
  document.getElementById('modal-rules').classList.add('open');
}

window.submitRules = function submitRules() {
  closeModal('modal-rules');
  showToast('Cambios enviados a votación del grupo ✓');
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
window.renderBote = function renderBote() {
  const offset = state.boteMonthOffset;
  const data = state.boteHistory[offset];
  if (!data) return;

  document.getElementById('bote-month-label').textContent = data.label;
  document.getElementById('bote-total').textContent = (data.total || 0).toFixed(2).replace('.00','') + '€';
  document.getElementById('bote-status').textContent = data.status;
  document.getElementById('bote-status').style.color = data.closed ? 'var(--green)' : 'var(--ink)';

  document.getElementById('bote-next').classList.toggle('disabled', offset >= 0);
  const hasOlder = state.boteHistory[offset - 1] !== undefined;
  document.getElementById('bote-prev').classList.toggle('disabled', !hasOlder);

  // Inicializar confirmaciones si no existen
  if (!data.confirmDeudores) data.confirmDeudores = {};
  if (!data.confirmGanadores) data.confirmGanadores = {};

  // ── DEUDORES ──
  const deudoresEl = document.getElementById('bote-deudores');
  if (!data.deudores || data.deudores.length === 0) {
    deudoresEl.innerHTML = '<div style="padding:14px 0;text-align:center;font-size:12px;color:var(--ink3);">Nadie debe al bote este mes</div>';
  } else {
    const confirmedD = Object.values(data.confirmDeudores).filter(Boolean).length;
    const totalD = data.deudores.length;
    const pendingNamesD = data.deudores.filter(d => !data.confirmDeudores[d.id]).map(d => d.name);
    deudoresEl.innerHTML = data.deudores.map((d, idx) => {
      const isConfirmed = data.confirmDeudores[d.id];
      return `
        <div class="expense-item" ${idx === data.deudores.length - 1 ? 'style="border-bottom:0;"' : ''}>
          <div class="exp-left">
            <div class="exp-icon" style="background:${d.color};color:#fff;font-size:10px;font-weight:800;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">${d.initials}</div>
            <div class="exp-info">
              <div class="exp-name">${d.name}</div>
              <div class="exp-sub">${d.reason}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="exp-amount negative">${d.amount}€</div>
            <button class="btn ${isConfirmed ? 'btn-secondary' : 'btn-primary'}" style="font-size:10px;padding:4px 8px;white-space:nowrap;" onclick="confirmBoteDeudor('${d.id}', ${offset})">${isConfirmed ? '✓ Pagado' : 'Confirmar'}</button>
          </div>
        </div>
      `;
    }).join('') + `
      <div style="padding:10px 0 4px;border-top:1px solid var(--line);margin-top:4px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <div style="flex:1;height:6px;background:var(--line);border-radius:3px;overflow:hidden;">
            <div style="width:${Math.round(confirmedD/totalD*100)}%;height:100%;background:var(--green);border-radius:3px;transition:width .3s;"></div>
          </div>
          <span style="font-size:11px;font-family:'DM Mono',monospace;color:var(--ink3);white-space:nowrap;">${confirmedD}/${totalD}</span>
        </div>
        ${pendingNamesD.length ? `<div style="font-size:10px;color:var(--ink3);">Faltan: ${pendingNamesD.join(', ')}</div>` : ''}
      </div>
    `;
  }

  // ── REPARTO ──
  const repartoWrap = document.getElementById('bote-reparto-wrap');
  if (data.reparto) {
    repartoWrap.style.display = 'block';
    const confirmedG = Object.values(data.confirmGanadores).filter(Boolean).length;
    const totalG = data.reparto.length;
    const pendingNamesG = data.reparto.filter(r => !data.confirmGanadores[r.id]).map(r => r.name);
    const allDone = confirmedG === totalG && (Object.values(data.confirmDeudores).filter(Boolean).length === (data.deudores||[]).length);

    document.getElementById('bote-reparto').innerHTML = data.reparto.map((r, idx) => {
      const pos = idx + 1;
      const medal = pos === 1 ? '🥇' : (pos === 2 ? '🥈' : '🥉');
      const isConfirmed = data.confirmGanadores[r.id];
      return `
        <div class="expense-item" ${idx === data.reparto.length - 1 ? 'style="border-bottom:0;"' : ''}>
          <div class="exp-left">
            <div class="exp-icon" style="background:${r.color};color:#fff;font-size:10px;font-weight:800;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">${r.initials}</div>
            <div class="exp-info">
              <div class="exp-name">${medal} ${r.name}</div>
              <div class="exp-sub">${r.pct} del bote</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="exp-amount positive">+${r.amount.toFixed(2).replace('.00','')}€</div>
            <button class="btn ${isConfirmed ? 'btn-secondary' : 'btn-primary'}" style="font-size:10px;padding:4px 8px;white-space:nowrap;" onclick="confirmBoteGanador('${r.id}', ${offset})">${isConfirmed ? '✓ Cobrado' : 'Confirmar'}</button>
          </div>
        </div>
      `;
    }).join('') + `
      <div style="padding:10px 0 4px;border-top:1px solid var(--line);margin-top:4px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="flex:1;height:6px;background:var(--line);border-radius:3px;overflow:hidden;">
            <div style="width:${Math.round(confirmedG/totalG*100)}%;height:100%;background:var(--green);border-radius:3px;transition:width .3s;"></div>
          </div>
          <span style="font-size:11px;font-family:'DM Mono',monospace;color:var(--ink3);white-space:nowrap;">${confirmedG}/${totalG}</span>
        </div>
        ${pendingNamesG.length ? `<div style="font-size:10px;color:var(--ink3);margin-bottom:6px;">Faltan: ${pendingNamesG.join(', ')}</div>` : ''}
        <button class="btn ${allDone ? 'btn-primary' : 'btn-secondary'} btn-full" style="font-size:11px;" onclick="finalizeBote(${offset})" ${allDone ? '' : 'disabled'}>
          ${data.finalized ? '✓ Reparto finalizado' : 'Dar por finalizado el reparto'}
        </button>
        ${!allDone ? '<div style="font-size:10px;color:var(--ink3);margin-top:4px;text-align:center;">Disponible cuando todos confirmen</div>' : ''}
      </div>
    `;

    // ── ESTADO DEL REPARTO EN LA TABLA (deudores + ganadores) ──
    const statusRow = document.getElementById('bote-reparto-status-row');
    if (statusRow) {
      statusRow.style.display = 'flex';
      const confirmedD2 = Object.values(data.confirmDeudores).filter(Boolean).length;
      const totalD2 = (data.deudores || []).length;
      const totalAll = totalD2 + totalG;
      const confirmedAll = confirmedD2 + confirmedG;
      const pendingAll = [
        ...(data.deudores || []).filter(d => !data.confirmDeudores[d.id]).map(d => d.name),
        ...data.reparto.filter(r => !data.confirmGanadores[r.id]).map(r => r.name),
      ];
      document.getElementById('bote-reparto-status-count').textContent = `${confirmedAll}/${totalAll}`;
      document.getElementById('bote-reparto-status-bar').style.width = totalAll ? Math.round(confirmedAll / totalAll * 100) + '%' : '0%';
      const pendEl = document.getElementById('bote-reparto-status-pending');
      if (data.finalized) {
        pendEl.textContent = 'Reparto finalizado · todos han confirmado';
        pendEl.style.color = 'var(--green)';
      } else if (pendingAll.length) {
        pendEl.textContent = 'Faltan: ' + pendingAll.join(', ');
        pendEl.style.color = 'var(--ink3)';
      } else {
        pendEl.textContent = 'Todos han confirmado · listo para finalizar';
        pendEl.style.color = 'var(--green)';
      }
    }
  } else {
    repartoWrap.style.display = 'none';
    const statusRow = document.getElementById('bote-reparto-status-row');
    if (statusRow) statusRow.style.display = 'none';
  }
}

window.boteNav = function boteNav(delta) {
  const newOffset = state.boteMonthOffset + delta;
  if (newOffset > 0) return;
  if (state.boteHistory[newOffset] === undefined) return;
  state.boteMonthOffset = newOffset;
  renderBote();
}

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

window.openPodiumPicker = function openPodiumPicker(type, pos) {
  currentPodium = { type, position: pos };
  const title = type === 'mvp' ? `MVP · Elegir ${pos}º` : `Tardón · Elegir ${pos}º`;
  document.querySelector('#modal-podium-picker .modal-title').firstChild.textContent = title;
  const body = document.getElementById('podium-picker-body');
  const ya = state.ranking[type];
  body.innerHTML = state.planAttendees.map(person => {
    const yaUsado = ya.includes(person);
    return `
      <div class="account-item" style="${yaUsado ? 'opacity:.4;pointer-events:none;' : ''}" onclick="pickPodium('${person}')">
        <div class="account-avatar" style="background:${type === 'tardon' ? 'var(--red)' : 'var(--ink)'};">${person.substring(0,2).toUpperCase()}</div>
        <div class="account-info">
          <div class="account-name">${person}</div>
          <div class="account-handle">${yaUsado ? 'Ya votado' : (type === 'mvp' ? 'Como MVP' : 'Como tardón')}</div>
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('modal-podium-picker').classList.add('open');
}

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

window.resetTardon = function resetTardon() {
  state.ranking.tardon = [];
  renderTardonList();
  showToast('Lista de tardones vaciada');
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

window.openTardonPicker = function openTardonPicker() {
  currentPodium = { type: 'tardon', position: 0 };
  document.querySelector('#modal-podium-picker .modal-title').firstChild.textContent = 'Añadir persona tardona ';
  const body = document.getElementById('podium-picker-body');
  const ya = state.ranking.tardon || [];
  body.innerHTML = state.planAttendees.map(person => {
    const yaUsado = ya.includes(person);
    return `
      <div class="account-item" style="${yaUsado ? 'opacity:.4;pointer-events:none;' : ''}" onclick="addTardonPerson('${person}')">
        <div class="account-avatar" style="background:var(--red);">${person.substring(0,2).toUpperCase()}</div>
        <div class="account-info">
          <div class="account-name">${person}</div>
          <div class="account-handle">${yaUsado ? 'Ya en la lista' : 'Marcar como tardón · −2 pts'}</div>
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('modal-podium-picker').classList.add('open');
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

window.submitRanking = function submitRanking() {
  const mvpComplete = state.ranking.mvp.every(x => x !== null);
  if (!mvpComplete) {
    showToast('Debes elegir los 3 MVPs');
    return;
  }
  showToast('Votación enviada ✓');
}

/* ════════════════════════════════════════════════════════════════
   V5: showAddExpense con flag para ocultar selector "Asociado al plan"
   ════════════════════════════════════════════════════════════════ */
window.showAddExpense = function showAddExpense(fromPlan = false) {
  const selector = document.getElementById('exp-plan-selector');
  if (selector) selector.style.display = fromPlan ? 'none' : 'block';
  document.getElementById('modal-expense').classList.add('open');
}

/* ════════════════════════════════════════════════════════════════
   V5: CHATS
   ════════════════════════════════════════════════════════════════ */
window.openChat = function openChat(chatId, name, initials, color, kind) {
  state.currentChat = chatId;
  document.getElementById('conv-avatar').textContent = initials;
  document.getElementById('conv-avatar').style.background = color;
  document.getElementById('conv-name').textContent = name;
  document.getElementById('conv-sub').textContent = kind === 'group' ? `${state.myGroups.find(g=>g.id===state.currentGroupId)?.members || 9} miembros` : 'Activo ahora';
  renderConversation();
  showScreen('conversation');
}

window.backFromChat = function backFromChat() {
  goBack();
}

window.renderConversation = function renderConversation() {
  const body = document.getElementById('conv-body');
  const msgs = state.chatMessages[state.currentChat] || [];
  const isGroup = state.currentChat === 'group';
  body.innerHTML = msgs.map(m => {
    const mine = m.from === 'me';
    let authorName = '';
    if (isGroup && !mine) {
      const memberMap = { 'carlos': 'Carlos', 'mario': 'Mario', 'pablo': 'Pablo', 'lucas': 'Lucas', 'ana': 'Ana', 'javi': 'Javi' };
      authorName = `<div class="msg-author">${memberMap[m.from] || m.from}</div>`;
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

window.sendChatMessage = function sendChatMessage() {
  const input = document.getElementById('conv-input');
  const val = input.value.trim();
  if (!val) return;
  if (!state.chatMessages[state.currentChat]) state.chatMessages[state.currentChat] = [];
  const time = `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2,'0')}`;
  state.chatMessages[state.currentChat].push({ from: 'me', text: val, time });
  input.value = '';
  renderConversation();
}

window.openChatWith = function openChatWith(memberId) {
  // Mapeo de avatar
  const m = memberData[memberId];
  if (!m) return;
  openChat(memberId, m.name, m.initials, m.avatarBg, 'private');
}

/* ════════════════════════════════════════════════════════════════
   V5: STANDINGS (CLASIFICACIÓN tipo Liga)
   ════════════════════════════════════════════════════════════════ */
window.renderStandings = function renderStandings() {
  const offset = state.standingsMonthOffset;
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const monthName = meses[targetDate.getMonth()];
  const year = targetDate.getFullYear();
  const label = `${monthName} ${year}${offset === 0 ? ' · Mes actual' : ''}`;
  document.getElementById('stand-month-label').textContent = label;

  document.getElementById('stand-next').classList.toggle('disabled', offset >= 0);
  const hasOlder = state.standingsHistory[offset - 1] !== undefined;
  document.getElementById('stand-prev').classList.toggle('disabled', !hasOlder);

  // PTS = pj + mvp + trd - 2*am - 5*rj - nc
  const raw = state.standingsHistory[offset] || [];
  const data = raw.map(p => ({
    ...p,
    pts: p.pj + p.mvp + p.trd - 2 * (p.am || 0) - 5 * (p.rj || 0) - (p.nc || 0),
  })).sort((a, b) => b.pts - a.pts || b.mvp - a.mvp || b.pj - a.pj);

  const rows = document.getElementById('standings-rows');
  rows.innerHTML = data.map((p, idx) => {
    const pos = idx + 1;
    const posCls = pos === 1 ? 'gold' : (pos === 2 ? 'silver' : (pos === 3 ? 'bronze' : ''));
    const isYou = p.id === 'tu';
    const md = memberData[p.id];
    let handle = '';
    if (md && md.handle) handle = md.handle.split(' ')[0];
    // Indicador de cambio de posición desde el último plan (campo prevPos en los datos)
    let moveTag = '';
    if (typeof p.prevPos === 'number') {
      const diff = p.prevPos - pos;
      if (diff > 0) moveTag = `<span class="pos-move up" title="Sube ${diff}">▲${diff}</span>`;
      else if (diff < 0) moveTag = `<span class="pos-move down" title="Baja ${-diff}">▼${-diff}</span>`;
      else moveTag = `<span class="pos-move same">–</span>`;
    }
    return `
      <div class="standings-row" onclick="openMemberProfile('${p.id}')" style="${isYou ? 'background:var(--surface2);' : ''}">
        <div class="standings-pos ${posCls}">${pos}</div>
        <div class="standings-name">
          <div class="standings-avatar" style="background:${p.color};">${p.initials}</div>
          <div class="standings-namelabel">${p.name} <span style="color:var(--ink3);font-weight:500;font-size:9px;">(${handle})</span></div>
          ${moveTag}
        </div>
        <div class="standings-stat">${p.pj}</div>
        <div class="standings-stat" style="color:${(p.nc||0) > 0 ? 'var(--red)' : 'var(--ink3)'};">${(p.nc||0) > 0 ? '-'+(p.nc) : '0'}</div>
        <div class="standings-stat" style="color:${p.mvp > 0 ? 'var(--green)' : 'var(--ink3)'};">${p.mvp > 0 ? '+'+p.mvp : p.mvp}</div>
        <div class="standings-stat" style="color:${p.trd < 0 ? 'var(--red)' : 'var(--ink3)'};">${p.trd === 0 ? '0' : p.trd}</div>
        <div class="standings-stat" style="color:${(p.am||0) > 0 ? 'var(--amber)' : 'var(--ink3)'};">${p.am||0}</div>
        <div class="standings-stat" style="color:${(p.rj||0) > 0 ? 'var(--red)' : 'var(--ink3)'};">${p.rj||0}</div>
        <div class="standings-pts" style="color:${p.pts < 0 ? 'var(--red)' : 'var(--ink)'};">${p.pts}</div>
      </div>
    `;
  }).join('');
}

window.standingsNav = function standingsNav(delta) {
  const newOffset = state.standingsMonthOffset + delta;
  // No permitir ir al futuro
  if (newOffset > 0) return;
  // No permitir más allá de los datos disponibles
  if (state.standingsHistory[newOffset] === undefined) return;
  state.standingsMonthOffset = newOffset;
  renderStandings();
}

window.showStandingsLegend = function showStandingsLegend() {
  document.getElementById('modal-standings-legend').classList.add('open');
}

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

window.switchDisciplinaTab = function switchDisciplinaTab(el, name) {
  const wrap = el.closest('.section');
  wrap.querySelectorAll('.split-toggle-item').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('disciplina-activas').style.display = name === 'activas' ? 'block' : 'none';
  document.getElementById('disciplina-historial').style.display = name === 'historial' ? 'block' : 'none';
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
  openChat('group', 'EL CLUB', 'EL', '#0A0A0A', 'group');
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

// Subir foto a mejores momentos
window.uploadPlanPhoto = function uploadPlanPhoto() {
  const grid = document.getElementById('plan-photos-grid');
  if (!grid) return;
  const emojis = ['📸','🎊','🍾','🎶','🌟','💃','🕺','🎉'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  const div = document.createElement('div');
  div.style.cssText = 'aspect-ratio:1;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;';
  div.innerHTML = `<span style="font-size:24px;">${emoji}</span>`;
  grid.appendChild(div);
  showToast('Foto añadida a los mejores momentos ✓');
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
  const labels = {
    biblioteca: 'biblioteca',
    camara: 'la cámara',
    recientes: 'fotos recientes',
    archivos: 'archivos',
  };
  // Simular selección y añadir la foto
  uploadPlanPhoto();
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
window.discHistNav = function discHistNav(delta) {
  const n = discHistOffset + delta;
  if (n >= 0) return;
  discHistOffset = n;
  const next = document.getElementById('disc-hist-next');
  if (next) next.classList.toggle('disabled', discHistOffset >= -1 ? false : false);
  const d = new Date(2026, 4 + discHistOffset, 1);
  const lbl = document.getElementById('disc-hist-month');
  if (lbl) lbl.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// Navegador de meses de disciplina del perfil de miembro
let memberDiscOffset = -1;
window.memberDiscNav = function memberDiscNav(delta) {
  const n = memberDiscOffset + delta;
  if (n >= 0) return;
  memberDiscOffset = n;
  const next = document.getElementById('mp-disc-next');
  if (next) next.classList.toggle('disabled', false);
  const d = new Date(2026, 4 + memberDiscOffset, 1);
  const lbl = document.getElementById('mp-disc-month');
  if (lbl) lbl.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// Selector Actual/Historial de disciplina en el perfil de miembro
window.switchMemberDiscTab = function switchMemberDiscTab(el, name) {
  el.parentElement.querySelectorAll('.split-toggle-item').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('mp-disc-actual').style.display = name === 'actual' ? 'block' : 'none';
  document.getElementById('mp-disc-historial').style.display = name === 'historial' ? 'block' : 'none';
}

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
    document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);

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
          await loadUserProfile(session.user);
          document.getElementById('modal-auth').classList.remove('open');
          window.renderAll();
        }
      } else if (event === 'SIGNED_OUT') {
        state.isLoggedIn = false;
        state.currentUserId = 'tu';
        window.renderAll();
      }
    });
  }

  window.renderAll = function() {
    safeInit('setHeaderDate', () => setHeaderDate());
    safeInit('fab', () => { const f = document.getElementById('fab-create'); if (f) f.style.display = 'flex'; });
    safeInit('renderGroupList', () => renderGroupList());
    if (window.loadPlans) loadPlans();
    safeInit('renderCalendar', () => renderCalendar());
    safeInit('renderStandings', () => renderStandings());
    safeInit('renderBote', () => renderBote());
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

  window.loadPlans = async function loadPlans() {
    if (!state.currentGroupId) {
      const list = document.getElementById('plans-activos-list');
      if (list) list.innerHTML = '<div class="notice" style="margin-bottom:16px;">No tienes grupos. Crea uno o únete para ver los planes.</div>';
      return;
    }
    
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('group_id', state.currentGroupId)
      .order('event_date', { ascending: true });
      
    if (error) {
      console.error(error);
      return;
    }
    
    state.plans = plans || [];
    
    const activosHTML = state.plans.map(p => {
      const d = new Date(p.event_date);
      const dateStr = d.toLocaleString('es-ES', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
      return `
        <div class="card pending-border">
          <div class="card-row" onclick="openPlan('${p.id}')">
            <div class="card-content">
              <div class="card-label">${dateStr}</div>
              <div class="card-name">${p.title}</div>
              <div class="card-sub card-sub-1line">${p.description || 'Sin descripción'}</div>
            </div>
            <div class="card-right">
              <span class="attendance-tag pendiente">${p.status === 'active' ? 'Confirmado' : 'Propuesto'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    const list = document.getElementById('plans-activos-list');
    if (list) {
      list.innerHTML = activosHTML || '<div class="notice" style="margin-bottom:16px;">No hay planes en este grupo. ¡Crea el primero!</div>';
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
        state.currentGroupId = state.myGroups[0].id;
      }
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