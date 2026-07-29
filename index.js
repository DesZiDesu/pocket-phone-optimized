// pocket-phone/index.js — Stage 3: bot reply via generateQuietPrompt
// getContext ล้วน · ไม่มี import/export · lazy + try/catch

const PP_VERSION = '0.3.0-stage3';
const MODULE_NAME = 'pocket-phone'; // ⚠️ ต้องตรงกับชื่อโฟลเดอร์/repo

function ctx() {
    try { return SillyTavern.getContext(); } catch { return null; }
}

// ── store ──
const DEFAULTS = {
    theme: 'dark',
    accent: '#0a84ff',
    dynamicIsland: true,
    contacts: [],   // { id, name, avatar }
    threads: {},    // { [id]: [ { from:'me'|'them', text, ts } ] }
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

// ── clean CoT / junk ──
function cleanReply(t) {
    let s = String(t || '');
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
    s = s.replace(/<think>[\s\S]*/gi, '');
    s = s.replace(/\[(?:CoT|COT|THINK|SYSTEM|CONTEXT|PERSONA|PHASE|STEP)[^\]]*\][^\n]*/gi, '');
    return s.trim();
}

// ── user name ──
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
    applyTheme(); applyIsland(); startClock();
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

// ── router ──
let ppActiveContact = null;
let ppIsTyping = false;
function ppNav(screen) {
    document.querySelectorAll('.pp-screen').forEach(s => s.classList.remove('show'));
    if (screen === 'home') { document.getElementById('pp-home')?.classList.add('show'); return; }
    const el = document.getElementById('pp-scr-' + screen);
    if (el) {
        el.classList.add('show');
        if (screen === 'messages') renderContactList();
        if (screen === 'contacts') renderAddContacts();
        if (screen === 'chat') renderThread();
    } else {
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

// ── avatar helper ──
function contactAvatarHTML(c, size) {
    const s = size || 52;
    if (c.avatar) {
        return `<img class="pp-avatar" style="width:${s}px;height:${s}px"
            src="${esc(c.avatar)}" onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=\\'pp-avatar pp-avatar-fb\\' style=\\'width:${s}px;height:${s}px\\'>${esc((c.name||'?')[0])}</span>'))">`;
    }
    return `<span class="pp-avatar pp-avatar-fb" style="width:${s}px;height:${s}px">${esc((c.name || '?')[0])}</span>`;
}

// ── contacts / threads ──
function getContacts() { return getCfg().contacts; }
function getThread(id) {
    const cfg = getCfg();
    if (!cfg.threads[id]) cfg.threads[id] = [];
    return cfg.threads[id];
}

// ── ST characters ──
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
    story: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.2C10.5 5 8.4 4.5 6 4.5c-.8 0-1.5.6-1.5 1.4v11c0 .8.7 1.4 1.5 1.4 2.1 0 4 .5 5.3 1.5.4.3 1 .3 1.4 0 1.3-1 3.2-1.5 5.3-1.5.8 0 1.5-.6 1.5-1.4v-11c0-.8-.7-1.4-1.5-1.4-2.4 0-4.5.5-6 1.7zM12 6.2v12"/></svg>`,
    messages: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 3C6.9 3 3 6.6 3 11c0 2.3 1.1 4.4 2.9 5.8-.2 1.3-.8 2.5-1.6 3.4-.2.2 0 .6.3.5 1.9-.3 3.4-1 4.4-1.6 1 .3 2 .4 3 .4 5.1 0 9-3.6 9-8s-3.9-8-9-8z"/></svg>`,
    feed: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
    wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18" stroke-width="1.8"/><circle cx="17" cy="14.5" r="1.1" fill="#fff" stroke="none"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.49.49 0 0 0 13.5 2h-3c-.24 0-.44.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94L2.86 14.52a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.03.24.23.41.47.41h3c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>`,
    signal: `<svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.5" width="3" height="6.5" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></svg>`,
    wifi: `<svg viewBox="0 0 24 18" fill="currentColor"><path d="M12 3C8 3 4.4 4.6 1.8 7.2l1.8 1.8C5.8 6.8 8.7 5.5 12 5.5s6.2 1.3 8.4 3.5l1.8-1.8C19.6 4.6 16 3 12 3zm0 6c-2 0-3.8.8-5.1 2.1l1.8 1.8C9.5 12.1 10.7 11.5 12 11.5s2.5.6 3.3 1.4l1.8-1.8A7.2 7.2 0 0 0 12 9zm0 5.5-2.1 2.1c.6.6 1.4.9 2.1.9s1.5-.3 2.1-.9L12 14.5z"/></svg>`,
    battery: `<svg viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor"/><rect x="23" y="4" width="1.8" height="4" rx=".9" fill="currentColor" fill-opacity=".4"/></svg>`,
    back: `<svg viewBox="0 0 12 20" width="11" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2 2 10l8 8"/></svg>`,
    compose: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
    send: `<svg viewBox="0 0 24 24" width="17" height="17" fill="#fff"><path d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2z"/></svg>`,
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
      <span class="pp-sb-right">${ICON.signal}${ICON.wifi}${ICON.battery}
        <button id="pp-close-btn" title="Close">✕</button></span>
    </div>

    <div id="pp-screens">
      <div class="pp-screen show" id="pp-home">
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
          <span style="width:34px"></span>
        </div>
        <div class="pp-msgs" id="pp-msgs"></div>
        <div class="pp-inputbar">
          <textarea class="pp-input" id="pp-input" rows="1" placeholder="ข้อความ"></textarea>
          <button class="pp-send" id="pp-send">${ICON.send}</button>
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
        const preview = last ? last.text : 'แตะเพื่อเริ่มแชท';
        return `<div class="pp-row" data-cid="${esc(c.id)}">
            ${contactAvatarHTML(c, 52)}
            <div class="pp-row-meta">
                <div class="pp-row-name">${esc(c.name)}</div>
                <div class="pp-row-preview">${esc(preview)}</div>
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

function bubbleHTML(m) {
    return `<div class="pp-brow ${m.from === 'me' ? 'out' : 'in'}">
        <div class="pp-bubble">${esc(m.text)}</div>
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
    const th = getThread(c.id);
    msgs.innerHTML = th.length
        ? th.map(bubbleHTML).join('')
        : `<div class="pp-sys">เริ่มบทสนทนา</div>`;
    msgs.scrollTop = msgs.scrollHeight;
}

function appendBubble(m) {
    const msgs = document.getElementById('pp-msgs');
    if (!msgs) return;
    const sys = msgs.querySelector('.pp-sys');
    if (sys) sys.remove();
    msgs.insertAdjacentHTML('beforeend', bubbleHTML(m));
    msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
    const msgs = document.getElementById('pp-msgs');
    if (!msgs || document.getElementById('pp-typing')) return;
    msgs.insertAdjacentHTML('beforeend',
        `<div class="pp-brow in" id="pp-typing"><div class="pp-typing"><span></span><span></span><span></span></div></div>`);
    msgs.scrollTop = msgs.scrollHeight;
}
function hideTyping() { document.getElementById('pp-typing')?.remove(); }

function ppOpenThread(id) {
    const c = getContacts().find(x => x.id === id);
    if (!c) return;
    ppActiveContact = c;
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

function ppSendMessage() {
    const c = ppActiveContact;
    if (!c || ppIsTyping) return;
    const input = document.getElementById('pp-input');
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('pp-send')?.classList.remove('active');
    const th = getThread(c.id);
    const msg = { from: 'me', text, ts: Date.now() };
    th.push(msg);
    saveCfg();
    appendBubble(msg);
    botReply();
}

// ── bot reply ──
async function botReply() {
    const c = ppActiveContact;
    if (!c || ppIsTyping) return;
    ppIsTyping = true;
    showTyping();
    try {
        const context = ctx();
        const userName = getUserName();
        const persona = getContactPersona(c.id);
        const th = getThread(c.id).slice(-14);
        const histTxt = th.map(m =>
            `${m.from === 'me' ? userName : c.name}: ${m.text}`).join('\n');

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

        // clean
        raw = cleanReply(raw);
        const nameRx = new RegExp('^' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'gim');
        raw = raw.replace(nameRx, '').trim();

        // แยกเป็นหลายฟองตามบรรทัด (สูงสุด 3)
        const lines = raw.split(/\n+/)
            .map(l => l.trim().replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim())
            .filter(Boolean)
            .slice(0, 3);
        if (!lines.length) lines.push('...');

        const threadArr = getThread(c.id);
        for (let i = 0; i < lines.length; i++) {
            if (i > 0) {
                showTyping();
                await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
            }
            hideTyping();
            const bm = { from: 'them', text: lines[i], ts: Date.now() };
            threadArr.push(bm);
            appendBubble(bm);
        }
        saveCfg();
    } catch (e) {
        hideTyping();
        const bm = { from: 'them', text: '(ตอบไม่สำเร็จ — เช็ก SillyTavern)', ts: Date.now() };
        getThread(c.id).push(bm);
        appendBubble(bm);
        saveCfg();
        console.error('[pocket-phone] botReply', e);
    } finally {
        hideTyping();
        ppIsTyping = false;
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
        const nav = e.target.closest('[data-nav]');
        if (nav) { ppNav(nav.dataset.nav); return; }
        const add = e.target.closest('[data-add]');
        if (add) { ppAddContact(add.dataset.add); return; }
        const row = e.target.closest('.pp-row[data-cid]');
        if (row) { ppOpenThread(row.dataset.cid); return; }
    });

    document.getElementById('pp-msg-search')?.addEventListener('input', e => renderContactList(e.target.value));

    const input = document.getElementById('pp-input');
    const send = document.getElementById('pp-send');
    if (input) {
        input.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 90) + 'px';
            send?.classList.toggle('active', this.value.trim().length > 0);
        });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ppSendMessage(); }
        });
    }
    send?.addEventListener('click', ppSendMessage);
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
        genQuiet: !!(c && typeof c.generateQuietPrompt === 'function'),
        chars: listStCharacters().length, contacts: getContacts().length,
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
