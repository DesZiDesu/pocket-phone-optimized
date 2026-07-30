// pocket-phone/index.js — Stage 6b-fix: call bg = bot avatar (more blur) · floating fading speech · timer replaces status · chat time dividers
// getContext ล้วน · ไม่มี import/export · lazy + try/catch

const PP_VERSION = '0.7.1-stage6b';
const MODULE_NAME = 'pocket-phone'; // ⚠️ ต้องตรงกับชื่อโฟลเดอร์/repo

function ctx() {
    try { return SillyTavern.getContext(); } catch { return null; }
}

// ── media store ──
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

// ── wallpapers ──
const WALLPAPERS = {
    aurora: 'radial-gradient(38% 26% at 22% 15%, rgba(94,92,230,.55), transparent 72%), radial-gradient(40% 26% at 84% 22%, rgba(255,159,10,.4), transparent 72%), radial-gradient(46% 32% at 50% 92%, rgba(52,199,89,.34), transparent 72%), radial-gradient(40% 28% at 88% 82%, rgba(191,90,242,.34), transparent 72%), linear-gradient(160deg,#0a0a12,#050506)',
    ocean: 'radial-gradient(50% 40% at 30% 18%, rgba(10,132,255,.5), transparent 70%), radial-gradient(52% 42% at 82% 82%, rgba(48,209,88,.3), transparent 72%), linear-gradient(160deg,#04121f,#010409)',
    sunset: 'radial-gradient(60% 45% at 50% 14%, rgba(255,159,10,.5), transparent 72%), radial-gradient(55% 40% at 18% 90%, rgba(255,55,95,.42), transparent 72%), radial-gradient(50% 40% at 92% 70%, rgba(191,90,242,.35), transparent 72%), linear-gradient(160deg,#1a0a12,#0a0406)',
    forest: 'radial-gradient(55% 45% at 25% 20%, rgba(52,199,89,.45), transparent 72%), radial-gradient(50% 40% at 85% 82%, rgba(10,132,255,.28), transparent 72%), linear-gradient(160deg,#08120a,#040604)',
    mono: 'radial-gradient(70% 55% at 50% 0%, #1e1e26, #050506 72%)',
};
const CHAT_BGS = {
    '': '',
    dusk: 'linear-gradient(180deg,#1a1030,#0a0616)',
    mint: 'linear-gradient(180deg,#0a1f18,#04100c)',
    rose: 'linear-gradient(180deg,#2a0f18,#12060a)',
    steel: 'linear-gradient(180deg,#12161c,#06080b)',
};

// ── store ──
const DEFAULTS = {
    theme: 'dark',
    accent: '#0a84ff',
    dynamicIsland: true,
    islandScope: 'phone',
    wallpaper: 'aurora',
    homeBlur: 6,
    contacts: [],
    threads: {},
    chatStyle: {},     // { [id]: { bg, bubble, bubbleImg, textColor } }
    callLog: [],       // { cid, name, avatar, startISO, duration, durText, transcript:[{who,text}] }
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
// ── ป้ายเวลากลางแชท (แบบ Messages) ──
function chatDivider(prevTs, ts) {
    if (!prevTs || !ts) return '';
    const gap = ts - prevTs;
    if (gap < 3600000) return ''; // ห่างน้อยกว่า 1 ชม. → ไม่ขึ้น
    const d = new Date(ts), p = new Date(prevTs);
    const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    const sameDay = d.toDateString() === p.toDateString();
    if (sameDay && gap < 6 * 3600000) return hm; // วันเดียวกัน ห่างพอควร → เวลาอย่างเดียว
    const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${hm}`; // ห่างนาน/คนละวัน → มีวันที่
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
    islandRefresh();
}
function ppClose() {
    const dlg = document.getElementById('pp-dialog');
    if (!dlg) return;
    try { document.activeElement?.blur(); } catch {}
    if (dlg.open && typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
    islandRefresh();
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
    const cfg = getCfg();
    el.style.filter = `blur(${cfg.homeBlur ?? 6}px)`;
    const wp = cfg.wallpaper || 'aurora';
    if (wp === 'custom') {
        const img = await loadMedia('home-wp');
        if (img) { el.style.background = '#000 center/cover no-repeat'; el.style.backgroundImage = `url(${img})`; return; }
    }
    el.style.backgroundImage = '';
    el.style.background = WALLPAPERS[wp] || WALLPAPERS.aurora;
}

// ── router ──
let ppActiveContact = null;
let ppGeneratingId = null;
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
        if (screen === 'settings') renderPhoneSettings();
        if (screen === 'calllog') renderCallLog();
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

// ── avatar ──
function contactAvatarHTML(c, size) {
    const s = size || 52;
    if (c.avatar) {
        return `<img class="pp-avatar" style="width:${s}px;height:${s}px"
            src="${esc(c.avatar)}" onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=\\'pp-avatar pp-avatar-fb\\' style=\\'width:${s}px;height:${s}px\\'>${esc((c.name||'?')[0])}</span>'))">`;
    }
    return `<span class="pp-avatar pp-avatar-fb" style="width:${s}px;height:${s}px">${esc((c.name || '?')[0])}</span>`;
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
    if (!cfg.chatStyle[id]) cfg.chatStyle[id] = { bg: '', bubble: '', bubbleImg: false, textColor: '' };
    if (cfg.chatStyle[id].textColor === undefined) cfg.chatStyle[id].textColor = '';
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
    upload: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M5 20h14v-2H5v2zM12 4l-5 5h3v6h4V9h3l-5-5z"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`,
    hangup: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" transform="rotate(135 12 12)"/></svg>`,
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
          <div class="pp-chat-tools">
            <button class="pp-nav-action" id="pp-chat-call-btn" title="โทร">${ICON.phone}</button>
            <button class="pp-nav-action" id="pp-chat-menu-btn" title="ตัวเลือก">${ICON.menu}</button>
          </div>
        </div>
        <div id="pp-chat-settings">
          <div class="pp-cs-row"><span>ลบข้อความ</span><button id="pp-edit-toggle" class="pp-cs-btn">แก้ไข</button></div>
          <div class="pp-cs-row"><span>ประวัติการโทร</span><button id="pp-calllog-btn" class="pp-cs-btn">เปิด</button></div>
          <div class="pp-cs-label">พื้นหลังแชท</div>
          <div class="pp-cs-swatches" id="pp-chat-bg-swatches"></div>
          <label class="pp-cs-upload">${ICON.upload} อัปโหลดรูปพื้นหลัง<input type="file" id="pp-chatbg-file" accept="image/*" hidden></label>
          <div class="pp-cs-label">สีข้อความของฉัน</div>
          <div class="pp-cs-color-row">
            <label class="pp-color-wrap"><input type="color" id="pp-bubble-color" value="#0a84ff"><span>พื้นฟอง</span></label>
            <label class="pp-color-wrap"><input type="color" id="pp-text-color" value="#ffffff"><span>สีตัวอักษร</span></label>
          </div>
          <div class="pp-cs-color-row" style="margin-top:8px">
            <label class="pp-cs-upload">${ICON.upload} ใช้รูปเป็นพื้นฟอง<input type="file" id="pp-bubbleimg-file" accept="image/*" hidden></label>
            <button id="pp-bubble-clear" class="pp-cs-btn">ล้างรูป</button>
          </div>
        </div>
        <div class="pp-msgs" id="pp-msgs"></div>
        <div class="pp-inputbar">
          <textarea class="pp-input" id="pp-input" rows="1" placeholder="ข้อความ"></textarea>
          <button class="pp-gen" id="pp-gen" title="ให้บอทตอบ">${ICON.generate}</button>
        </div>
        <div class="pp-home-bar"></div>
      </div>

      <!-- SETTINGS APP -->
      <div class="pp-screen" id="pp-scr-settings">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="home">${ICON.back}</button>
          <span class="pp-nav-title">Settings</span>
          <span style="width:34px"></span>
        </div>
        <div class="pp-set-body">
          <div class="pp-set-group">
            <div class="pp-set-row"><span>Dark Mode</span><label class="pp-switch"><input type="checkbox" id="pp-set-dark"><span></span></label></div>
            <div class="pp-set-row"><span>Dynamic Island</span><label class="pp-switch"><input type="checkbox" id="pp-set-island"><span></span></label></div>
          </div>
          <div class="pp-set-label">สีหลัก (Accent)</div>
          <div class="pp-set-group"><div class="pp-set-row"><span>เลือกสี</span><label class="pp-color-wrap"><input type="color" id="pp-set-accent" value="#0a84ff"><span></span></label></div></div>
          <div class="pp-set-label">พื้นหลังหน้าจอ</div>
          <div class="pp-set-wp" id="pp-set-wp-swatches"></div>
          <label class="pp-cs-upload" style="margin:8px 0">${ICON.upload} อัปโหลดรูปจากเครื่อง<input type="file" id="pp-set-wp-file" accept="image/*" hidden></label>
          <div class="pp-set-label">ความเบลอพื้นหลัง</div>
          <div class="pp-set-group"><div class="pp-set-row"><input type="range" id="pp-set-blur" min="0" max="30" step="1" value="6" style="flex:1"></div></div>
          <div style="text-align:center;font-size:11px;color:var(--pp-txt3);padding:16px">Pocket Phone ${PP_VERSION}</div>
        </div>
        <div class="pp-home-bar"></div>
      </div>

      <!-- CALL SCREEN -->
      <div class="pp-screen" id="pp-scr-call">
        <div class="pp-call-bg" id="pp-call-bg"></div>
        <div class="pp-call-top">
          <div id="pp-call-av"></div>
          <div class="pp-call-name" id="pp-call-name"></div>
          <div class="pp-call-status" id="pp-call-status">กำลังโทร…</div>
          <div class="pp-call-dur" id="pp-call-dur" style="display:none">0:00</div>
        </div>
        <div class="pp-call-stage" id="pp-call-stage"></div>
        <div class="pp-call-typing" id="pp-call-typing"><span></span><span></span><span></span></div>
        <div class="pp-call-inputbar">
          <textarea class="pp-call-input" id="pp-call-input" rows="1" placeholder="พูดว่า…"></textarea>
          <button class="pp-gen" id="pp-call-gen" title="ให้อีกฝ่ายตอบ">${ICON.generate}</button>
        </div>
        <div class="pp-call-ctrls">
          <button class="pp-call-end" id="pp-call-end" title="วางสาย">${ICON.hangup}</button>
        </div>
      </div>

      <!-- CALL LOG -->
      <div class="pp-screen" id="pp-scr-calllog">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="messages">${ICON.back}</button>
          <span class="pp-nav-title">ประวัติการโทร</span>
          <span style="width:34px"></span>
        </div>
        <div class="pp-list" id="pp-calllog-list"></div>
        <div class="pp-home-bar"></div>
      </div>

      <!-- TRANSCRIPT -->
      <div class="pp-screen" id="pp-scr-transcript">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="calllog">${ICON.back}</button>
          <span class="pp-nav-title" id="pp-transcript-title">บันทึกสาย</span>
          <span style="width:34px"></span>
        </div>
        <div class="pp-transcript-body" id="pp-transcript-body"></div>
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
    if (m.type === 'call') return `<div class="pp-callnote" data-idx="${idx}">${ICON.phone} ${esc(m.text)}</div>`;
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
        let html = '';
        let prevTs = null;
        th.forEach((m, i) => {
            const div = chatDivider(prevTs, m.ts || 0);
            if (div) html += `<div class="pp-time-divider">${esc(div)}</div>`;
            prevTs = m.ts || prevTs;
            if (m.type === 'call') { html += browHTML(m, i, false, true); return; }
            const prev = th[i - 1], next = th[i + 1];
            const grouped = prev && prev.from === m.from && prev.type !== 'call' && !div;
            const tail = !next || next.from !== m.from || next.type === 'call';
            html += browHTML(m, i, grouped, tail);
        });
        if (!ppEditMode && ppGeneratingId !== c.id && th[th.length - 1].from === 'them' && th[th.length - 1].type !== 'call') {
            html += `<div class="pp-regen-row" id="pp-regen-row"><button id="pp-regen-btn" class="pp-regen">${ICON.regen}รีเจน</button></div>`;
        }
        msgs.innerHTML = html;
    }
    applyChatStyle();
    if (ppGeneratingId === c.id) showTyping();
    msgs.scrollTop = msgs.scrollHeight;
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
async function applyChatStyle() {
    const c = ppActiveContact; if (!c) return;
    const st = getChatStyle(c.id);
    const scr = document.getElementById('pp-scr-chat');
    const msgs = document.getElementById('pp-msgs');
    if (msgs) {
        if (st.bg === 'custom') {
            const img = await loadMedia('chatbg-' + c.id);
            if (img) { msgs.style.background = '#000 center/cover no-repeat'; msgs.style.backgroundImage = `url(${img})`; }
            else { msgs.style.backgroundImage = ''; msgs.style.background = ''; }
        } else {
            msgs.style.backgroundImage = '';
            msgs.style.background = st.bg ? (CHAT_BGS[st.bg] || '') : '';
        }
    }
    if (scr) {
        scr.style.setProperty('--pp-mybub', st.bubble || getCfg().accent || '#0a84ff');
        scr.style.setProperty('--pp-mytext', st.textColor || '#ffffff');
        if (st.bubbleImg) {
            const img = await loadMedia('bubbleimg-' + c.id);
            if (img) { scr.style.setProperty('--pp-bubimg', `url(${img})`); scr.classList.add('has-bubimg'); }
            else scr.classList.remove('has-bubimg');
        } else scr.classList.remove('has-bubimg');
    }
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
    const et = document.getElementById('pp-edit-toggle');
    if (et) et.classList.toggle('on', ppEditMode);
    if (ppActiveContact) {
        const st = getChatStyle(ppActiveContact.id);
        const bc = document.getElementById('pp-bubble-color'); if (bc) bc.value = st.bubble || getCfg().accent || '#0a84ff';
        const tc = document.getElementById('pp-text-color'); if (tc) tc.value = st.textColor || '#ffffff';
    }
    markChatSwatches();
}
function markChatSwatches() {
    const c = ppActiveContact; if (!c) return;
    const st = getChatStyle(c.id);
    document.querySelectorAll('#pp-chat-bg-swatches .pp-cs-swatch').forEach(b => b.classList.toggle('on', b.dataset.chatbg === st.bg));
}

// ── Dynamic Island (ในจอ) ──
let ppIslandState = null;
let ppIslandTimer = null;
function renderIslandInto(el, state) {
    if (!state) {
        el.classList.remove('pp-island-live');
        setTimeout(() => { if (!el.classList.contains('pp-island-live')) { el.innerHTML = ''; delete el.dataset.cid; if (el.id === 'pp-ext-island') el.style.display = 'none'; } }, 560);
        return;
    }
    el.dataset.cid = state.cid;
    if (el.id === 'pp-ext-island') el.style.display = 'flex';
    const av = state.avatar
        ? `<img class="pp-island-av" src="${esc(state.avatar)}" onerror="this.style.visibility='hidden'">`
        : `<span class="pp-island-av pp-island-av-fb">${esc((state.name || '?')[0])}</span>`;
    const body = state.kind === 'typing'
        ? `<div class="pp-island-typing"><span></span><span></span><span></span></div>`
        : `<div class="pp-island-msg">${esc(state.text || '')}</div>`;
    el.innerHTML = `${av}<div class="pp-island-body"><div class="pp-island-name">${esc(state.name)}</div>${body}</div>`;
    void el.offsetWidth;
    requestAnimationFrame(() => el.classList.add('pp-island-live'));
}
function islandRefresh() {
    const internal = document.getElementById('pp-island');
    const external = document.getElementById('pp-ext-island');
    const open = !!document.getElementById('pp-dialog')?.open;
    if (internal) {
        if (open && getCfg().dynamicIsland && ppIslandState) renderIslandInto(internal, ppIslandState);
        else renderIslandInto(internal, null);
    }
    if (external) {
        const showExt = !open && getCfg().islandScope === 'always' && ppIslandState;
        renderIslandInto(external, showExt ? ppIslandState : null);
    }
}
function islandTyping(c) { clearTimeout(ppIslandTimer); ppIslandState = { cid: c.id, name: c.name, avatar: c.avatar, kind: 'typing' }; islandRefresh(); }
function islandShowReplies(c, lines) {
    clearTimeout(ppIslandTimer);
    let i = 0;
    const step = () => {
        if (i >= lines.length) { ppIslandState = null; islandRefresh(); return; }
        ppIslandState = { cid: c.id, name: c.name, avatar: c.avatar, kind: 'msg', text: lines[i] };
        islandRefresh(); i++;
        ppIslandTimer = setTimeout(step, 2300);
    };
    step();
}
function islandCollapse() { clearTimeout(ppIslandTimer); ppIslandState = null; islandRefresh(); }

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
    return ppCurrentScreen === 'chat' && ppActiveContact && ppActiveContact.id === c.id
        && !!document.getElementById('pp-dialog')?.open;
}

// ── generation (retry) ──
async function genOnce(prompt) {
    const context = ctx();
    if (context && typeof context.generateQuietPrompt === 'function') return await context.generateQuietPrompt(prompt, false, false);
    if (typeof window.generateQuietPrompt === 'function') return await window.generateQuietPrompt(prompt, false, false);
    throw new Error('generateQuietPrompt ไม่พร้อมใช้งาน');
}
async function genWithRetry(prompt, tries) {
    let lastErr = null;
    const n = tries || 3;
    for (let t = 0; t < n; t++) {
        try {
            const raw = await genOnce(prompt);
            const cleaned = cleanReply(raw);
            if (cleaned) return cleaned;
        } catch (e) { lastErr = e; console.warn('[pocket-phone] gen retry', t + 1, e); }
        await new Promise(r => setTimeout(r, 400 * (t + 1)));
    }
    if (lastErr) throw lastErr;
    return '';
}

async function ppRegenerate() {
    const c = ppActiveContact;
    if (!c || ppGeneratingId) return;
    const th = getThread(c.id);
    while (th.length && th[th.length - 1].from === 'them' && th[th.length - 1].type !== 'call') th.pop();
    saveCfg();
    renderThread();
    ppGenerateReply();
}

async function ppGenerateReply() {
    const c = ppActiveContact;
    if (!c || ppGeneratingId) return;
    const input = document.getElementById('pp-input');
    if (input && input.value.trim()) ppSendUserMessage();
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
    let failed = false;
    try {
        const userName = getUserName();
        const persona = getContactPersona(c.id);
        const th = getThread(c.id).slice(-16);
        const histTxt = th.map(m => {
            if (m.type === 'call') return `[${m.text}]`;
            return `${m.from === 'me' ? userName : c.name}: ${m.text}`;
        }).join('\n');

        const prompt = [
            `[Messages app — ${c.name} กำลังแชทกับ ${userName}]`,
            persona ? `ข้อมูลตัวละคร ${c.name}: ${persona}` : null,
            histTxt ? `\n<history>\n${histTxt}\n</history>` : null,
            `\nตอบกลับในบทบาท ${c.name} แบบข้อความแชทสั้น ๆ เป็นธรรมชาติ (1-3 บรรทัด).`,
            `ใช้ภาษาเดียวกับที่คุยอยู่. ห้ามใส่ * บรรยายท่าทาง. ห้ามใส่ชื่อขึ้นต้น. ห้ามใส่ think/แท็กใด ๆ. ตอบเป็นข้อความล้วน.`,
        ].filter(Boolean).join('\n');

        let raw = await genWithRetry(prompt, 3);
        const nameRx = new RegExp('^' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'gim');
        raw = raw.replace(nameRx, '').trim();

        const lines = raw.split(/\n+/)
            .map(l => l.trim().replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim())
            .filter(Boolean)
            .slice(0, 3);

        if (!lines.length) { failed = true; }
        else {
            const threadArr = getThread(c.id);
            for (let i = 0; i < lines.length; i++) {
                await new Promise(r => setTimeout(r, i === 0 ? 300 : 500 + Math.random() * 400));
                threadArr.push({ from: 'them', text: lines[i], ts: Date.now() });
                produced.push(lines[i]);
                saveCfg();
                if (ppViewing(c)) renderThread();
            }
        }
    } catch (e) {
        failed = true;
        console.error('[pocket-phone] generate', e);
    } finally {
        ppGeneratingId = null;
        hideTyping();
        if (genBtn) genBtn.disabled = false;
        if (failed) {
            islandCollapse();
            ppToast('เชื่อมต่อไม่ได้ ลองกดปุ่มฟ้าอีกครั้ง');
            if (ppViewing(c)) renderThread(); else renderContactList();
        } else if (ppViewing(c)) {
            renderThread(); islandCollapse();
        } else {
            renderContactList();
            if (produced.length) islandShowReplies(c, produced); else islandCollapse();
        }
    }
}

// ── phone Settings app ──
function renderPhoneSettings() {
    const cfg = getCfg();
    const d = document.getElementById('pp-set-dark'); if (d) d.checked = cfg.theme === 'dark';
    const i = document.getElementById('pp-set-island'); if (i) i.checked = cfg.dynamicIsland;
    const a = document.getElementById('pp-set-accent'); if (a) a.value = cfg.accent || '#0a84ff';
    const b = document.getElementById('pp-set-blur'); if (b) b.value = cfg.homeBlur ?? 6;
    const wpWrap = document.getElementById('pp-set-wp-swatches');
    if (wpWrap) {
        wpWrap.innerHTML = Object.keys(WALLPAPERS).map(k =>
            `<button class="pp-wp-swatch" data-wp="${k}" title="${k}" style="background:${WALLPAPERS[k]}"></button>`).join('');
        wpWrap.querySelectorAll('.pp-wp-swatch').forEach(x => x.classList.toggle('on', x.dataset.wp === (cfg.wallpaper || 'aurora')));
    }
}

// ── CALL SYSTEM ──
let ppCall = null; // { contact, startTime, interval, transcript, generating }

function ppStartCall() {
    const c = ppActiveContact;
    if (!c || ppCall) return;
    ppCall = { contact: c, startTime: null, interval: null, transcript: [], generating: false };
    const nm = document.getElementById('pp-call-name'); if (nm) nm.textContent = c.name;
    const st = document.getElementById('pp-call-status'); if (st) { st.style.display = ''; st.textContent = 'กำลังโทร…'; }
    const dur = document.getElementById('pp-call-dur'); if (dur) { dur.style.display = 'none'; dur.textContent = '0:00'; }
    const av = document.getElementById('pp-call-av'); if (av) av.innerHTML = contactAvatarHTML(c, 96);
    // พื้นหลัง = รูปบอทที่กำลังคุยด้วย (เบลอหนัก)
    const bg = document.getElementById('pp-call-bg'); if (bg) bg.style.backgroundImage = c.avatar ? `url(${c.avatar})` : '';
    const stage = document.getElementById('pp-call-stage'); if (stage) stage.innerHTML = '';
    const ty = document.getElementById('pp-call-typing'); if (ty) ty.classList.remove('show');
    ppNav('call');
    setTimeout(() => {
        if (!ppCall) return;
        ppCall.startTime = Date.now();
        // รับสาย → โชว์เลขเวลา แล้วให้คำว่า "รับสายแล้ว" เลือนออก
        const s2 = document.getElementById('pp-call-status');
        const d2 = document.getElementById('pp-call-dur');
        if (d2) d2.style.display = '';
        if (s2) { s2.textContent = `${c.name} รับสายแล้ว`; setTimeout(() => { if (ppCall) { s2.style.opacity = '0'; setTimeout(() => { if (ppCall) s2.style.display = 'none'; }, 400); } }, 1000); }
        ppCall.interval = setInterval(() => {
            if (!ppCall || !ppCall.startTime) return;
            const secs = Math.floor((Date.now() - ppCall.startTime) / 1000);
            const d = document.getElementById('pp-call-dur');
            if (d) d.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        }, 500);
    }, 1600);
}

// ตัวหนังสือลอย ค่อย ๆ จาง ตามความยาว
function ppCallFloat(text, who) {
    if (!ppCall) return;
    ppCall.transcript.push({ who, text });
    const stage = document.getElementById('pp-call-stage');
    if (!stage) return;
    const el = document.createElement('div');
    el.className = 'pp-call-float ' + (who === 'me' ? 'me' : 'them');
    el.textContent = text;
    stage.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const dur = Math.min(Math.max(text.length * 95 + 1800, 2600), 12000);
    setTimeout(() => {
        el.classList.remove('show');
        el.classList.add('fade');
        setTimeout(() => el.remove(), 700);
    }, dur);
}

function ppCallSend() {
    if (!ppCall) return false;
    const inp = document.getElementById('pp-call-input');
    const t = (inp.value || '').trim();
    if (!t) return false;
    inp.value = ''; inp.style.height = 'auto';
    ppCallFloat(t, 'me');
    return true;
}

async function ppCallGenerate() {
    if (!ppCall || ppCall.generating) return;
    const c = ppCall.contact;
    const inp = document.getElementById('pp-call-input');
    if (inp && inp.value.trim()) ppCallSend();
    if (!ppCall.transcript.length) { ppToast('พูดอะไรสักหน่อยก่อน'); return; }
    ppCall.generating = true;
    const btn = document.getElementById('pp-call-gen'); if (btn) btn.disabled = true;
    const ty = document.getElementById('pp-call-typing'); if (ty) ty.classList.add('show');
    try {
        const userName = getUserName();
        const persona = getContactPersona(c.id);
        const recent = ppCall.transcript.slice(-12).map(x => `${x.who === 'me' ? userName : c.name}: ${x.text}`).join('\n');
        const prompt = [
            `[สายโทรศัพท์ — ${c.name} กำลังคุยสายอยู่กับ ${userName}]`,
            persona ? `ข้อมูลตัวละคร ${c.name}: ${persona}` : null,
            recent ? `บทสนทนาในสายล่าสุด:\n${recent}` : 'สานต่อบทสนทนาตามธรรมชาติ',
            `\nตอบในบทบาท ${c.name} ที่กำลังคุยโทรศัพท์ — เป็น "คำพูดในสาย" ล้วน ๆ 1-3 ประโยค.`,
            `ห้ามใส่การกระทำ/คำบรรยายในวงเล็บ. ห้ามใส่ * . ห้ามใส่ชื่อขึ้นต้น. ห้ามใส่ think/แท็กใด ๆ. ใช้ภาษาเดียวกับที่คุย.`,
        ].filter(Boolean).join('\n');
        let raw = await genWithRetry(prompt, 3);
        const nameRx = new RegExp('^' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'gim');
        raw = raw.replace(nameRx, '').trim();
        let text = raw.split(/\n+/).map(l => l.trim()).filter(Boolean).slice(0, 3).join(' ');
        // ตัดการกระทำในวงเล็บ + ดอกจัน ทิ้ง
        text = text.replace(/[\(（][^\)）]*[\)）]/g, '').replace(/\*[^*]*\*/g, '').replace(/\s+/g, ' ').trim() || '…';
        if (ppCall) ppCallFloat(text, 'them');
    } catch (e) {
        ppToast('สายไม่ชัด ลองอีกครั้ง');
        console.error('[pocket-phone] call gen', e);
    } finally {
        if (ppCall) ppCall.generating = false;
        if (btn) btn.disabled = false;
        const ty2 = document.getElementById('pp-call-typing'); if (ty2) ty2.classList.remove('show');
    }
}

function ppEndCall() {
    if (!ppCall) return;
    const c = ppCall.contact;
    clearInterval(ppCall.interval);
    const secs = ppCall.startTime ? Math.floor((Date.now() - ppCall.startTime) / 1000) : 0;
    const durText = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const cfg = getCfg();
    cfg.callLog.unshift({
        cid: c.id, name: c.name, avatar: c.avatar,
        startISO: new Date().toISOString(), duration: secs, durText,
        transcript: ppCall.transcript.slice(),
    });
    if (cfg.callLog.length > 50) cfg.callLog = cfg.callLog.slice(0, 50);
    getThread(c.id).push({ from: 'them', type: 'call', text: `โทรคุยกัน ${durText}`, ts: Date.now() });
    saveCfg();
    ppCall = null;
    ppActiveContact = c;
    ppToast(`วางสาย · ${durText}`);
    // เผื่อ status ถูกซ่อนไว้ คืนค่ากันไว้รอบหน้า
    const s = document.getElementById('pp-call-status'); if (s) { s.style.display = ''; s.style.opacity = '1'; }
    ppNav('chat');
}

function renderCallLog() {
    const list = document.getElementById('pp-calllog-list');
    if (!list) return;
    const logs = getCfg().callLog || [];
    if (!logs.length) { list.innerHTML = `<div class="pp-empty">ยังไม่มีประวัติการโทร</div>`; return; }
    list.innerHTML = logs.map((l, i) => {
        const d = new Date(l.startISO);
        const ds = `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours())}:${String(d.getMinutes()).padStart(2, '0')}`;
        const c = { name: l.name, avatar: l.avatar };
        return `<div class="pp-calllog-row" data-calllog="${i}">
            ${contactAvatarHTML(c, 46)}
            <div class="pp-row-meta">
                <div class="pp-row-name">${esc(l.name)}</div>
                <div class="pp-row-preview">${esc(ds)}</div>
            </div>
            <span class="pp-calllog-dur">${esc(l.durText)}</span>
        </div>`;
    }).join('');
}
function ppShowTranscript(i) {
    const l = (getCfg().callLog || [])[i];
    if (!l) return;
    const title = document.getElementById('pp-transcript-title');
    if (title) title.textContent = `${l.name} · ${l.durText}`;
    const body = document.getElementById('pp-transcript-body');
    if (body) body.innerHTML = (l.transcript || []).length
        ? l.transcript.map(x => `<div class="pp-tr-line ${x.who === 'me' ? 'me' : 'them'}">${esc(x.text)}</div>`).join('')
        : `<div class="pp-sys">ไม่มีบทสนทนาในสายนี้</div>`;
    ppNav('transcript');
}

// ── inject phone ──
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
        if (island && island.dataset.cid) { const cid = island.dataset.cid; islandCollapse(); ppOpenThread(cid); return; }
        if (e.target.closest('#pp-chat-call-btn')) { ppStartCall(); return; }
        if (e.target.closest('#pp-chat-menu-btn')) { toggleChatSettings(); return; }
        if (e.target.closest('#pp-calllog-btn')) { document.getElementById('pp-chat-settings')?.classList.remove('show'); ppNav('calllog'); return; }
        if (e.target.closest('#pp-edit-toggle')) {
            ppEditMode = !ppEditMode;
            document.getElementById('pp-edit-toggle')?.classList.toggle('on', ppEditMode);
            renderThread(); return;
        }
        if (e.target.closest('#pp-bubble-clear') && ppActiveContact) {
            getChatStyle(ppActiveContact.id).bubbleImg = false; saveCfg(); applyChatStyle(); ppToast('ล้างรูปฟองแล้ว'); return;
        }
        const cbg = e.target.closest('[data-chatbg]');
        if (cbg && ppActiveContact) { getChatStyle(ppActiveContact.id).bg = cbg.dataset.chatbg; saveCfg(); applyChatStyle(); markChatSwatches(); return; }
        const wp = e.target.closest('[data-wp]');
        if (wp) { getCfg().wallpaper = wp.dataset.wp; saveCfg(); applyWallpaper(); renderPhoneSettings(); return; }
        const clog = e.target.closest('[data-calllog]');
        if (clog) { ppShowTranscript(+clog.dataset.calllog); return; }
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

    // chat style inputs
    document.getElementById('pp-bubble-color')?.addEventListener('input', e => {
        if (!ppActiveContact) return;
        const st = getChatStyle(ppActiveContact.id);
        st.bubble = e.target.value; st.bubbleImg = false; saveCfg(); applyChatStyle();
    });
    document.getElementById('pp-text-color')?.addEventListener('input', e => {
        if (!ppActiveContact) return;
        getChatStyle(ppActiveContact.id).textColor = e.target.value; saveCfg(); applyChatStyle();
    });
    document.getElementById('pp-bubbleimg-file')?.addEventListener('change', e => {
        const f = e.target.files[0]; if (!f || !ppActiveContact) return;
        const cid = ppActiveContact.id, r = new FileReader();
        r.onload = async () => { await saveMedia('bubbleimg-' + cid, r.result); getChatStyle(cid).bubbleImg = true; saveCfg(); applyChatStyle(); ppToast('ตั้งรูปฟองแล้ว'); };
        r.readAsDataURL(f); e.target.value = '';
    });
    document.getElementById('pp-chatbg-file')?.addEventListener('change', e => {
        const f = e.target.files[0]; if (!f || !ppActiveContact) return;
        const cid = ppActiveContact.id, r = new FileReader();
        r.onload = async () => { await saveMedia('chatbg-' + cid, r.result); getChatStyle(cid).bg = 'custom'; saveCfg(); applyChatStyle(); markChatSwatches(); ppToast('ตั้งพื้นหลังแชทแล้ว'); };
        r.readAsDataURL(f); e.target.value = '';
    });

    // phone settings inputs
    document.getElementById('pp-set-dark')?.addEventListener('change', e => { getCfg().theme = e.target.checked ? 'dark' : 'light'; saveCfg(); applyTheme(); });
    document.getElementById('pp-set-island')?.addEventListener('change', e => { getCfg().dynamicIsland = e.target.checked; saveCfg(); applyIsland(); islandRefresh(); });
    document.getElementById('pp-set-accent')?.addEventListener('input', e => { getCfg().accent = e.target.value; saveCfg(); applyTheme(); applyChatStyle(); });
    document.getElementById('pp-set-blur')?.addEventListener('input', e => { getCfg().homeBlur = +e.target.value; saveCfg(); applyWallpaper(); });
    document.getElementById('pp-set-wp-file')?.addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = async () => { await saveMedia('home-wp', r.result); getCfg().wallpaper = 'custom'; saveCfg(); applyWallpaper(); renderPhoneSettings(); ppToast('ตั้งรูปหน้าจอแล้ว'); };
        r.readAsDataURL(f); e.target.value = '';
    });

    // chat input
    const input = document.getElementById('pp-input');
    const gen = document.getElementById('pp-gen');
    if (input) {
        input.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ppSendUserMessage(); }
        });
    }
    gen?.addEventListener('click', ppGenerateReply);

    // call input
    const callInput = document.getElementById('pp-call-input');
    if (callInput) {
        callInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        });
        callInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ppCallSend(); }
        });
    }
    document.getElementById('pp-call-gen')?.addEventListener('click', ppCallGenerate);
    document.getElementById('pp-call-end')?.addEventListener('click', ppEndCall);
}

function injectExternalIsland() {
    if (document.getElementById('pp-ext-island')) return;
    const el = document.createElement('div');
    el.id = 'pp-ext-island';
    el.style.display = 'none';
    el.addEventListener('click', () => {
        const cid = el.dataset.cid;
        islandCollapse();
        ppOpen();
        if (cid) ppOpenThread(cid);
    });
    document.body.appendChild(el);
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
    <div style="font-size:12px;opacity:.7;margin-bottom:10px">version <b id="pp-ver-tag">${PP_VERSION}</b></div>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <input type="checkbox" id="pp-set-scope"> ให้ Dynamic Island ลอยอยู่นอกมือถือด้วย (แม้ปิดมือถือ)
    </label>
    <div style="font-size:11px;opacity:.6;margin-bottom:12px">ปิด = Island อยู่แค่ในมือถือ · เปิด = แจ้งเตือน/ตอบกลับเด้งนอกจอเลย</div>
    <input id="pp-open-btn" class="menu_button" type="button" value="เปิดมือถือ">
    <input id="pp-diag-btn" class="menu_button" type="button" value="Diagnostics">
  </div>
</div>`);

    const scopeBox = document.getElementById('pp-set-scope');
    if (scopeBox) {
        scopeBox.checked = getCfg().islandScope === 'always';
        scopeBox.addEventListener('change', () => { getCfg().islandScope = scopeBox.checked ? 'always' : 'phone'; saveCfg(); islandRefresh(); });
    }
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
        callLog: (getCfg().callLog || []).length, inCall: !!ppCall,
        generating: ppGeneratingId, wallpaper: getCfg().wallpaper,
        islandScope: getCfg().islandScope, theme: getCfg().theme, island: getCfg().dynamicIsland,
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
                injectFab(); injectPhone(); injectExternalIsland(); registerSettingsPanel(); startClock();
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
