// pocket-phone/apps/messages.js — 0.9.4 refactor: แชท + โทร + โน้ต (รวมกัน)
// import จาก core · อ้าง S.xxx แทน global เดิม · behavior เท่า 0.9.3

import {
    S, ctx, getCfg, saveCfg, esc, cleanReply, stripEmoji, isFarewell, wantsToCall,
    getUserName, dname, currentCharacterId, noteCategory, contactCategory, mainChatRecap,
    userAvatarHTML, contactAvatarHTML, getContacts, getThread, lastTs, getChatStyle,
    isPinned, listStCharacters, getContactPersona, getUserNote, getBotNote, setUserNote, setBotNote,
    CHAT_BGS, ICON, NOTE_TTL, fmtHM, fmtListTime, fmtNoteAge, chatDividerFull, chatDivider,
    loadMedia, saveMedia, ppToast, ppPrompt, ppHelpPopup,
    islandTyping, islandShowReplies, islandCollapse, islandRefresh,
    genWithRetry, ppNav,
} from '../core.js';

// ── notes row (3 หมวด: ปักหมุด/หลัก/NPC) ──
export function renderNotesRow() {
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

// ── รายชื่อ 3 หมวด ──
export function renderContactList(filter) {
    const list = document.getElementById('pp-contact-list');
    if (!list) return;
    let contacts = getContacts().slice();
    if (filter) contacts = contacts.filter(c => dname(c).toLowerCase().includes(filter.toLowerCase()));

    const rowHTML = (c) => {
        const th = getThread(c.id);
        const last = th[th.length - 1];
        const typing = S.generatingId === c.id;
        const preview = typing ? 'กำลังพิมพ์…' : (last ? last.text : 'แตะเพื่อเริ่มแชท');
        const timeLbl = last ? fmtListTime(last.ts) : '';
        const pinned = isPinned(c.id);
        const editControls = S.listEditMode
            ? `<div class="pp-row-edit" style="display:flex;gap:8px;flex-shrink:0">
                 <button class="pp-cs-btn" data-pin="${esc(c.id)}" style="padding:6px 10px;background:${pinned ? 'var(--pp-accent)' : 'var(--pp-bg3)'};color:${pinned ? '#fff' : 'var(--pp-txt)'}">${ICON.pin}</button>
                 <button class="pp-cs-btn" data-delchat="${esc(c.id)}" style="padding:6px 10px;background:rgba(255,69,58,.85);color:#fff">${ICON.trash}</button>
               </div>`
            : `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
                 <span style="font-size:12px;color:var(--pp-txt3)">${esc(timeLbl)}</span>
                 ${pinned ? `<span style="color:var(--pp-txt3);opacity:.7">${ICON.pin}</span>` : ''}
               </div>`;
        return `<div class="pp-row" ${S.listEditMode ? '' : `data-cid="${esc(c.id)}"`}>
            ${contactAvatarHTML(c, 52)}
            <div class="pp-row-meta">
                <div class="pp-row-name">${esc(dname(c))}</div>
                <div class="pp-row-preview${typing ? ' pp-preview-typing' : ''}">${esc(preview)}</div>
            </div>
            ${editControls}
        </div>`;
    };

    if (!contacts.length) {
        list.innerHTML = `<div class="pp-empty">ยังไม่มีคนคุย<br><span>แตะปุ่มมุมขวาบนเพื่อเพิ่ม</span></div>`;
        return;
    }
    const groups = { pin: [], char: [], npc: [] };
    contacts.forEach(c => groups[contactCategory(c)].push(c));
    for (const k of Object.keys(groups)) groups[k].sort((a, b) => lastTs(b.id) - lastTs(a.id));
    let html = '';
    const section = (arr, label) => { if (!arr.length) return; html += `<div class="pp-list-head">${label}</div>` + arr.map(rowHTML).join(''); };
    section(groups.pin, 'ปักหมุด');
    section(groups.char, 'ตัวละคร');
    section(groups.npc, 'NPC');
    list.innerHTML = html;
}

export function renderAddContacts() {
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
        ${added.has(c.id) ? `<span class="pp-added">เพิ่มแล้ว</span>` : `<button class="pp-add-btn" data-add="${esc(c.id)}">เพิ่ม</button>`}
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

export function renderThread() {
    const c = S.activeContact;
    if (!c) { ppNav('messages'); return; }
    const name = document.getElementById('pp-chat-hdr-name');
    if (name) name.textContent = dname(c);
    const avSlot = document.getElementById('pp-chat-hdr-av');
    if (avSlot) avSlot.innerHTML = contactAvatarHTML(c, 30);
    const rn = document.getElementById('pp-rename-input');
    if (rn) rn.value = c.customName || '';
    const msgs = document.getElementById('pp-msgs');
    if (!msgs) return;
    msgs.classList.toggle('edit-on', S.editMode);
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
        if (!S.editMode && S.generatingId !== c.id && th[th.length - 1].from === 'them' && th[th.length - 1].type !== 'call') {
            html += `<div class="pp-regen-row" id="pp-regen-row"><button id="pp-regen-btn" class="pp-regen">${ICON.regen}รีเจน</button></div>`;
        }
        msgs.innerHTML = html;
    }
    applyChatStyle();
    if (S.generatingId === c.id) showTyping();
    msgs.scrollTop = msgs.scrollHeight;
}

export function showTyping() {
    const msgs = document.getElementById('pp-msgs');
    if (!msgs || document.getElementById('pp-typing')) return;
    document.getElementById('pp-regen-row')?.remove();
    msgs.insertAdjacentHTML('beforeend',
        `<div class="pp-brow in" id="pp-typing"><div class="pp-typing"><span></span><span></span><span></span></div></div>`);
    msgs.scrollTop = msgs.scrollHeight;
}
export function hideTyping() { document.getElementById('pp-typing')?.remove(); }

export async function applyChatStyle() {
    const c = S.activeContact; if (!c) return;
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
export function toggleChatSettings() {
    const p = document.getElementById('pp-chat-settings');
    if (!p) return;
    const show = !p.classList.contains('show');
    p.classList.toggle('show', show);
    if (show) buildChatSwatches();
}
export function buildChatSwatches() {
    const bgWrap = document.getElementById('pp-chat-bg-swatches');
    if (bgWrap) {
        bgWrap.innerHTML = Object.keys(CHAT_BGS).map(k =>
            `<button class="pp-cs-swatch" data-chatbg="${k}" style="background:${k ? CHAT_BGS[k] : 'var(--pp-bg3)'}">${k ? '' : 'ปกติ'}</button>`).join('');
    }
    const et = document.getElementById('pp-edit-toggle');
    if (et) et.classList.toggle('on', S.editMode);
    const nt = document.getElementById('pp-npc-toggle');
    if (nt && S.activeContact) nt.classList.toggle('on', !!S.activeContact.npc);
    if (S.activeContact) {
        const st = getChatStyle(S.activeContact.id);
        const bc = document.getElementById('pp-bubble-color'); if (bc) bc.value = st.bubble || getCfg().accent || '#0a84ff';
        const tc = document.getElementById('pp-text-color'); if (tc) tc.value = st.textColor || '#ffffff';
        const rn = document.getElementById('pp-rename-input'); if (rn) rn.value = S.activeContact.customName || '';
    }
    markChatSwatches();
}
export function markChatSwatches() {
    const c = S.activeContact; if (!c) return;
    const st = getChatStyle(c.id);
    document.querySelectorAll('#pp-chat-bg-swatches .pp-cs-swatch').forEach(b => b.classList.toggle('on', b.dataset.chatbg === st.bg));
}

export function ppOpenThread(id) {
    const c = getContacts().find(x => x.id === id);
    if (!c) return;
    S.activeContact = c;
    S.editMode = false;
    ppNav('chat');
}
export function ppAddContact(id) {
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
export function ppDeleteMsg(idx) {
    const c = S.activeContact; if (!c) return;
    const th = getThread(c.id);
    if (idx < 0 || idx >= th.length) return;
    th.splice(idx, 1);
    saveCfg();
    renderThread();
    renderContactList();
}
export function ppTogglePin(id) {
    const cfg = getCfg();
    if (!cfg.pinned) cfg.pinned = [];
    const i = cfg.pinned.indexOf(id);
    if (i >= 0) cfg.pinned.splice(i, 1); else cfg.pinned.push(id);
    saveCfg();
    renderContactList();
    ppToast(i >= 0 ? 'เลิกปักหมุด' : 'ปักหมุดแล้ว');
}
export function ppToggleNpc(id) {
    const c = getContacts().find(x => x.id === id);
    if (!c) return;
    c.npc = !c.npc;
    if (S.activeContact && S.activeContact.id === id) S.activeContact.npc = c.npc;
    saveCfg();
    ppToast(c.npc ? 'ย้ายไปหมวด NPC' : 'ย้ายไปหมวดตัวละคร');
}
export function ppDeleteChat(id) {
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

export function ppSendUserMessage() {
    const c = S.activeContact;
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
export function ppViewing(c) {
    return S.currentScreen === 'chat' && S.activeContact && S.activeContact.id === c.id
        && !!document.getElementById('pp-dialog')?.open;
}

export async function ppRegenerate() {
    const c = S.activeContact;
    if (!c || S.generatingId) return;
    const th = getThread(c.id);
    while (th.length && th[th.length - 1].from === 'them' && th[th.length - 1].type !== 'call') th.pop();
    saveCfg();
    renderThread();
    ppGenerateReply();
}

// ── รวมจักรวาลแบบ A ──
function findMentionedContact(text, excludeId) {
    const s = String(text || '');
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
async function universeInterject(interloper) {
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

export async function ppGenerateReply() {
    const c = S.activeContact;
    if (!c || S.generatingId || S.call) return;
    const input = document.getElementById('pp-input');
    if (input && input.value.trim()) ppSendUserMessage();
    if (!getThread(c.id).some(m => m.from === 'me')) {
        ppToast('พิมพ์ข้อความก่อน แล้วค่อยกดให้บอทตอบ');
        return;
    }
    S.generatingId = c.id;
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
        const rp = getCfg().universeAffectsRP ? mainChatRecap(8) : '';
        const th = getThread(c.id).slice(-16);
        const histTxt = th.map(m => {
            if (m.type === 'call') return `[${m.text}]`;
            return `${m.from === 'me' ? userName : dname(c)}: ${m.text}`;
        }).join('\n');

        const prompt = [
            `[Text messaging app — you are ${dname(c)}, chatting with ${userName}.]`,
            persona ? `Character info for ${dname(c)}: ${persona}` : null,
            rp ? `Ongoing roleplay context (what is happening between you and ${userName} in the main story — remember it, stay consistent):\n${rp}` : null,
            `Status note from ${userName} right now: ${un ? `"${un.text}"` : '-'}. If there is a note, you can see it and may react naturally.`,
            histTxt ? `\n<history>\n${histTxt}\n</history>` : null,
            `\nReply in character as ${dname(c)} with short, natural text messages (1-3 short lines).`,
            `Reply in the SAME language the conversation is using (Thai if they use Thai).`,
            getCfg().botCallKeyword ? `If ${dname(c)} would rather call than text right now, include a phrase like "โทรหา"/"เดี๋ยวโทร"/"calling you" — the app turns it into a call.` : null,
            `You may set your own status note by adding a final line exactly like: [NOTE] your short status — do this when your mood/situation would make you post one.`,
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
            if (getCfg().sharedUniverse) mentioned = findMentionedContact(lines.join(' '), c.id);
        }
    } catch (e) {
        failed = true;
        console.error('[pocket-phone] generate', e);
    } finally {
        S.generatingId = null;
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
            if (mentioned) setTimeout(() => universeInterject(mentioned), 1600);
        }
    }
}

// ── CALL SYSTEM ──
export function ppStartCall() {
    const c = S.activeContact; if (!c || S.call) return;
    S.call = { c, incoming: false, connected: false, startTs: 0, timer: null, generating: false, transcript: [] };
    ppRenderCallScreen(c, 'กำลังโทร…', false);
    ppNav('call');
    setTimeout(() => { if (S.call) ppConnectCall(); }, 1500 + Math.random() * 1200);
}
export function ppIncomingCall(c) {
    if (!c || S.call) return;
    S.call = { c, incoming: true, connected: false, startTs: 0, timer: null, generating: false, transcript: [] };
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
    if (!S.call) return;
    S.call.connected = true;
    S.call.startTs = Date.now();
    islandCollapse();
    const scr = document.getElementById('pp-scr-call'); if (scr) scr.classList.remove('ringing');
    const st = document.getElementById('pp-call-status'); if (st) st.textContent = 'เชื่อมต่อแล้ว';
    const dur = document.getElementById('pp-call-dur'); if (dur) dur.style.display = 'block';
    S.call.timer = setInterval(() => {
        if (!S.call || !S.call.connected) return;
        const s = Math.floor((Date.now() - S.call.startTs) / 1000);
        const d = document.getElementById('pp-call-dur');
        if (d) d.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }, 500);
    setTimeout(() => { const st2 = document.getElementById('pp-call-status'); if (st2 && S.call) st2.textContent = ''; }, 2500);
    if (S.call.incoming) setTimeout(() => ppCallGenerate(true), 600);
}
export function ppAcceptCall() { if (S.call && S.call.incoming && !S.call.connected) ppConnectCall(); }
export function ppDeclineCall() { if (S.call) ppEndCall(true); }

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
export function ppCallSend() {
    if (!S.call || !S.call.connected) return;
    const inp = document.getElementById('pp-call-input');
    const t = (inp.value || '').trim(); if (!t) return;
    inp.value = ''; inp.style.height = 'auto';
    ppCallEmit(t, 'me');
    S.call.transcript.push({ from: 'me', text: t });
}
export async function ppCallGenerate(opener) {
    if (!S.call || !S.call.connected || S.call.generating) return;
    const c = S.call.c;
    const inp = document.getElementById('pp-call-input');
    if (inp && inp.value.trim() && !opener) ppCallSend();
    S.call.generating = true;
    const ty = document.getElementById('pp-call-typing'); if (ty) ty.classList.add('show');
    try {
        const userName = getUserName();
        const persona = getContactPersona(c.id);
        const chatHist = getThread(c.id).slice(-12).map(m => {
            if (m.type === 'call') return `[${m.text}]`;
            return `${m.from === 'me' ? userName : dname(c)}: ${m.text}`;
        }).join('\n');
        const un = getUserNote();
        const rp = getCfg().universeAffectsRP ? mainChatRecap(6) : '';
        const tr = (S.call.transcript || []).slice(-10)
            .map(m => `${m.from === 'me' ? userName : dname(c)}: ${m.text}`).join('\n');
        const prompt = [
            `[Phone call — you are ${dname(c)}, on a voice call with ${userName}${opener ? ' that you just started' : ''}.]`,
            persona ? `Character info for ${dname(c)}: ${persona}` : null,
            rp ? `Ongoing roleplay context (stay consistent):\n${rp}` : null,
            chatHist ? `Your recent text chat with ${userName} (you remember this):\n${chatHist}` : null,
            un ? `${userName}'s current status note: "${un.text}"` : null,
            tr ? `\nThis call so far:\n${tr}` : null,
            opener ? `\nYou called ${userName}. Open the call — say why you're calling, in your own voice, referencing what you two were just talking about if relevant.` : `\nContinue the call naturally.`,
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
            if (!S.call) break;
            ppCallEmit(lines[i], 'them');
            S.call.transcript.push({ from: 'them', text: lines[i] });
            if (isFarewell(lines[i])) saidBye = true;
            await new Promise(r => setTimeout(r, 700 + Math.min(2600, lines[i].length * 55)));
        }
        if (saidBye && S.call) { await new Promise(r => setTimeout(r, 1400)); if (S.call) ppEndCall(); }
    } catch (e) {
        if (ty) ty.classList.remove('show');
        ppCallEmit('สายไม่ชัด ลองใหม่นะ', 'them');
        console.error('[pocket-phone] call gen', e);
    } finally {
        if (S.call) S.call.generating = false;
    }
}
export function ppEndCall(declined) {
    if (!S.call) return;
    const c = S.call.c;
    const connected = S.call.connected;
    const secs = connected ? Math.floor((Date.now() - S.call.startTs) / 1000) : 0;
    if (S.call.timer) clearInterval(S.call.timer);
    const transcript = S.call.transcript || [];
    const cfg = getCfg();
    if (!cfg.callLog) cfg.callLog = [];
    cfg.callLog.push({
        cid: c.id, name: dname(c), avatar: c.avatar,
        startISO: new Date().toISOString(),
        durText: connected ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : (declined ? 'ปฏิเสธ' : 'ไม่รับสาย'),
        incoming: S.call.incoming, transcript,
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
    S.call = null;
    islandCollapse();
    ppNav('callend');
}

export function renderCallLog() {
    const list = document.getElementById('pp-calllog-list');
    if (!list) return;
    const cfg = getCfg();
    let logs = (cfg.callLog || []).map((l, gi) => ({ ...l, gi }));
    if (S.callLogFilter) logs = logs.filter(l => l.cid === S.callLogFilter);
    logs.reverse();
    const title = document.getElementById('pp-calllog-title');
    if (title) title.textContent = S.callLogFilter ? `สายกับ ${logs[0] ? logs[0].name : ''}` : 'ประวัติการโทร';
    const editBtn = document.getElementById('pp-calllog-edit-btn');
    if (editBtn) editBtn.textContent = S.callLogEdit ? 'เสร็จ' : 'แก้ไข';
    if (!logs.length) { list.innerHTML = `<div class="pp-empty">ยังไม่มีสาย</div>`; return; }
    list.innerHTML = logs.map(l => {
        const d = new Date(l.startISO);
        const when = `${fmtListTime(d.getTime())} · ${fmtHM(d)}`;
        const del = S.callLogEdit ? `<button class="pp-cs-btn" data-dellog="${l.gi}" style="padding:6px 10px;background:rgba(255,69,58,.85);color:#fff;flex-shrink:0">${ICON.trash}</button>` : `<span style="font-size:13px;color:var(--pp-txt3);flex-shrink:0">${esc(l.durText)}</span>`;
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
export function showTranscript(gi) {
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

// ── HTML ชิ้นของแอปนี้ (index.js ประกอบเข้า buildPhone) ──
export function messagesScreensHTML() {
    return `
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
          <div class="pp-cs-row"><span>ทำเป็น NPC (หมวด NPC)</span><button id="pp-npc-toggle" class="pp-cs-btn">สลับ</button></div>
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
      </div>`;
}

// ── event delegation ของแอปนี้ (index.js เรียกจาก handler กลาง) ──
export function messagesHandleClick(t) {
    if (t.dataset && t.dataset.cid) { ppOpenThread(t.dataset.cid); return true; }
    if (t.dataset && t.dataset.add) { ppAddContact(t.dataset.add); return true; }
    if (t.dataset && t.dataset.del != null) { ppDeleteMsg(+t.dataset.del); return true; }
    if (t.dataset && t.dataset.pin) { ppTogglePin(t.dataset.pin); return true; }
    if (t.dataset && t.dataset.delchat) { ppDeleteChat(t.dataset.delchat); return true; }
    if (t.dataset && t.dataset.chatbg != null && S.activeContact) { getChatStyle(S.activeContact.id).bg = t.dataset.chatbg; saveCfg(); applyChatStyle(); markChatSwatches(); return true; }
    if (t.dataset && t.dataset.showtr != null) { showTranscript(+t.dataset.showtr); return true; }
    if (t.dataset && t.dataset.dellog != null) { const cfg = getCfg(); cfg.callLog.splice(+t.dataset.dellog, 1); saveCfg(); renderCallLog(); return true; }
    if (t.dataset && t.dataset.usernote != null) {
        const cur = getUserNote();
        ppPrompt('โน้ตของคุณ (24 ชม.)', cur ? cur.text : '', v => { setUserNote(v); renderNotesRow(); ppToast(v ? 'ลงโน้ตแล้ว' : 'ลบโน้ตแล้ว'); });
        return true;
    }
    if (t.dataset && t.dataset.botnote) {
        const bn = getBotNote(t.dataset.botnote);
        const cc = getContacts().find(x => x.id === t.dataset.botnote);
        if (bn) ppHelpPopup(`โน้ตของ ${cc ? dname(cc) : ''} · ${fmtNoteAge(bn.ts)}`, esc(bn.text));
        return true;
    }
    switch (t.id) {
        case 'pp-chat-call-btn': ppStartCall(); return true;
        case 'pp-chat-menu-btn': toggleChatSettings(); return true;
        case 'pp-npc-toggle': if (S.activeContact) { ppToggleNpc(S.activeContact.id); const b = document.getElementById('pp-npc-toggle'); if (b) b.classList.toggle('on', !!S.activeContact.npc); } return true;
        case 'pp-edit-toggle': S.editMode = !S.editMode; renderThread(); { const b = document.getElementById('pp-edit-toggle'); if (b) b.classList.toggle('on', S.editMode); } return true;
        case 'pp-list-edit-btn': S.listEditMode = !S.listEditMode; renderContactList(); { const b = document.getElementById('pp-list-edit-btn'); if (b) b.textContent = S.listEditMode ? 'เสร็จ' : 'แก้ไข'; } return true;
        case 'pp-rename-save': if (S.activeContact) { const v = (document.getElementById('pp-rename-input')?.value || '').trim(); const stored = getContacts().find(x => x.id === S.activeContact.id); if (stored) { stored.customName = v || undefined; S.activeContact.customName = v || undefined; saveCfg(); renderThread(); renderContactList(); ppToast('เปลี่ยนชื่อแล้ว'); } } return true;
        case 'pp-bubble-clear': if (S.activeContact) { getChatStyle(S.activeContact.id).bubbleImg = false; saveCfg(); applyChatStyle(); ppToast('ล้างรูปฟองแล้ว'); } return true;
        case 'pp-calllog-btn': if (S.activeContact) { S.callLogFilter = S.activeContact.id; S.callLogEdit = false; ppNav('calllog'); } return true;
        case 'pp-calllog-back': S.callLogFilter = null; ppNav(S.activeContact ? 'chat' : 'messages'); return true;
        case 'pp-calllog-edit-btn': S.callLogEdit = !S.callLogEdit; renderCallLog(); return true;
        case 'pp-gen': ppGenerateReply(); return true;
        case 'pp-regen-btn': ppRegenerate(); return true;
        case 'pp-call-gen': ppCallGenerate(false); return true;
        case 'pp-call-end': ppEndCall(); return true;
        case 'pp-call-accept': ppAcceptCall(); return true;
        case 'pp-call-decline': ppDeclineCall(); return true;
        case 'pp-callend-ok': ppNav(S.activeContact ? 'chat' : 'messages'); return true;
        case 'pp-call-mute': case 'pp-call-speaker': t.classList.toggle('on'); return true;
    }
    if (t.classList && t.classList.contains('pp-cc')) { t.classList.toggle('on'); return true; }
    return false;
}

// ── input bindings ของแอปนี้ (index.js เรียกหลัง injectPhone) ──
export function messagesBindInputs() {
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

    const fileToMedia = (inputId, key, after) => {
        document.getElementById(inputId)?.addEventListener('change', e => {
            const f = e.target.files && e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = async () => { await saveMedia(key(), r.result); if (after) await after(); };
            r.readAsDataURL(f);
            e.target.value = '';
        });
    };
    fileToMedia('pp-chatbg-file', () => 'chatbg-' + (S.activeContact ? S.activeContact.id : 'x'), async () => { if (S.activeContact) { getChatStyle(S.activeContact.id).bg = 'custom'; saveCfg(); applyChatStyle(); markChatSwatches(); ppToast('ตั้งพื้นหลังแชทแล้ว'); } });
    fileToMedia('pp-bubbleimg-file', () => 'bubbleimg-' + (S.activeContact ? S.activeContact.id : 'x'), async () => { if (S.activeContact) { getChatStyle(S.activeContact.id).bubbleImg = true; saveCfg(); applyChatStyle(); ppToast('ตั้งรูปฟองแล้ว'); } });

    document.getElementById('pp-bubble-color')?.addEventListener('input', e => { if (S.activeContact) { getChatStyle(S.activeContact.id).bubble = e.target.value; getChatStyle(S.activeContact.id).bubbleImg = false; saveCfg(); applyChatStyle(); } });
    document.getElementById('pp-text-color')?.addEventListener('input', e => { if (S.activeContact) { getChatStyle(S.activeContact.id).textColor = e.target.value; saveCfg(); applyChatStyle(); } });
}
