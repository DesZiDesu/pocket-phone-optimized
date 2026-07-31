// pocket-phone/apps/settings.js — 0.9.4 refactor: หน้า Settings ในมือถือ
import {
    S, getCfg, saveCfg, esc, ICON, WALLPAPERS, PP_VERSION,
    applyTheme, applyIsland, applyWallpaper, refreshUserAvatar,
    saveMedia, ppToast, ppHelpPopup, islandRefresh,
} from '../core.js';
import { renderNotesRow } from './messages.js';

export function renderPhoneSettings() {
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

export function settingsScreenHTML() {
    return `
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
      </div>`;
}

export function settingsHandleClick(t) {
    const wp = t.dataset && t.dataset.wp;
    if (wp) {
        if (wp === 'custom') { document.getElementById('pp-set-wp-file')?.click(); }
        else { getCfg().wallpaper = wp; saveCfg(); applyWallpaper(); renderPhoneSettings(); }
        return true;
    }
    switch (t.id) {
        case 'pp-help-botcall': ppHelpPopup('บอทโทรหา', 'เมื่อเปิด: ถ้าบอทตอบแล้วมีคำแนวจะโทร (โทรหา / เดี๋ยวโทร / calling you) แอปจะเปลี่ยนเป็นสายเรียกเข้าให้อัตโนมัติ<br><br>ใช้คีย์เวิร์ดจับ ไม่มี generation เพิ่ม ไม่กินโทเคน<br><br>ปิด = บอทไม่โทรเข้าเอง คุณยังกดโทรออกหาบอทได้ปกติ'); return true;
        case 'pp-help-universe': ppHelpPopup('บอท/NPC ทักข้ามแชท', 'เมื่อเปิด: ถ้าบอทที่คุยด้วย "เอ่ยชื่อ" คอนแทกต์อีกคนในคำตอบ คนนั้นจะทักเข้ามาเองตามมา — มีเหตุผลรองรับ ไม่โผล่ลอย ๆ ตัวละครไม่รู้จักกัน (ป้อนแค่บุคลิกคนที่ทัก)<br><br>ต้นทุน: ตอนมีคนทักเข้ามา = +1 generation (~input 300–700 โทเคน)<br><br>ปิด = แต่ละแชทแยกกัน'); return true;
        case 'pp-help-affectrp': ppHelpPopup('มีผลต่อโรลเพลย์หลัก', 'เมื่อเปิด: ดึงบทสนทนาโรลเพลย์หลัก 6-8 บรรทัดล่าสุดเข้า prompt เพื่อให้บอทในมือถือจำได้ว่าเกิดอะไรในบทหลัก + เวลาในแชทอิงเวลาจริง<br><br>ต้นทุน: +context ทุกข้อความ (~+100–300 โทเคน)<br><br>ปิด: ทุกอย่างอยู่แค่ในมือถือ อิงเวลาจริง'); return true;
    }
    return false;
}

export function settingsBindInputs() {
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
}
