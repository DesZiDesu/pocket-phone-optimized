// pocket-phone/index.js — 0.9.4 refactor: entry / ตัวกาว
// import core + apps · ประกอบ buildPhone · router · boot
// ES module · manifest ใช้ "js": "index.js" เดียว

import {
    S, ctx, PP_VERSION, MODULE_NAME, APPS, ICON,
    getCfg, saveCfg, esc, dname, getUserName, getContacts,
    getUserNote, isPinned, ppNav,
    applyTheme, applyIsland, applyWallpaper, startClock, refreshUserAvatar,
    ppToast, islandRefresh,
} from './core.js';

import {
    messagesScreensHTML, messagesHandleClick, messagesBindInputs,
    renderNotesRow, renderContactList, renderThread,
} from './apps/messages.js';

import {
    settingsScreenHTML, settingsHandleClick, settingsBindInputs,
    renderPhoneSettings,
} from './apps/settings.js';

// ── placeholder screens (feed/wallet ยังไม่เปิดใช้ — โครงเปล่า) ──
function placeholderScreensHTML() {
    const stub = (id, label) => `
      <div class="pp-screen" id="pp-scr-${id}">
        <div class="pp-nav">
          <button class="pp-nav-back" data-nav="home">${ICON.back}</button>
          <span class="pp-nav-title">${label}</span>
          <span style="width:34px"></span>
        </div>
        <div class="pp-empty" style="margin-top:60px">ยังไม่เปิดใช้งาน<br><span>เร็ว ๆ นี้</span></div>
        <div class="pp-home-bar"></div>
      </div>`;
    return stub('feed', 'Feed') + stub('wallet', 'Wallet');
}

// ── router ──
export function ppNav(screen) {
    S.currentScreen = screen;
    document.getElementById('pp-chat-settings')?.classList.remove('show');
    document.querySelectorAll('.pp-screen').forEach(s => s.classList.remove('show'));
    if (screen === 'home') { document.getElementById('pp-home')?.classList.add('show'); return; }
    const el = document.getElementById('pp-scr-' + screen);
    if (el) {
        el.classList.add('show');
        if (screen === 'messages') { renderNotesRow(); renderContactList(); }
        if (screen === 'chat') renderThread();
        if (screen === 'settings') renderPhoneSettings();
        if (screen === 'calllog') { /* renderCallLog เรียกผ่าน handler */ }
    } else {
        S.currentScreen = 'home';
        document.getElementById('pp-home')?.classList.add('show');
        ppToast('เร็ว ๆ นี้: ' + screen);
    }
}

// ── buildPhone: ประกอบจากชิ้นของแต่ละแอป ──
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
      ${messagesScreensHTML()}
      ${settingsScreenHTML()}
      ${placeholderScreensHTML()}
    </div>
    <div id="pp-toast"></div>
  </div>
</dialog>`;
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
window.__ppOpen = ppOpen;

// ── inject ──
function injectPhone() {
    if (document.getElementById('pp-dialog')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = buildPhone();
    document.body.appendChild(wrap.firstElementChild);

    const dlg = document.getElementById('pp-dialog');
    dlg?.addEventListener('cancel', e => { e.preventDefault(); ppClose(); });

    // handler กลาง — dispatch ไปแต่ละแอป
    document.getElementById('pp-frame')?.addEventListener('click', e => {
        const t = e.target.closest('button,[data-nav],[data-cid],[data-add],[data-del],[data-pin],[data-delchat],[data-chatbg],[data-wp],[data-usernote],[data-botnote],[data-showtr],[data-dellog],.pp-cc,.pp-wp-swatch');
        if (!t) return;
        if (t.id === 'pp-close-btn') { ppClose(); return; }
        if (t.dataset && t.dataset.nav) { ppNav(t.dataset.nav); return; }
        if (t.dataset && t.dataset.island && t.dataset.cid) { const c = getContacts().find(x => x.id === t.dataset.cid); if (c) { S.activeContact = c; ppNav('chat'); } return; }
        // ลอง messages ก่อน แล้ว settings
        if (messagesHandleClick(t)) return;
        if (settingsHandleClick(t)) return;
    });

    // island ในจอ กดแล้วเข้าแชท
    document.getElementById('pp-island')?.addEventListener('click', function () {
        const cid = this.dataset.cid;
        if (cid) { const c = getContacts().find(x => x.id === cid); if (c) { S.activeContact = c; ppNav('chat'); } }
    });

    messagesBindInputs();
    settingsBindInputs();
}

function injectCSS() {
    if (document.getElementById('pp-css')) return;
    const s = document.createElement('style');
    s.id = 'pp-css';
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
.pp-call-stage{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;padding:20px 28px;overflow:hidden;position:relative;z-index:2;}
.pp-call-line{font-size:19px;line-height:1.45;color:#fff;text-align:center;opacity:0;transform:translateY(12px);transition:opacity .5s,transform .5s;text-shadow:0 2px 12px rgba(0,0,0,.6);}
.pp-call-line.me{font-size:16px;color:rgba(255,255,255,.7);}
.pp-call-line.show{opacity:1;transform:none;}
.pp-call-line.fade{opacity:0;transform:translateY(-10px);}
`;
    document.head.appendChild(s);
}

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
    item.addEventListener('click', ppOpen);
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
        if (cid) { const c = getContacts().find(x => x.id === cid); if (c) { S.activeContact = c; ppNav('chat'); } }
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
        chatLen: (ctx() && Array.isArray(ctx().chat)) ? ctx().chat.length : 0,
        contacts: getContacts().length,
        userNote: !!getUserNote(),
        sharedUniverse: getCfg().sharedUniverse,
        affectsRP: getCfg().universeAffectsRP,
        botCallKeyword: getCfg().botCallKeyword,
        wandBtn: !!document.getElementById('pp-wand-btn'),
    };
    console.table(rows);
    ppToast('Diag → console');
    return rows;
};

// ── boot ──
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
    const wandTimer = setInterval(() => { if (injectWandButton()) clearInterval(wandTimer); }, 700);
    setTimeout(() => clearInterval(wandTimer), 45000);
    try {
        const mo = new MutationObserver(() => { if (!document.getElementById('pp-wand-btn')) injectWandButton(); });
        mo.observe(document.body, { childList: true, subtree: true });
    } catch {}
})();
