// pocket-phone/core.js — 0.9.4 refactor: แกนกลางที่ทุกไฟล์พึ่ง
// ES module · export ฟังก์ชัน/ค่าที่ข้ามไฟล์ · shared mutable state รวมใน S
// ไม่เปลี่ยน MODULE_NAME / storage key / โครงข้อมูล จาก 0.9.3

export const PP_VERSION = '0.9.4';
export const MODULE_NAME = 'pocket-phone'; // ⚠️ คงเดิม กันข้อมูล 0.9.3 หาย
export const LS_MIRROR = 'pp_cfg_mirror';   // คงเดิม

export function ctx() {
    try { return SillyTavern.getContext(); } catch { return null; }
}

// ── shared mutable state (ES module assign ข้ามไฟล์ผ่าน property ได้) ──
export const S = {
    activeContact: null,
    generatingId: null,
    currentScreen: 'home',
    editMode: false,
    listEditMode: false,
    callLogEdit: false,
    callLogFilter: null,
    call: null,
    islandState: null,
    islandTimer: null,
    clockTimer: null,
    userAvatarCache: null,
    _render: {},
};

// ── media store ──
export function mediaStore() {
    try {
        if (window.SillyTavern && SillyTavern.libs && SillyTavern.libs.localforage) {
            return SillyTavern.libs.localforage.createInstance({ name: 'pocket-phone', storeName: 'media' });
        }
    } catch {}
    return null;
}
export async function saveMedia(key, dataUrl) {
    const store = mediaStore();
    if (store) { try { await store.setItem(key, dataUrl); return true; } catch {} }
    try { localStorage.setItem('ppmedia_' + key, dataUrl); return true; } catch {}
    return false;
}
export async function loadMedia(key) {
    const store = mediaStore();
    if (store) { try { const v = await store.getItem(key); if (v) return v; } catch {} }
    try { return localStorage.getItem('ppmedia_' + key); } catch {}
    return null;
}

// ── wallpapers / chat bg ──
export const WALLPAPERS = {
    aurora: 'radial-gradient(38% 26% at 22% 15%, rgba(94,92,230,.55), transparent 72%), radial-gradient(40% 26% at 84% 22%, rgba(255,159,10,.4), transparent 72%), radial-gradient(46% 32% at 50% 92%, rgba(52,199,89,.34), transparent 72%), radial-gradient(40% 28% at 88% 82%, rgba(191,90,242,.34), transparent 72%), linear-gradient(160deg,#0a0a12,#050506)',
    ocean: 'radial-gradient(50% 40% at 30% 18%, rgba(10,132,255,.5), transparent 70%), radial-gradient(52% 42% at 82% 82%, rgba(48,209,88,.3), transparent 72%), linear-gradient(160deg,#04121f,#010409)',
    sunset: 'radial-gradient(60% 45% at 50% 14%, rgba(255,159,10,.5), transparent 72%), radial-gradient(55% 40% at 18% 90%, rgba(255,55,95,.42), transparent 72%), radial-gradient(50% 40% at 92% 70%, rgba(191,90,242,.35), transparent 72%), linear-gradient(160deg,#1a0a12,#0a0406)',
    forest: 'radial-gradient(55% 45% at 25% 20%, rgba(52,199,89,.45), transparent 72%), radial-gradient(50% 40% at 85% 82%, rgba(10,132,255,.28), transparent 72%), linear-gradient(160deg,#08120a,#040604)',
    mono: 'radial-gradient(70% 55% at 50% 0%, #1e1e26, #050506 72%)',
};
export const CHAT_BGS = {
    '': '',
    dusk: 'linear-gradient(180deg,#1a1030,#0a0616)',
    mint: 'linear-gradient(180deg,#0a1f18,#04100c)',
    rose: 'linear-gradient(180deg,#2a0f18,#12060a)',
    steel: 'linear-gradient(180deg,#12161c,#06080b)',
};

// ── storage (โครง DEFAULTS คงเดิมจาก 0.9.3) ──
export const DEFAULTS = {
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

export function getCfg() {
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
export function saveCfg() {
    const c = ctx(), cfg = getCfg();
    try { localStorage.setItem(LS_MIRROR, JSON.stringify(cfg)); } catch {}
    try { if (c && typeof c.saveSettingsDebounced === 'function') c.saveSettingsDebounced(); } catch {}
}

// ── helpers ──
export const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');

export function cleanReply(t) {
    let s = String(t || '');
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
    s = s.replace(/<think>[\s\S]*/gi, '');
    s = s.replace(/\[(?:CoT|COT|THINK|SYSTEM|CONTEXT|PERSONA|PHASE|STEP)[^\]]*\][^\n]*/gi, '');
    return s.trim();
}
export function stripEmoji(t) {
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
export function isFarewell(t) {
    const s = String(t || '').toLowerCase();
    if (/\b(bye+|goodbye|talk (to you )?later|see (you|ya)|see u|gtg|got to go|gotta go|hang up|catch you later|call you (back|later)|take care)\b/.test(s)) return true;
    return /(บายนะ|บายๆ|บาย|วางก่อน|วางละ|วางสายก่อน|วางสายละ|ไปก่อนนะ|ไปก่อน|ไปละ|ต้องไปแล้ว|ต้องวางแล้ว|แล้วเจอกัน|แล้วเจอกันนะ|แล้วค่อยคุย|ไว้คุยกัน|ไว้คุยกันใหม่|ไว้คุยใหม่|แค่นี้ก่อน|แค่นี้ก่อนนะ|เดี๋ยวโทรใหม่|เดี๋ยวโทรกลับ|ราตรีสวัสดิ์|ฝันดี|โชคดีนะ|ดูแลตัวเองด้วย)/.test(t || '');
}
export function wantsToCall(t) {
    const s = String(t || '');
    if (/(โทรหา|โทรไป|โทรกลับ|ขอโทร|กำลังโทร|เดี๋ยวโทร|รับสายหน่อย|โทรได้ไหม|โทรเลย)/.test(s)) return true;
    if (/\b(calling you|i'?ll call|gonna call|pick up|answer the phone)\b/i.test(s)) return true;
    return false;
}
export function getUserName() {
    const c = ctx();
    try { if (c && c.name1) return c.name1; } catch {}
    return 'User';
}
export function dname(c) { return (c && (c.customName || c.name)) || '?'; }

// ── หมวด ──
export function currentCharacterId() {
    const c = ctx();
    try {
        if (c && c.characterId != null && Array.isArray(c.characters)) {
            const ch = c.characters[c.characterId];
            if (ch) return ch.avatar || ch.name;
        }
    } catch {}
    return null;
}
export function noteCategory(cid) {
    if (isPinned(cid)) return 'pin';
    if (cid === currentCharacterId()) return 'main';
    return 'npc';
}
export function contactCategory(c) {
    if (isPinned(c.id)) return 'pin';
    if (c.npc) return 'npc';
    return 'char';
}

// ── ดึงบทโรลเพลย์หลัก ──
export function mainChatRecap(maxLines) {
    const c = ctx();
    try {
        if (c && Array.isArray(c.chat) && c.chat.length) {
            const lines = c.chat.slice(-(maxLines || 8)).map(m => {
                const who = m.is_user ? getUserName() : (m.name || 'Char');
                const txt = String(m.mes || '').replace(/<[^>]+>/g, '').replace(/\n+/g, ' ').trim();
                return txt ? `${who}: ${txt.slice(0, 220)}` : '';
            }).filter(Boolean);
            return lines.join('\n');
        }
    } catch {}
    return '';
}

// ── user avatar ──
export function userAvatarAuto() {
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
export async function refreshUserAvatar() {
    const cfg = getCfg();
    if (cfg.userAvatarMode === 'custom') {
        const img = await loadMedia('user-avatar');
        S.userAvatarCache = img || userAvatarAuto();
    } else {
        S.userAvatarCache = userAvatarAuto();
    }
    return S.userAvatarCache;
}
export function userAvatarHTML(size) {
    const s = size || 52;
    const src = S.userAvatarCache;
    const un = getUserName();
    if (src) {
        return `<img class="pp-avatar" style="width:${s}px;height:${s}px" src="${esc(src)}"
            onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=\\'pp-avatar pp-avatar-fb\\' style=\\'width:${s}px;height:${s}px\\'>${esc(un[0] || 'U')}</span>'))">`;
    }
    return `<span class="pp-avatar pp-avatar-fb" style="width:${s}px;height:${s}px">${esc(un[0] || 'U')}</span>`;
}
export function contactAvatarHTML(c, size) {
    const s = size || 52;
    if (c.avatar) {
        return `<img class="pp-avatar" style="width:${s}px;height:${s}px"
            src="${esc(c.avatar)}" onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=\\'pp-avatar pp-avatar-fb\\' style=\\'width:${s}px;height:${s}px\\'>${esc(dname(c)[0])}</span>'))">`;
    }
    return `<span class="pp-avatar pp-avatar-fb" style="width:${s}px;height:${s}px">${esc(dname(c)[0])}</span>`;
}

// ── data ──
export function getContacts() { return getCfg().contacts; }
export function getThread(id) {
    const cfg = getCfg();
    if (!cfg.threads[id]) cfg.threads[id] = [];
    return cfg.threads[id];
}
export function lastTs(id) {
    const th = getThread(id);
    const last = th[th.length - 1];
    return last ? (last.ts || 0) : 0;
}
export function getChatStyle(id) {
    const cfg = getCfg();
    if (!cfg.chatStyle[id]) cfg.chatStyle[id] = { bg: '', bubble: '', bubbleImg: false, textColor: '' };
    if (cfg.chatStyle[id].textColor === undefined) cfg.chatStyle[id].textColor = '';
    return cfg.chatStyle[id];
}
export function isPinned(id) { return (getCfg().pinned || []).includes(id); }
export function listStCharacters() {
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
export function getContactPersona(id) {
    const ch = listStCharacters().find(x => x.id === id);
    return ch ? (ch.persona || '') : '';
}

// ── notes (24h) ──
export const NOTE_TTL = 24 * 3600000;
export function getUserNote() {
    const n = getCfg().userNote;
    if (!n || !n.text) return null;
    if (Date.now() - (n.ts || 0) > NOTE_TTL) return null;
    return n;
}
export function getBotNote(cid) {
    const n = (getCfg().botNotes || {})[cid];
    if (!n || !n.text) return null;
    if (Date.now() - (n.ts || 0) > NOTE_TTL) return null;
    return n;
}
export function setUserNote(text) {
    const cfg = getCfg();
    cfg.userNote = text ? { text: String(text).slice(0, 120), ts: Date.now() } : null;
    saveCfg();
}
export function setBotNote(cid, text) {
    const cfg = getCfg();
    if (!cfg.botNotes) cfg.botNotes = {};
    if (text) cfg.botNotes[cid] = { text: String(text).slice(0, 120), ts: Date.now() };
    else delete cfg.botNotes[cid];
    saveCfg();
}

// ── เวลา ──
export function ppNow() {
    const d = new Date();
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function ppDateLabel() {
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}
export const TH_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export function fmtHM(d) { return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
export function fmtListTime(ts) {
    if (!ts) return '';
    const d = new Date(ts), today = new Date();
    if (d.toDateString() === today.toDateString()) return fmtHM(d);
    const yst = new Date(); yst.setDate(yst.getDate() - 1);
    if (d.toDateString() === yst.toDateString()) return 'เมื่อวาน';
    if ((today - d) < 7 * 86400000) return TH_DAYS[d.getDay()];
    return `${d.getDate()}/${d.getMonth() + 1}`;
}
export function fmtNoteAge(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อกี้';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} ชม.ที่แล้ว`;
}
export function chatDividerFull(ts) {
    if (!ts) return '';
    const d = new Date(ts), today = new Date();
    if (d.toDateString() === today.toDateString()) return `วันนี้ ${fmtHM(d)}`;
    return `${TH_DAYS[d.getDay()]} ${d.getDate()} ${TH_MONTHS[d.getMonth()]} · ${fmtHM(d)}`;
}
export function chatDivider(prevTs, ts) {
    if (!prevTs || !ts) return '';
    const gap = ts - prevTs;
    if (gap < 300000) return '';
    const d = new Date(ts), p = new Date(prevTs);
    if (d.toDateString() === p.toDateString()) return fmtHM(d);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return `วันนี้ ${fmtHM(d)}`;
    return `${TH_DAYS[d.getDay()]} ${d.getDate()} ${TH_MONTHS[d.getMonth()]} · ${fmtHM(d)}`;
}
export function startClock() {
    if (S.clockTimer) return;
    const tick = () => {
        const t = ppNow();
        document.querySelectorAll('.pp-clock').forEach(e => e.textContent = t);
        const dl = document.getElementById('pp-home-date');
        if (dl) dl.textContent = ppDateLabel();
    };
    tick();
    S.clockTimer = setInterval(tick, 10000);
}

// ── theme ──
export function applyTheme() {
    const frame = document.getElementById('pp-frame');
    if (!frame) return;
    const cfg = getCfg();
    frame.classList.toggle('light', cfg.theme === 'light');
    frame.style.setProperty('--pp-accent', cfg.accent || '#0a84ff');
}
export function applyIsland() {
    const island = document.getElementById('pp-island');
    if (island) island.style.display = getCfg().dynamicIsland ? 'flex' : 'none';
}
export async function applyWallpaper() {
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

// ── ui-util ──
export function ppToast(msg) {
    const t = document.getElementById('pp-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}
export function ppPrompt(title, initial, onOk) {
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
export function ppHelpPopup(title, body) {
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

// ── Dynamic Island ──
export function renderIslandInto(el, state) {
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
export function islandRefresh() {
    const internal = document.getElementById('pp-island');
    const external = document.getElementById('pp-ext-island');
    const open = !!document.getElementById('pp-dialog')?.open;
    if (internal) {
        if (open && getCfg().dynamicIsland && S.islandState) renderIslandInto(internal, S.islandState);
        else renderIslandInto(internal, null);
    }
    if (external) {
        const showExt = !open && getCfg().islandScope === 'always' && S.islandState;
        renderIslandInto(external, showExt ? S.islandState : null);
    }
}
export function islandTyping(c) { clearTimeout(S.islandTimer); S.islandState = { cid: c.id, name: dname(c), avatar: c.avatar, kind: 'typing' }; islandRefresh(); }
export function islandShowReplies(c, lines) {
    clearTimeout(S.islandTimer);
    let i = 0;
    const step = () => {
        if (i >= lines.length) { S.islandState = null; islandRefresh(); return; }
        S.islandState = { cid: c.id, name: dname(c), avatar: c.avatar, kind: 'msg', text: lines[i] };
        islandRefresh(); i++;
        S.islandTimer = setTimeout(step, 2300);
    };
    step();
}
export function islandCollapse() { clearTimeout(S.islandTimer); S.islandState = null; islandRefresh(); }

// ── generation (retry) ──
export async function genOnce(prompt) {
    const context = ctx();
    if (context && typeof context.generateQuietPrompt === 'function') return await context.generateQuietPrompt(prompt, false, false);
    if (typeof window.generateQuietPrompt === 'function') return await window.generateQuietPrompt(prompt, false, false);
    throw new Error('generateQuietPrompt ไม่พร้อมใช้งาน');
}
export async function genWithRetry(prompt, tries) {
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

// ── ICON ──
export const ICON = {
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

export const APPS = [
    { nav: 'messages', label: 'Messages', glow: '#5ce07f', icon: ICON.messages },
    { nav: 'feed', label: 'Feed', glow: '#e8e8ed', icon: ICON.feed },
    { nav: 'wallet', label: 'Wallet', glow: '#ffc061', icon: ICON.wallet },
    { nav: 'settings', label: 'Settings', glow: '#d0d0d5', icon: ICON.settings },
];

export function ppNav(screen) {
    S.currentScreen = screen;
    document.getElementById('pp-chat-settings')?.classList.remove('show');
    document.querySelectorAll('.pp-screen').forEach(s => s.classList.remove('show'));
    if (screen === 'home') { document.getElementById('pp-home')?.classList.add('show'); return; }
    const el = document.getElementById('pp-scr-' + screen);
    if (el) {
        el.classList.add('show');
        const R = S._render;
        if (screen === 'messages') { R.notesRow?.(); R.contactList?.(); }
        if (screen === 'chat') R.thread?.();
        if (screen === 'settings') R.phoneSettings?.();
        if (screen === 'calllog') R.callLog?.();
    } else {
        S.currentScreen = 'home';
        document.getElementById('pp-home')?.classList.add('show');
        ppToast('เร็ว ๆ นี้: ' + screen);
    }
}
