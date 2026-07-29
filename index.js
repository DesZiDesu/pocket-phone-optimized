// pocket-phone/index.js — Stage 1b: shell fixes (dvh · island · svg icons · glass)
// getContext ล้วน · ไม่มี import/export · lazy + try/catch

const PP_VERSION = '0.1.2-stage1';
const MODULE_NAME = 'pocket-phone'; // ⚠️ ต้องตรงกับชื่อโฟลเดอร์/repo

function ctx() {
    try { return SillyTavern.getContext(); } catch { return null; }
}

// ── store: config เล็ก + mirror localStorage ──
const DEFAULTS = { theme: 'dark', accent: '#0a84ff', dynamicIsland: true };
const LS_MIRROR = 'pp_cfg_mirror';

function getCfg() {
    const c = ctx();
    let cfg;
    if (c && c.extensionSettings) {
        if (!c.extensionSettings[MODULE_NAME]) c.extensionSettings[MODULE_NAME] = {};
        cfg = c.extensionSettings[MODULE_NAME];
    } else {
        try { cfg = JSON.parse(localStorage.getItem(LS_MIRROR) || '{}'); } catch { cfg = {}; }
    }
    for (const k of Object.keys(DEFAULTS)) if (cfg[k] === undefined) cfg[k] = DEFAULTS[k];
    return cfg;
}
function saveCfg() {
    const c = ctx(), cfg = getCfg();
    try { localStorage.setItem(LS_MIRROR, JSON.stringify(cfg)); } catch {}
    try { if (c && typeof c.saveSettingsDebounced === 'function') c.saveSettingsDebounced(); } catch {}
}

// ── เวลาจริง ──
function ppNow() {
    const d = new Date();
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function ppDateLabel() {
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}
let ppClockTimer = null;
function startClock() {
    if (ppClockTimer) return;
    const tick = () => {
        const t = ppNow();
        document.querySelectorAll('.pp-clock').forEach(e => e.textContent = t);
        const dl = document.getElementById('pp-home-date');
        if (dl) dl.textContent = ppDateLabel();
    };
    tick();
    ppClockTimer = setInterval(tick, 10000);
}

// ── open / close ──
function ppOpen() {
    const dlg = document.getElementById('pp-dialog');
    if (!dlg) return;
    applyTheme(); applyIsland(); startClock();
    if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
    else dlg.setAttribute('open', '');
}

function ppClose() {
    const dlg = document.getElementById('pp-dialog');
    if (!dlg) return;
    try { document.activeElement?.blur(); } catch {}
    if (dlg.open && typeof dlg.close === 'function') {
        dlg.close();          // ปิดแบบถูกวิธี = ออกจาก top layer + เก็บ backdrop ทิ้งเอง
    } else {
        dlg.removeAttribute('open'); // ใช้เฉพาะเบราว์เซอร์เก่าที่ไม่มี showModal
    }
}


function applyTheme() {
    const frame = document.getElementById('pp-frame');
    if (!frame) return;
    const cfg = getCfg();
    frame.classList.toggle('light', cfg.theme === 'light');
    frame.style.setProperty('--pp-accent', cfg.accent || '#0a84ff');
}
function applyIsland() {
    const island = document.getElementById('pp-island');
    if (island) island.style.display = getCfg().dynamicIsland ? 'flex' : 'none';
}

// ── router ──
function ppNav(screen) {
    document.querySelectorAll('.pp-screen').forEach(s => s.classList.remove('show'));
    const home = document.getElementById('pp-home');
    if (screen === 'home') { if (home) home.classList.add('show'); return; }
    const el = document.getElementById('pp-scr-' + screen);
    if (el) el.classList.add('show');
    else { if (home) home.classList.add('show'); ppToast('เร็ว ๆ นี้: ' + screen); }
}

function ppToast(msg) {
    const t = document.getElementById('pp-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ── SVG glyphs (iOS-ish, ไม่มีอิโมจิ) ──
const ICON = {
    story: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 6.2C10.5 5 8.4 4.5 6 4.5c-.8 0-1.5.6-1.5 1.4v11c0 .8.7 1.4 1.5 1.4 2.1 0 4 .5 5.3 1.5.4.3 1 .3 1.4 0 1.3-1 3.2-1.5 5.3-1.5.8 0 1.5-.6 1.5-1.4v-11c0-.8-.7-1.4-1.5-1.4-2.4 0-4.5.5-6 1.7zm0 0v12" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    messages: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 3C6.9 3 3 6.6 3 11c0 2.3 1.1 4.4 2.9 5.8-.2 1.3-.8 2.5-1.6 3.4-.2.2 0 .6.3.5 1.9-.3 3.4-1 4.4-1.6 1 .3 2 .4 3 .4 5.1 0 9-3.6 9-8s-3.9-8-9-8z"/></svg>`,
    feed: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
    wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18" stroke-width="1.8"/><circle cx="17" cy="14.5" r="1.1" fill="#fff" stroke="none"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.49.49 0 0 0 13.5 2h-3c-.24 0-.44.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94L2.86 14.52a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.03.24.23.41.47.41h3c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>`,
    signal: `<svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.5" width="3" height="6.5" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></svg>`,
    wifi: `<svg viewBox="0 0 24 18" fill="currentColor"><path d="M12 3C8 3 4.4 4.6 1.8 7.2l1.8 1.8C5.8 6.8 8.7 5.5 12 5.5s6.2 1.3 8.4 3.5l1.8-1.8C19.6 4.6 16 3 12 3zm0 6c-2 0-3.8.8-5.1 2.1l1.8 1.8C9.5 12.1 10.7 11.5 12 11.5s2.5.6 3.3 1.4l1.8-1.8A7.2 7.2 0 0 0 12 9zm0 5.5-2.1 2.1c.6.6 1.4.9 2.1.9s1.5-.3 2.1-.9L12 14.5z"/></svg>`,
    battery: `<svg viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor"/><rect x="23" y="4" width="1.8" height="4" rx=".9" fill="currentColor" fill-opacity=".4"/></svg>`,
};

const APPS = [
    { nav: 'story', label: 'Story', tint: 'linear-gradient(160deg,#5e5ce6,#3a38b0)', icon: ICON.story },
    { nav: 'messages', label: 'Messages', tint: 'linear-gradient(160deg,#34c759,#22913e)', icon: ICON.messages },
    { nav: 'feed', label: 'Feed', tint: 'linear-gradient(160deg,#2b2b2e,#0c0c0d)', icon: ICON.feed },
    { nav: 'wallet', label: 'Wallet', tint: 'linear-gradient(160deg,#ff9f0a,#d17400)', icon: ICON.wallet },
    { nav: 'settings', label: 'Settings', tint: 'linear-gradient(160deg,#9a9aa0,#5a5a5e)', icon: ICON.settings },
];

// ── HTML ──
function buildPhone() {
    const grid = APPS.map(a =>
        `<button class="pp-app" data-nav="${a.nav}">
            <span class="pp-icon" style="background:${a.tint}">${a.icon}</span>
            <span class="pp-label">${a.label}</span>
        </button>`).join('');
    return `
<dialog id="pp-dialog">
  <div id="pp-frame" class="dark">
    <div id="pp-statusbar">
      <span class="pp-sb-left pp-clock">9:41</span>
      <div id="pp-island"></div>
      <span class="pp-sb-right">
        ${ICON.signal}${ICON.wifi}${ICON.battery}
        <button id="pp-close-btn" title="Close">✕</button>
      </span>
    </div>

    <div id="pp-screens">
      <div class="pp-screen show" id="pp-home">
        <div class="pp-home-clock pp-clock">9:41</div>
        <div id="pp-home-date">Saturday, May 17</div>
        <div style="flex:1"></div>
        <div class="pp-grid">${grid}</div>
        <div class="pp-home-bar"></div>
      </div>
    </div>

    <div id="pp-toast"></div>
  </div>
</dialog>`;
}

function injectPhone() {
    if (document.getElementById('pp-dialog')) return;
    const holder = document.createElement('div');
    holder.innerHTML = buildPhone();
    document.body.appendChild(holder.firstElementChild);

    document.getElementById('pp-close-btn')?.addEventListener('click', ppClose);
    document.querySelectorAll('#pp-frame .pp-app').forEach(btn =>
        btn.addEventListener('click', () => ppNav(btn.dataset.nav)));
    document.getElementById('pp-dialog')?.addEventListener('click', e => {
        if (e.target.id === 'pp-dialog') ppClose();
    });
}

function injectFab() {
    if (document.getElementById('pp-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'pp-fab';
    fab.textContent = '📱';
    fab.title = 'Pocket Phone';
    fab.addEventListener('click', ppOpen);
    const targets = ['#extensionsMenu', '#leftSendForm', '#rightSendForm', '#form_sheld'];
    let placed = false;
    for (const sel of targets) {
        const el = document.querySelector(sel);
        if (el) { el.prepend(fab); placed = true; break; }
    }
    if (!placed) { fab.classList.add('pp-fab-float'); document.body.appendChild(fab); }
}

function registerSettingsPanel() {
    const target = document.getElementById('extensions_settings');
    if (!target || document.getElementById('pp-settings-panel')) return;
    target.insertAdjacentHTML('beforeend', `
<div id="pp-settings-panel" class="inline-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>Pocket Phone</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>
  <div class="inline-drawer-content">
    <div style="font-size:12px;opacity:.7;margin-bottom:8px">version <b id="pp-ver-tag">${PP_VERSION}</b></div>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><input type="checkbox" id="pp-set-island"> Dynamic Island</label>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><input type="checkbox" id="pp-set-dark"> Dark mode</label>
    <input id="pp-open-btn" class="menu_button" type="button" value="เปิดมือถือ">
    <input id="pp-diag-btn" class="menu_button" type="button" value="Diagnostics">
  </div>
</div>`);

    const cfg = getCfg();
    const islandBox = document.getElementById('pp-set-island');
    const darkBox = document.getElementById('pp-set-dark');
    if (islandBox) {
        islandBox.checked = cfg.dynamicIsland;
        islandBox.addEventListener('change', () => { getCfg().dynamicIsland = islandBox.checked; saveCfg(); applyIsland(); });
    }
    if (darkBox) {
        darkBox.checked = cfg.theme === 'dark';
        darkBox.addEventListener('change', () => { getCfg().theme = darkBox.checked ? 'dark' : 'light'; saveCfg(); applyTheme(); });
    }
    document.getElementById('pp-open-btn')?.addEventListener('click', ppOpen);
    document.getElementById('pp-diag-btn')?.addEventListener('click', () => window.PP_DIAG());
}

window.PP_OPEN = ppOpen;
window.PP_DIAG = function () {
    const c = ctx();
    const rows = {
        version: PP_VERSION, loaded: window.PP_LOADED, contextOk: !!c,
        dialogInDom: !!document.getElementById('pp-dialog'),
        fabInDom: !!document.getElementById('pp-fab'),
        panelInDom: !!document.getElementById('pp-settings-panel'),
        theme: getCfg().theme, island: getCfg().dynamicIsland,
    };
    console.table(rows);
    ppToast('Diag → console');
    return rows;
};

window.PP_LOADED = 'parsed';
(function boot() {
    let tries = 0;
    const timer = setInterval(() => {
        tries++;
        if (document.getElementById('extensions_settings')) {
            clearInterval(timer);
            try {
                injectFab(); injectPhone(); registerSettingsPanel(); startClock();
                window.PP_LOADED = 'ok';
                console.log(`[pocket-phone] ${PP_VERSION} loaded ✓`);
            } catch (e) {
                window.PP_LOADED = 'error';
                console.error('[pocket-phone] boot error', e);
            }
        } else if (tries > 60) {
            clearInterval(timer);
            window.PP_LOADED = 'no-host';
            console.warn('[pocket-phone] no mount point after 30s');
        }
    }, 500);
})();
