// pocket-phone/index.js — 0.9.7 — ท่อน 1/3 (ต้นไฟล์ → จบ buildPhone)
// เปลี่ยนจาก 0.9.6: extractSpoken เอาเฉพาะข้อความใน " " (ตัดเครื่องหมาย) + fallback กันเงียบ
//   · cleanReply/looksLikeThought แข็งขึ้น · fix multiselect กลุ่ม(data-mscid+stopPropagation)
//   · โน้ต = context ทางเลือก บอทเลือกตอบเอง (logic 2/3) · [ ] = คำสั่งเบื้องหลัง ไม่โชว์
// getContext ล้วน · ไม่มี import/export · lazy + try/catch
// ⚠️ รันเดี่ยวไม่ได้ ต้องแปะครบ 3 ท่อนก่อน

const PP_VERSION = '0.9.7';
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
async function delMedia(key) {
    const store = mediaStore();
    if (store) { try { await store.removeItem(key); } catch {} }
    try { localStorage.removeItem('ppmedia_' + key); } catch {}
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
const STORY_BGS = ['linear-gradient(160deg,#5e5ce6,#bf5af2)', 'linear-gradient(160deg,#ff375f,#ff9f0a)', 'linear-gradient(160deg,#0a84ff,#30d158)', 'linear-gradient(160deg,#1c1c1e,#3a3a3c)', 'linear-gradient(160deg,#ff6482,#ffd60a)'];

const HIST_LIMIT = 50;
const HIST_PAGE = 50;

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
    userAppName: '',
    imageCaptionMode: 'ask',
    stories: [],
    storySeen: {},
    userPersonaMode: 'perchat',
    sharedUserPersonaId: '',
    showFab: true,
    feedPosts: [],
    periods: [],
    groups: [],
    notifCenter: [],
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

// ── ★ 0.9.7 ด่านกรองจุดเดียว ──
const _THOUGHT_TAGS = 'think|thinking|thought|thoughts|reason|reasoning|reflection|reflect|analysis|analyze|analyzing|plan|planning|planner|strategy|scratchpad|inner[_ ]?monologue|monologue|cot|meta|system|note[_ ]?to[_ ]?self';

function cleanReply(t) {
    let s = String(t || '');
    // บล็อกแท็ก ทั้งเปิด-ปิด และเปิดค้าง
    s = s.replace(new RegExp(`<(${_THOUGHT_TAGS})[^>]*>[\\s\\S]*?<\\/(?:${_THOUGHT_TAGS})>`, 'gi'), '');
    s = s.replace(new RegExp(`<(${_THOUGHT_TAGS})[^>]*>[\\s\\S]*`, 'gi'), '');
    // ทั้งบรรทัด TAG: / TAG：
    s = s.replace(new RegExp(`^\\s*(?:${_THOUGHT_TAGS})\\s*[:：].*$`, 'gim'), '');
    // OOC วงเล็บคู่ + แท็ก html ที่เหลือ
    s = s.replace(/\(\([\s\S]*?\)\)/g, '');
    s = s.replace(/<\/?[a-z][^>]*>/gi, '');
    return s.trim();
}

function looksLikeThought(line) {
    const s = String(line || '').trim();
    if (!s) return true;
    if (/^[\[(].*[\])]$/.test(s) && s.length > 6) return true;     // ทั้งบรรทัดในวงเล็บ
    if (/^\*.*\*$/.test(s)) return true;                            // *บรรยาย*
    if (/^_.+_$/.test(s) && s.length > 8) return true;
    if (new RegExp(`^(?:${_THOUGHT_TAGS})\\b\\s*[:\\-–]`, 'i').test(s)) return true;
    if (/^(?:to (?:my|him|her)self|i think to myself|\(thinks?\b|internally\b)/i.test(s)) return true;
    return false;
}

// ★ คำสั่งใน [ ] ที่รับรู้ (parse แยกก่อน ไม่โชว์เป็นข้อความ)
const PP_CMD_RX = /\[(NOTE|VOICE|NOTEREPLY|PP_CALL|PP_MSG|PP_NEWCHAT|LIKES)[^\]]*\][^\n]*/gi;

// ★ 0.9.7 ดึงเฉพาะข้อความใน " " — ตัดเครื่องหมายออก · ที่เหลือปัดตก
// รองรับ " " „ « » 「 」 『 』 ' '
function extractSpoken(raw) {
    let s = String(raw || '');
    s = s.replace(PP_CMD_RX, '');   // เอาคำสั่งออกก่อน (parse แยกที่อื่น)
    s = cleanReply(s);
    const out = [];
    const rx = /["“”„«»「」『』]([^"“”„«»「」『』\r\n]{1,})["“”„«»「」『』]/g;
    let m;
    while ((m = rx.exec(s))) {
        let t = stripEmoji(m[1].trim()).replace(/^[\-–•\s]+/, '').trim();
        if (t && !looksLikeThought(t)) out.push(t);
    }
    return out;
}
// รวม: เอาคำพูดใน " " ก่อน ถ้าไม่มีเลย → fallback กรองรายบรรทัด (กันบอทเงียบ)
function spokenOrFallback(raw, maxLines) {
    const q = extractSpoken(raw);
    if (q.length) return q.slice(0, maxLines || 3);
    let s = String(raw || '').replace(PP_CMD_RX, '');
    s = cleanReply(s);
    const lines = s.split(/\n+/)
        .map(l => stripEmoji(l.trim().replace(/^["'“”‘’„«»「」『』]+|["'“”‘’„«»「」『』]+$/g, '')).trim())
        .filter(Boolean).filter(l => !looksLikeThought(l));
    return lines.slice(0, maxLines || 3);
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
function getUserDisplayName() {
    const cfg = getCfg();
    return (cfg.userAppName && cfg.userAppName.trim()) || getUserName();
}
function dname(c) { return (c && (c.customName || c.name)) || '?'; }
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function newMid() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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
function contactCategory(c) {
    if (isPinned(c.id)) return 'pin';
    if (c.npc) return 'npc';
    return 'char';
}

function mainChatRecap(maxLines) {
    const c = ctx();
    try {
        if (c && Array.isArray(c.chat) && c.chat.length) {
            const lines = c.chat.slice(-(maxLines || 8)).map(m => {
                const who = m.is_user ? getUserDisplayName() : (m.name || 'Char');
                const txt = String(m.mes || '').replace(/<[^>]+>/g, '').replace(/\n+/g, ' ').trim();
                return txt ? `${who}: ${txt.slice(0, 220)}` : '';
            }).filter(Boolean);
            return lines.join('\n');
        }
    } catch {}
    return '';
}

// ── persona ผู้ใช้ ──
function listUserPersonas() {
    const c = ctx();
    try {
        const pu = c && c.powerUserSettings;
        const map = pu && pu.personas;
        const desc = (pu && pu.persona_descriptions) || {};
        if (map && typeof map === 'object') {
            return Object.keys(map).map(av => ({
                id: av, name: map[av] || av, avatar: `/User Avatars/${av}`,
                description: (desc[av] && desc[av].description) || '',
            }));
        }
    } catch {}
    return [];
}
function currentUserPersonaId() {
    const c = ctx();
    try {
        if (c) {
            if (c.userAvatar) return c.userAvatar;
            if (c.user_avatar) return c.user_avatar;
            const pa = c.powerUserSettings?.persona_description_avatar;
            if (pa) return pa;
        }
    } catch {}
    return '';
}
function getEffectiveUserPersona(id) {
    const cfg = getCfg();
    let pid;
    if (cfg.userPersonaMode === 'shared') pid = cfg.sharedUserPersonaId || currentUserPersonaId();
    else pid = getChatStyle(id).userPersonaId || cfg.sharedUserPersonaId || currentUserPersonaId();
    const p = listUserPersonas().find(x => x.id === pid);
    if (p) return { name: p.name, desc: p.description };
    const c = ctx();
    let desc = '';
    try { desc = (c && c.powerUserSettings && c.powerUserSettings.persona_description) || ''; } catch {}
    return { name: getUserDisplayName(), desc };
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
    if (cfg.userAvatarMode === 'custom') { const img = await loadMedia('user-avatar'); ppUserAvatarCache = img || userAvatarAuto(); }
    else ppUserAvatarCache = userAvatarAuto();
    return ppUserAvatarCache;
}
function userAvatarHTML(size) {
    const s = size || 52;
    const src = ppUserAvatarCache;
    const un = getUserDisplayName();
    if (src) {
        return `<img class="pp-avatar" style="width:${s}px;height:${s}px" src="${esc(src)}"
            onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=\\'pp-avatar pp-avatar-fb\\' style=\\'width:${s}px;height:${s}px\\'>${esc(un[0] || 'U')}</span>'))">`;
    }
    return `<span class="pp-avatar pp-avatar-fb" style="width:${s}px;height:${s}px">${esc(un[0] || 'U')}</span>`;
}

function ppNow() { const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
function ppDateLabel() {
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}
const TH_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
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
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'เมื่อกี้';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
    return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}
function chatDividerFull(ts) {
    if (!ts) return '';
    const d = new Date(ts), today = new Date();
    if (d.toDateString() === today.toDateString()) return `วันนี้ ${fmtHM(d)}`;
    return `${TH_DAYS[d.getDay()]} ${d.getDate()} ${TH_MONTHS[d.getMonth()]} · ${fmtHM(d)}`;
}
function chatDivider(prevTs, ts) {
    if (!prevTs || !ts) return '';
    if (ts - prevTs < 300000) return '';
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
        const dl = document.getElementById('pp-home-date'); if (dl) dl.textContent = ppDateLabel();
    };
    tick();
    ppClockTimer = setInterval(tick, 10000);
}

function ppOpen() {
    const dlg = document.getElementById('pp-dialog');
    if (!dlg) return;
    applyTheme(); applyIsland(); applyWallpaper(); startClock();
    refreshUserAvatar(); pruneStories();
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
function applyFab() {
    const fab = document.getElementById('pp-fab');
    if (fab) fab.style.display = getCfg().showFab ? 'flex' : 'none';
}

let ppActiveContact = null;
let ppActiveGroup = null;
let ppGeneratingId = null;
let ppGenAbort = false;
let ppCurrentScreen = 'home';
let ppEditMode = false;
let ppListEditMode = false;
let ppCallLogEdit = false;
let ppCallLogFilter = null;
let ppStoryView = null;
let ppStoryTimer = null;
let ppFeedTab = 'feed';
let ppFeedGenBusy = false;
let ppActivePost = null;
let ppCalMonth = new Date();
let ppHistShown = HIST_PAGE;
let ppChatTab = 'char';
let ppGroupDraft = null;
let ppNewPostDraft = null;

function ppNav(screen) {
    if (screen === 'stories') screen = 'feed';
    ppCurrentScreen = screen;
    document.querySelectorAll('.pp-screen').forEach(s => s.classList.remove('show'));
    if (screen === 'home') { document.getElementById('pp-home')?.classList.add('show'); return; }
    const el = document.getElementById('pp-scr-' + screen);
    if (el) {
        el.classList.add('show');
        if (screen === 'messages') { renderNotesRow(); renderContactList(); }
        if (screen === 'contacts') renderAddContacts();
        if (screen === 'chat') { ppHistShown = HIST_PAGE; renderThread(); }
        if (screen === 'chatsettings') renderChatSettings();
        if (screen === 'groupnew') renderGroupEditor();
        if (screen === 'groupsettings') renderGroupSettings();
        if (screen === 'settings') renderPhoneSettings();
        if (screen === 'calllog') renderCallLog();
        if (screen === 'feed') renderFeed();
        if (screen === 'newpost') renderNewPost();
        if (screen === 'postview') renderPost();
        if (screen === 'period') renderPeriod();
        if (screen === 'profile') renderProfile();
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
function ppActionSheet(items) {
    const host = document.getElementById('pp-frame') || document.body;
    const ov = document.createElement('div');
    ov.className = 'pp-help-ov';
    ov.style.cssText = 'position:absolute;inset:0;z-index:9600;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.4);';
    const btns = items.map((it, i) =>
        `<button data-i="${i}" style="width:100%;background:none;border:none;border-top:${i ? '.5px solid rgba(255,255,255,.12)' : 'none'};color:${it.danger ? '#ff453a' : '#fff'};font-size:17px;padding:15px;cursor:pointer">${esc(it.label)}</button>`
    ).join('');
    ov.innerHTML = `<div style="width:100%;max-width:380px;padding:8px 8px calc(8px + env(safe-area-inset-bottom))">
        <div style="background:rgba(44,44,48,.96);backdrop-filter:blur(30px);border-radius:16px;overflow:hidden;margin-bottom:8px">${btns}</div>
        <button class="pp-sheet-cancel" style="width:100%;background:rgba(60,60,64,.96);backdrop-filter:blur(30px);border:none;color:var(--pp-accent,#0a84ff);font-size:17px;font-weight:600;padding:15px;border-radius:16px;cursor:pointer">ยกเลิก</button>
    </div>`;
    host.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); const it = items[+b.dataset.i]; close(); it.onClick && it.onClick(); }));
    ov.querySelector('.pp-sheet-cancel')?.addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
}
function ppReplyComposer(opts) {
    const host = document.getElementById('pp-frame') || document.body;
    const ov = document.createElement('div');
    ov.className = 'pp-help-ov';
    ov.style.cssText = 'position:absolute;inset:0;z-index:9500;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);box-sizing:border-box;';
    ov.innerHTML = `<div style="background:rgba(44,44,48,.98);backdrop-filter:blur(30px);border-radius:20px 20px 0 0;width:100%;max-width:393px;padding:16px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(0,0,0,.5)">
        <div style="font-size:13px;color:rgba(235,235,245,.6);margin-bottom:8px">${esc(opts.title || 'ตอบกลับ')}</div>
        <div style="background:rgba(120,120,128,.24);border-left:3px solid var(--pp-accent,#0a84ff);border-radius:0 10px 10px 0;padding:8px 12px;margin-bottom:10px">
            <div style="font-size:11px;color:var(--pp-accent,#0a84ff);font-weight:600;margin-bottom:2px">${esc(opts.quotedLabel || 'โน้ต')}</div>
            <div style="font-size:14px;color:#fff;line-height:1.4">${esc(opts.quoted || '')}</div>
        </div>
        <div style="display:flex;align-items:flex-end;gap:8px">
            <textarea class="pp-reply-input" rows="1" placeholder="พิมพ์ตอบ…" style="flex:1;background:rgba(0,0,0,.3);border:none;border-radius:18px;padding:10px 14px;color:#fff;font-size:15px;resize:none;font-family:inherit;line-height:1.4;max-height:100px">${esc(opts.initial || '')}</textarea>
            <button class="pp-reply-send" style="flex-shrink:0;width:38px;height:38px;border-radius:50%;background:var(--pp-accent,#0a84ff);border:none;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">↑</button>
        </div>
    </div>`;
    host.appendChild(ov);
    const ta = ov.querySelector('.pp-reply-input');
    setTimeout(() => ta?.focus(), 60);
    const close = () => ov.remove();
    const submit = () => { const v = (ta.value || '').trim(); if (v) opts.onOk(v); close(); };
    ta.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(100, this.scrollHeight) + 'px'; });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    ov.querySelector('.pp-reply-send')?.addEventListener('click', submit);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
}

// ★ 0.9.7 FIX: multiselect — ใช้ data-mscid + stopPropagation กันเด้งไป delegation หลัก (บั๊กกลุ่มวาร์ป)
function ppMultiSelect(opts) {
    const host = document.getElementById('pp-frame') || document.body;
    const chosen = new Set(opts.selected || []);
    const ov = document.createElement('div');
    ov.className = 'pp-help-ov';
    ov.style.cssText = 'position:absolute;inset:0;z-index:9600;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);';
    const rows = getContacts().map(c =>
        `<button class="pp-ms-row" data-mscid="${esc(c.id)}" style="display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;border-top:.5px solid rgba(255,255,255,.1);padding:11px 14px;color:#fff;cursor:pointer;text-align:left">
            ${contactAvatarHTML(c, 36)}
            <span style="flex:1;font-size:15px">${esc(dname(c))}</span>
            <span class="pp-ms-check" style="width:22px;height:22px;border-radius:50%;border:1.5px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;color:#fff">${chosen.has(c.id) ? ICON.check : ''}</span>
        </button>`).join('');
    ov.innerHTML = `<div style="width:100%;max-width:393px;background:rgba(44,44,48,.98);backdrop-filter:blur(30px);border-radius:20px 20px 0 0;max-height:70%;display:flex;flex-direction:column;padding-bottom:calc(8px + env(safe-area-inset-bottom))">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px">
            <span style="font-size:16px;font-weight:700;color:#fff">${esc(opts.title || 'เลือก')}</span>
            <button class="pp-ms-done" style="background:var(--pp-accent);border:none;color:#fff;border-radius:14px;padding:8px 18px;font-size:15px;font-weight:600;cursor:pointer">เสร็จ</button>
        </div>
        <div style="flex:1;overflow-y:auto">${rows || '<div style="padding:24px;text-align:center;color:rgba(255,255,255,.5)">ยังไม่มีคอนแทกต์</div>'}</div>
    </div>`;
    host.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelectorAll('.pp-ms-row').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.dataset.mscid;
        if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
        b.querySelector('.pp-ms-check').innerHTML = chosen.has(id) ? ICON.check : '';
    }));
    ov.querySelector('.pp-ms-done')?.addEventListener('click', (e) => { e.stopPropagation(); opts.onDone([...chosen]); close(); });
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
function lastTs(id) { const th = getThread(id); const last = th[th.length - 1]; return last ? (last.ts || 0) : 0; }
function getChatStyle(id) {
    const cfg = getCfg();
    if (!cfg.chatStyle[id]) cfg.chatStyle[id] = { bg: '', bubble: '', bubbleImg: false, textColor: '' };
    const s = cfg.chatStyle[id];
    if (s.textColor === undefined) s.textColor = '';
    if (s.personaName === undefined) s.personaName = '';
    if (s.personaDesc === undefined) s.personaDesc = '';
    if (s.userPersonaId === undefined) s.userPersonaId = '';
    return s;
}
function pushThreadMsg(id, msg) {
    getThread(id).push(Object.assign({ ts: Date.now(), mid: newMid() }, msg));
    saveCfg();
}
function findMsgById(threadId, mid) {
    if (!mid) return -1;
    return getThread(threadId).findIndex(m => m.mid === mid);
}
function isPinned(id) { return (getCfg().pinned || []).includes(id); }
function listStCharacters() {
    const c = ctx();
    if (c && Array.isArray(c.characters) && c.characters.length) {
        return c.characters.filter(ch => ch && ch.name && !ch.is_user)
            .map(ch => ({ id: ch.avatar || ch.name, name: ch.name, avatar: ch.avatar ? `/characters/${ch.avatar}` : '', persona: ch.description || ch.personality || '' }));
    }
    return [];
}
function getContactPersona(id) { const ch = listStCharacters().find(x => x.id === id); return ch ? (ch.persona || '') : ''; }
function getEffectivePersona(id) {
    const st = getChatStyle(id);
    const parts = [];
    if (st.personaName) parts.push(`Name: ${st.personaName}`);
    if (st.personaDesc) parts.push(st.personaDesc);
    if (parts.length) return parts.join('\n');
    return getContactPersona(id);
}

// ── กลุ่ม ──
function isGroupId(id) { return typeof id === 'string' && id.startsWith('grp:'); }
function getGroups() { return getCfg().groups || []; }
function getGroup(id) { return getGroups().find(g => g.id === id); }
function groupMemberContacts(g) {
    if (!g) return [];
    return (g.members || []).map(cid => getContacts().find(x => x.id === cid)).filter(Boolean);
}
function groupAvatarHTML(g, size) {
    const s = size || 52;
    const mem = groupMemberContacts(g).slice(0, 2);
    if (!mem.length) return `<span class="pp-avatar pp-avatar-fb" style="width:${s}px;height:${s}px">${esc((g.name || 'G')[0])}</span>`;
    const inner = mem.map((c, i) => `<span class="pp-grp-av-piece pos${i}">${contactAvatarHTML(c, Math.round(s * 0.62))}</span>`).join('');
    return `<span class="pp-grp-av" style="width:${s}px;height:${s}px">${inner}</span>`;
}

const NOTE_TTL = 24 * 3600000;
const STORY_TTL = 24 * 3600000;
function getUserNote() { const n = getCfg().userNote; if (!n || !n.text) return null; if (Date.now() - (n.ts || 0) > NOTE_TTL) return null; return n; }
function getBotNote(cid) { const n = (getCfg().botNotes || {})[cid]; if (!n || !n.text) return null; if (Date.now() - (n.ts || 0) > NOTE_TTL) return null; return n; }
function setUserNote(text) { const cfg = getCfg(); cfg.userNote = text ? { text: String(text).slice(0, 120), ts: Date.now() } : null; saveCfg(); }
function setBotNote(cid, text) {
    const cfg = getCfg();
    if (!cfg.botNotes) cfg.botNotes = {};
    if (text) cfg.botNotes[cid] = { text: String(text).slice(0, 120), ts: Date.now() };
    else delete cfg.botNotes[cid];
    saveCfg();
}

// ── สตอรี่ ──
function getStories() { return getCfg().stories || []; }
function liveStories() { const now = Date.now(); return getStories().filter(s => now - (s.ts || 0) < STORY_TTL); }
function pruneStories() {
    const cfg = getCfg(), now = Date.now(), before = (cfg.stories || []).length;
    cfg.stories = (cfg.stories || []).filter(s => now - (s.ts || 0) < STORY_TTL);
    for (const id of Object.keys(cfg.storySeen || {})) if (!cfg.stories.find(s => s.id === id)) delete cfg.storySeen[id];
    if (cfg.stories.length !== before) saveCfg();
}
function storyAuthorLabel(s) { if (s.author === 'user') return getUserDisplayName(); const c = getContacts().find(x => x.id === s.author); return c ? dname(c) : (s.authorName || '?'); }
function storyAuthorAvatar(s) { if (s.author === 'user') return ppUserAvatarCache || ''; const c = getContacts().find(x => x.id === s.author); return c ? (c.avatar || '') : ''; }
function markStorySeen(id) { const cfg = getCfg(); if (!cfg.storySeen) cfg.storySeen = {}; if (!cfg.storySeen[id]) { cfg.storySeen[id] = true; saveCfg(); } }
function storyHasUnseen(author) { return liveStories().some(s => s.author === author && !(getCfg().storySeen || {})[s.id]); }

// ── Feed ──
function getFeedPosts() { return getCfg().feedPosts || []; }
function feedByTab(tab) { const wantNews = tab === 'news'; return getFeedPosts().filter(p => (p.kind === 'news') === wantNews).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)); }
function findPost(id) { return getFeedPosts().find(p => p.id === id); }
function postTotalLikes(p) { return (p.extraLikes || 0) + ((p.likes || []).length); }
function commentTotalLikes(cm) { return (cm.extraLikes || 0) + ((cm.likes || []).length); }
function topFeedPosts(n) { return getFeedPosts().filter(p => p.kind !== 'news').slice().sort((a, b) => postTotalLikes(b) - postTotalLikes(a)).slice(0, n || 5); }
function postAuthorLabel(p) { if (p.author === 'user') return getUserDisplayName(); const c = getContacts().find(x => x.id === p.author); return c ? dname(c) : (p.authorName || 'ระบบ'); }
function postAuthorAvatar(p) { if (p.author === 'user') return ppUserAvatarCache || ''; const c = getContacts().find(x => x.id === p.author); return c ? (c.avatar || '') : ''; }
function postResponderPool(p) {
    let pool = getContacts().slice();
    if (getCfg().universeAffectsRP) pool = pool.filter(c => c.id !== currentCharacterId());
    if (p && Array.isArray(p.responders) && p.responders.length) pool = pool.filter(c => p.responders.includes(c.id));
    return pool;
}
function feedNpcPool() {
    let pool = getContacts().slice();
    if (getCfg().universeAffectsRP) pool = pool.filter(c => c.id !== currentCharacterId());
    return pool;
}

// ── ประจำเดือน ──
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function getPeriodDays() { return getCfg().periods || []; }
function isPeriodDay(s) { return getPeriodDays().includes(s); }
function togglePeriodDay(s) {
    const cfg = getCfg();
    if (!cfg.periods) cfg.periods = [];
    const i = cfg.periods.indexOf(s);
    if (i >= 0) cfg.periods.splice(i, 1); else cfg.periods.push(s);
    cfg.periods.sort();
    saveCfg();
}
function periodTodayInfo() {
    const days = getPeriodDays(), today = ymd(new Date());
    if (days.includes(today)) {
        let d = 1, cur = new Date();
        while (true) { cur.setDate(cur.getDate() - 1); if (days.includes(ymd(cur))) d++; else break; }
        return { onPeriod: true, dayNum: d };
    }
    const future = days.filter(x => x > today).sort();
    if (future.length) return { onPeriod: false, upcomingIn: Math.round((new Date(future[0]) - new Date(today)) / 86400000) };
    return { onPeriod: false };
}
function periodPromptNote() {
    const info = periodTodayInfo(), un = getUserDisplayName();
    if (info.onPeriod) return `${un} is on their period right now (day ${info.dayNum}). Be gently considerate — they may feel unwell, tired, or moody. Do not make a big awkward deal of it.`;
    if (info.upcomingIn != null && info.upcomingIn <= 3) return `${un}'s period is expected in about ${info.upcomingIn} day(s).`;
    return '';
}

function pushNotif(cid, kind, text) {
    const cfg = getCfg();
    if (!cfg.notifCenter) cfg.notifCenter = [];
    cfg.notifCenter.push({ id: newId(), cid, kind, text: String(text || '').slice(0, 80), ts: Date.now(), seen: false });
    if (cfg.notifCenter.length > 40) cfg.notifCenter = cfg.notifCenter.slice(-40);
    saveCfg();
}

const ICON = {
    messages: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.9 3 3 6.6 3 11c0 2.3 1.1 4.4 2.9 5.8-.2 1.3-.8 2.5-1.6 3.4-.2.2 0 .6.3.5 1.9-.3 3.4-1 4.4-1.6 1 .3 2 .4 3 .4 5.1 0 9-3.6 9-8s-3.9-8-9-8z"/></svg>`,
    feed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>`,
    wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18" stroke-width="2"/><circle cx="17" cy="14.5" r="1.1" fill="currentColor" stroke="none"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.49.49 0 0 0 13.5 2h-3c-.24 0-.44.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94L2.86 14.52a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.03.24.23.41.47.41h3c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>`,
    signal: `<svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.5" width="3" height="6.5" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></svg>`,
    wifi: `<svg viewBox="0 0 24 18" fill="currentColor"><path d="M12 3C8 3 4.4 4.6 1.8 7.2l1.8 1.8C5.8 6.8 8.7 5.5 12 5.5s6.2 1.3 8.4 3.5l1.8-1.8C19.6 4.6 16 3 12 3zm0 6c-2 0-3.8.8-5.1 2.1l1.8 1.8C9.5 12.1 10.7 11.5 12 11.5s2.5.6 3.3 1.4l1.8-1.8A7.2 7.2 0 0 0 12 9zm0 5.5-2.1 2.1c.6.6 1.4.9 2.1.9s1.5-.3 2.1-.9L12 14.5z"/></svg>`,
    battery: `<svg viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor"/><rect x="23" y="4" width="1.8" height="4" rx=".9" fill="currentColor" fill-opacity=".4"/></svg>`,
    back: `<svg viewBox="0 0 12 20" width="11" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2 2 10l8 8"/></svg>`,
    compose: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
    generate: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2.5l1.6 4.3 4.3 1.6-4.3 1.6L12 14.3l-1.6-4.3L6.1 8.4l4.3-1.6L12 2.5z"/><path d="M18.4 13.6l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z"/></svg>`,
    stop: `<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
    regen: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35A8 8 0 1 0 19.73 13h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`,
    upload: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M5 20h14v-2H5v2zM12 4l-5 5h3v6h4V9h3l-5-5z"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`,
    hangup: `<svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" transform="rotate(135 12 12)"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>`,
    speaker: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 4v6l2 3v2h-5v6l-1 1-1-1v-6H6v-2l2-3V4h8zm-6 0h4v6.3l1.3 2H8.7L10 10.3V4z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2H8l1-2z"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 4l-1.7 2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.3L15 4H9zm3 5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.2C.5 8.4 2 5 5.3 5c2 0 3.4 1.3 4.2 2.5C10.3 6.3 11.7 5 13.7 5 17 5 18.5 8.4 22 11.8 19.5 16.4 12 21 12 21z"/></svg>`,
    reply: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4c5 0 8 1.5 10 5-.5-6-3.5-11-10-11z"/></svg>`,
    comment: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M11 5v6H5v2h6v6h2v-6h6v-2h-6V5z"/></svg>`,
    play: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3 10.6 10.6 16.9 4.3z"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8v10H5V10h14z"/></svg>`,
    users: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-8 1.3-8 4v3h9v-3c0-1 .4-1.9 1-2.6C9.3 13.1 8.6 13 8 13zm8 0c-.6 0-1.3.1-2 .2 1 .8 2 1.9 2 3.8v3h8v-3c0-2.7-5.3-4-8-4z"/></svg>`,
    share: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18 16a3 3 0 0 0-2.4 1.2l-7-4a3 3 0 0 0 0-2.4l7-4A3 3 0 1 0 15 5l-7 4a3 3 0 1 0 0 6l7 4A3 3 0 1 0 18 16z"/></svg>`,
    goto: `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M14 4l-1.4 1.4L16.2 9H4v2h12.2l-3.6 3.6L14 16l6-6z"/></svg>`,
};

const APPS = [
    { nav: 'messages', label: 'Messages', glow: '#5ce07f', icon: ICON.messages },
    { nav: 'feed', label: 'Feed', glow: '#ff6482', icon: ICON.feed },
    { nav: 'period', label: 'ประจำเดือน', glow: '#ff5e8a', icon: ICON.calendar },
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
            <button class="pp-nav-action" id="pp-group-new-btn" title="สร้างกลุ่ม">${ICON.users}</button>
            <button class="pp-nav-action" id="pp-list-edit-btn" style="width:auto;font-size:15px;font-weight:600" title="แก้ไข">แก้ไข</button>
            <button class="pp-nav-action" data-nav="contacts">${ICON.compose}</button>
          </div>
        </div>
        <div class="pp-search-wrap"><input class="pp-search" id="pp-msg-search" placeholder="ค้นหา"></div>
        <div class="pp-notes-row" id="pp-notes-row"></div>
        <div class="pp-chat-tabs">
          <button class="pp-chat-tab" data-chattab="pin">ปักหมุด</button>
          <button class="pp-chat-tab on" data-chattab="char">ตัวละคร</button>
          <button class="pp-chat-tab" data-chattab="npc">NPC</button>
        </div>
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

      <div class="pp-screen" id="pp-scr-groupnew">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="messages">${ICON.back}</button>
          <span class="pp-nav-title" id="pp-groupnew-title">สร้างกลุ่ม</span>
          <button class="pp-nav-action" id="pp-group-save-btn" style="width:auto;font-size:15px;font-weight:600;color:var(--pp-accent)">สร้าง</button>
        </div>
        <div class="pp-set-body">
          <div class="pp-set-label">ชื่อกลุ่ม</div>
          <input id="pp-group-name" placeholder="ตั้งชื่อกลุ่ม" style="width:100%;box-sizing:border-box;background:var(--pp-bg3);border:none;border-radius:14px;padding:11px 14px;color:var(--pp-txt);font-size:15px">
          <div class="pp-set-label">สมาชิก</div>
          <button id="pp-group-members-btn" class="pp-cs-btn" style="width:100%;text-align:left;padding:11px 14px">เลือกสมาชิก…</button>
          <div class="pp-group-member-chips" id="pp-group-member-chips"></div>
          <div class="pp-set-label" style="display:flex;align-items:center;gap:8px">การตอบโต้ <button class="pp-help-btn" id="pp-help-group">?</button></div>
          <div class="pp-set-group">
            <div class="pp-set-row"><span>สมาชิกรู้จักกัน (คุยโต้กันได้)</span><label class="pp-switch"><input type="checkbox" id="pp-group-know"><span></span></label></div>
            <div class="pp-set-row"><span>โหมดตอบต่อการเจน</span>
              <select id="pp-group-replymode" style="background:var(--pp-bg3);border:none;color:var(--pp-txt);border-radius:10px;padding:6px 10px;font-size:14px">
                <option value="many">หลายคน</option>
                <option value="one">ทีละคน</option>
              </select>
            </div>
            <div class="pp-set-row"><span>คูลดาวน์ระหว่างเจน (วินาที)</span>
              <input id="pp-group-cooldown" type="number" min="0" max="600" value="0" style="width:70px;background:var(--pp-bg3);border:none;color:var(--pp-txt);border-radius:10px;padding:6px 10px;font-size:14px;text-align:center">
            </div>
          </div>
          <div class="pp-set-label">โน้ต/คำเตือนของกลุ่ม (พิมพ์อิสระ · ป้อนให้บอทรู้)</div>
          <textarea id="pp-group-warn" rows="3" placeholder="เช่น กติกากลุ่ม โทน หัวข้อที่ห้ามพูด ฯลฯ" style="width:100%;box-sizing:border-box;background:var(--pp-bg3);border:none;border-radius:14px;padding:11px 14px;color:var(--pp-txt);font-size:14px;resize:none;font-family:inherit;line-height:1.4"></textarea>
          <div style="height:24px"></div>
        </div>
        <div class="pp-home-bar"></div>
      </div>

      <div class="pp-screen" id="pp-scr-groupsettings">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="chat">${ICON.back}</button>
          <span class="pp-nav-title">ตั้งค่ากลุ่ม</span>
          <button class="pp-nav-action" id="pp-group-del-btn" style="width:auto;font-size:15px;color:#ff453a">ลบกลุ่ม</button>
        </div>
        <div class="pp-set-body" id="pp-groupsettings-body"></div>
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
            <button class="pp-nav-action" id="pp-chat-menu-btn" title="ตั้งค่า">${ICON.menu}</button>
          </div>
        </div>
        <div class="pp-msgs" id="pp-msgs"></div>
        <div class="pp-inputbar">
          <button class="pp-img-btn" id="pp-img-btn" title="ส่งรูป">${ICON.camera}</button>
          <textarea class="pp-input" id="pp-input" rows="1" placeholder="ข้อความ"></textarea>
          <button class="pp-gen" id="pp-gen" title="ให้บอทตอบ">${ICON.generate}</button>
          <button class="pp-gen pp-stop" id="pp-stop" title="หยุด" style="display:none">${ICON.stop}</button>
        </div>
        <input type="file" id="pp-chat-img-file" accept="image/*" hidden>
        <div class="pp-home-bar"></div>
      </div>

      <div class="pp-screen" id="pp-scr-chatsettings">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="chat">${ICON.back}</button>
          <span class="pp-nav-title">ตั้งค่าแชท</span>
          <span style="width:34px"></span>
        </div>
        <div class="pp-set-body">
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 0 16px">
            <div id="pp-cs-av"></div>
            <div id="pp-cs-name" style="font-size:18px;font-weight:700;color:var(--pp-txt)"></div>
          </div>
          <div class="pp-set-label">ชื่อที่แสดง (แค่ในมือถือ)</div>
          <div class="pp-cs-color-row">
            <input id="pp-rename-input" placeholder="ชื่อ" style="flex:1;background:var(--pp-bg3);border:none;border-radius:14px;padding:10px 14px;color:var(--pp-txt);font-size:15px;min-width:120px">
            <button id="pp-rename-save" class="pp-cs-btn">บันทึก</button>
          </div>
          <div class="pp-set-label">Persona ตัวละคร (แค่ในมือถือ · ไม่แตะ SillyTavern)</div>
          <input id="pp-persona-name" placeholder="ชื่อตัวละคร (เว้นว่าง=ใช้ของ ST)" style="width:100%;box-sizing:border-box;background:var(--pp-bg3);border:none;border-radius:14px;padding:10px 14px;color:var(--pp-txt);font-size:14px;margin-bottom:6px">
          <textarea id="pp-persona-desc" rows="3" placeholder="คำอธิบายบุคลิก (เว้นว่าง=ใช้ของ ST)" style="width:100%;box-sizing:border-box;background:var(--pp-bg3);border:none;border-radius:14px;padding:10px 14px;color:var(--pp-txt);font-size:14px;resize:none;font-family:inherit;line-height:1.4"></textarea>
          <button id="pp-persona-save" class="pp-cs-btn" style="margin-top:6px">บันทึก Persona ตัวละคร</button>
          <div class="pp-set-label" style="display:flex;align-items:center;gap:8px">Persona ของฉันที่บอทอ่าน <button class="pp-help-btn" id="pp-help-userpersona">?</button></div>
          <div id="pp-cs-userpersona-hint" style="font-size:12px;color:var(--pp-txt3);margin:0 4px 8px"></div>
          <div class="pp-user-persona-list" id="pp-user-persona-list"></div>
          <div class="pp-set-label">อื่น ๆ</div>
          <div class="pp-set-group">
            <div class="pp-set-row"><span>ทำเป็น NPC (หมวด NPC)</span><label class="pp-switch"><input type="checkbox" id="pp-npc-toggle"><span></span></label></div>
            <div class="pp-set-row" id="pp-calllog-btn" style="cursor:pointer"><span>ประวัติการโทร (คนนี้)</span><span style="color:var(--pp-txt3)">›</span></div>
          </div>
          <div class="pp-set-label">พื้นหลังแชท</div>
          <div class="pp-cs-swatches" id="pp-chat-bg-swatches"></div>
          <label class="pp-cs-upload" style="margin-top:6px">${ICON.upload} อัปโหลดรูปพื้นหลัง<input type="file" id="pp-chatbg-file" accept="image/*" hidden></label>
          <div class="pp-set-label">สีข้อความของฉัน</div>
          <div class="pp-cs-color-row">
            <label class="pp-color-wrap"><input type="color" id="pp-bubble-color" value="#0a84ff"><span>พื้นฟอง</span></label>
            <label class="pp-color-wrap"><input type="color" id="pp-text-color" value="#ffffff"><span>สีตัวอักษร</span></label>
          </div>
          <div class="pp-cs-color-row" style="margin-top:8px">
            <label class="pp-cs-upload">${ICON.upload} ใช้รูปเป็นพื้นฟอง<input type="file" id="pp-bubbleimg-file" accept="image/*" hidden></label>
            <button id="pp-bubble-clear" class="pp-cs-btn">ล้างรูป</button>
          </div>
          <div style="height:24px"></div>
        </div>
        <div class="pp-home-bar"></div>
      </div>

      <div class="pp-screen" id="pp-scr-feed">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="home">${ICON.back}</button>
          <span class="pp-nav-title">Feed</span>
          <div class="pp-chat-tools">
            <button class="pp-nav-action" id="pp-feed-search-btn" title="ยอดนิยม">${ICON.search}</button>
            <button class="pp-nav-action" id="pp-feed-gen-btn" title="ให้บอทเคลื่อนไหว">${ICON.generate}</button>
          </div>
        </div>
        <div class="pp-feed-tabs">
          <button class="pp-feed-tab on" data-feedtab="feed">ฟีด</button>
          <button class="pp-feed-tab" data-feedtab="news">ข่าว</button>
        </div>
        <div class="pp-feed-scroll" id="pp-feed-scroll">
          <div class="pp-story-tray" id="pp-story-tray"></div>
          <div class="pp-feed-list" id="pp-feed-list"></div>
        </div>
        <button class="pp-fab-inpage" id="pp-feed-add" title="สร้างโพสต์">${ICON.plus}</button>
        <div class="pp-home-bar"></div>
        <input type="file" id="pp-story-img-file" accept="image/*" hidden>
        <input type="file" id="pp-feed-img-file" accept="image/*" hidden>
      </div>

      <div class="pp-screen" id="pp-scr-newpost">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="feed">${ICON.back}</button>
          <span class="pp-nav-title" id="pp-newpost-title">สร้างโพสต์</span>
          <button class="pp-nav-action" id="pp-newpost-save" style="width:auto;font-size:15px;font-weight:600;color:var(--pp-accent)">โพสต์</button>
        </div>
        <div class="pp-set-body">
          <div class="pp-set-label">หัวข้อ / ข้อความ</div>
          <textarea id="pp-newpost-text" rows="3" placeholder="เขียนอะไรสักหน่อย…" style="width:100%;box-sizing:border-box;background:var(--pp-bg3);border:none;border-radius:14px;padding:11px 14px;color:var(--pp-txt);font-size:15px;resize:none;font-family:inherit;line-height:1.45"></textarea>
          <div class="pp-set-label">รูปภาพ (ไม่บังคับ)</div>
          <div class="pp-newpost-img-wrap" id="pp-newpost-img-wrap"></div>
          <div class="pp-cs-color-row">
            <label class="pp-cs-upload">${ICON.camera} เลือกรูป<input type="file" id="pp-newpost-img-file" accept="image/*" hidden></label>
            <button id="pp-newpost-img-clear" class="pp-cs-btn">เอารูปออก</button>
          </div>
          <div id="pp-newpost-caption-box" style="display:none">
            <div class="pp-set-label">คำบรรยายรูป (บอทจะเห็นข้อความนี้)</div>
            <textarea id="pp-newpost-caption" rows="2" placeholder="บอทมองรูปไม่เห็นตรง ๆ ต้องมีคำบรรยาย" style="width:100%;box-sizing:border-box;background:var(--pp-bg3);border:none;border-radius:14px;padding:11px 14px;color:var(--pp-txt);font-size:14px;resize:none;font-family:inherit"></textarea>
            <div class="pp-cs-color-row" style="margin-top:6px">
              <button id="pp-newpost-cap-ai" class="pp-cs-btn">${ICON.generate} ให้ AI บรรยาย</button>
              <span style="font-size:12px;color:var(--pp-txt3)">หรือพิมพ์เองด้านบน</span>
            </div>
          </div>
          <div class="pp-set-label" style="display:flex;align-items:center;gap:8px">ใครตอบโพสต์นี้ได้ <button class="pp-help-btn" id="pp-help-responders">?</button></div>
          <button id="pp-newpost-responders-btn" class="pp-cs-btn" style="width:100%;text-align:left;padding:11px 14px">ทุกคน (แตะเพื่อจำกัด)</button>
          <div class="pp-group-member-chips" id="pp-newpost-responder-chips"></div>
          <div class="pp-set-group" style="margin-top:8px">
            <div class="pp-set-row"><span>ผู้ตอบรู้จักกัน (ตอบโต้กันได้)</span><label class="pp-switch"><input type="checkbox" id="pp-newpost-know" checked><span></span></label></div>
          </div>
          <div style="height:24px"></div>
        </div>
        <div class="pp-home-bar"></div>
      </div>

      <div class="pp-screen" id="pp-scr-postview">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="feed">${ICON.back}</button>
          <span class="pp-nav-title">โพสต์</span>
          <button class="pp-nav-action" id="pp-post-gen-btn" title="ให้บอทคอมเมนต์/ตอบ">${ICON.generate}</button>
        </div>
        <div class="pp-post-body" id="pp-post-body"></div>
        <div class="pp-inputbar">
          <textarea class="pp-input" id="pp-comment-input" rows="1" placeholder="เขียนคอมเมนต์"></textarea>
          <button class="pp-gen" id="pp-comment-send" title="ส่ง">${ICON.reply}</button>
        </div>
        <div class="pp-home-bar"></div>
      </div>

      <div class="pp-screen" id="pp-scr-period">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="home">${ICON.back}</button>
          <span class="pp-nav-title">ประจำเดือน</span>
          <button class="pp-nav-action" id="pp-period-help" style="font-size:18px">?</button>
        </div>
        <div class="pp-period-body">
          <div class="pp-period-status" id="pp-period-status"></div>
          <div class="pp-period-cal-head">
            <button class="pp-period-nav" id="pp-period-prev">${ICON.back}</button>
            <span id="pp-period-month">—</span>
            <button class="pp-period-nav" id="pp-period-next" style="transform:scaleX(-1)">${ICON.back}</button>
          </div>
          <div class="pp-cal-dow"><span>อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span></div>
          <div class="pp-cal-grid" id="pp-cal-grid"></div>
          <div class="pp-period-hint">แตะวันเพื่อทำเครื่องหมายว่าเป็นวันที่ประจำเดือนมา · หนุ่ม ๆ ในแอปจะรับรู้และใส่ใจ</div>
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
            <div class="pp-set-row" id="pp-open-profile" style="cursor:pointer"><span>โปรไฟล์ในแอป</span><span style="color:var(--pp-txt3)">›</span></div>
          </div>
          <div class="pp-set-group">
            <div class="pp-set-row"><span>Dark Mode</span><label class="pp-switch"><input type="checkbox" id="pp-set-dark"><span></span></label></div>
            <div class="pp-set-row"><span>ปุ่มลอยบนหน้าจอ</span><label class="pp-switch"><input type="checkbox" id="pp-set-fab"><span></span></label></div>
            <div class="pp-set-row"><span>Dynamic Island</span><label class="pp-switch"><input type="checkbox" id="pp-set-island"><span></span></label></div>
            <div class="pp-set-row"><span>แจ้งเตือน/Island นอกมือถือ</span><label class="pp-switch"><input type="checkbox" id="pp-set-scope2"><span></span></label></div>
          </div>
          <div class="pp-set-label">Persona ของฉัน (ที่บอทอ่าน)</div>
          <div class="pp-set-group">
            <div class="pp-set-row">
              <span style="display:flex;align-items:center;gap:8px">โหมด <button class="pp-help-btn" id="pp-help-personamode">?</button></span>
              <select id="pp-set-userpersona-mode" style="background:var(--pp-bg3);border:none;color:var(--pp-txt);border-radius:10px;padding:6px 10px;font-size:14px">
                <option value="perchat">แยกแต่ละแชท</option>
                <option value="shared">เหมือนกันทุกแชท</option>
              </select>
            </div>
            <div class="pp-set-row" id="pp-set-shared-persona-row" style="display:none">
              <span>เลือก persona</span>
              <select id="pp-set-shared-persona" style="background:var(--pp-bg3);border:none;color:var(--pp-txt);border-radius:10px;padding:6px 10px;font-size:14px;max-width:55%"></select>
            </div>
          </div>
          <div class="pp-set-label">โทรศัพท์</div>
          <div class="pp-set-group">
            <div class="pp-set-row">
              <span style="display:flex;align-items:center;gap:8px">บอทโทรหา <button class="pp-help-btn" id="pp-help-botcall">?</button></span>
              <label class="pp-switch"><input type="checkbox" id="pp-set-botcall"><span></span></label>
            </div>
          </div>
          <div class="pp-set-label">ส่งรูป</div>
          <div class="pp-set-group">
            <div class="pp-set-row">
              <span style="display:flex;align-items:center;gap:8px">คำบรรยายรูป <button class="pp-help-btn" id="pp-help-caption">?</button></span>
              <select id="pp-set-caption" style="background:var(--pp-bg3);border:none;color:var(--pp-txt);border-radius:10px;padding:6px 10px;font-size:14px">
                <option value="ask">ถามทุกครั้ง</option>
                <option value="self">พิมพ์เอง</option>
                <option value="ai">ให้ AI บรรยาย</option>
              </select>
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

      <div class="pp-screen" id="pp-scr-profile">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="settings">${ICON.back}</button>
          <span class="pp-nav-title">โปรไฟล์</span>
          <span style="width:34px"></span>
        </div>
        <div class="pp-set-body">
          <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 0">
            <div id="pp-profile-av"></div>
            <label class="pp-cs-upload">${ICON.upload} เปลี่ยนรูปโปรไฟล์<input type="file" id="pp-profile-av-file" accept="image/*" hidden></label>
          </div>
          <div class="pp-set-label">ชื่อที่แสดงในแอป</div>
          <div class="pp-cs-color-row">
            <input id="pp-profile-name" placeholder="ชื่อ" style="flex:1;background:var(--pp-bg3);border:none;border-radius:14px;padding:10px 14px;color:var(--pp-txt);font-size:15px;min-width:120px">
            <button id="pp-profile-name-save" class="pp-cs-btn">บันทึก</button>
          </div>
          <div class="pp-set-label">โน้ตของฉัน (24 ชม.)</div>
          <div class="pp-set-group"><div class="pp-set-row"><span id="pp-profile-note-txt" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</span><button id="pp-profile-note-edit" class="pp-cs-btn" style="flex-shrink:0">แก้ไข</button></div></div>
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

    <div id="pp-story-viewer" style="display:none"></div>
    <div id="pp-toast"></div>
  </div>
</dialog>`;
}

// pocket-phone/index.js — 0.9.7 — ท่อน 2/3 (renderNotesRow → ppGroupGenerate)
// ต่อจากท่อน 1/3 ที่จบตรง buildPhone()
// ⚠️ รันเดี่ยวไม่ได้ ต้องแปะครบ 3 ท่อนก่อน

// ── notes row ──
function renderNotesRow() {
    const row = document.getElementById('pp-notes-row');
    if (!row) return;
    const un = getUserNote();
    let html = `<div class="pp-note-item" data-usernote="1">
        <div class="pp-note-av-wrap">
            ${un ? `<div class="pp-note-bubble">${esc(un.text.slice(0, 24))}${un.text.length > 24 ? '…' : ''}</div>` : `<div class="pp-note-bubble pp-note-add">โน้ต…</div>`}
            ${userAvatarHTML(58)}
        </div>
        <div class="pp-note-name">${esc(getUserDisplayName())}</div>
    </div>`;
    const cats = { pin: [], main: [], npc: [] };
    getContacts().forEach(c => { const bn = getBotNote(c.id); if (!bn) return; cats[noteCategory(c.id)].push({ c, bn }); });
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

function ppOpenBotNote(cid) {
    const bn = getBotNote(cid);
    const c = getContacts().find(x => x.id === cid);
    if (!bn || !c) return;
    const host = document.getElementById('pp-frame') || document.body;
    const ov = document.createElement('div');
    ov.className = 'pp-help-ov';
    ov.style.cssText = 'position:absolute;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);padding:28px;box-sizing:border-box;';
    ov.innerHTML = `<div style="background:rgba(50,50,54,.96);backdrop-filter:blur(30px);border-radius:18px;max-width:300px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.5)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${contactAvatarHTML(c, 34)}<div><div style="font-size:14px;font-weight:700;color:#fff">${esc(dname(c))}</div><div style="font-size:11px;color:var(--pp-txt3)">${esc(fmtNoteAge(bn.ts))}</div></div></div>
        <div style="font-size:15px;line-height:1.5;color:#fff;background:rgba(120,120,128,.24);border-radius:12px;padding:10px 12px;margin-bottom:16px">${esc(bn.text)}</div>
        <div style="display:flex;gap:8px">
            <button class="pp-bn-close" style="flex:1;background:rgba(120,120,128,.3);border:none;color:#fff;border-radius:14px;padding:11px;font-size:15px;cursor:pointer">ปิด</button>
            <button class="pp-bn-reply" style="flex:1;background:var(--pp-accent,#0a84ff);border:none;color:#fff;border-radius:14px;padding:11px;font-size:15px;font-weight:600;cursor:pointer">ตอบกลับ</button>
        </div>
    </div>`;
    host.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('.pp-bn-close')?.addEventListener('click', close);
    ov.querySelector('.pp-bn-reply')?.addEventListener('click', () => {
        close();
        ppReplyComposer({
            title: `ตอบโน้ตของ ${dname(c)}`, quotedLabel: `โน้ตของ ${dname(c)}`, quoted: bn.text,
            onOk: (text) => {
                pushThreadMsg(cid, { from: 'me', text, replyTo: { kind: 'note', text: bn.text, author: dname(c) } });
                ppActiveContact = c; ppActiveGroup = null; ppNav('chat'); ppToast('ส่งคำตอบแล้ว');
            }
        });
    });
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
}

function msgPreview(m) {
    if (!m) return 'แตะเพื่อเริ่มแชท';
    if (m.type === 'call') return m.dir === 'out' ? 'โทรออก' : 'สายเข้า';
    if (m.type === 'image') return m.caption ? `[รูป] ${m.caption}` : '[รูปภาพ]';
    if (m.type === 'voice') return '(ข้อความเสียง)';
    if (m.type === 'sharedpost') return '[แชร์โพสต์]';
    const pre = m.replyTo ? (m.replyTo.kind === 'story' ? 'ตอบสตอรี่: ' : m.replyTo.kind === 'msg' ? 'ตอบ: ' : 'ตอบโน้ต: ') : '';
    return (m.senderName ? m.senderName + ': ' : '') + pre + (m.text || '');
}

// ── หน้ารายชื่อ (แท็บ + กลุ่มบนสุด) ──
function renderContactList(filter) {
    const list = document.getElementById('pp-contact-list');
    if (!list) return;
    document.querySelectorAll('.pp-chat-tab').forEach(b => b.classList.toggle('on', b.dataset.chattab === ppChatTab));

    const rowHTML = (c) => {
        const th = getThread(c.id);
        const last = th[th.length - 1];
        const typing = ppGeneratingId === c.id;
        const preview = typing ? 'กำลังพิมพ์…' : msgPreview(last);
        const timeLbl = last ? fmtListTime(last.ts) : '';
        const pinned = isPinned(c.id);
        const editControls = ppListEditMode
            ? `<div style="display:flex;gap:8px;flex-shrink:0">
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
    };
    const groupRowHTML = (g) => {
        const th = getThread(g.id);
        const last = th[th.length - 1];
        const typing = ppGeneratingId === g.id;
        const preview = typing ? 'กำลังพิมพ์…' : (last ? msgPreview(last) : `สมาชิก ${(g.members || []).length} คน`);
        const timeLbl = last ? fmtListTime(last.ts) : '';
        return `<div class="pp-row" data-gid="${esc(g.id)}">
            ${groupAvatarHTML(g, 52)}
            <div class="pp-row-meta">
                <div class="pp-row-name">${esc(g.name || 'กลุ่ม')} <span style="font-size:11px;color:var(--pp-txt3);font-weight:400">· ${(g.members || []).length} คน</span></div>
                <div class="pp-row-preview${typing ? ' pp-preview-typing' : ''}">${esc(preview)}</div>
            </div>
            <span style="font-size:12px;color:var(--pp-txt3);flex-shrink:0">${esc(timeLbl)}</span>
        </div>`;
    };

    let contacts = getContacts().filter(c => contactCategory(c) === ppChatTab);
    if (filter) contacts = getContacts().filter(c => dname(c).toLowerCase().includes(filter.toLowerCase()));
    contacts.sort((a, b) => lastTs(b.id) - lastTs(a.id));

    let html = '';
    const groups = getGroups().slice().sort((a, b) => lastTs(b.id) - lastTs(a.id));
    if (groups.length && !filter) {
        html += `<div class="pp-list-head">แชทกลุ่ม</div>` + groups.map(groupRowHTML).join('');
        html += `<div class="pp-list-head">${ppChatTab === 'pin' ? 'ปักหมุด' : ppChatTab === 'npc' ? 'NPC' : 'ตัวละคร'}</div>`;
    }
    if (!contacts.length && !groups.length) {
        list.innerHTML = `<div class="pp-empty">ยังไม่มีคนคุย<br><span>แตะปุ่มมุมขวาบนเพื่อเพิ่ม</span></div>`;
        return;
    }
    html += contacts.length ? contacts.map(rowHTML).join('') : `<div class="pp-empty" style="padding:40px 24px">ไม่มีในหมวดนี้</div>`;
    list.innerHTML = html;
}

function renderAddContacts() {
    const list = document.getElementById('pp-add-list');
    if (!list) return;
    const chars = listStCharacters();
    const added = new Set(getContacts().map(c => c.id));
    if (!chars.length) { list.innerHTML = `<div class="pp-empty">ไม่พบตัวละครใน SillyTavern<br><span>ลองโหลดตัวละครก่อน</span></div>`; return; }
    list.innerHTML = chars.map(c => `<div class="pp-row">
        ${contactAvatarHTML(c, 48)}
        <div class="pp-row-meta"><div class="pp-row-name">${esc(c.name)}</div></div>
        ${added.has(c.id) ? `<span class="pp-added">เพิ่มแล้ว</span>` : `<button class="pp-add-btn" data-add="${esc(c.id)}">เพิ่ม</button>`}
    </div>`).join('');
}

// ── ฟอง ──
function replyHeaderHTML(rt) {
    if (!rt) return '';
    const label = rt.kind === 'story' ? 'ตอบสตอรี่' : rt.kind === 'msg' ? 'ตอบข้อความ' : 'ตอบโน้ต';
    const warp = rt.targetMid ? ` data-warp="${esc(rt.targetMid)}"` : '';
    return `<div class="pp-reply-head"${warp}>
        <div class="pp-reply-head-label">${esc(label)}${rt.author ? ' · ' + esc(rt.author) : ''}${rt.targetMid ? ' ' + ICON.goto : ''}</div>
        <div class="pp-reply-head-txt">${esc(String(rt.text || '').slice(0, 70))}</div>
    </div>`;
}
function fmtDur(s) { s = Math.max(1, Math.round(s || 1)); return `0:${String(s).padStart(2, '0')}`; }

function sharedPostCardHTML(m) {
    const p = findPost(m.postId);
    if (!p) return `<div class="pp-shared-card"><div class="pp-shared-gone">โพสต์นี้ถูกลบแล้ว</div></div>`;
    const av = postAuthorAvatar(p);
    const avHTML = av ? `<img class="pp-shared-av" src="${esc(av)}" onerror="this.style.visibility='hidden'">` : `<span class="pp-shared-av pp-avatar-fb" style="width:26px;height:26px">${esc(postAuthorLabel(p)[0])}</span>`;
    return `<div class="pp-shared-card" data-openpost="${esc(p.id)}">
        <div class="pp-shared-top">${avHTML}<span class="pp-shared-name">${esc(postAuthorLabel(p))}</span><span class="pp-shared-tag">โพสต์</span></div>
        ${p.text ? `<div class="pp-shared-text">${esc(String(p.text).slice(0, 120))}</div>` : ''}
        ${p.mediaKey ? `<div class="pp-shared-img" data-sharedimg="${esc(p.id)}"></div>` : ''}
    </div>`;
}

function browHTML(m, idx, grouped, tail, groupMode) {
    if (m.type === 'call') {
        const out = m.dir === 'out', missed = !!m.missed;
        return `<div class="pp-brow ${out ? 'out' : 'in'}" data-from="${out ? 'me' : 'them'}"${m.mid ? ` data-mid="${esc(m.mid)}"` : ''}>
            <div class="pp-callmsg ${out ? 'out' : 'in'}${missed ? ' missed' : ''}" data-msgidx="${idx}">
                <span class="pp-callmsg-ic">${ICON.phone}</span>
                <span class="pp-callmsg-body"><span class="pp-callmsg-title">${out ? 'โทรออก' : 'สายเข้า'}${missed ? ' · ไม่ได้รับ' : ''}</span><span class="pp-callmsg-sub">${esc(m.text || '')}</span></span>
            </div>
        </div>`;
    }
    const out = m.from === 'me';
    const rh = replyHeaderHTML(m.replyTo);
    let inner, extraClass = '';
    if (m.type === 'image') {
        extraClass = ' pp-bubble-img';
        inner = `<div class="pp-img-msg" data-mediaidx="${idx}"><img class="pp-img-thumb" alt="รูป"></div>` + (m.caption ? `<div class="pp-img-cap">${esc(m.caption)}</div>` : '');
    } else if (m.type === 'voice') {
        extraClass = ' pp-bubble-voice';
        inner = `<div class="pp-voice" data-voiceidx="${idx}"><span class="pp-voice-play">${ICON.play}</span><span class="pp-voice-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="pp-voice-dur">${esc(fmtDur(m.dur))}</span></div>`;
    } else if (m.type === 'sharedpost') {
        extraClass = ' pp-bubble-shared';
        inner = sharedPostCardHTML(m, idx);
    } else {
        inner = esc(m.text);
    }
    let senderTag = '', avatarCol = '';
    if (groupMode && !out && !grouped) {
        const sc = getContacts().find(x => x.id === m.sender);
        senderTag = `<div class="pp-grp-sender">${esc(m.senderName || (sc ? dname(sc) : '?'))}</div>`;
    }
    if (groupMode && !out) {
        const sc = getContacts().find(x => x.id === m.sender);
        avatarCol = tail
            ? `<span class="pp-grp-msg-av">${sc ? contactAvatarHTML(sc, 28) : `<span class="pp-avatar pp-avatar-fb" style="width:28px;height:28px">${esc((m.senderName || '?')[0])}</span>`}</span>`
            : `<span class="pp-grp-msg-av empty"></span>`;
    }
    return `<div class="pp-brow ${out ? 'out' : 'in'}${grouped ? ' grp' : ''}${groupMode && !out ? ' grpmode' : ''}" data-from="${m.from}"${m.mid ? ` data-mid="${esc(m.mid)}"` : ''}>
        ${avatarCol}
        <div class="pp-brow-col">
            ${senderTag}
            <div class="pp-bubble${tail ? ' tail' : ''}${extraClass}" data-msgidx="${idx}">${rh}${inner}</div>
        </div>
    </div>`;
}

function renderThread() {
    const isGroup = !!ppActiveGroup;
    const c = ppActiveContact, g = ppActiveGroup;
    if (!isGroup && !c) { ppNav('messages'); return; }
    const tid = isGroup ? g.id : c.id;
    const name = document.getElementById('pp-chat-hdr-name');
    if (name) name.textContent = isGroup ? (g.name || 'กลุ่ม') : dname(c);
    const avSlot = document.getElementById('pp-chat-hdr-av');
    if (avSlot) avSlot.innerHTML = isGroup ? groupAvatarHTML(g, 30) : contactAvatarHTML(c, 30);
    const callBtn = document.getElementById('pp-chat-call-btn');
    if (callBtn) callBtn.style.display = isGroup ? 'none' : 'flex';

    const msgs = document.getElementById('pp-msgs');
    if (!msgs) return;
    const th = getThread(tid);
    const total = th.length;
    if (!total) {
        msgs.innerHTML = `<div class="pp-sys">${isGroup ? 'เริ่มคุยในกลุ่ม · กดปุ่มฟ้าให้สมาชิกตอบ' : 'เริ่มบทสนทนา · แตะฟองเพื่อแก้ไข/ลบ'}</div>`;
    } else {
        const startIdx = Math.max(0, total - ppHistShown);
        let html = '';
        if (startIdx > 0) html += `<div class="pp-loadmore"><button id="pp-loadmore-btn" class="pp-regen">ดูข้อความเก่ากว่านี้ (${startIdx})</button></div>`;
        let prevTs = null, firstShown = true;
        th.forEach((m, i) => {
            if (i < startIdx) return;
            const div = firstShown ? chatDividerFull(m.ts || 0) : chatDivider(prevTs, m.ts || 0);
            firstShown = false;
            if (div) html += `<div class="pp-time-divider">${esc(div)}</div>`;
            prevTs = m.ts || prevTs;
            if (m.type === 'call') { html += browHTML(m, i, false, true, isGroup); return; }
            const prev = (i - 1 >= startIdx) ? th[i - 1] : null;
            const next = th[i + 1];
            const curKey = m.from === 'me' ? 'me' : (isGroup ? (m.sender || 'them') : 'them');
            const prevKey = prev ? (prev.from === 'me' ? 'me' : (isGroup ? (prev.sender || 'them') : 'them')) : null;
            const nextKey = next ? (next.from === 'me' ? 'me' : (isGroup ? (next.sender || 'them') : 'them')) : null;
            const grouped = prev && prevKey === curKey && prev.type !== 'call' && !m.replyTo && !div;
            const tail = !next || nextKey !== curKey || next.type === 'call';
            html += browHTML(m, i, grouped, tail, isGroup);
        });
        if (ppGeneratingId !== tid && !isGroup) {
            const last = th[total - 1];
            if (last && last.from === 'them' && last.type !== 'call') {
                html += `<div class="pp-regen-row" id="pp-regen-row"><button id="pp-regen-btn" class="pp-regen">${ICON.regen}รีเจน</button></div>`;
            }
        }
        msgs.innerHTML = html;
    }
    applyChatStyle();
    hydrateThreadImages();
    if (ppGeneratingId === tid) showTyping();
    msgs.scrollTop = msgs.scrollHeight;
}

function hydrateThreadImages() {
    const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null);
    if (!tid) return;
    const th = getThread(tid);
    document.querySelectorAll('#pp-msgs .pp-img-msg[data-mediaidx]').forEach(el => {
        const m = th[+el.dataset.mediaidx];
        if (m && m.mediaKey) loadMedia(m.mediaKey).then(img => { const im = el.querySelector('img'); if (im && img) im.src = img; });
    });
    document.querySelectorAll('#pp-msgs .pp-shared-img[data-sharedimg]').forEach(el => {
        const p = findPost(el.dataset.sharedimg);
        if (p && p.mediaKey) loadMedia(p.mediaKey).then(img => { if (img) el.style.backgroundImage = `url(${img})`; });
    });
}

function ppWarpTo(mid) {
    const el = document.querySelector(`#pp-msgs .pp-brow[data-mid="${CSS.escape(mid)}"]`);
    if (!el) { ppToast('หาข้อความต้นทางไม่เจอ (อาจถูกซ่อน กด "ดูข้อความเก่ากว่านี้")'); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('pp-warp-hl');
    setTimeout(() => el.classList.remove('pp-warp-hl'), 1600);
}

function ppMsgActions(idx) {
    const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null);
    if (!tid) return;
    const m = getThread(tid)[idx];
    if (!m) return;
    const items = [];
    if (m.type !== 'call' && m.type !== 'sharedpost') {
        if (m.mid) items.push({ label: 'ตอบข้อความนี้', onClick: () => ppReplyToMsg(idx) });
        items.push({ label: m.type === 'image' ? 'แก้ไขคำบรรยาย' : (m.type === 'voice' ? 'แก้ไขคำพูด' : 'แก้ไขข้อความ'), onClick: () => ppEditMsg(idx) });
    }
    items.push({ label: 'ลบ', danger: true, onClick: () => ppDeleteMsg(idx) });
    ppActionSheet(items);
}
function ppReplyToMsg(idx) {
    const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null);
    if (!tid) return;
    const m = getThread(tid)[idx];
    if (!m || !m.mid) return;
    const author = m.from === 'me' ? getUserDisplayName() : (m.senderName || (ppActiveContact ? dname(ppActiveContact) : '?'));
    const quoted = m.type === 'image' ? (m.caption || '[รูป]') : (m.text || '');
    ppReplyComposer({
        title: 'ตอบข้อความ', quotedLabel: author, quoted,
        onOk: (text) => { pushThreadMsg(tid, { from: 'me', text, replyTo: { kind: 'msg', text: quoted, author, targetMid: m.mid } }); renderThread(); renderContactList(); }
    });
}
function ppEditMsg(idx) {
    const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null);
    if (!tid) return;
    const m = getThread(tid)[idx];
    if (!m || m.type === 'call') return;
    const cur = m.type === 'image' ? (m.caption || '') : (m.text || '');
    const title = m.type === 'image' ? 'แก้ไขคำบรรยายรูป' : (m.type === 'voice' ? 'แก้ไขคำพูด' : 'แก้ไขข้อความ');
    ppPrompt(title, cur, v => { if (m.type === 'image') m.caption = v; else m.text = v; saveCfg(); renderThread(); renderContactList(); ppToast('แก้ไขแล้ว'); });
}

function ppPlayVoice(idx) {
    const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null);
    if (!tid) return;
    const m = getThread(tid)[idx];
    if (!m || m.type !== 'voice') return;
    const scr = document.getElementById('pp-scr-chat');
    if (!scr) return;
    document.getElementById('pp-voice-ov')?.remove();
    const ov = document.createElement('div');
    ov.id = 'pp-voice-ov';
    ov.innerHTML = `<div class="pp-voice-ov-inner"></div><button class="pp-voice-ov-close">${ICON.close}</button>`;
    scr.appendChild(ov);
    const inner = ov.querySelector('.pp-voice-ov-inner');
    ov.querySelector('.pp-voice-ov-close')?.addEventListener('click', () => ov.remove());
    requestAnimationFrame(() => ov.classList.add('show'));
    const words = String(m.text || '').split(/\s+/).filter(Boolean);
    let i = 0;
    const step = () => {
        if (!document.getElementById('pp-voice-ov')) return;
        if (i >= words.length) { setTimeout(() => ov.classList.remove('show'), 1400); setTimeout(() => ov.remove(), 1900); return; }
        const sp = document.createElement('span'); sp.textContent = words[i] + ' '; inner.appendChild(sp);
        requestAnimationFrame(() => sp.classList.add('show'));
        i++; setTimeout(step, 240 + Math.random() * 180);
    };
    step();
}

function showTyping(label) {
    const msgs = document.getElementById('pp-msgs');
    if (!msgs || document.getElementById('pp-typing')) return;
    document.getElementById('pp-regen-row')?.remove();
    msgs.insertAdjacentHTML('beforeend',
        `<div class="pp-brow in" id="pp-typing">${label ? `<div class="pp-brow-col"><div class="pp-grp-sender">${esc(label)}</div><div class="pp-typing"><span></span><span></span><span></span></div></div>` : `<div class="pp-typing"><span></span><span></span><span></span></div>`}</div>`);
    msgs.scrollTop = msgs.scrollHeight;
}
function hideTyping() { document.getElementById('pp-typing')?.remove(); }

async function applyChatStyle() {
    const isGroup = !!ppActiveGroup;
    const tid = isGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null);
    if (!tid) return;
    const st = getChatStyle(tid);
    const scr = document.getElementById('pp-scr-chat');
    const msgs = document.getElementById('pp-msgs');
    if (msgs) {
        if (st.bg === 'custom') {
            const img = await loadMedia('chatbg-' + tid);
            if (img) { msgs.style.background = '#000 center/cover no-repeat'; msgs.style.backgroundImage = `url(${img})`; }
            else { msgs.style.backgroundImage = ''; msgs.style.background = ''; }
        } else { msgs.style.backgroundImage = ''; msgs.style.background = st.bg ? (CHAT_BGS[st.bg] || '') : ''; }
    }
    if (scr) {
        scr.style.setProperty('--pp-mybub', st.bubble || getCfg().accent || '#0a84ff');
        scr.style.setProperty('--pp-mytext', st.textColor || '#ffffff');
        if (st.bubbleImg) {
            const img = await loadMedia('bubbleimg-' + tid);
            if (img) { scr.style.setProperty('--pp-bubimg', `url(${img})`); scr.classList.add('has-bubimg'); } else scr.classList.remove('has-bubimg');
        } else scr.classList.remove('has-bubimg');
    }
}

// ── ตั้งค่าแชท ──
function renderChatSettings() {
    const c = ppActiveContact;
    if (!c) { ppNav('messages'); return; }
    const av = document.getElementById('pp-cs-av'); if (av) av.innerHTML = contactAvatarHTML(c, 76);
    const nm = document.getElementById('pp-cs-name'); if (nm) nm.textContent = dname(c);
    const rn = document.getElementById('pp-rename-input'); if (rn) rn.value = c.customName || '';
    const st = getChatStyle(c.id);
    const pn = document.getElementById('pp-persona-name'); if (pn) pn.value = st.personaName || '';
    const pd = document.getElementById('pp-persona-desc'); if (pd) pd.value = st.personaDesc || '';
    const npc = document.getElementById('pp-npc-toggle'); if (npc) npc.checked = !!c.npc;
    const bc = document.getElementById('pp-bubble-color'); if (bc) bc.value = st.bubble || getCfg().accent || '#0a84ff';
    const tc = document.getElementById('pp-text-color'); if (tc) tc.value = st.textColor || '#ffffff';
    buildChatSwatches();
    renderUserPersonaList();
}
function renderUserPersonaList() {
    const wrap = document.getElementById('pp-user-persona-list');
    const hint = document.getElementById('pp-cs-userpersona-hint');
    if (!wrap) return;
    const cfg = getCfg(), c = ppActiveContact;
    if (cfg.userPersonaMode === 'shared') { wrap.innerHTML = ''; if (hint) hint.innerHTML = 'ตอนนี้ตั้งเป็น "เหมือนกันทุกแชท" — เปลี่ยนได้ที่ Settings › Persona ของฉัน'; return; }
    if (hint) hint.textContent = 'เลือกว่าจะให้บอทคนนี้รู้จักคุณในฐานะ persona ไหน';
    const personas = listUserPersonas();
    const cur = c ? getChatStyle(c.id).userPersonaId : '';
    let html = `<button class="pp-persona-opt${!cur ? ' on' : ''}" data-userpersona=""><span class="pp-persona-opt-lb">ค่าเริ่มต้น (persona ปัจจุบันของ ST)</span>${!cur ? ICON.check : ''}</button>`;
    if (!personas.length) html += `<div style="font-size:12px;color:var(--pp-txt3);padding:8px 4px">ไม่พบ persona ผู้ใช้ใน SillyTavern</div>`;
    else html += personas.map(p =>
        `<button class="pp-persona-opt${cur === p.id ? ' on' : ''}" data-userpersona="${esc(p.id)}"><img class="pp-persona-opt-av" src="${esc(p.avatar)}" onerror="this.style.visibility='hidden'"><span class="pp-persona-opt-lb">${esc(p.name)}</span>${cur === p.id ? ICON.check : ''}</button>`).join('');
    wrap.innerHTML = html;
}
function buildChatSwatches() {
    const bgWrap = document.getElementById('pp-chat-bg-swatches');
    if (bgWrap) bgWrap.innerHTML = Object.keys(CHAT_BGS).map(k => `<button class="pp-cs-swatch" data-chatbg="${k}" style="background:${k ? CHAT_BGS[k] : 'var(--pp-bg3)'}">${k ? '' : 'ปกติ'}</button>`).join('');
    markChatSwatches();
}
function markChatSwatches() {
    const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null);
    if (!tid) return;
    const st = getChatStyle(tid);
    document.querySelectorAll('#pp-chat-bg-swatches .pp-cs-swatch').forEach(b => b.classList.toggle('on', b.dataset.chatbg === st.bg));
}

// ── กลุ่ม ──
function renderGroupEditor() {
    const d = ppGroupDraft || (ppGroupDraft = { id: null, name: '', members: [], knowEachOther: true, cooldownSec: 0, replyMode: 'many', warnNote: '' });
    const title = document.getElementById('pp-groupnew-title'); if (title) title.textContent = d.id ? 'แก้ไขกลุ่ม' : 'สร้างกลุ่ม';
    const saveBtn = document.getElementById('pp-group-save-btn'); if (saveBtn) saveBtn.textContent = d.id ? 'บันทึก' : 'สร้าง';
    const nm = document.getElementById('pp-group-name'); if (nm) nm.value = d.name || '';
    const know = document.getElementById('pp-group-know'); if (know) know.checked = !!d.knowEachOther;
    const rm = document.getElementById('pp-group-replymode'); if (rm) rm.value = d.replyMode || 'many';
    const cd = document.getElementById('pp-group-cooldown'); if (cd) cd.value = d.cooldownSec || 0;
    const wn = document.getElementById('pp-group-warn'); if (wn) wn.value = d.warnNote || '';
    renderGroupMemberChips();
}
function renderGroupMemberChips() {
    const wrap = document.getElementById('pp-group-member-chips');
    if (!wrap || !ppGroupDraft) return;
    wrap.innerHTML = ppGroupDraft.members.map(cid => {
        const c = getContacts().find(x => x.id === cid);
        return c ? `<span class="pp-chip">${contactAvatarHTML(c, 24)}<span>${esc(dname(c))}</span></span>` : '';
    }).join('') || `<span style="font-size:12px;color:var(--pp-txt3);padding:4px">ยังไม่ได้เลือกสมาชิก</span>`;
}
function ppGroupSave() {
    const d = ppGroupDraft;
    if (!d) return;
    d.name = (document.getElementById('pp-group-name')?.value || '').trim();
    d.knowEachOther = !!document.getElementById('pp-group-know')?.checked;
    d.replyMode = document.getElementById('pp-group-replymode')?.value || 'many';
    d.cooldownSec = Math.max(0, Math.min(600, parseInt(document.getElementById('pp-group-cooldown')?.value || '0', 10) || 0));
    d.warnNote = (document.getElementById('pp-group-warn')?.value || '').trim();
    if (!d.name) { ppToast('ตั้งชื่อกลุ่มก่อน'); return; }
    if ((d.members || []).length < 2) { ppToast('เลือกสมาชิกอย่างน้อย 2 คน'); return; }
    const cfg = getCfg();
    if (!cfg.groups) cfg.groups = [];
    if (d.id) { const g = cfg.groups.find(x => x.id === d.id); if (g) Object.assign(g, d); ppToast('บันทึกกลุ่มแล้ว'); }
    else { d.id = 'grp:' + newId(); cfg.groups.push(structuredClone(d)); ppToast('สร้างกลุ่มแล้ว'); }
    saveCfg();
    ppGroupDraft = null;
    ppNav('messages');
}
function renderGroupSettings() {
    const g = ppActiveGroup;
    const body = document.getElementById('pp-groupsettings-body');
    if (!g || !body) { ppNav('messages'); return; }
    const memberRows = groupMemberContacts(g).map(c => `<div class="pp-row" style="padding:8px 0">${contactAvatarHTML(c, 40)}<div class="pp-row-meta"><div class="pp-row-name">${esc(dname(c))}</div></div></div>`).join('');
    body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 0 16px">${groupAvatarHTML(g, 76)}<div style="font-size:18px;font-weight:700;color:var(--pp-txt)">${esc(g.name)}</div></div>
        <button id="pp-group-edit-btn" class="pp-cs-btn" style="width:100%;padding:11px">แก้ไขการตั้งค่ากลุ่ม</button>
        <div class="pp-set-label">สมาชิก (${(g.members || []).length})</div>
        <div>${memberRows}</div>
        <div class="pp-set-label">สรุปการตั้งค่า</div>
        <div class="pp-set-group">
          <div class="pp-set-row"><span>สมาชิกรู้จักกัน</span><span style="color:var(--pp-txt3)">${g.knowEachOther ? 'ใช่' : 'ไม่'}</span></div>
          <div class="pp-set-row"><span>โหมดตอบ</span><span style="color:var(--pp-txt3)">${g.replyMode === 'one' ? 'ทีละคน' : 'หลายคน'}</span></div>
          <div class="pp-set-row"><span>คูลดาวน์</span><span style="color:var(--pp-txt3)">${g.cooldownSec || 0} วิ</span></div>
        </div>
        ${g.warnNote ? `<div class="pp-set-label">โน้ตกลุ่ม</div><div class="pp-set-group"><div class="pp-set-row" style="white-space:normal">${esc(g.warnNote)}</div></div>` : ''}
        <div style="height:24px"></div>`;
    body.querySelector('#pp-group-edit-btn')?.addEventListener('click', () => { ppGroupDraft = structuredClone(g); ppNav('groupnew'); });
}
function ppDeleteGroup() {
    const g = ppActiveGroup;
    if (!g) return;
    ppActionSheet([{ label: 'ลบกลุ่มนี้', danger: true, onClick: () => {
        const cfg = getCfg();
        cfg.groups = (cfg.groups || []).filter(x => x.id !== g.id);
        delete cfg.threads[g.id];
        delete cfg.chatStyle[g.id];
        saveCfg(); ppActiveGroup = null; ppNav('messages'); ppToast('ลบกลุ่มแล้ว');
    } }]);
}
function ppOpenGroup(id) {
    const g = getGroup(id);
    if (!g) return;
    ppActiveGroup = g; ppActiveContact = null; ppHistShown = HIST_PAGE; ppNav('chat');
}

function renderProfile() {
    const av = document.getElementById('pp-profile-av'); if (av) av.innerHTML = userAvatarHTML(96);
    const nm = document.getElementById('pp-profile-name'); if (nm) nm.value = getCfg().userAppName || '';
    const nt = document.getElementById('pp-profile-note-txt'); if (nt) { const un = getUserNote(); nt.textContent = un ? un.text : '—'; }
}

// ── AI บรรยายภาพ + Island ──
function islandStatus(text) {
    clearTimeout(ppIslandTimer);
    ppIslandState = { cid: '_sys', name: 'Pocket Phone', avatar: '', kind: 'msg', text };
    islandRefresh();
}
async function captionImageAI(dataUrl) {
    const c = ctx();
    const base64 = String(dataUrl).split(',')[1] || '';
    const q = 'บรรยายรูปนี้สั้น ๆ เป็นภาษาไทย';
    try {
        if (c && typeof c.getMultimodalCaption === 'function') { const cap = await c.getMultimodalCaption(base64, q); if (cap) return stripEmoji(cleanReply(cap)).slice(0, 200); }
        if (typeof window.getMultimodalCaption === 'function') { const cap = await window.getMultimodalCaption(base64, q); if (cap) return stripEmoji(cleanReply(cap)).slice(0, 200); }
    } catch (e) { console.warn('[pocket-phone] captionAI failed', e); }
    return '';
}
// ★ 0.9.7 fix: try/finally ยุบ Island ชัวร์ ไม่ค้าง
async function captionImageAIwithIsland(dataUrl) {
    islandStatus('กำลังสร้างคำบรรยายภาพ…');
    try { return await captionImageAI(dataUrl); }
    finally { islandCollapse(); }
}

// ── ส่งรูปในแชท (สองทางเลือกเสมอ) ──
function ppPickChatImage() { document.getElementById('pp-chat-img-file')?.click(); }
async function ppHandleChatImage(file) {
    const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null);
    if (!tid || !file) return;
    const r = new FileReader();
    r.onload = async () => {
        const dataUrl = r.result;
        const mediaKey = 'chatimg-' + tid + '-' + newId();
        await saveMedia(mediaKey, dataUrl);
        const finish = (caption) => { pushThreadMsg(tid, { from: 'me', type: 'image', mediaKey, caption: caption || '' }); renderThread(); renderContactList(); };
        const aiPath = async () => { const cap = await captionImageAIwithIsland(dataUrl); if (cap) finish(cap); else ppPrompt('AI บรรยายไม่ได้ พิมพ์เอง', '', v => finish(v)); };
        ppActionSheet([
            { label: 'ให้ AI ของ ST บรรยายภาพ', onClick: aiPath },
            { label: 'พิมพ์คำบรรยายเอง', onClick: () => ppPrompt('ในภาพมีอะไร', '', v => finish(v)) },
            { label: 'ส่งโดยไม่มีคำบรรยาย', onClick: () => finish('') },
        ]);
    };
    r.readAsDataURL(file);
}

// ── สตอรี่ ──
function renderStoryTray() {
    pruneStories();
    const tray = document.getElementById('pp-story-tray');
    if (!tray) return;
    const stories = liveStories();
    const userStories = stories.filter(s => s.author === 'user');
    let html = `<div class="pp-story-cell" data-storyauthor="user">
        <div class="pp-story-ring${userStories.length ? (storyHasUnseen('user') ? ' unseen' : ' seen') : ' add'}">${userAvatarHTML(64)}${userStories.length ? '' : `<span class="pp-story-plus">${ICON.plus}</span>`}</div>
        <div class="pp-story-cell-name">สตอรี่ของฉัน</div>
    </div>`;
    getContacts().forEach(c => {
        if (!stories.some(s => s.author === c.id)) return;
        html += `<div class="pp-story-cell" data-storyauthor="${esc(c.id)}"><div class="pp-story-ring${storyHasUnseen(c.id) ? ' unseen' : ' seen'}">${contactAvatarHTML(c, 64)}</div><div class="pp-story-cell-name">${esc(dname(c))}</div></div>`;
    });
    tray.innerHTML = html;
}
function ppStoryAuthorTap(author) {
    if (author === 'user') { const mine = liveStories().filter(s => s.author === 'user'); if (mine.length) openStoryViewer('user'); else ppCreateStory(); return; }
    openStoryViewer(author);
}
function ppCreateStory() {
    ppActionSheet([
        { label: 'ลงรูปภาพ', onClick: () => document.getElementById('pp-story-img-file')?.click() },
        { label: 'ลงข้อความ', onClick: () => ppCreateTextStory() },
    ]);
}
function ppCreateTextStory() {
    ppPrompt('ข้อความสตอรี่', '', v => {
        if (!v) return;
        const bg = STORY_BGS[Math.floor(Math.random() * STORY_BGS.length)];
        const cfg = getCfg(), id = newId();
        cfg.stories.push({ id, author: 'user', type: 'text', text: v.slice(0, 200), bg, ts: Date.now(), likes: [], views: {}, replies: [] });
        saveCfg(); markStorySeen(id); renderStoryTray(); ppToast('ลงสตอรี่แล้ว');
    });
}
async function ppAddImageStory(file) {
    if (!file) return;
    const id = newId();
    const r = new FileReader();
    r.onload = async () => {
        await saveMedia('story-' + id, r.result);
        const dataUrl = r.result;
        const finish = (cap) => {
            const cfg = getCfg();
            cfg.stories.push({ id, author: 'user', type: 'image', mediaKey: 'story-' + id, text: (cap || '').slice(0, 200), ts: Date.now(), likes: [], views: {}, replies: [] });
            saveCfg(); markStorySeen(id); renderStoryTray(); ppToast('ลงสตอรี่แล้ว');
        };
        ppActionSheet([
            { label: 'ให้ AI ของ ST บรรยายภาพ', onClick: async () => { const cap = await captionImageAIwithIsland(dataUrl); if (cap) finish(cap); else ppPrompt('AI บรรยายไม่ได้ พิมพ์เอง (เว้นว่างได้)', '', v => finish(v)); } },
            { label: 'พิมพ์คำบรรยายเอง', onClick: () => ppPrompt('คำบรรยาย (เว้นว่างได้)', '', v => finish(v)) },
            { label: 'ไม่ใส่คำบรรยาย', onClick: () => finish('') },
        ]);
    };
    r.readAsDataURL(file);
}
function openStoryViewer(author) {
    const list = liveStories().filter(s => s.author === author).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    if (!list.length) return;
    ppStoryView = { list, idx: 0, author };
    const v = document.getElementById('pp-story-viewer');
    if (!v) return;
    v.style.display = 'block';
    renderStoryViewer();
}
function startStoryTimer(s) {
    clearTimeout(ppStoryTimer);
    const dur = s.type === 'image' ? 6500 : 5000;
    const bar = document.querySelector('#pp-story-viewer .pp-sv-bar i.active');
    if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = `pp-sv-fill ${dur}ms linear forwards`; }
    ppStoryTimer = setTimeout(() => storyNext(), dur);
}
function renderStoryViewer() {
    const v = document.getElementById('pp-story-viewer');
    if (!v || !ppStoryView) return;
    const { list, idx, author } = ppStoryView;
    const s = list[idx];
    if (!s) { closeStoryViewer(); return; }
    clearTimeout(ppStoryTimer);
    markStorySeen(s.id);
    const isUser = author === 'user';
    const bars = list.map((_, i) => `<div class="pp-sv-bar"><i class="${i < idx ? 'done' : ''} ${i === idx ? 'active' : ''}"></i></div>`).join('');
    const avatar = storyAuthorAvatar(s);
    const avHTML = avatar ? `<img class="pp-sv-av" src="${esc(avatar)}" onerror="this.style.visibility='hidden'">` : `<span class="pp-sv-av pp-avatar-fb" style="width:32px;height:32px">${esc(storyAuthorLabel(s)[0])}</span>`;
    let body;
    if (s.type === 'image') body = `<div class="pp-sv-img" id="pp-sv-img"></div>` + (s.text ? `<div class="pp-sv-cap">${esc(s.text)}</div>` : '');
    else body = `<div class="pp-sv-text" style="background:${s.bg || STORY_BGS[0]}">${esc(s.text)}</div>`;
    let footer;
    if (isUser) {
        const vc = Object.keys(s.views || {}).length;
        footer = `<div class="pp-sv-footer"><button class="pp-sv-viewbtn" data-svviews="1">ผู้ชม ${vc}</button><button class="pp-sv-del" data-svdel="1">${ICON.trash} ลบสตอรี่</button></div>`;
    } else {
        footer = `<div class="pp-sv-reply-bar"><input class="pp-sv-reply-input" placeholder="ตอบ ${esc(storyAuthorLabel(s))}…"><button class="pp-sv-like${(s.likes || []).includes('user') ? ' on' : ''}" data-svlike="1">${ICON.heart}</button></div>`;
    }
    v.innerHTML = `<div class="pp-sv-bars">${bars}</div>
        <div class="pp-sv-top"><div class="pp-sv-who">${avHTML}<span class="pp-sv-name">${esc(storyAuthorLabel(s))}</span><span class="pp-sv-age">${esc(fmtNoteAge(s.ts))}</span></div><button class="pp-sv-close" data-svclose="1">${ICON.close}</button></div>
        <div class="pp-sv-body">${body}</div>
        <button class="pp-sv-tap prev" data-svprev="1"></button>
        <button class="pp-sv-tap next" data-svnext="1"></button>
        ${footer}`;
    if (s.type === 'image') {
        const el = document.getElementById('pp-sv-img');
        loadMedia('story-' + s.id).then(img => { if (el && img) el.style.backgroundImage = `url(${img})`; startStoryTimer(s); }).catch(() => startStoryTimer(s));
    } else startStoryTimer(s);
    v.querySelector('[data-svclose]')?.addEventListener('click', closeStoryViewer);
    v.querySelector('[data-svprev]')?.addEventListener('click', storyPrev);
    v.querySelector('[data-svnext]')?.addEventListener('click', storyNext);
    v.querySelector('[data-svdel]')?.addEventListener('click', () => deleteStory(s.id));
    v.querySelector('[data-svlike]')?.addEventListener('click', () => { toggleStoryLike(s); renderStoryViewer(); });
    v.querySelector('[data-svviews]')?.addEventListener('click', () => showStoryViewers(s));
    const ri = v.querySelector('.pp-sv-reply-input');
    if (ri) { ri.addEventListener('focus', () => clearTimeout(ppStoryTimer)); ri.addEventListener('keydown', e => { if (e.key === 'Enter') { const t = ri.value.trim(); if (t) storyReply(s, t); } }); }
}
function storyNext() { if (!ppStoryView) return; ppStoryView.idx++; if (ppStoryView.idx >= ppStoryView.list.length) { closeStoryViewer(); return; } renderStoryViewer(); }
function storyPrev() { if (!ppStoryView) return; if (ppStoryView.idx <= 0) return; ppStoryView.idx--; renderStoryViewer(); }
function closeStoryViewer() { clearTimeout(ppStoryTimer); ppStoryView = null; const v = document.getElementById('pp-story-viewer'); if (v) { v.style.display = 'none'; v.innerHTML = ''; } if (ppCurrentScreen === 'feed') renderFeed(); }
function toggleStoryLike(s) {
    const story = (getCfg().stories || []).find(x => x.id === s.id);
    if (!story) return;
    if (!story.likes) story.likes = [];
    const i = story.likes.indexOf('user');
    if (i >= 0) story.likes.splice(i, 1); else story.likes.push('user');
    saveCfg(); s.likes = story.likes;
}
function storyReply(s, text) {
    const c = getContacts().find(x => x.id === s.author);
    if (!c) { ppToast('ตอบสตอรี่นี้ไม่ได้'); return; }
    pushThreadMsg(c.id, { from: 'me', text, replyTo: { kind: 'story', text: s.type === 'image' ? (s.text || '[รูปสตอรี่]') : s.text, author: dname(c) } });
    closeStoryViewer(); ppActiveContact = c; ppActiveGroup = null; ppNav('chat'); ppToast('ส่งคำตอบสตอรี่แล้ว');
}
function deleteStory(id) {
    const cfg = getCfg();
    cfg.stories = (cfg.stories || []).filter(x => x.id !== id);
    delMedia('story-' + id);
    saveCfg(); closeStoryViewer(); ppToast('ลบสตอรี่แล้ว');
}
function showStoryViewers(s) {
    const names = Object.keys(s.views || {}).map(cid => { const c = getContacts().find(x => x.id === cid); return c ? dname(c) : cid; });
    ppHelpPopup('ผู้ชมสตอรี่', names.length ? names.map(esc).join('<br>') : 'ยังไม่มีใครดู');
}

// ── Feed render ──
function commentAuthorLabel(cm) { if (cm.author === 'user') return getUserDisplayName(); const c = getContacts().find(x => x.id === cm.author); return c ? dname(c) : (cm.authorName || '?'); }
function commentAuthorAvatar(cm) { if (cm.author === 'user') return ppUserAvatarCache || ''; const c = getContacts().find(x => x.id === cm.author); return c ? (c.avatar || '') : ''; }
function hydrateFeedImages() {
    document.querySelectorAll('.pp-post-img[data-postimg]').forEach(el => { const p = findPost(el.dataset.postimg); if (p && p.mediaKey) loadMedia(p.mediaKey).then(img => { if (img) el.style.backgroundImage = `url(${img})`; }); });
}
function feedPostHTML(p) {
    const av = postAuthorAvatar(p);
    const avHTML = av ? `<img class="pp-post-av" src="${esc(av)}" onerror="this.style.visibility='hidden'">` : `<span class="pp-post-av pp-avatar-fb" style="width:38px;height:38px">${esc(postAuthorLabel(p)[0])}</span>`;
    const liked = (p.likes || []).includes('user');
    const img = p.mediaKey ? `<div class="pp-post-img" data-postimg="${esc(p.id)}"></div>` : '';
    const cmCount = (p.comments || []).length;
    return `<div class="pp-post" data-postid="${esc(p.id)}">
        <div class="pp-post-head">
            ${avHTML}
            <div class="pp-post-who"><span class="pp-post-name">${esc(postAuthorLabel(p))}</span><span class="pp-post-age">${esc(fmtNoteAge(p.ts))}</span></div>
            <button class="pp-post-more" data-postmenu="${esc(p.id)}">${ICON.menu}</button>
        </div>
        ${p.text ? `<div class="pp-post-text" data-postopen="${esc(p.id)}">${esc(p.text)}</div>` : ''}
        ${img}
        <div class="pp-post-actions">
            <button class="pp-post-like${liked ? ' on' : ''}" data-postlike="${esc(p.id)}">${ICON.heart}<span>${postTotalLikes(p)}</span></button>
            <button class="pp-post-cmt" data-postopen="${esc(p.id)}">${ICON.comment}<span>${cmCount}</span></button>
            <button class="pp-post-share" data-postshare="${esc(p.id)}">${ICON.share}</button>
        </div>
    </div>`;
}
function renderFeed() {
    document.querySelectorAll('.pp-feed-tab').forEach(b => b.classList.toggle('on', b.dataset.feedtab === ppFeedTab));
    const tray = document.getElementById('pp-story-tray');
    if (tray) { tray.style.display = ppFeedTab === 'feed' ? 'flex' : 'none'; if (ppFeedTab === 'feed') renderStoryTray(); }
    const list = document.getElementById('pp-feed-list');
    if (!list) return;
    const posts = feedByTab(ppFeedTab);
    if (!posts.length) { list.innerHTML = `<div class="pp-empty">${ppFeedTab === 'news' ? 'ยังไม่มีข่าว' : 'ยังไม่มีโพสต์'}<br><span>แตะ ✦ ให้บอทเคลื่อนไหว หรือ + สร้างเอง</span></div>`; return; }
    list.innerHTML = posts.map(feedPostHTML).join('');
    hydrateFeedImages();
}
function renderPost() {
    const p = findPost(ppActivePost);
    if (!p) { ppNav('feed'); return; }
    const body = document.getElementById('pp-post-body');
    if (!body) return;
    const av = postAuthorAvatar(p);
    const avHTML = av ? `<img class="pp-post-av" src="${esc(av)}" onerror="this.style.visibility='hidden'">` : `<span class="pp-post-av pp-avatar-fb" style="width:38px;height:38px">${esc(postAuthorLabel(p)[0])}</span>`;
    const liked = (p.likes || []).includes('user');
    let html = `<div class="pp-post pp-post-full">
        <div class="pp-post-head">${avHTML}<div class="pp-post-who"><span class="pp-post-name">${esc(postAuthorLabel(p))}</span><span class="pp-post-age">${esc(fmtNoteAge(p.ts))}</span></div><button class="pp-post-more" data-postmenu="${esc(p.id)}">${ICON.menu}</button></div>
        ${p.text ? `<div class="pp-post-text">${esc(p.text)}</div>` : ''}
        ${p.mediaKey ? `<div class="pp-post-img" data-postimg="${esc(p.id)}"></div>` : ''}
        <div class="pp-post-actions">
            <button class="pp-post-like${liked ? ' on' : ''}" data-postlike="${esc(p.id)}">${ICON.heart}<span>${postTotalLikes(p)}</span></button>
            <button class="pp-post-cmt">${ICON.comment}<span>${(p.comments || []).length}</span></button>
            <button class="pp-post-share" data-postshare="${esc(p.id)}">${ICON.share}</button>
        </div>
    </div>`;
    html += `<div class="pp-cmt-head">คอมเมนต์</div>`;
    const comments = p.comments || [];
    const childrenOf = pid => comments.filter(cm => cm.parentId === pid);
    const cmHTML = (cm, depth) => {
        const cav = commentAuthorAvatar(cm);
        const cavHTML = cav ? `<img class="pp-cmt-av" src="${esc(cav)}" onerror="this.style.visibility='hidden'">` : `<span class="pp-cmt-av pp-avatar-fb" style="width:30px;height:30px">${esc(commentAuthorLabel(cm)[0])}</span>`;
        const cliked = (cm.likes || []).includes('user');
        const parentName = cm.parentId ? (() => { const par = comments.find(x => x.id === cm.parentId); return par ? commentAuthorLabel(par) : ''; })() : '';
        let h = `<div class="pp-cmt${depth ? ' child' : ''}" data-cmtid="${esc(cm.id)}">
            ${cavHTML}
            <div class="pp-cmt-body">
                <div class="pp-cmt-bubble"><span class="pp-cmt-name">${esc(commentAuthorLabel(cm))}</span>${parentName ? `<span class="pp-cmt-to" data-cmtwarp="${esc(cm.parentId)}">▸ ${esc(parentName)}</span>` : ''}<span class="pp-cmt-txt">${esc(cm.text)}</span></div>
                <div class="pp-cmt-meta">
                    <span>${esc(fmtNoteAge(cm.ts))}</span>
                    <button class="pp-cmt-reply" data-cmtreply="${esc(cm.id)}">ตอบกลับ</button>
                    <button class="pp-cmt-like${cliked ? ' on' : ''}" data-cmtlike="${esc(cm.id)}">${ICON.heart}<span>${commentTotalLikes(cm)}</span></button>
                    <button class="pp-cmt-del" data-cmtdel="${esc(cm.id)}">${ICON.trash}</button>
                </div>
            </div>
        </div>`;
        childrenOf(cm.id).forEach(ch => h += cmHTML(ch, depth + 1));
        return h;
    };
    const roots = comments.filter(cm => !cm.parentId);
    if (roots.length) html += roots.map(cm => cmHTML(cm, 0)).join('');
    else html += `<div class="pp-sys">ยังไม่มีคอมเมนต์ · แตะ ✦ ให้บอทคอมเมนต์ หรือพิมพ์เอง</div>`;
    body.innerHTML = html;
    hydrateFeedImages();
}

// ── สร้างโพสต์ ──
function renderNewPost() {
    const d = ppNewPostDraft || (ppNewPostDraft = { text: '', mediaKey: null, dataUrl: null, caption: '', responders: [], knowEachOther: true });
    const title = document.getElementById('pp-newpost-title'); if (title) title.textContent = ppFeedTab === 'news' ? 'เขียนข่าว' : 'สร้างโพสต์';
    const ta = document.getElementById('pp-newpost-text'); if (ta) ta.value = d.text || '';
    const capBox = document.getElementById('pp-newpost-caption-box');
    const imgWrap = document.getElementById('pp-newpost-img-wrap');
    if (imgWrap) { imgWrap.innerHTML = d.dataUrl ? `<img src="${d.dataUrl}" style="width:100%;border-radius:14px;display:block">` : ''; imgWrap.style.display = d.dataUrl ? 'block' : 'none'; }
    if (capBox) capBox.style.display = d.dataUrl ? 'block' : 'none';
    const cap = document.getElementById('pp-newpost-caption'); if (cap) cap.value = d.caption || '';
    const know = document.getElementById('pp-newpost-know'); if (know) know.checked = d.knowEachOther !== false;
    renderNewPostResponderChips();
}
function renderNewPostResponderChips() {
    const wrap = document.getElementById('pp-newpost-responder-chips');
    const btn = document.getElementById('pp-newpost-responders-btn');
    if (!wrap || !ppNewPostDraft) return;
    const arr = ppNewPostDraft.responders || [];
    if (btn) btn.textContent = arr.length ? `จำกัด ${arr.length} คน (แตะเพื่อแก้)` : 'ทุกคน (แตะเพื่อจำกัด)';
    wrap.innerHTML = arr.map(cid => { const c = getContacts().find(x => x.id === cid); return c ? `<span class="pp-chip">${contactAvatarHTML(c, 24)}<span>${esc(dname(c))}</span></span>` : ''; }).join('');
}
function ppNewPostSave() {
    const d = ppNewPostDraft;
    if (!d) return;
    d.text = (document.getElementById('pp-newpost-text')?.value || '').trim();
    d.caption = (document.getElementById('pp-newpost-caption')?.value || '').trim();
    d.knowEachOther = document.getElementById('pp-newpost-know')?.checked !== false;
    if (!d.text && !d.mediaKey) { ppToast('ใส่ข้อความหรือรูปก่อน'); return; }
    const kind = ppFeedTab === 'news' ? 'news' : 'post';
    getCfg().feedPosts.push({
        id: newId(), author: 'user', kind, text: d.text, caption: d.caption,
        mediaKey: d.mediaKey || undefined,
        responders: (d.responders && d.responders.length) ? d.responders.slice() : null,
        knowEachOther: d.knowEachOther,
        ts: Date.now(), likes: [], extraLikes: 0, comments: [], views: {},
    });
    saveCfg();
    ppNewPostDraft = null;
    ppNav('feed'); ppToast('โพสต์แล้ว');
}
async function ppNewPostPickImage(file) {
    if (!file || !ppNewPostDraft) return;
    const r = new FileReader();
    r.onload = async () => {
        const dataUrl = r.result;
        const key = 'feed-' + newId();
        await saveMedia(key, dataUrl);
        ppNewPostDraft.mediaKey = key;
        ppNewPostDraft.dataUrl = dataUrl;
        renderNewPost();
    };
    r.readAsDataURL(file);
}

function toggleFeedLike(id) {
    const p = findPost(id); if (!p) return;
    if (!p.likes) p.likes = [];
    const i = p.likes.indexOf('user');
    if (i >= 0) p.likes.splice(i, 1); else p.likes.push('user');
    saveCfg();
    if (ppCurrentScreen === 'postview') renderPost(); else renderFeed();
}
function toggleCommentLike(cid) {
    const p = findPost(ppActivePost); if (!p) return;
    const cm = (p.comments || []).find(x => x.id === cid); if (!cm) return;
    if (!cm.likes) cm.likes = [];
    const i = cm.likes.indexOf('user');
    if (i >= 0) cm.likes.splice(i, 1); else cm.likes.push('user');
    saveCfg(); renderPost();
}
function ppSendComment() {
    const p = findPost(ppActivePost); if (!p) return;
    const inp = document.getElementById('pp-comment-input');
    const t = (inp.value || '').trim(); if (!t) return;
    inp.value = ''; inp.style.height = 'auto';
    if (!p.comments) p.comments = [];
    p.comments.push({ id: newId(), author: 'user', text: t, ts: Date.now(), likes: [], extraLikes: 0, parentId: null });
    saveCfg(); renderPost();
}
function ppReplyComment(cid) {
    const p = findPost(ppActivePost); if (!p) return;
    const parent = (p.comments || []).find(x => x.id === cid); if (!parent) return;
    ppReplyComposer({
        title: 'ตอบคอมเมนต์', quotedLabel: commentAuthorLabel(parent), quoted: parent.text,
        onOk: (text) => { p.comments.push({ id: newId(), author: 'user', text, ts: Date.now(), likes: [], extraLikes: 0, parentId: cid }); saveCfg(); renderPost(); }
    });
}
function ppDeleteComment(cid) {
    const p = findPost(ppActivePost); if (!p) return;
    ppActionSheet([{ label: 'ลบคอมเมนต์นี้ (รวมที่ตอบใต้)', danger: true, onClick: () => {
        const toDel = new Set([cid]);
        let changed = true;
        while (changed) { changed = false; (p.comments || []).forEach(cm => { if (cm.parentId && toDel.has(cm.parentId) && !toDel.has(cm.id)) { toDel.add(cm.id); changed = true; } }); }
        p.comments = (p.comments || []).filter(cm => !toDel.has(cm.id));
        saveCfg(); renderPost(); ppToast('ลบคอมเมนต์แล้ว');
    } }]);
}
function ppCommentWarp(cid) {
    const el = document.querySelector(`#pp-post-body .pp-cmt[data-cmtid="${CSS.escape(cid)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('pp-warp-hl'); setTimeout(() => el.classList.remove('pp-warp-hl'), 1600);
}
function ppDeletePost(id) {
    const p = findPost(id); if (!p) return;
    ppActionSheet([
        { label: 'แชร์เข้าแชท', onClick: () => ppSharePostToChat(id) },
        { label: 'ลบโพสต์', danger: true, onClick: () => { const cfg = getCfg(); if (p.mediaKey) delMedia(p.mediaKey); cfg.feedPosts = cfg.feedPosts.filter(x => x.id !== id); saveCfg(); if (ppCurrentScreen === 'postview') ppNav('feed'); else renderFeed(); ppToast('ลบแล้ว'); } },
    ]);
}
function ppSharePostToChat(postId) {
    const targets = getContacts();
    if (!targets.length) { ppToast('ยังไม่มีคอนแทกต์'); return; }
    ppActionSheet(targets.slice(0, 8).map(c => ({
        label: `ส่งให้ ${dname(c)}`, onClick: () => {
            pushThreadMsg(c.id, { from: 'me', type: 'sharedpost', postId });
            ppActiveContact = c; ppActiveGroup = null; ppNav('chat'); ppToast('แชร์เข้าแชทแล้ว');
        }
    })));
}
function feedSearchTop5() {
    const top = topFeedPosts(5);
    if (!top.length) { ppHelpPopup('ยอดนิยม', 'ยังไม่มีโพสต์'); return; }
    const body = top.map((p, i) => `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:.5px solid rgba(255,255,255,.1)"><b style="color:var(--pp-accent)">${i + 1}</b><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">${esc(postAuthorLabel(p))} · ${postTotalLikes(p)} ถูกใจ</div><div style="font-size:12px;opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.text || '[รูป]')}</div></div></div>`).join('');
    ppHelpPopup('5 อันดับยอดนิยม', body);
}

// ── Feed generation ──
function feedGenAffectRpBlock() { return getCfg().universeAffectsRP ? mainChatRecap(10) : ''; }
async function ppFeedGenerate() {
    if (ppFeedGenBusy || ppGeneratingId) return;
    const pool = feedNpcPool();
    if (!pool.length) { ppToast('ยังไม่มีคอนแทกต์ให้โพสต์ (เพิ่มคนคุยก่อน)'); return; }
    ppFeedGenBusy = true;
    const genBtn = document.getElementById('pp-feed-gen-btn');
    if (genBtn) genBtn.disabled = true;
    islandStatus('กำลังให้บอทเคลื่อนไหวในฟีด…');
    try {
        const author = pool[Math.floor(Math.random() * pool.length)];
        const persona = getEffectivePersona(author.id);
        const rp = feedGenAffectRpBlock();
        const period = periodPromptNote();
        const isNews = ppFeedTab === 'news';
        const prompt = [
            isNews ? `[In-world news feed. Write a short news item from a local news source in this world.]`
                   : `[Social media app — you ARE strictly ${dname(author)}. Post only in this character's own voice.]`,
            !isNews && persona ? `You are this character. Stay fully in persona: ${persona}` : null,
            rp ? `Ongoing story context (stay consistent):\n${rp}` : null,
            period ? `Context about ${getUserDisplayName()}: ${period}` : null,
            isNews ? `Write one short headline + 1-2 line body, each line inside quotes " ". Then a new line: [LIKES] N.`
                   : `Write a short spontaneous post (1-3 short lines) as ${dname(author)}. Put EVERY line inside quotes " ". Then a new line: [LIKES] N (realistic like count).`,
            `Reply in the SAME language the user uses (Thai). No emoji. No planning. No narration. Only the quoted post text + the [LIKES] line.`,
        ].filter(Boolean).join('\n');
        let raw = await genWithRetry(prompt, 3);
        const likesM = raw.match(/\[LIKES\]\s*(\d+)/i);
        const extraLikes = likesM ? parseInt(likesM[1], 10) : (Math.floor(Math.random() * 40) + 5);
        const text = spokenOrFallback(raw, 4).join('\n');
        if (text) {
            getCfg().feedPosts.push({ id: newId(), author: isNews ? 'news' : author.id, kind: isNews ? 'news' : 'post', authorName: isNews ? 'ข่าว' : dname(author), text: text.slice(0, 1000), responders: null, knowEachOther: true, ts: Date.now(), likes: [], extraLikes, comments: [], views: {} });
            saveCfg(); renderFeed(); ppToast('มีโพสต์ใหม่');
            if (!isNews) { pushNotif(author.id, 'feed', `${dname(author)} โพสต์ใหม่`); if (!document.getElementById('pp-dialog')?.open) islandNotify(author, `${dname(author)} โพสต์ใหม่`); }
        } else ppToast('บอทยังไม่โพสต์ ลองใหม่');
    } catch (e) { console.error('[pocket-phone] feed gen', e); ppToast('เชื่อมต่อไม่ได้'); }
    finally { ppFeedGenBusy = false; islandCollapse(); const b = document.getElementById('pp-feed-gen-btn'); if (b) b.disabled = false; }
}
async function ppPostGenerate() {
    const p = findPost(ppActivePost);
    if (!p || ppFeedGenBusy) return;
    const pool = postResponderPool(p);
    if (!pool.length) { ppToast('ไม่มีผู้ที่อนุญาตให้ตอบโพสต์นี้'); return; }
    ppFeedGenBusy = true;
    const genBtn = document.getElementById('pp-post-gen-btn');
    if (genBtn) genBtn.disabled = true;
    islandStatus('กำลังให้บอทคอมเมนต์…');
    try {
        const names = pool.map(c => dname(c));
        const profiles = pool.map(c => { const pr = getEffectivePersona(c.id); return `- ${dname(c)}: ${pr ? pr.replace(/\n+/g, ' ').slice(0, 160) : '(ไม่มีข้อมูล)'}`; }).join('\n');
        const existing = (p.comments || []).map(cm => `${commentAuthorLabel(cm)}: ${cm.text}`).join('\n');
        const period = periodPromptNote();
        const rp = feedGenAffectRpBlock();
        const know = p.knowEachOther !== false;
        const prompt = [
            `[Social media comment section. Each character comments strictly IN THEIR OWN persona and voice.]`,
            `Post by ${postAuthorLabel(p)}: "${String(p.text || '[รูปภาพ]').slice(0, 400)}"`,
            (p.caption ? `Image in post: ${p.caption}` : null),
            `Character profiles (obey each voice exactly):\n${profiles}`,
            rp ? `Story context:\n${rp}` : null,
            period ? `Note about ${getUserDisplayName()}: ${period}` : null,
            existing ? `Existing comments:\n${existing}` : null,
            know ? `These characters KNOW each other and can reply to one another and to ${getUserDisplayName()}.`
                 : `These characters do NOT know each other — each only reacts to the post itself, never to other commenters.`,
            `Generate several NEW comments (no limit). Each on ITS OWN line, format EXACTLY: [CharacterName|N] "comment text"`,
            know ? `To reply to an earlier commenter: [CharacterName|N > TargetName] "comment text"` : ``,
            `Put the comment text inside quotes " ". N = small realistic like count. Use ONLY these names: ${names.join(', ')}. Same language as post (Thai).`,
            `STRICT: quoted text = only what that character would type. No planning, no narration, no asterisks, no extra tags.`,
        ].filter(Boolean).join('\n');
        let raw = await genWithRetry(prompt, 3);
        const lines = String(raw || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
        let added = 0;
        for (const line of lines) {
            const mm = line.match(/^\[([^|\]>]+?)\s*\|?\s*(\d*)\s*(?:>\s*([^\]]+))?\]\s*(.+)$/);
            if (!mm) continue;
            const authorName = mm[1].trim();
            const likes = parseInt(mm[2] || '0', 10) || 0;
            const targetName = (mm[3] || '').trim();
            // ดึงเฉพาะใน " " ของส่วน comment · ถ้าไม่มี quote ใช้ทั้งท่อน (fallback)
            const q = extractSpoken(mm[4]);
            let text = (q.length ? q[0] : stripEmoji(cleanReply(mm[4]).replace(/^["'“”‘’„«»「」『』]+|["'“”‘’„«»「」『』]+$/g, '')).trim());
            if (!text || looksLikeThought(text)) continue;
            const c = pool.find(x => dname(x) === authorName) || pool.find(x => authorName.includes(dname(x)));
            let parentId = null;
            if (know && targetName) {
                const par = (p.comments || []).slice().reverse().find(cm => commentAuthorLabel(cm) === targetName || targetName.includes(commentAuthorLabel(cm)));
                if (par) parentId = par.id;
            }
            p.comments.push({ id: newId(), author: c ? c.id : 'npc', authorName, text, ts: Date.now(), likes: [], extraLikes: likes, parentId });
            added++;
        }
        saveCfg(); renderPost();
        ppToast(added ? `+${added} คอมเมนต์` : 'บอทยังไม่คอมเมนต์ ลองใหม่');
    } catch (e) { console.error('[pocket-phone] post gen', e); ppToast('เชื่อมต่อไม่ได้'); }
    finally { ppFeedGenBusy = false; islandCollapse(); const b = document.getElementById('pp-post-gen-btn'); if (b) b.disabled = false; }
}

// ── ประจำเดือน ──
function renderPeriod() {
    const status = document.getElementById('pp-period-status');
    if (status) {
        const info = periodTodayInfo();
        if (info.onPeriod) status.innerHTML = `<div class="pp-period-badge on">วันนี้เป็นวันที่ ${info.dayNum} ของรอบเดือน</div>`;
        else if (info.upcomingIn != null) status.innerHTML = `<div class="pp-period-badge">อีก ${info.upcomingIn} วันจะถึงรอบถัดไป</div>`;
        else status.innerHTML = `<div class="pp-period-badge">ยังไม่ได้ทำเครื่องหมายวัน</div>`;
    }
    const ml = document.getElementById('pp-period-month');
    if (ml) ml.textContent = `${TH_MONTHS_FULL[ppCalMonth.getMonth()]} ${ppCalMonth.getFullYear()}`;
    const grid = document.getElementById('pp-cal-grid');
    if (!grid) return;
    const y = ppCalMonth.getFullYear(), mo = ppCalMonth.getMonth();
    const first = new Date(y, mo, 1).getDay();
    const days = new Date(y, mo + 1, 0).getDate();
    const todayStr = ymd(new Date());
    let html = '';
    for (let i = 0; i < first; i++) html += `<span class="pp-cal-cell empty"></span>`;
    for (let d = 1; d <= days; d++) {
        const sd = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const on = isPeriodDay(sd), today = sd === todayStr;
        html += `<button class="pp-cal-cell${on ? ' on' : ''}${today ? ' today' : ''}" data-calday="${sd}">${d}</button>`;
    }
    grid.innerHTML = html;
}
function ppCalNav(delta) { ppCalMonth = new Date(ppCalMonth.getFullYear(), ppCalMonth.getMonth() + delta, 1); renderPeriod(); }

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
    el.dataset.cid = state.cid || '';
    if (isExt) el.style.display = 'flex';
    const av = state.avatar ? `<img class="pp-island-av" src="${esc(state.avatar)}" onerror="this.style.visibility='hidden'">` : `<span class="pp-island-av pp-island-av-fb">${esc((state.name || '?')[0])}</span>`;
    const body = state.kind === 'typing' ? `<div class="pp-island-typing"><span></span><span></span><span></span></div>` : `<div class="pp-island-msg">${esc(state.text || '')}</div>`;
    el.innerHTML = `${av}<div class="pp-island-body"><div class="pp-island-name">${esc(state.name)}</div>${body}</div>`;
    void el.offsetWidth;
    requestAnimationFrame(() => {
        el.classList.add('pp-island-live');
        if (isExt) { el.style.width = 'min(340px, 92vw)'; el.style.height = '66px'; el.style.borderRadius = '30px'; el.style.justifyContent = 'flex-start'; el.style.padding = '0 16px'; el.style.gap = '12px'; }
    });
}
function islandRefresh() {
    const internal = document.getElementById('pp-island');
    const external = document.getElementById('pp-ext-island');
    const open = !!document.getElementById('pp-dialog')?.open;
    if (internal) { if (open && getCfg().dynamicIsland && ppIslandState) renderIslandInto(internal, ppIslandState); else renderIslandInto(internal, null); }
    if (external) { const showExt = !open && ppIslandState && (getCfg().islandScope === 'always' || ppIslandState.notify); renderIslandInto(external, showExt ? ppIslandState : null); }
}
function islandTyping(c) { clearTimeout(ppIslandTimer); ppIslandState = { cid: c.id, name: dname(c), avatar: c.avatar, kind: 'typing' }; islandRefresh(); }
function islandShowReplies(c, lines, notify) {
    clearTimeout(ppIslandTimer);
    let i = 0;
    const step = () => {
        if (i >= lines.length) { ppIslandState = null; islandRefresh(); return; }
        ppIslandState = { cid: c.id, name: dname(c), avatar: c.avatar, kind: 'msg', text: lines[i], notify: !!notify };
        islandRefresh(); i++;
        ppIslandTimer = setTimeout(step, 2600);
    };
    step();
}
function islandNotify(c, text) {
    clearTimeout(ppIslandTimer);
    ppIslandState = { cid: c ? c.id : '', name: c ? dname(c) : 'Pocket Phone', avatar: c ? c.avatar : '', kind: 'msg', text, notify: true };
    islandRefresh();
    ppIslandTimer = setTimeout(() => { ppIslandState = null; islandRefresh(); }, 4200);
}
function islandCollapse() { clearTimeout(ppIslandTimer); ppIslandState = null; islandRefresh(); }

function ppOpenThread(id) {
    const c = getContacts().find(x => x.id === id);
    if (!c) return;
    ppActiveContact = c; ppActiveGroup = null; ppHistShown = HIST_PAGE; ppNav('chat');
}
function ppAddContact(id) {
    const c = listStCharacters().find(x => x.id === id);
    if (!c) return;
    const cfg = getCfg();
    if (!cfg.contacts.find(x => x.id === id)) { cfg.contacts.push({ id: c.id, name: c.name, avatar: c.avatar }); saveCfg(); ppToast(`เพิ่ม ${c.name} แล้ว`); renderAddContacts(); }
}
function ppDeleteMsg(idx) {
    const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null);
    if (!tid) return;
    const th = getThread(tid);
    if (idx < 0 || idx >= th.length) return;
    const m = th[idx];
    if (m && m.type === 'image' && m.mediaKey) delMedia(m.mediaKey);
    th.splice(idx, 1);
    saveCfg(); renderThread(); renderContactList();
}
function ppTogglePin(id) {
    const cfg = getCfg();
    if (!cfg.pinned) cfg.pinned = [];
    const i = cfg.pinned.indexOf(id);
    if (i >= 0) cfg.pinned.splice(i, 1); else cfg.pinned.push(id);
    saveCfg(); renderContactList(); ppToast(i >= 0 ? 'เลิกปักหมุด' : 'ปักหมุดแล้ว');
}
function ppToggleNpc(id) {
    const c = getContacts().find(x => x.id === id);
    if (!c) return;
    c.npc = !c.npc;
    if (ppActiveContact && ppActiveContact.id === id) ppActiveContact.npc = c.npc;
    saveCfg(); ppToast(c.npc ? 'ย้ายไปหมวด NPC' : 'ย้ายไปหมวดตัวละคร');
}
function ppDeleteChat(id) {
    const cfg = getCfg();
    cfg.contacts = cfg.contacts.filter(x => x.id !== id);
    (cfg.threads[id] || []).forEach(m => { if (m.type === 'image' && m.mediaKey) delMedia(m.mediaKey); });
    delete cfg.threads[id];
    delete cfg.chatStyle[id];
    if (cfg.botNotes) delete cfg.botNotes[id];
    cfg.pinned = (cfg.pinned || []).filter(x => x !== id);
    cfg.callLog = (cfg.callLog || []).filter(l => l.cid !== id);
    (cfg.groups || []).forEach(g => { g.members = (g.members || []).filter(m => m !== id); });
    saveCfg(); renderNotesRow(); renderContactList(); ppToast('ลบแชทแล้ว — เพิ่มใหม่ได้จากปุ่ม +');
}

function ppSendUserMessage() {
    const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null);
    if (!tid) return false;
    const input = document.getElementById('pp-input');
    const text = (input.value || '').trim();
    if (!text) return false;
    input.value = ''; input.style.height = 'auto';
    pushThreadMsg(tid, { from: 'me', text });
    renderThread();
    return true;
}
function ppViewing(tid) {
    return ppCurrentScreen === 'chat' && !!document.getElementById('pp-dialog')?.open &&
        ((ppActiveGroup && ppActiveGroup.id === tid) || (ppActiveContact && ppActiveContact.id === tid));
}

// ── หยุดเจน ──
function showGenControls(active) {
    const gen = document.getElementById('pp-gen');
    const stop = document.getElementById('pp-stop');
    if (gen) gen.style.display = active ? 'none' : 'flex';
    if (stop) stop.style.display = active ? 'flex' : 'none';
}
function ppStopGen() {
    if (!ppGeneratingId) return;
    ppGenAbort = true;
    try { const c = ctx(); if (c && typeof c.stopGeneration === 'function') c.stopGeneration(); } catch {}
    hideTyping(); islandCollapse(); showGenControls(false);
}

// ── generation core ──
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
        if (ppGenAbort) return '';
        try { const raw = await genOnce(prompt); const cleaned = cleanReply(raw); if (cleaned) return raw; }
        catch (e) { lastErr = e; console.warn('[pocket-phone] gen retry', t + 1, e); }
        await new Promise(r => setTimeout(r, 400 * (t + 1)));
    }
    if (lastErr) throw lastErr;
    return '';
}
async function ppRegenerate() {
    const c = ppActiveContact;
    if (!c || ppGeneratingId || ppActiveGroup) return;
    const th = getThread(c.id);
    while (th.length && th[th.length - 1].from === 'them' && th[th.length - 1].type !== 'call') th.pop();
    saveCfg(); renderThread(); ppGenerateReply();
}

// ── รวมจักรวาล ──
function findMentionedContact(text, excludeId) {
    const s = String(text || '');
    const cands = getContacts().filter(c => c.id !== excludeId).map(c => ({ c, names: [c.name, c.customName].filter(Boolean) })).sort((a, b) => Math.max(...b.names.map(n => n.length)) - Math.max(...a.names.map(n => n.length)));
    for (const { c, names } of cands) for (const nm of names) if (nm && nm.length >= 2 && s.includes(nm)) return c;
    return null;
}
async function universeInterject(interloper) {
    try {
        const userName = getUserDisplayName();
        const persona = getEffectivePersona(interloper.id);
        const th = getThread(interloper.id).slice(-6);
        const histTxt = th.map(m => {
            if (m.type === 'call') return `[${m.dir === 'out' ? 'โทรออก' : 'สายเข้า'}]`;
            if (m.type === 'image') return `[รูป]`;
            if (m.type === 'voice') return `(เสียง) ${m.text}`;
            if (m.type === 'sharedpost') return `[แชร์โพสต์]`;
            return `${m.from === 'me' ? userName : dname(interloper)}: ${m.text}`;
        }).join('\n');
        const prompt = [
            `[Text messaging app — you are strictly ${dname(interloper)}, messaging ${userName} right now.]`,
            persona ? `You are this character. Stay in persona: ${persona}` : null,
            histTxt ? `\nEarlier messages with ${userName}:\n${histTxt}` : `\nYou haven't talked with ${userName} in a while.`,
            `\nSend a short spontaneous message (1-2 lines). Put EVERY line inside quotes " ".`,
            `Same language as ${userName} (Thai). No emoji. No planning. No narration. Only quoted chat text.`,
        ].filter(Boolean).join('\n');
        let raw = await genWithRetry(prompt, 2);
        const lines = spokenOrFallback(raw, 2);
        if (!lines.length) return;
        lines.forEach(t => pushThreadMsg(interloper.id, { from: 'them', text: t }));
        renderContactList();
        pushNotif(interloper.id, 'msg', lines[0]);
        if (ppViewing(interloper.id)) islandShowReplies(interloper, [lines[0]]);
        else islandNotify(interloper, lines[0]);
    } catch (e) { console.warn('[pocket-phone] universe interject failed', e); }
}

// ── ★ เจนแชทเดี่ยว (โน้ต = context ทางเลือก · เอาเฉพาะ " ") ──
async function ppGenerateReply() {
    if (ppActiveGroup) return ppGroupGenerate();
    const c = ppActiveContact;
    if (!c || ppGeneratingId || ppCall) return;
    const input = document.getElementById('pp-input');
    if (input && input.value.trim()) ppSendUserMessage();
    if (!getThread(c.id).some(m => m.from === 'me')) { ppToast('พิมพ์ข้อความก่อน แล้วค่อยกดให้บอทตอบ'); return; }

    ppGeneratingId = c.id;
    ppGenAbort = false;
    showGenControls(true);
    if (ppViewing(c.id)) { document.getElementById('pp-regen-row')?.remove(); showTyping(); }
    islandTyping(c);
    renderContactList();

    let produced = [], failed = false, botCalls = false, mentioned = null, aborted = false;
    try {
        const userName = getUserDisplayName();
        const persona = getEffectivePersona(c.id);
        const up = getEffectiveUserPersona(c.id);
        const un = getUserNote();
        const rp = getCfg().universeAffectsRP ? mainChatRecap(10) : '';
        const period = periodPromptNote();
        const th = getThread(c.id).slice(-HIST_LIMIT);
        const histTxt = th.map(m => {
            if (m.type === 'call') return `[${m.dir === 'out' ? `${userName} called ${dname(c)}` : `${dname(c)} called ${userName}`}${m.text ? ': ' + m.text : ''}]`;
            if (m.type === 'image') return `${m.from === 'me' ? userName : dname(c)}: [ส่งรูป${m.caption ? ': ' + m.caption : ''}]`;
            if (m.type === 'voice') return `${m.from === 'me' ? userName : dname(c)}: (ข้อความเสียง) ${m.text}`;
            if (m.type === 'sharedpost') { const p = findPost(m.postId); return `${m.from === 'me' ? userName : dname(c)}: [แชร์โพสต์: ${p ? (p.text || '[รูป]').slice(0, 80) : 'ถูกลบ'}]`; }
            const pre = m.replyTo ? `(ตอบ${m.replyTo.kind === 'story' ? 'สตอรี่' : m.replyTo.kind === 'msg' ? 'ข้อความ' : 'โน้ต'}: ${m.replyTo.text}) ` : '';
            return `${m.from === 'me' ? userName : dname(c)}: ${pre}${m.text}`;
        }).join('\n');

        const prompt = [
            `[Text messaging app — you are strictly ${dname(c)}, chatting with ${userName}.]`,
            persona ? `You ARE this character. Stay fully in this persona: ${persona}` : null,
            (up && (up.name || up.desc)) ? `Who you are chatting with (${userName}): ${[up.name ? 'Name: ' + up.name : '', up.desc].filter(Boolean).join(' — ')}` : null,
            rp ? `Ongoing roleplay context (stay consistent):\n${rp}` : null,
            period ? `Important — ${period}` : null,
            // ★ โน้ต = context ทางเลือก บอทเลือกเอง ไม่บังคับ
            un ? `${userName}'s current status note reads: "${un.text}". You may glance at it. Mention it ONLY if your character would naturally care — otherwise ignore it and just answer their latest message. Do NOT force a reaction.` : null,
            histTxt ? `\n<history>\n${histTxt}\n</history>` : null,
            `\nReply to ${userName}'s LAST message, in character as ${dname(c)}, with 1-3 short chat lines.`,
            `Reply in the SAME language the conversation uses (Thai if Thai).`,
            `OUTPUT FORMAT (strict): put EVERY chat line inside double quotes " ". Example: "ไง" then next line "ทำอะไรอยู่".`,
            `Output ONLY quoted chat lines. No planning, no thoughts, no narration, no actions, no asterisks, no descriptions. Anything outside " " will be discarded.`,
            getCfg().botCallKeyword ? `If you'd rather call than text, include a phrase like "โทรหา"/"เดี๋ยวโทร" inside a quoted line.` : null,
            `You may send a voice message by a single line exactly: [VOICE] the words (use rarely).`,
            `You may update your own status by a final line exactly: [NOTE] your short status.`,
        ].filter(Boolean).join('\n');

        let raw = await genWithRetry(prompt, 3);
        if (ppGenAbort) { aborted = true; }
        else {
            // parse คำสั่ง [ ] ก่อน
            const noteMatch = raw.match(/\[NOTE\]\s*(.+)$/im);
            if (noteMatch) setBotNote(c.id, stripEmoji(noteMatch[1].trim().replace(/["“”„«»「」『』]/g, '')));
            let voiceMsg = null;
            const vMatch = raw.match(/\[VOICE\]\s*(.+)$/im);
            if (vMatch) { const t = stripEmoji(vMatch[1].trim().replace(/["“”„«»「」『']/g, '')); if (t) voiceMsg = { from: 'them', type: 'voice', text: t, dur: Math.min(30, Math.max(2, Math.round(t.length / 8))) }; }
            // ★ เอาเฉพาะข้อความใน " "
            const lines = spokenOrFallback(raw, 3);
            const hasCall = getCfg().botCallKeyword && ppViewing(c.id) && lines.some(wantsToCall);
            if (!lines.length && !voiceMsg) failed = true;
            else if (hasCall) botCalls = true;
            else {
                for (let i = 0; i < lines.length && !ppGenAbort; i++) {
                    await new Promise(r => setTimeout(r, i === 0 ? 300 : 500 + Math.random() * 400));
                    if (ppGenAbort) break;
                    pushThreadMsg(c.id, { from: 'them', text: lines[i] });
                    produced.push(lines[i]);
                    if (ppViewing(c.id)) renderThread();
                }
                if (voiceMsg && !ppGenAbort) { await new Promise(r => setTimeout(r, 400)); if (!ppGenAbort) { pushThreadMsg(c.id, voiceMsg); if (ppViewing(c.id)) renderThread(); } }
                if (ppGenAbort) aborted = true;
                if (getCfg().sharedUniverse && !aborted) mentioned = findMentionedContact([...produced, voiceMsg ? voiceMsg.text : ''].join(' '), c.id);
            }
        }
    } catch (e) { failed = true; console.error('[pocket-phone] generate', e); }
    finally {
        ppGeneratingId = null;
        showGenControls(false);
        hideTyping();
        renderNotesRow();
        if (aborted) { islandCollapse(); if (ppViewing(c.id)) renderThread(); else renderContactList(); ppToast('หยุดแล้ว'); }
        else if (botCalls) { islandCollapse(); ppIncomingCall(c); }
        else if (failed) { islandCollapse(); ppToast('เชื่อมต่อไม่ได้ ลองกดปุ่มฟ้าอีกครั้ง'); if (ppViewing(c.id)) renderThread(); else renderContactList(); }
        else {
            if (ppViewing(c.id)) { renderThread(); islandCollapse(); }
            else { renderContactList(); if (produced.length) { pushNotif(c.id, 'msg', produced[0]); islandNotify(c, produced[0]); } else islandCollapse(); }
            if (mentioned) setTimeout(() => universeInterject(mentioned), 1600);
        }
    }
}

// ── ★ เจนแชทกลุ่ม ──
let ppGroupCooldownUntil = 0;
async function ppGroupGenerate() {
    const g = ppActiveGroup;
    if (!g || ppGeneratingId || ppCall) return;
    const input = document.getElementById('pp-input');
    if (input && input.value.trim()) ppSendUserMessage();
    const now = Date.now();
    if (now < ppGroupCooldownUntil) { ppToast(`รออีก ${Math.ceil((ppGroupCooldownUntil - now) / 1000)} วิ (คูลดาวน์กลุ่ม)`); return; }
    const members = groupMemberContacts(g);
    if (!members.length) { ppToast('กลุ่มนี้ไม่มีสมาชิก'); return; }

    ppGeneratingId = g.id;
    ppGenAbort = false;
    showGenControls(true);

    let anyProduced = false;
    try {
        const userName = getUserDisplayName();
        const rp = getCfg().universeAffectsRP ? mainChatRecap(10) : '';
        const period = periodPromptNote();
        const order = g.replyMode === 'one' ? [members[Math.floor(Math.random() * members.length)]] : members.slice();
        for (const c of order) {
            if (ppGenAbort) break;
            if (ppViewing(g.id)) { document.getElementById('pp-regen-row')?.remove(); showTyping(dname(c)); }
            islandTyping(c);
            const persona = getEffectivePersona(c.id);
            const th = getThread(g.id).slice(-HIST_LIMIT);
            const histTxt = th.map(m => {
                if (m.type === 'image') return `${m.from === 'me' ? userName : (m.senderName || '?')}: [รูป${m.caption ? ': ' + m.caption : ''}]`;
                if (m.type === 'voice') return `${m.from === 'me' ? userName : (m.senderName || '?')}: (เสียง) ${m.text}`;
                if (m.type === 'sharedpost') return `${m.from === 'me' ? userName : (m.senderName || '?')}: [แชร์โพสต์]`;
                return `${m.from === 'me' ? userName : (m.senderName || '?')}: ${m.text}`;
            }).join('\n');
            const others = members.filter(x => x.id !== c.id).map(x => dname(x));
            const prompt = [
                `[Group chat "${g.name}" — you are strictly ${dname(c)}. Members: ${members.map(dname).join(', ')} and ${userName}.]`,
                persona ? `You ARE this character. Stay fully in persona: ${persona}` : null,
                g.warnNote ? `Group rules/notes: ${g.warnNote}` : null,
                g.knowEachOther ? `You KNOW the other members (${others.join(', ')}) and may talk to them.` : `You mostly focus on ${userName}; do not deeply interact with other members.`,
                rp ? `Ongoing story context (stay consistent):\n${rp}` : null,
                period ? `Important — ${period}` : null,
                histTxt ? `\n<history>\n${histTxt}\n</history>` : null,
                `\nReply as ${dname(c)} with 1-2 short chat lines. Put EVERY line inside double quotes " ".`,
                `Same language (Thai). Output ONLY quoted chat lines. No planning, no narration, no asterisks. Anything outside " " is discarded.`,
            ].filter(Boolean).join('\n');
            let raw = await genWithRetry(prompt, 2);
            if (ppGenAbort) break;
            const lines = spokenOrFallback(raw, 2);
            hideTyping();
            for (const ln of lines) {
                if (ppGenAbort) break;
                await new Promise(r => setTimeout(r, 300 + Math.random() * 300));
                pushThreadMsg(g.id, { from: 'them', sender: c.id, senderName: dname(c), text: ln });
                anyProduced = true;
                if (ppViewing(g.id)) renderThread();
            }
        }
    } catch (e) { console.error('[pocket-phone] group gen', e); }
    finally {
        ppGeneratingId = null;
        showGenControls(false);
        hideTyping();
        if (g.cooldownSec) ppGroupCooldownUntil = Date.now() + g.cooldownSec * 1000;
        if (ppGenAbort) ppToast('หยุดแล้ว');
        if (ppViewing(g.id)) { renderThread(); islandCollapse(); }
        else {
            renderContactList(); islandCollapse();
            if (anyProduced) { const last = getThread(g.id).slice().reverse().find(m => m.from === 'them'); if (last) { pushNotif(g.id, 'group', `${last.senderName}: ${last.text}`); if (!document.getElementById('pp-dialog')?.open) islandNotify({ id: g.id, name: g.name, avatar: '' }, `${last.senderName}: ${last.text}`); } }
        }
    }
}

// pocket-phone/index.js — 0.9.7 — ท่อน 3/3 (renderPhoneSettings → call → interceptor → inject → boot → CSS)
// ต่อจากท่อน 2/3 ที่จบตรง ppGroupGenerate
// ⚠️ ต้องแปะครบทั้ง 3 ท่อน + เพิ่ม generate_interceptor ใน manifest

// ── phone Settings ──
function renderPhoneSettings() {
    const cfg = getCfg();
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.checked = val; };
    set('pp-set-dark', cfg.theme === 'dark');
    set('pp-set-fab', cfg.showFab !== false);
    set('pp-set-island', cfg.dynamicIsland);
    set('pp-set-scope2', cfg.islandScope === 'always');
    set('pp-set-botcall', cfg.botCallKeyword);
    set('pp-set-universe', cfg.sharedUniverse);
    set('pp-set-affectrp', cfg.universeAffectsRP);
    set('pp-set-avauto', cfg.userAvatarMode === 'auto');
    const ac = document.getElementById('pp-set-accent'); if (ac) ac.value = cfg.accent || '#0a84ff';
    const bl = document.getElementById('pp-set-blur'); if (bl) bl.value = cfg.homeBlur ?? 6;
    const cap = document.getElementById('pp-set-caption'); if (cap) cap.value = cfg.imageCaptionMode || 'ask';
    const upWrap = document.getElementById('pp-user-av-upload-wrap');
    if (upWrap) upWrap.style.display = cfg.userAvatarMode === 'custom' ? 'inline-flex' : 'none';
    const pm = document.getElementById('pp-set-userpersona-mode'); if (pm) pm.value = cfg.userPersonaMode || 'perchat';
    const sharedRow = document.getElementById('pp-set-shared-persona-row');
    if (sharedRow) sharedRow.style.display = (cfg.userPersonaMode === 'shared') ? 'flex' : 'none';
    const sharedSel = document.getElementById('pp-set-shared-persona');
    if (sharedSel) {
        const personas = listUserPersonas();
        sharedSel.innerHTML = `<option value="">ค่าเริ่มต้น (ST ปัจจุบัน)</option>` + personas.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
        sharedSel.value = cfg.sharedUserPersonaId || '';
    }
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
    const c = ppActiveContact; if (!c || ppCall || ppActiveGroup) return;
    ppCall = { c, incoming: false, connected: false, startTs: 0, timer: null, generating: false, transcript: [] };
    ppRenderCallScreen(c, 'กำลังโทร…', false);
    ppNav('call');
    setTimeout(() => { if (ppCall) ppConnectCall(); }, 1500 + Math.random() * 1200);
}
function ppIncomingCall(c) {
    if (!c || ppCall) return;
    ppCall = { c, incoming: true, connected: false, startTs: 0, timer: null, generating: false, transcript: [] };
    ppRenderCallScreen(c, 'สายเรียกเข้า', true);
    if (!document.getElementById('pp-dialog')?.open) { islandNotify(c, 'สายเรียกเข้า'); ppOpen(); }
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
    if (bg) { if (c.avatar) { bg.classList.remove('no-img'); bg.style.backgroundImage = `url(${c.avatar})`; } else { bg.classList.add('no-img'); bg.style.backgroundImage = ''; } }
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
        const userName = getUserDisplayName();
        const persona = getEffectivePersona(c.id);
        const up = getEffectiveUserPersona(c.id);
        const chatHist = getThread(c.id).slice(-HIST_LIMIT).map(m => {
            if (m.type === 'call') return `[${m.dir === 'out' ? 'โทรออก' : 'สายเข้า'}]`;
            if (m.type === 'image') return `${m.from === 'me' ? userName : dname(c)}: [ส่งรูป${m.caption ? ': ' + m.caption : ''}]`;
            if (m.type === 'voice') return `${m.from === 'me' ? userName : dname(c)}: (เสียง) ${m.text}`;
            if (m.type === 'sharedpost') return `${m.from === 'me' ? userName : dname(c)}: [แชร์โพสต์]`;
            const pre = m.replyTo ? `(ตอบ${m.replyTo.kind === 'story' ? 'สตอรี่' : m.replyTo.kind === 'msg' ? 'ข้อความ' : 'โน้ต'}: ${m.replyTo.text}) ` : '';
            return `${m.from === 'me' ? userName : dname(c)}: ${pre}${m.text}`;
        }).join('\n');
        const un = getUserNote();
        const rp = getCfg().universeAffectsRP ? mainChatRecap(6) : '';
        const period = periodPromptNote();
        const tr = (ppCall.transcript || []).slice(-10).map(m => `${m.from === 'me' ? userName : dname(c)}: ${m.text}`).join('\n');
        const prompt = [
            `[Phone call — you are strictly ${dname(c)}, on a voice call with ${userName}${opener ? ' that you just started' : ''}.]`,
            persona ? `You ARE this character. Stay fully in persona: ${persona}` : null,
            (up && (up.name || up.desc)) ? `Who you are talking to (${userName}): ${[up.name ? 'Name: ' + up.name : '', up.desc].filter(Boolean).join(' — ')}` : null,
            rp ? `Ongoing roleplay context (stay consistent):\n${rp}` : null,
            period ? `Important — ${period}` : null,
            chatHist ? `Your recent text chat with ${userName} (you remember this):\n${chatHist}` : null,
            un ? `${userName}'s current status note: "${un.text}" (glance only, do not force a reaction).` : null,
            tr ? `\nThis call so far:\n${tr}` : null,
            opener ? `\nYou called ${userName}. Open the call — say why you're calling, referencing what you two were just talking about if relevant.` : `\nContinue the call naturally.`,
            `\nSpeak as ${dname(c)} out loud. Break your speech into SHORT separate lines. Put EVERY spoken line inside double quotes " ".`,
            `Same language as ${userName} (Thai). Output ONLY quoted spoken lines. No planning, no narration, no stage directions, no asterisks. Anything outside " " is discarded.`,
            `If you want to end the call, say a natural goodbye (บาย / ไว้คุยกันใหม่ / แล้วเจอกัน) inside a quoted line.`,
        ].filter(Boolean).join('\n');
        let raw = await genWithRetry(prompt, 3);
        const lines = spokenOrFallback(raw, 5);
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
    } catch (e) { if (ty) ty.classList.remove('show'); ppCallEmit('สายไม่ชัด ลองใหม่นะ', 'them'); console.error('[pocket-phone] call gen', e); }
    finally { if (ppCall) ppCall.generating = false; }
}
function ppEndCall(declined) {
    if (!ppCall) return;
    const c = ppCall.c;
    const connected = ppCall.connected;
    const secs = connected ? Math.floor((Date.now() - ppCall.startTs) / 1000) : 0;
    if (ppCall.timer) clearInterval(ppCall.timer);
    const transcript = ppCall.transcript || [];
    const dir = ppCall.incoming ? 'in' : 'out';
    const missed = !connected;
    const cfg = getCfg();
    if (!cfg.callLog) cfg.callLog = [];
    cfg.callLog.push({
        cid: c.id, name: dname(c), avatar: c.avatar,
        startISO: new Date().toISOString(),
        durText: connected ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : (declined ? 'ปฏิเสธ' : 'ไม่รับสาย'),
        incoming: ppCall.incoming, transcript,
    });
    pushThreadMsg(c.id, {
        from: dir === 'out' ? 'me' : 'them', type: 'call', dir, missed,
        text: connected ? `คุยกัน ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : (declined ? 'ปฏิเสธสาย' : 'ไม่ได้รับสาย'),
    });
    const av = document.getElementById('pp-callend-av'); if (av) av.innerHTML = contactAvatarHTML(c, 108);
    const nm = document.getElementById('pp-callend-name'); if (nm) nm.textContent = dname(c);
    const sub = document.getElementById('pp-callend-sub'); if (sub) sub.textContent = connected ? 'สายสิ้นสุด' : (declined ? 'ปฏิเสธสาย' : 'ไม่ได้รับสาย');
    const dur = document.getElementById('pp-callend-dur'); if (dur) dur.textContent = connected ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '';
    const bg = document.getElementById('pp-callend-bg');
    if (bg) { if (c.avatar) { bg.classList.remove('no-img'); bg.style.backgroundImage = `url(${c.avatar})`; } else { bg.classList.add('no-img'); bg.style.backgroundImage = ''; } }
    ppCall = null;
    islandCollapse();
    ppNav('callend');
}

// ── call log ──
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
            <div class="pp-row-meta"><div class="pp-row-name">${l.incoming ? '↙ ' : '↗ '}${esc(l.name)}</div><div class="pp-row-preview">${esc(when)}</div></div>
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
    if (body) body.innerHTML = (l.transcript && l.transcript.length)
        ? l.transcript.map(m => `<div class="pp-brow ${m.from === 'me' ? 'out' : 'in'}"><div class="pp-bubble tail">${esc(m.text)}</div></div>`).join('')
        : `<div class="pp-sys">ไม่มีบทสนทนาในสายนี้</div>`;
    ppNav('transcript');
}

// ── ★ ตัวดักฟังแชทหลัก (ทาง A) ──
window.ppGenInterceptor = function (chat, contextSize, abort, type) {
    try {
        if (!getCfg().universeAffectsRP) return;
        if (!Array.isArray(chat)) return;
        const names = getContacts().map(dname).filter(Boolean).slice(0, 20).join(', ');
        const instr =
            `[Pocket Phone bridge — OUT OF NARRATION, do not describe these tags in prose. ` +
            `If a character would phone ${getUserDisplayName()}, append on its own line: [PP_CALL:CharacterName]. ` +
            `If a character would text ${getUserDisplayName()}, append: [PP_MSG:CharacterName|the message]. ` +
            `If a NEW character (not already a contact) starts contacting ${getUserDisplayName()} and matters to the story, append: [PP_NEWCHAT:CharacterName|the first message]. ` +
            `Known contacts: ${names || '(none yet)'}. Use these tags ONLY when it truly fits the scene; otherwise output nothing extra.]`;
        chat.push({ is_user: false, is_system: true, name: 'PocketPhone', mes: instr });
    } catch (e) { console.warn('[pocket-phone] interceptor', e); }
};

let ppLastHandledMainMsg = '';
function ppHandleMainChatMessage() {
    try {
        if (!getCfg().universeAffectsRP) return;
        const c = ctx();
        if (!c || !Array.isArray(c.chat) || !c.chat.length) return;
        const last = c.chat[c.chat.length - 1];
        if (!last || last.is_user) return;
        const mes = String(last.mes || '');
        const fp = mes.slice(0, 40) + '|' + mes.length;
        if (fp === ppLastHandledMainMsg) return;
        ppLastHandledMainMsg = fp;

        let m;
        const callRx = /\[PP_CALL:\s*([^\]]+)\]/gi;
        while ((m = callRx.exec(mes))) {
            const nm = m[1].trim();
            const c2 = getContacts().find(x => dname(x) === nm) || getContacts().find(x => nm.includes(dname(x)));
            if (c2 && !ppCall) { ppActiveContact = c2; ppActiveGroup = null; ppIncomingCall(c2); }
        }
        const msgRx = /\[PP_MSG:\s*([^\]|]+)\|([^\]]+)\]/gi;
        while ((m = msgRx.exec(mes))) {
            const nm = m[1].trim(), txt = stripEmoji(m[2].trim());
            const c2 = getContacts().find(x => dname(x) === nm) || getContacts().find(x => nm.includes(dname(x)));
            if (c2 && txt) {
                pushThreadMsg(c2.id, { from: 'them', text: txt });
                pushNotif(c2.id, 'msg', txt);
                if (ppViewing(c2.id)) renderThread(); else if (ppCurrentScreen === 'messages') renderContactList();
                islandNotify(c2, txt);
            }
        }
        const newRx = /\[PP_NEWCHAT:\s*([^\]|]+)\|([^\]]+)\]/gi;
        while ((m = newRx.exec(mes))) {
            const nm = m[1].trim(), txt = stripEmoji(m[2].trim());
            if (!nm) continue;
            let c2 = getContacts().find(x => dname(x) === nm);
            if (!c2) {
                const st = listStCharacters().find(x => x.name === nm);
                const cfg = getCfg();
                c2 = st ? { id: st.id, name: st.name, avatar: st.avatar } : { id: 'npc:' + newId(), name: nm, avatar: '', npc: true };
                cfg.contacts.push(c2);
                saveCfg();
            }
            if (txt) { pushThreadMsg(c2.id, { from: 'them', text: txt }); pushNotif(c2.id, 'msg', txt); islandNotify(c2, `${dname(c2)}: ${txt}`); }
            if (ppCurrentScreen === 'messages') renderContactList();
        }
    } catch (e) { console.warn('[pocket-phone] main-chat parse', e); }
}

// ── inject ──
function injectPhone() {
    if (document.getElementById('pp-dialog')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = buildPhone();
    document.body.appendChild(wrap.firstElementChild);
    const dlg = document.getElementById('pp-dialog');
    dlg?.addEventListener('cancel', e => { e.preventDefault(); ppClose(); });

    const SEL = [
        '[data-nav]', '[data-cid]', '[data-gid]', '[data-add]', '[data-del]', '[data-pin]', '[data-delchat]',
        '[data-chatbg]', '[data-wp]', '[data-usernote]', '[data-botnote]', '[data-showtr]', '[data-dellog]',
        '[data-msgidx]', '[data-storyauthor]', '[data-userpersona]', '[data-chattab]', '[data-warp]',
        '[data-feedtab]', '[data-postopen]', '[data-openpost]', '[data-postlike]', '[data-postmenu]', '[data-postshare]', '[data-delshared]',
        '[data-cmtlike]', '[data-cmtreply]', '[data-cmtdel]', '[data-cmtwarp]', '[data-calday]',
        '#pp-close-btn', '#pp-chat-menu-btn', '#pp-chat-call-btn', '#pp-calllog-btn',
        '#pp-rename-save', '#pp-persona-save', '#pp-bubble-clear',
        '#pp-list-edit-btn', '#pp-gen', '#pp-stop', '#pp-regen-btn', '#pp-img-btn', '#pp-loadmore-btn',
        '#pp-group-new-btn', '#pp-group-save-btn', '#pp-group-members-btn', '#pp-group-del-btn',
        '#pp-newpost-save', '#pp-newpost-img-clear', '#pp-newpost-cap-ai', '#pp-newpost-responders-btn',
        '#pp-call-gen', '#pp-call-end', '#pp-call-accept', '#pp-call-decline', '#pp-callend-ok',
        '#pp-calllog-back', '#pp-calllog-edit-btn',
        '#pp-open-profile', '#pp-profile-name-save', '#pp-profile-note-edit',
        '#pp-feed-gen-btn', '#pp-feed-search-btn', '#pp-feed-add', '#pp-post-gen-btn', '#pp-comment-send',
        '#pp-period-prev', '#pp-period-next', '#pp-period-help',
        '#pp-help-botcall', '#pp-help-universe', '#pp-help-affectrp', '#pp-help-caption',
        '#pp-help-userpersona', '#pp-help-personamode', '#pp-help-group', '#pp-help-responders',
        '#pp-island', '.pp-cc',
    ].join(',');

    document.getElementById('pp-frame')?.addEventListener('click', e => {
        // เสียง (อยู่ในฟอง) จับก่อน
        const voiceEl = e.target.closest('[data-voiceidx]');
        if (voiceEl) return ppPlayVoice(+voiceEl.dataset.voiceidx);

        const t = e.target.closest(SEL);
        if (!t) return;

        if (t.id === 'pp-close-btn') return ppClose();
        if (t.dataset && t.dataset.nav) return ppNav(t.dataset.nav);
        if (t.dataset && t.dataset.cid) return ppOpenThread(t.dataset.cid);
        if (t.dataset && t.dataset.gid) return ppOpenGroup(t.dataset.gid);
        if (t.dataset && t.dataset.add) return ppAddContact(t.dataset.add);
        if (t.dataset && t.dataset.del != null) return ppDeleteMsg(+t.dataset.del);
        if (t.dataset && t.dataset.pin) return ppTogglePin(t.dataset.pin);
        if (t.dataset && t.dataset.delchat) return ppDeleteChat(t.dataset.delchat);
        if (t.dataset && t.dataset.chatbg != null) { const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null); if (tid) { getChatStyle(tid).bg = t.dataset.chatbg; saveCfg(); applyChatStyle(); markChatSwatches(); } return; }
        if (t.dataset && t.dataset.wp) { if (t.dataset.wp === 'custom') document.getElementById('pp-set-wp-file')?.click(); else { getCfg().wallpaper = t.dataset.wp; saveCfg(); applyWallpaper(); renderPhoneSettings(); } return; }
        if (t.dataset && t.dataset.showtr != null) return showTranscript(+t.dataset.showtr);
        if (t.dataset && t.dataset.dellog != null) { const cfg = getCfg(); cfg.callLog.splice(+t.dataset.dellog, 1); saveCfg(); renderCallLog(); return; }
        if (t.dataset && t.dataset.chattab) { ppChatTab = t.dataset.chattab; renderContactList(); return; }
        if (t.dataset && t.dataset.warp) return ppWarpTo(t.dataset.warp);

        if (t.dataset && t.dataset.usernote != null) { const cur = getUserNote(); return ppPrompt('โน้ตของคุณ (24 ชม.)', cur ? cur.text : '', v => { setUserNote(v); renderNotesRow(); renderProfile(); ppToast(v ? 'ลงโน้ตแล้ว' : 'ลบโน้ตแล้ว'); }); }
        if (t.dataset && t.dataset.botnote) return ppOpenBotNote(t.dataset.botnote);
        if (t.dataset && t.dataset.userpersona != null && ppActiveContact) { getChatStyle(ppActiveContact.id).userPersonaId = t.dataset.userpersona; saveCfg(); renderUserPersonaList(); ppToast('ตั้ง persona แล้ว'); return; }
        if (t.dataset && t.dataset.storyauthor != null) return ppStoryAuthorTap(t.dataset.storyauthor);

        // ★ ปุ่มลบการ์ดโพสต์ที่แชร์ในแชท (จับก่อน data-openpost)
        if (t.dataset && t.dataset.delshared != null) { e.stopPropagation(); return ppMsgActions(+t.dataset.delshared); }

        // Feed
        if (t.dataset && t.dataset.feedtab) { ppFeedTab = t.dataset.feedtab; renderFeed(); return; }
        if (t.dataset && t.dataset.postopen) { ppActivePost = t.dataset.postopen; return ppNav('postview'); }
        if (t.dataset && t.dataset.openpost) { ppActivePost = t.dataset.openpost; return ppNav('postview'); }
        if (t.dataset && t.dataset.postlike) return toggleFeedLike(t.dataset.postlike);
        if (t.dataset && t.dataset.postmenu) return ppDeletePost(t.dataset.postmenu);
        if (t.dataset && t.dataset.postshare) return ppSharePostToChat(t.dataset.postshare);
        if (t.dataset && t.dataset.cmtlike) return toggleCommentLike(t.dataset.cmtlike);
        if (t.dataset && t.dataset.cmtreply) return ppReplyComment(t.dataset.cmtreply);
        if (t.dataset && t.dataset.cmtdel) return ppDeleteComment(t.dataset.cmtdel);
        if (t.dataset && t.dataset.cmtwarp) return ppCommentWarp(t.dataset.cmtwarp);
        if (t.id === 'pp-feed-gen-btn') return ppFeedGenerate();
        if (t.id === 'pp-feed-search-btn') return feedSearchTop5();
        if (t.id === 'pp-feed-add') { ppNewPostDraft = null; return ppNav('newpost'); }
        if (t.id === 'pp-post-gen-btn') return ppPostGenerate();
        if (t.id === 'pp-comment-send') return ppSendComment();
        if (t.id === 'pp-newpost-save') return ppNewPostSave();
        if (t.id === 'pp-newpost-img-clear') { if (ppNewPostDraft) { if (ppNewPostDraft.mediaKey) delMedia(ppNewPostDraft.mediaKey); ppNewPostDraft.mediaKey = null; ppNewPostDraft.dataUrl = null; renderNewPost(); } return; }
        if (t.id === 'pp-newpost-cap-ai') { if (ppNewPostDraft && ppNewPostDraft.dataUrl) { captionImageAIwithIsland(ppNewPostDraft.dataUrl).then(cap => { if (cap) { ppNewPostDraft.caption = cap; renderNewPost(); ppToast('ได้คำบรรยายแล้ว'); } else ppToast('AI บรรยายไม่ได้ พิมพ์เอง'); }); } return; }
        if (t.id === 'pp-newpost-responders-btn') { ppMultiSelect({ title: 'ใครตอบโพสต์นี้ได้', selected: (ppNewPostDraft && ppNewPostDraft.responders) || [], onDone: arr => { if (ppNewPostDraft) { ppNewPostDraft.responders = arr; renderNewPostResponderChips(); } } }); return; }

        // ปฏิทิน
        if (t.dataset && t.dataset.calday) { togglePeriodDay(t.dataset.calday); renderPeriod(); return; }
        if (t.id === 'pp-period-prev') return ppCalNav(-1);
        if (t.id === 'pp-period-next') return ppCalNav(1);
        if (t.id === 'pp-period-help') return ppHelpPopup('ประจำเดือน', 'แตะวันในปฏิทินเพื่อทำเครื่องหมายว่าเป็นวันที่ประจำเดือนมา<br><br>หนุ่ม ๆ ในแอปจะรับรู้และใส่ใจเป็นพิเศษในวันนั้น รวมถึงช่วงใกล้ถึงรอบ<br><br>เก็บในเครื่อง ไม่ส่งไปไหน');

        // แตะฟอง → แก้ไข/ลบ/ตอบ (หลัง data อื่นในฟอง)
        if (t.dataset && t.dataset.msgidx != null) return ppMsgActions(+t.dataset.msgidx);

        // กลุ่ม
        if (t.id === 'pp-group-new-btn') { ppGroupDraft = null; return ppNav('groupnew'); }
        if (t.id === 'pp-group-save-btn') return ppGroupSave();
        if (t.id === 'pp-group-members-btn') { if (!ppGroupDraft) ppGroupDraft = { id: null, name: '', members: [], knowEachOther: true, cooldownSec: 0, replyMode: 'many', warnNote: '' }; ppMultiSelect({ title: 'เลือกสมาชิกกลุ่ม', selected: ppGroupDraft.members, onDone: arr => { ppGroupDraft.members = arr; renderGroupMemberChips(); } }); return; }
        if (t.id === 'pp-group-del-btn') return ppDeleteGroup();

        if (t.id === 'pp-chat-call-btn') return ppStartCall();
        if (t.id === 'pp-chat-menu-btn') return ppNav(ppActiveGroup ? 'groupsettings' : 'chatsettings');
        if (t.id === 'pp-img-btn') return ppPickChatImage();
        if (t.id === 'pp-loadmore-btn') { ppHistShown += HIST_PAGE; renderThread(); return; }
        if (t.id === 'pp-list-edit-btn') { ppListEditMode = !ppListEditMode; renderContactList(); const b = document.getElementById('pp-list-edit-btn'); if (b) b.textContent = ppListEditMode ? 'เสร็จ' : 'แก้ไข'; return; }
        if (t.id === 'pp-rename-save' && ppActiveContact) { const v = (document.getElementById('pp-rename-input')?.value || '').trim(); const stored = getContacts().find(x => x.id === ppActiveContact.id); if (stored) { stored.customName = v || undefined; ppActiveContact.customName = v || undefined; saveCfg(); renderChatSettings(); renderContactList(); ppToast('เปลี่ยนชื่อแล้ว'); } return; }
        if (t.id === 'pp-persona-save' && ppActiveContact) { const st = getChatStyle(ppActiveContact.id); st.personaName = (document.getElementById('pp-persona-name')?.value || '').trim(); st.personaDesc = (document.getElementById('pp-persona-desc')?.value || '').trim(); saveCfg(); ppToast('บันทึก Persona แล้ว'); return; }
        if (t.id === 'pp-bubble-clear' && ppActiveContact) { getChatStyle(ppActiveContact.id).bubbleImg = false; saveCfg(); applyChatStyle(); ppToast('ล้างรูปฟองแล้ว'); return; }
        if (t.id === 'pp-calllog-btn' && ppActiveContact) { ppCallLogFilter = ppActiveContact.id; ppCallLogEdit = false; return ppNav('calllog'); }
        if (t.id === 'pp-calllog-back') { ppCallLogFilter = null; return ppNav(ppActiveContact ? 'chat' : 'messages'); }
        if (t.id === 'pp-calllog-edit-btn') { ppCallLogEdit = !ppCallLogEdit; renderCallLog(); const b = document.getElementById('pp-calllog-edit-btn'); if (b) b.textContent = ppCallLogEdit ? 'เสร็จ' : 'แก้ไข'; return; }
        if (t.id === 'pp-gen') return ppGenerateReply();
        if (t.id === 'pp-stop') return ppStopGen();
        if (t.id === 'pp-regen-btn') return ppRegenerate();
        if (t.id === 'pp-call-gen') return ppCallGenerate(false);
        if (t.id === 'pp-call-end') return ppEndCall();
        if (t.id === 'pp-call-accept') return ppAcceptCall();
        if (t.id === 'pp-call-decline') return ppDeclineCall();
        if (t.id === 'pp-callend-ok') return ppNav((ppActiveGroup || ppActiveContact) ? 'chat' : 'messages');
        if (t.id === 'pp-open-profile') return ppNav('profile');
        if (t.id === 'pp-profile-name-save') { getCfg().userAppName = (document.getElementById('pp-profile-name')?.value || '').trim(); saveCfg(); refreshUserAvatar(); renderProfile(); renderNotesRow(); ppToast('บันทึกชื่อแล้ว'); return; }
        if (t.id === 'pp-profile-note-edit') { const cur = getUserNote(); return ppPrompt('โน้ตของฉัน (24 ชม.)', cur ? cur.text : '', v => { setUserNote(v); renderProfile(); renderNotesRow(); ppToast(v ? 'ลงโน้ตแล้ว' : 'ลบโน้ตแล้ว'); }); }
        if (t.id === 'pp-island' && t.dataset.cid) { const c = getContacts().find(x => x.id === t.dataset.cid); if (c) { ppActiveContact = c; ppActiveGroup = null; ppNav('chat'); } return; }
        if (t.classList && t.classList.contains('pp-cc')) { t.classList.toggle('on'); return; }

        if (t.id === 'pp-help-botcall') return ppHelpPopup('บอทโทรหา', 'ถ้าบอทตอบแล้วมีคำแนวจะโทร (โทรหา/เดี๋ยวโทร/calling you) แอปจะเปลี่ยนเป็นสายเรียกเข้าให้อัตโนมัติ<br><br>ปิด = บอทไม่โทรเข้าเอง คุณยังกดโทรออกได้');
        if (t.id === 'pp-help-universe') return ppHelpPopup('บอท/NPC ทักข้ามแชท', 'ถ้าบอทที่คุยด้วยเอ่ยชื่อคอนแทกต์อีกคน คนนั้นจะทักเข้ามาเองตามมา<br><br>ต้นทุน +1 generation ตอนมีคนทัก');
        if (t.id === 'pp-help-affectrp') return ppHelpPopup('มีผลต่อโรลเพลย์หลัก', 'เมื่อเปิด ทุกอย่างในมือถือ (แชท/สาย/โน้ต/ฟีด) จะโยงกับบทหลัก และบทหลักจะโยงกลับมามือถือ<br><br>ถ้าบทหลักเอ่ยถึงการโทร/ทัก จะพ่นคีย์เด้งเข้ามือถือให้ · NPC ในบทหลักที่กระทบเนื้อเรื่องจะสร้างแชทเองอัตโนมัติ<br><br>ยกเว้นตัวละครหลักปัจจุบัน จะไม่ถูกลากมาเป็น NPC สุ่มในฟีด<br><br>ต้นทุน: +context ทุกการเจน · มีโอกาสยิงเจนต่อเนื่อง');
        if (t.id === 'pp-help-caption') return ppHelpPopup('คำบรรยายรูป', 'บอทมองรูปไม่เห็นตรง ๆ ต้องมีคำบรรยายเป็นข้อความ<br><br>ทุกครั้งที่ลงรูปจะให้เลือก: ให้ AI ของ ST บรรยาย หรือ พิมพ์เอง เสมอ');
        if (t.id === 'pp-help-userpersona') return ppHelpPopup('Persona ของฉันที่บอทอ่าน', 'เลือกว่าจะให้บอทรู้จักคุณในฐานะ persona ไหน (อ่านอย่างเดียว ไม่แตะ ST จริง)');
        if (t.id === 'pp-help-personamode') return ppHelpPopup('โหมด Persona', 'แยกแต่ละแชท = เลือก persona ให้บอทแต่ละคนต่างกัน<br>เหมือนกันทุกแชท = ใช้ persona เดียวทุกบอท');
        if (t.id === 'pp-help-group') return ppHelpPopup('การตอบโต้ในกลุ่ม', 'สมาชิกรู้จักกัน = แต่ละคนเห็นข้อความคนอื่นและคุยโต้กันได้<br><br>โหมดตอบ: หลายคน = ทุกสมาชิกตอบต่อการกดเจน 1 ครั้ง · ทีละคน = สุ่มคนเดียวตอบ<br><br>คูลดาวน์ = เวลาต่ำสุดระหว่างการกดเจน (กันรัว)');
        if (t.id === 'pp-help-responders') return ppHelpPopup('ใครตอบโพสต์นี้ได้', 'เลือกว่าจะให้ใครมาคอมเมนต์โพสต์นี้ได้บ้าง (เว้นว่าง = ทุกคน)<br><br>สวิตช์ "ผู้ตอบรู้จักกัน" = คอมเมนต์เห็นกันและตอบโต้กันได้ · ปิด = ต่างคนต่างคอมเมนต์');
    });

    // input
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
    const cmtInput = document.getElementById('pp-comment-input');
    if (cmtInput) {
        cmtInput.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(100, this.scrollHeight) + 'px'; });
        cmtInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ppSendComment(); } });
    }
    document.getElementById('pp-msg-search')?.addEventListener('input', e => renderContactList(e.target.value));
    const pd = document.getElementById('pp-persona-desc');
    if (pd) pd.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(160, this.scrollHeight) + 'px'; });
    const npt = document.getElementById('pp-newpost-text');
    if (npt) npt.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(160, this.scrollHeight) + 'px'; });

    // switches / selects
    const bind = (id, fn) => document.getElementById(id)?.addEventListener('change', fn);
    bind('pp-set-dark', e => { getCfg().theme = e.target.checked ? 'dark' : 'light'; saveCfg(); applyTheme(); });
    bind('pp-set-fab', e => { getCfg().showFab = e.target.checked; saveCfg(); applyFab(); });
    bind('pp-set-island', e => { getCfg().dynamicIsland = e.target.checked; saveCfg(); applyIsland(); });
    bind('pp-set-scope2', e => { getCfg().islandScope = e.target.checked ? 'always' : 'phone'; saveCfg(); });
    bind('pp-set-botcall', e => { getCfg().botCallKeyword = e.target.checked; saveCfg(); });
    bind('pp-set-universe', e => { getCfg().sharedUniverse = e.target.checked; saveCfg(); });
    bind('pp-set-affectrp', e => { getCfg().universeAffectsRP = e.target.checked; saveCfg(); });
    bind('pp-set-caption', e => { getCfg().imageCaptionMode = e.target.value; saveCfg(); });
    bind('pp-set-userpersona-mode', e => { getCfg().userPersonaMode = e.target.value; saveCfg(); renderPhoneSettings(); });
    bind('pp-set-shared-persona', e => { getCfg().sharedUserPersonaId = e.target.value; saveCfg(); });
    bind('pp-set-avauto', async e => { getCfg().userAvatarMode = e.target.checked ? 'auto' : 'custom'; saveCfg(); await refreshUserAvatar(); renderPhoneSettings(); renderNotesRow(); });
    bind('pp-npc-toggle', e => { if (ppActiveContact) { const c = getContacts().find(x => x.id === ppActiveContact.id); if (c) { c.npc = e.target.checked; ppActiveContact.npc = c.npc; saveCfg(); ppToast(c.npc ? 'ย้ายไปหมวด NPC' : 'ย้ายไปหมวดตัวละคร'); } } });
    document.getElementById('pp-set-accent')?.addEventListener('input', e => { getCfg().accent = e.target.value; saveCfg(); applyTheme(); });
    document.getElementById('pp-set-blur')?.addEventListener('input', e => { getCfg().homeBlur = +e.target.value; saveCfg(); applyWallpaper(); });
    document.getElementById('pp-bubble-color')?.addEventListener('input', e => { if (ppActiveContact) { getChatStyle(ppActiveContact.id).bubble = e.target.value; getChatStyle(ppActiveContact.id).bubbleImg = false; saveCfg(); applyChatStyle(); } });
    document.getElementById('pp-text-color')?.addEventListener('input', e => { if (ppActiveContact) { getChatStyle(ppActiveContact.id).textColor = e.target.value; saveCfg(); applyChatStyle(); } });

    // file inputs
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
    fileToMedia('pp-profile-av-file', () => 'user-avatar', async () => { getCfg().userAvatarMode = 'custom'; saveCfg(); await refreshUserAvatar(); renderProfile(); renderNotesRow(); ppToast('ตั้งรูปโปรไฟล์แล้ว'); });
    fileToMedia('pp-chatbg-file', () => 'chatbg-' + (ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : 'x')), async () => { const tid = ppActiveGroup ? ppActiveGroup.id : (ppActiveContact ? ppActiveContact.id : null); if (tid) { getChatStyle(tid).bg = 'custom'; saveCfg(); applyChatStyle(); markChatSwatches(); ppToast('ตั้งพื้นหลังแชทแล้ว'); } });
    fileToMedia('pp-bubbleimg-file', () => 'bubbleimg-' + (ppActiveContact ? ppActiveContact.id : 'x'), async () => { if (ppActiveContact) { getChatStyle(ppActiveContact.id).bubbleImg = true; saveCfg(); applyChatStyle(); ppToast('ตั้งรูปฟองแล้ว'); } });

    document.getElementById('pp-chat-img-file')?.addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) ppHandleChatImage(f); e.target.value = ''; });
    document.getElementById('pp-story-img-file')?.addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) ppAddImageStory(f); e.target.value = ''; });
    document.getElementById('pp-newpost-img-file')?.addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) ppNewPostPickImage(f); e.target.value = ''; });
}

// ── FAB + wand + external island + settings panel + boot ──
function injectFab() {
    if (document.getElementById('pp-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'pp-fab';
    fab.title = 'Pocket Phone';
    fab.innerHTML = ICON.messages;
    fab.style.cssText = 'position:fixed;right:14px;bottom:calc(84px + env(safe-area-inset-bottom));width:46px;height:46px;border-radius:50%;border:none;z-index:2147483000;background:linear-gradient(160deg,#0a84ff,#0060df);color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer;display:flex;align-items:center;justify-content:center;';
    fab.querySelector('svg')?.setAttribute('width', '22');
    fab.querySelector('svg')?.setAttribute('height', '22');
    fab.addEventListener('click', ppOpen);
    document.body.appendChild(fab);
    applyFab();
}
function injectWandButton() {
    if (document.getElementById('pp-wand-btn')) return false;
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return false;
    const item = document.createElement('div');
    item.id = 'pp-wand-btn';
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.tabIndex = 0;
    item.innerHTML = `<div style="width:20px;display:flex;justify-content:center">${ICON.messages}</div><span>Pocket Phone</span>`;
    item.querySelector('svg')?.setAttribute('width', '18');
    item.querySelector('svg')?.setAttribute('height', '18');
    item.addEventListener('click', () => ppOpen());
    menu.appendChild(item);
    return true;
}
function injectExternalIsland() {
    if (document.getElementById('pp-ext-island')) return;
    const el = document.createElement('div');
    el.id = 'pp-ext-island';
    el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);width:120px;height:34px;border-radius:20px;background:#000;display:none;z-index:2147482000;overflow:hidden;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.5);transition:width .5s cubic-bezier(.32,1.4,.4,1),height .5s cubic-bezier(.32,1.4,.4,1),border-radius .5s;';
    el.addEventListener('click', () => {
        const cid = el.dataset.cid;
        ppOpen();
        if (cid) { const c = getContacts().find(x => x.id === cid); if (c) { ppActiveContact = c; ppActiveGroup = null; ppNav('chat'); } }
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
    <div style="font-size:12px;opacity:.7;margin-bottom:8px">เปิดจากปุ่มลอยมุมขวาล่าง หรือเมนู wand (Extensions)</div>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><input type="checkbox" id="pp-ext-fab-toggle"> แสดงปุ่มลอยบนหน้าจอ</label>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><input type="checkbox" id="pp-ext-island-toggle"> แจ้งเตือน/Island นอกมือถือ</label>
    <input id="pp-ext-open" class="menu_button" type="button" value="เปิดมือถือ">
    <input id="pp-ext-diag" class="menu_button" type="button" value="Diagnostics">
  </div>
</div>`);
    const fabT = document.getElementById('pp-ext-fab-toggle');
    if (fabT) { fabT.checked = getCfg().showFab !== false; fabT.addEventListener('change', e => { getCfg().showFab = e.target.checked; saveCfg(); applyFab(); }); }
    const isl = document.getElementById('pp-ext-island-toggle');
    if (isl) { isl.checked = getCfg().islandScope === 'always'; isl.addEventListener('change', e => { getCfg().islandScope = e.target.checked ? 'always' : 'phone'; saveCfg(); }); }
    document.getElementById('pp-ext-open')?.addEventListener('click', ppOpen);
    document.getElementById('pp-ext-diag')?.addEventListener('click', () => window.PP_DIAG && window.PP_DIAG());
}

window.PP_OPEN = ppOpen;
window.PP_DIAG = function () {
    const rows = {
        version: PP_VERSION, loaded: window.PP_LOADED, contextOk: !!ctx(),
        genQuiet: !!(ctx() && typeof ctx().generateQuietPrompt === 'function'),
        stopGen: !!(ctx() && typeof ctx().stopGeneration === 'function'),
        multimodal: !!(ctx() && typeof ctx().getMultimodalCaption === 'function'),
        interceptorSet: typeof window.ppGenInterceptor === 'function',
        chatLen: (ctx() && Array.isArray(ctx().chat)) ? ctx().chat.length : 0,
        contacts: getContacts().length, groups: getGroups().length,
        userPersonas: listUserPersonas().length, userPersonaMode: getCfg().userPersonaMode,
        stories: liveStories().length, feedPosts: getFeedPosts().length,
        periodDays: getPeriodDays().length, showFab: getCfg().showFab, affectRP: getCfg().universeAffectsRP,
        wandBtn: !!document.getElementById('pp-wand-btn'),
    };
    console.table(rows);
    ppToast('Diag → console');
    return rows;
};

function injectCSS() {
    if (document.getElementById('pp-css')) return;
    const s = document.createElement('style');
    s.id = 'pp-css';
    // ไม่มี .pp-call-stage / .pp-call-line ที่นี่ — style.css เป็นเจ้าของ
    s.textContent = `
.pp-list-head{padding:12px 16px 4px;font-size:13px;font-weight:700;color:var(--pp-txt3);text-transform:uppercase;letter-spacing:.5px;}
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

.pp-chat-tabs{display:flex;flex-shrink:0;border-bottom:.5px solid var(--pp-sep);}
.pp-chat-tab{flex:1;background:none;border:none;color:var(--pp-txt3);font-size:14px;font-weight:600;padding:10px 0;cursor:pointer;border-bottom:2px solid transparent;}
.pp-chat-tab.on{color:var(--pp-txt);border-bottom-color:var(--pp-accent);}

.pp-grp-av{position:relative;display:inline-block;flex-shrink:0;}
.pp-grp-av-piece{position:absolute;border-radius:50%;overflow:hidden;box-shadow:0 0 0 2px var(--pp-bg2,#1c1c1e);}
.pp-grp-av-piece.pos0{top:0;left:0;}
.pp-grp-av-piece.pos1{bottom:0;right:0;}
.pp-chip{display:inline-flex;align-items:center;gap:6px;background:var(--pp-bg3);border-radius:16px;padding:4px 10px 4px 4px;font-size:13px;color:var(--pp-txt);margin:4px 4px 0 0;}
.pp-group-member-chips{display:flex;flex-wrap:wrap;margin-top:4px;}

.pp-brow-col{display:flex;flex-direction:column;min-width:0;}
.pp-brow.grpmode{align-items:flex-end;gap:6px;}
.pp-grp-msg-av{width:28px;flex-shrink:0;align-self:flex-end;}
.pp-grp-msg-av.empty{visibility:hidden;}
.pp-grp-sender{font-size:11px;color:var(--pp-txt3);font-weight:600;margin:0 0 2px 4px;}

#pp-scr-call .pp-call-bg,#pp-scr-callend .pp-call-bg{position:absolute!important;inset:0!important;z-index:0!important;background-color:#0a0a12;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;filter:blur(30px) brightness(.5) saturate(1.15);transform:scale(1.3);pointer-events:none;}
#pp-scr-call .pp-call-bg.no-img,#pp-scr-callend .pp-call-bg.no-img{filter:none;transform:none;background:radial-gradient(120% 90% at 50% 0%,#2a2a33,#08080b 70%)!important;}
#pp-scr-call .pp-call-bg::after,#pp-scr-callend .pp-call-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,18,.30) 0%,rgba(10,10,18,.55) 55%,rgba(10,10,18,.82) 100%);}

.pp-img-btn{flex-shrink:0;width:36px;height:36px;border-radius:50%;border:none;background:var(--pp-bg3);color:var(--pp-txt);cursor:pointer;display:flex;align-items:center;justify-content:center;}
.pp-img-btn:active{transform:scale(.88);}
.pp-stop{background:#ff453a!important;}
.pp-stop svg{width:16px;height:16px;}

.pp-reply-head{border-left:3px solid rgba(255,255,255,.5);padding:2px 0 4px 8px;margin:-2px 0 5px;opacity:.9;cursor:pointer;}
.pp-brow.in .pp-reply-head{border-left-color:var(--pp-accent);}
.pp-reply-head-label{font-size:10px;font-weight:700;opacity:.75;margin-bottom:1px;}
.pp-reply-head-txt{font-size:12px;line-height:1.35;opacity:.8;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.pp-warp-hl{animation:pp-warp 1.6s ease;}
@keyframes pp-warp{0%,100%{background:transparent}30%{background:rgba(10,132,255,.18);border-radius:12px}}

.pp-bubble-img{padding:4px!important;overflow:hidden;}
.pp-img-msg{border-radius:14px;overflow:hidden;background:rgba(0,0,0,.2);min-width:120px;min-height:80px;display:flex;}
.pp-img-thumb{max-width:220px;width:100%;height:auto;display:block;border-radius:14px;object-fit:cover;}
.pp-img-cap{font-size:14px;line-height:1.35;padding:6px 8px 2px;}

.pp-bubble-voice{padding:8px 12px!important;}
.pp-voice{display:flex;align-items:center;gap:8px;cursor:pointer;min-width:130px;}
.pp-voice-play{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.pp-brow.in .pp-voice-play{background:var(--pp-accent);color:#fff;}
.pp-voice-wave{display:flex;align-items:center;gap:2px;flex:1;height:22px;}
.pp-voice-wave i{width:3px;border-radius:2px;background:currentColor;opacity:.55;}
.pp-voice-wave i:nth-child(1){height:8px}.pp-voice-wave i:nth-child(2){height:16px}.pp-voice-wave i:nth-child(3){height:11px}.pp-voice-wave i:nth-child(4){height:20px}.pp-voice-wave i:nth-child(5){height:9px}.pp-voice-wave i:nth-child(6){height:15px}.pp-voice-wave i:nth-child(7){height:7px}.pp-voice-wave i:nth-child(8){height:13px}
.pp-voice-dur{font-size:12px;opacity:.8;flex-shrink:0;font-variant-numeric:tabular-nums;}
#pp-voice-ov{position:absolute;inset:0;z-index:400;background:rgba(0,0,0,.55);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;padding:40px 32px;opacity:0;transition:opacity .3s;}
#pp-voice-ov.show{opacity:1;}
.pp-voice-ov-inner{font-size:24px;line-height:1.5;color:#fff;text-align:center;text-shadow:0 2px 16px rgba(0,0,0,.7);}
.pp-voice-ov-inner span{opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s;display:inline-block;}
.pp-voice-ov-inner span.show{opacity:1;transform:none;}
.pp-voice-ov-close{position:absolute;top:16px;right:16px;width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.18);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;}

.pp-callmsg{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:18px;max-width:100%;cursor:pointer;}
.pp-callmsg.out{background:var(--pp-mybub,var(--pp-accent));color:var(--pp-mytext,#fff);border-bottom-right-radius:6px;}
.pp-callmsg.in{background:var(--pp-bub-in);color:var(--pp-txt);border-bottom-left-radius:6px;}
.pp-callmsg-ic{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.pp-callmsg.in .pp-callmsg-ic{background:rgba(48,209,88,.25);color:#30d158;}
.pp-callmsg.missed .pp-callmsg-ic{background:rgba(255,69,58,.25);color:#ff453a;}
.pp-callmsg-body{display:flex;flex-direction:column;min-width:0;}
.pp-callmsg-title{font-size:14px;font-weight:600;}
.pp-callmsg.missed .pp-callmsg-title{color:#ff453a;}
.pp-callmsg-sub{font-size:12px;opacity:.7;}

.pp-bubble-shared{padding:0!important;background:transparent!important;overflow:visible;position:relative;}
.pp-shared-card{background:var(--pp-bg3);border:1px solid var(--pp-sep);border-radius:14px;overflow:hidden;max-width:250px;cursor:pointer;}
.pp-shared-top{display:flex;align-items:center;gap:8px;padding:8px 10px 4px;}
.pp-shared-av{width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0;}
.pp-shared-name{font-size:12px;font-weight:700;color:var(--pp-txt);}
.pp-shared-tag{margin-left:auto;font-size:10px;color:var(--pp-txt3);}
.pp-shared-text{font-size:13px;line-height:1.4;padding:2px 10px 8px;color:var(--pp-txt);}
.pp-shared-img{width:100%;height:130px;background:#000 center/cover no-repeat;background-color:var(--pp-sep);}
.pp-shared-gone{padding:14px;font-size:13px;color:var(--pp-txt3);text-align:center;}
.pp-shared-del{position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;border:none;background:#ff453a;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;box-shadow:0 2px 8px rgba(0,0,0,.4);}
.pp-shared-del svg{width:13px;height:13px;}

.pp-user-persona-list{display:flex;flex-direction:column;gap:6px;}
.pp-persona-opt{display:flex;align-items:center;gap:10px;width:100%;background:var(--pp-bg3);border:1.5px solid transparent;border-radius:14px;padding:10px 14px;color:var(--pp-txt);font-size:14px;cursor:pointer;text-align:left;}
.pp-persona-opt.on{border-color:var(--pp-accent);}
.pp-persona-opt svg{margin-left:auto;color:var(--pp-accent);flex-shrink:0;}
.pp-persona-opt-av{width:30px;height:30px;border-radius:50%;object-fit:cover;background:var(--pp-bg3);flex-shrink:0;}
.pp-persona-opt-lb{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

.pp-loadmore{display:flex;justify-content:center;padding:6px 0 10px;}

.pp-feed-tabs{display:flex;flex-shrink:0;border-bottom:.5px solid var(--pp-sep);}
.pp-feed-tab{flex:1;background:none;border:none;color:var(--pp-txt3);font-size:15px;font-weight:600;padding:12px 0;cursor:pointer;border-bottom:2px solid transparent;}
.pp-feed-tab.on{color:var(--pp-txt);border-bottom-color:var(--pp-accent);}
.pp-feed-scroll{flex:1;overflow-y:auto;overscroll-behavior:contain;}
.pp-story-tray{display:flex;gap:10px;padding:12px 14px;overflow-x:auto;scrollbar-width:none;border-bottom:.5px solid var(--pp-sep);}
.pp-story-tray::-webkit-scrollbar{display:none;}
.pp-story-cell{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;width:74px;}
.pp-story-ring{position:relative;width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.pp-story-ring.unseen{background:linear-gradient(135deg,#ff375f,#ff9f0a,#bf5af2);}
.pp-story-ring.seen{background:var(--pp-sep);}
.pp-story-ring.add{background:var(--pp-bg3);}
.pp-story-ring .pp-avatar{border:2.5px solid var(--pp-bg2,#1c1c1e);box-sizing:border-box;}
.pp-story-plus{position:absolute;bottom:-2px;right:-2px;width:22px;height:22px;border-radius:50%;background:var(--pp-accent);color:#fff;border:2px solid var(--pp-bg2,#1c1c1e);display:flex;align-items:center;justify-content:center;}
.pp-story-plus svg{width:14px;height:14px;}
.pp-story-cell-name{font-size:11px;color:var(--pp-txt3);max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;}
.pp-feed-list{padding:8px 0 80px;}
.pp-post{padding:12px 16px;border-bottom:.5px solid var(--pp-sep);}
.pp-post-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.pp-post-av{width:38px;height:38px;border-radius:50%;object-fit:cover;background:var(--pp-bg3);flex-shrink:0;}
.pp-post-who{flex:1;min-width:0;display:flex;flex-direction:column;}
.pp-post-name{font-size:14px;font-weight:700;color:var(--pp-txt);}
.pp-post-age{font-size:11px;color:var(--pp-txt3);}
.pp-post-more{background:none;border:none;color:var(--pp-txt3);cursor:pointer;padding:4px;}
.pp-post-text{font-size:15px;line-height:1.5;color:var(--pp-txt);white-space:pre-wrap;word-break:break-word;cursor:pointer;margin-bottom:8px;}
.pp-post-img{width:100%;aspect-ratio:1/1;border-radius:14px;background:#000 center/cover no-repeat;background-color:var(--pp-bg3);margin-bottom:8px;}
.pp-post-actions{display:flex;gap:20px;align-items:center;}
.pp-post-like,.pp-post-cmt,.pp-post-share{display:flex;align-items:center;gap:6px;background:none;border:none;color:var(--pp-txt3);font-size:14px;cursor:pointer;}
.pp-post-like.on{color:#ff375f;}
.pp-post-share{margin-left:auto;}
.pp-post-full{border-bottom:6px solid var(--pp-sep);}
.pp-post-body{flex:1;overflow-y:auto;overscroll-behavior:contain;}
.pp-cmt-head{font-size:13px;font-weight:700;color:var(--pp-txt3);padding:12px 16px 4px;}
.pp-cmt{display:flex;gap:10px;padding:8px 16px;}
.pp-cmt.child{padding-left:44px;}
.pp-cmt-av{width:30px;height:30px;border-radius:50%;object-fit:cover;background:var(--pp-bg3);flex-shrink:0;}
.pp-cmt-body{flex:1;min-width:0;}
.pp-cmt-bubble{background:var(--pp-bg3);border-radius:14px;padding:8px 12px;}
.pp-cmt-name{font-size:13px;font-weight:700;color:var(--pp-txt);display:block;}
.pp-cmt-to{font-size:11px;color:var(--pp-accent);cursor:pointer;margin-right:4px;}
.pp-cmt-txt{font-size:14px;line-height:1.4;color:var(--pp-txt);word-break:break-word;}
.pp-cmt-meta{display:flex;align-items:center;gap:14px;padding:4px 12px 0;font-size:12px;color:var(--pp-txt3);}
.pp-cmt-reply,.pp-cmt-del{background:none;border:none;color:var(--pp-txt3);font-size:12px;font-weight:600;cursor:pointer;padding:0;}
.pp-cmt-del svg{width:13px;height:13px;}
.pp-cmt-like{display:flex;align-items:center;gap:4px;background:none;border:none;color:var(--pp-txt3);font-size:12px;cursor:pointer;padding:0;}
.pp-cmt-like svg{width:13px;height:13px;}
.pp-cmt-like.on{color:#ff375f;}
.pp-fab-inpage{position:absolute;right:16px;bottom:74px;width:52px;height:52px;border-radius:50%;border:none;background:var(--pp-accent);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.4);z-index:50;}
.pp-fab-inpage:active{transform:scale(.9);}
.pp-newpost-img-wrap{margin-bottom:8px;}

.pp-period-body{flex:1;overflow-y:auto;padding:16px;}
.pp-period-status{margin-bottom:14px;}
.pp-period-badge{background:var(--pp-bg3);border-radius:14px;padding:12px 16px;font-size:15px;color:var(--pp-txt);text-align:center;}
.pp-period-badge.on{background:linear-gradient(160deg,#ff5e8a,#ff375f);color:#fff;font-weight:600;}
.pp-period-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.pp-period-cal-head span{font-size:16px;font-weight:700;color:var(--pp-txt);}
.pp-period-nav{width:34px;height:34px;border-radius:50%;border:none;background:var(--pp-bg3);color:var(--pp-txt);cursor:pointer;display:flex;align-items:center;justify-content:center;}
.pp-cal-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;}
.pp-cal-dow span{text-align:center;font-size:12px;color:var(--pp-txt3);padding:4px 0;}
.pp-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
.pp-cal-cell{aspect-ratio:1/1;border:none;border-radius:50%;background:transparent;color:var(--pp-txt);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.pp-cal-cell.empty{visibility:hidden;pointer-events:none;}
.pp-cal-cell.today{box-shadow:inset 0 0 0 1.5px var(--pp-accent);}
.pp-cal-cell.on{background:linear-gradient(160deg,#ff5e8a,#ff375f);color:#fff;font-weight:600;}
.pp-period-hint{font-size:12px;color:var(--pp-txt3);line-height:1.5;margin-top:16px;text-align:center;}

#pp-story-viewer{position:absolute;inset:0;z-index:800;background:#000;overflow:hidden;}
.pp-sv-bars{position:absolute;top:8px;left:8px;right:8px;display:flex;gap:4px;z-index:3;}
.pp-sv-bar{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden;}
.pp-sv-bar i{display:block;height:100%;width:0;background:#fff;border-radius:2px;}
.pp-sv-bar i.done{width:100%;}
@keyframes pp-sv-fill{from{width:0}to{width:100%}}
.pp-sv-top{position:absolute;top:20px;left:12px;right:12px;display:flex;align-items:center;justify-content:space-between;z-index:3;}
.pp-sv-who{display:flex;align-items:center;gap:8px;}
.pp-sv-av{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#333;}
.pp-sv-name{font-size:14px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.6);}
.pp-sv-age{font-size:12px;color:rgba(255,255,255,.7);}
.pp-sv-close{background:none;border:none;color:#fff;cursor:pointer;padding:6px;display:flex;}
.pp-sv-body{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
.pp-sv-img{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat;}
.pp-sv-cap{position:absolute;bottom:96px;left:20px;right:20px;z-index:2;font-size:16px;line-height:1.5;color:#fff;text-align:center;text-shadow:0 2px 12px rgba(0,0,0,.8);}
.pp-sv-text{width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:40px 28px;box-sizing:border-box;font-size:26px;font-weight:600;line-height:1.5;color:#fff;text-align:center;text-shadow:0 2px 14px rgba(0,0,0,.35);}
.pp-sv-tap{position:absolute;top:64px;bottom:88px;width:32%;background:none;border:none;cursor:pointer;z-index:2;}
.pp-sv-tap.prev{left:0;}
.pp-sv-tap.next{right:0;}
.pp-sv-footer{position:absolute;bottom:0;left:0;right:0;padding:14px 16px calc(14px + env(safe-area-inset-bottom));display:flex;gap:10px;z-index:3;background:linear-gradient(0deg,rgba(0,0,0,.5),transparent);}
.pp-sv-viewbtn{flex:1;background:rgba(255,255,255,.16);border:none;color:#fff;border-radius:18px;padding:11px;font-size:14px;cursor:pointer;backdrop-filter:blur(10px);}
.pp-sv-del{background:rgba(255,69,58,.85);border:none;color:#fff;border-radius:18px;padding:11px 16px;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:5px;}
.pp-sv-del svg{width:15px;height:15px;}
.pp-sv-reply-bar{position:absolute;bottom:0;left:0;right:0;padding:14px 16px calc(14px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:10px;z-index:3;background:linear-gradient(0deg,rgba(0,0,0,.5),transparent);}
.pp-sv-reply-input{flex:1;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:10px 16px;color:#fff;font-size:15px;backdrop-filter:blur(10px);}
.pp-sv-reply-input:focus{outline:none;border-color:#fff;}
.pp-sv-reply-input::placeholder{color:rgba(255,255,255,.6);}
.pp-sv-like{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.16);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;backdrop-filter:blur(10px);}
.pp-sv-like.on{color:#ff375f;}

@media (prefers-reduced-motion: reduce){
  .pp-sv-bar i{transition:none!important;animation:none!important;width:100%!important;}
  #pp-voice-ov,.pp-voice-ov-inner span,.pp-warp-hl{transition:none!important;animation:none!important;}
}
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
                try {
                    const c = ctx();
                    if (c && c.eventSource && c.event_types) {
                        c.eventSource.on(c.event_types.MESSAGE_RECEIVED, () => setTimeout(ppHandleMainChatMessage, 200));
                        if (c.event_types.CHARACTER_MESSAGE_RENDERED) c.eventSource.on(c.event_types.CHARACTER_MESSAGE_RENDERED, () => setTimeout(ppHandleMainChatMessage, 200));
                    }
                } catch (e) { console.warn('[pocket-phone] event hook', e); }
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
    const wandTimer = setInterval(() => { if (injectWandButton()) clearInterval(wandTimer); }, 700);
    setTimeout(() => clearInterval(wandTimer), 45000);
    try {
        const mo = new MutationObserver(() => { if (!document.getElementById('pp-wand-btn')) injectWandButton(); });
        mo.observe(document.body, { childList: true, subtree: true });
    } catch {}
})();
