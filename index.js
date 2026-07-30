// pocket-phone/index.js — Stage 6a: home wallpaper upload · island shows replies · edit/delete · regen · per-chat bg+bubble
// getContext ล้วน · ไม่มี import/export · lazy + try/catch

const PP_VERSION = '0.6.0-stage6a';
const MODULE_NAME = 'pocket-phone'; // ⚠️ ต้องตรงกับชื่อโฟลเดอร์/repo

function ctx() {
    try { return SillyTavern.getContext(); } catch { return null; }
}

// ── media store (localforage สำหรับรูปใหญ่ + fallback localStorage) ──
function mediaStore() {
    try {
        if (window.SillyTavern && SillyTavern.libs && SillyTavern.libs.localforage) {
            return SillyTavern.libs.localforage.createInstance({ name: 'pocket-phone', storeName: 'media' });
        }
    } catch {}
    return null;
}
async function saveMedia(key, dataUrl) {
    const store = mediaStore();
    if (store) { try { await store.setItem(key, dataUrl); return true; } catch {} }
    try { localStorage.setItem('ppmedia_' + key, dataUrl); return true; } catch {}
    return false;
}
async function loadMedia(key) {
    const store = mediaStore();
    if (store) { try { const v = await store.getItem(key); if (v) return v; } catch {} }
    try { return localStorage.getItem('ppmedia_' + key); } catch {}
    return null;
}

// ── wallpapers (preset) ──
const WALLPAPERS = {
    aurora: 'radial-gradient(38% 26% at 22% 15%, rgba(94,92,230,.55), transparent 72%), radial-gradient(40% 26% at 84% 22%, rgba(255,159,10,.4), transparent 72%), radial-gradient(46% 32% at 50% 92%, rgba(52,199,89,.34), transparent 72%), radial-gradient(40% 28% at 88% 82%, rgba(191,90,242,.34), transparent 72%), linear-gradient(160deg,#0a0a12,#050506)',
    ocean: 'radial-gradient(50% 40% at 30% 18%, rgba(10,132,255,.5), transparent 70%), radial-gradient(52% 42% at 82% 82%, rgba(48,209,88,.3), transparent 72%), linear-gradient(160deg,#04121f,#010409)',
    sunset: 'radial-gradient(60% 45% at 50% 14%, rgba(255,159,10,.5), transparent 72%), radial-gradient(55% 40% at 18% 90%, rgba(255,55,95,.42), transparent 72%), radial-gradient(50% 40% at 92% 70%, rgba(191,90,242,.35), transparent 72%), linear-gradient(160deg,#1a0a12,#0a0406)',
    forest: 'radial-gradient(55% 45% at 25% 20%, rgba(52,199,89,.45), transparent 72%), radial-gradient(50% 40% at 85% 82%, rgba(10,132,255,.28), transparent 72%), linear-gradient(160deg,#08120a,#040604)',
    mono: 'radial-gradient(70% 55% at 50% 0%, #1e1e26, #050506 72%)',
};
// ── chat backgrounds + bubble colors ──
const CHAT_BGS = {
    '': '',
    dusk: 'linear-gradient(180deg,#1a1030,#0a0616)',
    mint: 'linear-gradient(180deg,#0a1f18,#04100c)',
    rose: 'linear-gradient(180deg,#2a0f18,#12060a)',
    steel: 'linear-gradient(180deg,#12161c,#06080b)',
};
const BUBBLE_COLORS = ['#0a84ff', '#30d158', '#ff375f', '#bf5af2', '#ff9f0a', '#5e5ce6'];

// ── store ──
const DEFAULTS = {
    theme: 'dark',
    accent: '#0a84ff',
    dynamicIsland: true,
    wallpaper: 'aurora',
    contacts: [],       // { id, name, avatar }
    threads: {},        // { [id]: [ { from:'me'|'them', text, ts } ] }
    chatStyle: {},      // { [id]: { bg, bubble } }
};
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
    for (const k of Object.keys(DEFAULTS)) if (cfg[k] === undefined) cfg[k] = structuredClone(DEFAULTS[k]);
    return cfg;
}
function saveCfg() {
    const c = ctx(), cfg = getCfg();
    try { localStorage.setItem(LS_MIRROR, JSON.stringify(cfg)); } catch {}
    try { if (c && typeof c.saveSettingsDebounced === 'function') c.saveSettingsDebounced(); } catch {}
}

const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');

function cleanReply(t) {
    let s = String(t || '');
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
    s = s.replace(/<think>[\s\S]*/gi, '');
    s = s.replace(/\[(?:CoT|COT|THINK|SYSTEM|CONTEXT|PERSONA|PHASE|STEP)[^\]]*\][^\n]*/gi, '');
    return s.trim();
}
function getUserName() {
    const c = ctx();
    try { if (c && c.name1) return c.name1; } catch {}
    return 'User';
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
    applyTheme(); applyIsland(); applyWallpaper(); startClock();
    if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
    else dlg.setAttribute('open', '');
}
function ppClose() {
    const dlg = document.getElementById('pp-dialog');
    if (!dlg) return;
    try { document.activeElement?.blur(); } catch {}
    if (dlg.open && typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
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
async function applyWallpaper() {
    const el = document.getElementById('pp-home-wp');
    if (!el) return;
    const wp = getCfg().wallpaper || 'aurora';
    if (wp === 'custom') {
        const img = await loadMedia('home-wp');
        if (img) { el.style.background = `#000 center/cover no-repeat`; el.style.backgroundImage = `url(${img})`; return; }
    }
    el.style.backgroundImage = '';
    el.style.background = WALLPAPERS[wp] || WALLPAPERS.aurora;
}

// ── router ──
let ppActiveContact = null;
let ppGeneratingId = null;   // id ที่บอทกำลังคิดคำตอบ (null = ว่าง)
let ppCurrentScreen = 'home';
let ppEditMode = false;

function ppNav(screen) {
    ppCurrentScreen = screen;
    document.getElementById('pp-chat-settings')?.classList.remove('show');
    document.querySelectorAll('.pp-screen').forEach(s => s.classList.remove('show'));
    if (screen === 'home') { document.getElementById('pp-home')?.classList.add('show'); return; }
    const el = document.getElementById('pp-scr-' + screen);
    if (el) {
        el.classList.add('show');
        if (screen === 'messages') renderContactList();
        if (screen === 'contacts') renderAddContacts();
        if (screen === 'chat') renderThread();
    } else {
        ppCurrentScreen = 'home';
        document.getElementById('pp-home')?.classList.add('show');
        ppToast('เร็ว ๆ นี้: ' + screen);
    }
}

function ppToast(msg) {
    const t = document.getElementById('pp-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ── avatar helpers ──
function contactAvatarHTML(c, size) {
    const s = size || 52;
    if (c.avatar) {
        return `<img class="pp-avatar" style="width:${s}px;height:${s}px"
            src="${esc(c.avatar)}" onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=\\'pp-avatar pp-avatar-fb\\' style=\\'width:${s}px;height:${s}px\\'>${esc((c.name||'?')[0])}</span>'))">`;
    }
    return `<span class="pp-avatar pp-avatar-fb" style="width:${s}px;height:${s}px">${esc((c.name || '?')[0])}</span>`;
}
function islandAvatarHTML(c) {
    if (c.avatar) return `<img class="pp-island-av" src="${esc(c.avatar)}" onerror="this.style.visibility='hidden'">`;
    return `<span class="pp-island-av pp-island-av-fb">${esc((c.name || '?')[0])}</span>`;
}

// ── data ──
function getContacts() { return getCfg().contacts; }
function getThread(id) {
    const cfg = getCfg();
    if (!cfg.threads[id]) cfg.threads[id] = [];
    return cfg.threads[id];
}
function getChatStyle(id) {
    const cfg = getCfg();
    if (!cfg.chatStyle[id]) cfg.chatStyle[id] = { bg: '', bubble: '' };
    return cfg.chatStyle[id];
}
function listStCharacters() {
    const c = ctx();
    if (c && Array.isArray(c.characters) && c.characters.length) {
        return c.characters
            .filter(ch => ch && ch.name && !ch.is_user)
            .map(ch => ({
                id: ch.avatar || ch.name,
                name: ch.name,
                avatar: ch.avatar ? `/characters/${ch.avatar}` : '',
                persona: ch.description || ch.personality || '',
            }));
    }
    return [];
}
function getContactPersona(id) {
    const ch = listStCharacters().find(x => x.id === id);
    return ch ? (ch.persona || '') : '';
}

// ── SVG glyphs ──
const ICON = {
    story: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.2C10.5 5 8.4 4.5 6 4.5c-.8 0-1.5.6-1.5 1.4v11c0 .8.7 1.4 1.5 1.4 2.1 0 4 .5 5.3 1.5.4.3 1 .3 1.4 0 1.3-1 3.2-1.5 5.3-1.5.8 0 1.5-.6 1.5-1.4v-11c0-.8-.7-1.4-1.5-1.4-2.4 0-4.5.5-6 1.7zM12 6.2v12"/></svg>`,
    messages: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.9 3 3 6.6 3 11c0 2.3 1.1 4.4 2.9 5.8-.2 1.3-.8 2.5-1.6 3.4-.2.2 0 .6.3.5 1.9-.3 3.4-1 4.4-1.6 1 .3 2 .4 3 .4 5.1 0 9-3.6 9-8s-3.9-8-9-8z"/></svg>`,
    feed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
    wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18" stroke-width="2"/><circle cx="17" cy="14.5" r="1.1" fill="currentColor" stroke="none"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.49.49 0 0 0 13.5 2h-3c-.24 0-.44.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94L2.86 14.52a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.03.24.23.41.47.41h3c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>`,
    signal: `<svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.5" width="3" height="6.5" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></svg>`,
    wifi: `<svg viewBox="0 0 24 18" fill="currentColor"><path d="M12 3C8 3 4.4 4.6 1.8 7.2l1.8 1.8C5.8 6.8 8.7 5.5 12 5.5s6.2 1.3 8.4 3.5l1.8-1.8C19.6 4.6 16 3 12 3zm0 6c-2 0-3.8.8-5.1 2.1l1.8 1.8C9.5 12.1 10.7 11.5 12 11.5s2.5.6 3.3 1.4l1.8-1.8A7.2 7.2 0 0 0 12 9zm0 5.5-2.1 2.1c.6.6 1.4.9 2.1.9s1.5-.3 2.1-.9L12 14.5z"/></svg>`,
    battery: `<svg viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor"/><rect x="23" y="4" width="1.8" height="4" rx=".9" fill="currentColor" fill-opacity=".4"/></svg>`,
    back: `<svg viewBox="0 0 12 20" width="11" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2 2 10l8 8"/></svg>`,
    compose: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
    generate: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2.5l1.6 4.3 4.3 1.6-4.3 1.6L12 14.3l-1.6-4.3L6.1 8.4l4.3-1.6L12 2.5z"/><path d="M18.4 13.6l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
    regen: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35A8 8 0 1 0 19.73 13h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`,
};

const APPS = [
    { nav: 'story', label: 'Story', glow: '#b0acff', icon: ICON.story },
    { nav: 'messages', label: 'Messages', glow: '#5ce07f', icon: ICON.messages },
    { nav: 'feed', label: 'Feed', glow: '#e8e8ed', icon: ICON.feed },
    { nav: 'wallet', label: 'Wallet', glow: '#ffc061', icon: ICON.wallet },
    { nav: 'settings', label: 'Settings', glow: '#d0d0d5', icon: ICON.settings },
];

// ── HTML ──
function buildPhone() {
    const grid = APPS.map(a =>
        `<button class="pp-app" data-nav="${a.nav}">
            <span class="pp-icon" style="color:${a.glow}">${a.icon}</span>
            <span class="pp-label">${a.label}</span>
        </button>`).join('');
    return `
<dialog id="pp-dialog">
  <div id="pp-frame" class="dark">
    <div id="pp-statusbar">
      <span class="pp-sb-left pp-clock">9:41</span>
      <div id="pp-island"></div>
      <span class="pp-sb-right">${ICON.signal}${ICON.wifi}${ICON.battery}
        <button id="pp-close-btn" title="Close">✕</button></span>
    </div>

    <div id="pp-screens">
      <div class="pp-screen show" id="pp-home">
        <div id="pp-home-wp"></div>
        <div class="pp-home-clock pp-clock">9:41</div>
        <div id="pp-home-date">Saturday, May 17</div>
        <div style="flex:1"></div>
        <div class="pp-grid">${grid}</div>
        <div class="pp-home-bar"></div>
      </div>

      <div class="pp-screen" id="pp-scr-messages">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="home">${ICON.back}</button>
          <span class="pp-nav-title">Messages</span>
          <button class="pp-nav-action" data-nav="contacts">${ICON.compose}</button>
        </div>
        <div class="pp-search-wrap"><input class="pp-search" id="pp-msg-search" placeholder="ค้นหา"></div>
        <div class="pp-list" id="pp-contact-list"></div>
        <div class="pp-home-bar"></div>
      </div>

      <div class="pp-screen" id="pp-scr-contacts">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="messages">${ICON.back}</button>
          <span class="pp-nav-title">เพิ่มคนคุย</span>
          <span style="width:34px"></span>
        </div>
        <div class="pp-list" id="pp-add-list"></div>
        <div class="pp-home-bar"></div>
      </div>

      <div class="pp-screen" id="pp-scr-chat">
        <div class="pp-chat-header" id="pp-chat-header">
          <button class="pp-nav-back" data-nav="messages">${ICON.back}</button>
          <div class="pp-chat-hdr-center">
            <span id="pp-chat-hdr-av"></span>
            <span class="pp-chat-hdr-name" id="pp-chat-hdr-name">Contact</span>
          </div>
          <button class="pp-nav-action" id="pp-chat-menu-btn" title="ตัวเลือก">${ICON.menu}</button>
        </div>
        <div id="pp-chat-settings">
          <div class="pp-cs-row"><span>ลบข้อความ</span><button id="pp-edit-toggle" class="pp-cs-btn">แก้ไข</button></div>
          <div class="pp-cs-label">พื้นหลังแชท</div>
          <div class="pp-cs-swatches" id="pp-chat-bg-swatches"></div>
          <div class="pp-cs-label">สีข้อความของฉัน</div>
          <div class="pp-cs-swatches" id="pp-bubble-swatches"></div>
        </div>
        <div class="pp-msgs" id="pp-msgs"></div>
        <div class="pp-inputbar">
          <textarea class="pp-input" id="pp-input" rows="1" placeholder="ข้อความ"></textarea>
          <button class="pp-gen" id="pp-gen" title="ให้บอทตอบ">${ICON.generate}</button>
        </div>
        <div class="pp-home-bar"></div>
      </div>
    </div>

    <div id="pp-toast"></div>
  </div>
</dialog>`;
}

// ── renders ──
function renderContactList(filter) {
    const list = document.getElementById('pp-contact-list');
    if (!list) return;
    let contacts = getContacts();
    if (filter) contacts = contacts.filter(c => (c.name || '').toLowerCase().includes(filter.toLowerCase()));
    if (!contacts.length) {
        list.innerHTML = `<div class="pp-empty">ยังไม่มีคนคุย<br><span>แตะปุ่มมุมขวาบนเพื่อเพิ่ม</span></div>`;
        return;
    }
    list.innerHTML = contacts.map(c => {
        const th = getThread(c.id);
        const last = th[th.length - 1];
        const typing = ppGeneratingId === c.id;
        const preview = typing ? 'กำลังพิมพ์…' : (last ? last.text : 'แตะเพื่อเริ่มแชท');
        return `<div class="pp-row" data-cid="${esc(c.id)}">
            ${contactAvatarHTML(c, 52)}
            <div class="pp-row-meta">
                <div class="pp-row-name">${esc(c.name)}</div>
                <div class="pp-row-preview${typing ? ' pp-preview-typing' : ''}">${esc(preview)}</div>
            </div>
        </div>`;
    }).join('');
}

function renderAddContacts() {
    const list = document.getElementById('pp-add-list');
    if (!list) return;
    const chars = listStCharacters();
    const added = new Set(getContacts().map(c => c.id));
    if (!chars.length) {
        list.innerHTML = `<div class="pp-empty">ไม่พบตัวละครใน SillyTavern<br><span>ลองโหลดตัวละครก่อน</span></div>`;
        return;
    }
    list.innerHTML = chars.map(c => `<div class="pp-row">
        ${contactAvatarHTML(c, 48)}
        <div class="pp-row-meta"><div class="pp-row-name">${esc(c.name)}</div></div>
        ${added.has(c.id)
            ? `<span class="pp-added">เพิ่มแล้ว</span>`
            : `<button class="pp-add-btn" data-add="${esc(c.id)}">เพิ่ม</button>`}
    </div>`).join('');
}

function browHTML(m, idx, grouped, tail) {
    const out = m.from === 'me';
    return `<div class="pp-brow ${out ? 'out' : 'in'}${grouped ? ' grp' : ''}" data-from="${m.from}">
        <button class="pp-del" data-del="${idx}">✕</button>
        <div class="pp-bubble${tail ? ' tail' : ''}">${esc(m.text)}</div>
    </div>`;
}

function renderThread() {
    const c = ppActiveContact;
    if (!c) { ppNav('messages'); return; }
    const name = document.getElementById('pp-chat-hdr-name');
    if (name) name.textContent = c.name;
    const avSlot = document.getElementById('pp-chat-hdr-av');
    if (avSlot) avSlot.innerHTML = contactAvatarHTML(c, 30);
    const msgs = document.getElementById('pp-msgs');
    if (!msgs) return;
    msgs.classList.toggle('edit-on', ppEditMode);
    const th = getThread(c.id);
    if (!th.length) {
        msgs.innerHTML = `<div class="pp-sys">เริ่มบทสนทนา</div>`;
    } else {
        let html = th.map((m, i) => {
            const prev = th[i - 1], next = th[i + 1];
            const grouped = prev && prev.from === m.from;
            const tail = !next || next.from !== m.from;
            return browHTML(m, i, grouped, tail);
        }).join('');
        // ปุ่มรีเจน โผล่เฉพาะใต้คำตอบล่าสุดของบอท (ไม่รก)
        if (!ppEditMode && ppGeneratingId !== c.id && th[th.length - 1].from === 'them') {
            html += `<div class="pp-regen-row"><button id="pp-regen-btn" class="pp-regen">${ICON.regen}รีเจน</button></div>`;
        }
        msgs.innerHTML = html;
    }
    applyChatStyle();
    if (ppGeneratingId === c.id) showTyping();
    msgs.scrollTop = msgs.scrollHeight;
}

function appendBubble(m) {
    // ใช้ตอนส่งข้อความผู้ใช้ระหว่างที่ไม่ได้ rebuild ทั้งเธรด
    renderThread();
}

function showTyping() {
    const msgs = document.getElementById('pp-msgs');
    if (!msgs || document.getElementById('pp-typing')) return;
    document.getElementById('pp-regen-row')?.remove();
    msgs.insertAdjacentHTML('beforeend',
        `<div class="pp-brow in" id="pp-typing"><div class="pp-typing"><span></span><span></span><span></span></div></div>`);
    msgs.scrollTop = msgs.scrollHeight;
}
function hideTyping() { document.getElementById('pp-typing')?.remove(); }

// ── chat appearance ──
function applyChatStyle() {
    const c = ppActiveContact; if (!c) return;
    const st = getChatStyle(c.id);
    const msgs = document.getElementById('pp-msgs');
    if (msgs) { msgs.style.background = st.bg ? (CHAT_BGS[st.bg] || '') : ''; }
    const scr = document.getElementById('pp-scr-chat');
    if (scr) scr.style.setProperty('--pp-mybub', st.bubble || getCfg().accent || '#0a84ff');
}
function toggleChatSettings() {
    const p = document.getElementById('pp-chat-settings');
    if (!p) return;
    const show = !p.classList.contains('show');
    p.classList.toggle('show', show);
    if (show) buildChatSwatches();
}
function buildChatSwatches() {
    const bgWrap = document.getElementById('pp-chat-bg-swatches');
    if (bgWrap) {
        bgWrap.innerHTML = Object.keys(CHAT_BGS).map(k =>
            `<button class="pp-cs-swatch" data-chatbg="${k}" style="background:${k ? CHAT_BGS[k] : 'var(--pp-bg3)'}">${k ? '' : 'ปกติ'}</button>`).join('');
    }
    const bubWrap = document.getElementById('pp-bubble-swatches');
    if (bubWrap) {
        bubWrap.innerHTML = BUBBLE_COLORS.map(col =>
            `<button class="pp-cs-swatch" data-bubble="${col}" style="background:${col}"></button>`).join('');
    }
    const et = document.getElementById('pp-edit-toggle');
    if (et) et.classList.toggle('on', ppEditMode);
    markChatSwatches();
}
function markChatSwatches() {
    const c = ppActiveContact; if (!c) return;
    const st = getChatStyle(c.id);
    document.querySelectorAll('#pp-chat-bg-swatches .pp-cs-swatch').forEach(b => b.classList.toggle('on', b.dataset.chatbg === st.bg));
    document.querySelectorAll('#pp-bubble-swatches .pp-cs-swatch').forEach(b => b.classList.toggle('on', b.dataset.bubble === st.bubble));
}

// ── Dynamic Island ──
function islandTyping(c) {
    const island = document.getElementById('pp-island');
    if (!island || !getCfg().dynamicIsland) return;
    clearTimeout(island._t);
    island.dataset.cid = c.id;
    island.innerHTML = `${islandAvatarHTML(c)}<div class="pp-island-body">
        <div class="pp-island-name">${esc(c.name)}</div>
        <div class="pp-island-typing"><span></span><span></span><span></span></div></div>`;
    void island.offsetWidth;
    requestAnimationFrame(() => island.classList.add('pp-island-live'));
}
function islandShowReplies(c, lines) {
    const island = document.getElementById('pp-island');
    if (!island || !getCfg().dynamicIsland) { collapseIsland(); return; }
    let i = 0;
    const step = () => {
        if (i >= lines.length) { collapseIsland(); return; }
        island.dataset.cid = c.id;
        island.innerHTML = `${islandAvatarHTML(c)}<div class="pp-island-body">
            <div class="pp-island-name">${esc(c.name)}</div>
            <div class="pp-island-msg">${esc(lines[i])}</div></div>`;
        void island.offsetWidth;
        island.classList.add('pp-island-live');
        i++;
        island._t = setTimeout(step, 2300);
    };
    step();
}
function collapseIsland() {
    const island = document.getElementById('pp-island');
    if (!island) return;
    clearTimeout(island._t);
    island.classList.remove('pp-island-live');
    setTimeout(() => {
        if (!island.classList.contains('pp-island-live')) {
            island.innerHTML = '';
            delete island.dataset.cid;
        }
    }, 560);
}

function ppOpenThread(id) {
    const c = getContacts().find(x => x.id === id);
    if (!c) return;
    ppActiveContact = c;
    ppEditMode = false;
    ppNav('chat');
}
function ppAddContact(id) {
    const c = listStCharacters().find(x => x.id === id);
    if (!c) return;
    const cfg = getCfg();
    if (!cfg.contacts.find(x => x.id === id)) {
        cfg.contacts.push({ id: c.id, name: c.name, avatar: c.avatar });
        saveCfg();
        ppToast(`เพิ่ม ${c.name} แล้ว`);
        renderAddContacts();
    }
}
function ppDeleteMsg(idx) {
    const c = ppActiveContact; if (!c) return;
    const th = getThread(c.id);
    if (idx < 0 || idx >= th.length) return;
    th.splice(idx, 1);
    saveCfg();
    renderThread();
    renderContactList();
}

// ── input actions ──
function ppSendUserMessage() {
    const c = ppActiveContact;
    if (!c) return false;
    const input = document.getElementById('pp-input');
    const text = (input.value || '').trim();
    if (!text) return false;
    input.value = '';
    input.style.height = 'auto';
    getThread(c.id).push({ from: 'me', text, ts: Date.now() });
    saveCfg();
    renderThread();
    return true;
}
function ppViewing(c) {
    return ppCurrentScreen === 'chat' && ppActiveContact && ppActiveContact.id === c.id;
}

async function ppRegenerate() {
    const c = ppActiveContact;
    if (!c || ppGeneratingId) return;
    const th = getThread(c.id);
    while (th.length && th[th.length - 1].from === 'them') th.pop();
    saveCfg();
    renderThread();
    ppGenerateReply();
}

async function ppGenerateReply() {
    const c = ppActiveContact;
    if (!c || ppGeneratingId) return;
    const input = document.getElementById('pp-input');
    if (input && input.value.trim()) ppSendUserMessage(); // flush ตัวหนังสือค้าง
    if (!getThread(c.id).some(m => m.from === 'me')) {
        ppToast('พิมพ์ข้อความก่อน แล้วค่อยกดให้บอทตอบ');
        return;
    }
    ppGeneratingId = c.id;
    const genBtn = document.getElementById('pp-gen');
    if (genBtn) genBtn.disabled = true;
    if (ppViewing(c)) { document.getElementById('pp-regen-row')?.remove(); showTyping(); }
    islandTyping(c);
    renderContactList();

    let produced = [];
    try {
        const context = ctx();
        const userName = getUserName();
        const persona = getContactPersona(c.id);
        const th = getThread(c.id).slice(-16);
        const histTxt = th.map(m => `${m.from === 'me' ? userName : c.name}: ${m.text}`).join('\n');

        const prompt = [
            `[Messages app — ${c.name} กำลังแชทกับ ${userName}]`,
            persona ? `ข้อมูลตัวละคร ${c.name}: ${persona}` : null,
            histTxt ? `\n<history>\n${histTxt}\n</history>` : null,
            `\nตอบกลับในบทบาท ${c.name} แบบข้อความแชทสั้น ๆ เป็นธรรมชาติ (1-3 บรรทัด).`,
            `ใช้ภาษาเดียวกับที่คุยอยู่. ห้ามใส่ * บรรยายท่าทาง. ห้ามใส่ชื่อขึ้นต้น. ห้ามใส่ think/แท็กใด ๆ. ตอบเป็นข้อความล้วน.`,
        ].filter(Boolean).join('\n');

        let raw = '';
        if (context && typeof context.generateQuietPrompt === 'function') {
            raw = await context.generateQuietPrompt(prompt, false, false);
        } else if (typeof window.generateQuietPrompt === 'function') {
            raw = await window.generateQuietPrompt(prompt, false, false);
        } else {
            throw new Error('generateQuietPrompt ไม่พร้อมใช้งาน');
        }

        raw = cleanReply(raw);
        const nameRx = new RegExp('^' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'gim');
        raw = raw.replace(nameRx, '').trim();

        const lines = raw.split(/\n+/)
            .map(l => l.trim().replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim())
            .filter(Boolean)
            .slice(0, 3);
        if (!lines.length) lines.push('...');

        const threadArr = getThread(c.id);
        for (let i = 0; i < lines.length; i++) {
            await new Promise(r => setTimeout(r, i === 0 ? 300 : 500 + Math.random() * 400));
            threadArr.push({ from: 'them', text: lines[i], ts: Date.now() });
            produced.push(lines[i]);
            saveCfg();
            if (ppViewing(c)) renderThread(); // rebuild + typing (ยังเจนอยู่)
        }
    } catch (e) {
        getThread(c.id).push({ from: 'them', text: '(ตอบไม่สำเร็จ — เช็ก SillyTavern)', ts: Date.now() });
        saveCfg();
        console.error('[pocket-phone] generate', e);
    } finally {
        ppGeneratingId = null;
        hideTyping();
        if (genBtn) genBtn.disabled = false;
        if (ppViewing(c)) { renderThread(); collapseIsland(); }
        else { renderContactList(); if (produced.length) islandShowReplies(c, produced); else collapseIsland(); }
    }
}

// ── inject ──
function injectPhone() {
    if (document.getElementById('pp-dialog')) return;
    const holder = document.createElement('div');
    holder.innerHTML = buildPhone();
    document.body.appendChild(holder.firstElementChild);

    document.getElementById('pp-close-btn')?.addEventListener('click', ppClose);
    document.getElementById('pp-dialog')?.addEventListener('click', e => {
        if (e.target.id === 'pp-dialog') ppClose();
    });

    document.getElementById('pp-frame')?.addEventListener('click', e => {
        const island = e.target.closest('#pp-island');
        if (island && island.dataset.cid) { clearTimeout(island._t); collapseIsland(); ppOpenThread(island.dataset.cid); return; }
        if (e.target.closest('#pp-chat-menu-btn')) { toggleChatSettings(); return; }
        if (e.target.closest('#pp-edit-toggle')) {
            ppEditMode = !ppEditMode;
            document.getElementById('pp-edit-toggle')?.classList.toggle('on', ppEditMode);
            renderThread(); return;
        }
        const cbg = e.target.closest('[data-chatbg]');
        if (cbg && ppActiveContact) { getChatStyle(ppActiveContact.id).bg = cbg.dataset.chatbg; saveCfg(); applyChatStyle(); markChatSwatches(); return; }
        const bub = e.target.closest('[data-bubble]');
        if (bub && ppActiveContact) { getChatStyle(ppActiveContact.id).bubble = bub.dataset.bubble; saveCfg(); applyChatStyle(); markChatSwatches(); return; }
        const del = e.target.closest('[data-del]');
        if (del) { e.stopPropagation(); ppDeleteMsg(+del.dataset.del); return; }
        if (e.target.closest('#pp-regen-btn')) { ppRegenerate(); return; }
        const nav = e.target.closest('[data-nav]');
        if (nav) { ppNav(nav.dataset.nav); return; }
        const add = e.target.closest('[data-add]');
        if (add) { ppAddContact(add.dataset.add); return; }
        const row = e.target.closest('.pp-row[data-cid]');
        if (row) { ppOpenThread(row.dataset.cid); return; }
    });

    document.getElementById('pp-msg-search')?.addEventListener('input', e => renderContactList(e.target.value));

    const input = document.getElementById('pp-input');
    const gen = document.getElementById('pp-gen');
    if (input) {
        input.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                ppSendUserMessage(); // Enter = ส่งข้อความผู้ใช้ (บอทยังไม่ตอบ)
            }
        });
    }
    gen?.addEventListener('click', ppGenerateReply); // ปุ่มฟ้า = ให้บอทตอบ
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
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><input type="checkbox" id="pp-set-dark"> Dark mode</label>
    <div style="font-size:12px;opacity:.7;margin:4px 0 6px">Wallpaper</div>
    <div id="pp-wp-swatches" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"></div>
    <label id="pp-home-wp-label" class="menu_button" style="display:inline-block;margin-bottom:12px;cursor:pointer">อัปโหลดรูปจากเครื่อง<input type="file" id="pp-home-wp-file" accept="image/*" style="display:none"></label>
    <br>
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
    const wpWrap = document.getElementById('pp-wp-swatches');
    const markWp = () => wpWrap && wpWrap.querySelectorAll('.pp-wp-swatch').forEach(b =>
        b.classList.toggle('on', b.dataset.wp === (getCfg().wallpaper || 'aurora')));
    if (wpWrap) {
        wpWrap.innerHTML = Object.keys(WALLPAPERS).map(k =>
            `<button class="pp-wp-swatch" data-wp="${k}" title="${k}" style="background:${WALLPAPERS[k]}"></button>`).join('');
        wpWrap.querySelectorAll('.pp-wp-swatch').forEach(b =>
            b.addEventListener('click', () => { getCfg().wallpaper = b.dataset.wp; saveCfg(); applyWallpaper(); markWp(); }));
        markWp();
    }
    document.getElementById('pp-home-wp-file')?.addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = async () => {
            await saveMedia('home-wp', r.result);
            getCfg().wallpaper = 'custom'; saveCfg(); applyWallpaper(); markWp();
            ppToast('ตั้งรูปหน้าจอแล้ว');
        };
        r.readAsDataURL(f);
        e.target.value = '';
    });
    document.getElementById('pp-open-btn')?.addEventListener('click', ppOpen);
    document.getElementById('pp-diag-btn')?.addEventListener('click', () => window.PP_DIAG());
}

window.PP_OPEN = ppOpen;
window.PP_DIAG = function () {
    const c = ctx();
    const rows = {
        version: PP_VERSION, loaded: window.PP_LOADED, contextOk: !!c,
        genQuiet: !!(c && typeof c.generateQuietPrompt === 'function'),
        localforage: !!mediaStore(),
        chars: listStCharacters().length, contacts: getContacts().length,
        generating: ppGeneratingId, wallpaper: getCfg().wallpaper,
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
