'use strict';

// ── Constants ──────────────────────────────────────────────────────
const PRI = ['Urgente', 'Media', 'Baja'];
const PRI_CLASS = { Urgente: 'urgent', Media: 'media', Baja: 'baja' };

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

// ── SVG icons (inline strings) ─────────────────────────────────────
const ICO = {
  check11: `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5 L6.5 12 L13 4.5"/></svg>`,
  check13: `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5 L6.5 12 L13 4.5"/></svg>`,
  plus:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>`,
  search:  `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 L13.5 13.5"/></svg>`,
  trash:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10M6.5 4.5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8"/></svg>`,
  close:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4 L12 12 M12 4 L4 12"/></svg>`,
  restore: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a5 5 0 1 1 1.5 3.5"/><path d="M3 4v3h3"/></svg>`,
  inbox:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8.5 V13 a1 1 0 0 0 1 1 h9 a1 1 0 0 0 1-1 V8.5 L11 3.5 a1 1 0 0 0-.9-.5 H5.9 a1 1 0 0 0-.9.5 L2.5 8.5z"/><path d="M2.5 8.5h3 l1 2 h3 l1-2 h3"/></svg>`,
  done:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M5.5 8.2 L7.2 9.8 L10.5 6.5"/></svg>`,
  sun:     `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M11.5 3.5l-1 1M3.5 11.5l1-1"/></svg>`,
  moon:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 9.5a6 6 0 0 1-7-7 5.5 5.5 0 1 0 7 7z"/></svg>`,
  list:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 5h10M3 8h10M3 11h6"/></svg>`,
  kanban:  `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="3.5" height="10" rx="1"/><rect x="6.25" y="3" width="3.5" height="7" rx="1"/><rect x="10.5" y="3" width="3.5" height="5" rx="1"/></svg>`,
  grid:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>`,
};

// ── Prefs ──────────────────────────────────────────────────────────
const PREF_KEY = 'notas_prefs';
const PREF_DEF = { theme: 'dark', accent: 'warm', density: 'comfy', view: 'kanban' };

function loadPrefs() {
  try { return Object.assign({}, PREF_DEF, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); }
  catch { return Object.assign({}, PREF_DEF); }
}

function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(S.prefs)); } catch {}
}

function applyPrefs() {
  const h = document.documentElement;
  h.setAttribute('data-theme', S.prefs.theme);
  h.setAttribute('data-accent', S.prefs.accent);
  h.setAttribute('data-density', S.prefs.density);
}

// ── State ──────────────────────────────────────────────────────────
const S = {
  token: localStorage.getItem('notas_token'),
  user: localStorage.getItem('notas_user'),
  notas: [],
  scope: 'pending',
  priorityFilter: null,
  query: '',
  openId: null,
  loading: false,
  prefs: loadPrefs(),
  toast: null,
  toastTimer: null,
  qaExpanded: false,
  qaTitle: '',
  qaDesc: '',
  qaPri: 'Media',
  loginMode: 'login',
};

// ── API ────────────────────────────────────────────────────────────
async function apiFetch(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers['Authorization'] = 'Bearer ' + S.token;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const res = await fetch('/api/v1' + path, opts);
    if (res.status === 401) { doLogout(); return null; }
    return res;
  } catch {
    showToast('Error de red');
    return null;
  }
}

async function loadNotas() {
  S.loading = true;
  renderApp();
  const [r1, r2, r3] = await Promise.all([
    apiFetch('GET', '/grilla'),
    apiFetch('GET', '/grilla/completadas'),
    apiFetch('GET', '/grilla/archivadas'),
  ]);
  S.loading = false;
  if (!r1 || !r2 || !r3) { renderApp(); return; }
  const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
  S.notas = [...(d1.notas || []), ...(d2.notas || []), ...(d3.notas || [])];
  renderApp();
}

// ── Auth ───────────────────────────────────────────────────────────
async function doLogin(username, password) {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) return data.message || 'Credenciales inválidas';
  S.token = data.access_token;
  S.user = username;
  localStorage.setItem('notas_token', S.token);
  localStorage.setItem('notas_user', S.user);
  loadNotas();
  return null;
}

async function doRegistro(username, password) {
  const res = await fetch('/api/v1/auth/registro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) return data.message || 'Error al registrar';
  return doLogin(username, password);
}

function doLogout() {
  S.token = null; S.user = null; S.notas = []; S.loading = false;
  localStorage.removeItem('notas_token');
  localStorage.removeItem('notas_user');
  render();
}

// ── Toast ──────────────────────────────────────────────────────────
function showToast(msg, undoFn) {
  clearTimeout(S.toastTimer);
  S.toast = { msg, undo: undoFn };
  updateToast();
  S.toastTimer = setTimeout(() => { S.toast = null; updateToast(); }, 4500);
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
async function toggleNota(id) {
  const nota = S.notas.find(n => n.id === id);
  if (!nota) return;
  const prev = nota.completada;
  const prevMod = nota.fecha_modificacion;
  nota.completada = !prev;
  nota.fecha_modificacion = new Date().toISOString();
  updateAll();
  showToast(prev ? 'Reabierta' : 'Completada', () => {
    nota.completada = prev; nota.fecha_modificacion = prevMod; updateAll();
  });
  const res = await apiFetch('PUT', `/grilla/${id}/completar`, { completada: !prev });
  if (!res || !res.ok) {
    nota.completada = prev; nota.fecha_modificacion = prevMod; updateAll(); showToast('Error al actualizar');
  }
}

async function deleteNota(id) {
  const nota = S.notas.find(n => n.id === id);
  if (!nota) return;
  const prev = nota.fecha_baja;
  nota.fecha_baja = new Date().toISOString();
  if (S.openId === id) S.openId = null;
  updateAll();
  showToast('Eliminada', () => { nota.fecha_baja = prev; updateAll(); });
  const res = await apiFetch('DELETE', `/grilla/${id}`);
  if (!res || !res.ok) { nota.fecha_baja = prev; updateAll(); showToast('Error al eliminar'); }
}

async function restoreNota(id) {
  const nota = S.notas.find(n => n.id === id);
  if (!nota) return;
  const prev = nota.fecha_baja;
  nota.fecha_baja = null;
  if (S.openId === id) S.openId = null;
  updateAll();
  showToast('Restaurada', () => { nota.fecha_baja = prev; updateAll(); });
  const res = await apiFetch('POST', `/grilla/${id}/restaurar`);
  if (!res || !res.ok) { nota.fecha_baja = prev; updateAll(); showToast('Error al restaurar'); }
}

async function createNota(titulo, descripcion, prioridad) {
  const res = await apiFetch('POST', '/grilla', { titulo, descripcion, prioridad });
  if (!res || !res.ok) { showToast('Error al crear la nota'); return; }
  await loadNotas();
  showToast('Nota creada');
}

// ── Computed ───────────────────────────────────────────────────────
function getFiltered() {
  const mine = S.notas.filter(n => n.usuario === S.user);
  let base;
  if (S.scope === 'completed') base = mine.filter(n => !n.fecha_baja && n.completada);
  else if (S.scope === 'archived') base = mine.filter(n => !!n.fecha_baja);
  else base = mine.filter(n => !n.fecha_baja && !n.completada);

  if (S.priorityFilter && S.scope === 'pending') base = base.filter(n => n.prioridad === S.priorityFilter);
  if (S.query.trim()) {
    const q = S.query.toLowerCase();
    base = base.filter(n => n.titulo.toLowerCase().includes(q) || (n.descripcion || '').toLowerCase().includes(q));
  }
  return [...base].sort((a, b) => {
    if (S.scope === 'pending') {
      const pa = PRI.indexOf(a.prioridad), pb = PRI.indexOf(b.prioridad);
      if (pa !== pb) return pa - pb;
    }
    return new Date(b.fecha_modificacion || b.fecha_creacion) - new Date(a.fecha_modificacion || a.fecha_creacion);
  });
}

function getCounts() {
  const mine = S.notas.filter(n => n.usuario === S.user);
  const pend = mine.filter(n => !n.fecha_baja && !n.completada);
  return {
    pending: pend.length,
    completed: mine.filter(n => !n.fecha_baja && n.completada).length,
    archived: mine.filter(n => !!n.fecha_baja).length,
    Urgente: pend.filter(n => n.prioridad === 'Urgente').length,
    Media:   pend.filter(n => n.prioridad === 'Media').length,
    Baja:    pend.filter(n => n.prioridad === 'Baja').length,
  };
}

// ── HTML builders ──────────────────────────────────────────────────
function buildSidebar() {
  const c = getCounts();
  const s = S.scope, pf = S.priorityFilter;
  return `<nav class="sidebar">
  <div class="brand">Notas</div>
  <div class="side-section">Bandeja</div>
  <div class="side-item${s === 'pending' && !pf ? ' active' : ''}" data-action="scope" data-scope="pending">${ICO.inbox}<span>Pendientes</span><span class="count">${c.pending}</span></div>
  <div class="side-item${s === 'completed' ? ' active' : ''}" data-action="scope" data-scope="completed">${ICO.done}<span>Completadas</span><span class="count">${c.completed}</span></div>
  <div class="side-item${s === 'archived' ? ' active' : ''}" data-action="scope" data-scope="archived">${ICO.trash}<span>Papelera</span><span class="count">${c.archived}</span></div>
  <div class="side-section">Prioridad</div>
  ${PRI.map(p => `<div class="side-item${s === 'pending' && pf === p ? ' active' : ''}" data-action="filter" data-priority="${p}"><span class="side-dot ${PRI_CLASS[p]}"></span><span>${p}</span><span class="count">${c[p]}</span></div>`).join('')}
  <div style="flex:1"></div>
  <div class="side-user">
    <div class="avatar">${esc((S.user || '?')[0].toUpperCase())}</div>
    <span>${esc(S.user || '')}</span>
    <span class="logout" data-action="logout">salir</span>
  </div>
</nav>`;
}

function buildTopbar(sorted) {
  const title = S.scope === 'completed' ? 'Completadas' : S.scope === 'archived' ? 'Papelera' : S.priorityFilter || 'Pendientes';
  const v = S.prefs.view;
  return `<header class="topbar">
  <h1>${esc(title)}</h1>
  <span class="meta">${sorted.length} ${sorted.length === 1 ? 'nota' : 'notas'}</span>
  <div class="spacer"></div>
  <div class="view-btns">
    <button class="icon-btn${v === 'list' ? ' active-view' : ''}" data-action="view" data-view="list" title="Lista" type="button">${ICO.list}</button>
    <button class="icon-btn${v === 'kanban' ? ' active-view' : ''}" data-action="view" data-view="kanban" title="Kanban" type="button">${ICO.kanban}</button>
    <button class="icon-btn${v === 'cards' ? ' active-view' : ''}" data-action="view" data-view="cards" title="Tarjetas" type="button">${ICO.grid}</button>
  </div>
  <button class="icon-btn" data-action="toggle-theme" title="${S.prefs.theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}" type="button">${S.prefs.theme === 'dark' ? ICO.sun : ICO.moon}</button>
  <div class="search">${ICO.search}<input id="search-input" value="${esc(S.query)}" placeholder="Buscar…" autocomplete="off"/></div>
</header>`;
}

function buildFilters() {
  if (S.scope !== 'pending' || S.prefs.view === 'kanban') return '';
  const c = getCounts(), pf = S.priorityFilter;
  return `<div class="filters">
  <button class="chip${!pf ? ' active' : ''}" data-action="filter" data-priority="" type="button">Todas <span class="count">${c.pending}</span></button>
  ${PRI.map(p => `<button class="chip pri-${PRI_CLASS[p]}${pf === p ? ' active' : ''}" data-action="filter" data-priority="${p}" type="button"><span class="dot ${PRI_CLASS[p]}"></span>${p}<span class="count">${c[p]}</span></button>`).join('')}
</div>`;
}

function buildQuickAdd() {
  if (S.scope !== 'pending') return '';
  if (!S.qaExpanded) {
    return `<div class="quick-add" data-action="qa-expand" role="button" tabindex="0">${ICO.plus}<span>Agregar una nota…</span><span style="margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--fg-4)">N</span></div>`;
  }
  return `<div class="quick-add expanded">
  <div class="qa-row"><input id="qa-title" class="qa-title" value="${esc(S.qaTitle)}" placeholder="¿Qué tenés que hacer?"/></div>
  <textarea id="qa-desc" class="qa-desc" rows="2" placeholder="Notas, detalles, enlaces…">${esc(S.qaDesc)}</textarea>
  <div class="qa-actions">
    <div class="priority-select">${PRI.map(p => `<button class="pri-${PRI_CLASS[p]}${S.qaPri === p ? ' active' : ''}" data-action="qa-pri" data-priority="${p}" type="button"><span class="pdot ${PRI_CLASS[p]}"></span>${p}</button>`).join('')}</div>
    <div class="spacer"></div>
    <button class="btn-ghost" data-action="qa-cancel" type="button">Cancelar</button>
    <button class="btn-primary" data-action="qa-submit" type="button"${!S.qaTitle.trim() ? ' disabled' : ''}>Agregar nota</button>
  </div>
</div>`;
}

function buildNoteRow(n, archivado) {
  const pc = PRI_CLASS[n.prioridad] || '';
  return `<div class="note-row${n.completada ? ' done' : ''}" data-action="open-nota" data-id="${n.id}">
  <button class="check" data-action="toggle" data-id="${n.id}" type="button" aria-label="${n.completada ? 'Marcar pendiente' : 'Marcar completada'}">${n.completada ? ICO.check11 : ''}</button>
  <div class="body">
    <div class="title"><span class="pdot ${pc}"></span><span>${esc(n.titulo)}</span></div>
    ${n.descripcion ? `<div class="desc">${esc(n.descripcion)}</div>` : ''}
  </div>
  <div class="meta">${relTime(n.fecha_modificacion || n.fecha_creacion)}</div>
  <div class="actions">${archivado
    ? `<button class="icon-btn" data-action="restore" data-id="${n.id}" title="Restaurar" type="button">${ICO.restore}</button>`
    : `<button class="icon-btn danger" data-action="delete" data-id="${n.id}" title="Eliminar" type="button">${ICO.trash}</button>`
  }</div>
</div>`;
}

function buildListView(sorted, archivado) {
  if (!sorted.length) {
    const m = { completed: ['Sin notas completadas', 'Acá van a aparecer las notas que marques como hechas.'], archived: ['Papelera vacía', 'Las notas que elimines aparecen acá por si querés restaurarlas.'], pending: ['Todo al día', 'No hay notas pendientes. Buen momento para crear una nueva.'] };
    const [h, p] = m[S.scope] || m.pending;
    return `<div class="empty"><div class="e-glyph">${ICO.inbox}</div><h3>${h}</h3><p>${p}</p></div>`;
  }
  if (S.scope === 'pending') {
    const groups = {}; PRI.forEach(p => { groups[p] = []; }); sorted.forEach(n => groups[n.prioridad]?.push(n));
    return `<div class="notes-list">${PRI.map(p => !groups[p].length ? '' : `
  <div class="list-section"><span style="width:6px;height:6px;border-radius:50%;background:var(--${PRI_CLASS[p]});flex-shrink:0;display:inline-block;margin-right:2px"></span><span>${p}</span><span class="line"></span><span style="color:var(--fg-4)">${groups[p].length}</span></div>
  ${groups[p].map(n => buildNoteRow(n, archivado)).join('')}`).join('')}</div>`;
  }
  return `<div class="notes-list">${sorted.map(n => buildNoteRow(n, archivado)).join('')}</div>`;
}

function buildKanbanView(sorted) {
  const groups = {}; PRI.forEach(p => { groups[p] = []; }); sorted.forEach(n => groups[n.prioridad]?.push(n));
  return `<div class="kanban">${PRI.map(p => `
<div class="kanban-col col-${PRI_CLASS[p]}">
  <h3><span class="pdot ${PRI_CLASS[p]}"></span><span>${p}</span><span class="count">${groups[p].length}</span></h3>
  <div class="kanban-list">${!groups[p].length
    ? `<div style="font-size:12px;color:var(--fg-4);padding:12px 4px">—</div>`
    : groups[p].map(n => `<div class="k-card${n.completada ? ' done' : ''}" data-action="open-nota" data-id="${n.id}">
    <div class="title">${esc(n.titulo)}</div>
    ${n.descripcion ? `<div class="desc">${esc(n.descripcion)}</div>` : ''}
    <div class="foot"><span class="meta">${relTime(n.fecha_modificacion || n.fecha_creacion)}</span><span class="spacer"></span><div class="actions">
      <button class="icon-btn" data-action="toggle" data-id="${n.id}" title="${n.completada ? 'Marcar pendiente' : 'Completar'}" type="button">${ICO.check13}</button>
      <button class="icon-btn danger" data-action="delete" data-id="${n.id}" title="Eliminar" type="button">${ICO.trash}</button>
    </div></div>
  </div>`).join('')
  }</div>
</div>`).join('')}</div>`;
}

function buildGalleryView(sorted, archivado) {
  if (!sorted.length) return `<div class="empty"><div class="e-glyph">${ICO.inbox}</div><h3>Sin notas</h3><p>No hay nada que mostrar acá.</p></div>`;
  return `<div class="gallery">${sorted.map(n => `
<div class="g-card pri-${PRI_CLASS[n.prioridad]}${n.completada ? ' done' : ''}" data-action="open-nota" data-id="${n.id}">
  <div class="head">
    <span class="pdot ${PRI_CLASS[n.prioridad]}"></span>
    <span class="ptag ${PRI_CLASS[n.prioridad]}">${n.prioridad}</span>
    <span class="spacer"></span>
    <button class="check" data-action="toggle" data-id="${n.id}" type="button">${n.completada ? ICO.check11 : ''}</button>
  </div>
  <div class="title">${esc(n.titulo)}</div>
  ${n.descripcion ? `<div class="desc">${esc(n.descripcion)}</div>` : ''}
  <div class="foot"><span>${relTime(n.fecha_modificacion || n.fecha_creacion)}</span><div class="actions">
    ${archivado
      ? `<button class="icon-btn" data-action="restore" data-id="${n.id}" type="button">${ICO.restore}</button>`
      : `<button class="icon-btn danger" data-action="delete" data-id="${n.id}" type="button">${ICO.trash}</button>`}
  </div></div>
</div>`).join('')}</div>`;
}

function buildNotesBody() {
  if (S.loading) return buildSkeleton();
  const sorted = getFiltered();
  const archivado = S.scope === 'archived';
  if (S.prefs.view === 'kanban' && S.scope === 'pending') return buildKanbanView(sorted);
  if (S.prefs.view === 'cards') return buildGalleryView(sorted, archivado);
  return buildListView(sorted, archivado);
}

function buildSkeleton() {
  return `<div class="notes-list">${Array(4).fill('').map(() => `
<div class="note-row" style="pointer-events:none;opacity:0.3">
  <div style="width:18px;height:18px;border-radius:50%;background:var(--border)"></div>
  <div class="body">
    <div style="height:13px;background:var(--border);border-radius:4px;width:38%;margin-bottom:6px"></div>
    <div style="height:11px;background:var(--border);border-radius:4px;width:56%"></div>
  </div>
</div>`).join('')}</div>`;
}

function buildDetailPanel() {
  const nota = S.openId ? S.notas.find(n => n.id === S.openId) : null;
  const archivado = nota && !!nota.fecha_baja;
  return `<div class="detail-overlay${nota ? ' open' : ''}" data-action="close-detail"></div>
<aside class="detail-panel${nota ? ' open' : ''}">
  ${nota ? `<div class="detail-head">
    <button class="icon-btn" data-action="close-detail" type="button">${ICO.close}</button>
    <div class="spacer"></div>
    ${archivado
      ? `<button class="btn-ghost" data-action="restore" data-id="${nota.id}" type="button">${ICO.restore} Restaurar</button>`
      : `<button class="btn-ghost" data-action="toggle" data-id="${nota.id}" type="button">${ICO.check13} ${nota.completada ? 'Reabrir' : 'Completar'}</button>
         <button class="btn-ghost" data-action="delete" data-id="${nota.id}" type="button" style="color:var(--urgent)">${ICO.trash}</button>`}
  </div>
  <div class="detail-body">
    <div class="detail-pill pri-${PRI_CLASS[nota.prioridad]}">
      <span class="pdot ${PRI_CLASS[nota.prioridad]}"></span><span>${nota.prioridad}</span>${nota.completada ? '<span style="margin-left:10px">· Completada</span>' : ''}
    </div>
    <h2 class="detail-title">${esc(nota.titulo)}</h2>
    <div class="detail-desc${nota.descripcion ? '' : ' empty-d'}">${nota.descripcion ? esc(nota.descripcion) : 'Sin descripción.'}</div>
    <dl class="detail-meta">
      <dt>Creada</dt><dd>${fullDate(nota.fecha_creacion)}</dd>
      <dt>Editada</dt><dd>${fullDate(nota.fecha_modificacion)}</dd>
      ${nota.fecha_baja ? `<dt>Eliminada</dt><dd>${fullDate(nota.fecha_baja)}</dd>` : ''}
      <dt>Autor</dt><dd>${esc(nota.usuario)}</dd>
      <dt>Estado</dt><dd>${nota.fecha_baja ? 'Archivada' : nota.completada ? 'Completada' : 'Pendiente'}</dd>
    </dl>
  </div>` : ''}
</aside>`;
}

// ── Partial updates ────────────────────────────────────────────────
function updateSidebar() { const e = document.getElementById('sidebar-wrap'); if (e) e.innerHTML = buildSidebar(); }
function updateTopbar()  { const e = document.getElementById('topbar-wrap');  if (e) e.innerHTML = buildTopbar(getFiltered()); }
function updateFilters() { const e = document.getElementById('filters-wrap'); if (e) e.innerHTML = buildFilters(); }
function updateQuickAdd(){ const e = document.getElementById('qa-wrap');      if (e) e.innerHTML = buildQuickAdd(); }
function updateNotesBody(){ const e = document.getElementById('notes-body');  if (e) e.innerHTML = buildNotesBody(); }
function updateDetailPanel(){ const e = document.getElementById('detail-wrap'); if (e) e.innerHTML = buildDetailPanel(); }

function updateAll() {
  updateSidebar(); updateTopbar(); updateFilters(); updateNotesBody(); updateDetailPanel();
}

// ── Render ─────────────────────────────────────────────────────────
function render() {
  applyPrefs();
  if (!S.token) renderLogin(); else renderApp();
}

function renderLogin(err) {
  const root = document.getElementById('root');
  if (S.loginMode === 'registro') {
    root.innerHTML = `<div class="login-wrap"><form class="login-card" id="registro-form">
  <div class="login-mark">Notas</div>
  <h1 class="login-title">Crear cuenta</h1>
  <p class="login-sub">Elegí un usuario y contraseña.</p>
  <div class="field"><label for="r-user">Usuario</label><input id="r-user" class="input" name="username" autocomplete="username" placeholder="nacho" autofocus/></div>
  <div class="field"><label for="r-pass">Contraseña</label><input id="r-pass" class="input" type="password" name="password" autocomplete="new-password" placeholder="••••••••"/></div>
  <div class="login-error">${esc(err || '')}</div>
  <button class="btn-primary" type="submit">Registrarse</button>
  <button class="btn-ghost" type="button" data-action="switch-login" style="justify-content:center">Ya tengo cuenta</button>
</form></div><div class="toast"></div>`;
  } else {
    root.innerHTML = `<div class="login-wrap"><form class="login-card" id="login-form">
  <div class="login-mark">Notas</div>
  <h1 class="login-title">Hola de nuevo.</h1>
  <p class="login-sub">Ingresá para ver tus notas.</p>
  <div class="field"><label for="l-user">Usuario</label><input id="l-user" class="input" name="username" autocomplete="username" placeholder="nacho" autofocus/></div>
  <div class="field"><label for="l-pass">Contraseña</label><input id="l-pass" class="input" type="password" name="password" autocomplete="current-password" placeholder="••••••••"/></div>
  <div class="login-error">${esc(err || '')}</div>
  <button class="btn-primary" type="submit">Ingresar</button>
  <button class="btn-ghost" type="button" data-action="switch-registro" style="justify-content:center">Crear cuenta</button>
</form></div><div class="toast"></div>`;
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
</div>
<div class="toast"></div>`;
  updateSidebar(); updateTopbar(); updateFilters(); updateQuickAdd(); updateNotesBody(); updateDetailPanel(); updateToast();
}

// ── Quick-add actions ──────────────────────────────────────────────
function expandQuickAdd() {
  S.qaExpanded = true; updateQuickAdd();
  requestAnimationFrame(() => document.getElementById('qa-title')?.focus());
}

function collapseQuickAdd() {
  S.qaExpanded = false; S.qaTitle = ''; S.qaDesc = ''; S.qaPri = 'Media'; updateQuickAdd();
}

function setQaPri(pri) {
  S.qaTitle = document.getElementById('qa-title')?.value ?? S.qaTitle;
  S.qaDesc  = document.getElementById('qa-desc')?.value  ?? S.qaDesc;
  S.qaPri = pri; updateQuickAdd();
  requestAnimationFrame(() => document.getElementById('qa-title')?.focus());
}

async function submitQuickAdd() {
  S.qaTitle = (document.getElementById('qa-title')?.value ?? S.qaTitle).trim();
  S.qaDesc  = (document.getElementById('qa-desc')?.value  ?? S.qaDesc).trim();
  if (!S.qaTitle) { collapseQuickAdd(); return; }
  const t = S.qaTitle, d = S.qaDesc, p = S.qaPri;
  collapseQuickAdd();
  await createNota(t, d, p);
}

// ── Event handlers ─────────────────────────────────────────────────
function handleClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;

  switch (action) {
    case 'scope':         S.scope = btn.dataset.scope; S.priorityFilter = null; S.qaExpanded = false; renderApp(); break;
    case 'filter':        S.priorityFilter = btn.dataset.priority || null; S.scope = 'pending'; renderApp(); break;
    case 'open-nota':     S.openId = parseInt(btn.dataset.id); updateDetailPanel(); break;
    case 'toggle':        e.stopPropagation(); toggleNota(id); break;
    case 'delete':        e.stopPropagation(); deleteNota(id); break;
    case 'restore':       e.stopPropagation(); restoreNota(id); break;
    case 'close-detail':  S.openId = null; updateDetailPanel(); break;
    case 'logout':        doLogout(); break;
    case 'view':          S.prefs.view = btn.dataset.view; savePrefs(); applyPrefs(); renderApp(); break;
    case 'toggle-theme':  S.prefs.theme = S.prefs.theme === 'dark' ? 'light' : 'dark'; savePrefs(); applyPrefs(); updateTopbar(); break;
    case 'qa-expand':     expandQuickAdd(); break;
    case 'qa-cancel':     collapseQuickAdd(); break;
    case 'qa-submit':     submitQuickAdd(); break;
    case 'qa-pri':        setQaPri(btn.dataset.priority); break;
    case 'toast-undo':    if (S.toast?.undo) { S.toast.undo(); } S.toast = null; updateToast(); break;
    case 'switch-registro': S.loginMode = 'registro'; renderLogin(); break;
    case 'switch-login':    S.loginMode = 'login';    renderLogin(); break;
  }
}

function handleInput(e) {
  const id = e.target.id;
  if (id === 'search-input') {
    S.query = e.target.value;
    updateNotesBody();
    updateTopbar();
  } else if (id === 'qa-title') {
    S.qaTitle = e.target.value;
    const btn = document.querySelector('[data-action="qa-submit"]');
    if (btn) btn.disabled = !S.qaTitle.trim();
  } else if (id === 'qa-desc') {
    S.qaDesc = e.target.value;
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (S.qaExpanded) { collapseQuickAdd(); return; }
    if (S.openId) { S.openId = null; updateDetailPanel(); return; }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && S.qaExpanded) { submitQuickAdd(); return; }
  if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return;
    if (S.scope === 'pending' && !S.qaExpanded) { e.preventDefault(); expandQuickAdd(); }
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const setErr = msg => { const el = document.querySelector('.login-error'); if (el) el.textContent = msg; };

  if (form.id === 'login-form') {
    const user = form.querySelector('#l-user').value.trim();
    const pass = form.querySelector('#l-pass').value;
    if (!user || !pass) { setErr('Ingresá usuario y contraseña.'); return; }
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Ingresando…'; }
    const err = await doLogin(user, pass);
    if (err) { setErr(err); if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Ingresar'; } }

  } else if (form.id === 'registro-form') {
    const user = form.querySelector('#r-user').value.trim();
    const pass = form.querySelector('#r-pass').value;
    if (!user || !pass) { setErr('Ingresá usuario y contraseña.'); return; }
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Registrando…'; }
    const err = await doRegistro(user, pass);
    if (err) { setErr(err); if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Registrarse'; } }
  }
}

// ── Init ───────────────────────────────────────────────────────────
function init() {
  applyPrefs();
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('submit', handleSubmit);
  if (S.token) loadNotas();
  else render();
}

init();
