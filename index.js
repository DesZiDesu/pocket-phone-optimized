// pocket-phone/index.js — Stage 1: bare shell
// getContext ล้วน · ไม่มี import/export · lazy + try/catch

const PP_VERSION = '0.1.0-stage1';
const MODULE_NAME = 'pocket-phone'; // ⚠️ ต้องตรงกับชื่อโฟลเดอร์/repo

// ── context แบบ lazy (ห้ามเรียกที่ top level) ──
function ctx() {
    try { return SillyTavern.getContext(); } catch { return null; }
}

// ── store: config เล็กใน extensionSettings + mirror ลง localStorage ──
const DEFAULTS = {
    theme: 'dark',
    accent: '#0a84ff',
    dynamicIsland: true,
};
const LS_MIRROR = 'pp_cfg_mirror';

function getCfg() {
    const c = ctx();
    let cfg;
    if (c && c.extensionSettings) {
        if (!c.extensionSettings[MODULE_NAME]) c.extensionSettings[MODULE_NAME] = {};
        cfg = c.extensionSettings[MODULE_NAME];
    } else {
        // fallback อ่านจาก localStorage ถ้า context ยังไม่พร้อม
        try { cfg = JSON.parse(localStorage.getItem(LS_MIRROR) || '{}'); }
        catch { cfg = {}; }
    }
    // backfill ทุกครั้งที่อ่าน (กัน undefined หลังอัปเดต)
    for (const k of Object.keys(DEFAULTS)) {
        if (cfg[k] === undefined) cfg[k] = DEFAULTS[k];
    }
    return cfg;
}

function saveCfg() {
    const c = ctx();
    const cfg = getCfg();
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
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
    applyTheme();
    applyIsland();
    startClock();
    if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
    else dlg.setAttribute('open', '');
}
function ppClose() {
    const dlg = document.getElementById('pp-dialog');
    if (!dlg) return;
    if (typeof dlg.close === 'function' && dlg.open) dlg.close();
    else dlg.removeAttribute('open');
}

// ── theme / island ──
function applyTheme() {
    const frame = document.getElementById('pp-frame');
    if (!frame) return;
    const cfg = getCfg();
    frame.classList.toggle('light', cfg.theme === 'light');
    frame.style.setProperty('--pp-accent', cfg.accent || '#0a84ff');
}
function applyIsland() {
    const island = document.getElementById('pp-island');
    if (island) island.style.display = getCfg().dynamicIsland ? 'block' : 'none';
}

// ── router: build ครั้งเดียว, toggle display (ไม่ rebuild) ──
function ppNav(screen) {
    document.querySelectorAll('.pp-screen').forEach(s => s.classList.remove('show'));
    const home = document.getElementById('pp-home');
    if (screen === 'home') { if (home) home.classList.add('show'); return; }
    const el = document.getElementById('pp-scr-' + screen);
    if (el) el.classList.add('show');
    else { // ยังไม่มีจอนี้ใน Stage 1
        if (home) home.classList.add('show');
        ppToast('เร็ว ๆ นี้: ' + screen);
    }
}

// ── toast ──
function ppToast(msg) {
    const t = document.getElementById('pp-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ── HTML ──
function buildPhone() {
    return `
<dialog id="pp-dialog">
  <div id="pp-frame" class="dark">
    <div id="pp-island"></div>
    <div id="pp-statusbar">
      <span class="pp-clock">9:41</span>
      <div class="pp-sb-right">
        <span>▮▮▮</span>
        <button id="pp-close-btn" title="Close">✕</button>
      </div>
    </div>

    <div id="pp-screens">
      <!-- HOME -->
      <div class="pp-screen show" id="pp-home">
        <div class="pp-home-clock pp-clock">9:41</div>
        <div id="pp-home-date">Saturday, May 17</div>
        <div style="flex:1"></div>
        <div class="pp-grid">
          <button class="pp-app" data-nav="story"><span class="pp-icon" style="background:linear-gradient(160deg,#5e5ce6,#3634a3)">📖</span><span class="pp-label">Story</span></button>
          <button class="pp-app" data-nav="messages"><span class="pp-icon" style="background:linear-gradient(160deg,#34c759,#248a3d)">💬</span><span class="pp-label">Messages</span></button>
          <button class="pp-app" data-nav="feed"><span class="pp-icon" style="background:#000;border:.5px solid #333">✳</span><span class="pp-label">Feed</span></button>
          <button class="pp-app" data-nav="wallet"><span class="pp-icon" style="background:linear-gradient(160deg,#ff9f0a,#c76b00)">💳</span><span class="pp-label">Wallet</span></button>
          <button class="pp-app" data-nav="settings"><span class="pp-icon" style="background:linear-gradient(160deg,#8e8e93,#48484a)">⚙️</span><span class="pp-label">Settings</span></button>
        </div>
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
    // แตะไอคอนแอป
    document.querySelectorAll('#pp-frame .pp-app').forEach(btn => {
        btn.addEventListener('click', () => ppNav(btn.dataset.nav));
    });
    // แตะพื้นหลังนอกกรอบ = ปิด
    document.getElementById('pp-dialog')?.addEventListener('click', e => {
        if (e.target.id === 'pp-dialog') ppClose();
    });
}

// ── FAB ──
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
    if (!placed) {
        fab.classList.add('pp-fab-float');
        document.body.appendChild(fab);
    }
}

// ── Settings drawer (มี version tag บังคับ) ──
function registerSettingsPanel() {
    const target = document.getElementById('extensions_settings');
    if (!target || document.getElementById('pp-settings-panel')) return;
    const html = `
<div id="pp-settings-panel" class="inline-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>Pocket Phone</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>
  <div class="inline-drawer-content">
    <div style="font-size:12px;opacity:.7;margin-bottom:8px">
      version <b id="pp-ver-tag">${PP_VERSION}</b>
    </div>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <input type="checkbox" id="pp-set-island"> Dynamic Island
    </label>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <input type="checkbox" id="pp-set-dark"> Dark mode
    </label>
    <input id="pp-open-btn" class="menu_button" type="button" value="เปิดมือถือ">
    <input id="pp-diag-btn" class="menu_button" type="button" value="Diagnostics">
  </div>
</div>`;
    target.insertAdjacentHTML('beforeend', html);

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

// ── diagnostics / escape hatches ──
window.PP_OPEN = ppOpen;
window.PP_DIAG = function () {
    const c = ctx();
    const rows = {
        version: PP_VERSION,
        loaded: window.PP_LOADED,
        contextOk: !!c,
        dialogInDom: !!document.getElementById('pp-dialog'),
        fabInDom: !!document.getElementById('pp-fab'),
        panelInDom: !!document.getElementById('pp-settings-panel'),
        theme: getCfg().theme,
        island: getCfg().dynamicIsland,
    };
    console.table(rows);
    ppToast('Diag → console');
    return rows;
};

// ── bootstrap: poll หา DOM target แทนพึ่ง event อย่างเดียว ──
window.PP_LOADED = 'parsed';
(function boot() {
    let tries = 0;
    const timer = setInterval(() => {
        tries++;
        const ready = document.getElementById('extensions_settings');
        if (ready) {
            clearInterval(timer);
            try {
                injectFab();
                injectPhone();
                registerSettingsPanel();
                startClock();
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
