// pocket-phone/index.js — 0.9.2 — ท่อน 1/3 (ต้นไฟล์ → จบ buildPhone)
// เปลี่ยนจาก 0.9.1: รวมจักรวาลแบบ A (จับชื่อคอนแทกต์ที่บอทเอ่ยถึง) อยู่ในท่อน 2/3

const PP_VERSION = '0.9.2';
const MODULE_NAME = 'pocket-phone';

function ctx() {
    try { return SillyTavern.getContext(); } catch { return null; }
}

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

const DEFAULTS = {
    theme: 'dark',
    accent: '#0a84ff',
    dynamicIsland: true,
    islandScope: 'phone',
    wallpaper: 'aurora',
    homeBlur: 6,
    botCallKeyword: true,
    userAvatarMode: 'auto',
    sharedUniverse: false,
    universeAffectsRP: false,
    contacts: [],
    threads: {},
    chatStyle: {},
    callLog: [],
    pinned: [],
    userNote: null,
    botNotes: {},
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
function stripEmoji(t) {
    return String(t || '')
        .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
        .replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
        .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
        .replace(/[\u{2190}-\u{21FF}]/gu, '')
        .replace(/[\uFE0F\u200D\u20E3]/gu, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}
function isFarewell(t) {
    const s = String(t || '').toLowerCase();
    if (/\b(bye+|goodbye|talk (to you )?later|see (you|ya)|see u|gtg|got to go|gotta go|hang up|catch you later|call you (back|later)|take care)\b/.test(s)) return true;
    return /(บายนะ|บายๆ|บาย|วางก่อน|วางละ|วางสายก่อน|วางสายละ|ไปก่อนนะ|ไปก่อน|ไปละ|ต้องไปแล้ว|ต้องวางแล้ว|แล้วเจอกัน|แล้วเจอกันนะ|แล้วค่อยคุย|ไว้คุยกัน|ไว้คุยกันใหม่|ไว้คุยใหม่|แค่นี้ก่อน|แค่นี้ก่อนนะ|เดี๋ยวโทรใหม่|เดี๋ยวโทรกลับ|ราตรีสวัสดิ์|ฝันดี|โชคดีนะ|ดูแลตัวเองด้วย)/.test(t || '');
}
function wantsToCall(t) {
    const s = String(t || '');
    if (/(โทรหา|โทรไป|โทรกลับ|ขอโทร|กำลังโทร|เดี๋ยวโทร|รับสายหน่อย|โทรได้ไหม|โทรเลย)/.test(s)) return true;
    if (/\b(calling you|i'?ll call|gonna call|pick up|answer the phone)\b/i.test(s)) return true;
    return false;
}
function getUserName() {
    const c = ctx();
    try { if (c && c.name1) return c.name1; } catch {}
    return 'User';
}
function dname(c) { return (c && (c.customName || c.name)) || '?'; }

function currentCharacterId() {
    const c = ctx();
    try {
        if (c && c.characterId != null && Array.isArray(c.characters)) {
            const ch = c.characters[c.characterId];
            if (ch) return ch.avatar || ch.name;
        }
    } catch {}
    return null;
}
function noteCategory(cid) {
    if (isPinned(cid)) return 'pin';
    if (cid === currentCharacterId()) return 'main';
    return 'npc';
}

let ppUserAvatarCache = null;
function userAvatarAuto() {
    const c = ctx();
    try {
        if (c) {
            if (c.userAvatar) return `/User Avatars/${c.userAvatar}`;
            if (c.user_avatar) return `/User Avatars/${c.user_avatar}`;
            const pa = c.powerUserSettings?.persona_description_avatar;
            if (pa) return `/User Avatars/${pa}`;
        }
    } catch {}
    return '';
}
async function refreshUserAvatar() {
    const cfg = getCfg();
    if (cfg.userAvatarMode === 'custom') {
        const img = await loadMedia('user-avatar');
        ppUserAvatarCache = img || userAvatarAuto();
    } else {
        ppUserAvatarCache = userAvatarAuto();
    }
    return ppUserAvatarCache;
}
function userAvatarHTML(size) {
    const s = size || 52;
    const src = ppUserAvatarCache;
    const un = getUserName();
    if (src) {
        return `<img class="pp-avatar" style="width:${s}px;height:${s}px" src="${esc(src)}"
            onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=\\'pp-avatar pp-avatar-fb\\' style=\\'width:${s}px;height:${s}px\\'>${esc(un[0] || 'U')}</span>'))">`;
    }
    return `<span class="pp-avatar pp-avatar-fb" style="width:${s}px;height:${s}px">${esc(un[0] || 'U')}</span>`;
}

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
const TH_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function fmtHM(d) { return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
function fmtListTime(ts) {
    if (!ts) return '';
    const d = new Date(ts), today = new Date();
    if (d.toDateString() === today.toDateString()) return fmtHM(d);
    const yst = new Date(); yst.setDate(yst.getDate() - 1);
    if (d.toDateString() === yst.toDateString()) return 'เมื่อวาน';
    if ((today - d) < 7 * 86400000) return TH_DAYS[d.getDay()];
    return `${d.getDate()}/${d.getMonth() + 1}`;
}
function fmtNoteAge(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อกี้';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} ชม.ที่แล้ว`;
}
function chatDividerFull(ts) {
    if (!ts) return '';
    const d = new Date(ts), today = new Date();
    if (d.toDateString() === today.toDateString()) return `วันนี้ ${fmtHM(d)}`;
    return `${TH_DAYS[d.getDay()]} ${d.getDate()} ${TH_MONTHS[d.getMonth()]} · ${fmtHM(d)}`;
}
function chatDivider(prevTs, ts) {
    if (!prevTs || !ts) return '';
    const gap = ts - prevTs;
    if (gap < 300000) return '';
    const d = new Date(ts), p = new Date(prevTs);
    if (d.toDateString() === p.toDateString()) return fmtHM(d);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return `วันนี้ ${fmtHM(d)}`;
    return `${TH_DAYS[d.getDay()]} ${d.getDate()} ${TH_MONTHS[d.getMonth()]} · ${fmtHM(d)}`;
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

function ppOpen() {
    const dlg = document.getElementById('pp-dialog');
    if (!dlg) return;
    applyTheme(); applyIsland(); applyWallpaper(); startClock();
    refreshUserAvatar();
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

let ppActiveContact = null;
let ppGeneratingId = null;
let ppCurrentScreen = 'home';
let ppEditMode = false;
let ppListEditMode = false;
let ppCallLogEdit = false;
let ppCallLogFilter = null;

function ppNav(screen) {
    ppCurrentScreen = screen;
    document.getElementById('pp-chat-settings')?.classList.remove('show');
    document.querySelectorAll('.pp-screen').forEach(s => s.classList.remove('show'));
    if (screen === 'home') { document.getElementById('pp-home')?.classList.add('show'); return; }
    const el = document.getElementById('pp-scr-' + screen);
    if (el) {
        el.classList.add('show');
        if (screen === 'messages') { renderNotesRow(); renderContactList(); }
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

function ppPrompt(title, initial, onOk) {
    const host = document.getElementById('pp-frame') || document.body;
    const ov = document.createElement('div');
    ov.className = 'pp-help-ov';
    ov.style.cssText = 'position:absolute;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);padding:28px;box-sizing:border-box;';
    ov.innerHTML = `<div style="background:rgba(50,50,54,.96);backdrop-filter:blur(30px);border-radius:18px;max-width:300px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.5)">
        <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:12px">${esc(title)}</div>
        <textarea class="pp-prompt-input" rows="3" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,.3);border:none;border-radius:12px;padding:11px 13px;color:#fff;font-size:15px;resize:none;font-family:inherit;line-height:1.4">${esc(initial || '')}</textarea>
        <div style="display:flex;gap:8px;margin-top:14px">
            <button class="pp-prompt-cancel" style="flex:1;background:rgba(120,120,128,.3);border:none;color:#fff;border-radius:14px;padding:11px;font-size:15px;cursor:pointer">ยกเลิก</button>
            <button class="pp-prompt-ok" style="flex:1;background:var(--pp-accent,#0a84ff);border:none;color:#fff;border-radius:14px;padding:11px;font-size:15px;font-weight:600;cursor:pointer">บันทึก</button>
        </div>
    </div>`;
    host.appendChild(ov);
    const ta = ov.querySelector('.pp-prompt-input');
    setTimeout(() => ta?.focus(), 60);
    const close = () => ov.remove();
    ov.querySelector('.pp-prompt-cancel')?.addEventListener('click', close);
    ov.querySelector('.pp-prompt-ok')?.addEventListener('click', () => { onOk((ta.value || '').trim()); close(); });
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
}
function ppHelpPopup(title, body) {
    const host = document.getElementById('pp-frame') || document.body;
    const ov = document.createElement('div');
    ov.className = 'pp-help-ov';
    ov.style.cssText = 'position:absolute;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);padding:28px;box-sizing:border-box;';
    ov.innerHTML = `<div style="background:rgba(50,50,54,.96);backdrop-filter:blur(30px);border-radius:18px;max-width:300px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.5)">
        <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px">${esc(title)}</div>
        <div style="font-size:13px;line-height:1.55;color:rgba(235,235,245,.85)">${body}</div>
        <button class="pp-help-close" style="margin-top:16px;width:100%;background:var(--pp-accent,#0a84ff);border:none;color:#fff;border-radius:14px;padding:11px;font-size:15px;font-weight:600;cursor:pointer">เข้าใจแล้ว</button>
    </div>`;
    host.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('.pp-help-close')?.addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
}

function contactAvatarHTML(c, size) {
    const s = size || 52;
    if (c.avatar) {
        return `<img class="pp-avatar" style="width:${s}px;height:${s}px"
            src="${esc(c.avatar)}" onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=\\'pp-avatar pp-avatar-fb\\' style=\\'width:${s}px;height:${s}px\\'>${esc(dname(c)[0])}</span>'))">`;
    }
    return `<span class="pp-avatar pp-avatar-fb" style="width:${s}px;height:${s}px">${esc(dname(c)[0])}</span>`;
}

function getContacts() { return getCfg().contacts; }
function getThread(id) {
    const cfg = getCfg();
    if (!cfg.threads[id]) cfg.threads[id] = [];
    return cfg.threads[id];
}
function lastTs(id) {
    const th = getThread(id);
    const last = th[th.length - 1];
    return last ? (last.ts || 0) : 0;
}
function getChatStyle(id) {
    const cfg = getCfg();
    if (!cfg.chatStyle[id]) cfg.chatStyle[id] = { bg: '', bubble: '', bubbleImg: false, textColor: '' };
    if (cfg.chatStyle[id].textColor === undefined) cfg.chatStyle[id].textColor = '';
    return cfg.chatStyle[id];
}
function isPinned(id) { return (getCfg().pinned || []).includes(id); }
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

const NOTE_TTL = 24 * 3600000;
function getUserNote() {
    const n = getCfg().userNote;
    if (!n || !n.text) return null;
    if (Date.now() - (n.ts || 0) > NOTE_TTL) return null;
    return n;
}
function getBotNote(cid) {
    const n = (getCfg().botNotes || {})[cid];
    if (!n || !n.text) return null;
    if (Date.now() - (n.ts || 0) > NOTE_TTL) return null;
    return n;
}
function setUserNote(text) {
    const cfg = getCfg();
    cfg.userNote = text ? { text: String(text).slice(0, 120), ts: Date.now() } : null;
    saveCfg();
}
function setBotNote(cid, text) {
    const cfg = getCfg();
    if (!cfg.botNotes) cfg.botNotes = {};
    if (text) cfg.botNotes[cid] = { text: String(text).slice(0, 120), ts: Date.now() };
    else delete cfg.botNotes[cid];
    saveCfg();
}

const ICON = {
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
    hangup: `<svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" transform="rotate(135 12 12)"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>`,
    speaker: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 4v6l2 3v2h-5v6l-1 1-1-1v-6H6v-2l2-3V4h8zm-6 0h4v6.3l1.3 2H8.7L10 10.3V4z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2H8l1-2z"/></svg>`,
};

const APPS = [
    { nav: 'messages', label: 'Messages', glow: '#5ce07f', icon: ICON.messages },
    { nav: 'feed', label: 'Feed', glow: '#e8e8ed', icon: ICON.feed },
    { nav: 'wallet', label: 'Wallet', glow: '#ffc061', icon: ICON.wallet },
    { nav: 'settings', label: 'Settings', glow: '#d0d0d5', icon: ICON.settings },
];

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
          <div class="pp-chat-tools">
            <button class="pp-nav-action" id="pp-list-edit-btn" style="width:auto;font-size:15px;font-weight:600" title="แก้ไข">แก้ไข</button>
            <button class="pp-nav-action" data-nav="contacts">${ICON.compose}</button>
          </div>
        </div>
        <div class="pp-search-wrap"><input class="pp-search" id="pp-msg-search" placeholder="ค้นหา"></div>
        <div class="pp-notes-row" id="pp-notes-row"></div>
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
          <div class="pp-cs-label">ชื่อที่แสดง (แค่ในมือถือ)</div>
          <div class="pp-cs-color-row" style="margin-bottom:6px">
            <input id="pp-rename-input" placeholder="ชื่อ" style="flex:1;background:var(--pp-bg3);border:none;border-radius:14px;padding:9px 14px;color:var(--pp-txt);font-size:14px;min-width:120px">
            <button id="pp-rename-save" class="pp-cs-btn">บันทึก</button>
          </div>
          <div class="pp-cs-row"><span>ลบข้อความ</span><button id="pp-edit-toggle" class="pp-cs-btn">แก้ไข</button></div>
          <div class="pp-cs-row"><span>ประวัติการโทร (คนนี้)</span><button id="pp-calllog-btn" class="pp-cs-btn">เปิด</button></div>
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
            <div class="pp-set-row"><span>Island นอกมือถือ (แม้ปิด)</span><label class="pp-switch"><input type="checkbox" id="pp-set-scope2"><span></span></label></div>
          </div>
          <div class="pp-set-label">โทรศัพท์</div>
          <div class="pp-set-group">
            <div class="pp-set-row">
              <span style="display:flex;align-items:center;gap:8px">บอทโทรหา <button class="pp-help-btn" id="pp-help-botcall">?</button></span>
              <label class="pp-switch"><input type="checkbox" id="pp-set-botcall"><span></span></label>
            </div>
          </div>
          <div class="pp-set-label">รวมจักรวาล</div>
          <div class="pp-set-group">
            <div class="pp-set-row">
              <span style="display:flex;align-items:center;gap:8px">บอท/NPC ทักข้ามแชท <button class="pp-help-btn" id="pp-help-universe">?</button></span>
              <label class="pp-switch"><input type="checkbox" id="pp-set-universe"><span></span></label>
            </div>
            <div class="pp-set-row">
              <span style="display:flex;align-items:center;gap:8px">มีผลต่อโรลเพลย์หลัก <button class="pp-help-btn" id="pp-help-affectrp">?</button></span>
              <label class="pp-switch"><input type="checkbox" id="pp-set-affectrp"><span></span></label>
            </div>
          </div>
          <div class="pp-set-label">รูปโปรไฟล์ผู้ใช้</div>
          <div class="pp-set-group">
            <div class="pp-set-row"><span>ใช้รูปจาก SillyTavern อัตโนมัติ</span><label class="pp-switch"><input type="checkbox" id="pp-set-avauto"><span></span></label></div>
          </div>
          <label class="pp-cs-upload" style="margin:8px 0" id="pp-user-av-upload-wrap">${ICON.upload} อัปโหลดรูปโปรไฟล์เอง<input type="file" id="pp-user-av-file" accept="image/*" hidden></label>
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

      <div class="pp-screen" id="pp-scr-call">
        <div class="pp-call-bg" id="pp-call-bg"></div>
        <div class="pp-call-top">
          <div class="pp-call-sub" id="pp-call-sub">Pocket Phone</div>
          <div class="pp-call-name" id="pp-call-name"></div>
          <div class="pp-call-status" id="pp-call-status">กำลังโทร…</div>
          <div class="pp-call-dur" id="pp-call-dur" style="display:none">0:00</div>
          <div id="pp-call-av"></div>
        </div>
        <div class="pp-call-stage" id="pp-call-stage"></div>
        <div class="pp-call-typing" id="pp-call-typing"><span></span><span></span><span></span></div>
        <div class="pp-call-inputbar" id="pp-call-inputbar">
          <textarea class="pp-call-input" id="pp-call-input" rows="1" placeholder="พูดว่า…"></textarea>
          <button class="pp-gen" id="pp-call-gen" title="ให้อีกฝ่ายตอบ">${ICON.generate}</button>
        </div>
        <div class="pp-call-ctrls">
          <div class="pp-call-active-ctrls">
            <button class="pp-cc" id="pp-call-mute"><span class="pp-cc-ic">${ICON.mic}</span><span class="pp-cc-lb">ปิดไมค์</span></button>
            <button class="pp-call-end" id="pp-call-end" title="วางสาย">${ICON.hangup}</button>
            <button class="pp-cc" id="pp-call-speaker"><span class="pp-cc-ic">${ICON.speaker}</span><span class="pp-cc-lb">ลำโพง</span></button>
          </div>
          <div class="pp-call-answer">
            <button class="pp-ans-btn decline" id="pp-call-decline">${ICON.hangup}<span>ปฏิเสธ</span></button>
            <button class="pp-ans-btn accept" id="pp-call-accept">${ICON.phone}<span>รับสาย</span></button>
          </div>
        </div>
      </div>

      <div class="pp-screen" id="pp-scr-callend">
        <div class="pp-call-bg" id="pp-callend-bg"></div>
        <div class="pp-call-top" style="flex:1;justify-content:center">
          <div id="pp-callend-av"></div>
          <div class="pp-call-name" id="pp-callend-name" style="margin-top:16px"></div>
          <div class="pp-call-status" id="pp-callend-sub">สายสิ้นสุด</div>
          <div class="pp-call-dur" id="pp-callend-dur"></div>
        </div>
        <div class="pp-call-ctrls" style="z-index:1;position:relative">
          <div style="display:flex;justify-content:center">
            <button id="pp-callend-ok" style="background:var(--pp-accent);border:none;color:#fff;border-radius:22px;padding:12px 40px;font-size:16px;font-weight:600;cursor:pointer">เสร็จสิ้น</button>
          </div>
        </div>
      </div>

      <div class="pp-screen" id="pp-scr-calllog">
        <div class="pp-nav">
          <button class="pp-nav-back" id="pp-calllog-back">${ICON.back}</button>
          <span class="pp-nav-title" id="pp-calllog-title">ประวัติการโทร</span>
          <button class="pp-nav-action" id="pp-calllog-edit-btn" style="width:auto;font-size:15px;font-weight:600">แก้ไข</button>
        </div>
        <div class="pp-list" id="pp-calllog-list"></div>
        <div class="pp-home-bar"></div>
      </div>

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

// pocket-phone/index.js — 0.9.2 — ท่อน 2/3 (renderNotesRow → ppGenerateReply)
// ต่อจากท่อน 1/3 ที่จบตรง buildPhone()

// ── notes row (IG-style, 3 หมวด: ปักหมุด/หลัก/NPC) ──
function renderNotesRow() {
    const row = document.getElementById('pp-notes-row');
    if (!row) return;

    const un = getUserNote();
    let html = `<div class="pp-note-item" data-usernote="1">
        <div class="pp-note-av-wrap">
            ${un ? `<div class="pp-note-bubble">${esc(un.text.slice(0, 24))}${un.text.length > 24 ? '…' : ''}</div>` : `<div class="pp-note-bubble pp-note-add">โน้ต…</div>`}
            ${userAvatarHTML(58)}
        </div>
        <div class="pp-note-name">${esc(getUserName())}</div>
    </div>`;

    const cats = { pin: [], main: [], npc: [] };
    getContacts().forEach(c => {
        const bn = getBotNote(c.id);
        if (!bn) return;
        cats[noteCategory(c.id)].push({ c, bn });
    });
    const sectionHTML = (arr) => arr.map(({ c, bn }) => `
        <div class="pp-note-item" data-botnote="${esc(c.id)}">
            <div class="pp-note-av-wrap">
                <div class="pp-note-bubble">${esc(bn.text.slice(0, 24))}${bn.text.length > 24 ? '…' : ''}</div>
                ${contactAvatarHTML(c, 58)}
            </div>
            <div class="pp-note-name">${esc(dname(c))}</div>
        </div>`).join('');

    const parts = [];
    if (cats.pin.length) parts.push(`<div class="pp-note-sep" data-label="ปักหมุด"></div>${sectionHTML(cats.pin)}`);
    if (cats.main.length) parts.push(`<div class="pp-note-sep" data-label="หลัก"></div>${sectionHTML(cats.main)}`);
    if (cats.npc.length) parts.push(`<div class="pp-note-sep" data-label="NPC"></div>${sectionHTML(cats.npc)}`);

    row.innerHTML = html + parts.join('');
}

// ── renders ──
function renderContactList(filter) {
    const list = document.getElementById('pp-contact-list');
    if (!list) return;
    let contacts = getContacts().slice();
    if (filter) contacts = contacts.filter(c => dname(c).toLowerCase().includes(filter.toLowerCase()));
    contacts.sort((a, b) => {
        const pa = isPinned(a.id) ? 1 : 0, pb = isPinned(b.id) ? 1 : 0;
        if (pa !== pb) return pb - pa;
        return lastTs(b.id) - lastTs(a.id);
    });
    if (!contacts.length) {
        list.innerHTML = `<div class="pp-empty">ยังไม่มีคนคุย<br><span>แตะปุ่มมุมขวาบนเพื่อเพิ่ม</span></div>`;
        return;
    }
    list.innerHTML = contacts.map(c => {
        const th = getThread(c.id);
        const last = th[th.length - 1];
        const typing = ppGeneratingId === c.id;
        const preview = typing ? 'กำลังพิมพ์…' : (last ? last.text : 'แตะเพื่อเริ่มแชท');
        const timeLbl = last ? fmtListTime(last.ts) : '';
        const pinned = isPinned(c.id);
        const editControls = ppListEditMode
            ? `<div class="pp-row-edit" style="display:flex;gap:8px;flex-shrink:0">
                 <button class="pp-cs-btn" data-pin="${esc(c.id)}" style="padding:6px 10px;background:${pinned ? 'var(--pp-accent)' : 'var(--pp-bg3)'};color:${pinned ? '#fff' : 'var(--pp-txt)'}">${ICON.pin}</button>
                 <button class="pp-cs-btn" data-delchat="${esc(c.id)}" style="padding:6px 10px;background:rgba(255,69,58,.85);color:#fff">${ICON.trash}</button>
               </div>`
            : `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
                 <span style="font-size:12px;color:var(--pp-txt3)">${esc(timeLbl)}</span>
                 ${pinned ? `<span style="color:var(--pp-txt3);opacity:.7">${ICON.pin}</span>` : ''}
               </div>`;
        return `<div class="pp-row" ${ppListEditMode ? '' : `data-cid="${esc(c.id)}"`}>
            ${contactAvatarHTML(c, 52)}
            <div class="pp-row-meta">
                <div class="pp-row-name">${esc(dname(c))}</div>
                <div class="pp-row-preview${typing ? ' pp-preview-typing' : ''}">${esc(preview)}</div>
            </div>
            ${editControls}
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
    if (m.type === 'call') {
        return `<div class="pp-callnote-wrap" style="display:flex;align-items:center;justify-content:center;gap:6px;margin:10px auto">
            <button class="pp-del" data-del="${idx}">✕</button>
            <div class="pp-callnote">${ICON.phone} ${esc(m.text)}</div>
        </div>`;
    }
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
    if (name) name.textContent = dname(c);
    const avSlot = document.getElementById('pp-chat-hdr-av');
    if (avSlot) avSlot.innerHTML = contactAvatarHTML(c, 30);
    const rn = document.getElementById('pp-rename-input');
    if (rn) rn.value = c.customName || '';
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
            const div = (i === 0) ? chatDividerFull(m.ts || 0) : chatDivider(prevTs, m.ts || 0);
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
        const rn = document.getElementById('pp-rename-input'); if (rn) rn.value = ppActiveContact.customName || '';
    }
    markChatSwatches();
}
function markChatSwatches() {
    const c = ppActiveContact; if (!c) return;
    const st = getChatStyle(c.id);
    document.querySelectorAll('#pp-chat-bg-swatches .pp-cs-swatch').forEach(b => b.classList.toggle('on', b.dataset.chatbg === st.bg));
}

// ── Dynamic Island ──
let ppIslandState = null;
let ppIslandTimer = null;
function renderIslandInto(el, state) {
    const isExt = el.id === 'pp-ext-island';
    if (!state) {
        el.classList.remove('pp-island-live');
        if (isExt) { el.style.width = '120px'; el.style.height = '34px'; el.style.borderRadius = '20px'; el.style.justifyContent = 'center'; el.style.padding = '0'; el.style.gap = '0'; }
        setTimeout(() => { if (!el.classList.contains('pp-island-live')) { el.innerHTML = ''; delete el.dataset.cid; if (isExt) el.style.display = 'none'; } }, 560);
        return;
    }
    el.dataset.cid = state.cid;
    if (isExt) el.style.display = 'flex';
    const av = state.avatar
        ? `<img class="pp-island-av" src="${esc(state.avatar)}" onerror="this.style.visibility='hidden'">`
        : `<span class="pp-island-av pp-island-av-fb">${esc((state.name || '?')[0])}</span>`;
    const body = state.kind === 'typing'
        ? `<div class="pp-island-typing"><span></span><span></span><span></span></div>`
        : `<div class="pp-island-msg">${esc(state.text || '')}</div>`;
    el.innerHTML = `${av}<div class="pp-island-body"><div class="pp-island-name">${esc(state.name)}</div>${body}</div>`;
    void el.offsetWidth;
    requestAnimationFrame(() => {
        el.classList.add('pp-island-live');
        if (isExt) {
            el.style.width = 'min(340px, 92vw)';
            el.style.height = '66px';
            el.style.borderRadius = '30px';
            el.style.justifyContent = 'flex-start';
            el.style.padding = '0 16px';
            el.style.gap = '12px';
        }
    });
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
function islandTyping(c) { clearTimeout(ppIslandTimer); ppIslandState = { cid: c.id, name: dname(c), avatar: c.avatar, kind: 'typing' }; islandRefresh(); }
function islandShowReplies(c, lines) {
    clearTimeout(ppIslandTimer);
    let i = 0;
    const step = () => {
        if (i >= lines.length) { ppIslandState = null; islandRefresh(); return; }
        ppIslandState = { cid: c.id, name: dname(c), avatar: c.avatar, kind: 'msg', text: lines[i] };
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
function ppTogglePin(id) {
    const cfg = getCfg();
    if (!cfg.pinned) cfg.pinned = [];
    const i = cfg.pinned.indexOf(id);
    if (i >= 0) cfg.pinned.splice(i, 1); else cfg.pinned.push(id);
    saveCfg();
    renderContactList();
    ppToast(i >= 0 ? 'เลิกปักหมุด' : 'ปักหมุดแล้ว');
}
function ppDeleteChat(id) {
    const cfg = getCfg();
    cfg.contacts = cfg.contacts.filter(x => x.id !== id);
    delete cfg.threads[id];
    delete cfg.chatStyle[id];
    if (cfg.botNotes) delete cfg.botNotes[id];
    cfg.pinned = (cfg.pinned || []).filter(x => x !== id);
    cfg.callLog = (cfg.callLog || []).filter(l => l.cid !== id);
    saveCfg();
    renderNotesRow();
    renderContactList();
    ppToast('ลบแชทแล้ว — เพิ่มใหม่ได้จากปุ่ม +');
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

// ── รวมจักรวาลแบบ A: บอทเอ่ยชื่อคอนแทกต์อื่น → คนนั้นถึงมีสิทธิ์ทักตามมา ──
function findMentionedContact(text, excludeId) {
    const s = String(text || '');
    // เรียงตามความยาวชื่อ (ยาวก่อน) กันชื่อสั้นซ้อนชื่อยาว
    const cands = getContacts()
        .filter(c => c.id !== excludeId)
        .map(c => ({ c, names: [c.name, c.customName].filter(Boolean) }))
        .sort((a, b) => Math.max(...b.names.map(n => n.length)) - Math.max(...a.names.map(n => n.length)));
    for (const { c, names } of cands) {
        for (const nm of names) {
            if (nm && nm.length >= 2 && s.includes(nm)) return c;
        }
    }
    return null;
}
async function universeInterject(interloper, aboutName) {
    // บอทที่ถูกเอ่ยถึง ทักเข้ามาในแชทของตัวเอง — ป้อนแค่ persona ตัวเอง (ไม่รู้จักคนอื่น)
    try {
        const userName = getUserName();
        const persona = getContactPersona(interloper.id);
        const th = getThread(interloper.id).slice(-6);
        const histTxt = th.map(m => {
            if (m.type === 'call') return `[${m.text}]`;
            return `${m.from === 'me' ? userName : dname(interloper)}: ${m.text}`;
        }).join('\n');
        const prompt = [
            `[Text messaging app — you are ${dname(interloper)}, messaging ${userName} right now.]`,
            persona ? `Character info for ${dname(interloper)}: ${persona}` : null,
            histTxt ? `\nEarlier messages with ${userName}:\n${histTxt}` : `\nYou haven't talked with ${userName} in a while.`,
            `\nYou suddenly feel like reaching out to ${userName}. Send a short spontaneous message (1-2 short lines) as if messaging on your own.`,
            `Reply in the SAME language ${userName} uses (Thai if Thai). No emoji. No asterisks. No name prefix. No tags.`,
        ].filter(Boolean).join('\n');
        let raw = await genWithRetry(prompt, 2);
        const nameRx = new RegExp('^' + dname(interloper).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'gim');
        raw = raw.replace(nameRx, '').trim();
        const lines = raw.split(/\n+/).map(l => stripEmoji(l.trim().replace(/^["'“”‘’]|["'“”‘’]$/g, '')).trim()).filter(Boolean).slice(0, 2);
        if (!lines.length) return;
        const arr = getThread(interloper.id);
        lines.forEach(t => arr.push({ from: 'them', text: t, ts: Date.now() }));
        saveCfg();
        renderContactList();
        islandShowReplies(interloper, [lines[0]]);
    } catch (e) { console.warn('[pocket-phone] universe interject failed', e); }
}

async function ppGenerateReply() {
    const c = ppActiveContact;
    if (!c || ppGeneratingId || ppCall) return;
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
    let botCalls = false;
    let mentioned = null;
    try {
        const userName = getUserName();
        const persona = getContactPersona(c.id);
        const un = getUserNote();
        const th = getThread(c.id).slice(-16);
        const histTxt = th.map(m => {
            if (m.type === 'call') return `[${m.text}]`;
            return `${m.from === 'me' ? userName : dname(c)}: ${m.text}`;
        }).join('\n');

        const prompt = [
            `[Text messaging app — you are ${dname(c)}, chatting with ${userName}.]`,
            persona ? `Character info for ${dname(c)}: ${persona}` : null,
            un ? `IMPORTANT: ${userName} just posted a status note that says: "${un.text}". You can see it. React to it naturally if it fits.` : null,
            histTxt ? `\n<history>\n${histTxt}\n</history>` : null,
            `\nReply in character as ${dname(c)} with short, natural text messages (1-3 short lines).`,
            `Reply in the SAME language the conversation is using (Thai if they use Thai).`,
            getCfg().botCallKeyword ? `If ${dname(c)} would rather call than text right now, include a phrase like "โทรหา"/"เดี๋ยวโทร"/"calling you" — the app turns it into a call.` : null,
            `You may set your own status note by adding a final line "[NOTE] your short status" (optional, only if it fits).`,
            `STRICT: no emoji at all. No asterisk actions. No name prefix. No think/tags (except the optional [NOTE] line). Plain text only.`,
        ].filter(Boolean).join('\n');

        let raw = await genWithRetry(prompt, 3);
        const nameRx = new RegExp('^' + dname(c).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'gim');
        raw = raw.replace(nameRx, '').trim();

        const noteMatch = raw.match(/\[NOTE\]\s*(.+)$/im);
        if (noteMatch) {
            setBotNote(c.id, stripEmoji(noteMatch[1].trim()));
            raw = raw.replace(/\[NOTE\]\s*.+$/im, '').trim();
        }

        const lines = raw.split(/\n+/)
            .map(l => stripEmoji(l.trim().replace(/^["'“”‘’]|["'“”‘’]$/g, '')).trim())
            .filter(Boolean)
            .slice(0, 3);

        if (!lines.length) { failed = true; }
        else if (getCfg().botCallKeyword && ppViewing(c) && lines.some(wantsToCall)) {
            botCalls = true;
        } else {
            const threadArr = getThread(c.id);
            for (let i = 0; i < lines.length; i++) {
                await new Promise(r => setTimeout(r, i === 0 ? 300 : 500 + Math.random() * 400));
                threadArr.push({ from: 'them', text: lines[i], ts: Date.now() });
                produced.push(lines[i]);
                saveCfg();
                if (ppViewing(c)) renderThread();
            }
            // รวมจักรวาลแบบ A: ถ้าบอทเอ่ยชื่อคอนแทกต์อื่น คนนั้นถึงมีสิทธิ์ทักตามมา
            if (getCfg().sharedUniverse) mentioned = findMentionedContact(lines.join(' '), c.id);
        }
    } catch (e) {
        failed = true;
        console.error('[pocket-phone] generate', e);
    } finally {
        ppGeneratingId = null;
        hideTyping();
        if (genBtn) genBtn.disabled = false;
        renderNotesRow();
        if (botCalls) {
            islandCollapse();
            ppIncomingCall(c);
        } else if (failed) {
            islandCollapse();
            ppToast('เชื่อมต่อไม่ได้ ลองกดปุ่มฟ้าอีกครั้ง');
            if (ppViewing(c)) renderThread(); else renderContactList();
        } else {
            if (ppViewing(c)) { renderThread(); islandCollapse(); }
            else { renderContactList(); if (produced.length) islandShowReplies(c, produced); else islandCollapse(); }
            // มีเหตุผลรองรับ: คนที่ถูกเอ่ยถึงถึงทักตามมา (หน่วงสักครู่)
            if (mentioned) setTimeout(() => universeInterject(mentioned, dname(c)), 1600);
        }
    }
}

// pocket-phone/index.js — 0.9.2 — ท่อน 3/3 (ระบบโทร → settings → boot → CSS)
// ต่อจากท่อน 2/3 ที่จบตรง ppGenerateReply

// ── phone Settings render ──
function renderPhoneSettings() {
    const cfg = getCfg();
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.checked = val; };
    set('pp-set-dark', cfg.theme === 'dark');
    set('pp-set-island', cfg.dynamicIsland);
    set('pp-set-scope2', cfg.islandScope === 'always');
    set('pp-set-botcall', cfg.botCallKeyword);
    set('pp-set-universe', cfg.sharedUniverse);
    set('pp-set-affectrp', cfg.universeAffectsRP);
    set('pp-set-avauto', cfg.userAvatarMode === 'auto');
    const ac = document.getElementById('pp-set-accent'); if (ac) ac.value = cfg.accent || '#0a84ff';
    const bl = document.getElementById('pp-set-blur'); if (bl) bl.value = cfg.homeBlur ?? 6;
    const upWrap = document.getElementById('pp-user-av-upload-wrap');
    if (upWrap) upWrap.style.display = cfg.userAvatarMode === 'custom' ? 'inline-flex' : 'none';
    const wpWrap = document.getElementById('pp-set-wp-swatches');
    if (wpWrap) {
        wpWrap.innerHTML = Object.keys(WALLPAPERS).map(k =>
            `<button class="pp-wp-swatch${(cfg.wallpaper || 'aurora') === k ? ' on' : ''}" data-wp="${k}" style="background:${WALLPAPERS[k]};background-size:cover"></button>`).join('') +
            `<button class="pp-wp-swatch${cfg.wallpaper === 'custom' ? ' on' : ''}" data-wp="custom" style="background:var(--pp-bg3)">รูป</button>`;
    }
}

// ── CALL SYSTEM ──
let ppCall = null;

function ppStartCall() {
    const c = ppActiveContact; if (!c || ppCall) return;
    ppCall = { c, incoming: false, connected: false, startTs: 0, timer: null, generating: false, transcript: [] };
    ppRenderCallScreen(c, 'กำลังโทร…', false);
    ppNav('call');
    setTimeout(() => { if (ppCall) ppConnectCall(); }, 1500 + Math.random() * 1200);
}
function ppIncomingCall(c) {
    if (!c || ppCall) return;
    ppCall = { c, incoming: true, connected: false, startTs: 0, timer: null, generating: false, transcript: [] };
    ppRenderCallScreen(c, 'สายเรียกเข้า', true);
    ppNav('call');
    islandTyping(c);
}
function ppRenderCallScreen(c, status, ringing) {
    const scr = document.getElementById('pp-scr-call'); if (!scr) return;
    scr.classList.toggle('ringing', !!ringing);
    const sub = document.getElementById('pp-call-sub'); if (sub) sub.textContent = ringing ? 'Pocket Phone Audio' : 'Pocket Phone';
    const nm = document.getElementById('pp-call-name'); if (nm) nm.textContent = dname(c);
    const st = document.getElementById('pp-call-status'); if (st) st.textContent = status;
    const dur = document.getElementById('pp-call-dur'); if (dur) dur.style.display = 'none';
    const av = document.getElementById('pp-call-av'); if (av) av.innerHTML = contactAvatarHTML(c, 116);
    const bg = document.getElementById('pp-call-bg');
    if (bg) { bg.style.backgroundImage = c.avatar ? `url(${c.avatar})` : ''; bg.style.background = c.avatar ? '' : 'radial-gradient(circle at 50% 30%,#2a2a3a,#0a0a12)'; }
    const stage = document.getElementById('pp-call-stage'); if (stage) stage.innerHTML = '';
}
function ppConnectCall() {
    if (!ppCall) return;
    ppCall.connected = true;
    ppCall.startTs = Date.now();
    islandCollapse();
    const scr = document.getElementById('pp-scr-call'); if (scr) scr.classList.remove('ringing');
    const st = document.getElementById('pp-call-status'); if (st) st.textContent = 'เชื่อมต่อแล้ว';
    const dur = document.getElementById('pp-call-dur'); if (dur) dur.style.display = 'block';
    ppCall.timer = setInterval(() => {
        if (!ppCall || !ppCall.connected) return;
        const s = Math.floor((Date.now() - ppCall.startTs) / 1000);
        const d = document.getElementById('pp-call-dur');
        if (d) d.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }, 500);
    setTimeout(() => { const st2 = document.getElementById('pp-call-status'); if (st2 && ppCall) st2.textContent = ''; }, 2500);
    if (ppCall.incoming) setTimeout(() => ppCallGenerate(true), 600);
}
function ppAcceptCall() { if (ppCall && ppCall.incoming && !ppCall.connected) ppConnectCall(); }
function ppDeclineCall() { if (ppCall) ppEndCall(true); }

function ppCallEmit(text, who) {
    const stage = document.getElementById('pp-call-stage'); if (!stage) return;
    const line = document.createElement('div');
    line.className = 'pp-call-line ' + (who === 'me' ? 'me' : 'them');
    line.textContent = text;
    stage.appendChild(line);
    requestAnimationFrame(() => line.classList.add('show'));
    while (stage.children.length > 4) stage.removeChild(stage.firstChild);
    stage.scrollTop = stage.scrollHeight;
    const life = Math.min(9000, 3200 + text.length * 90);
    setTimeout(() => { line.classList.add('fade'); setTimeout(() => line.remove(), 900); }, life);
}
function ppCallSend() {
    if (!ppCall || !ppCall.connected) return;
    const inp = document.getElementById('pp-call-input');
    const t = (inp.value || '').trim(); if (!t) return;
    inp.value = ''; inp.style.height = 'auto';
    ppCallEmit(t, 'me');
    ppCall.transcript.push({ from: 'me', text: t });
}
async function ppCallGenerate(opener) {
    if (!ppCall || !ppCall.connected || ppCall.generating) return;
    const c = ppCall.c;
    const inp = document.getElementById('pp-call-input');
    if (inp && inp.value.trim() && !opener) ppCallSend();
    ppCall.generating = true;
    const ty = document.getElementById('pp-call-typing'); if (ty) ty.classList.add('show');
    try {
        const userName = getUserName();
        const persona = getContactPersona(c.id);
        const tr = (ppCall.transcript || []).slice(-10)
            .map(m => `${m.from === 'me' ? userName : dname(c)}: ${m.text}`).join('\n');
        const prompt = [
            `[Phone call — you are ${dname(c)}, on a voice call with ${userName}${opener ? ' that you just started' : ''}.]`,
            persona ? `Character info for ${dname(c)}: ${persona}` : null,
            tr ? `\nCall so far:\n${tr}` : null,
            opener ? `\nYou called ${userName}. Open the call — say why you're calling, in your own voice.` : `\nContinue the call naturally.`,
            `\nSpeak as ${dname(c)} out loud. Break your speech into SHORT separate lines (one thought or sentence per line), the way people actually talk on the phone — not one long block.`,
            `Reply in the SAME language ${userName} uses (Thai if Thai). No emoji. No asterisks. No stage directions. No name prefix. No tags.`,
            `If you want to end the call, say a natural goodbye (บาย / ไว้คุยกันใหม่ / แล้วเจอกัน).`,
        ].filter(Boolean).join('\n');

        let raw = await genWithRetry(prompt, 3);
        const nameRx = new RegExp('^' + dname(c).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'gim');
        raw = raw.replace(nameRx, '').replace(/\*[^*]*\*/g, '').trim();
        const lines = raw.split(/\n+/)
            .map(l => stripEmoji(l.trim().replace(/^["'“”‘’]|["'“”‘’]$/g, '')).trim())
            .filter(Boolean).slice(0, 5);
        if (!lines.length) lines.push('…');

        if (ty) ty.classList.remove('show');
        let saidBye = false;
        for (let i = 0; i < lines.length; i++) {
            if (!ppCall) break;
            ppCallEmit(lines[i], 'them');
            ppCall.transcript.push({ from: 'them', text: lines[i] });
            if (isFarewell(lines[i])) saidBye = true;
            await new Promise(r => setTimeout(r, 700 + Math.min(2600, lines[i].length * 55)));
        }
        if (saidBye && ppCall) { await new Promise(r => setTimeout(r, 1400)); if (ppCall) ppEndCall(); }
    } catch (e) {
        if (ty) ty.classList.remove('show');
        ppCallEmit('สายไม่ชัด ลองใหม่นะ', 'them');
        console.error('[pocket-phone] call gen', e);
    } finally {
        if (ppCall) ppCall.generating = false;
    }
}
function ppEndCall(declined) {
    if (!ppCall) return;
    const c = ppCall.c;
    const connected = ppCall.connected;
    const secs = connected ? Math.floor((Date.now() - ppCall.startTs) / 1000) : 0;
    if (ppCall.timer) clearInterval(ppCall.timer);
    const transcript = ppCall.transcript || [];
    const cfg = getCfg();
    if (!cfg.callLog) cfg.callLog = [];
    cfg.callLog.push({
        cid: c.id, name: dname(c), avatar: c.avatar,
        startISO: new Date().toISOString(),
        durText: connected ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : (declined ? 'ปฏิเสธ' : 'ไม่รับสาย'),
        incoming: ppCall.incoming, transcript,
    });
    if (connected) {
        getThread(c.id).push({ from: 'them', type: 'call', text: `โทรคุยกัน ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, ts: Date.now() });
    }
    saveCfg();
    const av = document.getElementById('pp-callend-av'); if (av) av.innerHTML = contactAvatarHTML(c, 108);
    const nm = document.getElementById('pp-callend-name'); if (nm) nm.textContent = dname(c);
    const sub = document.getElementById('pp-callend-sub'); if (sub) sub.textContent = connected ? 'สายสิ้นสุด' : (declined ? 'ปฏิเสธสาย' : 'ไม่ได้รับสาย');
    const dur = document.getElementById('pp-callend-dur'); if (dur) dur.textContent = connected ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '';
    const bg = document.getElementById('pp-callend-bg');
    if (bg) { bg.style.backgroundImage = c.avatar ? `url(${c.avatar})` : ''; bg.style.background = c.avatar ? '' : 'radial-gradient(circle at 50% 30%,#2a2a3a,#0a0a12)'; }
    ppCall = null;
    islandCollapse();
    ppNav('callend');
}

// ── call log (แยกต่อแชท) ──
function renderCallLog() {
    const list = document.getElementById('pp-calllog-list');
    if (!list) return;
    const cfg = getCfg();
    let logs = (cfg.callLog || []).map((l, gi) => ({ ...l, gi }));
    if (ppCallLogFilter) logs = logs.filter(l => l.cid === ppCallLogFilter);
    logs.reverse();
    const title = document.getElementById('pp-calllog-title');
    if (title) title.textContent = ppCallLogFilter ? `สายกับ ${logs[0] ? logs[0].name : ''}` : 'ประวัติการโทร';
    if (!logs.length) { list.innerHTML = `<div class="pp-empty">ยังไม่มีสาย</div>`; return; }
    list.innerHTML = logs.map(l => {
        const d = new Date(l.startISO);
        const when = `${fmtListTime(d.getTime())} · ${fmtHM(d)}`;
        const del = ppCallLogEdit ? `<button class="pp-cs-btn" data-dellog="${l.gi}" style="padding:6px 10px;background:rgba(255,69,58,.85);color:#fff;flex-shrink:0">${ICON.trash}</button>` : `<span style="font-size:13px;color:var(--pp-txt3);flex-shrink:0">${esc(l.durText)}</span>`;
        return `<div class="pp-row" data-showtr="${l.gi}">
            ${contactAvatarHTML({ name: l.name, avatar: l.avatar }, 46)}
            <div class="pp-row-meta">
                <div class="pp-row-name">${l.incoming ? '↙ ' : '↗ '}${esc(l.name)}</div>
                <div class="pp-row-preview">${esc(when)}</div>
            </div>
            ${del}
        </div>`;
    }).join('');
}
function showTranscript(gi) {
    const l = (getCfg().callLog || [])[gi];
    if (!l) return;
    const body = document.getElementById('pp-transcript-body');
    const title = document.getElementById('pp-transcript-title');
    if (title) title.textContent = `สายกับ ${l.name} · ${l.durText}`;
    if (body) {
        body.innerHTML = (l.transcript && l.transcript.length)
            ? l.transcript.map(m => `<div class="pp-brow ${m.from === 'me' ? 'out' : 'in'}"><div class="pp-bubble tail">${esc(m.text)}</div></div>`).join('')
            : `<div class="pp-sys">ไม่มีบทสนทนาในสายนี้</div>`;
    }
    ppNav('transcript');
}

// ── inject phone ──
function injectPhone() {
    if (document.getElementById('pp-dialog')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = buildPhone();
    document.body.appendChild(wrap.firstElementChild);

    const dlg = document.getElementById('pp-dialog');
    dlg?.addEventListener('cancel', e => { e.preventDefault(); ppClose(); });

    document.getElementById('pp-frame')?.addEventListener('click', e => {
        const t = e.target.closest('[data-nav],[data-cid],[data-add],[data-del],[data-pin],[data-delchat],[data-chatbg],[data-wp],[data-usernote],[data-botnote],[data-showtr],[data-dellog],#pp-close-btn,#pp-chat-menu-btn,#pp-chat-call-btn,#pp-edit-toggle,#pp-calllog-btn,#pp-rename-save,#pp-bubble-clear,#pp-list-edit-btn,#pp-gen,#pp-regen-btn,#pp-call-gen,#pp-call-end,#pp-call-accept,#pp-call-decline,#pp-callend-ok,#pp-calllog-back,#pp-calllog-edit-btn,#pp-help-botcall,#pp-help-universe,#pp-help-affectrp,#pp-island,.pp-cc');
        if (!t) return;

        if (t.id === 'pp-close-btn') return ppClose();
        if (t.dataset && t.dataset.nav) return ppNav(t.dataset.nav);
        if (t.dataset && t.dataset.cid) return ppOpenThread(t.dataset.cid);
        if (t.dataset && t.dataset.add) return ppAddContact(t.dataset.add);
        if (t.dataset && t.dataset.del != null) return ppDeleteMsg(+t.dataset.del);
        if (t.dataset && t.dataset.pin) return ppTogglePin(t.dataset.pin);
        if (t.dataset && t.dataset.delchat) return ppDeleteChat(t.dataset.delchat);
        if (t.dataset && t.dataset.chatbg != null && ppActiveContact) { getChatStyle(ppActiveContact.id).bg = t.dataset.chatbg; saveCfg(); applyChatStyle(); markChatSwatches(); return; }
        if (t.dataset && t.dataset.wp) { if (t.dataset.wp === 'custom') { document.getElementById('pp-set-wp-file')?.click(); } else { getCfg().wallpaper = t.dataset.wp; saveCfg(); applyWallpaper(); renderPhoneSettings(); } return; }
        if (t.dataset && t.dataset.showtr != null) return showTranscript(+t.dataset.showtr);
        if (t.dataset && t.dataset.dellog != null) { const cfg = getCfg(); cfg.callLog.splice(+t.dataset.dellog, 1); saveCfg(); renderCallLog(); return; }

        if (t.dataset && t.dataset.usernote != null) {
            const cur = getUserNote();
            return ppPrompt('โน้ตของคุณ (24 ชม.)', cur ? cur.text : '', v => { setUserNote(v); renderNotesRow(); ppToast(v ? 'ลงโน้ตแล้ว' : 'ลบโน้ตแล้ว'); });
        }
        if (t.dataset && t.dataset.botnote) {
            const bn = getBotNote(t.dataset.botnote);
            const cc = getContacts().find(x => x.id === t.dataset.botnote);
            if (bn) return ppHelpPopup(`โน้ตของ ${cc ? dname(cc) : ''} · ${fmtNoteAge(bn.ts)}`, esc(bn.text));
            return;
        }

        if (t.id === 'pp-chat-call-btn') return ppStartCall();
        if (t.id === 'pp-chat-menu-btn') return toggleChatSettings();
        if (t.id === 'pp-edit-toggle') { ppEditMode = !ppEditMode; renderThread(); const b = document.getElementById('pp-edit-toggle'); if (b) b.classList.toggle('on', ppEditMode); return; }
        if (t.id === 'pp-list-edit-btn') { ppListEditMode = !ppListEditMode; renderContactList(); const b = document.getElementById('pp-list-edit-btn'); if (b) b.textContent = ppListEditMode ? 'เสร็จ' : 'แก้ไข'; return; }
        if (t.id === 'pp-rename-save' && ppActiveContact) {
            const v = (document.getElementById('pp-rename-input')?.value || '').trim();
            const stored = getContacts().find(x => x.id === ppActiveContact.id);
            if (stored) { stored.customName = v || undefined; ppActiveContact.customName = v || undefined; saveCfg(); renderThread(); renderContactList(); ppToast('เปลี่ยนชื่อแล้ว'); }
            return;
        }
        if (t.id === 'pp-bubble-clear' && ppActiveContact) { getChatStyle(ppActiveContact.id).bubbleImg = false; saveCfg(); applyChatStyle(); ppToast('ล้างรูปฟองแล้ว'); return; }
        if (t.id === 'pp-calllog-btn' && ppActiveContact) { ppCallLogFilter = ppActiveContact.id; ppCallLogEdit = false; return ppNav('calllog'); }
        if (t.id === 'pp-calllog-back') { ppCallLogFilter = null; return ppNav(ppActiveContact ? 'chat' : 'messages'); }
        if (t.id === 'pp-calllog-edit-btn') { ppCallLogEdit = !ppCallLogEdit; renderCallLog(); const b = document.getElementById('pp-calllog-edit-btn'); if (b) b.textContent = ppCallLogEdit ? 'เสร็จ' : 'แก้ไข'; return; }
        if (t.id === 'pp-gen') return ppGenerateReply();
        if (t.id === 'pp-regen-btn') return ppRegenerate();
        if (t.id === 'pp-call-gen') return ppCallGenerate(false);
        if (t.id === 'pp-call-end') return ppEndCall();
        if (t.id === 'pp-call-accept') return ppAcceptCall();
        if (t.id === 'pp-call-decline') return ppDeclineCall();
        if (t.id === 'pp-callend-ok') return ppNav(ppActiveContact ? 'chat' : 'messages');
        if (t.id === 'pp-island' && t.dataset.cid) { const c = getContacts().find(x => x.id === t.dataset.cid); if (c) { ppActiveContact = c; ppNav('chat'); } return; }
        if (t.classList && t.classList.contains('pp-cc')) { t.classList.toggle('on'); return; }
        if (t.id === 'pp-help-botcall') return ppHelpPopup('บอทโทรหา', 'เมื่อเปิด: ถ้าบอทตอบแล้วมีคำแนวจะโทร (โทรหา / เดี๋ยวโทร / calling you) แอปจะเปลี่ยนเป็นสายเรียกเข้าให้อัตโนมัติ<br><br>ใช้คีย์เวิร์ดจับ ไม่มี generation เพิ่ม ไม่กินโทเคน<br><br>ปิด = บอทไม่โทรเข้าเอง คุณยังกดโทรออกหาบอทได้ปกติ');
        if (t.id === 'pp-help-universe') return ppHelpPopup('บอท/NPC ทักข้ามแชท', 'เมื่อเปิด: ถ้าบอทที่คุยด้วย "เอ่ยชื่อ" คอนแทกต์อีกคนในคำตอบ คนนั้นจะทักเข้ามาเองตามมา — มีเหตุผลรองรับในบทสนทนา ไม่ใช่โผล่มาลอย ๆ ตัวละครไม่รู้จักกัน (ป้อนแค่บุคลิกของคนที่ทัก)<br><br>ต้นทุน: ตอนมีคนทักเข้ามา = +1 generation (~input 300–700 โทเคน)<br><br>ปิด = แต่ละแชทแยกกันเหมือนเดิม');
        if (t.id === 'pp-help-affectrp') return ppHelpPopup('มีผลต่อโรลเพลย์หลัก', 'เมื่อเปิด: สรุปสั้น ๆ ของสิ่งที่เกิดในมือถือจะถูกส่งเข้าบทหลักของ SillyTavern เผื่อให้ตัวละครหลักรับรู้<br><br>ต้นทุน: เพิ่ม context ทุกข้อความในบทหลัก (~+100–300 โทเคน/ข้อความ ตราบใดที่ยังมีเหตุการณ์ค้าง)<br><br>ปิด = ทุกอย่างในมือถืออยู่แค่ในมือถือ ไม่กระทบบทหลัก');
    });

    const chatInput = document.getElementById('pp-input');
    if (chatInput) {
        chatInput.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(120, this.scrollHeight) + 'px'; });
        chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ppSendUserMessage(); } });
    }
    const callInput = document.getElementById('pp-call-input');
    if (callInput) {
        callInput.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(90, this.scrollHeight) + 'px'; });
        callInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ppCallSend(); } });
    }
    document.getElementById('pp-msg-search')?.addEventListener('input', e => renderContactList(e.target.value));

    const bind = (id, fn) => document.getElementById(id)?.addEventListener('change', fn);
    bind('pp-set-dark', e => { getCfg().theme = e.target.checked ? 'dark' : 'light'; saveCfg(); applyTheme(); });
    bind('pp-set-island', e => { getCfg().dynamicIsland = e.target.checked; saveCfg(); applyIsland(); });
    bind('pp-set-scope2', e => { getCfg().islandScope = e.target.checked ? 'always' : 'phone'; saveCfg(); });
    bind('pp-set-botcall', e => { getCfg().botCallKeyword = e.target.checked; saveCfg(); });
    bind('pp-set-universe', e => { getCfg().sharedUniverse = e.target.checked; saveCfg(); });
    bind('pp-set-affectrp', e => { getCfg().universeAffectsRP = e.target.checked; saveCfg(); });
    bind('pp-set-avauto', async e => { getCfg().userAvatarMode = e.target.checked ? 'auto' : 'custom'; saveCfg(); await refreshUserAvatar(); renderPhoneSettings(); renderNotesRow(); });
    document.getElementById('pp-set-accent')?.addEventListener('input', e => { getCfg().accent = e.target.value; saveCfg(); applyTheme(); });
    document.getElementById('pp-set-blur')?.addEventListener('input', e => { getCfg().homeBlur = +e.target.value; saveCfg(); applyWallpaper(); });

    const fileToMedia = (inputId, key, after) => {
        document.getElementById(inputId)?.addEventListener('change', e => {
            const f = e.target.files && e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = async () => { await saveMedia(key(), r.result); if (after) await after(); };
            r.readAsDataURL(f);
            e.target.value = '';
        });
    };
    fileToMedia('pp-set-wp-file', () => 'home-wp', async () => { getCfg().wallpaper = 'custom'; saveCfg(); applyWallpaper(); renderPhoneSettings(); ppToast('ตั้งวอลเปเปอร์แล้ว'); });
    fileToMedia('pp-user-av-file', () => 'user-avatar', async () => { getCfg().userAvatarMode = 'custom'; saveCfg(); await refreshUserAvatar(); renderPhoneSettings(); renderNotesRow(); ppToast('ตั้งรูปโปรไฟล์แล้ว'); });
    fileToMedia('pp-chatbg-file', () => 'chatbg-' + (ppActiveContact ? ppActiveContact.id : 'x'), async () => { if (ppActiveContact) { getChatStyle(ppActiveContact.id).bg = 'custom'; saveCfg(); applyChatStyle(); markChatSwatches(); ppToast('ตั้งพื้นหลังแชทแล้ว'); } });
    fileToMedia('pp-bubbleimg-file', () => 'bubbleimg-' + (ppActiveContact ? ppActiveContact.id : 'x'), async () => { if (ppActiveContact) { getChatStyle(ppActiveContact.id).bubbleImg = true; saveCfg(); applyChatStyle(); ppToast('ตั้งรูปฟองแล้ว'); } });

    document.getElementById('pp-bubble-color')?.addEventListener('input', e => { if (ppActiveContact) { getChatStyle(ppActiveContact.id).bubble = e.target.value; getChatStyle(ppActiveContact.id).bubbleImg = false; saveCfg(); applyChatStyle(); } });
    document.getElementById('pp-text-color')?.addEventListener('input', e => { if (ppActiveContact) { getChatStyle(ppActiveContact.id).textColor = e.target.value; saveCfg(); applyChatStyle(); } });
}

// ── FAB + external island + settings panel + boot ──
function injectFab() {
    if (document.getElementById('pp-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'pp-fab';
    fab.title = 'Pocket Phone';
    fab.innerHTML = ICON.messages;
    fab.style.cssText = 'position:fixed;right:16px;bottom:120px;width:48px;height:48px;border-radius:50%;border:none;z-index:2147483000;background:linear-gradient(160deg,#0a84ff,#0060df);color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer;display:flex;align-items:center;justify-content:center;';
    fab.querySelector('svg')?.setAttribute('width', '24');
    fab.querySelector('svg')?.setAttribute('height', '24');
    fab.addEventListener('click', ppOpen);
    document.body.appendChild(fab);
}
function injectExternalIsland() {
    if (document.getElementById('pp-ext-island')) return;
    const el = document.createElement('div');
    el.id = 'pp-ext-island';
    el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);width:120px;height:34px;border-radius:20px;background:#000;display:none;z-index:2147482000;overflow:hidden;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.5);transition:width .5s cubic-bezier(.32,1.4,.4,1),height .5s cubic-bezier(.32,1.4,.4,1),border-radius .5s;';
    el.addEventListener('click', () => {
        const cid = el.dataset.cid;
        ppOpen();
        if (cid) { const c = getContacts().find(x => x.id === cid); if (c) { ppActiveContact = c; ppNav('chat'); } }
    });
    document.body.appendChild(el);
}
function registerSettingsPanel() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host || document.getElementById('pp-ext-drawer')) return;
    host.insertAdjacentHTML('beforeend', `
<div id="pp-ext-drawer" class="inline-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>Pocket Phone</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>
  <div class="inline-drawer-content">
    <div style="font-size:12px;opacity:.7;margin-bottom:8px">version <b>${PP_VERSION}</b></div>
    <div style="font-size:12px;opacity:.7;margin-bottom:8px">แตะปุ่มลอยมุมขวาล่างเพื่อเปิดมือถือ</div>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><input type="checkbox" id="pp-ext-island-toggle"> Dynamic Island นอกมือถือ (แม้ปิดมือถือ)</label>
    <input id="pp-ext-open" class="menu_button" type="button" value="เปิดมือถือ">
    <input id="pp-ext-diag" class="menu_button" type="button" value="Diagnostics">
  </div>
</div>`);
    const isl = document.getElementById('pp-ext-island-toggle');
    if (isl) { isl.checked = getCfg().islandScope === 'always'; isl.addEventListener('change', e => { getCfg().islandScope = e.target.checked ? 'always' : 'phone'; saveCfg(); }); }
    document.getElementById('pp-ext-open')?.addEventListener('click', ppOpen);
    document.getElementById('pp-ext-diag')?.addEventListener('click', () => window.PP_DIAG && window.PP_DIAG());
}

window.PP_OPEN = ppOpen;
window.PP_DIAG = function () {
    const rows = {
        version: PP_VERSION,
        loaded: window.PP_LOADED,
        contextOk: !!ctx(),
        genQuiet: !!(ctx() && typeof ctx().generateQuietPrompt === 'function'),
        contacts: getContacts().length,
        userNote: !!getUserNote(),
        sharedUniverse: getCfg().sharedUniverse,
        botCallKeyword: getCfg().botCallKeyword,
    };
    console.table(rows);
    ppToast('Diag → console');
    return rows;
};

function injectCSS() {
    if (document.getElementById('pp-css')) return;
    const s = document.createElement('style');
    s.id = 'pp-css';
    s.textContent = `
.pp-notes-row{display:flex;gap:14px;padding:10px 16px 12px 16px;overflow-x:auto;scrollbar-width:none;border-bottom:.5px solid var(--pp-sep);}
.pp-notes-row::-webkit-scrollbar{display:none;}
.pp-note-item{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;width:64px;}
.pp-note-av-wrap{position:relative;margin-top:22px;}
.pp-note-bubble{position:absolute;bottom:calc(100% - 4px);left:50%;transform:translateX(-50%);background:var(--pp-bg2,#2c2c2e);color:var(--pp-txt);font-size:11px;line-height:1.25;padding:5px 9px;border-radius:12px;white-space:nowrap;max-width:96px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,.3);}
.pp-note-bubble::after{content:'';position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:8px;height:8px;border-radius:50%;background:var(--pp-bg2,#2c2c2e);box-shadow:-5px 3px 0 -2px var(--pp-bg2,#2c2c2e);}
.pp-note-add{opacity:.5;}
.pp-note-name{font-size:11px;color:var(--pp-txt3);max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;}
.pp-note-sep{flex-shrink:0;width:1px;align-self:stretch;margin:22px 2px 0 2px;background:var(--pp-sep);position:relative;}
.pp-note-sep::before{content:attr(data-label);position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--pp-txt3);white-space:nowrap;}
.pp-call-stage{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;padding:20px 28px;overflow:hidden;position:relative;z-index:2;}
.pp-call-line{font-size:19px;line-height:1.45;color:#fff;text-align:center;opacity:0;transform:translateY(12px);transition:opacity .5s,transform .5s;text-shadow:0 2px 12px rgba(0,0,0,.6);}
.pp-call-line.me{font-size:16px;color:rgba(255,255,255,.7);}
.pp-call-line.show{opacity:1;transform:none;}
.pp-call-line.fade{opacity:0;transform:translateY(-10px);}
`;
    document.head.appendChild(s);
}

window.PP_LOADED = 'parsed';
(function boot() {
    injectCSS();
    let tries = 0;
    const timer = setInterval(() => {
        tries++;
        const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
        if (host) {
            clearInterval(timer);
            try {
                injectFab();
                injectPhone();
                injectExternalIsland();
                registerSettingsPanel();
                startClock();
                refreshUserAvatar();
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
