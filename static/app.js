'use strict';

// ── Constants ──────────────────────────────────────────────────────
const PRI = ['Urgente', 'Media', 'Baja'];
const PRI_CLASS = { Urgente: 'urgent', Media: 'media', Baja: 'baja' };
const CATS = ['Trabajo', 'Casa', 'Personal', 'Estudio'];
const ESTADOS_FAM = ['Pendiente', 'En progreso', 'Completada'];
const MAX_TITLE = 60;
const MAX_DESC = 500;

// ── Helpers ────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relTime(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return Math.floor(diff / 60) + ' min';
  if (diff < 86400) return Math.floor(diff / 3600) + ' h';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' d';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

function fullDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function todayFormatted() {
  return new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function isOverdue(dateStr, completada) {
  if (!dateStr || completada) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

// ── SVG icons (Stationery & Hand-drawn ink strokes) ────────────────
const ICO = {
  check11: `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8.5 L6.2 12.2 L13.5 3.8"/></svg>`,
  check13: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8.5 L6.2 12.2 L13.5 3.8"/></svg>`,
  plus:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>`,
  search:  `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 L13.5 13.5"/></svg>`,
  trash:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10M6.5 4.5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8"/></svg>`,
  close:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 4 L12 12 M12 4 L4 12"/></svg>`,
  restore: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a5 5 0 1 1 1.5 3.5"/><path d="M3 4v3h3"/></svg>`,
  inbox:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2.5" width="10" height="11" rx="1.5"/><path d="M5.5 6h5M5.5 9h5M5.5 12h3"/></svg>`,
  done:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M5.5 8.2 L7.2 9.8 L10.5 6.5"/></svg>`,
  sun:     `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M11.5 3.5l-1 1M3.5 11.5l1-1"/></svg>`,
  moon:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 9.5a6 6 0 0 1-7-7 5.5 5.5 0 1 0 7 7z"/></svg>`,
  list:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 4.5h10M3 8h10M3 11.5h7"/></svg>`,
  kanban:  `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="3.5" height="10" rx="1"/><rect x="6.25" y="3" width="3.5" height="7" rx="1"/><rect x="10.5" y="3" width="3.5" height="5" rx="1"/></svg>`,
  grid:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>`,
  edit:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5a1.5 1.5 0 0 1 2.1 2.1L5.5 12.7l-3 .7.7-3L11.5 2.5z"/></svg>`,
  pin:     `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5l4 4-1.5 1.5-2-1-2.5 2.5 1 2.5-1.5 1.5-2.5-2.5-2.5 2.5v-.5l2.5-2.5-2.5-2.5 1.5-1.5 2.5 1 2.5-2.5-1-2z"/></svg>`,
  clip:    `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 7.5l-5.8 5.8a3.2 3.2 0 0 1-4.5-4.5l5.8-5.8a2.1 2.1 0 0 1 3 3l-5.7 5.7a1 1 0 0 1-1.5-1.5l5.2-5.2"/></svg>`,
  paperclipBig: `<svg class="paperclip-deco" width="26" height="36" viewBox="0 0 24 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v14a5 5 0 0 0 10 0V7a3.5 3.5 0 0 0-7 0v15a2 2 0 0 0 4 0V9"/></svg>`,
  folder:  `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4a1 1 0 0 1 1-1h3.2l1.5 1.5H13a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z"/></svg>`,
  user:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4"/></svg>`,
  users:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="6" cy="5.5" r="2.2"/><path d="M2 13c0-2 1.8-3.3 4-3.3s4 1.3 4 3.3"/><circle cx="11.5" cy="6" r="1.8"/><path d="M11 9.8c1.7.2 3 1.2 3 2.8"/></svg>`,
  bell:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6a4 4 0 0 0-8 0c0 4-1.5 5-1.5 5h11S12 10 12 6"/><path d="M6.8 13a1.5 1.5 0 0 0 2.4 0"/></svg>`,
  cal:     `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M5.5 2v2.5M10.5 2v2.5M2.5 6.5h11"/></svg>`,
  pen:     `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-8.5 8.5L2 14l.5-3.5L11 2z"/><path d="M9.5 3.5l3 3"/></svg>`,
  gear:    `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.2"/><path d="M13.4 9a1.1 1.1 0 0 0 .2 1.2l.1.1a1.3 1.3 0 0 1-1.8 1.8l-.1-.1a1.1 1.1 0 0 0-1.2-.2 1.1 1.1 0 0 0-.7 1v.2a1.3 1.3 0 0 1-2.6 0v-.1a1.1 1.1 0 0 0-.7-1 1.1 1.1 0 0 0-1.2.2l-.1.1a1.3 1.3 0 0 1-1.8-1.8l.1-.1a1.1 1.1 0 0 0 .2-1.2 1.1 1.1 0 0 0-1-.7H2.6a1.3 1.3 0 0 1 0-2.6h.1a1.1 1.1 0 0 0 1-.7 1.1 1.1 0 0 0-.2-1.2l-.1-.1a1.3 1.3 0 0 1 1.8-1.8l.1.1a1.1 1.1 0 0 0 1.2.2h.1a1.1 1.1 0 0 0 .7-1V2.6a1.3 1.3 0 0 1 2.6 0v.1a1.1 1.1 0 0 0 .7 1 1.1 1.1 0 0 0 1.2-.2l.1-.1a1.3 1.3 0 0 1 1.8 1.8l-.1.1a1.1 1.1 0 0 0-.2 1.2v.1a1.1 1.1 0 0 0 1 .7h.2a1.3 1.3 0 0 1 0 2.6h-.1a1.1 1.1 0 0 0-1 .7z"/></svg>`,
};

// ── Prefs (Nueva clave con Papel Rayado Claro por defecto) ─────────
const PREF_KEY = 'appnotas_cuaderno_prefs';
const PREF_DEF = { theme: 'light', paper: 'lined', hand: 'balanced', view: 'list' };

function loadPrefs() {
  try { return Object.assign({}, PREF_DEF, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); }
  catch { return Object.assign({}, PREF_DEF); }
}

function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(S.prefs)); } catch {}
}

function applyPrefs() {
  const h = document.documentElement;
  h.setAttribute('data-theme', S.prefs.theme || 'light');
  h.setAttribute('data-paper', S.prefs.paper || 'lined');
  h.setAttribute('data-hand', S.prefs.hand || 'balanced');
}

// ── State ──────────────────────────────────────────────────────────
const S = {
  token: localStorage.getItem('notas_token'),
  user: localStorage.getItem('notas_user'),
  role: localStorage.getItem('notas_role') || 'user',
  perfil: null,
  usuariosAdmin: [],
  adminUserFilter: '',
  notas: [],
  notasFamilia: [],
  grupoFamiliar: null,
  rolGrupo: null,
  familyMemberFilter: '',
  notificaciones: [],
  noLeidas: 0,
  notifOpen: false,
  settingsOpen: false,
  scope: 'pending',
  priorityFilter: null,
  categoryFilter: null,
  query: '',
  openId: null,
  editingNota: false,
  modal: null,
  confirmTargetId: null,
  confirmPermanent: false,
  loading: false,
  prefs: loadPrefs(),
  toast: null,
  toastTimer: null,
  qaExpanded: false,
  qaTitle: '',
  qaDesc: '',
  qaPri: 'Media',
  qaCat: 'Personal',
  qaDue: '',
  qaPinned: false,
  qaAsignado: '',
  loginMode: 'login',
  verifyUser: '',
  verifiedMessage: '',
  submitting: false,
};

// ── API ────────────────────────────────────────────────────────────
async function apiFetch(method, path, body, isFormData = false) {
  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (S.token) headers['Authorization'] = 'Bearer ' + S.token;
  const opts = { method, headers };
  if (body !== undefined) {
    opts.body = isFormData ? body : JSON.stringify(body);
  }
  const reqToken = S.token;
  try {
    const res = await fetch('/api/v1' + path, opts);
    if (S.token !== reqToken) return null;
    if (res.status === 401 || res.status === 422) { if (S.token) doLogout(); return null; }
    return res;
  } catch {
    showToast('Error de red');
    return null;
  }
}

async function loadNotas() {
  S.loading = true;
  renderApp();
  const qParam = (isAdminRole() && S.adminUserFilter) ? `?usuario=${encodeURIComponent(S.adminUserFilter)}` : '';
  const [r1, r2, r3] = await Promise.all([
    apiFetch('GET', '/grilla' + qParam),
    apiFetch('GET', '/grilla/completadas' + qParam),
    apiFetch('GET', '/grilla/archivadas' + qParam),
  ]);
  S.loading = false;
  if (!r1 || !r2 || !r3) { renderApp(); return; }
  const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
  const rawNotas = [...(d1.notas || []), ...(d2.notas || []), ...(d3.notas || [])];
  const map = new Map();
  rawNotas.forEach(n => map.set(n.id, n));
  S.notas = Array.from(map.values());
  renderApp();
}

async function loadFamiliaAndNotifs() {
  const [rFam, rNotif] = await Promise.all([
    apiFetch('GET', '/familia'),
    apiFetch('GET', '/notificaciones'),
  ]);
  if (rFam && rFam.ok) {
    const dFam = await rFam.json();
    S.grupoFamiliar = dFam.grupo || null;
    S.rolGrupo = dFam.rol_grupo || null;
    if (S.grupoFamiliar) {
      const [rf1, rf2] = await Promise.all([
        apiFetch('GET', '/grilla?contexto=familia'),
        apiFetch('GET', '/grilla/completadas?contexto=familia'),
      ]);
      if (rf1 && rf2 && rf1.ok && rf2.ok) {
        const [df1, df2] = await Promise.all([rf1.json(), rf2.json()]);
        const mapF = new Map();
        [...(df1.notas || []), ...(df2.notas || [])].forEach(n => mapF.set(n.id, n));
        S.notasFamilia = Array.from(mapF.values());
      }
    } else {
      S.notasFamilia = [];
    }
  }
  if (rNotif && rNotif.ok) {
    const dNotif = await rNotif.json();
    S.notificaciones = dNotif.notificaciones || [];
    S.noLeidas = dNotif.no_leidas || 0;
  }
  updateAll();
}

async function loadPerfilAndAdmin() {
  const r = await apiFetch('GET', '/auth/perfil');
  if (r && r.ok) {
    const data = await r.json();
    S.perfil = data;
    S.role = data.role || 'user';
    localStorage.setItem('notas_role', S.role);
    if (isAdminRole()) {
      const ru = await apiFetch('GET', '/usuarios');
      if (ru && ru.ok) {
        const du = await ru.json();
        S.usuariosAdmin = du.usuarios || [];
      }
    }
    updateSidebar();
  }
  await loadFamiliaAndNotifs();
}

function isAdminRole() {
  return S.role === 'docente' || S.role === 'admin';
}

function findNotaById(id) {
  return S.notas.find(n => n.id === id) || S.notasFamilia.find(n => n.id === id) || null;
}

// ── Auth ───────────────────────────────────────────────────────────
async function doLogin(username, password) {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 403 && data.unverified) {
      S.verifyUser = data.username || username;
      S.loginMode = 'verify';
      renderLogin('Tu cuenta aún no está verificada. Ingresá el código o solicitalo nuevamente.');
      return null;
    }
    return data.message || 'Credenciales inválidas';
  }
  S.token = data.access_token;
  S.user = data.username || username;
  S.role = data.role || 'user';
  localStorage.setItem('notas_token', S.token);
  localStorage.setItem('notas_user', S.user);
  localStorage.setItem('notas_role', S.role);
  await Promise.all([loadNotas(), loadPerfilAndAdmin()]);
  return null;
}

async function doRegistro(username, nombre, apellido, email, password, confirmPassword) {
  const res = await fetch('/api/v1/auth/registro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      nombre,
      apellido,
      email,
      password,
      confirm_password: confirmPassword,
    }),
  });
  const data = await res.json();
  if (!res.ok) return data.message || 'Error al registrar';
  S.verifyUser = username;
  S.verifyNotice = data.message || '';
  S.verifyCodeDemo = data.codigo_demo || '';
  S.loginMode = 'verify';
  render();
  return null;
}

async function doVerificar(codigo) {
  const res = await fetch('/api/v1/auth/verificar-codigo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: S.verifyUser, codigo }),
  });
  const data = await res.json();
  if (!res.ok) return data.message || 'Código incorrecto';
  S.loginMode = 'login';
  S.verifiedMessage = '¡Tu cuenta ha sido verificada con éxito! Ya podés abrir tu cuaderno.';
  render();
  return null;
}

async function doReenviarCodigo() {
  if (!S.verifyUser) return;
  const res = await fetch('/api/v1/auth/reenviar-codigo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: S.verifyUser }),
  });
  const data = await res.json();
  if (data.codigo_demo) {
    S.verifyNotice = data.message || '';
    S.verifyCodeDemo = data.codigo_demo;
    render();
  }
  showToast(data.message || (res.ok ? 'Código reenviado' : 'No se pudo reenviar'));
}

async function doRecuperarPassword(identificador) {
  const res = await fetch('/api/v1/auth/recuperar-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador }),
  });
  const data = await res.json();
  if (!res.ok) return data.message || 'No se pudo procesar la solicitud';
  S.verifyUser = data.username || identificador;
  S.verifyNotice = data.message || '';
  S.verifyCodeDemo = data.codigo_demo || '';
  S.loginMode = 'reset';
  render();
  showToast(data.message || 'Código de recuperación enviado a tu email');
  return null;
}

async function doResetPassword(username, codigo, newPassword, confirmPassword) {
  const res = await fetch('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      codigo,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
  const data = await res.json();
  if (!res.ok) return data.message || 'Error al restablecer la contraseña';
  S.loginMode = 'login';
  S.verifiedMessage = data.message || '¡Contraseña restablecida con éxito!';
  render();
  return null;
}

function doLogout() {
  S.token = null; S.user = null; S.role = 'user'; S.perfil = null;
  S.notas = []; S.notasFamilia = []; S.grupoFamiliar = null; S.rolGrupo = null;
  S.notificaciones = []; S.noLeidas = 0; S.familyMemberFilter = '';
  S.usuariosAdmin = []; S.adminUserFilter = '';
  S.scope = 'pending'; S.priorityFilter = null; S.categoryFilter = null; S.query = '';
  S.openId = null; S.modal = null; S.loading = false; S.notifOpen = false; S.settingsOpen = false; S.submitting = false;
  localStorage.removeItem('notas_token');
  localStorage.removeItem('notas_user');
  localStorage.removeItem('notas_role');
  render();
}

// ── Toast ──────────────────────────────────────────────────────────
function showToast(msg, undoFn) {
  clearTimeout(S.toastTimer);
  S.toast = { msg, undo: undoFn };
  updateToast();
  S.toastTimer = setTimeout(() => { S.toast = null; updateToast(); }, 5000);
}

function updateToast() {
  const el = document.querySelector('.toast');
  if (!el) return;
  if (S.toast) {
    el.innerHTML = `<span>${esc(S.toast.msg)}</span>${S.toast.undo ? '<button data-action="toast-undo">Deshacer</button>' : ''}`;
    el.classList.add('show');
  } else {
    el.innerHTML = '';
    el.classList.remove('show');
  }
}

// ── Mutations ──────────────────────────────────────────────────────
async function toggleNota(id, skipUndoToast = false) {
  const nota = findNotaById(id);
  if (!nota) return;
  const prev = nota.completada;
  const prevEstado = nota.estado_tarea;
  const prevMod = nota.fecha_modificacion;
  nota.completada = !prev;
  nota.estado_tarea = nota.completada ? 'Completada' : 'Pendiente';
  nota.fecha_modificacion = new Date().toISOString();
  updateAll();

  const res = await apiFetch('PUT', `/grilla/${id}/completar`, { completada: !prev });
  if (!res || !res.ok) {
    nota.completada = prev;
    nota.estado_tarea = prevEstado;
    nota.fecha_modificacion = prevMod;
    updateAll();
    showToast('Error al actualizar estado');
    return;
  }
  if (nota.grupo_id) loadFamiliaAndNotifs();
  if (!skipUndoToast) {
    showToast(
      nota.completada
        ? 'Su tarea ha sido marcada como completada y guardada en el historial'
        : 'Tarea reabierta',
      () => toggleNota(id, true)
    );
  }
}

async function changeEstadoTarea(id, nuevoEstado) {
  const res = await apiFetch('PUT', `/grilla/${id}/estado`, { estado_tarea: nuevoEstado });
  if (!res) return;
  const data = await res.json();
  if (!res.ok) {
    showToast(data.message || 'No se pudo cambiar el estado');
    return;
  }
  await loadFamiliaAndNotifs();
  showToast(`Estado actualizado a «${nuevoEstado}»`);
}

function askDeleteNota(id, permanent = false) {
  S.confirmTargetId = id;
  S.confirmPermanent = permanent;
  S.modal = 'confirm-delete';
  updateModals();
}

async function executeDeleteNota(id, permanent = false) {
  const nota = findNotaById(id);
  if (!nota) return;
  S.modal = null;
  updateModals();

  if (permanent) {
    const res = await apiFetch('DELETE', `/grilla/${id}?definitivo=true`);
    if (!res || !res.ok) { showToast('Error al eliminar definitivamente'); return; }
    S.notas = S.notas.filter(n => n.id !== id);
    S.notasFamilia = S.notasFamilia.filter(n => n.id !== id);
    if (S.openId === id) S.openId = null;
    updateAll();
    showToast('Nota arrancada definitivamente del cuaderno');
    return;
  }

  const prev = nota.fecha_baja;
  nota.fecha_baja = new Date().toISOString();
  if (S.openId === id) S.openId = null;
  updateAll();

  const res = await apiFetch('DELETE', `/grilla/${id}`);
  if (!res || !res.ok) {
    nota.fecha_baja = prev;
    updateAll();
    showToast('Error al eliminar');
    return;
  }
  if (nota.grupo_id) loadFamiliaAndNotifs();
  showToast('¡Tarea enviada a la Papelera!', () => restoreNota(id, true));
}

async function restoreNota(id, fromUndo = false) {
  const nota = findNotaById(id);
  if (!nota) return;
  const prev = nota.fecha_baja;
  nota.fecha_baja = null;
  updateAll();

  const res = await apiFetch('POST', `/grilla/${id}/restaurar`);
  if (!res || !res.ok) {
    nota.fecha_baja = prev;
    updateAll();
    showToast('Error al restaurar');
    return;
  }
  showToast(fromUndo ? 'Eliminación deshecha' : 'Nota restaurada al cuaderno', fromUndo ? null : () => executeDeleteNota(id, false));
}

async function emptyTrash() {
  S.modal = null;
  updateModals();
  const res = await apiFetch('DELETE', '/grilla/papelera/vaciar');
  if (!res || !res.ok) { showToast('Error al vaciar la papelera'); return; }
  await loadNotas();
  showToast('Papelera vaciada correctamente');
}

async function createNota(payload, fileToAttach) {
  const res = await apiFetch('POST', '/grilla', payload);
  if (!res) return;
  const data = await res.json();
  if (!res.ok) { showToast(data.message || 'Error al crear la nota'); return; }

  let nuevaNota = data.nota;
  if (fileToAttach && data.id) {
    const fd = new FormData();
    fd.append('archivo', fileToAttach);
    const rAtt = await apiFetch('POST', `/grilla/${data.id}/adjuntos`, fd, true);
    if (rAtt) {
      const dAtt = await rAtt.json();
      if (!rAtt.ok) {
        showToast(dAtt.message || 'Nota creada, pero falló el archivo adjunto');
      } else if (dAtt.nota) {
        nuevaNota = dAtt.nota;
      }
    }
  }
  if (nuevaNota) {
    if (nuevaNota.grupo_id) {
      S.notasFamilia = [nuevaNota, ...S.notasFamilia.filter(n => n.id !== nuevaNota.id)];
    } else {
      S.notas = [nuevaNota, ...S.notas.filter(n => n.id !== nuevaNota.id)];
    }
    updateAll();
  } else {
    await loadNotas();
  }
  showToast(data.message || '¡Tarea anotada en el cuaderno!');
}

async function updateNota(id, payload, toastMsg = '¡Nota modificada con éxito!') {
  const res = await apiFetch('PUT', `/grilla/${id}`, payload);
  if (!res) return false;
  const data = await res.json();
  if (!res.ok) {
    showToast(data.message || 'Error al modificar la nota');
    return false;
  }
  const idx = S.notas.findIndex(n => n.id === id);
  if (idx !== -1 && data.nota) S.notas[idx] = data.nota;
  const idxF = S.notasFamilia.findIndex(n => n.id === id);
  if (idxF !== -1 && data.nota) S.notasFamilia[idxF] = data.nota;
  S.editingNota = false;
  updateAll();
  if (toastMsg) showToast(toastMsg);
  return true;
}

async function uploadNotaAttachment(id, file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('archivo', file);
  const res = await apiFetch('POST', `/grilla/${id}/adjuntos`, fd, true);
  if (!res) return;
  const data = await res.json();
  if (!res.ok) {
    showToast(data.message || 'Error al subir archivo');
    return;
  }
  const idx = S.notas.findIndex(n => n.id === id);
  if (idx !== -1 && data.nota) S.notas[idx] = data.nota;
  const idxF = S.notasFamilia.findIndex(n => n.id === id);
  if (idxF !== -1 && data.nota) S.notasFamilia[idxF] = data.nota;
  updateAll();
  showToast(data.message || 'Archivo abrochado a la nota');
}

async function deleteNotaAttachment(id, filename) {
  const res = await apiFetch('DELETE', `/grilla/${id}/adjuntos/${encodeURIComponent(filename)}`);
  if (!res || !res.ok) { showToast('Error al eliminar adjunto'); return; }
  const data = await res.json();
  const idx = S.notas.findIndex(n => n.id === id);
  if (idx !== -1 && data.nota) S.notas[idx] = data.nota;
  const idxF = S.notasFamilia.findIndex(n => n.id === id);
  if (idxF !== -1 && data.nota) S.notasFamilia[idxF] = data.nota;
  updateAll();
  showToast('Archivo adjunto retirado');
}

// ── Acciones de Grupo Familiar & Notificaciones ─────────────────────
async function crearGrupoFamiliar(nombre) {
  const res = await apiFetch('POST', '/familia', { nombre });
  if (!res) return;
  const data = await res.json();
  if (!res.ok) { showToast(data.message || 'No se pudo crear el grupo'); return; }
  showToast(data.message || '¡Grupo Familiar creado!');
  await loadFamiliaAndNotifs();
}

async function unirseGrupoFamiliar(codigo) {
  const res = await apiFetch('POST', '/familia/unirse', { codigo });
  if (!res) return;
  const data = await res.json();
  if (!res.ok) { showToast(data.message || 'Código inválido'); return; }
  showToast(data.message || '¡Te uniste al Grupo Familiar!');
  await loadFamiliaAndNotifs();
}

async function agregarMiembroFamiliar(identificador) {
  const res = await apiFetch('POST', '/familia/miembros', { identificador });
  if (!res) return;
  const data = await res.json();
  if (!res.ok) { showToast(data.message || 'No se pudo agregar al integrante'); return; }
  showToast(data.message || 'Integrante sumado al grupo');
  await loadFamiliaAndNotifs();
}

async function removerMiembroFamiliar(username) {
  const res = await apiFetch('DELETE', `/familia/miembros/${encodeURIComponent(username)}`);
  if (!res) return;
  const data = await res.json();
  if (!res.ok) { showToast(data.message || 'No se pudo remover'); return; }
  showToast(data.message || 'Actualizado');
  await loadFamiliaAndNotifs();
}

async function disolverGrupoFamiliar() {
  const res = await apiFetch('DELETE', '/familia');
  if (!res) return;
  const data = await res.json();
  if (!res.ok) { showToast(data.message || 'No se pudo disolver el grupo'); return; }
  showToast(data.message || 'Grupo disuelto');
  await loadFamiliaAndNotifs();
}

async function marcarNotificacionesLeidas(id = null) {
  const res = await apiFetch('PUT', '/notificaciones/leer', id ? { id } : {});
  if (res && res.ok) {
    const data = await res.json();
    S.notificaciones = data.notificaciones || [];
    S.noLeidas = data.no_leidas || 0;
    updateTopbar();
  }
}

// ── Computed ───────────────────────────────────────────────────────
function getBaseScopeNotes() {
  return S.scope === 'family' ? S.notasFamilia : S.notas;
}

function getFiltered() {
  const mine = getBaseScopeNotes();
  let base;
  if (S.scope === 'family') {
    base = mine.filter(n => !n.fecha_baja);
    if (S.familyMemberFilter) {
      base = base.filter(n => n.asignado_a === S.familyMemberFilter);
    }
  } else if (S.scope === 'completed') {
    base = mine.filter(n => !n.fecha_baja && n.completada);
  } else if (S.scope === 'archived') {
    base = mine.filter(n => !!n.fecha_baja);
  } else if (S.scope === 'all') {
    base = [...mine];
  } else {
    base = mine.filter(n => !n.fecha_baja && !n.completada);
  }

  if (S.priorityFilter && (S.scope === 'pending' || S.scope === 'all' || S.scope === 'family')) {
    base = base.filter(n => n.prioridad === S.priorityFilter);
  }
  if (S.categoryFilter) {
    base = base.filter(n => (n.categoria || 'Personal') === S.categoryFilter);
  }
  if (S.query.trim()) {
    const q = S.query.toLowerCase();
    base = base.filter(n =>
      n.titulo.toLowerCase().includes(q) ||
      (n.descripcion || '').toLowerCase().includes(q) ||
      (n.categoria || '').toLowerCase().includes(q) ||
      (n.usuario || '').toLowerCase().includes(q) ||
      (n.asignado_a || '').toLowerCase().includes(q)
    );
  }
  return [...base].sort((a, b) => {
    if (S.scope === 'pending' || S.scope === 'family') {
      if (!!a.fijada !== !!b.fijada) return a.fijada ? -1 : 1;
      const pa = PRI.indexOf(a.prioridad), pb = PRI.indexOf(b.prioridad);
      if (pa !== pb) return pa - pb;
    }
    return new Date(b.fecha_modificacion || b.fecha_creacion) - new Date(a.fecha_modificacion || a.fecha_creacion);
  });
}

function getCounts() {
  const mine = S.notas;
  const pend = mine.filter(n => !n.fecha_baja && !n.completada);
  const active = mine.filter(n => !n.fecha_baja);
  const famPend = S.notasFamilia.filter(n => !n.fecha_baja && !n.completada);
  const counts = {
    pending: pend.length,
    completed: mine.filter(n => !n.fecha_baja && n.completada).length,
    archived: mine.filter(n => !!n.fecha_baja).length,
    all: mine.length,
    family: famPend.length,
    Urgente: pend.filter(n => n.prioridad === 'Urgente').length,
    Media:   pend.filter(n => n.prioridad === 'Media').length,
    Baja:    pend.filter(n => n.prioridad === 'Baja').length,
  };
  CATS.forEach(c => {
    counts['cat_' + c] = active.filter(n => (n.categoria || 'Personal') === c).length;
  });
  return counts;
}

// ── HTML builders ──────────────────────────────────────────────────
function buildSidebar() {
  const c = getCounts();
  const s = S.scope, pf = S.priorityFilter, cf = S.categoryFilter;
  return `<nav class="sidebar">
  <div class="brand">
    <div class="brand-title">${ICO.pen}<span>Mi Cuaderno</span></div>
    <div class="brand-sub">AppNotas · Índice General</div>
  </div>
  ${isAdminRole() ? `<div class="admin-filter-box">
    <label>Modo Docente · Cuaderno de</label>
    <select id="admin-user-select">
      <option value=""${S.adminUserFilter === '' ? ' selected' : ''}>Mis notas (${esc(S.user)})</option>
      <option value="TODOS"${S.adminUserFilter === 'TODOS' ? ' selected' : ''}>Todos los alumnos</option>
      ${S.usuariosAdmin.filter(u => u.username !== S.user).map(u => `<option value="${esc(u.username)}"${S.adminUserFilter === u.username ? ' selected' : ''}>${esc(u.username)} (${esc(u.role)})</option>`).join('')}
    </select>
  </div>` : ''}
  <div class="side-section">Mis Cuadernos</div>
  <div class="side-folder${S.personalCollapsed ? ' collapsed' : ''}">
    <div class="side-folder-head" data-action="toggle-personal-folder" title="Desplegar / contraer mis notas propias">
      ${ICO.folder}
      <span>Notas Propias</span>
      <span class="folder-chevron">▾</span>
    </div>
    <div class="side-folder-body">
      <div class="side-item${s === 'pending' && !pf && !cf ? ' active' : ''}" data-action="scope" data-scope="pending">${ICO.inbox}<span>Pendientes</span><span class="count">${c.pending}</span></div>
      <div class="side-item${s === 'completed' ? ' active' : ''}" data-action="scope" data-scope="completed">${ICO.done}<span>Completadas</span><span class="count">${c.completed}</span></div>
      <div class="side-item${s === 'archived' ? ' active' : ''}" data-action="scope" data-scope="archived">${ICO.trash}<span>Papelera</span><span class="count">${c.archived}</span></div>
      <div class="side-item${s === 'all' ? ' active' : ''}" data-action="scope" data-scope="all">${ICO.list}<span>Historial total</span><span class="count">${c.all}</span></div>
    </div>
  </div>

  <div class="side-section">Espacio Compartido</div>
  <div class="side-item${s === 'family' ? ' active' : ''}" data-action="scope" data-scope="family">${ICO.users}<span>Grupo Familiar</span><span class="count">${c.family}</span></div>

  <div class="side-section">Resaltador de Prioridad</div>
  ${PRI.map(p => `<div class="side-item${s === 'pending' && pf === p ? ' active' : ''}" data-action="filter" data-priority="${p}"><span class="side-dot ${PRI_CLASS[p]}"></span><span>${p}</span><span class="count">${c[p]}</span></div>`).join('')}

  <div class="side-section">Etiquetas / Categorías</div>
  <div class="sticker-grid">
    ${CATS.map(cat => `<div class="cat-sticker cat-${cat}${cf === cat ? ' active' : ''}" data-action="filter-cat" data-cat="${cat}">
      <span>${cat}</span><span class="count">${c['cat_' + cat]}</span>
    </div>`).join('')}
  </div>

  <div style="flex:1"></div>
  <div class="side-user" title="Ver ficha de perfil">
    <div class="avatar" data-action="open-profile" style="cursor:pointer">${esc((S.user || '?')[0].toUpperCase())}</div>
    <div data-action="open-profile" style="cursor:pointer;min-width:0;flex:1">
      <div style="font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(S.perfil?.nombre || S.user || '')}</div>
      <div style="font-family:var(--font-stamp);font-size:10px;color:var(--ink-3)">@${esc(S.user || '')}${isAdminRole() ? ' · Docente' : ''}</div>
    </div>
    <span class="logout" data-action="logout">salir</span>
  </div>
</nav>`;
}

function buildTopbar(sorted) {
  let title = S.scope === 'completed'
    ? 'Hojas Completadas'
    : S.scope === 'archived'
    ? 'Papelera de Recortes'
    : S.scope === 'all'
    ? 'Índice Histórico'
    : S.scope === 'family'
    ? (S.grupoFamiliar ? `Cuaderno · ${S.grupoFamiliar.nombre}` : 'Cuaderno Familiar')
    : S.priorityFilter || 'Notas Pendientes';

  if (S.categoryFilter) title += ` · ${S.categoryFilter}`;
  const v = S.prefs.view;
  const p = S.prefs.paper || 'lined';
  const h = S.prefs.hand || 'balanced';
  const c = getCounts();

  return `<header class="topbar">
  <div class="page-title-block">
    <h1>${esc(title)}</h1>
  </div>
  <div class="spacer"></div>
  ${S.scope === 'archived' && c.archived > 0 ? `<button class="btn-ghost" data-action="ask-empty-trash" style="color:var(--urgent);border-color:var(--urgent)" type="button">${ICO.trash} Vaciar papelera</button>` : ''}

  <!-- Selector de Vista (Renglones / Post-its / Kanban) -->
  <div class="view-btns">
    <button class="icon-btn${v === 'list' ? ' active-view' : ''}" data-action="view" data-view="list" title="Vista Renglones de Cuaderno" type="button">${ICO.list}</button>
    <button class="icon-btn${v === 'cards' ? ' active-view' : ''}" data-action="view" data-view="cards" title="Vista Post-its Pegados" type="button">${ICO.grid}</button>
    <button class="icon-btn${v === 'kanban' ? ' active-view' : ''}" data-action="view" data-view="kanban" title="Vista Pizarra Kanban" type="button">${ICO.kanban}</button>
  </div>

  <!-- Menú de Configuración (Hoja, Letra y Tema) -->
  <div class="settings-wrap">
    <button class="icon-btn${S.settingsOpen ? ' active-view' : ''}" data-action="toggle-settings" title="Configuración del Cuaderno" type="button">
      ${ICO.gear}
    </button>
    ${S.settingsOpen ? `<div class="settings-popover">
      <div class="notif-head" style="margin-bottom:2px">
        <span>Configuración del Cuaderno</span>
      </div>
      <div class="settings-group">
        <span class="settings-label">Tipo de Hoja</span>
        <div class="settings-options">
          <button class="settings-opt${p === 'lined' ? ' active' : ''}" data-action="paper" data-paper="lined" type="button">Rayada</button>
          <button class="settings-opt${p === 'grid' ? ' active' : ''}" data-action="paper" data-paper="grid" type="button">Cuadrícula</button>
          <button class="settings-opt${p === 'dotted' ? ' active' : ''}" data-action="paper" data-paper="dotted" type="button">Puntos</button>
        </div>
      </div>
      <div class="settings-group">
        <span class="settings-label">Tipografía</span>
        <div class="settings-options two-cols">
          <button class="settings-opt${h !== 'full' ? ' active' : ''}" data-action="set-hand" data-hand="balanced" type="button">Balanceada</button>
          <button class="settings-opt${h === 'full' ? ' active' : ''}" data-action="set-hand" data-hand="full" type="button">${ICO.pen} Manuscrita</button>
        </div>
      </div>
      <div class="settings-group">
        <span class="settings-label">Tema del Cuaderno</span>
        <div class="settings-options two-cols">
          <button class="settings-opt${S.prefs.theme !== 'dark' ? ' active' : ''}" data-action="set-theme" data-theme="light" type="button">${ICO.sun} Claro</button>
          <button class="settings-opt${S.prefs.theme === 'dark' ? ' active' : ''}" data-action="set-theme" data-theme="dark" type="button">${ICO.moon} Oscuro</button>
        </div>
      </div>
    </div>` : ''}
  </div>

  <!-- Campanita de Notificaciones -->
  <div class="notif-wrap">
    <button class="icon-btn${S.notifOpen ? ' active-view' : ''}" data-action="toggle-notifs" title="Avisos del Cuaderno" type="button">
      ${ICO.bell}
      ${S.noLeidas > 0 ? `<span class="notif-badge">${S.noLeidas}</span>` : ''}
    </button>
    ${S.notifOpen ? `<div class="notif-popover">
      <div class="notif-head">
        <span>Avisos del Cuaderno (${S.noLeidas} sin leer)</span>
        ${S.noLeidas > 0 ? `<button class="link-btn" data-action="read-all-notifs" type="button" style="font-size:11px">Marcar leídas</button>` : ''}
      </div>
      ${!S.notificaciones.length
        ? `<div style="font-size:12.5px;color:var(--ink-3);padding:12px 4px;text-align:center">No tenés notificaciones pendientes.</div>`
        : S.notificaciones.map(n => `<div class="notif-item${n.leida ? '' : ' unread'}" data-action="open-notif" data-notif-id="${n.id}" data-nota-id="${n.nota_id || ''}">
            <div>${esc(n.mensaje)}</div>
            <span class="notif-time">${relTime(n.fecha)}</span>
          </div>`).join('')}
    </div>` : ''}
  </div>

  <button class="icon-btn" data-action="open-profile" title="Mi Perfil" type="button">${ICO.user}</button>
  <div class="search">${ICO.search}<input id="search-input" value="${esc(S.query)}" placeholder="Buscar en las hojas…" autocomplete="off"/></div>
</header>`;
}

function buildFilters() {
  if (S.scope === 'family' && !S.grupoFamiliar) return '';
  const c = getCounts(), pf = S.priorityFilter, cf = S.categoryFilter;
  return `<div class="filters" style="flex-wrap:wrap">
  ${(S.scope === 'pending' || S.scope === 'family') && S.prefs.view !== 'kanban' ? `
    <button class="chip${!pf ? ' active' : ''}" data-action="filter" data-priority="" type="button">Todas <span class="count">${S.scope === 'family' ? S.notasFamilia.length : c.pending}</span></button>
    ${PRI.map(p => `<button class="chip pri-${PRI_CLASS[p]}${pf === p ? ' active' : ''}" data-action="filter" data-priority="${p}" type="button"><span class="dot ${PRI_CLASS[p]}"></span>${p}<span class="count">${c[p]}</span></button>`).join('')}
    <span style="width:1px;height:18px;background:var(--paper-border-strong);margin:0 4px"></span>
  ` : ''}
  <button class="chip${!cf ? ' active' : ''}" data-action="filter-cat" data-cat="" type="button">Todas las etiquetas</button>
  ${CATS.map(cat => `<button class="chip${cf === cat ? ' active' : ''}" data-action="filter-cat" data-cat="${cat}" type="button">${cat} <span class="count">${c['cat_' + cat]}</span></button>`).join('')}
</div>`;
}

function buildQuickAdd() {
  const isFam = S.scope === 'family';
  if (S.scope !== 'pending' && !isFam) return '';
  if (isFam && (!S.grupoFamiliar || S.rolGrupo !== 'lider')) return '';

  const miembros = S.grupoFamiliar?.miembros || [];
  if (!S.qaExpanded) {
    return `<div class="quick-add" data-action="qa-expand" role="button" tabindex="0">
      ${ICO.paperclipBig}
      ${ICO.plus}
      <span>${isFam ? 'Anotar y asignar nueva tarea al Grupo Familiar…' : 'Escribir nueva nota en la hoja (Título, etiqueta, prioridad, vencimiento, adjunto)…'}</span>
      <span style="margin-left:auto;font-family:var(--font-stamp);font-size:11px;color:var(--ink-3)">Tecla N</span>
    </div>`;
  }
  return `<div class="quick-add expanded">
  ${ICO.paperclipBig}
  <div class="qa-row">
    <input id="qa-title" class="qa-title" maxlength="${MAX_TITLE}" value="${esc(S.qaTitle)}" placeholder="${isFam ? 'Título de la tarea familiar…' : 'Escribir título de la nota (máx. ' + MAX_TITLE + ' caracteres)…'}"/>
    <span id="qa-title-count" class="char-count">${S.qaTitle.length}/${MAX_TITLE}</span>
  </div>
  <textarea id="qa-desc" class="qa-desc" rows="2" maxlength="${MAX_DESC}" placeholder="Detalles o anotaciones adicionales (máx. ${MAX_DESC} caracteres)…">${esc(S.qaDesc)}</textarea>
  <div class="qa-meta-row">
    ${isFam ? `
      <label style="font-family:var(--font-stamp);font-size:11px;color:var(--ink-red);font-weight:700">Asignar a:</label>
      <select id="qa-asignado" class="qa-select">
        ${miembros.map(m => `<option value="${esc(m.username)}"${(S.qaAsignado || S.user) === m.username ? ' selected' : ''}>${esc(m.nombre)} (@${esc(m.username)})</option>`).join('')}
      </select>
    ` : ''}
    <label style="font-family:var(--font-stamp);font-size:11px;color:var(--ink-2)">Etiqueta:</label>
    <select id="qa-cat" class="qa-select">
      ${CATS.map(cat => `<option value="${cat}"${S.qaCat === cat ? ' selected' : ''}>${cat}</option>`).join('')}
    </select>
    <label style="font-family:var(--font-stamp);font-size:11px;color:var(--ink-2);margin-left:4px">Vence:</label>
    <input id="qa-due" type="date" class="qa-date" value="${esc(S.qaDue)}"/>
    <button class="btn-ghost" data-action="qa-toggle-pin" type="button" style="${S.qaPinned ? 'border-color:var(--ink-red);color:var(--ink-red)' : ''}">${ICO.pin} ${S.qaPinned ? 'Destacada' : 'Destacar'}</button>
    <label class="btn-ghost" style="cursor:pointer">
      ${ICO.clip} <span id="qa-file-label">Abrochar archivo</span>
      <input id="qa-file" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" style="display:none"/>
    </label>
  </div>
  <div class="qa-actions">
    <div class="priority-select">${PRI.map(p => `<button class="pri-${PRI_CLASS[p]}${S.qaPri === p ? ' active' : ''}" data-action="qa-pri" data-priority="${p}" type="button"><span class="pdot ${PRI_CLASS[p]}"></span>${p}</button>`).join('')}</div>
    <div class="spacer"></div>
    <button class="btn-ghost" data-action="qa-cancel" type="button">Cancelar</button>
    <button class="btn-primary" data-action="qa-submit" type="button"${!S.qaTitle.trim() ? ' disabled' : ''}>${isFam ? 'Asignar en el cuaderno' : 'Anotar en la hoja'}</button>
  </div>
</div>`;
}

function buildNoteBadges(n) {
  const parts = [];
  const pc = PRI_CLASS[n.prioridad] || 'media';
  parts.push(`<span class="hl-priority ${pc}">${esc(n.prioridad)}</span>`);
  if (n.fijada) parts.push(`<span class="pin-badge" title="Nota fijada arriba">${ICO.pin}</span>`);
  const cat = n.categoria || 'Personal';
  parts.push(`<span class="cat-tag cat-${esc(cat)}">${esc(cat)}</span>`);
  if (n.fecha_vencimiento) {
    const over = isOverdue(n.fecha_vencimiento, n.completada);
    parts.push(`<span class="due-tag${over ? ' overdue' : ''}" title="${over ? 'Tarea vencida' : 'Fecha límite'}">${ICO.cal} ${esc(n.fecha_vencimiento)}${over ? ' · Vencida' : ''}</span>`);
  }
  if (n.subtareas && n.subtareas.length > 0) {
    const doneCount = n.subtareas.filter(s => s.hecha).length;
    parts.push(`<span class="sub-badge">${ICO.check11} ${doneCount}/${n.subtareas.length}</span>`);
  }
  if (n.adjuntos && n.adjuntos.length > 0) {
    parts.push(`<span class="att-badge">${ICO.clip} ${n.adjuntos.length}</span>`);
  }
  if (n.grupo_id && n.asignado_a) {
    parts.push(`<span class="author-badge" title="Responsable asignado">👉 @${esc(n.asignado_a)}</span>`);
  } else if (isAdminRole() && S.adminUserFilter) {
    parts.push(`<span class="author-badge">@${esc(n.usuario)}</span>`);
  }
  return parts.join('');
}

function buildFamilyStateControl(n) {
  if (!n.grupo_id) return '';
  const canChange = S.rolGrupo === 'lider' || n.asignado_a === S.user;
  const est = n.estado_tarea || (n.completada ? 'Completada' : 'Pendiente');
  if (!canChange) {
    return `<span class="cat-tag">${esc(est)}</span>`;
  }
  return `<select class="state-select-inline" data-action="fam-state-select" data-id="${n.id}" onclick="event.stopPropagation()">
    ${ESTADOS_FAM.map(st => `<option value="${st}"${est === st ? ' selected' : ''}>${st === 'Pendiente' ? '⏳ Pendiente' : st === 'En progreso' ? '🔄 En progreso' : '✅ Completada'}</option>`).join('')}
  </select>`;
}

function buildNoteRow(n, archivado) {
  const canDelete = !n.grupo_id || S.rolGrupo === 'lider' || n.usuario === S.user;
  return `<div class="note-row${n.completada ? ' done' : ''}" data-action="open-nota" data-id="${n.id}">
  <div class="margin-col">
    <button class="check" data-action="toggle" data-id="${n.id}" type="button" aria-label="${n.completada ? 'Marcar pendiente' : 'Marcar completada'}">${n.completada ? ICO.check11 : ''}</button>
  </div>
  <div class="body">
    <div class="title">
      <span class="title-text">${esc(n.titulo)}</span>
      <div class="badge-row">${buildNoteBadges(n)} ${buildFamilyStateControl(n)}</div>
    </div>
    ${n.descripcion ? `<div class="desc">${esc(n.descripcion)}</div>` : ''}
  </div>
  <div class="meta">${relTime(n.fecha_modificacion || n.fecha_creacion)}</div>
  <div class="actions">${archivado
    ? `<button class="icon-btn" data-action="restore" data-id="${n.id}" title="Restaurar a la hoja" type="button">${ICO.restore}</button>
       <button class="icon-btn danger" data-action="delete-perm" data-id="${n.id}" title="Arrancar definitivamente" type="button">${ICO.trash}</button>`
    : `${canDelete ? `<button class="icon-btn" data-action="pin" data-id="${n.id}" title="${n.fijada ? 'Quitar chincheta' : 'Fijar con chincheta'}" type="button" style="${n.fijada ? 'color:var(--ink-red)' : ''}">${ICO.pin}</button>
       <button class="icon-btn danger" data-action="delete" data-id="${n.id}" title="Enviar a papelera" type="button">${ICO.trash}</button>` : ''}`
  }</div>
</div>`;
}

function buildListView(sorted, archivado) {
  if (!sorted.length) {
    const hasFilter = S.query.trim() || S.priorityFilter || S.categoryFilter || S.adminUserFilter || S.familyMemberFilter;
    if (hasFilter) {
      return `<div class="empty"><div class="e-glyph">${ICO.search}</div><h3>No encontramos anotaciones con ese filtro</h3><p>Probá cambiando las etiquetas o el texto de búsqueda en el cuaderno.</p></div>`;
    }
    const m = {
      completed: ['Hojas sin tareas completadas aún', 'Cuando tildes una tarea con lapicera, quedará archivada en esta sección.'],
      archived: ['Papelera de recortes vacía', 'Las hojas o notas que descartes aparecerán acá por si querés recuperarlas.'],
      pending: ['Hoja en blanco, todo al día', 'No tenés notas pendientes. Hacé clic arriba o presioná N para escribir sobre los renglones.'],
      all: ['Cuaderno listo para estrenar', 'Escribí tu primera nota en la pestaña de Pendientes.'],
      family: ['Sin tareas familiares asignadas', S.rolGrupo === 'lider' ? 'Usá la esquela con clip de arriba para asignarle una tarea a un integrante.' : 'Todavía no hay tareas en el pizarrón familiar.'],
    };
    const [h, p] = m[S.scope] || m.pending;
    return `<div class="empty"><div class="e-glyph">${ICO.pen}</div><h3>${h}</h3><p>${p}</p></div>`;
  }
  if (S.scope === 'pending') {
    const groups = {}; PRI.forEach(p => { groups[p] = []; }); sorted.forEach(n => groups[n.prioridad]?.push(n));
    return `<div class="notes-list">${PRI.map(p => !groups[p].length ? '' : `
  <div class="list-section"><span>Marcador: Prioridad ${p}</span><span class="line"></span><span style="font-family:var(--font-stamp);font-size:11px;color:var(--ink-3)">${groups[p].length}</span></div>
  ${groups[p].map(n => buildNoteRow(n, archivado)).join('')}`).join('')}</div>`;
  }
  return `<div class="notes-list">${sorted.map(n => buildNoteRow(n, n.fecha_baja != null)).join('')}</div>`;
}

function buildKanbanView(sorted) {
  if (S.scope === 'family') {
    const groups = { 'Pendiente': [], 'En progreso': [], 'Completada': [] };
    sorted.forEach(n => {
      const est = n.estado_tarea || (n.completada ? 'Completada' : 'Pendiente');
      (groups[est] || groups['Pendiente']).push(n);
    });
    const colMeta = [
      { key: 'Pendiente', label: '⏳ Pendiente', cls: 'urgent' },
      { key: 'En progreso', label: '🔄 En progreso', cls: 'media' },
      { key: 'Completada', label: '✅ Completada', cls: 'baja' },
    ];
    return `<div class="kanban">${colMeta.map(col => `
      <div class="kanban-col col-${col.cls}">
        <h3><span>${col.label}</span><span class="count">${groups[col.key].length}</span></h3>
        <div class="kanban-list">${!groups[col.key].length
          ? `<div style="font-family:var(--font-hand);font-size:15px;color:var(--ink-3);padding:10px">Sin Post-its en esta columna</div>`
          : groups[col.key].map(n => `<div class="k-card pri-${PRI_CLASS[n.prioridad]}${n.completada ? ' done' : ''}" data-action="open-nota" data-id="${n.id}">
              <div class="badge-row">${buildNoteBadges(n)}</div>
              <div class="title">${esc(n.titulo)}</div>
              ${n.descripcion ? `<div class="desc">${esc(n.descripcion)}</div>` : ''}
              <div class="foot">
                ${buildFamilyStateControl(n)}
                <span class="spacer"></span>
                <span class="meta">${relTime(n.fecha_modificacion || n.fecha_creacion)}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('')}</div>`;
  }

  const groups = {}; PRI.forEach(p => { groups[p] = []; }); sorted.forEach(n => groups[n.prioridad]?.push(n));
  return `<div class="kanban">${PRI.map(p => `
<div class="kanban-col col-${PRI_CLASS[p]}">
  <h3><span class="side-dot ${PRI_CLASS[p]}"></span><span>Prioridad ${p}</span><span class="count">${groups[p].length}</span></h3>
  <div class="kanban-list">${!groups[p].length
    ? `<div style="font-family:var(--font-hand);font-size:15px;color:var(--ink-3);padding:10px">Sin Post-its</div>`
    : groups[p].map(n => `<div class="k-card pri-${PRI_CLASS[p]}${n.completada ? ' done' : ''}" data-action="open-nota" data-id="${n.id}">
    <div class="badge-row">${buildNoteBadges(n)}</div>
    <div class="title">${esc(n.titulo)}</div>
    ${n.descripcion ? `<div class="desc">${esc(n.descripcion)}</div>` : ''}
    <div class="foot"><span class="meta">${relTime(n.fecha_modificacion || n.fecha_creacion)}</span><span class="spacer"></span><div class="actions">
      <button class="icon-btn" data-action="pin" data-id="${n.id}" title="${n.fijada ? 'Desfijar' : 'Fijar'}" type="button" style="${n.fijada ? 'color:var(--ink-red)' : ''}">${ICO.pin}</button>
      <button class="icon-btn" data-action="toggle" data-id="${n.id}" title="${n.completada ? 'Marcar pendiente' : 'Completar'}" type="button">${ICO.check13}</button>
      <button class="icon-btn danger" data-action="delete" data-id="${n.id}" title="Eliminar" type="button">${ICO.trash}</button>
    </div></div>
  </div>`).join('')
  }</div>
</div>`).join('')}</div>`;
}

function buildGalleryView(sorted, archivado) {
  if (!sorted.length) {
    return buildListView(sorted, archivado);
  }
  return `<div class="gallery">${sorted.map(n => {
    const isArch = archivado || !!n.fecha_baja;
    const canDelete = !n.grupo_id || S.rolGrupo === 'lider' || n.usuario === S.user;
    return `
<div class="g-card pri-${PRI_CLASS[n.prioridad]}${n.completada ? ' done' : ''}" data-action="open-nota" data-id="${n.id}">
  <div class="head">
    <span class="hl-priority ${PRI_CLASS[n.prioridad]}">${esc(n.prioridad)}</span>
    <span class="spacer"></span>
    <button class="check" data-action="toggle" data-id="${n.id}" type="button" title="Tildar tarea">${n.completada ? ICO.check11 : ''}</button>
  </div>
  <div class="title">${esc(n.titulo)}</div>
  ${n.descripcion ? `<div class="desc">${esc(n.descripcion)}</div>` : '<div class="desc" style="opacity:0.45;font-style:italic">Sin notas adicionales…</div>'}
  <div class="badge-row" style="margin-top:auto">${buildNoteBadges(n)} ${buildFamilyStateControl(n)}</div>
  <div class="foot"><span>${relTime(n.fecha_modificacion || n.fecha_creacion)}</span><div class="actions">
    ${isArch
      ? `<button class="icon-btn" data-action="restore" data-id="${n.id}" title="Restaurar" type="button">${ICO.restore}</button>
         <button class="icon-btn danger" data-action="delete-perm" data-id="${n.id}" title="Eliminar definitivo" type="button">${ICO.trash}</button>`
      : `${canDelete ? `<button class="icon-btn" data-action="pin" data-id="${n.id}" title="${n.fijada ? 'Desfijar' : 'Fijar'}" type="button" style="${n.fijada ? 'color:var(--ink-red)' : ''}">${ICO.pin}</button>
         <button class="icon-btn danger" data-action="delete" data-id="${n.id}" title="Eliminar" type="button">${ICO.trash}</button>` : ''}`}
  </div></div>
</div>`;
  }).join('')}</div>`;
}

function buildFamilySection() {
  if (!S.grupoFamiliar) {
    return `<div class="family-onboarding">
      <form id="create-family-form" class="family-card">
        <div class="login-mark">Opción A · Madres, Padres o Tutores</div>
        <h3>Crear mi Grupo Familiar</h3>
        <p style="margin:0;font-size:13.5px;color:var(--ink-2);line-height:1.5">Creá un cuaderno compartido para tu hogar, obtené un código de invitación y asignale tareas a cada integrante con avisos por email cuando las completen.</p>
        <div class="field">
          <label for="fam-name-inp">Nombre del Grupo Familiar</label>
          <input id="fam-name-inp" class="input" placeholder="Ej: Familia Scocco" required/>
        </div>
        <button class="btn-primary" type="submit">Fundar Grupo Familiar (Ser Líder)</button>
      </form>
      <form id="join-family-form" class="family-card">
        <div class="login-mark">Opción B · Hijos o Integrantes</div>
        <h3>Tengo un código de invitación</h3>
        <p style="margin:0;font-size:13.5px;color:var(--ink-2);line-height:1.5">Si el líder de tu familia te compartió un sello con código (por ejemplo <strong>FAM-2026</strong>), ingresalo acá para vincular tu cuaderno.</p>
        <div class="field">
          <label for="fam-code-inp">Código de invitación</label>
          <input id="fam-code-inp" class="input" placeholder="FAM-XXXX" required/>
        </div>
        <button class="btn-primary" type="submit">Unirme al Grupo Familiar</button>
      </form>
    </div>`;
  }

  const g = S.grupoFamiliar;
  const esLider = S.rolGrupo === 'lider';
  const miembros = g.miembros || [];
  const sorted = getFiltered();
  const bodyHtml = S.prefs.view === 'kanban'
    ? buildKanbanView(sorted)
    : S.prefs.view === 'cards'
    ? buildGalleryView(sorted, false)
    : buildListView(sorted, false);

  return `
    <div class="family-banner">
      <div class="family-banner-top">
        <strong style="font-family:var(--font-display);font-size:17px">${esc(g.nombre)}</strong>
        <span class="cat-tag">${esLider ? '👑 Líder del Grupo' : '👤 Miembro'}</span>
        <span class="family-code-stamp" data-action="copy-fam-code" data-code="${esc(g.codigo_invitacion)}" title="Clic para copiar código de invitación">Sello: ${esc(g.codigo_invitacion)} 📋</span>
        <div style="flex:1"></div>
        ${esLider ? `
          <form id="add-member-form" style="display:inline-flex;gap:6px;align-items:center">
            <input id="add-member-inp" class="input" style="padding:5px 9px;font-size:12.5px" placeholder="Usuario o email a sumar…"/>
            <button class="btn-ghost" type="submit">${ICO.plus} Sumar integrante</button>
          </form>
          <button class="btn-ghost" data-action="dissolve-family" type="button" style="color:var(--urgent)">Disolver grupo</button>
        ` : `
          <button class="btn-ghost" data-action="leave-family" type="button" style="color:var(--urgent)">Salir del grupo</button>
        `}
      </div>
      <div class="badge-row">
        <span style="font-family:var(--font-stamp);font-size:11px;color:var(--ink-3)">Integrantes:</span>
        <button class="chip${!S.familyMemberFilter ? ' active' : ''}" data-action="fam-filter-member" data-member="" type="button">Todos</button>
        ${miembros.map(m => `<button class="chip${S.familyMemberFilter === m.username ? ' active' : ''}" data-action="fam-filter-member" data-member="${esc(m.username)}" type="button">
          ${m.rol_grupo === 'lider' ? '👑' : '👤'} ${esc(m.nombre)}
          ${esLider && m.username !== S.user ? `<span data-action="remove-fam-member" data-username="${esc(m.username)}" title="Quitar integrante del grupo" style="margin-left:4px;color:var(--urgent);font-weight:700">×</span>` : ''}
        </button>`).join('')}
      </div>
    </div>
    ${bodyHtml}
  `;
}

function buildNotesBody() {
  if (S.loading) return buildSkeleton();
  if (S.scope === 'family') return buildFamilySection();
  const sorted = getFiltered();
  const archivado = S.scope === 'archived';
  if (S.prefs.view === 'kanban' && S.scope === 'pending') return buildKanbanView(sorted);
  if (S.prefs.view === 'cards') return buildGalleryView(sorted, archivado);
  return buildListView(sorted, archivado);
}

function buildSkeleton() {
  return `<div class="notes-list">${Array(4).fill('').map(() => `
<div class="note-row" style="pointer-events:none;opacity:0.35">
  <div class="margin-col"><div style="width:20px;height:20px;border-radius:4px;border:2px solid var(--paper-border-strong)"></div></div>
  <div class="body">
    <div style="height:15px;background:var(--paper-border-strong);border-radius:4px;width:38%;margin-bottom:6px"></div>
    <div style="height:12px;background:var(--paper-border);border-radius:4px;width:56%"></div>
  </div>
</div>`).join('')}</div>`;
}

function buildDetailPanel() {
  const nota = S.openId ? findNotaById(S.openId) : null;
  const archivado = nota && !!nota.fecha_baja;
  const subs = nota?.subtareas || [];
  const subsDone = subs.filter(s => s.hecha).length;
  const subPct = subs.length ? Math.round((subsDone / subs.length) * 100) : 0;
  const adjs = nota?.adjuntos || [];
  const canEditConsigna = nota && (!nota.grupo_id || S.rolGrupo === 'lider' || nota.usuario === S.user || isAdminRole());

  return `<div class="detail-overlay${nota ? ' open' : ''}" data-action="close-detail"></div>
<aside class="detail-panel${nota ? ' open' : ''}">
  ${nota ? `<div class="detail-head">
    <button class="icon-btn" data-action="close-detail" title="Cerrar ficha (Esc)" type="button">${ICO.close}</button>
    <span style="font-family:var(--font-stamp);font-size:11px;color:var(--ink-red);text-transform:uppercase">Ficha N° ${nota.id}</span>
    <div class="spacer"></div>
    ${archivado
      ? `<button class="btn-ghost" data-action="restore" data-id="${nota.id}" type="button">${ICO.restore} Restaurar</button>
         <button class="btn-ghost" data-action="delete-perm" data-id="${nota.id}" type="button" style="color:var(--urgent)">${ICO.trash} Eliminar definitivo</button>`
      : `${canEditConsigna ? `<button class="btn-ghost" data-action="toggle-edit-nota" type="button">${ICO.edit} ${S.editingNota ? 'Cancelar' : 'Editar'}</button>` : ''}
         <button class="btn-ghost" data-action="toggle" data-id="${nota.id}" type="button">${ICO.check13} ${nota.completada ? 'Reabrir' : 'Completar'}</button>
         ${canEditConsigna ? `<button class="btn-ghost" data-action="delete" data-id="${nota.id}" type="button" style="color:var(--urgent)" title="Enviar a papelera">${ICO.trash}</button>` : ''}`}
  </div>
  <div class="detail-body">
    ${S.editingNota && canEditConsigna ? `
      <form id="edit-nota-form" class="detail-edit-form" data-id="${nota.id}">
        <div class="field">
          <label for="e-title">Título (obligatorio, máx. ${MAX_TITLE} caracteres)</label>
          <input id="e-title" class="input" maxlength="${MAX_TITLE}" value="${esc(nota.titulo)}" required/>
        </div>
        <div class="field">
          <label for="e-desc">Descripción (máx. ${MAX_DESC} caracteres)</label>
          <textarea id="e-desc" class="input" maxlength="${MAX_DESC}">${esc(nota.descripcion || '')}</textarea>
        </div>
        ${nota.grupo_id && S.grupoFamiliar?.miembros?.length ? `
        <div class="field">
          <label for="e-asignado">Asignada a (Integrante del Grupo Familiar)</label>
          <select id="e-asignado" class="input">
            ${S.grupoFamiliar.miembros.map(m => `<option value="${esc(m.username)}"${nota.asignado_a === m.username ? ' selected' : ''}>${esc(m.nombre)} (@${esc(m.username)})</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="detail-edit-row">
          <div class="field">
            <label for="e-pri">Prioridad</label>
            <select id="e-pri" class="input">
              ${PRI.map(p => `<option value="${p}"${nota.prioridad === p ? ' selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="e-cat">Categoría / Etiqueta</label>
            <select id="e-cat" class="input">
              ${CATS.map(c => `<option value="${c}"${(nota.categoria || 'Personal') === c ? ' selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="detail-edit-row">
          <div class="field">
            <label for="e-due">Fecha de vencimiento</label>
            <input id="e-due" type="date" class="input" value="${esc(nota.fecha_vencimiento || '')}"/>
          </div>
          <div class="field" style="justify-content:flex-end">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 0">
              <input id="e-pin" type="checkbox" ${nota.fijada ? 'checked' : ''}/> Destacar arriba con chincheta
            </label>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
          <button class="btn-ghost" type="button" data-action="toggle-edit-nota">Cancelar</button>
          <button class="btn-primary" type="submit">Guardar en la Ficha</button>
        </div>
      </form>
    ` : `
      <div class="badge-row" style="margin-bottom:8px">
        ${buildNoteBadges(nota)}
        ${buildFamilyStateControl(nota)}
      </div>
      <h2 class="detail-title">${esc(nota.titulo)}</h2>
      <div class="detail-desc${nota.descripcion ? '' : ' empty-d'}">${nota.descripcion ? esc(nota.descripcion) : 'Sin anotaciones adicionales en esta ficha.'}</div>
    `}

    <!-- Subtareas / Checklist -->
    <div class="detail-section">
      <div class="detail-section-title">
        <span>Subtareas / Checklist sobre Renglón</span>
        <span>${subsDone}/${subs.length} (${subPct}%)</span>
      </div>
      ${subs.length ? `<div class="sub-progress-bar"><div class="sub-progress-fill" style="width:${subPct}%"></div></div>` : ''}
      <div class="sub-list">
        ${subs.map(s => `<div class="sub-item${s.hecha ? ' done' : ''}">
          <input type="checkbox" data-action="sub-toggle" data-id="${nota.id}" data-sub-id="${s.id}" ${s.hecha ? 'checked' : ''}/>
          <span style="flex:1">${esc(s.texto)}</span>
          <button class="icon-btn danger" data-action="sub-del" data-id="${nota.id}" data-sub-id="${s.id}" type="button" style="width:22px;height:22px">${ICO.close}</button>
        </div>`).join('')}
      </div>
      ${!archivado ? `<div class="sub-add-row">
        <input id="new-sub-input" class="input" placeholder="Escribir subtarea y presionar Enter…" data-nota-id="${nota.id}"/>
        <button class="btn-ghost" data-action="sub-add" data-id="${nota.id}" type="button">${ICO.plus}</button>
      </div>` : ''}
    </div>

    <!-- Archivos Adjuntos (RF01.6) -->
    <div class="detail-section">
      <div class="detail-section-title">
        <span>${ICO.clip} Archivos Abrochados (${adjs.length})</span>
        <span style="font-size:9.5px;color:var(--ink-3)">PDF, DOCX, JPG, PNG · Máx 10 MB</span>
      </div>
      ${adjs.length ? `<div class="att-list">
        ${adjs.map(a => `<div class="att-item">
          <span class="att-ext">${esc(a.extension || 'FILE')}</span>
          <div class="att-info">
            <a class="att-name" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.nombre)}</a>
            <span class="att-size">${formatBytes(a.tamano)} · ${relTime(a.fecha)}</span>
          </div>
          ${!archivado ? `<button class="icon-btn danger" data-action="att-del" data-id="${nota.id}" data-filename="${esc(a.filename)}" title="Quitar adjunto" type="button">${ICO.trash}</button>` : ''}
        </div>`).join('')}
      </div>` : `<p style="font-size:12.5px;color:var(--ink-3);margin:0 0 10px">No hay recortes ni archivos abrochados a esta ficha.</p>`}
      ${!archivado ? `<label class="btn-ghost" style="cursor:pointer">
        ${ICO.clip} Abrochar archivo…
        <input id="detail-file-input" type="file" data-id="${nota.id}" accept=".pdf,.docx,.jpg,.jpeg,.png" style="display:none"/>
      </label>` : ''}
    </div>

    <!-- Metadatos de Auditoría -->
    <dl class="detail-meta">
      <dt>Anotada</dt><dd>${fullDate(nota.fecha_creacion)}</dd>
      <dt>Modificada</dt><dd>${fullDate(nota.fecha_modificacion)}</dd>
      ${nota.fecha_vencimiento ? `<dt>Vencimiento</dt><dd>${esc(nota.fecha_vencimiento)}${isOverdue(nota.fecha_vencimiento, nota.completada) ? ' (Vencida)' : ''}</dd>` : ''}
      ${nota.fecha_baja ? `<dt>Descartada</dt><dd>${fullDate(nota.fecha_baja)}</dd>` : ''}
      <dt>Etiqueta</dt><dd>${esc(nota.categoria || 'Personal')}</dd>
      <dt>Autor</dt><dd>@${esc(nota.usuario)}</dd>
      ${nota.asignado_a ? `<dt>Asignada a</dt><dd>@${esc(nota.asignado_a)}</dd>` : ''}
      <dt>Estado</dt><dd>${nota.fecha_baja ? 'En Papelera' : (nota.estado_tarea || (nota.completada ? 'Completada' : 'Pendiente'))}</dd>
    </dl>
  </div>` : ''}
</aside>`;
}

function buildModals() {
  if (!S.modal) return '';

  if (S.modal === 'confirm-delete') {
    const n = findNotaById(S.confirmTargetId);
    const perm = S.confirmPermanent;
    return `<div class="modal-overlay" data-action="close-modal">
      <div class="modal-card">
        <div class="modal-head">
          <h2>${perm ? 'Arrancar hoja definitivamente' : 'Mover nota a la Papelera'}</h2>
          <button class="icon-btn" data-action="close-modal" type="button">${ICO.close}</button>
        </div>
        <p style="margin:0;font-size:14px;color:var(--ink-2);line-height:1.5">
          ${perm
            ? `¿Estás seguro de que querés borrar definitivamente <strong>"${esc(n?.titulo || '')}"</strong>? Esta acción no se puede deshacer.`
            : `¿Está seguro que desea enviar la nota <strong>"${esc(n?.titulo || '')}"</strong> a la Papelera de recortes?`}
        </p>
        <div class="modal-foot">
          <button class="btn-ghost" data-action="close-modal" type="button">Cancelar</button>
          <button class="btn-danger" data-action="confirm-delete-yes" type="button">Confirmar</button>
        </div>
      </div>
    </div>`;
  }

  if (S.modal === 'confirm-empty-trash') {
    return `<div class="modal-overlay" data-action="close-modal">
      <div class="modal-card">
        <div class="modal-head">
          <h2>Vaciar Papelera del Cuaderno</h2>
          <button class="icon-btn" data-action="close-modal" type="button">${ICO.close}</button>
        </div>
        <p style="margin:0;font-size:14px;color:var(--ink-2);line-height:1.5">
          ¿Estás seguro de que querés eliminar definitivamente todos los recortes de la Papelera?
        </p>
        <div class="modal-foot">
          <button class="btn-ghost" data-action="close-modal" type="button">Cancelar</button>
          <button class="btn-danger" data-action="confirm-empty-trash-yes" type="button">Vaciar papelera</button>
        </div>
      </div>
    </div>`;
  }

  if (S.modal === 'profile') {
    const p = S.perfil || { username: S.user, nombre: S.user, apellido: '', email: '', role: S.role };
    const c = getCounts();
    return `<div class="modal-overlay" data-action="close-modal">
      <form id="profile-form" class="modal-card">
        <div class="modal-head">
          <h2>Ficha del Propietario (@${esc(p.username)})</h2>
          <button class="icon-btn" data-action="close-modal" type="button">${ICO.close}</button>
        </div>
        <div class="badge-row">
          <span class="cat-tag">Rol: ${esc(p.role || 'user')}</span>
          <span class="cat-tag">Pendientes: ${c.pending}</span>
          <span class="cat-tag">Completadas: ${c.completed}</span>
          <span class="cat-tag">Papelera: ${c.archived}</span>
        </div>
        <div class="detail-edit-row">
          <div class="field">
            <label for="p-nombre">Nombre</label>
            <input id="p-nombre" class="input" value="${esc(p.nombre || '')}" required/>
          </div>
          <div class="field">
            <label for="p-apellido">Apellido</label>
            <input id="p-apellido" class="input" value="${esc(p.apellido || '')}"/>
          </div>
        </div>
        <div class="field">
          <label for="p-email">Correo Electrónico</label>
          <input id="p-email" type="email" class="input" value="${esc(p.email || '')}" required/>
        </div>
        <div style="border-top:1px dashed var(--paper-border-strong);padding-top:10px;font-family:var(--font-stamp);font-size:10px;color:var(--ink-3);text-transform:uppercase">Cambiar contraseña (opcional)</div>
        <div class="detail-edit-row">
          <div class="field">
            <label for="p-curr-pw">Contraseña actual</label>
            <input id="p-curr-pw" type="password" class="input" placeholder="••••••••"/>
          </div>
          <div class="field">
            <label for="p-new-pw">Nueva contraseña</label>
            <input id="p-new-pw" type="password" class="input" placeholder="Mín. 4 caracteres"/>
          </div>
        </div>
        <div class="login-error" id="profile-err"></div>
        <div class="modal-foot">
          <button class="btn-ghost" data-action="close-modal" type="button">Cerrar</button>
          <button class="btn-primary" type="submit">Guardar cambios</button>
        </div>
      </form>
    </div>`;
  }

  if (S.modal === 'terms') {
    return `<div class="modal-overlay" data-action="close-modal">
      <div class="modal-card wide">
        <div class="modal-head">
          <h2>Términos y Condiciones de Uso — AppNotas</h2>
          <button class="icon-btn" data-action="close-modal" type="button">${ICO.close}</button>
        </div>
        <div style="font-size:13.5px;color:var(--ink-2);line-height:1.6;max-height:55vh;overflow-y:auto;padding-right:6px">
          <p><strong>1. Aceptación:</strong> Al registrarse y utilizar AppNotas, el usuario acepta cumplir con los presentes Términos y Condiciones.</p>
          <p><strong>2. Uso del Cuaderno Digital:</strong> El sistema «Lista de Tareas con Prioridad (AppNotas)» permite crear, modificar, completar, adjuntar archivos (PDF, DOCX, JPG, PNG hasta 10 MB), organizar en grupos familiares, eliminar en papelera y restaurar tareas personales asignándoles prioridad, categoría, subtareas y fecha de vencimiento.</p>
          <p><strong>3. Registro y Autenticación:</strong> El acceso requiere registro con correo electrónico verificado mediante código OTP de 6 caracteres y contraseña protegida con hash bcrypt.</p>
          <p><strong>4. Gestión de Datos y Baja Lógica:</strong> Al eliminar una tarea, queda en la Papelera (baja lógica) conservando sus archivos adjuntos hasta que el usuario decida restaurarla o vaciar la papelera.</p>
          <p><strong>5. Propiedad Intelectual:</strong> Proyecto desarrollado en la Escuela Superior N° 49 «Cap. Gral. J. J. Urquiza» — Carrera Desarrollo de Software — Prácticas Profesionalizantes I.</p>
        </div>
        <div class="modal-foot">
          <button class="btn-primary" data-action="close-modal" type="button">Entendido</button>
        </div>
      </div>
    </div>`;
  }

  return '';
}

// ── Partial updates ────────────────────────────────────────────────
function updateSidebar()     { const e = document.getElementById('sidebar-wrap'); if (e) e.innerHTML = buildSidebar(); }
function updateTopbar()      { const e = document.getElementById('topbar-wrap');  if (e) e.innerHTML = buildTopbar(getFiltered()); }
function updateFilters()     { const e = document.getElementById('filters-wrap'); if (e) e.innerHTML = buildFilters(); }
function updateQuickAdd()    { const e = document.getElementById('qa-wrap');      if (e) e.innerHTML = buildQuickAdd(); }
function updateNotesBody()   { const e = document.getElementById('notes-body');   if (e) e.innerHTML = buildNotesBody(); }
function updateDetailPanel() { const e = document.getElementById('detail-wrap');  if (e) e.innerHTML = buildDetailPanel(); }
function updateModals()      { const e = document.getElementById('modal-wrap');   if (e) e.innerHTML = buildModals(); }

function updateAll() {
  updateSidebar(); updateTopbar(); updateFilters(); updateQuickAdd(); updateNotesBody(); updateDetailPanel(); updateModals();
}

// ── Render ─────────────────────────────────────────────────────────
function render() {
  applyPrefs();
  if (!S.token) renderLogin(); else renderApp();
}

function renderLogin(err) {
  const root = document.getElementById('root');

  if (S.loginMode === 'verify') {
    root.innerHTML = `<div class="login-wrap"><div class="notebook-cover"><form class="login-card" id="verify-form">
  <div class="login-mark"><span>CUADERNO DE NOTAS</span><span>SELLO DE VERIFICACIÓN</span></div>
  <h1 class="login-title">Validar Propietario</h1>
  <p class="login-sub">Ingresá el código de 6 caracteres enviado al correo de <strong>@${esc(S.verifyUser)}</strong>.</p>
  ${S.verifyNotice ? `<div class="login-success">${esc(S.verifyNotice)}</div>` : ''}
  <div class="field"><label for="code">Código de activación</label><input id="code" class="input" name="code" value="${esc(S.verifyCodeDemo || '')}" placeholder="XXXXXX" autofocus/></div>
  <div class="login-error">${esc(err || '')}</div>
  <button class="btn-primary" type="submit">Abrir mi Cuaderno</button>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <button class="link-btn" type="button" data-action="resend-code">Reenviar código</button>
    <button class="link-btn" type="button" data-action="switch-login">Volver a la portada</button>
  </div>
</form></div></div><div id="modal-wrap">${buildModals()}</div><div class="toast"></div>`;
  } else if (S.loginMode === 'forgot') {
    root.innerHTML = `<div class="login-wrap"><div class="notebook-cover"><form class="login-card" id="forgot-form">
  <div class="login-mark"><span>CUADERNO DE NOTAS</span><span>RECUPERACIÓN</span></div>
  <h1 class="login-title">Recuperar acceso</h1>
  <p class="login-sub">Anotá tu usuario o email y te enviaremos un código de acceso.</p>
  <div class="field"><label for="f-id">Usuario o Email</label><input id="f-id" class="input" placeholder="nacho o mail@ejemplo.com" autofocus/></div>
  <div class="login-error">${esc(err || '')}</div>
  <button class="btn-primary" type="submit">Enviar código</button>
  <button class="btn-ghost" type="button" data-action="switch-login" style="justify-content:center">Volver a la portada</button>
</form></div></div><div id="modal-wrap">${buildModals()}</div><div class="toast"></div>`;
  } else if (S.loginMode === 'reset') {
    root.innerHTML = `<div class="login-wrap"><div class="notebook-cover"><form class="login-card" id="reset-form">
  <div class="login-mark"><span>CUADERNO DE NOTAS</span><span>NUEVA CLAVE</span></div>
  <h1 class="login-title">Nueva contraseña</h1>
  <p class="login-sub">Ingresá el código recibido por email para <strong>@${esc(S.verifyUser)}</strong>.</p>
  ${S.verifyNotice ? `<div class="login-success">${esc(S.verifyNotice)}</div>` : ''}
  <div class="field"><label for="rs-code">Código de recuperación</label><input id="rs-code" class="input" value="${esc(S.verifyCodeDemo || '')}" placeholder="XXXXXX" autofocus/></div>
  <div class="field"><label for="rs-pass">Nueva contraseña</label><input id="rs-pass" type="password" class="input" placeholder="••••••••"/></div>
  <div class="field"><label for="rs-pass2">Confirmar contraseña</label><input id="rs-pass2" type="password" class="input" placeholder="••••••••"/></div>
  <div class="login-error">${esc(err || '')}</div>
  <button class="btn-primary" type="submit">Actualizar contraseña</button>
  <button class="btn-ghost" type="button" data-action="switch-login" style="justify-content:center">Cancelar</button>
</form></div></div><div id="modal-wrap">${buildModals()}</div><div class="toast"></div>`;
  } else if (S.loginMode === 'registro') {
    root.innerHTML = `<div class="login-wrap"><div class="notebook-cover"><form class="login-card" id="registro-form">
  <div class="login-mark"><span>EX LIBRIS · APPNOTAS</span><span>NUEVO CUADERNO</span></div>
  <h1 class="login-title">Estrenar Cuaderno</h1>
  <p class="login-sub">Completá la etiqueta de portada para registrar tu cuaderno personal.</p>
  <div class="detail-edit-row">
    <div class="field"><label for="r-nombre">Nombre</label><input id="r-nombre" class="input" placeholder="Ignacio" autofocus/></div>
    <div class="field"><label for="r-apellido">Apellido</label><input id="r-apellido" class="input" placeholder="Scocco"/></div>
  </div>
  <div class="field"><label for="r-user">Nombre de Usuario *</label><input id="r-user" class="input" name="username" autocomplete="username" placeholder="nacho"/></div>
  <div class="field"><label for="r-email">Email *</label><input id="r-email" class="input" type="email" name="email" autocomplete="email" placeholder="mail@ejemplo.com"/></div>
  <div class="detail-edit-row">
    <div class="field"><label for="r-pass">Contraseña *</label><input id="r-pass" class="input" type="password" name="password" autocomplete="new-password" placeholder="••••••••"/></div>
    <div class="field"><label for="r-pass2">Repetir clave *</label><input id="r-pass2" class="input" type="password" name="password_conf" autocomplete="new-password" placeholder="••••••••"/></div>
  </div>
  <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink-2);cursor:pointer">
    <input id="r-terms" type="checkbox" required/>
    <span>Acepto los <button class="link-btn" type="button" data-action="open-terms">Términos y Condiciones de Uso</button></span>
  </label>
  <div class="login-error">${esc(err || '')}</div>
  <button class="btn-primary" type="submit">Registrar Cuaderno</button>
  <button class="btn-ghost" type="button" data-action="switch-login" style="justify-content:center">Ya tengo mi cuaderno</button>
</form></div></div><div id="modal-wrap">${buildModals()}</div><div class="toast"></div>`;
  } else {
    const successMsg = S.verifiedMessage;
    S.verifiedMessage = '';
    root.innerHTML = `<div class="login-wrap"><div class="notebook-cover"><form class="login-card" id="login-form">
  <div class="login-mark"><span>CUADERNO DE NOTAS</span><span>FOLIO 2026</span></div>
  <h1 class="login-title">AppNotas</h1>
  <p class="login-sub">Este cuaderno pertenece a:</p>
  ${successMsg ? `<div class="login-success">${esc(successMsg)}</div>` : ''}
  <div class="field"><label for="l-user">Usuario / Propietario</label><input id="l-user" class="input" name="username" autocomplete="username" placeholder="Ej: alicia, bruno o docente1" autofocus/></div>
  <div class="field"><label for="l-pass">Clave de acceso</label><input id="l-pass" class="input" type="password" name="password" autocomplete="current-password" placeholder="••••••••"/></div>
  <div style="display:flex;justify-content:flex-end;margin-top:-8px">
    <button class="link-btn" type="button" data-action="switch-forgot">¿Olvidaste tu clave?</button>
  </div>
  <div class="login-error">${esc(err || '')}</div>
  <button class="btn-primary" type="submit">Abrir Cuaderno</button>
  <button class="btn-ghost" type="button" data-action="switch-registro" style="justify-content:center">Estrenar un cuaderno nuevo</button>
</form></div></div><div id="modal-wrap">${buildModals()}</div><div class="toast"></div>`;
  }
}

function renderApp() {
  applyPrefs();
  const root = document.getElementById('root');
  root.innerHTML = `<div class="app">
  <div id="sidebar-wrap"></div>
  <section class="main">
    <div id="topbar-wrap" style="flex-shrink:0"></div>
    <div id="filters-wrap" style="flex-shrink:0"></div>
    <div id="qa-wrap" style="flex-shrink:0"></div>
    <div id="notes-body" style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column"></div>
  </section>
  <div id="detail-wrap"></div>
  <div id="modal-wrap"></div>
</div>
<div class="toast"></div>`;
  updateSidebar(); updateTopbar(); updateFilters(); updateQuickAdd(); updateNotesBody(); updateDetailPanel(); updateModals(); updateToast();
}

// ── Quick-add actions ──────────────────────────────────────────────
function syncQaInputs() {
  S.qaTitle = document.getElementById('qa-title')?.value ?? S.qaTitle;
  S.qaDesc  = document.getElementById('qa-desc')?.value  ?? S.qaDesc;
  S.qaCat   = document.getElementById('qa-cat')?.value   ?? S.qaCat;
  S.qaDue   = document.getElementById('qa-due')?.value   ?? S.qaDue;
  S.qaAsignado = document.getElementById('qa-asignado')?.value ?? S.qaAsignado;
}

function expandQuickAdd() {
  S.qaExpanded = true; updateQuickAdd();
  requestAnimationFrame(() => document.getElementById('qa-title')?.focus());
}

function collapseQuickAdd() {
  S.qaExpanded = false; S.qaTitle = ''; S.qaDesc = ''; S.qaPri = 'Media'; S.qaCat = 'Personal'; S.qaDue = ''; S.qaPinned = false;
  updateQuickAdd();
}

function setQaPri(pri) {
  syncQaInputs();
  S.qaPri = pri; updateQuickAdd();
  requestAnimationFrame(() => document.getElementById('qa-title')?.focus());
}

async function submitQuickAdd() {
  syncQaInputs();
  const title = S.qaTitle.trim();
  const desc = S.qaDesc.trim();
  if (!title) { showToast('Rellene este campo por favor: el título es obligatorio'); return; }
  const fileInput = document.getElementById('qa-file');
  const fileToAttach = fileInput?.files?.[0] || null;
  const isFam = S.scope === 'family' && S.grupoFamiliar;
  const payload = {
    titulo: title,
    descripcion: desc,
    prioridad: S.qaPri,
    categoria: S.qaCat || 'Personal',
    fecha_vencimiento: S.qaDue || null,
    fijada: S.qaPinned,
  };
  if (isFam) {
    payload.es_familiar = true;
    payload.asignado_a = S.qaAsignado || S.user;
  }
  collapseQuickAdd();
  await createNota(payload, fileToAttach);
}

// ── Event handlers ─────────────────────────────────────────────────
function handleClick(e) {
  let needTopbarUpdate = false;
  if (S.notifOpen && !e.target.closest('.notif-wrap')) {
    S.notifOpen = false;
    needTopbarUpdate = true;
  }
  if (S.settingsOpen && !e.target.closest('.settings-wrap')) {
    S.settingsOpen = false;
    needTopbarUpdate = true;
  }
  if (needTopbarUpdate) updateTopbar();

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.classList.contains('modal-overlay') && e.target !== btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;

  switch (action) {
    case 'toggle-personal-folder':
      S.personalCollapsed = !S.personalCollapsed;
      updateSidebar();
      break;
    case 'scope':
      S.scope = btn.dataset.scope;
      S.priorityFilter = null;
      S.qaExpanded = false;
      renderApp();
      break;
    case 'filter':
      S.priorityFilter = btn.dataset.priority || null;
      if (S.scope !== 'all' && S.scope !== 'family') S.scope = 'pending';
      renderApp();
      break;
    case 'filter-cat':
      S.categoryFilter = (S.categoryFilter === btn.dataset.cat) ? null : (btn.dataset.cat || null);
      renderApp();
      break;
    case 'fam-filter-member':
      S.familyMemberFilter = btn.dataset.member || '';
      updateNotesBody();
      break;
    case 'copy-fam-code':
      if (btn.dataset.code && navigator.clipboard) {
        navigator.clipboard.writeText(btn.dataset.code);
        showToast(`Código ${btn.dataset.code} copiado al portapapeles`);
      }
      break;
    case 'leave-family':
      if (confirm('¿Seguro que querés salir de este Grupo Familiar?')) {
        removerMiembroFamiliar(S.user);
      }
      break;
    case 'remove-fam-member':
      e.stopPropagation();
      if (btn.dataset.username && confirm(`¿Querés quitar a @${btn.dataset.username} del Grupo Familiar?`)) {
        removerMiembroFamiliar(btn.dataset.username);
      }
      break;
    case 'dissolve-family':
      if (confirm('¿Seguro que querés disolver el Grupo Familiar para todos sus integrantes?')) {
        disolverGrupoFamiliar();
      }
      break;
    case 'toggle-notifs':
      e.stopPropagation();
      S.notifOpen = !S.notifOpen;
      S.settingsOpen = false;
      updateTopbar();
      break;
    case 'toggle-settings':
      e.stopPropagation();
      S.settingsOpen = !S.settingsOpen;
      S.notifOpen = false;
      updateTopbar();
      break;
    case 'read-all-notifs':
      e.stopPropagation();
      marcarNotificacionesLeidas();
      break;
    case 'open-notif':
      e.stopPropagation();
      {
        const nId = btn.dataset.notifId ? parseInt(btn.dataset.notifId) : null;
        const notaId = btn.dataset.notaId ? parseInt(btn.dataset.notaId) : null;
        if (nId) marcarNotificacionesLeidas(nId);
        S.notifOpen = false;
        const targetNota = notaId ? findNotaById(notaId) : null;
        if (targetNota) {
          if (targetNota.grupo_id) S.scope = 'family';
          S.openId = notaId;
          renderApp();
        } else {
          updateTopbar();
        }
      }
      break;
    case 'open-nota':
      S.openId = parseInt(btn.dataset.id);
      S.editingNota = false;
      updateDetailPanel();
      break;
    case 'toggle':
      e.stopPropagation();
      toggleNota(id);
      break;
    case 'pin':
      e.stopPropagation();
      {
        const n = findNotaById(id);
        if (n) updateNota(id, { fijada: !n.fijada }, n.fijada ? 'Chincheta retirada' : 'Nota fijada arriba con chincheta');
      }
      break;
    case 'delete':
      e.stopPropagation();
      askDeleteNota(id, false);
      break;
    case 'delete-perm':
      e.stopPropagation();
      askDeleteNota(id, true);
      break;
    case 'confirm-delete-yes':
      executeDeleteNota(S.confirmTargetId, S.confirmPermanent);
      break;
    case 'ask-empty-trash':
      S.modal = 'confirm-empty-trash';
      updateModals();
      break;
    case 'confirm-empty-trash-yes':
      emptyTrash();
      break;
    case 'restore':
      e.stopPropagation();
      restoreNota(id);
      break;
    case 'close-detail':
      S.openId = null;
      S.editingNota = false;
      updateDetailPanel();
      break;
    case 'toggle-edit-nota':
      S.editingNota = !S.editingNota;
      updateDetailPanel();
      break;
    case 'sub-add':
      {
        const inp = document.getElementById('new-sub-input');
        const txt = (inp?.value || '').trim();
        if (!txt) return;
        const n = findNotaById(id);
        if (!n) return;
        const subs = [...(n.subtareas || [])];
        const nextSubId = subs.length ? Math.max(...subs.map(s => s.id || 0)) + 1 : 1;
        subs.push({ id: nextSubId, texto: txt, hecha: false });
        updateNota(id, { subtareas: subs }, null);
      }
      break;
    case 'sub-toggle':
      {
        const subId = parseInt(btn.dataset.subId);
        const n = findNotaById(id);
        if (!n) return;
        const subs = (n.subtareas || []).map(s => s.id === subId ? { ...s, hecha: !s.hecha } : s);
        updateNota(id, { subtareas: subs }, null);
      }
      break;
    case 'sub-del':
      {
        const subId = parseInt(btn.dataset.subId);
        const n = findNotaById(id);
        if (!n) return;
        const subs = (n.subtareas || []).filter(s => s.id !== subId);
        updateNota(id, { subtareas: subs }, null);
      }
      break;
    case 'att-del':
      deleteNotaAttachment(id, btn.dataset.filename);
      break;
    case 'open-profile':
      S.modal = 'profile';
      updateModals();
      break;
    case 'open-terms':
      S.modal = 'terms';
      updateModals();
      break;
    case 'close-modal':
      S.modal = null;
      updateModals();
      break;
    case 'logout':
      doLogout();
      break;
    case 'view':
      S.prefs.view = btn.dataset.view;
      savePrefs(); applyPrefs(); renderApp();
      break;
    case 'paper':
      S.prefs.paper = btn.dataset.paper;
      savePrefs(); applyPrefs(); updateTopbar();
      break;
    case 'set-hand':
      S.prefs.hand = btn.dataset.hand;
      savePrefs(); applyPrefs(); updateTopbar();
      break;
    case 'set-theme':
      S.prefs.theme = btn.dataset.theme;
      savePrefs(); applyPrefs(); updateTopbar();
      break;
    case 'toggle-hand':
      S.prefs.hand = S.prefs.hand === 'full' ? 'balanced' : 'full';
      savePrefs(); applyPrefs(); updateTopbar();
      showToast(S.prefs.hand === 'full' ? 'Tipografía: Full Manuscrita activada' : 'Tipografía: Modo Balanceado activado');
      break;
    case 'toggle-theme':
      S.prefs.theme = S.prefs.theme === 'dark' ? 'light' : 'dark';
      savePrefs(); applyPrefs(); updateTopbar();
      break;
    case 'qa-expand':
      expandQuickAdd();
      break;
    case 'qa-cancel':
      collapseQuickAdd();
      break;
    case 'qa-submit':
      submitQuickAdd();
      break;
    case 'qa-pri':
      setQaPri(btn.dataset.priority);
      break;
    case 'qa-toggle-pin':
      syncQaInputs();
      S.qaPinned = !S.qaPinned;
      updateQuickAdd();
      break;
    case 'toast-undo':
      if (S.toast?.undo) { S.toast.undo(); }
      S.toast = null; updateToast();
      break;
    case 'switch-registro': S.loginMode = 'registro'; renderLogin(); break;
    case 'switch-login':    S.loginMode = 'login';    renderLogin(); break;
    case 'switch-forgot':   S.loginMode = 'forgot';   renderLogin(); break;
    case 'resend-code':     doReenviarCodigo(); break;
  }
}

function handleChange(e) {
  if (e.target.id === 'admin-user-select') {
    S.adminUserFilter = e.target.value;
    loadNotas();
  } else if (e.target.dataset.action === 'fam-state-select') {
    const id = parseInt(e.target.dataset.id);
    const nuevoEstado = e.target.value;
    if (id && nuevoEstado) changeEstadoTarea(id, nuevoEstado);
  } else if (e.target.id === 'qa-file') {
    const f = e.target.files?.[0];
    const lbl = document.getElementById('qa-file-label');
    if (lbl) lbl.textContent = f ? f.name : 'Abrochar archivo';
  } else if (e.target.id === 'detail-file-input') {
    const f = e.target.files?.[0];
    const id = parseInt(e.target.dataset.id);
    if (f && id) uploadNotaAttachment(id, f);
  }
}

function handleInput(e) {
  const id = e.target.id;
  if (id === 'search-input') {
    S.query = e.target.value;
    updateNotesBody();
  } else if (id === 'qa-title') {
    S.qaTitle = e.target.value;
    const btn = document.querySelector('[data-action="qa-submit"]');
    if (btn) btn.disabled = !S.qaTitle.trim();
    const cnt = document.getElementById('qa-title-count');
    if (cnt) {
      cnt.textContent = `${S.qaTitle.length}/${MAX_TITLE}`;
      cnt.classList.toggle('warn', S.qaTitle.length >= MAX_TITLE);
    }
  } else if (id === 'qa-desc') {
    S.qaDesc = e.target.value;
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (S.settingsOpen) { S.settingsOpen = false; updateTopbar(); return; }
    if (S.notifOpen) { S.notifOpen = false; updateTopbar(); return; }
    if (S.modal) { S.modal = null; updateModals(); return; }
    if (S.qaExpanded) { collapseQuickAdd(); return; }
    if (S.editingNota) { S.editingNota = false; updateDetailPanel(); return; }
    if (S.openId) { S.openId = null; updateDetailPanel(); return; }
  }
  if (e.key === 'Enter' && e.target.id === 'new-sub-input') {
    e.preventDefault();
    const id = parseInt(e.target.dataset.notaId);
    const txt = e.target.value.trim();
    if (!txt || !id) return;
    const n = findNotaById(id);
    if (!n) return;
    const subs = [...(n.subtareas || [])];
    const nextSubId = subs.length ? Math.max(...subs.map(s => s.id || 0)) + 1 : 1;
    subs.push({ id: nextSubId, texto: txt, hecha: false });
    updateNota(id, { subtareas: subs }, null);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && S.qaExpanded) { submitQuickAdd(); return; }
  if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
    if ((S.scope === 'pending' || S.scope === 'family') && !S.qaExpanded && !S.modal) { e.preventDefault(); expandQuickAdd(); }
  }
}

function setFormSubmitting(form, submitting, loadingText, originalText) {
  const btn = form.querySelector('button[type="submit"]');
  const ghostBtn = form.querySelector('.btn-ghost');
  const inputs = form.querySelectorAll('input');

  if (submitting) {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span>${loadingText}`;
    }
    if (ghostBtn) {
      ghostBtn.disabled = true;
      ghostBtn.style.pointerEvents = 'none';
      ghostBtn.style.opacity = '0.5';
    }
    inputs.forEach(input => { input.disabled = true; });
  } else {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
    if (ghostBtn) {
      ghostBtn.disabled = false;
      ghostBtn.style.pointerEvents = '';
      ghostBtn.style.opacity = '';
    }
    inputs.forEach(input => { input.disabled = false; });
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  if (S.submitting) return;

  const form = e.target;

  if (form.id === 'create-family-form') {
    const nombre = form.querySelector('#fam-name-inp')?.value.trim();
    if (nombre) await crearGrupoFamiliar(nombre);
    return;
  }

  if (form.id === 'join-family-form') {
    const codigo = form.querySelector('#fam-code-inp')?.value.trim();
    if (codigo) await unirseGrupoFamiliar(codigo);
    return;
  }

  if (form.id === 'add-member-form') {
    const ident = form.querySelector('#add-member-inp')?.value.trim();
    if (ident) await agregarMiembroFamiliar(ident);
    return;
  }

  if (form.id === 'edit-nota-form') {
    const id = parseInt(form.dataset.id);
    const titulo = form.querySelector('#e-title').value.trim();
    const descripcion = form.querySelector('#e-desc').value.trim();
    const prioridad = form.querySelector('#e-pri').value;
    const categoria = form.querySelector('#e-cat').value;
    const fecha_vencimiento = form.querySelector('#e-due').value || null;
    const fijada = form.querySelector('#e-pin').checked;
    const asignadoEl = form.querySelector('#e-asignado');
    const payload = { titulo, descripcion, prioridad, categoria, fecha_vencimiento, fijada };
    if (asignadoEl) payload.asignado_a = asignadoEl.value;
    if (!titulo) { showToast('Error al modificar la nota: El título es obligatorio.'); return; }
    await updateNota(id, payload);
    return;
  }

  if (form.id === 'profile-form') {
    const nombre = form.querySelector('#p-nombre').value.trim();
    const apellido = form.querySelector('#p-apellido').value.trim();
    const email = form.querySelector('#p-email').value.trim();
    const current_password = form.querySelector('#p-curr-pw').value;
    const new_password = form.querySelector('#p-new-pw').value;
    const errEl = form.querySelector('#profile-err');
    const res = await apiFetch('PUT', '/auth/perfil', {
      nombre, apellido, email, current_password, new_password,
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      if (errEl) errEl.textContent = data.message || 'Error al actualizar perfil';
      return;
    }
    S.perfil = data.perfil;
    S.modal = null;
    updateAll();
    showToast('Ficha de perfil actualizada');
    return;
  }

  const setErr = msg => { const el = form.querySelector('.login-error'); if (el) el.textContent = msg; };

  if (form.id === 'login-form') {
    const user = form.querySelector('#l-user').value.trim();
    const pass = form.querySelector('#l-pass').value;
    if (!user || !pass) { setErr('Por favor, completá usuario y clave.'); return; }

    S.submitting = true;
    setFormSubmitting(form, true, 'Abriendo cuaderno...', 'Abrir Cuaderno');
    const err = await doLogin(user, pass);
    S.submitting = false;
    if (err) {
      setErr(err);
      setFormSubmitting(form, false, '', 'Abrir Cuaderno');
    }

  } else if (form.id === 'registro-form') {
    const nombre = form.querySelector('#r-nombre').value.trim();
    const apellido = form.querySelector('#r-apellido').value.trim();
    const user = form.querySelector('#r-user').value.trim();
    const email = form.querySelector('#r-email').value.trim();
    const pass = form.querySelector('#r-pass').value;
    const pass2 = form.querySelector('#r-pass2').value;
    if (!user || !email || !pass || !pass2) { setErr('Por favor, completá los campos obligatorios.'); return; }

    S.submitting = true;
    setFormSubmitting(form, true, 'Registrando...', 'Registrar Cuaderno');
    const err = await doRegistro(user, nombre, apellido, email, pass, pass2);
    S.submitting = false;
    if (err) {
      setErr(err);
      setFormSubmitting(form, false, '', 'Registrar Cuaderno');
    }

  } else if (form.id === 'verify-form') {
    const code = form.querySelector('#code').value.trim();
    if (!code) { setErr('Ingresá el código de verificación.'); return; }

    S.submitting = true;
    setFormSubmitting(form, true, 'Validando...', 'Abrir mi Cuaderno');
    const err = await doVerificar(code);
    S.submitting = false;
    if (err) {
      setErr(err);
      setFormSubmitting(form, false, '', 'Abrir mi Cuaderno');
    }

  } else if (form.id === 'forgot-form') {
    const ident = form.querySelector('#f-id').value.trim();
    if (!ident) { setErr('Ingresá tu usuario o email.'); return; }

    S.submitting = true;
    setFormSubmitting(form, true, 'Enviando...', 'Enviar código');
    const err = await doRecuperarPassword(ident);
    S.submitting = false;
    if (err) {
      setErr(err);
      setFormSubmitting(form, false, '', 'Enviar código');
    }

  } else if (form.id === 'reset-form') {
    const code = form.querySelector('#rs-code').value.trim();
    const pass = form.querySelector('#rs-pass').value;
    const pass2 = form.querySelector('#rs-pass2').value;
    if (!code || !pass || !pass2) { setErr('Completá todos los campos.'); return; }

    S.submitting = true;
    setFormSubmitting(form, true, 'Actualizando...', 'Actualizar contraseña');
    const err = await doResetPassword(S.verifyUser, code, pass, pass2);
    S.submitting = false;
    if (err) {
      setErr(err);
      setFormSubmitting(form, false, '', 'Actualizar contraseña');
    }
  }
}

// ── Init ───────────────────────────────────────────────────────────
function init() {
  applyPrefs();
  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('submit', handleSubmit);
  if (S.token) {
    loadNotas();
    loadPerfilAndAdmin();
  } else {
    render();
  }
}

init();
