const SUPABASE_URL = "https://ksknozrgkdfuldbvnzse.supabase.co";
const SUPABASE_KEY = "sb_publishable_uLq0UNKBQ2ZD6Gw_rCKKsQ_Oo39KWOF";   // คีย์สาธารณะ · สิทธิ์แอดมินตรวจฝั่งเซิร์ฟเวอร์ (RLS + ฟังก์ชัน)
// รับเซสชันต่อจากหน้าเกม (แอดมินกดปุ่มในเกม → ไม่ต้องล็อกอินซ้ำ)
const HANDOFF = (() => {
  const h = new URLSearchParams(location.hash.slice(1)), a = h.get("at"), r = h.get("rt");
  if (!a || !r) return null;
  history.replaceState(null, "", location.pathname + location.search);   // ลบโทเคนออกจาก URL ทันที
  return { a, r };
})();
// ใช้ที่เก็บการล็อกอินเดียวกับหน้าเกม (game.js: authStorage, storageKey "mantra-auth")
//   ติ๊ก "จดจำฉันไว้" ในเกม = localStorage → เปิด admin.html เมื่อไหร่ก็เข้าได้เลย (รีเฟรชได้)
//   ไม่ติ๊ก = sessionStorage ของแท็บ → แท็บที่เปิดจากปุ่มในเกมได้สำเนาไปด้วย
const AUTH_KEY = "mantra-auth";
const authRemember = (() => {
  try { const m = sessionStorage.getItem("mantra-auth-mode"); return m ? m === "remember" : !!localStorage.getItem(AUTH_KEY); } catch (e) { return false; }
})();
const authStore = () => authRemember ? localStorage : sessionStorage;
const authStorage = {
  getItem: k => { try { return authStore().getItem(k); } catch (e) { return null; } },
  setItem: (k, v) => { try { authStore().setItem(k, v); } catch (e) {} },
  removeItem: k => { try { authStore().removeItem(k); } catch (e) {} },
};
// มีเซสชันในเครื่องแล้ว → ใช้อันนั้น (แชร์กับหน้าเกม ไลบรารีจัดการต่ออายุโทเคนข้ามแท็บให้)
// ไม่มี แต่ได้โทเคนจากปุ่มในเกม (HANDOFF) → โหมดรับช่วง: ไม่บันทึกลงเครื่อง ไม่ต่ออายุเอง (กันชนโทเคนของหน้าเกม)
const USE_HANDOFF = !!HANDOFF && !authStorage.getItem(AUTH_KEY);
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, USE_HANDOFF
  ? { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  : { auth: { storage: authStorage, storageKey: AUTH_KEY } }) : null;
const signOutLocal = () => sb.auth.signOut({ scope: "local" });   // ออกแค่ในเครื่องนี้ ไม่ถีบอุปกรณ์อื่นหลุด
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = d => d ? new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "–";
function ago(d) {
  if (!d) return "ยังไม่เคย";
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "เมื่อกี้";
  if (s < 3600) return Math.floor(s / 60) + " นาทีที่แล้ว";
  if (s < 86400) return Math.floor(s / 3600) + " ชั่วโมงที่แล้ว";
  return Math.floor(s / 86400) + " วันที่แล้ว";
}
let toastT;
function toast(msg, err = false) {
  const t = $("toast"); t.textContent = msg; t.className = err ? "err" : ""; t.style.display = "block";
  clearTimeout(toastT); toastT = setTimeout(() => t.style.display = "none", 3000);
}
const errText = e => /forbidden/.test(e.message) ? "ไม่มีสิทธิ์แอดมิน" : /yourself/.test(e.message) ? "ลบบัญชีตัวเองไม่ได้" : e.message;

// ---------- เข้าสู่ระบบ ----------
let me = null;
async function doLogin() {
  const email = $("lgUser").value.trim().toLowerCase(), p = $("lgPass").value;
  if (!sb) return lgMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  if (!email || !p) return lgMsg("กรอกอีเมลและรหัสผ่าน");
  $("lgBtn").disabled = true; lgMsg("กำลังเข้าสู่ระบบ…", true);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: p });
  $("lgBtn").disabled = false;
  if (error) return lgMsg(/not confirmed/i.test(error.message) ? "บัญชียังไม่ได้ยืนยันอีเมล" : "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  enter(data.user);
}
const lgMsg = (m, ok = false) => { $("lgMsg").textContent = m; $("lgMsg").className = "msg" + (ok ? " ok" : ""); };
async function enter(user) {
  const { data: prof } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!prof || !prof.is_admin) {
    await signOutLocal();
    $("loginView").style.display = "flex"; $("appView").style.display = "none";
    return lgMsg("⛔ บัญชีนี้ไม่ใช่แอดมิน");
  }
  me = { id: user.id, username: prof.username };
  $("who").textContent = "👤 " + prof.username;
  $("loginView").style.display = "none"; $("appView").style.display = "block";
  loadUsers(); loadContent();
}
async function logout() { await signOutLocal(); me = null; location.reload(); }
for (const id of ["lgUser", "lgPass"]) $(id).addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });

// ---------- รายชื่อผู้เล่น ----------
let users = [];
async function loadUsers() {
  const { data, error } = await sb.rpc("admin_list_users");
  if (error) { $("rows").innerHTML = `<tr><td colspan="7" class="empty">โหลดไม่สำเร็จ: ${esc(errText(error))}</td></tr>`; return; }
  users = data || [];
  const today = new Date().toDateString();
  $("stUsers").textContent = users.length;
  $("stChars").textContent = users.reduce((s, u) => s + u.char_count, 0);
  $("stToday").textContent = users.filter(u => new Date(u.created_at).toDateString() === today).length;
  $("stBanned").textContent = users.filter(u => u.banned).length;
  renderUsers();
}
function renderUsers() {
  const q = $("search").value.trim().toLowerCase(), f = $("filter").value;
  const list = users.filter(u => (!q || u.username.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q))
    && (f === "all" || (f === "admin" && u.is_admin) || (f === "banned" && u.banned) || (f === "nochar" && !u.char_count)));
  $("rows").innerHTML = list.length ? list.map(u => `<tr>
      <td><span class="uname" onclick="openUser('${u.id}')">${esc(u.username)}</span>${u.id === me.id ? '<span class="badge you">คุณ</span>' : ""}${u.is_admin ? '<span class="badge admin">แอดมิน</span>' : ""}${u.banned ? '<span class="badge ban">แบน</span>' : ""}</td>
      <td class="muted">${esc(u.email || "–")}</td>
      <td class="muted">${fmtDate(u.created_at)}</td>
      <td class="muted" title="${esc(fmtDate(u.last_sign_in_at))}">${ago(u.last_sign_in_at)}</td>
      <td class="num">${u.char_count}/3</td>
      <td class="num">${u.max_lvl ?? "–"}</td>
      <td class="acts">
        <button class="btn sm" onclick="openUser('${u.id}')">จัดการ</button>
        ${u.id === me.id ? "" : `<button class="btn sm ${u.banned ? "green" : "red"}" onclick="toggleBan('${u.id}')">${u.banned ? "ปลดแบน" : "แบน"}</button>`}
      </td></tr>`).join("")
    : `<tr><td colspan="7" class="empty">${users.length ? "ไม่พบผู้เล่นที่ค้นหา" : "ยังไม่มีผู้สมัคร"}</td></tr>`;
}
const findUser = id => users.find(u => u.id === id);

// ---------- การจัดการบัญชี ----------
async function setProfile(id, patch, okMsg) {
  const { error } = await sb.from("profiles").update(patch).eq("id", id);
  if (error) return toast("ไม่สำเร็จ: " + errText(error), true);
  toast(okMsg);
  await loadUsers();
  if ($("detail").style.display === "flex") openUser(id);
}
function toggleBan(id) {
  const u = findUser(id);
  if (!u.banned && !confirm(`แบน "${u.username}"?\nผู้เล่นจะเข้าเกมและโหลดตัวละครไม่ได้จนกว่าจะปลดแบน`)) return;
  setProfile(id, { banned: !u.banned }, u.banned ? `ปลดแบน ${u.username} แล้ว` : `แบน ${u.username} แล้ว`);
}
function toggleAdmin(id) {
  const u = findUser(id);
  if (!confirm(u.is_admin ? `ถอดสิทธิ์แอดมินของ "${u.username}"?` : `ให้ "${u.username}" เป็นแอดมิน?\nเขาจะจัดการผู้เล่นทุกคนได้เหมือนคุณ`)) return;
  setProfile(id, { is_admin: !u.is_admin }, u.is_admin ? "ถอดสิทธิ์แอดมินแล้ว" : `${u.username} เป็นแอดมินแล้ว`);
}
async function deleteUser(id) {
  const u = findUser(id);
  const typed = prompt(`ลบบัญชี "${u.username}" ถาวร พร้อมตัวละครทั้งหมด (กู้คืนไม่ได้)\n\nพิมพ์ชื่อผู้ใช้เพื่อยืนยัน:`);
  if (typed === null) return;
  if (typed.trim() !== u.username) return toast("ชื่อไม่ตรง ยกเลิกการลบ", true);
  const { error } = await sb.rpc("admin_delete_user", { target: id });
  if (error) return toast("ลบไม่สำเร็จ: " + errText(error), true);
  closeModal("detail"); toast(`ลบบัญชี ${u.username} แล้ว`); loadUsers();
}
let pwTarget = null;
function openPassword(id) {
  pwTarget = id; $("pwFor").textContent = "บัญชี: " + findUser(id).username;
  $("pwNew").value = ""; $("pwMsg").textContent = ""; $("pwBox").style.display = "flex"; $("pwNew").focus();
}
async function savePassword() {
  const p = $("pwNew").value;
  if (p.length < 6) { $("pwMsg").textContent = "รหัสผ่านต้องมีอย่างน้อย 6 ตัว"; return; }
  const { error } = await sb.rpc("admin_set_password", { target: pwTarget, new_password: p });
  if (error) { $("pwMsg").textContent = "ไม่สำเร็จ: " + errText(error); return; }
  closeModal("pwBox"); toast("ตั้งรหัสผ่านใหม่แล้ว");
}
const closeModal = id => $(id).style.display = "none";
addEventListener("keydown", e => { if (e.key === "Escape") { closeModal("pwBox"); closeModal("detail"); } });

// ---------- รายละเอียดผู้เล่น + ตัวละคร ----------
const FIELDS = [["name", "ชื่อ", "text"], ["lvl", "Lv", "number"], ["exp", "EXP", "number"], ["zeny", "เบี้ย", "number"],
                ["points", "แต้มสถานะ", "number"], ["jobLvl", "Job Lv", "number"], ["skillPts", "แต้มวิชา", "number"]];
let chars = [];
async function openUser(id) {
  const u = findUser(id);
  if (!u) return;
  $("detailBody").innerHTML = `<div class="empty">กำลังโหลด…</div>`;
  $("detail").style.display = "flex";
  const { data, error } = await sb.from("characters").select("slot,data,updated_at").eq("user_id", id).order("slot");
  if (error) { $("detailBody").innerHTML = `<div class="empty">โหลดไม่สำเร็จ: ${esc(error.message)}</div>`; return; }
  chars = data || [];
  const self = id === me.id;
  let h = `<div class="modalHead"><h2>👤 ${esc(u.username)}${u.is_admin ? ' <span class="badge admin">แอดมิน</span>' : ""}${u.banned ? ' <span class="badge ban">แบน</span>' : ""}</h2>
      <button class="btn ghost sm" onclick="closeModal('detail')">✕</button></div>
    <div class="info">
      <div>อีเมล<br><b>${esc(u.email || "–")}</b></div>
      <div>สมัครเมื่อ<br><b>${fmtDate(u.created_at)}</b></div>
      <div>เข้าล่าสุด<br><b>${fmtDate(u.last_sign_in_at)}</b></div>
      <div>ตัวละคร<br><b>${u.char_count}/3</b></div>
      <div>รหัสผู้ใช้<br><b style="font-size:11px;font-weight:400">${u.id}</b></div>
    </div>
    <div class="userActs">
      <button class="btn" onclick="openPassword('${id}')">🔑 ตั้งรหัสผ่านใหม่</button>
      ${self ? "" : `<button class="btn ${u.banned ? "green" : "red"}" onclick="toggleBan('${id}')">${u.banned ? "✓ ปลดแบน" : "⛔ แบน"}</button>
      <button class="btn ghost" onclick="toggleAdmin('${id}')">${u.is_admin ? "ถอดสิทธิ์แอดมิน" : "⭐ ตั้งเป็นแอดมิน"}</button>
      <button class="btn red" onclick="deleteUser('${id}')">🗑 ลบบัญชี</button>`}
    </div>`;
  if (!chars.length) h += `<div class="empty">ผู้เล่นนี้ยังไม่มีตัวละคร</div>`;
  for (const c of chars) {
    const d = c.data || {};
    h += `<div class="char">
      <div class="charHead"><h3>ช่อง ${c.slot + 1} · ${esc(d.name)}</h3><span class="muted" style="font-size:12px">บันทึกล่าสุด ${ago(c.updated_at)}</span></div>
      <div class="fields">${FIELDS.map(([k, label, type]) => `<div><label>${label}</label><input id="f_${c.slot}_${k}" type="${type}" ${type === "number" ? 'min="0"' : 'maxlength="14"'} value="${esc(d[k] ?? "")}"></div>`).join("")}</div>
      <details><summary>แก้ไขข้อมูลทั้งหมด (JSON) — สำหรับผู้ชำนาญ</summary><textarea id="j_${c.slot}">${esc(JSON.stringify(d, null, 2))}</textarea></details>
      <div class="charActs">
        <button class="btn green" onclick="saveChar('${id}', ${c.slot})">💾 บันทึก</button>
        <button class="btn red" onclick="deleteChar('${id}', ${c.slot})">🗑 ลบตัวละคร</button>
      </div>
    </div>`;
  }
  h += `<div class="note">⚠ ถ้าผู้เล่นกำลังออนไลน์อยู่ เกมของเขาจะเซฟทับค่าที่แก้ภายในไม่กี่วินาที ควรแก้ตอนผู้เล่นออฟไลน์ หรือแบนชั่วคราวก่อน</div>`;
  $("detailBody").innerHTML = h;
}
async function saveChar(uid, slot) {
  const c = chars.find(x => x.slot === slot);
  let data;
  const raw = $("j_" + slot).value;
  const jsonChanged = raw !== JSON.stringify(c.data || {}, null, 2);
  try { data = JSON.parse(raw); } catch (e) { return toast("JSON ไม่ถูกต้อง: " + e.message, true); }
  if (!jsonChanged) for (const [k, , type] of FIELDS) {   // ใช้ค่าจากช่องกรอก (ถ้าไม่ได้แก้ JSON เอง)
    const v = $(`f_${slot}_${k}`).value;
    if (type === "number") { const n = Math.floor(Number(v)); if (!Number.isFinite(n) || n < 0) return toast(`ค่า ${k} ไม่ถูกต้อง`, true); data[k] = n; }
    else { const s = v.trim(); if (s.length < 2 || /[<>"'&]/.test(s)) return toast("ชื่อตัวละครต้องยาว 2–14 ตัว และห้ามมีอักขระพิเศษ", true); data[k] = s; }
  }
  const { error } = await sb.from("characters").update({ data, updated_at: new Date().toISOString() }).eq("user_id", uid).eq("slot", slot);
  if (error) return toast("บันทึกไม่สำเร็จ: " + errText(error), true);
  toast("บันทึกตัวละครแล้ว"); await loadUsers(); openUser(uid);
}
async function deleteChar(uid, slot) {
  const c = chars.find(x => x.slot === slot);
  if (!confirm(`ลบตัวละคร "${c.data && c.data.name}" (Lv ${c.data && c.data.lvl}) ถาวร?`)) return;
  const { error } = await sb.from("characters").delete().eq("user_id", uid).eq("slot", slot);
  if (error) return toast("ลบไม่สำเร็จ: " + errText(error), true);
  toast("ลบตัวละครแล้ว"); await loadUsers(); openUser(uid);
}

// =====================================================================
//  แก้ไขข้อมูลเกม: ไอเท็ม / มอนสเตอร์ / แผนที่ (ตาราง game_content)
// =====================================================================
// ข้อมูลเดิมในเกม (ใช้อ้างอิง เลือกเป็นของดรอป / มอนในแผนที่ / วางทางเข้า)
// ข้อมูลเดิมในเกม (ค่าตั้งต้นก่อนแอดมินแก้) — แก้/ลบได้ ระบบจะเก็บเป็น "ค่าทับ" ในฐานข้อมูล
const BUILTIN = {"items":{"red":{"name":"ยาสมุนไพร","icon":"🍵","type":"use","hp":60,"price":50,"desc":"ฟื้นฟู HP 60","shop":true},"orange":{"name":"ยาหอมอินทรจักร","icon":"🏺","type":"use","hp":180,"price":200,"desc":"ฟื้นฟู HP 180","shop":true},"blue":{"name":"น้ำมะพร้าว","icon":"🥥","type":"use","sp":40,"price":350,"desc":"ฟื้นฟู SP 40","shop":true},"banana":{"name":"กล้วยน้ำว้า","icon":"🍌","type":"use","hp":30,"price":20,"desc":"ฟื้นฟู HP 30","shop":true},"amulet":{"name":"ซองพระป่า","icon":"🧧","type":"use","price":3000,"desc":"นำไปถวายหลวงพ่อทองในเมือง เพื่อล้างแต้มสถานะทั้งหมดแล้วแจกใหม่","shop":true},"incense":{"name":"ธูปเทียนแพ","icon":"🪔","type":"use","price":5000,"desc":"นำไปไหว้หลวงพ่อทองในเมือง เพื่อล้างแต้มสถานะทั้งหมดแล้วแจกใหม่","shop":true},"pigfang":{"name":"เขี้ยวหมูป่า","icon":"🦷","type":"etc","price":14,"desc":"ของป่า ขายได้","shop":false},"feather":{"name":"ขนไก่ชน","icon":"🪶","type":"etc","price":30,"desc":"ของป่า ขายได้","shop":false},"fur":{"name":"ขนลิงกัง","icon":"🧶","type":"etc","price":60,"desc":"ของป่า ขายได้","shop":false},"skin":{"name":"หนังงูเห่า","icon":"🐍","type":"etc","price":90,"desc":"ของป่า ขายได้","shop":false},"orb":{"name":"ดวงไฟกระสือ","icon":"🔮","type":"etc","price":140,"desc":"ของอาถรรพ์ ขายได้ราคาดี","shop":false},"scale":{"name":"เกล็ดพญานาค","icon":"🐉","type":"etc","price":6000,"desc":"ของล้ำค่าจากพญานาค","shop":false},"dagger":{"name":"มีดหมอ","icon":"🔪","type":"weapon","wtype":"dagger","draw":"dagger","atk":10,"price":300,"desc":"มีดคู่กายของหมอผี","grade":1,"shop":true},"machete":{"name":"มีดเหน็บ","icon":"🔪","type":"weapon","wtype":"dagger","draw":"dagger","atk":18,"crit":3,"price":1200,"desc":"มีดพกของนักเดินป่า คริติคอล +3%","grade":2,"shop":true},"ironsword":{"name":"ดาบเหล็กดำ","icon":"⚔️","type":"weapon","wtype":"sword","draw":"sword","atk":15,"price":600,"desc":"ดาบฝึกหัดตีจากเหล็กธรรมดา","grade":1,"shop":true},"twinsword":{"name":"ดาบฟ้าฟื้น","icon":"⚔️","type":"weapon","wtype":"sword","draw":"namphi","atk":37,"price":3600,"desc":"ดาบคมกริบที่ช่างเหล็กภูมิใจ","grade":3,"shop":true},"bamboospear":{"name":"หอกไม้ไผ่","icon":"🔱","type":"weapon","wtype":"spear","draw":"spear","atk":20,"price":900,"desc":"หอกเหลาจากไผ่ตง เบาแต่ยาว","grade":1,"shop":true},"silverspear":{"name":"ทวนเงิน","icon":"🔱","type":"weapon","wtype":"spear","draw":"spear","atk":45,"price":4300,"desc":"ทวนหุ้มเงิน แทงหนักหน่วง","grade":3,"shop":true},"rattanbow":{"name":"ธนูหวาย","icon":"🏹","type":"weapon","wtype":"bow","draw":"bow","atk":26,"price":1800,"desc":"ธนูหวายเหนียว ยิงแม่นขึ้น","grade":2,"shop":true},"stonebeads":{"name":"ประคำหินสี","icon":"📿","type":"weapon","wtype":"beads","draw":"beads","atk":20,"stats":{"int":2},"price":1600,"desc":"ประคำหินมงคลเจ็ดสี","grade":2,"shop":true},"kris":{"name":"กริชคดห้าคด","icon":"🗡️","type":"weapon","wtype":"dagger","draw":"kris","atk":26,"crit":6,"price":2600,"desc":"กริชอาคม คริติคอล +6%","grade":3,"shop":true},"sword":{"name":"ดาบไทย","icon":"⚔️","type":"weapon","wtype":"sword","draw":"sword","atk":25,"price":1500,"desc":"ดาบคู่กายทหารสยาม","grade":2,"shop":true},"namphi":{"name":"ดาบเหล็กน้ำพี้","icon":"⚔️","type":"weapon","wtype":"sword","draw":"namphi","atk":48,"price":5800,"desc":"เหล็กเนื้อดีจากบ่อพระแสง","grade":4,"shop":false},"spear":{"name":"ทวนเหล็ก","icon":"🔱","type":"weapon","wtype":"spear","draw":"spear","atk":32,"price":2400,"desc":"ทวนด้ามยาว แทงได้ไกล","grade":2,"shop":true},"glaive":{"name":"ง้าวนาคราช","icon":"🔱","type":"weapon","wtype":"spear","draw":"glaive","atk":62,"price":8000,"desc":"ง้าวในตำนาน ดรอปจากพญานาค","grade":5,"shop":false},"bamboobow":{"name":"ธนูไม้ไผ่","icon":"🏹","type":"weapon","wtype":"bow","draw":"bow","atk":16,"price":700,"desc":"ธนูเบา ๆ สำหรับนักล่า","grade":1,"shop":true},"hornbow":{"name":"ธนูเขาควาย","icon":"🏹","type":"weapon","wtype":"bow","draw":"hornbow","atk":38,"price":4500,"desc":"ธนูแรงดึงสูง ยิงทะลุเกราะ","grade":3,"shop":true},"woodbeads":{"name":"ประคำไม้จันทน์","icon":"📿","type":"weapon","wtype":"beads","draw":"beads","atk":12,"stats":{"int":1},"price":650,"desc":"ประคำสวดมนต์ เสริมพลังเวท","grade":1,"shop":true},"bodhibeads":{"name":"ประคำเม็ดโพธิ์","icon":"📿","type":"weapon","wtype":"beads","draw":"bodhibeads","atk":30,"stats":{"int":3},"price":3800,"desc":"ปลุกเสกจากวัดโบราณ","grade":3,"shop":true},"nagabeads":{"name":"ประคำนาคราช","icon":"📿","type":"weapon","wtype":"beads","draw":"nagabeads","atk":60,"stats":{"int":5,"luk":2},"price":9000,"desc":"ประคำในตำนาน ดรอปจากพญานาค","grade":5,"shop":false},"cloth":{"name":"เสื้อยันต์","icon":"📜","type":"armor","def":4,"price":400,"desc":"เกราะ DEF +4 · ลงอักขระคุ้มกาย","grade":1,"style":"cloth","shop":true},"chain":{"name":"เกราะหนังควาย","icon":"🥋","type":"armor","def":10,"price":2500,"desc":"เกราะหนังหนา กันคมดาบ","grade":2,"style":"chain","shop":true},"wrap":{"name":"ผ้าโพกหัว","icon":"👳","type":"head","draw":"wrap","def":2,"price":300,"desc":"ผ้าโพกกันแดด","grade":1,"shop":true},"helm":{"name":"ลอมพอกทหาร","icon":"🪖","type":"head","draw":"lompok","def":5,"stats":{"vit":2},"price":2200,"desc":"หมวกทรงสูงของทหารสยาม","grade":3,"shop":true},"pakama":{"name":"ผ้าขาวม้า","icon":"🧣","type":"cape","def":1,"stats":{"agi":2},"price":350,"desc":"ผ้าอเนกประสงค์ พาดไหล่","grade":1,"color":"#c92a2a","shop":true},"peacock":{"name":"ผ้าคลุมขนนกยูง","icon":"🦚","type":"cape","def":3,"stats":{"agi":4,"dex":2},"price":2600,"desc":"ผ้าคลุมปักขนนกยูงสีเขียวมรกต","grade":4,"color":"#1f6f78","shop":false},"dang":{"name":"ดั้งหนัง","icon":"🛡️","type":"shield","def":4,"price":700,"desc":"โล่หนังของทหารราบ (ใช้กับอาวุธมือเดียว)","grade":2,"color":"#8a5a32","shop":true},"khen":{"name":"เขนทองเหลือง","icon":"🛡️","type":"shield","def":9,"stats":{"vit":2},"price":3200,"desc":"โล่ทองเหลืองลายกนก (ใช้กับอาวุธมือเดียว)","grade":3,"color":"#c9a227","shop":true},"silkpants":{"name":"โจงกระเบนไหม","icon":"👖","type":"pants","def":2,"price":400,"desc":"ผ้าไหมเนื้อดี คล่องตัว","grade":2,"color":"#6b2a8a","shop":true},"sanab":{"name":"สนับเพลาทหาร","icon":"👖","type":"pants","def":5,"stats":{"agi":1},"price":2100,"desc":"กางเกงทหารปักดิ้นทอง","grade":3,"color":"#1f2a44","shop":false},"sandal":{"name":"รองเท้าหนังควาย","icon":"👢","type":"boots","def":2,"stats":{"agi":1},"price":450,"desc":"เดินป่าได้ทั้งวัน","grade":2,"shop":true},"warboots":{"name":"รองเท้าขุนศึก","icon":"👢","type":"boots","def":4,"stats":{"agi":3},"price":2400,"desc":"รองเท้าของแม่ทัพ","grade":4,"shop":false},"takrut":{"name":"แหวนพิรอด","icon":"💍","type":"ring","stats":{"luk":3},"price":900,"desc":"แหวนถักเชือกลงอาคม คุ้มภัย","grade":2,"shop":true},"nagaamulet":{"name":"แหวนนาคปรก","icon":"💍","type":"ring","def":3,"stats":{"str":4,"vit":4,"luk":2},"price":9000,"desc":"แหวนศักดิ์สิทธิ์ ดรอปจากพญานาค","grade":5,"shop":false},"silverring":{"name":"แหวนเงิน","icon":"💍","type":"ring","stats":{"dex":2},"price":600,"desc":"แหวนเงินเกลี้ยง","grade":2,"shop":true},"nopphakao":{"name":"แหวนนพเก้า","icon":"💍","type":"ring","stats":{"str":2,"agi":2,"vit":2,"int":2,"dex":2,"luk":2},"price":8000,"desc":"อัญมณีเก้าชนิด มงคลสูงสุด","grade":5,"shop":false},"brassear":{"name":"แหวนทองเหลือง","icon":"💍","type":"ring","stats":{"int":2},"price":450,"desc":"แหวนเรียบง่าย เสริมสมาธิ","grade":2,"shop":true},"emeraldear":{"name":"แหวนมรกต","icon":"💍","type":"ring","stats":{"int":3,"luk":2},"price":2000,"desc":"มรกตเม็ดงาม","grade":3,"shop":true}},"mobs":{"pig":{"name":"หมูป่าน้อย","lvl":1,"hp":40,"def":0,"flee":2,"exp":10,"speed":55,"aggro":false,"r":14,"aspd":1600,"respawn":8,"drops":[["pigfang",0.65],["banana",0.25],["red",0.08]],"atkMin":3,"atkMax":6,"zenyMin":1,"zenyMax":5},"rooster":{"name":"ไก่ชน","lvl":3,"hp":85,"def":2,"flee":10,"exp":22,"speed":70,"aggro":false,"r":13,"aspd":1300,"respawn":10,"drops":[["feather",0.6],["banana",0.2],["red",0.12],["cloth",0.02],["bamboobow",0.02],["sandal",0.02],["wrap",0.02]],"atkMin":7,"atkMax":11,"zenyMin":3,"zenyMax":10},"monkey":{"name":"ลิงกัง","lvl":6,"hp":180,"def":4,"flee":22,"exp":55,"speed":90,"aggro":true,"r":15,"aspd":1200,"respawn":12,"drops":[["fur",0.55],["banana",0.4],["blue",0.05],["dagger",0.03],["bamboobow",0.02],["pakama",0.02],["woodbeads",0.02],["book_point",0.006]],"atkMin":14,"atkMax":20,"zenyMin":8,"zenyMax":20},"cobra":{"name":"งูเห่า","lvl":8,"hp":240,"def":6,"flee":18,"exp":80,"speed":60,"aggro":true,"r":15,"aspd":1400,"respawn":12,"drops":[["skin",0.5],["orange",0.08],["spear",0.015],["kris",0.008],["silverring",0.015],["brassear",0.015],["book_shadow",0.003],["book_point",0.008]],"atkMin":20,"atkMax":28,"zenyMin":10,"zenyMax":25},"kraseu":{"name":"ผีกระสือ","lvl":12,"hp":420,"def":10,"flee":35,"exp":150,"speed":110,"aggro":true,"r":16,"aspd":1100,"respawn":15,"drops":[["orb",0.5],["orange",0.15],["sword",0.02],["kris",0.015],["namphi",0.008],["chain",0.01],["takrut",0.02],["helm",0.01],["peacock",0.008],["sanab",0.008],["nopphakao",0.003],["bodhibeads",0.012],["book_endure",0.006],["book_storm",0.004],["book_sharp",0.004],["book_magnus",0.004],["book_tycoon",0.004],["book_point",0.012]],"atkMin":30,"atkMax":42,"zenyMin":20,"zenyMax":50},"naga":{"name":"พญานาค","lvl":20,"hp":4500,"def":20,"flee":30,"exp":3000,"speed":60,"aggro":true,"r":40,"aspd":1400,"respawn":120,"boss":true,"drops":[["scale",1],["blue",0.8],["glaive",0.3],["hornbow",0.15],["namphi",0.15],["nagaamulet",0.3],["nopphakao",0.1],["khen",0.2],["warboots",0.2],["nagabeads",0.25],["book_endure",0.25],["book_storm",0.25],["book_sharp",0.25],["book_magnus",0.25],["book_shadow",0.25],["book_tycoon",0.25],["book_point",0.5]],"atkMin":50,"atkMax":80,"zenyMin":800,"zenyMax":1500}}};
// มอน + วัตถุดิบหุบเขาหมอก (ตรงกับในเกม)
Object.assign(BUILTIN.items, {"dholefang":{"name":"เขี้ยวหมาใน","icon":"🦴","type":"etc","price":160,"desc":"ของป่าจากหุบเขาหมอก ขายได้","shop":false},"antler":{"name":"เขาเก้งหมอก","icon":"🦌","type":"etc","price":180,"desc":"เขาเรืองแสงจาง ๆ ขายได้","shop":false},"owlfeather":{"name":"ขนนกแสก","icon":"🪶","type":"etc","price":190,"desc":"ขนนกลางร้าย ขายได้","shop":false},"spore":{"name":"สปอร์เห็ดเรือง","icon":"🍄","type":"etc","price":200,"desc":"ผงเรืองแสงสีม่วง ขายได้","shop":false},"ghosthair":{"name":"ผมผีกองกอย","icon":"🧵","type":"etc","price":230,"desc":"ของอาถรรพ์ ขายได้","shop":false},"centishell":{"name":"เปลือกตะขาบ","icon":"🐛","type":"etc","price":240,"desc":"เปลือกแข็งสีแดง ขายได้","shop":false},"sting":{"name":"เหล็กในแมงป่อง","icon":"🦂","type":"etc","price":260,"desc":"มีพิษ ระวังมือ ขายได้","shop":false},"bearfur":{"name":"ขนหมีควาย","icon":"🐻","type":"etc","price":280,"desc":"ขนหนานุ่ม ขายได้","shop":false},"pobskull":{"name":"กะโหลกผีปอบ","icon":"💀","type":"etc","price":320,"desc":"ของอาถรรพ์ ขายได้ราคาดี","shop":false},"tigerskin":{"name":"หนังเสือสมิง","icon":"🐅","type":"etc","price":380,"desc":"หนังเสือลายงาม ขายได้ราคาดี","shop":false},"yakfang":{"name":"เขี้ยวยักษ์","icon":"👹","type":"etc","price":9000,"desc":"ของล้ำค่าจากยักษ์กุมภัณฑ์","shop":false}});
Object.assign(BUILTIN.mobs, {"dhole":{"name":"หมาใน","lvl":14,"hp":560,"def":12,"flee":30,"exp":190,"speed":105,"aggro":true,"r":14,"aspd":1100,"respawn":14,"drops":[["dholefang",0.55],["orange",0.12],["machete",0.02],["mid_c",0.006],["rong_c",0.006]],"atkMin":34,"atkMax":46,"zenyMin":22,"zenyMax":55},"deer":{"name":"เก้งหมอก","lvl":15,"hp":620,"def":10,"flee":45,"exp":210,"speed":95,"aggro":false,"r":14,"aspd":1300,"respawn":14,"drops":[["antler",0.5],["banana",0.3],["blue",0.06],["phran_c",0.006],["peacock",0.004]],"atkMin":30,"atkMax":40,"zenyMin":20,"zenyMax":50},"owl":{"name":"นกแสกผี","lvl":15,"hp":520,"def":8,"flee":55,"exp":215,"speed":120,"aggro":true,"r":13,"aspd":1000,"respawn":15,"drops":[["owlfeather",0.55],["blue",0.08],["naamai_c",0.006],["phaa_c",0.006],["emeraldear",0.01]],"atkMin":36,"atkMax":48,"zenyMin":24,"zenyMax":56},"shroom":{"name":"เห็ดผีเรือง","lvl":16,"hp":760,"def":16,"flee":20,"exp":240,"speed":55,"aggro":false,"r":13,"aspd":1500,"respawn":14,"drops":[["spore",0.55],["orange",0.15],["blue",0.08],["mon_c",0.006],["pho_c",0.006]],"atkMin":38,"atkMax":50,"zenyMin":26,"zenyMax":60},"kongkoi":{"name":"ผีกองกอย","lvl":17,"hp":820,"def":14,"flee":40,"exp":275,"speed":110,"aggro":true,"r":13,"aspd":1100,"respawn":15,"drops":[["ghosthair",0.5],["orange",0.12],["krit_c",0.006],["kang_c",0.006],["takrut",0.02]],"atkMin":44,"atkMax":58,"zenyMin":30,"zenyMax":70},"centipede":{"name":"ตะขาบยักษ์","lvl":18,"hp":980,"def":20,"flee":28,"exp":310,"speed":80,"aggro":true,"r":16,"aspd":1200,"respawn":15,"drops":[["centishell",0.5],["orange",0.15],["ngao_c",0.006],["kraw_c",0.006],["sanab",0.01]],"atkMin":48,"atkMax":62,"zenyMin":32,"zenyMax":76},"scorpion":{"name":"แมงป่องช้าง","lvl":19,"hp":1100,"def":26,"flee":24,"exp":345,"speed":70,"aggro":true,"r":16,"aspd":1400,"respawn":16,"drops":[["sting",0.5],["orange",0.15],["nak_c",0.006],["kan_c",0.006],["khen",0.01]],"atkMin":52,"atkMax":68,"zenyMin":34,"zenyMax":80},"bear":{"name":"หมีควาย","lvl":20,"hp":1500,"def":24,"flee":18,"exp":400,"speed":75,"aggro":false,"r":18,"aspd":1600,"respawn":18,"drops":[["bearfur",0.5],["orange",0.2],["khan_c",0.006],["chang_c",0.006],["chain",0.015]],"atkMin":58,"atkMax":76,"zenyMin":40,"zenyMax":95},"pob":{"name":"ผีปอบ","lvl":21,"hp":1300,"def":18,"flee":42,"exp":430,"speed":95,"aggro":true,"r":14,"aspd":1150,"respawn":16,"drops":[["pobskull",0.5],["blue",0.1],["mongkol_c",0.006],["khon_c",0.006],["waen_c",0.006]],"atkMin":62,"atkMax":80,"zenyMin":45,"zenyMax":100},"tiger":{"name":"เสือสมิง","lvl":22,"hp":1600,"def":22,"flee":50,"exp":480,"speed":120,"aggro":true,"r":18,"aspd":1100,"respawn":18,"drops":[["tigerskin",0.45],["blue",0.1],["khan_b",0.003],["phran_b",0.003],["mid_b",0.003],["warboots",0.008]],"atkMin":66,"atkMax":86,"zenyMin":50,"zenyMax":110},"yak":{"name":"ยักษ์กุมภัณฑ์","lvl":28,"hp":12000,"def":32,"flee":35,"exp":9000,"speed":65,"aggro":true,"r":30,"aspd":1600,"respawn":180,"boss":true,"drops":[["yakfang",1],["scale",0.3],["blue",0.8],["tigerskin",0.6],["namphi",0.2],["nopphakao",0.15],["peacock",0.2],["warboots",0.2],["khan_b",0.08],["ngao_b",0.08],["mon_b",0.08],["phran_b",0.08],["pho_b",0.08],["krit_b",0.08],["chang_b",0.08],["kraw_b",0.08]],"atkMin":90,"atkMax":130,"zenyMin":2000,"zenyMax":3500}});
// สูตรคราฟเดิมที่ช่างเหล็ก (ตรงกับในเกม)
const BUILTIN_RECIPES = { sword: { mats: [["fur", 5], ["skin", 2]], zeny: 500 }, kris: { mats: [["skin", 6], ["orb", 3]], zeny: 1200 }, silverspear: { mats: [["skin", 8], ["orb", 2]], zeny: 1500 },
  hornbow: { mats: [["fur", 10], ["feather", 10], ["orb", 2]], zeny: 1800 }, bodhibeads: { mats: [["orb", 5], ["pigfang", 10]], zeny: 1500 }, chain: { mats: [["fur", 8], ["skin", 4]], zeny: 900 },
  helm: { mats: [["skin", 6], ["orb", 2]], zeny: 1200 }, namphi: { mats: [["orb", 15], ["scale", 1]], zeny: 5000 }, peacock: { mats: [["feather", 30], ["orb", 10]], zeny: 4000 },
  glaive: { mats: [["scale", 3], ["orb", 20]], zeny: 12000 }, nagabeads: { mats: [["scale", 3], ["orb", 15]], zeny: 12000 },
  cloth: { mats: [["feather", 4], ["pigfang", 4]], zeny: 200 }, wrap: { mats: [["feather", 3]], zeny: 150 }, pakama: { mats: [["feather", 4], ["fur", 2]], zeny: 200 },
  silkpants: { mats: [["fur", 4], ["feather", 4]], zeny: 250 }, sandal: { mats: [["skin", 2], ["pigfang", 4]], zeny: 250 }, sanab: { mats: [["skin", 6], ["fur", 6]], zeny: 1200 },
  warboots: { mats: [["skin", 10], ["orb", 6]], zeny: 3000 }, silverring: { mats: [["pigfang", 6], ["skin", 1]], zeny: 400 }, brassear: { mats: [["pigfang", 5], ["feather", 3]], zeny: 300 },
  takrut: { mats: [["fur", 5], ["skin", 2]], zeny: 600 }, emeraldear: { mats: [["orb", 4], ["skin", 4]], zeny: 1500 }, nopphakao: { mats: [["orb", 25], ["scale", 1]], zeny: 8000 },
  nagaamulet: { mats: [["scale", 3], ["orb", 10]], zeny: 10000 } };
for (const [id, r] of Object.entries(BUILTIN_RECIPES)) BUILTIN.items[id].recipe = r;
const BOOKS = [["book_endure","คัมภีร์กายวชิระ"],["book_storm","คัมภีร์พายุหิมะ"],["book_sharp","คัมภีร์ศรมรณะ"],["book_magnus","คัมภีร์แสงพระธรรม"],["book_shadow","คัมภีร์เงามรณะ"],["book_tycoon","คัมภีร์มหาเศรษฐี"],["book_point","ตำราฝึกวิชา"]];
const BUILTIN_ITEMS = [...Object.entries(BUILTIN.items).map(([id, d]) => [id, d.name, d.type, d.grade || 0, d.icon]), ...BOOKS.map(([id, n]) => [id, n, "book", 0, "📜"])];
const BUILTIN_MOBS = Object.entries(BUILTIN.mobs).map(([id, d]) => [id, d.name, d.lvl]);
const BUILTIN_MAPS = {
  main: { name: "เมืองมนตรา", shapes: [{"rect":[0,0,668,588]},{"x":990,"y":720,"rx":360,"ry":560,"ph":1},{"x":330,"y":930,"rx":300,"ry":330,"ph":2},{"x":1660,"y":430,"rx":330,"ry":360,"ph":3},{"x":680,"y":1600,"rx":580,"ry":250,"ph":4},{"x":2280,"y":700,"rx":250,"ry":660,"ph":5},{"x":1660,"y":1180,"rx":310,"ry":220,"ph":6},{"x":2250,"y":1690,"rx":320,"ry":230,"ph":7},{"path":[[640,290],[1300,300],[2000,340],[2380,720]],"w":160},{"path":[[330,560],[330,1200],[720,1520],[1300,1620],[1950,1650],[2160,1630]],"w":160},{"path":[[1250,820],[1480,1060],[1700,1180],[2100,1080]],"w":120},{"path":[[1300,1520],[1560,1330]],"w":110}] },
  valley: { name: "หุบเขาหมอก", shapes: [{"x":300,"y":960,"rx":260,"ry":240,"ph":1},{"x":900,"y":520,"rx":320,"ry":270,"ph":2},{"x":1400,"y":950,"rx":340,"ry":290,"ph":3},{"x":1520,"y":1500,"rx":360,"ry":280,"ph":4},{"x":2020,"y":860,"rx":240,"ry":210,"ph":5},{"x":2200,"y":400,"rx":330,"ry":290,"ph":6},{"path":[[260,960],[600,700],[900,520],[1250,580],[1400,930],[1200,1250],[1520,1520],[1900,1460],[2180,1120],[2020,700],[2240,380]],"w":250},{"path":[[1400,930],[1980,860]],"w":180}] },
};
const GRADES = { 1: ["D", "#c9c2b8"], 2: ["C", "#5fdc6a"], 3: ["B", "#4da3ff"], 4: ["A", "#c77dff"], 5: ["S", "#ffc53d"] };
const ITEM_TYPES = { weapon: "อาวุธ", armor: "เสื้อเกราะ", head: "หมวก", cape: "ผ้าคลุม", shield: "โล่", pants: "กางเกง", boots: "รองเท้า", ring: "แหวน", use: "ยา / อาหาร", etc: "ของป่า (ไว้ขาย)" };
const WTYPE_NAMES = { dagger: "มีด", sword: "ดาบ", spear: "ทวน/ง้าว (สองมือ)", bow: "ธนู (สองมือ)", beads: "ประคำ (สายเวท)" };
// แบบแรกของแต่ละประเภท = หน้าตามาตรฐานของประเภทนั้น (เลือกให้อัตโนมัติเมื่อเปลี่ยนประเภท)
const WEAPON_LOOKS = { dagger: [["dagger", "มีด"], ["kris", "กริช"]], sword: [["sword", "ดาบ"], ["namphi", "ดาบยาว"]], spear: [["spear", "ทวน"], ["glaive", "ง้าว"]], bow: [["bow", "ธนู"], ["hornbow", "ธนูเขาควาย"], ["crossbow", "หน้าไม้"]], beads: [["beads", "ประคำ"], ["bodhibeads", "ประคำโพธิ์"], ["nagabeads", "ประคำนาค"]] };
const MOB_LOOKS = { pig: "🐗 หมูป่า", rooster: "🐓 ไก่ชน", monkey: "🐒 ลิง", cobra: "🐍 งู", kraseu: "👻 กระสือ", naga: "🐉 พญานาค",
  dhole: "🐕 หมาใน", deer: "🦌 เก้ง", owl: "🦉 นกแสก", shroom: "🍄 เห็ดผี", kongkoi: "👣 ผีกองกอย", centipede: "🐛 ตะขาบ", scorpion: "🦂 แมงป่อง", bear: "🐻 หมีควาย", pob: "🧟 ผีปอบ", tiger: "🐅 เสือสมิง", yak: "👹 ยักษ์" };
const THEME_NAMES = { meadow: "🌾 ทุ่งหญ้า", forest: "🌳 ป่าทึบ", bamboo: "🎋 ป่าไผ่", mist: "🌫️ หุบเขาหมอก", swamp: "🪦 บึงผีสิง", desert: "🏜️ ทะเลทราย" };
const STATS = ["str", "int", "agi", "dex", "vit", "luk"];   // เรียงตามหน้าเกม
// ออปชั่นพิเศษของอุปกรณ์ (item.opts) · [รหัส, ชื่อ, เป็น %]
const OPT_DEFS = [["spd", "Move speed", 0], ["spdPct", "Move speed", 1], ["aspd", "Attack speed", 0], ["aspdPct", "Attack speed", 1],
  ["def", "Def", 0], ["defPct", "Def", 1], ["atk", "ATK", 0], ["atkPct", "ATK", 1], ["matk", "MATK", 0], ["matkPct", "MATK", 1],
  ["ignDef", "Ignore Def", 1], ["ignMdef", "Ignore MDef", 1], ["critDmg", "Crit damage", 1]];
const content = { item: {}, mob: {}, map: {}, skill: {} };
let contentOk = true;

async function loadContent() {
  const { data, error } = await sb.from("game_content").select("kind,id,data,updated_at");
  if (error) {
    contentOk = false;
    $("contentWarn").style.display = "block";
    $("contentWarn").innerHTML = /does not exist|schema cache/i.test(error.message)
      ? "⚠ ยังไม่ได้สร้างตารางเก็บข้อมูลเกม · เปิด Supabase → SQL Editor แล้วรันไฟล์ <b>rpg/supabase/content.sql</b> ก่อน จึงจะเพิ่มไอเท็ม/มอน/แผนที่ได้"
      : "⚠ โหลดข้อมูลเกมไม่สำเร็จ: " + esc(error.message);
  } else {
    contentOk = true; $("contentWarn").style.display = "none";
    content.item = {}; content.mob = {}; content.map = {}; content.skill = {};
    for (const r of data) if (content[r.kind]) content[r.kind][r.id] = r.data;
    gameSettings = content.map.game_settings || {}; delete content.map.game_settings;   // ค่าตั้งเกม (ไม่ใช่แผนที่)
  }
  renderItemList(); renderMobList(); renderMapList(); renderSkillList();
}
function refreshAll() { loadUsers(); loadContent(); }
// ---------- ตั้งค่าเกม (ราคาขยายย่าม ฯลฯ) · เก็บใน game_content kind=map id=game_settings ----------
let gameSettings = {};
const SETTING_FIELDS = [
  ["bagBase", "ช่องย่ามเริ่มต้น", 30], ["bagLimit", "ช่องย่ามสูงสุด", 80], ["bagStep", "ขยายครั้งละ (ช่อง)", 5],
  ["bagPrice", "ราคาขยายครั้งแรก (เบี้ย)", 3000], ["bagPriceStep", "ราคาเพิ่มต่อครั้ง (เบี้ย)", 3000],
  ["skillReset", "ค่าล้างแต้มวิชาที่หมอผี (เบี้ย)", 3000],
];
// เพดานผู้เล่น: เลเวลสูงสุด + สเตตัสฐานสูงสุดแต่ละตัว (ไม่นับโบนัสจากอุปกรณ์/วิชา)
const CAP_FIELDS = [
  ["maxLevel", "เลเวลสูงสุด", 200], ["max_str", "STR สูงสุด", 99], ["max_int", "INT สูงสุด", 99],
  ["max_agi", "AGI สูงสุด", 99], ["max_dex", "DEX สูงสุด", 99], ["max_vit", "VIT สูงสุด", 99], ["max_luk", "LUK สูงสุด", 99],
];
// สมดุลเกม: ตัวคูณรวม (1 = ตามค่าในตารางมอน) · ค่าเริ่มต้นตรงกับใน index.html
const BAL_FIELDS = [
  ["expRate", "EXP ที่ได้ (เท่า)", 0.8, 0.05, 20], ["dropRate", "อัตราดรอปของทั่วไป (เท่า)", 0.65, 0, 20],
  ["rareDropRate", "อัตราดรอปของหายาก ≤5% (เท่า)", 0.5, 0, 20], ["zenyRate", "เบี้ยจากมอน (เท่า)", 0.75, 0, 20],
  ["mobHp", "HP มอนสเตอร์ (เท่า)", 1.4, 0.1, 20], ["mobAtk", "ATK มอนสเตอร์ (เท่า)", 1.2, 0.1, 20],
  ["respawn", "เวลามอนเกิดใหม่ (เท่า)", 1.5, 0.1, 20], ["statPts", "แต้มสถานะต่อเลเวล", 3, 0, 50],
  ["noEquipLvl", "มอนเลเวลไม่เกินนี้ไม่ดรอปอุปกรณ์ (0 = ปิด)", 8, 0, 999],
];
// ค่าที่ได้ต่อสเตตัส 1 แต้ม (ต้องตรงกับ STAT_FX / STAT_RATE_DEFAULT ใน game.js) · เช่น STR: ATK 3 · HP 17
const STAT_FX = [["atk", "ATK ประชิด"], ["ratk", "ATK ธนู"], ["matk", "ATK เวท"], ["def", "DEF"], ["hp", "HP"], ["sp", "SP"],
  ["hit", "แม่นยำ"], ["flee", "หลบหลีก"], ["crit", "คริ %"], ["critDmg", "แรงคริ %"], ["aspd", "ตีเร็ว (ms)"], ["speed", "เดินเร็ว"]];
const STAT_RATE_DEFAULT = { str: { atk: 2, ratk: 0.25 }, int: { matk: 2, sp: 6 }, agi: { flee: 2, aspd: 12, speed: 0.8 },
  dex: { atk: 0.25, ratk: 2, matk: 0.25, hit: 2, aspd: 3 }, vit: { def: 0.5, hp: 12 }, luk: { crit: 0.3, critDmg: 1 } };
function statRateTable(rates) {
  const r = (st, k) => (rates && rates[st] ? rates[st][k] : STAT_RATE_DEFAULT[st][k]) || 0;
  return `<div class="tableWrap"><table class="statRate"><thead><tr><th>+1 แต้ม</th>${STAT_FX.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>
    ${STATS.map(st => `<tr><th>${st.toUpperCase()}</th>${STAT_FX.map(([k]) => `<td><input id="sr_${st}_${k}" type="number" step="0.05" min="-999" max="999" value="${r(st, k)}"></td>`).join("")}</tr>`).join("")}
    </tbody></table></div>`;
}
function renderSettings() {
  const s = gameSettings, v = k => s[k] ?? [...SETTING_FIELDS, ...CAP_FIELDS, ...BAL_FIELDS].find(f => f[0] === k)[2];
  const ex = [0, 1, 2, 3].map(i => (v("bagPrice") + v("bagPriceStep") * i).toLocaleString()).join(" → ");
  $("settingsForm").innerHTML = `<h2>⚙️ ตั้งค่าเกม</h2>
    <div class="sub">🎒 ขยายย่าม</div>
    <div class="grid">${SETTING_FIELDS.map(([k, l]) => `<div><label>${l}</label><input id="gs_${k}" type="number" min="0" value="${v(k)}" oninput="settingsHint()"></div>`).join("")}</div>
    <div class="hint" id="gs_hint">ราคาแต่ละครั้ง: ${ex} … เบี้ย</div>
    <div class="hint">ค่าล้างแต้มวิชา = ค่าครูที่หมอผีเฒ่าจันทร์เก็บต่อครั้ง · ล้างแต้มสถานะใช้ธูปเทียนแพ (แก้ราคาในหน้าไอเท็ม)</div>
    <div class="sub">⚖️ สมดุลเกม (ความยากการเก็บเลเวล / ฟาร์ม)</div>
    <div class="grid">${BAL_FIELDS.map(([k, l, , lo, hi]) => `<div><label>${l}</label><input id="gs_${k}" type="number" step="${k === "statPts" || k === "noEquipLvl" ? 1 : 0.05}" min="${lo}" max="${hi}" value="${v(k)}"></div>`).join("")}</div>
    <div class="hint">ตัวคูณคูณทับค่าของมอนแต่ละตัว: EXP/เบี้ย/ดรอป น้อยกว่า 1 = ได้น้อยลง · HP/ATK/เวลาเกิดใหม่ มากกว่า 1 = ยากขึ้น · ของที่ดรอป 100% (เช่นชิ้นส่วนบอส) ไม่ถูกลด · แก้แล้วมีผลกับมอนที่เกิดอยู่ทันทีเมื่อผู้เล่นโหลดเกมใหม่</div>
    <div class="sub">🎚️ เพดานผู้เล่น</div>
    <div class="grid">${CAP_FIELDS.map(([k, l]) => `<div><label>${l}</label><input id="gs_${k}" type="number" min="1" max="999" value="${v(k)}"></div>`).join("")}</div>
    <div class="hint">ช่วงที่ตั้งได้ 1–999 · เพดานสเตตัสนับเฉพาะแต้มที่ผู้เล่นแจกเอง (ไม่รวมโบนัสจากอุปกรณ์/วิชา) · ถ้าลดเพดานต่ำกว่าค่าที่ผู้เล่นมีอยู่ ผู้เล่นจะไม่ถูกลดค่า แต่เพิ่มต่อไม่ได้</div>
    <div class="sub">📊 ค่าสเตตัสต่อ 1 แต้ม <button class="btn sm ghost" style="margin-left:8px" onclick="$('statRateBox').innerHTML=statRateTable(null)">↺ สูตรเดิม</button></div>
    <div id="statRateBox">${statRateTable(s.statRates)}</div>
    <div class="hint">ตัวอย่าง: แถว STR ใส่ ATK ประชิด = 3, HP = 17 → STR ทุก 1 แต้มได้ ATK +3 และ HP +17 · 0 = ไม่มีผล · ใส่ทศนิยมได้ (0.25 = ทุก 4 แต้มได้ +1)<br>
      ATK ประชิด ใช้ตอนถือมีด/ดาบ/ทวน/มือเปล่า · ATK ธนู ใช้ตอนถือธนู · ATK เวท ใช้ตอนถือประคำ · ตีเร็ว = ลดดีเลย์การตีกี่มิลลิวินาทีต่อแต้ม</div>
    <div class="formActs"><button class="btn green" onclick="saveSettings()">💾 บันทึก</button><button class="btn ghost" onclick="gameSettings={};renderSettings()">คืนค่าเริ่มต้น</button></div>`;
}
function settingsHint() { const p = numv("gs_bagPrice"), st = numv("gs_bagPriceStep"); $("gs_hint").textContent = "ราคาแต่ละครั้ง: " + [0, 1, 2, 3].map(i => (p + st * i).toLocaleString()).join(" → ") + " … เบี้ย"; }
async function saveSettings() {
  const d = {}; for (const [k] of SETTING_FIELDS) d[k] = numv("gs_" + k);
  for (const [k, l] of CAP_FIELDS) { const n = numv("gs_" + k); if (!(n >= 1 && n <= 999)) return toast(l + " ต้องอยู่ระหว่าง 1–999", true); d[k] = Math.round(n); }
  for (const [k, l, , lo, hi] of BAL_FIELDS) { const n = numv("gs_" + k, NaN); if (!(n >= lo && n <= hi)) return toast(l + " ต้องอยู่ระหว่าง " + lo + "–" + hi, true); d[k] = (k === "statPts" || k === "noEquipLvl") ? Math.round(n) : n; }
  d.statRates = {};
  for (const st of STATS) {
    d.statRates[st] = {};
    for (const [k, l] of STAT_FX) {
      const n = numv(`sr_${st}_${k}`, NaN);
      if (!(n >= -999 && n <= 999)) return toast(`${st.toUpperCase()} → ${l} ต้องเป็นตัวเลข -999 ถึง 999`, true);
      if (n) d.statRates[st][k] = n;
    }
  }
  if (d.bagLimit < d.bagBase) return toast("ช่องสูงสุดต้องไม่น้อยกว่าช่องเริ่มต้น", true);
  if (await saveContent("map", "game_settings", d)) renderSettings();
}
function showTab(t) {
  for (const b of document.querySelectorAll(".mainTabs button")) b.classList.toggle("on", b.dataset.tab === t);
  for (const s of document.querySelectorAll(".tabSec")) s.style.display = s.id === "tab-" + t ? "block" : "none";
}
async function saveContent(kind, id, data, oldId) {
  if (!contentOk) return toast("ต้องรัน content.sql ใน Supabase ก่อน", true), false;
  const { error } = await sb.from("game_content").upsert({ kind, id, data, updated_at: new Date().toISOString() });
  if (error) return toast("บันทึกไม่สำเร็จ: " + errText(error), true), false;
  if (oldId && oldId !== id) await sb.from("game_content").delete().eq("kind", kind).eq("id", oldId);
  toast("บันทึกแล้ว · ผู้เล่นกด F5 เพื่อรับของใหม่");
  await loadContent();
  return true;
}
async function deleteContent(kind, id, label) {
  if (!confirm(`ลบ "${label}" ออกจากเกม?\nผู้เล่นที่มีของ/อยู่ในแผนที่นี้จะเสียไป`)) return false;
  const { error } = await sb.from("game_content").delete().eq("kind", kind).eq("id", id);
  if (error) return toast("ลบไม่สำเร็จ: " + errText(error), true), false;
  toast("ลบแล้ว"); await loadContent(); return true;
}
const allItems = () => [...BUILTIN_ITEMS.map(([id, n, t, g, ic]) => ({ id, name: n, type: t, grade: g, icon: ic })),
  ...Object.entries(content.item).filter(([id]) => !BUILTIN.items[id]).map(([id, d]) => ({ id, name: d.name, type: d.type, grade: d.grade, icon: d.icon, custom: true }))].filter(x => !(content.item[x.id] && content.item[x.id].deleted));
const VALLEY_ELITES = [["v_cobra", "งูจงอางหุบเขา", 14], ["v_monkey", "ลิงป่าดุ", 14], ["v_kraseu", "กระสือหมอก", 15], ["v_kraseu2", "กระสือเฒ่า", 18]];
const allMobs = () => [...VALLEY_ELITES.map(([id, n, l]) => ({ id, name: n + " (หุบเขา)", lvl: l })),...BUILTIN_MOBS.map(([id, n, l]) => ({ id, name: n, lvl: l })), ...Object.entries(content.mob).filter(([id]) => !BUILTIN.mobs[id]).map(([id, d]) => ({ id, name: d.name, lvl: d.lvl, custom: true }))].filter(x => !(content.mob[x.id] && content.mob[x.id].deleted));
const allMaps = () => [["main", "แผนที่หลัก (ทุ่งนา · ป่า)"], ["valley", "หุบเขาหมอก"], ...Object.entries(content.map).filter(([id]) => !isBuiltinMap(id)).map(([id, d]) => [id, d.name])];
const idOk = id => /^[a-z0-9_]{2,32}$/.test(id);
const taken = (kind, id) => (kind === "item" && BUILTIN_ITEMS.some(x => x[0] === id)) || (kind === "mob" && BUILTIN_MOBS.some(x => x[0] === id)) || (kind === "map" && (id === "main" || id === "valley"));
// ของเดิมในเกม: แก้ = บันทึกค่าทับ · ลบ = บันทึก { deleted: true } · คืนค่าเดิม = ลบค่าทับทิ้ง
const statusTag = o => !o ? "" : o.deleted ? `<span class="gradeTag" style="color:#ff8a7a">ลบแล้ว</span>` : `<span class="gradeTag" style="color:#7dffb2">แก้แล้ว</span>`;
function builtinBanner(kind, id, bi, ov, name) {
  if (!bi) return "";
  if (ov && ov.deleted) return `<div class="note" style="color:#ff8a7a;margin:0 0 10px">⛔ "${esc(name)}" ถูกลบออกจากเกมอยู่ · กด "นำกลับมา" เพื่อใช้ต่อ หรือแก้แล้วบันทึกเพื่อเปิดใช้ด้วยค่าใหม่</div>`;
  return `<div class="note" style="margin:0 0 10px">นี่คือของเดิมในเกม${ov ? " (แก้ไขไว้แล้ว)" : ""} · แก้แล้วบันทึกได้เลย · ลบได้ และคืนค่าเดิมได้ทุกเมื่อ</div>`;
}
function builtinButtons(kind, id, bi, ov, name) {
  const form = kind + "Form", edit = { item: "editItem", mob: "editMob", skill: "editSkill" }[kind];
  if (!id) return "";
  if (!bi) return `<button class="btn red" onclick="deleteContent('${kind}','${id}','${esc(name)}').then(ok=>ok&&($('${form}').innerHTML='<div class=empty>ลบแล้ว</div>'))">🗑 ลบ</button>`;
  let h = "";
  if (ov && ov.deleted) h += `<button class="btn" onclick="resetBuiltin('${kind}','${id}')">♻️ นำกลับมา</button>`;
  else {
    if (ov) h += `<button class="btn ghost" onclick="resetBuiltin('${kind}','${id}')">🔄 คืนค่าเดิม</button>`;
    h += `<button class="btn red" onclick="removeBuiltin('${kind}','${id}','${esc(name)}')">🗑 ลบออกจากเกม</button>`;
  }
  return h;
}
async function resetBuiltin(kind, id) {
  const { error } = await sb.from("game_content").delete().eq("kind", kind).eq("id", id);
  if (error) return toast("ไม่สำเร็จ: " + errText(error), true);
  toast("คืนค่าเดิมแล้ว"); await loadContent(); ({ item: editItem, mob: editMob, skill: editSkill, map: editMap })[kind](id);
}
async function removeBuiltin(kind, id, name) {
  const warn = { item: "ผู้เล่นที่มีของชิ้นนี้จะเสียไป และจะหายจากร้าน/ของดรอปทั้งหมด", mob: "มอนตัวนี้จะไม่เกิดในแผนที่อีก (ภารกิจที่ต้องล่ามอนตัวนี้จะทำไม่ได้)", skill: "ผู้เล่นที่อัปวิชานี้จะได้แต้มวิชาคืน · วิชาที่ต้องใช้วิชานี้ก่อนจะอัปได้เลย" }[kind];
  if (!confirm(`ลบ "${name}" ออกจากเกม?\n${warn}\n(กดคืนค่าเดิมทีหลังได้)`)) return;
  if (await saveContent(kind, id, { deleted: true })) ({ item: editItem, mob: editMob, skill: editSkill })[kind](id);
}
const gradeTag = g => g ? `<span class="gradeTag" style="color:${GRADES[g][1]}">${GRADES[g][0]}</span>` : "";
const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(label)}</option>`;
const val = id => $(id) ? $(id).value : "";
const numv = (id, d = 0) => { const n = Number(val(id)); return Number.isFinite(n) ? n : d; };

// ---------- รูปจากเครื่อง: ย่อขนาดแล้วเก็บเป็น data URL ในฐานข้อมูล ----------
const pickedImg = { item: null, mob: null, wimg: null, skill: null };
const thumb = src => typeof src === "string" && /^data:image\/(png|webp|jpeg|gif);base64,/.test(src) ? `<img src="${esc(src)}" alt="">` : "";
function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error("ไฟล์นี้ไม่ใช่รูปภาพ"));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      for (let size = max, q = 0.9; size >= 48; size = Math.round(size * 0.8), q -= 0.1) {
        const s = Math.min(1, size / Math.max(im.width, im.height));
        const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s));
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        let d = c.toDataURL("image/webp", Math.max(0.5, q));
        if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/png");
        if (d.length < 190000) return resolve(d);
      }
      reject(new Error("รูปใหญ่เกินไป"));
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("เปิดรูปไม่ได้")); };
    im.src = url;
  });
}
function imgField(kind, cur, max, hint) {
  pickedImg[kind] = cur || null;
  return `<div class="fld"><label>${hint}</label>
    <div class="row" style="max-width:520px">
      <div id="${kind}_imgPrev" class="imgPrev">${thumb(cur) || "ไม่มีรูป"}</div>
      <label class="btn sm" style="cursor:pointer">📁 เลือกรูป<input type="file" accept="image/*" style="display:none" onchange="pickImage('${kind}', this.files[0], ${max})"></label>
      <button class="btn sm ghost" onclick="pickedImg.${kind}=null;$('${kind}_imgPrev').innerHTML='ไม่มีรูป';if('${kind}'==='skill'&&$('sk_grid'))drawSkillGrid()">ลบรูป</button>
    </div><div class="hint">PNG พื้นหลังโปร่งใสจะดูดีที่สุด · ระบบย่อรูปให้อัตโนมัติ</div>${promptBox(kind)}</div>`;
}
// ---------- พรอมต์ JSON สำหรับเอาไปเจนรูปด้วย AI ให้เข้าธีมเกม (พิกเซลอาร์ต ไทยโบราณ) ----------
const GEN_STYLE = "cute chibi pixel art, 16-bit SNES RPG style (like Ragnarok / Stardew Valley), ancient Thai folklore theme (Siam, Himmapan forest, temples)";
const GEN_PIXEL = "crisp pixels, no anti-aliasing, no blur, 1px dark outline (darker shade of the inner color, not pure black), light from top-left, 3-4 shades per color, bold readable shapes";
const GEN_AVOID = "realistic, 3D render, smooth gradients, soft airbrush shading, text, letters, watermark, frame, border, background scenery, multiple objects, cropped";
const WTYPE_EN = { dagger: "Thai dagger or wavy kris", sword: "Thai sword 'daab' (slightly curved single-edge blade)", spear: "Thai glaive 'ngao' or long spear", bow: "Thai horn bow or bamboo bow", beads: "magic prayer beads 'prakham' with gold tassel" };
const TYPE_EN = { armor: "Thai warrior armor vest / yantra shirt", head: "Thai headwear (cloth wrap or tall 'lompok' hat)", cape: "shoulder cape / cloth", shield: "round Thai shield 'khen'", pants: "Thai wrap pants 'chong kraben'", boots: "leather sandals / boots", ring: "ring with gemstone", use: "potion / herbal medicine / food", etc: "monster material drop" };
const SKILL_LINE_EN = { sword: "swordsman", mage: "mage", archer: "archer", priest: "Buddhist monk / priest", thief: "thief / assassin", merchant: "merchant" };
function genPrompt(kind) {
  const nm = kind === "mob" ? val("me_name") : kind === "skill" ? val("sk_name") : val("ie_name");
  const base = { name_th: nm || "(ชื่อ)" };
  if (kind === "item") {
    const t = val("ie_type"), hint = t === "weapon" ? WTYPE_EN[val("ie_wtype")] || "weapon" : TYPE_EN[t] || "item";
    return { task: "game item inventory icon", ...base, description_th: val("ie_desc"),
      subject: `DESCRIBE IN ENGLISH (e.g. a ${hint})`, style: GEN_STYLE.replace("cute chibi ", "") + ", inventory icon",
      composition: "single object, centered, 3/4 view, fills about 85% of the canvas with a small margin", pixel_rules: GEN_PIXEL,
      colors: "EDIT: main colors", canvas: "square 64x64 pixel grid (export 256x256 upscaled with nearest neighbor)",
      background: "fully transparent PNG, no frame, no glow box, no shadow plate", avoid: GEN_AVOID };
  }
  if (kind === "wimg") return { task: "weapon sprite held by a game character", ...base,
      subject: `DESCRIBE IN ENGLISH (e.g. a ${WTYPE_EN[val("ie_wtype")] || "Thai weapon"})`, style: GEN_STYLE.replace("cute chibi ", "") + ", weapon sprite",
      orientation: "perfectly VERTICAL, handle at the BOTTOM, tip pointing straight UP, no tilt", composition: "single weapon only, centered, fills about 90% of the height",
      pixel_rules: GEN_PIXEL, colors: "EDIT: blade / handle colors", canvas: "tall 1:3 ratio, e.g. 32x96 pixel grid (export 128x384 upscaled with nearest neighbor)",
      background: "fully transparent PNG, no hand, no character, no shadow", avoid: GEN_AVOID + ", diagonal, horizontal" };
  if (kind === "mob") {
    const boss = val("me_kind") === "boss";
    return { task: boss ? "game BOSS monster sprite" : "game monster sprite", ...base,
      subject: `DESCRIBE IN ENGLISH (e.g. Thai folklore ${boss ? "giant yaksha / naga king" : "forest ghost / wild animal"})`, style: GEN_STYLE,
      pose: "full body, side view facing RIGHT, standing idle, feet touching the bottom edge",
      proportions: boss ? "big imposing body, still chibi-cute, larger than normal monsters, readable silhouette" : "big head, small body, rounded cute shapes, readable silhouette at small size",
      pixel_rules: GEN_PIXEL, colors: "EDIT: main colors", canvas: `square ${boss ? 384 : 256}x${boss ? 384 : 256}, character fills about 85% of height, centered`,
      background: "fully transparent PNG, no ground, no shadow, no scenery", avoid: GEN_AVOID + ", multiple characters" };
  }
  // skill: ไอคอนวิชา
  return { task: "skill icon for a game skill window", ...base,
      subject: `DESCRIBE IN ENGLISH (e.g. ${SKILL_LINE_EN[val("sk_line")] || "hero"} skill: slash arc / fireball / holy lotus / poison fang)`,
      style: GEN_STYLE.replace("cute chibi ", "") + ", skill icon", composition: "single symbol, centered, fills about 85% of the canvas",
      pixel_rules: GEN_PIXEL, colors: `main color ${val("sk_color") || "#ffb627"} with a light highlight`,
      canvas: "square 64x64 pixel grid (export 256x256 upscaled with nearest neighbor)",
      background: "fully transparent PNG, no frame", avoid: GEN_AVOID };
}
function promptBox(kind) {
  return `<details class="genBox" ontoggle="if(this.open)$('gp_${kind}').value=JSON.stringify(genPrompt('${kind}'),null,2)">
    <summary>🎨 พรอมต์ JSON เจนรูปให้เข้าธีมเกม (กดเปิด)</summary>
    <textarea id="gp_${kind}" rows="16" spellcheck="false"></textarea>
    <div class="row" style="margin-top:6px"><button class="btn sm" onclick="copyPrompt('${kind}')">📋 คัดลอก</button>
      <button class="btn sm ghost" onclick="$('gp_${kind}').value=JSON.stringify(genPrompt('${kind}'),null,2)">↻ อัปเดตตามชื่อที่กรอก</button></div>
    <div class="hint">แก้ช่อง <b>subject</b> (บอกหน้าตาเป็นภาษาอังกฤษ) และ <b>colors</b> · ถ้าวาดรูปเองไว้ แนบรูปไปด้วยแล้วเพิ่มว่า "use my sketch as the base shape" · ได้รูปพื้นขาวมา ให้ลบพื้นก่อนอัป</div>
  </details>`;
}
function copyPrompt(kind) {
  const el = $("gp_" + kind); if (!el.value) el.value = JSON.stringify(genPrompt(kind), null, 2);
  (navigator.clipboard ? navigator.clipboard.writeText(el.value) : Promise.reject()).then(() => toast("คัดลอกพรอมต์แล้ว"), () => { el.select(); document.execCommand("copy"); toast("คัดลอกพรอมต์แล้ว"); });
}
async function pickImage(kind, file, max) {
  try {
    const d = await resizeImage(file, max);
    pickedImg[kind] = d;
    $(kind + "_imgPrev").innerHTML = `<img src="${d}" alt="">`;
    if (kind === "skill" && $("sk_grid")) drawSkillGrid();
  } catch (e) { toast(e.message, true); }
}

// ---------- ไอเท็ม ----------
let curItem = null;
function renderItemList() {
  const ids = Object.keys(content.item).filter(id => !BUILTIN.items[id]).sort();
  $("itemList").innerHTML = ids.length ? ids.map(id => { const d = content.item[id]; return `<div class="li ${curItem === id ? "on" : ""}" onclick="editItem('${id}')"><span class="ic">${catIcon(d.type)}</span><span class="t">${esc(d.name)} ${gradeTag(d.grade)}<small>${esc(ITEM_TYPES[d.type] || d.type)}</small></span></div>`; }).join("")
    : `<div class="empty" style="padding:14px">ยังไม่มี</div>`;
  $("builtinItems").innerHTML = Object.keys(BUILTIN.items).map(id => { const o = content.item[id], d = o && !o.deleted ? o : BUILTIN.items[id]; return `<div class="li ${curItem === id ? "on" : ""}" style="cursor:pointer" onclick="editItem('${id}')"><span class="ic">${catIcon(d.type)}</span><span class="t">${esc(d.name)} ${gradeTag(d.grade)} ${statusTag(o)}<small>${ITEM_TYPES[d.type] || d.type}</small></span></div>`; }).join("");
}
function editItem(id) {
  curItem = id; renderItemList();
  const bi = !!(id && BUILTIN.items[id]), ov = id && content.item[id];
  const d = ov && !ov.deleted ? ov : bi ? BUILTIN.items[id] : id ? content.item[id] : { type: "weapon", wtype: "sword", grade: 1, icon: "⚔️", price: 500, atk: 20, stats: {} };
  const st = d.stats || {};
  $("itemForm").innerHTML = `<h2>${bi ? "แก้ไขไอเท็มเดิมในเกม" : id ? "แก้ไขไอเท็ม" : "เพิ่มไอเท็มใหม่"}</h2>
    ${builtinBanner("item", id, bi, ov, d.name)}
    <div class="grid">
      <input id="ie_id" type="hidden" value="${esc(id || newId("it"))}">
      <div><label>ชื่อ</label><input id="ie_name" maxlength="30" value="${esc(d.name || "")}"></div>
      <input id="ie_icon" type="hidden" value="${esc(d.icon || "")}">
      <div><label>หมวด</label><select id="ie_cat" onchange="itemCatChanged()">${Object.entries(ITEM_CATS).map(([k, l]) => opt(k, l, catOf(d.type))).join("")}</select></div>
      <div id="ie_slotBox"><label>สวมใส่ที่</label><select id="ie_type" onchange="itemTypeChanged()">${Object.entries(ITEM_TYPES).map(([k, l]) => opt(k, l, d.type)).join("")}</select></div>
      <div><label>ราคา (เบี้ย)</label><input id="ie_price" type="number" min="1" value="${d.price ?? 100}"></div>
    </div>
    <div class="fld"><label>คำอธิบาย</label><input id="ie_desc" maxlength="120" value="${esc(d.desc || "")}"></div>
    ${imgField("item", d.img, 128, "รูปไอคอน (ไม่ใส่ก็ได้ · เกมวาดไอคอนให้เองตามหมวด)")}
    <div id="ie_extra"></div>
    <div class="sub">สูตรคราฟ <button class="btn sm ghost" onclick="addMatRow()" style="margin-left:8px">＋ เพิ่มวัตถุดิบ</button></div>
    <div class="hint">อุปกรณ์ทุกชิ้นคราฟได้ · ไม่ใส่วัตถุดิบ = ใช้สูตรอัตโนมัติตามเกรด (D: เขี้ยวหมู+ขนไก่ · C: ขนลิง+หนังงู · B: หนังงู+ดวงไฟ · A: ดวงไฟ+เกล็ดนาค · S: เกล็ดนาค+ดวงไฟ) · ใครคราฟให้ขึ้นกับหมวด: 🔨 ช่างเหล็ก = อาวุธ/โล่ · 🧵 ช่างทอผ้า = ชุด/ผ้าคลุม/รองเท้า/กางเกง/หมวก · 💍 ช่างเครื่องประดับ = แหวน</div>
    <div id="ie_mats"></div>
    <div class="grid"><div><label>ค่าคราฟ (เบี้ย)</label><input id="ie_rzeny" type="number" min="0" value="${(d.recipe && d.recipe.zeny) || 0}"></div></div>
    <div class="formActs">
      <button class="btn green" onclick="saveItem()">💾 บันทึก</button>
      ${builtinButtons("item", id, bi, ov, d.name)}
    </div>`;
  itemCatChanged(d, st);
  for (const [m, n] of (d.recipe && d.recipe.mats) || []) addMatRow(m, n);
}
// อีโมจิเริ่มต้นของแต่ละหมวด: เปลี่ยนหมวดแล้วไอคอนเปลี่ยนตาม (ถ้ายังไม่ได้พิมพ์อีโมจิเอง)
// หมวดใหญ่แบบง่าย: อาวุธ / อุปกรณ์สวมใส่ / ยา / ของป่า (อุปกรณ์ค่อยเลือกว่าใส่ตรงไหน)
// รหัสภายในสร้างให้อัตโนมัติ (แอดมินพิมพ์แค่ชื่อ)
const newId = p => (p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).slice(0, 32);
// ไอคอนไอเท็มตามหมวด: อาวุธ / ของสวมใส่ / ยา / ของป่า
const catIcon = t => t === "weapon" ? "⚔️" : t === "use" ? "🧪" : t === "etc" ? "📦" : "🛡️";
const ITEM_CATS = { weapon: "⚔️ อาวุธ", equip: "🛡️ อุปกรณ์สวมใส่", use: "🧪 ยา / อาหาร", etc: "📦 ของป่า (ไว้ขาย)" };
const EQUIP_SLOTS = { armor: "เสื้อเกราะ", head: "หมวก", cape: "ผ้าคลุม", shield: "โล่", pants: "กางเกง", boots: "รองเท้า", ring: "แหวน" };
const catOf = t => t === "weapon" || t === "use" || t === "etc" ? t : "equip";
function itemCatChanged(d, st) {
  const c = val("ie_cat"), sel = $("ie_type"), cur = sel.value;
  if (c === "equip") {
    sel.innerHTML = Object.entries(EQUIP_SLOTS).map(([k, l]) => opt(k, l, EQUIP_SLOTS[cur] ? cur : "armor")).join("");
    $("ie_slotBox").style.display = "";
  } else { sel.innerHTML = opt(c, c, c); $("ie_slotBox").style.display = "none"; }
  itemTypeChanged(d, st);
}
const TYPE_ICON = { armor: "🥋", head: "🪖", cape: "🧣", shield: "🛡️", pants: "👖", boots: "👢", ring: "💍", use: "🧪", etc: "📦" };
const WTYPE_ICON = { dagger: "🔪", sword: "⚔️", spear: "🔱", bow: "🏹", beads: "📿" };
const DEFAULT_ICONS = new Set([...Object.values(TYPE_ICON), ...Object.values(WTYPE_ICON), ""]);
function syncIcon() {
  const el = $("ie_icon"); if (!el || !DEFAULT_ICONS.has(el.value.trim())) return;
  const t = val("ie_type");
  el.value = t === "weapon" ? WTYPE_ICON[val("ie_wtype") || "sword"] || "⚔️" : TYPE_ICON[t] || "📦";
}
function itemTypeChanged(d, st) {
  d = d || collectItem() || {}; st = st || d.stats || {};
  const t = val("ie_type"), equip = !["use", "etc"].includes(t);
  setTimeout(syncIcon);
  let h = "";
  if (equip) h += `<div class="grid"><div><label>เกรด</label><select id="ie_grade">${[1, 2, 3, 4, 5].map(g => opt(g, "เกรด " + GRADES[g][0], d.grade || 1)).join("")}</select></div>
      <div style="align-self:end"><label class="chk"><input type="checkbox" id="ie_shop" ${d.shop ? "checked" : ""}> ขายในร้านนายมั่น (เฉพาะเกรด D–B)</label></div></div>`;
  if (t === "weapon") {
    const wt = d.wtype || "sword";
    h += `<div class="grid">
      <div><label>ประเภทอาวุธ</label><select id="ie_wtype" onchange="weaponLookOpts()">${Object.entries(WTYPE_NAMES).map(([k, l]) => opt(k, l, wt)).join("")}</select></div>
      <div><label>หน้าตาอาวุธ</label><select id="ie_draw"></select></div>
      <div><label>สีอาวุธ (0 = สีเดิม)</label><input id="ie_wtint" type="range" min="0" max="360" value="${d.wtint || 0}" oninput="$('ie_wtintv').textContent=this.value+'°'"><small id="ie_wtintv" class="muted">${d.wtint || 0}°</small></div>
      <div><label>ATK</label><input id="ie_atk" type="number" min="0" value="${d.atk ?? 20}"></div>
      <div><label>คริติคอล %</label><input id="ie_crit" type="number" min="0" value="${d.crit ?? 0}"></div></div>
      ${imgField("wimg", d.wimg, 160, "รูปอาวุธที่ตัวละครถือ (ถ้าใส่ จะใช้แทนหน้าตาอาวุธด้านบน · วาดให้ด้ามอยู่ล่าง ปลายชี้ขึ้น)")}`;
  } else if (equip) {
    h += `<div class="grid"><div><label>DEF</label><input id="ie_def" type="number" min="0" value="${d.def ?? 2}"></div>`;
    if (t === "armor") h += `<div><label>หน้าตาเสื้อ</label><select id="ie_style">${opt("", "เสื้อธรรมดา", d.style)}${opt("cloth", "เสื้อยันต์ (ขาว)", d.style)}${opt("chain", "เกราะหนัง (น้ำตาล)", d.style)}</select></div>`;
    if (t === "head") h += `<div><label>หน้าตาหมวก</label><select id="ie_draw">${opt("wrap", "ผ้าโพก", d.draw)}${opt("lompok", "ลอมพอก", d.draw)}</select></div>`;
    if (["cape", "shield", "pants"].includes(t)) h += `<div><label>สี</label><input id="ie_color" type="color" value="${esc(d.color || "#8b1e1e")}"></div>`;
    h += `</div>`;
  }
  if (equip) h += `<div class="sub">โบนัสค่าสถานะ</div><div class="grid">${STATS.map(k => `<div><label>${k.toUpperCase()}</label><input id="ie_st_${k}" type="number" min="0" value="${st[k] || 0}"></div>`).join("")}</div>`;
  if (equip) { const op = d.opts || {}; h += `<div class="sub">ออปชั่นพิเศษ</div><div class="hint">ใส่เป็นตัวเลขบวก · ช่องที่มี % คิดเป็นเปอร์เซ็นต์ · เว้น 0 = ไม่มี · Attack speed 1 แต้ม = ตีเร็วขึ้น 5 มิลลิวินาที · MATK ใช้กับเวทและประคำ · Ignore Def/MDef สูงสุด 100%</div>
    <div class="grid">${OPT_DEFS.map(([k, l, pc]) => `<div><label>${l} ${pc ? "+ %" : "+"}</label><input id="ie_op_${k}" type="number" min="0" max="${pc ? 100 : 999}" value="${op[k] || 0}"></div>`).join("")}</div>`; }
  if (t === "use") h += `<div class="grid"><div><label>ฟื้น HP</label><input id="ie_hp" type="number" min="0" value="${d.hp ?? 100}"></div><div><label>ฟื้น SP</label><input id="ie_sp" type="number" min="0" value="${d.sp ?? 0}"></div>
      <div style="align-self:end"><label class="chk"><input type="checkbox" id="ie_shop" ${d.shop ? "checked" : ""}> ขายในร้าน</label></div></div>`;
  if (t === "etc") h += `<div class="hint">ของป่าไว้ให้มอนดรอปแล้วเอาไปขายร้าน ได้เงินครึ่งหนึ่งของราคา</div>`;
  $("ie_extra").innerHTML = h;
  if (t === "weapon") weaponLookOpts(d.draw);
}
function weaponLookOpts(cur) {   // เฉพาะหน้าตาของประเภทอาวุธที่เลือก
  const list = WEAPON_LOOKS[val("ie_wtype")] || [];
  $("ie_draw").innerHTML = list.map(([k, l]) => opt(k, l, cur)).join("");
  syncIcon();
}
function collectItem() {
  if (!$("ie_type")) return null;
  const t = val("ie_type"), d = { name: val("ie_name").trim(), icon: catIcon(t), type: t, price: numv("ie_price", 1), desc: val("ie_desc").trim() };
  if ($("ie_grade")) d.grade = numv("ie_grade", 1);
  if ($("ie_shop")) d.shop = $("ie_shop").checked;
  if (t === "weapon") { d.wtype = val("ie_wtype"); d.draw = val("ie_draw"); d.atk = numv("ie_atk"); d.crit = numv("ie_crit"); d.wtint = numv("ie_wtint"); if (pickedImg.wimg) d.wimg = pickedImg.wimg; }
  if ($("ie_def")) d.def = numv("ie_def");
  if ($("ie_style")) d.style = val("ie_style");
  if (t === "head" && $("ie_draw")) d.draw = val("ie_draw");
  if ($("ie_color")) d.color = val("ie_color");
  if ($("ie_st_str")) { d.stats = {}; for (const k of STATS) { const n = numv("ie_st_" + k); if (n) d.stats[k] = n; } }
  if ($("ie_op_spd")) { d.opts = {}; for (const [k, , pc] of OPT_DEFS) { const n = Math.min(pc ? 100 : 999, numv("ie_op_" + k)); if (n > 0) d.opts[k] = n; } }
  if (t === "use") { d.hp = numv("ie_hp"); d.sp = numv("ie_sp"); }
  if (pickedImg.item) d.img = pickedImg.item;
  if ($("ie_mats")) d.recipe = { mats: [...document.querySelectorAll("#ie_mats .row")].map(r => [r.querySelector(".mt_item").value, Math.max(1, Number(r.querySelector(".mt_n").value) || 1)]), zeny: numv("ie_rzeny", 0) };
  return d;
}
async function saveItem() {
  const id = val("ie_id").trim().toLowerCase(), d = collectItem();
  if (!idOk(id)) return toast("รหัสต้องเป็นอังกฤษตัวเล็ก ตัวเลข หรือ _ ยาว 2–32 ตัว", true);
  if (taken("item", id) && id !== curItem) return toast("รหัสนี้ซ้ำกับไอเท็มเดิมในเกม", true);
  if (id !== curItem && content.item[id]) return toast("มีไอเท็มรหัสนี้แล้ว", true);
  if (!d.name) return toast("ใส่ชื่อไอเท็มด้วย", true);
  if (await saveContent("item", id, d, curItem)) editItem(id);
}

// ---------- มอนสเตอร์ ----------
let curMob = null;
function renderMobList() {
  const ids = Object.keys(content.mob).filter(id => !BUILTIN.mobs[id]).sort();
  $("mobList").innerHTML = ids.length ? ids.map(id => { const d = content.mob[id]; return `<div class="li ${curMob === id ? "on" : ""}" onclick="editMob('${id}')">${d.img ? `<span class="ic">${thumb(d.img)}</span>` : ""}<span class="t">${esc(d.name)} · Lv${d.lvl}${d.boss ? " 👑" : ""}<small>ดรอป ${(d.drops || []).length} อย่าง</small></span></div>`; }).join("")
    : `<div class="empty" style="padding:14px">ยังไม่มี</div>`;
  $("builtinMobs").innerHTML = Object.keys(BUILTIN.mobs).map(id => { const o = content.mob[id], d = o && !o.deleted ? o : BUILTIN.mobs[id]; return `<div class="li ${curMob === id ? "on" : ""}" style="cursor:pointer" onclick="editMob('${id}')">${d.img ? `<span class="ic">${thumb(d.img)}</span>` : ""}<span class="t">${esc(d.name)} · Lv${d.lvl} ${statusTag(o)}</span></div>`; }).join("");
}
function mobAuto() {   // ค่าแนะนำตามเลเวล
  const L = Math.max(1, numv("me_lvl", 1)), a = Math.round(3 + L * 2.3);
  const set = (k, v) => { if ($("me_" + k)) $("me_" + k).value = v; };
  set("hp", Math.round(30 * Math.pow(L, 1.45) + 20)); set("atkMin", a); set("atkMax", Math.round(a * 1.35)); set("def", Math.round(L * 0.7));
  set("flee", Math.round(L * 2 + 5)); set("exp", Math.round(8 * Math.pow(L, 1.5))); set("zenyMin", L); set("zenyMax", L * 3);
  toast("ใส่ค่าแนะนำสำหรับ Lv " + L + " แล้ว");
}
function editMob(id) {
  curMob = id; renderMobList();
  const bi = !!(id && BUILTIN.mobs[id]), ov = id && content.mob[id];
  const d = ov && !ov.deleted ? ov : bi ? { ...BUILTIN.mobs[id], look: id } : id ? content.mob[id] : { look: "pig", lvl: 5, hp: 200, atkMin: 12, atkMax: 16, def: 3, flee: 15, exp: 90, zenyMin: 5, zenyMax: 15, speed: 70, aspd: 1300, respawn: 12, r: 15, tint: 0, scale: 1, drops: [] };
  const n = (k, label, def, extra = "") => `<div><label>${label}</label><input id="me_${k}" type="number" value="${d[k] ?? def}" ${extra}></div>`;
  $("mobForm").innerHTML = `<h2>${bi ? "แก้ไขมอนเดิมในเกม" : id ? "แก้ไขมอนสเตอร์" : "เพิ่มมอนสเตอร์ใหม่"}</h2>
    ${builtinBanner("mob", id, bi, ov, d.name)}
    <div class="grid">
      <input id="me_id" type="hidden" value="${esc(id || newId("mo"))}">
      <div><label>ชื่อ</label><input id="me_name" maxlength="24" value="${esc(d.name || "")}"></div>
      <input id="me_look" type="hidden" value="${esc(d.look || "pig")}">
      <div><label>ประเภท</label><select id="me_kind">${opt("normal", "🐾 ธรรมดา", d.boss ? "boss" : "normal")}${opt("boss", "👑 บอส (มีหลอดเลือดใหญ่ด้านบน)", d.boss ? "boss" : "normal")}</select></div>
      <div><label>เปลี่ยนสี (0–360)</label><input id="me_tint" type="range" min="0" max="360" value="${d.tint || 0}" oninput="$('me_tintv').textContent=this.value+'°'"><small id="me_tintv" class="muted">${d.tint || 0}°</small></div>
      <div><label>ขนาด (0.5–3 เท่า)</label><input id="me_scale" type="number" step="0.1" min="0.5" max="3" value="${d.scale ?? 1}"></div>
    </div>
    ${imgField("mob", d.img, 220, "รูปมอน · เกมใส่อนิเมชันให้เอง (หายใจ · เดินเด้งโยก · โน้มตัวพุ่งตอนโจมตี)" + (bi ? "" : " · ไม่ใส่รูป = ใช้หน้าตาหมูป่า"))}
    <label class="chk" style="margin:-4px 0 6px"><input type="checkbox" id="me_imgFlip" ${d.imgFlip ? "checked" : ""}> รูปต้นฉบับหันไปทางซ้าย (ติ๊กเพื่อกลับด้านให้ถูก)</label>
    <div class="sub">ค่าพลัง <button class="btn sm ghost" onclick="mobAuto()" style="margin-left:8px">✨ ใส่ค่าแนะนำตามเลเวล</button></div>
    <div class="grid">
      ${n("lvl", "เลเวล", 5, 'min="1" max="999"')}${n("hp", "HP", 200, 'min="1"')}${n("atkMin", "ATK ต่ำสุด", 10)}${n("atkMax", "ATK สูงสุด", 14)}
      ${n("def", "DEF", 3)}${n("flee", "หลบหลีก", 15)}${n("exp", "EXP ที่ให้", 90)}${n("zenyMin", "เบี้ยต่ำสุด", 5)}${n("zenyMax", "เบี้ยสูงสุด", 15)}
      ${n("speed", "ความเร็วเดิน", 70)}${n("aspd", "ตีทุก (มิลลิวินาที)", 1300)}${n("respawn", "เกิดใหม่ (วินาที)", 12)}${n("r", "ขนาดตัว (8–60)", 15, 'min="8" max="60" title="รัศมีตัวมอน: ยิ่งมากยิ่งตัวใหญ่ คลิกโดนง่าย ต้องยืนห่างขึ้นเวลาตี · หมู 14 · ลิง 15 · พญานาค 40"')}
    </div>
    <div class="row"><label class="chk"><input type="checkbox" id="me_aggro" ${d.aggro ? "checked" : ""}> โจมตีผู้เล่นก่อน</label></div>
    <div class="sub">ของที่ดรอป <button class="btn sm ghost" onclick="addDropRow()" style="margin-left:8px">＋ เพิ่ม</button></div>
    <div class="hint">โอกาสดรอปเป็น % · เช่น 50 = ได้ครึ่งหนึ่งของครั้งที่ฆ่า, 1 = ฆ่าประมาณ 100 ตัวได้ 1 ชิ้น</div>
    <div id="me_drops"></div>
    <div class="formActs">
      <button class="btn green" onclick="saveMob()">💾 บันทึก</button>
      ${builtinButtons("mob", id, bi, ov, d.name)}
    </div>`;
  for (const [it, c] of d.drops || []) addDropRow(it, c * 100);
}
function addMatRow(item = "fur", n = 1) {
  const div = document.createElement("div"); div.className = "row";
  div.innerHTML = `<select class="mt_item">${allItems().filter(x => x.type !== "book").map(x => opt(x.id, `${x.icon} ${x.name}${x.custom ? " ★" : ""}`, item)).join("")}</select>
    <label class="muted" style="font-size:12px">×</label><input class="mt_n" type="number" min="1" max="999" value="${n}" style="max-width:80px">
    <button class="btn sm red" onclick="this.parentNode.remove()">✕</button>`;
  $("ie_mats").appendChild(div);
}
function addDropRow(item = "", pct = 10) {
  const div = document.createElement("div"); div.className = "row";
  div.innerHTML = `<select class="dr_item">${allItems().map(x => opt(x.id, `${x.icon} ${x.name}${x.grade ? " [" + GRADES[x.grade][0] + "]" : ""}${x.custom ? " ★" : ""}`, item)).join("")}</select>
    <input class="dr_pct" type="number" step="0.1" min="0.01" max="100" value="${+(+pct).toFixed(2)}" style="max-width:90px"> <span class="muted">%</span>
    <button class="btn sm red" onclick="this.parentNode.remove()">✕</button>`;
  $("me_drops").appendChild(div);
}
async function saveMob() {
  const id = val("me_id").trim().toLowerCase();
  if (!idOk(id)) return toast("รหัสต้องเป็นอังกฤษตัวเล็ก ตัวเลข หรือ _ ยาว 2–32 ตัว", true);
  if (taken("mob", id) && id !== curMob) return toast("รหัสนี้ซ้ำกับมอนเดิมในเกม", true);
  if (id !== curMob && content.mob[id]) return toast("มีมอนรหัสนี้แล้ว", true);
  const d = { name: val("me_name").trim(), look: val("me_look"), tint: numv("me_tint"), scale: numv("me_scale", 1), aggro: $("me_aggro").checked, boss: val("me_kind") === "boss", imgFlip: $("me_imgFlip").checked };
  if (pickedImg.mob) d.img = pickedImg.mob;
  for (const k of ["lvl", "hp", "atkMin", "atkMax", "def", "flee", "exp", "zenyMin", "zenyMax", "speed", "aspd", "respawn", "r"]) d[k] = numv("me_" + k);
  d.drops = [...document.querySelectorAll("#me_drops .row")].map(r => [r.querySelector(".dr_item").value, Math.min(1, Math.max(0, Number(r.querySelector(".dr_pct").value) / 100))]).filter(x => x[1] > 0);
  if (!d.name) return toast("ใส่ชื่อมอนด้วย", true);
  if (await saveContent("mob", id, d, curMob)) editMob(id);
}

// ---------- แผนที่: ตัววาดแผนที่ ----------
const W = 2560, H = 1920, CS = 640 / W;   // ขนาดโลกในเกม / อัตราย่อบนแคนวาส
let curMap = null, MD = null, tool = "clear", drag = null, pathDraft = null, undoStack = [];
function smoothPath(pts, n) {   // ถนนโค้งแบบเดียวกับในเกม
  let p = pts.map(q => [q[0], q[1]]);
  for (let k = 0; k < n && p.length >= 3; k++) {
    const o = [p[0]];
    for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); }
    o.push(p[p.length - 1]); p = o;
  }
  return p;
}
function shapePath(g, s, k) {   // เหมือนในเกม (ขอบหยักแบบเดียวกัน)
  if (s.rect) { const [x1, y1, x2, y2] = s.rect; g.fillRect(x1 * k, y1 * k, (x2 - x1) * k, (y2 - y1) * k); return; }
  if (s.path) { const P = smoothPath(s.path, MD ? MD.roadSmooth ?? 3 : 3); g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = s.w * k; g.beginPath(); g.moveTo(P[0][0] * k, P[0][1] * k); for (const p of P.slice(1)) g.lineTo(p[0] * k, p[1] * k); g.stroke(); return; }
  const ph = s.ph || 0; g.beginPath();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, r = 1 + 0.12 * Math.sin(3 * a + ph) + 0.07 * Math.sin(7 * a + ph * 2.3); const x = (s.x + Math.cos(a) * s.rx * r) * k, y = (s.y + Math.sin(a) * s.ry * r) * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.fill();
}
function walkTest(shapes) {   // ฟังก์ชันเช็กว่าจุดเดินได้ไหม (แบบเดียวกับในเกม)
  const c = document.createElement("canvas"); c.width = W / 8; c.height = H / 8;
  const g = c.getContext("2d"); g.fillStyle = g.strokeStyle = "#fff";
  for (const s of shapes) shapePath(g, s, 1 / 8);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  return (x, y) => { const i = Math.floor(x / 8), j = Math.floor(y / 8); return i >= 0 && j >= 0 && i < c.width && j < c.height && d[(j * c.width + i) * 4 + 3] > 140; };
}
function drawShapes(g, shapes, k, fill = "#d9c08a") {
  g.fillStyle = "#2c5a24"; g.fillRect(0, 0, W * k, H * k);
  g.fillStyle = g.strokeStyle = fill;
  for (const s of shapes) shapePath(g, s, k);
}
function renderMapList() {
  const ids = Object.keys(content.map).filter(id => !isBuiltinMap(id)).sort();
  $("mapList").innerHTML = ids.length ? ids.map(id => { const d = content.map[id]; return `<div class="li ${curMap === id ? "on" : ""}" onclick="editMap('${id}')"><span class="ic">🗺️</span><span class="t">${esc(d.name)}<small>${(THEME_NAMES[d.theme] || "").slice(3)} · มอน ${(d.spawns || []).reduce((s, x) => s + (x.count || 0), 0)} ตัว</small></span></div>`; }).join("")
    : `<div class="empty" style="padding:14px">ยังไม่มี</div>`;
  $("builtinMaps").innerHTML = Object.entries(BUILTIN_MAPS).map(([id, b]) => `<div class="li ${curMap === id ? "on" : ""}" style="cursor:pointer" onclick="editMap('${id}')"><span class="ic">🏯</span><span class="t">${esc((content.map[id] && content.map[id].name) || b.name)} ${statusTag(content.map[id])}<small>${id}</small></span></div>`).join("");
}
// จุดที่ย้ายไม่ได้ในแผนที่เดิม (ต้องอยู่บนพื้นที่เดินได้เสมอ) + โซนมอนเดิม
const BUILTIN_FIXED = {
  main: { points: [[330, 430, "🏠 จุดเกิดในเมือง"], [2430, 740, "🌀 ประตูไปหุบเขาหมอก"]], town: [0, 0, 640, 560],
    zones: [[690, 60, 1280, 1200, "หมู · ไก่"], [60, 620, 620, 1200, "หมู · ไก่"], [1340, 60, 1980, 860, "ลิง · งู"], [60, 1340, 1300, 1860, "ลิง · งู"], [1340, 1480, 1880, 1860, "งู"], [2040, 60, 2520, 1420, "กระสือ"], [1340, 940, 1980, 1420, "กระสือ · ลิง"], [2120, 1590, 2180, 1650, "🐉 พญานาค"]] },
  valley: { points: [[120, 960, "🌀 ประตูกลับเมือง"]],
    zones: [[700, 360, 1100, 700, "งูจงอาง"], [1180, 760, 1640, 1120, "กระสือ · ลิง"], [1300, 1360, 1760, 1680, "ลิงป่า"], [1860, 760, 2100, 960, "งูจงอาง"], [2020, 220, 2460, 560, "กระสือเฒ่า"]] },
};
const isBuiltinMap = id => id === "main" || id === "valley";
const NPC_LIST = { shop: "🛒 นายมั่น พ่อค้า", monk: "🪷 หลวงพ่อทอง", smith: "🔨 ช่างเหล็กแก้ว", guard: "💂 ขุนศึกเพชร (ภารกิจ)", tailor: "🧵 แม่ทองทอผ้า", jeweler: "💍 เฮียกิมช่างทอง", shaman: "🔮 หมอผีเฒ่าจันทร์ (ล้างแต้มวิชา)" };
const DEFAULT_NPCS = [{ id: "shop", x: 250, y: 372 }, { id: "monk", x: 320, y: 222 }, { id: "smith", x: 236, y: 462 }, { id: "guard", x: 620, y: 292 }, { id: "tailor", x: 404, y: 452 }, { id: "jeweler", x: 402, y: 362 }, { id: "shaman", x: 60, y: 290 }];
// มอนเดิมของแผนที่เดิม (กรอบ + จำนวน) ใช้ตอนแปลงให้ย้าย/แก้ได้
const DEFAULT_SPAWNS = {
  main: [[690, 60, 1280, 1200, { pig: 10, rooster: 4 }], [60, 620, 620, 1200, { pig: 6, rooster: 3 }], [1340, 60, 1980, 860, { monkey: 7, cobra: 3 }], [60, 1340, 1300, 1860, { monkey: 6, cobra: 4 }],
         [1340, 1480, 1880, 1860, { cobra: 4 }], [2040, 60, 2520, 1420, { kraseu: 8 }], [1340, 940, 1980, 1420, { kraseu: 4, monkey: 2 }], [2150, 1620, 2150, 1620, { naga: 1 }]],
  valley: [[380, 820, 540, 1100, { deer: 4 }], [700, 360, 1100, 700, { dhole: 6, shroom: 3 }], [1180, 760, 1640, 1120, { owl: 4, kongkoi: 4, shroom: 2 }], [1300, 1360, 1760, 1680, { centipede: 4, scorpion: 4, bear: 2 }], [2020, 220, 2460, 560, { pob: 4, tiger: 4, bear: 1 }], [2110, 800, 2110, 800, { yak: 1 }]],
};
function convertDefaultMobs() {
  if (!DEFAULT_SPAWNS[curMap]) return;
  pushUndo();
  for (const [x1, y1, x2, y2, mobs] of DEFAULT_SPAWNS[curMap]) {
    const types = Object.entries(mobs), cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, R = x1 === x2 ? 30 : Math.max(60, Math.min(x2 - x1, y2 - y1) / 2);
    types.forEach(([mob, count], i) => MD.spawns.push({ mob, count, r: Math.round(R), x: Math.round(cx + (types.length > 1 ? (i ? 1 : -1) * R * 0.35 : 0)), y: Math.round(cy) }));
  }
  MD.noDefaultMobs = true;
  if ($("mp_noDef")) $("mp_noDef").checked = true;
  setTool("move"); drawMap();
  toast("แปลงแล้ว · ใช้เครื่องมือ ✋ ลากย้าย หรือคลิกเพื่อแก้จำนวน/ชนิดมอน");
}
function editMap(id) {
  curMap = id; renderMapList(); undoStack = []; pathDraft = null;
  const bi = isBuiltinMap(id), ov = id && content.map[id];
  MD = ov ? JSON.parse(JSON.stringify(ov))
    : bi ? { name: BUILTIN_MAPS[id].name, sub: "", shapes: JSON.parse(JSON.stringify(BUILTIN_MAPS[id].shapes)), spawns: [], portals: [], ponds: id === "valley" ? [{ x: 1980, y: 880, rx: 70, ry: 44 }] : [], spawn: id === "valley" ? { x: 250, y: 960 } : { x: 330, y: 430 }, noDefaultMobs: false }
    : id ? JSON.parse(JSON.stringify(content.map[id])) : { name: "", sub: "", theme: "meadow", decor: 10, spawn: { x: 400, y: 960 }, shapes: [{ x: 400, y: 960, rx: 260, ry: 220, ph: 1 }], spawns: [], portals: [], ponds: [], entry: null };
  MD.shapes ||= []; MD.spawns ||= []; MD.portals ||= []; MD.ponds ||= [];
  if (id === "main") MD.spawn = { x: 330, y: 430 };   // จุดเกิดในเมืองย้ายไม่ได้
  if (!Array.isArray(MD.npcs)) MD.npcs = id === "main" ? JSON.parse(JSON.stringify(DEFAULT_NPCS)) : [];
  $("mapForm").innerHTML = `<h2>${bi ? "แก้ไขแผนที่เดิมในเกม" : id ? "แก้ไขแผนที่" : "สร้างแผนที่ใหม่"}</h2>
    ${bi ? `<div class="note" style="margin:0 0 10px">${ov ? "แก้ไขไว้แล้ว · " : ""}ปรับรูปทรง เพิ่ม/ลบลาน ทางเดิน บึง จุดเกิดมอน และประตูได้ · จุดสีเหลือง (NPC / ประตูเดิม) ย้ายไม่ได้แต่ต้องอยู่บนพื้นที่เดินได้${id === "main" ? " · ในเมืองควรเว้นไว้ตามเดิม" : ""}</div>` : ""}
    <div class="grid">
      <input id="mp_id" type="hidden" value="${esc(id || newId("mp"))}">
      ${id === "main" ? "" : `<div><label>ชื่อแผนที่</label><input id="mp_name" maxlength="30" value="${esc(MD.name)}"></div>
      <div><label>คำอธิบายใต้ชื่อ</label><input id="mp_sub" maxlength="80" value="${esc(MD.sub || "")}" placeholder="เช่น ศัตรู Lv 20–25"></div>`}
      ${bi ? `<div style="align-self:end"><label class="chk"><input type="checkbox" id="mp_noDef" onchange="MD.noDefaultMobs=this.checked;drawMap()" ${MD.noDefaultMobs ? "checked" : ""}> เอามอนเดิมออกทั้งหมด</label></div>` : `<div><label>บรรยากาศ</label><select id="mp_theme">${Object.entries(THEME_NAMES).map(([k, l]) => opt(k, l, MD.theme)).join("")}</select></div>
      <div><label>ต้นไม้ประดับ (0–60)</label><input id="mp_decor" type="number" min="0" max="60" value="${MD.decor ?? 10}"></div>`}
      <div><label>ความโค้งของถนน <small id="mp_rsv" class="muted">${["เส้นตรงหักมุม", "โค้งนิดหน่อย", "โค้งพอดี", "โค้งมาก", "โค้งนุ่มสุด"][MD.roadSmooth ?? 3]}</small></label>
        <input type="range" min="0" max="4" step="1" value="${MD.roadSmooth ?? 3}" oninput="MD.roadSmooth=+this.value;$('mp_rsv').textContent=['เส้นตรงหักมุม','โค้งนิดหน่อย','โค้งพอดี','โค้งมาก','โค้งนุ่มสุด'][this.value];drawMap()"></div>
      <div><label>ขอบถนน/บึงขรุขระ <small id="mp_erv" class="muted">${MD.edgeRough ?? 5}/10</small></label>
        <input type="range" min="0" max="10" step="1" value="${MD.edgeRough ?? 5}" oninput="MD.edgeRough=+this.value;$('mp_erv').textContent=this.value+'/10'"></div>
    </div>
    <div class="hint">ถนนจะโค้งตามจุดที่วาด (ไม่หักมุม) · บึงเป็นรูปทรงธรรมชาติ ไม่ใช่วงรีเป๊ะ · 0 = เรียบ/ตรงแบบเดิม</div>
    <div class="sub">วาดแผนที่ <span class="muted" style="font-family:Sarabun;font-size:12px">(สีเขียว = ป่าทึบเดินไม่ได้ · สีทราย = พื้นที่เดินได้)</span></div>
    <div class="tools" id="mp_tools">
      ${[["clear", "🟢 ลานโล่ง"], ["path", "〰️ ทางเดิน"], ["pond", "💧 บึงน้ำ"], ["spawn", "👾 จุดเกิดมอน"], ["portal", "🌀 ประตูมิติ"], ["start", "⭐ จุดเริ่ม"], ["npc", "🧑 NPC"], ["move", "✋ ย้าย / แก้"], ["erase", "🗑 ลบ"]].map(([k, l]) => `<button data-t="${k}" class="${tool === k ? "on" : ""}" onclick="setTool('${k}')">${l}</button>`).join("")}
      <button onclick="undoMap()">↶ ย้อน</button>
      ${bi ? `<button onclick="convertDefaultMobs()" title="เอามอนเดิมมาเป็นจุดเกิดที่ลากย้าย/แก้จำนวนได้">✏️ แปลงมอนเดิมให้แก้ได้</button>` : ""}
    </div>
    <div id="mp_toolOpts"></div>
    <canvas id="mp_canvas" class="mapCanvas" width="640" height="480"></canvas>
    <div class="hint" id="mp_status"></div>
    <div ${bi ? 'style="display:none"' : ""}>
    <div class="sub">ทางเข้าแผนที่นี้</div>
    <div class="hint">เลือกแผนที่ที่จะวางประตูทางเข้า แล้วคลิกบนภาพเล็กด้านล่าง · ผู้เล่นเดินเข้าประตูนั้นจะมาโผล่ที่ ⭐ จุดเริ่ม</div>
    <div class="row" style="max-width:420px"><select id="mp_entryMap" onchange="drawEntry()">${opt("", "— ไม่มีทางเข้า —", MD.entry && MD.entry.map)}${allMaps().filter(([k]) => k !== id).map(([k, n]) => opt(k, n, MD.entry && MD.entry.map)).join("")}</select></div>
    <canvas id="mp_entry" class="miniCanvas" width="320" height="240"></canvas>
    </div>
    <div class="formActs">
      <button class="btn green" onclick="saveMap()">💾 บันทึก</button>
      ${bi ? (ov ? `<button class="btn ghost" onclick="resetBuiltin('map','${id}')">🔄 คืนแผนที่เดิม</button>` : "")
        : id ? `<button class="btn red" onclick="deleteContent('map','${id}','${esc(MD.name)}').then(ok=>ok&&($('mapForm').innerHTML='<div class=empty>ลบแล้ว</div>'))">🗑 ลบ</button>` : ""}
    </div>`;
  const cv = $("mp_canvas");
  cv.onpointerdown = mapDown; cv.onpointermove = mapMove; cv.onpointerup = mapUp; cv.ondblclick = () => finishPath();
  $("mp_entry").onclick = entryClick;
  setTool(tool); drawMap(); drawEntry();
}
function setTool(t) {
  if (tool === "path" && t !== "path") finishPath();
  tool = t;
  for (const b of document.querySelectorAll("#mp_tools button[data-t]")) b.classList.toggle("on", b.dataset.t === t);
  const o = $("mp_toolOpts");
  if (t === "path") o.innerHTML = `<div class="row" style="max-width:520px"><label class="muted" style="font-size:12px">ความกว้างทาง</label><input id="mp_pw" type="range" min="80" max="360" value="${o.dataset.pw || 180}" oninput="this.parentNode.parentNode.dataset.pw=this.value"><button class="btn sm" onclick="finishPath()">✔ จบเส้นทาง</button></div><div class="hint">คลิกทีละจุดเพื่อลากเส้นทาง · ดับเบิลคลิกหรือกด "จบเส้นทาง" เมื่อเสร็จ</div>`;
  else if (t === "spawn") o.innerHTML = `<div class="row" style="max-width:560px"><select id="mp_mob">${allMobs().map(m => opt(m.id, `${m.name} Lv${m.lvl}${m.custom ? " ★" : ""}`, o.dataset.mob)).join("")}</select>
      <label class="muted" style="font-size:12px">จำนวน</label><input id="mp_cnt" type="number" min="1" max="30" value="5" style="max-width:70px">
      <label class="muted" style="font-size:12px">รัศมี</label><input id="mp_rad" type="number" min="30" max="800" value="180" style="max-width:80px"></div><div class="hint">คลิกบนพื้นที่เดินได้เพื่อวางจุดเกิดมอน</div>`;
  else if (t === "portal") o.innerHTML = `<div class="row" style="max-width:520px"><label class="muted" style="font-size:12px">ไปที่</label><select id="mp_to">${allMaps().filter(([k]) => k !== curMap).map(([k, n]) => opt(k, n, "main")).join("")}</select><input id="mp_plabel" placeholder="ป้าย เช่น ← กลับเมือง" maxlength="30"></div><div class="hint">คลิกเพื่อวางประตูมิติ (ควรวางชิดขอบลาน)</div>`;
  else if (t === "move") o.innerHTML = `<div class="hint">ลากจุดเกิดมอน / NPC / ประตู / บึง เพื่อย้าย · คลิกจุดเกิดมอนเพื่อเปลี่ยนชนิด จำนวน และรัศมี</div><div id="mp_edit"></div>`;
  else if (t === "npc") o.innerHTML = `<div class="row" style="max-width:420px"><select id="mp_npc">${Object.entries(NPC_LIST).map(([k, l]) => opt(k, l, o.dataset.npc)).join("")}</select></div><div class="hint">คลิกบนพื้นที่เดินได้เพื่อวาง NPC (วางคนเดิมซ้ำในหลายแผนที่ได้) · ใช้ ✋ ลากย้าย · 🗑 ลบ</div>`;
  else o.innerHTML = { clear: `<div class="hint">กดค้างแล้วลากเพื่อสร้างลานโล่ง (ลากออกแนวนอน/แนวตั้งเพื่อกำหนดความกว้าง/สูง)</div>`, pond: `<div class="hint">กดค้างแล้วลากเพื่อวางบึงน้ำ (ผู้เล่นเดินผ่านได้ เป็นฉาก)</div>`, start: `<div class="hint">คลิกเพื่อวางจุดที่ผู้เล่นโผล่เมื่อเข้าแผนที่นี้</div>`, erase: `<div class="hint">คลิกที่สิ่งที่ต้องการลบ</div>` }[t] || "";
}
const toWorld = e => { const r = e.target.getBoundingClientRect(); return { x: Math.round((e.clientX - r.left) / r.width * W), y: Math.round((e.clientY - r.top) / r.height * H) }; };
const pushUndo = () => { undoStack.push(JSON.stringify(MD)); if (undoStack.length > 40) undoStack.shift(); };
function undoMap() { if (pathDraft) { pathDraft = null; return drawMap(); } const s = undoStack.pop(); if (s) { MD = JSON.parse(s); drawMap(); } }
let moveObj = null;
function pickObj(p) {   // สิ่งที่อยู่ใกล้จุดที่คลิก (จุดเกิดมอน → ประตู → บึง)
  const near = (o, r) => Math.hypot(o.x - p.x, o.y - p.y) < r;
  const npc = (MD.npcs || []).find(o => near(o, 45)); if (npc) return { ref: npc, type: "npc" };
  const s = MD.spawns.filter(o => near(o, Math.max(50, Math.min(o.r, 160))))
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];   // เลือกจุดที่ใกล้ที่สุด
  if (s) return { ref: s, type: "spawn" };
  const pt = MD.portals.find(o => near(o, 60)); if (pt) return { ref: pt, type: "portal" };
  const pd = MD.ponds.find(o => near(o, Math.max(o.rx, o.ry))); if (pd) return { ref: pd, type: "pond" };
  return null;
}
function spawnEditor(s) {
  const box = $("mp_edit"); if (!box) return;
  if (!s) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="row" style="max-width:640px;background:rgba(0,0,0,.25);padding:6px 8px;border-radius:9px;margin-bottom:6px">
    <b style="font-size:12px;white-space:nowrap">👾 จุดนี้:</b>
    <select id="se_mob">${allMobs().map(m => opt(m.id, `${m.name} Lv${m.lvl}`, s.mob)).join("")}</select>
    <label class="muted" style="font-size:12px">จำนวน</label><input id="se_cnt" type="number" min="1" max="30" value="${s.count}" style="max-width:64px">
    <label class="muted" style="font-size:12px">รัศมี</label><input id="se_rad" type="number" min="20" max="800" value="${s.r}" style="max-width:74px">
    <button class="btn sm red" id="se_del">ลบ</button></div>`;
  const apply = () => { s.mob = val("se_mob"); s.count = Math.max(1, Math.min(30, numv("se_cnt", 1))); s.r = Math.max(20, Math.min(800, numv("se_rad", 100))); drawMap(); };
  for (const id of ["se_mob", "se_cnt", "se_rad"]) $(id).onchange = () => { pushUndo(); apply(); };
  $("se_del").onclick = () => { pushUndo(); MD.spawns.splice(MD.spawns.indexOf(s), 1); spawnEditor(null); drawMap(); };
}
function mapDown(e) {
  const p = toWorld(e);
  if (tool === "move") {
    const hit = pickObj(p);
    if (hit) { pushUndo(); moveObj = { ...hit, dx: hit.ref.x - p.x, dy: hit.ref.y - p.y, moved: false }; e.target.setPointerCapture(e.pointerId); }
    else spawnEditor(null);
    return;
  }
  if (tool === "clear" || tool === "pond") { drag = { x: p.x, y: p.y, rx: 20, ry: 20 }; e.target.setPointerCapture(e.pointerId); }
  else if (tool === "path") { pathDraft ||= { path: [], w: Number($("mp_pw").value) }; pathDraft.path.push([p.x, p.y]); }
  else if (tool === "spawn") { pushUndo(); MD.spawns.push({ mob: val("mp_mob"), x: p.x, y: p.y, r: numv("mp_rad", 180), count: numv("mp_cnt", 5) }); $("mp_toolOpts").dataset.mob = val("mp_mob"); }
  else if (tool === "portal") { pushUndo(); MD.portals.push({ x: p.x, y: p.y, to: val("mp_to"), label: val("mp_plabel").trim() }); }
  else if (tool === "npc") { pushUndo(); MD.npcs.push({ id: val("mp_npc"), x: p.x, y: p.y }); $("mp_toolOpts").dataset.npc = val("mp_npc"); }
  else if (tool === "start") { if (curMap === "main") return toast("จุดเกิดในเมืองย้ายไม่ได้", true); pushUndo(); MD.spawn = { x: p.x, y: p.y }; }
  else if (tool === "erase") eraseAt(p);
  drawMap();
}
function mapMove(e) {
  const p = toWorld(e);
  if (moveObj) {
    const nx = Math.round(p.x + moveObj.dx), ny = Math.round(p.y + moveObj.dy);
    if (Math.abs(nx - moveObj.ref.x) + Math.abs(ny - moveObj.ref.y) > 2) moveObj.moved = true;
    moveObj.ref.x = Math.max(0, Math.min(W, nx)); moveObj.ref.y = Math.max(0, Math.min(H, ny));
    drawMap(); return;
  }
  if (drag) { drag.rx = Math.max(40, Math.abs(p.x - drag.x)); drag.ry = Math.max(40, Math.abs(p.y - drag.y)); drawMap(); }
  else if (tool === "path" && pathDraft) { pathDraft.hover = [p.x, p.y]; drawMap(); }
}
function mapUp() {
  if (moveObj) {
    if (!moveObj.moved) { undoStack.pop(); if (moveObj.type === "spawn") spawnEditor(moveObj.ref); }
    moveObj = null; drawMap(); return;
  }
  if (!drag) return;
  pushUndo();
  if (tool === "clear") MD.shapes.push({ x: drag.x, y: drag.y, rx: drag.rx, ry: drag.ry, ph: Math.round(Math.random() * 60) / 10 });
  else MD.ponds.push({ x: drag.x, y: drag.y, rx: Math.min(400, drag.rx), ry: Math.min(300, drag.ry) });
  drag = null; drawMap();
}
function finishPath() {
  if (pathDraft && pathDraft.path.length >= 2) { pushUndo(); MD.shapes.push({ path: pathDraft.path, w: pathDraft.w }); }
  pathDraft = null; drawMap();
}
function eraseAt(p) {
  const near = (x, y, r) => Math.hypot(x - p.x, y - p.y) < r;
  const segDist = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(a[0] + dx * t - p.x, a[1] + dy * t - p.y); };
  pushUndo();
  let i = (MD.npcs || []).findIndex(o => near(o.x, o.y, 45)); if (i >= 0) return MD.npcs.splice(i, 1);
  i = MD.portals.findIndex(o => near(o.x, o.y, 60)); if (i >= 0) return MD.portals.splice(i, 1);
  i = MD.spawns.findIndex(o => near(o.x, o.y, Math.max(60, o.r * 0.6))); if (i >= 0) return MD.spawns.splice(i, 1);
  i = MD.ponds.findIndex(o => near(o.x, o.y, Math.max(o.rx, o.ry))); if (i >= 0) return MD.ponds.splice(i, 1);
  for (let k = MD.shapes.length - 1; k >= 0; k--) {
    const s = MD.shapes[k];
    if (s.path ? s.path.some((q, j) => j && segDist(s.path[j - 1], q) < s.w / 2) : Math.hypot((p.x - s.x) / s.rx, (p.y - s.y) / s.ry) < 1) return MD.shapes.splice(k, 1);
  }
  undoStack.pop();
}
function drawMap() {
  const cv = $("mp_canvas"); if (!cv) return;
  const g = cv.getContext("2d"), k = CS;
  drawShapes(g, MD.shapes, k);
  if (pathDraft && pathDraft.path.length) {   // เส้นทางที่กำลังวาด
    const pts = [...pathDraft.path, ...(pathDraft.hover ? [pathDraft.hover] : [])];
    g.globalAlpha = .6; g.strokeStyle = "#f2e0a8"; shapePath(g, { path: pts, w: Number(($("mp_pw") || {}).value || pathDraft.w) }, k); g.globalAlpha = 1;
    g.fillStyle = "#fff"; for (const q of pathDraft.path) { g.beginPath(); g.arc(q[0] * k, q[1] * k, 3, 0, 7); g.fill(); }
  }
  if (drag) { g.globalAlpha = .6; g.fillStyle = tool === "pond" ? "#4aa3b8" : "#f2e0a8"; shapePath(g, { x: drag.x, y: drag.y, rx: drag.rx, ry: drag.ry }, k); g.globalAlpha = 1; }
  for (const p of MD.ponds) { g.fillStyle = "#3a8591"; g.beginPath(); g.ellipse(p.x * k, p.y * k, p.rx * k, p.ry * k, 0, 0, 7); g.fill(); }
  const ok = walkTest(MD.shapes), mobName = id => (allMobs().find(m => m.id === id) || { name: "?" }).name;
  let bad = 0;
  g.font = "600 11px Sarabun, sans-serif"; g.textAlign = "center";
  for (const s of MD.spawns) {
    const good = ok(s.x, s.y); if (!good) bad++;
    g.fillStyle = good ? "rgba(255,80,80,.25)" : "rgba(255,0,0,.5)"; g.strokeStyle = "#ff5a5a"; g.lineWidth = 1.5;
    g.beginPath(); g.arc(s.x * k, s.y * k, s.r * k, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.fillText(`👾 ${mobName(s.mob)} ×${s.count}`, s.x * k, s.y * k + 4);
  }
  for (const p of MD.portals) {
    const good = ok(p.x, p.y); if (!good) bad++;
    g.fillStyle = good ? "#b69cff" : "#ff3b3b"; g.beginPath(); g.arc(p.x * k, p.y * k, 7, 0, 7); g.fill(); g.strokeStyle = "#fff"; g.stroke();
    g.fillStyle = "#fff"; g.fillText(`🌀 → ${(allMaps().find(([m]) => m === p.to) || [0, "?"])[1]}`, p.x * k, p.y * k - 11);
  }
  if (MD.spawn && curMap !== "main") {
    const good = ok(MD.spawn.x, MD.spawn.y); if (!good) bad++;
    g.font = "18px sans-serif"; g.fillText("⭐", MD.spawn.x * k, MD.spawn.y * k + 6);
  }
  g.font = "600 11px Sarabun, sans-serif";
  for (const n of MD.npcs || []) {   // NPC
    const good = ok(n.x, n.y); if (!good) bad++;
    g.fillStyle = good ? "#5bd1ff" : "#ff3b3b"; g.beginPath(); g.arc(n.x * k, n.y * k, 5.5, 0, 7); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = "#e6f7ff"; g.fillText(NPC_LIST[n.id] || n.id, n.x * k, n.y * k - 9);
  }
  const fx = BUILTIN_FIXED[curMap];
  if (fx) {   // แผนที่เดิม: เมือง โซนมอนเดิม และจุดที่ย้ายไม่ได้
    g.font = "600 10px Sarabun, sans-serif";
    if (!(MD.noDefaultMobs || ($("mp_noDef") && $("mp_noDef").checked))) for (const [x1, y1, x2, y2, label] of fx.zones) {
      g.setLineDash([4, 3]); g.strokeStyle = "rgba(255,210,120,.55)"; g.lineWidth = 1; g.strokeRect(x1 * k, y1 * k, (x2 - x1) * k, (y2 - y1) * k); g.setLineDash([]);
      g.fillStyle = "rgba(255,230,170,.8)"; g.fillText("มอนเดิม: " + label, (x1 + x2) / 2 * k, y1 * k + 11);
    }
    if (fx.town) { g.strokeStyle = "#e8c98a"; g.lineWidth = 2; g.strokeRect(0, 0, fx.town[2] * k, fx.town[3] * k); g.fillStyle = "#fff4d6"; g.fillText("🏯 เมือง", fx.town[2] * k / 2, 14); }
    for (const [x, y, label] of fx.points) {
      const good = ok(x, y); if (!good) bad++;
      g.fillStyle = good ? "#ffd23f" : "#ff3b3b"; g.beginPath(); g.arc(x * k, y * k, 4.5, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.fillText(label, x * k, y * k - 8);
    }
  }
  $("mp_status").innerHTML = bad ? `<span style="color:#ff8a7a">⚠ มี ${bad} จุดอยู่ในป่าทึบ (สีแดง) — ย้ายไปวางบนพื้นที่เดินได้</span>` : `ลาน/ทาง ${MD.shapes.length} · จุดเกิดมอน ${MD.spawns.length} · ประตู ${MD.portals.length}`;
}
function entryShapes(mapId) { return content.map[mapId] && content.map[mapId].shapes ? content.map[mapId].shapes : BUILTIN_MAPS[mapId] ? BUILTIN_MAPS[mapId].shapes : (content.map[mapId] && content.map[mapId].shapes) || []; }
function drawEntry() {
  const cv = $("mp_entry"), m = val("mp_entryMap"); if (!cv) return;
  const g = cv.getContext("2d"), k = 320 / W;
  if (!m) { g.fillStyle = "#1a0e06"; g.fillRect(0, 0, 320, 240); g.fillStyle = "#b9a47c"; g.font = "13px Sarabun"; g.textAlign = "center"; g.fillText("ไม่มีทางเข้า (เข้าได้จากประตูในแผนที่อื่นที่คุณสร้าง)", 160, 124); return; }
  drawShapes(g, entryShapes(m), k);
  if (MD.entry && MD.entry.map === m) { g.fillStyle = "#b69cff"; g.beginPath(); g.arc(MD.entry.x * k, MD.entry.y * k, 6, 0, 7); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke(); }
}
function entryClick(e) {
  const m = val("mp_entryMap"); if (!m) return;
  const p = toWorld(e);
  if (!walkTest(entryShapes(m))(p.x, p.y)) return toast("ตรงนั้นเป็นป่าทึบ วางบนพื้นที่เดินได้", true);
  MD.entry = { map: m, x: p.x, y: p.y }; drawEntry();
}
async function saveMap() {
  finishPath();
  const id = val("mp_id").trim().toLowerCase();
  if (isBuiltinMap(id) && id === curMap) {   // แผนที่เดิม: เก็บเป็นค่าทับ
    if (!MD.shapes.length) return toast("วาดพื้นที่เดินได้อย่างน้อย 1 ลาน", true);
    const ok = walkTest(MD.shapes);
    const bad = BUILTIN_FIXED[id].points.find(([x, y]) => !ok(x, y));
    if (bad) return toast(`${bad[2]} อยู่ในป่าทึบ — ขยายพื้นที่ให้ครอบจุดสีเหลืองทุกจุด`, true);
    if (id === "valley" && !ok(MD.spawn.x, MD.spawn.y)) return toast("⭐ จุดโผล่ต้องอยู่บนพื้นที่เดินได้", true);
    if ([...MD.spawns, ...MD.portals, ...(MD.npcs || [])].some(p => !ok(p.x, p.y))) return toast("มีจุดเกิดมอน / NPC / ประตูอยู่ในป่าทึบ (สีแดง) — ลบหรือย้ายก่อนบันทึก", true);
    if (id === "main" && !MD.npcs.some(n => n.id === "guard")) return toast("เมืองต้องมีขุนศึกเพชรอย่างน้อย 1 คน (ใช้รับ-ส่งภารกิจ)", true);
    if ($("mp_name")) { MD.name = val("mp_name").trim() || BUILTIN_MAPS[id].name; MD.sub = val("mp_sub").trim(); }
    MD.noDefaultMobs = $("mp_noDef").checked; delete MD.entry;
    if (await saveContent("map", id, MD)) editMap(id);
    return;
  }
  if (!idOk(id)) return toast("รหัสต้องเป็นอังกฤษตัวเล็ก ตัวเลข หรือ _ ยาว 2–32 ตัว", true);
  if (taken("map", id)) return toast("ใช้รหัส main / valley ไม่ได้", true);
  if (id !== curMap && content.map[id]) return toast("มีแผนที่รหัสนี้แล้ว", true);
  MD.name = val("mp_name").trim(); MD.sub = val("mp_sub").trim(); MD.theme = val("mp_theme"); MD.decor = numv("mp_decor", 10);
  if (!MD.name) return toast("ใส่ชื่อแผนที่ด้วย", true);
  if (!MD.shapes.length) return toast("วาดพื้นที่เดินได้อย่างน้อย 1 ลาน", true);
  const ok = walkTest(MD.shapes);
  if (!MD.spawn || !ok(MD.spawn.x, MD.spawn.y)) return toast("⭐ จุดเริ่มต้องอยู่บนพื้นที่เดินได้", true);
  if ([...MD.spawns, ...MD.portals, ...(MD.npcs || [])].some(p => !ok(p.x, p.y))) return toast("มีจุดเกิดมอน / NPC / ประตูอยู่ในป่าทึบ (สีแดง) — ลบหรือย้ายก่อนบันทึก", true);
  if (!val("mp_entryMap")) MD.entry = null;
  else if (!MD.entry || MD.entry.map !== val("mp_entryMap")) return toast("คลิกบนภาพเล็กเพื่อวางตำแหน่งทางเข้าด้วย", true);
  if (!MD.entry && !MD.portals.length) return toast("แผนที่นี้ยังไม่มีทางเข้าและทางออก ผู้เล่นจะเข้าไม่ได้", true);
  if (await saveContent("map", id, MD, curMap)) editMap(id);
}

// ---------- วิชา ----------
const SKILL_LINES = [["sword", "ดาบ", "⚔️", "#ff8a3d"], ["mage", "เวท", "🔮", "#b45cff"], ["archer", "ธนู", "🏹", "#4fd66a"], ["priest", "พระ", "🪷", "#ffd23f"], ["thief", "โจร", "🗡️", "#8a8fa0"], ["merchant", "พ่อค้า", "💰", "#3d9bff"]];
const BUILTIN_SKILLS = [["slash","sword",0,0,"ฟันสะบั้น","⚡"],["swordmast","sword",0,1,"เชี่ยวชาญอาวุธ","🗡️"],["iron","sword",0,2,"กายสิทธิ์","💪"],["provoke","sword",0,3,"ยั่วยุ","😤"],["pierce","sword",1,0,"ทวนทะลวงทัพ","🔱"],["magnum","sword",1,1,"ระเบิดเพลิงรอบกาย","💢"],["whirl","sword",2,1,"พายุดาบ","🌀"],["endure","sword",3,2,"กายวชิระ","💎"],["firebolt","mage",0,0,"ลูกไฟ","🔥"],["coldbolt","mage",0,1,"ศรน้ำแข็ง","❄️"],["lightbolt","mage",0,2,"สายฟ้า","⚡"],["focus","mage",0,3,"จิตตานุภาพ","🧘"],["nova","mage",0,4,"ระเบิดเวท","💥"],["fire","mage",1,0,"ไฟบรรลัยกัลป์","☄️"],["stonecurse","mage",1,1,"สาปหิน","🪨"],["thunder","mage",1,2,"อัสนีบาต","🌩️"],["storm","mage",2,1,"พายุหิมะ","🌨️"],["owleye","archer",0,0,"ตาเหยี่ยว","🦉"],["double","archer",0,1,"ยิงคู่","🏹"],["vulture","archer",1,0,"ตาอินทรี","🦅"],["charge","archer",1,1,"ศรสะท้าน","💨"],["concentrate","archer",1,2,"สมาธิพราน","🎯"],["rain","archer",2,1,"ศรพันดอก","🌧️"],["sharp","archer",3,0,"ศรมรณะ","🏹"],["heal","priest",0,0,"คาถาฟื้นกาย","🪷"],["blessing","priest",0,1,"พรประทาน","✨"],["holylight","priest",0,2,"ดวงแก้วศักดิ์สิทธิ์","🔆"],["agiup","priest",1,0,"เร่งฝีเท้า","👟"],["guard","priest",1,1,"คงกระพันชาตรี","🛡️"],["regen","priest",2,0,"น้ำมนต์ต่อเนื่อง","💧"],["magnus","priest",3,1,"แสงพระธรรม","☀️"],["dodge","thief",0,0,"หลบหลีกขั้นสูง","🌪️"],["doubleatk","thief",0,1,"ตีคู่","✌️"],["steal","thief",0,2,"ขโมย","🫳"],["envenom","thief",0,3,"อาบยาพิษ","☠️"],["hide","thief",1,2,"ซ่อนตัว","👤"],["stab","thief",1,1,"แทงจุดตาย","🗡️"],["shadow","thief",2,1,"เงามรณะ","🌑"],["discount","merchant",0,0,"ต่อรองราคา","🏷️"],["overcharge","merchant",0,1,"ปากหวาน","🗣️"],["mammonite","merchant",0,2,"ตาเงินตาทอง","🪙"],["craft","merchant",0,3,"ช่างฝีมือ","🔨"],["luckydrop","merchant",1,0,"โชคลาภ","🍀"],["greed","merchant",1,1,"เก็บเบี้ย","💰"],["tycoon","merchant",2,2,"มหาเศรษฐี","💸"]];
const SKILL_FX = {
  strike: ["⚔️ โจมตีเป้าหมาย", "ตีแรงกว่าปกติเป็น % ของพลังโจมตี (ใช้ได้ทุกอาวุธที่เลือก)"],
  magic: ["🔮 ยิงเวทใส่เป้าหมาย", "ดาเมจเวท = ค่าพื้นฐาน + INT × ตัวคูณ ยิงจากระยะไกล"],
  blast: ["💥 ระเบิดรอบตัว", "โจมตีศัตรูทุกตัวรอบตัวเราในรัศมีที่กำหนด"],
  heal: ["💚 ฟื้นฟู HP", "ฟื้นเลือดตัวเอง = ค่าพื้นฐาน + INT × ตัวคูณ"],
  buff: ["✨ เสริมพลังชั่วคราว", "เพิ่มค่าสถานะ / ATK% / DEF ตามเวลาที่กำหนด"],
  passive: ["🧘 ติดตัว (ทำงานตลอด)", "เพิ่มค่าสถานะ / ATK% / DEF ถาวร ไม่ต้องกดใช้"],
};
const SK_STATUS = { "": "ไม่มี", slow: "🐌 ทำให้ช้า", stun: "💫 ทำให้มึน (บอสไม่โดน)", poison: "☠️ ติดพิษ", knock: "💨 กระเด็น" };
const WEAPON_TYPES = [["none", "มือเปล่า"], ["dagger", "มีด"], ["sword", "ดาบ"], ["spear", "ทวน/ง้าว"], ["bow", "ธนู"], ["beads", "ประคำ"]];
// ข้อมูลวิชาเดิม: [ประเภท, เลเวลสูงสุด, คูลดาวน์, อาวุธ, ต้องมีก่อน, สีกรอบ, SP พื้นฐาน, SP ต่อเลเวล, คำอธิบาย]
const BUILTIN_SKILL_INFO = {"slash":["target",10,0.7,["dagger","sword","spear"],null,2,5,1,"โจมตีแรง 160% แม่นยำ +5"],"swordmast":["passive",10,0,[],null,2,0,0,"ATK +3 เมื่อถือมีด/ดาบ/ทวน"],"iron":["passive",5,0,[],null,2,0,0,"HP สูงสุด +6%"],"provoke":["self",5,1,[],null,2,4,1,"ดึงศัตรูรอบตัวให้มาตีเรา และลด DEF ศัตรู"],"pierce":["target",5,2,["spear"],{"slash":3},3,10,2,"แทง 190% โดนเป้าหมายและศัตรูที่อยู่ติดกัน"],"magnum":["self",5,2,["dagger","sword","spear"],{"slash":5},3,12,2,"ระเบิดรอบตัว 140% และผลักศัตรูกระเด็น"],"whirl":["target",5,2.5,["sword","spear"],{"magnum":3,"swordmast":5},4,14,3,"ฟันกวาด 180% โดนศัตรูทุกตัวรอบเป้าหมาย"],"endure":["buff",5,1,[],{"iron":3,"provoke":3},4,20,0,"ลดดาเมจที่ได้รับ 5% นาน 30 วิ (ต้องใช้คัมภีร์)"],"firebolt":["target",10,1,["beads"],null,2,6,2,"ยิงไฟ 37 + INT×1.8"],"coldbolt":["target",10,1,["beads"],null,2,6,2,"ยิงน้ำแข็ง 30 + INT×1.6 ศัตรูช้าลง 3 วิ"],"lightbolt":["target",10,1.2,["beads"],null,2,8,2,"ฟาดสายฟ้า 44 + INT×1.9"],"focus":["passive",5,0,[],null,2,0,0,"SP สูงสุด +6% · ฟื้น SP เร็วขึ้น 25%"],"nova":["target",5,2,["beads"],null,2,12,2,"ระเบิดพลังเวท ใส่ศัตรูรอบเป้าหมาย"],"fire":["target",5,2.5,["beads"],{"firebolt":4},3,16,3,"ลูกไฟยักษ์ ระเบิดเป็นวงกว้าง"],"stonecurse":["target",5,1.5,["beads"],{"coldbolt":2},3,10,1,"โอกาสให้ศัตรูกลายเป็นหิน 3 วิ"],"thunder":["target",5,3,["beads"],{"lightbolt":4},3,18,3,"ฟ้าผ่า กระจายโดนศัตรูรอบข้าง"],"storm":["target",5,6,["beads"],{"coldbolt":5,"thunder":3},5,40,5,"พายุหิมะวงกว้าง ศัตรูช้าลง + โอกาสแข็งตัว (ต้องใช้คัมภีร์)"],"owleye":["passive",10,0,[],null,2,0,0,"DEX +1"],"double":["target",10,0.9,["bow"],null,2,8,1,"ยิง 2 ดอกติด"],"vulture":["passive",5,0,[],{"owleye":3},3,0,0,"ธนูยิงไกลขึ้น · แม่นยำขึ้น"],"charge":["target",5,2,["bow"],{"double":3},3,12,0,"ยิงแรง ผลักศัตรูกระเด็นไกล"],"concentrate":["buff",5,1,[],{"owleye":1},3,18,0,"DEX และ AGI เพิ่ม นาน 40 วิ"],"rain":["target",5,3,["bow"],{"double":5},4,15,3,"ห่าธนู ใส่ศัตรูทุกตัวรอบเป้าหมาย"],"sharp":["target",5,3,["bow"],{"rain":3,"vulture":5},5,25,4,"ศรทะลุแนว คริติคอลง่าย (ต้องใช้คัมภีร์)"],"heal":["self",10,1,[],null,2,8,2,"ฟื้นฟู HP 35 + INT×2.5"],"blessing":["buff",5,1,[],null,2,20,0,"STR / INT / DEX เพิ่ม นาน 60 วิ"],"holylight":["target",5,1.2,[],null,2,12,1,"ยิงแสงศักดิ์สิทธิ์ · แรง ×2 ใส่ผี"],"agiup":["buff",5,1,[],{"heal":3},3,18,0,"AGI เพิ่ม · วิ่งเร็วขึ้น นาน 60 วิ"],"guard":["buff",5,1,[],{"blessing":3},3,22,2,"โล่รับดาเมจแทน นาน 60 วิ"],"regen":["buff",5,1,[],{"heal":5},4,20,2,"ฟื้น HP ทุกวินาที นาน 20 วิ"],"magnus":["self",5,6,[],{"holylight":3,"regen":3},5,45,5,"แสงศักดิ์สิทธิ์รอบตัว (ต้องใช้คัมภีร์)"],"dodge":["passive",10,0,[],null,2,0,0,"หลบหลีก +3"],"doubleatk":["passive",10,0,[],null,2,0,0,"ถือมีด: โอกาสตีซ้ำ"],"steal":["target",5,1,[],null,2,10,0,"ขโมยของจากศัตรู"],"envenom":["target",5,1,[],null,2,10,1,"โจมตี + พิษ นาน 6 วิ"],"hide":["buff",5,3,[],{"steal":2},3,10,0,"หายตัว ศัตรูเลิกไล่"],"stab":["target",5,1.2,["dagger"],{"doubleatk":3},3,9,2,"แทงคริติคอลแน่นอน ทะลุเกราะ"],"shadow":["target",5,5,["dagger"],{"stab":3,"hide":3},5,35,5,"วาร์ปไปหลังศัตรู แทง 3 ครั้ง (ต้องใช้คัมภีร์)"],"discount":["passive",10,0,[],null,2,0,0,"ซื้อของถูกลง"],"overcharge":["passive",10,0,[],null,2,0,0,"ขายของแพงขึ้น"],"mammonite":["target",10,0.8,[],null,2,5,0,"จ่ายเบี้ย โจมตีแรง"],"craft":["passive",5,0,[],null,2,0,0,"ตีบวกติดง่ายขึ้น"],"luckydrop":["passive",5,0,[],{"discount":3},3,0,0,"โอกาสดรอปของเพิ่มขึ้น"],"greed":["passive",5,0,[],{"overcharge":3},3,0,0,"ได้เบี้ยจากมอนเพิ่มขึ้น"],"tycoon":["target",5,5,[],{"mammonite":5,"greed":3},5,30,0,"โปรยเบี้ยระเบิดใส่ศัตรูรอบเป้าหมาย (ต้องใช้คัมภีร์)"]};
const VFX_NAMES = { "": "— ค่าเริ่มต้น —", ring: "⭕ วงแหวน", burst: "💥 แสงแตกกระจาย", pillar: "🔆 เสาแสงพุ่งขึ้นฟ้า", vortex: "🌀 วังวนหมุน", sparkle: "✨ ประกายดาว", quake: "🪨 พื้นแตก", zap: "⚡ สายฟ้าฟาด", slash: "🗡️ รอยฟัน", heal: "💚 แสงฟื้นฟู",
  crescent: "🌙 รอยฟันจันทร์เสี้ยวทอง", xslash: "❌ รอยกรีดกากบาท", runes: "🔮 วงเวทอักขระ", lotus: "🪷 ดอกบัวบาน", coins: "💰 เหรียญทองกระจาย", none: "ไม่มี" };
const PROJ_NAMES = { orb: "🔮 ลูกแก้วพุ่งไป", sky: "☄️ ตกจากฟ้า", zap: "⚡ สายฟ้าฟาดลงมา", none: "ไม่มี" };
const isBuiltinSkill = id => !!BUILTIN_SKILL_INFO[id];
function builtinSkillDefaults(id) {
  const [kind, max, cd, w, req, rare, spBase, spPer] = BUILTIN_SKILL_INFO[id], b = BUILTIN_SKILLS.find(s => s[0] === id);
  const r = req ? Object.entries(req)[0] : null;
  return { fx: "original", name: b[4], icon: b[5], line: b[1], tier: b[2], row: b[3], max, cd, grade: rare, weapons: w, reqId: r ? r[0] : "", reqLv: r ? r[1] : 1, spBase, spPer, kindOrig: kind };
}
let curSkill = null, skPos = { tier: 0, row: 0 };
// ไอคอนวิชามี 2 แบบมาตรฐาน: แอคทีฟ (กดใช้) / พาสซีฟ (ติดตัว) · ถ้าอัปโหลดรูปจะใช้รูปแทน
const SK_KIND_ICON = { act: "⚡", pas: "🔰" };
const kindIcon = pas => pas ? SK_KIND_ICON.pas : SK_KIND_ICON.act;
const skIcon = (img, pas) => thumb(img) || kindIcon(pas);
function renderSkillList() {
  const ids = Object.keys(content.skill).filter(id => !isBuiltinSkill(id)).sort();
  $("skillList").innerHTML = ids.length ? ids.map(id => { const d = content.skill[id], ln = SKILL_LINES.find(l => l[0] === d.line) || SKILL_LINES[0]; return `<div class="li ${curSkill === id ? "on" : ""}" onclick="editSkill('${id}')"><span class="ic">${skIcon(d.img, d.fx === "passive")}</span><span class="t">${esc(d.name)}<small>${ln[2]} สาย${ln[1]} · ${(SKILL_FX[d.fx] || [""])[0].slice(3)}${d.mode === "stance" ? " · 🥋 ท่า" : ""}</small></span></div>`; }).join("")
    : `<div class="empty" style="padding:14px">ยังไม่มี</div>`;
  $("builtinSkills").innerHTML = SKILL_LINES.map(([ln, lname, lic]) => `<div class="muted" style="font-size:12px;margin:8px 0 2px">${lic} สาย${lname}</div>` +
    BUILTIN_SKILLS.filter(s => s[1] === ln).map(([id, , , , n, ic]) => { const o = content.skill[id], d = o && !o.deleted ? o : null; return `<div class="li ${curSkill === id ? "on" : ""}" style="cursor:pointer" onclick="editSkill('${id}')"><span class="ic">${skIcon(d && d.img, BUILTIN_SKILL_INFO[id] && BUILTIN_SKILL_INFO[id][0] === "passive")}</span><span class="t">${esc((d && d.name) || n)} ${statusTag(o)}</span></div>`; }).join("")).join("");
}
function editSkill(id) {
  curSkill = id; renderSkillList();
  const bi = !!(id && isBuiltinSkill(id)), ov = id && content.skill[id];
  const d = ov && !ov.deleted ? { ...(bi ? builtinSkillDefaults(id) : {}), ...ov } : bi ? builtinSkillDefaults(id) : id ? content.skill[id] : { fx: "strike", line: "sword", max: 5, base: 150, per: 30, spBase: 10, spPer: 2, cd: 1.5, grade: 2, icon: "✨", intMul: 1, statusChance: 30, dur: 30, stats: {}, mode: "normal" };
  skPos = { tier: d.tier ?? 0, row: d.row ?? nextFreeRow(d.line || "sword", id) };
  if (!id) skPos.row = nextFreeRow(d.line, null);
  $("skillForm").innerHTML = `<h2>${bi ? "แก้ไขวิชาเดิมในเกม" : id ? "แก้ไขวิชา" : "สร้างวิชาใหม่"}</h2>
    ${builtinBanner("skill", id, bi, ov, d.name)}
    <div class="grid">
      <input id="sk_id" type="hidden" value="${esc(id || newId("sk"))}">
      <div><label>ชื่อวิชา</label><input id="sk_name" maxlength="24" value="${esc(d.name || "")}"></div>
      <input id="sk_icon" type="hidden" value="${esc(d.icon || "⚡")}">
      <input id="sk_grade" type="hidden" value="${d.grade || 2}">
      <div><label>ชนิดไอคอนมาตรฐาน</label><div id="sk_kind" class="skKind"></div></div>
      <div><label>เลเวลสูงสุด</label><input id="sk_max" type="number" min="1" max="10" value="${d.max ?? 5}"></div>
      <div><label>สีเอฟเฟกต์</label><input id="sk_color" type="color" value="${esc(d.color || "#ffb627")}"></div>
    </div>
    ${imgField("skill", d.img, 96, "รูปไอคอนวิชา (ไม่ใส่ = ใช้ไอคอนมาตรฐาน ⚡ / 🔰)")}

    <div class="sub">อยู่ในหน้าวิชาสายไหน</div>
    <div class="row" style="max-width:360px"><select id="sk_line" onchange="skPos.row=nextFreeRow(this.value,curSkill);skPos.tier=0;drawSkillGrid()">${SKILL_LINES.map(([k, n, ic]) => opt(k, `${ic} สาย${n}`, d.line)).join("")}</select></div>
    <div class="hint">คลิกช่องว่างเพื่อเลือกตำแหน่งการ์ดวิชา (ซ้าย = วิชาขั้นต้น · ขวา = วิชาขั้นสูง)</div>
    <div id="sk_grid" class="skGrid"></div>
    <div class="sub">ประเภทวิชา</div>
    <div class="row" style="max-width:420px"><select id="sk_fx" onchange="skillFxChanged()">${bi ? opt("original", "🔧 ใช้การทำงานเดิมของเกม", d.fx) : ""}${Object.entries(SKILL_FX).map(([k, [l]]) => opt(k, l, d.fx)).join("")}</select></div>
    <div class="hint" id="sk_fxHint"></div>
    <div id="sk_fxFields"></div>
    <div class="sub">เงื่อนไข</div>
    <div class="fld"><label>ใช้ได้กับอาวุธ (ไม่ติ๊กเลย = ใช้ได้ทุกอาวุธ)</label>
      <div class="row" style="flex-wrap:wrap">${WEAPON_TYPES.map(([k, n]) => `<label class="chk" style="margin-right:12px"><input type="checkbox" class="sk_w" value="${k}" ${(d.weapons || []).includes(k) ? "checked" : ""}> ${n}</label>`).join("")}</div></div>
    <div class="grid">
      <div><label>ต้องมีวิชานี้ก่อน</label><select id="sk_req">${opt("", "— ไม่ต้องมี —", d.reqId)}${allSkills().filter(s => s.id !== id).map(s => opt(s.id, `${s.icon} ${s.name} (${(SKILL_LINES.find(l => l[0] === s.line) || [0, "?"])[1]})`, d.reqId)).join("")}</select></div>
      <div><label>ที่เลเวล</label><input id="sk_reqLv" type="number" min="1" max="10" value="${d.reqLv ?? 1}"></div>
    </div>
    <div class="formActs">
      <button class="btn green" onclick="saveSkill()">💾 บันทึก</button>
      ${builtinButtons("skill", id, bi, ov, d.name)}
    </div>`;
  drawSkillGrid(); skillFxChanged(d);
}
const allSkills = () => [...BUILTIN_SKILLS.filter(([id]) => !(content.skill[id] && content.skill[id].deleted)).map(([id, line, tier, row, name, icon]) => { const o = content.skill[id]; const pas = BUILTIN_SKILL_INFO[id] && BUILTIN_SKILL_INFO[id][0] === "passive"; return o ? { id, line: o.line ?? line, tier: o.tier ?? tier, row: o.row ?? row, name: o.name || name, icon: o.icon || icon, img: o.img, pas } : { id, line, tier, row, name, icon, pas }; }),
  ...Object.entries(content.skill).filter(([id]) => !isBuiltinSkill(id)).map(([id, d]) => ({ id, line: d.line, tier: d.tier, row: d.row, name: d.name, icon: d.icon, img: d.img, pas: d.fx === "passive", custom: true }))];
function curSkillPassive() { const fx = val("sk_fx"); return fx === "original" ? !!(BUILTIN_SKILL_INFO[curSkill] && BUILTIN_SKILL_INFO[curSkill][0] === "passive") : fx === "passive"; }
function nextFreeRow(line, self) {
  const used = allSkills().filter(s => s.line === line && s.id !== self && s.tier === 0).map(s => s.row);
  let r = 0; while (used.includes(r)) r++; return r;
}
function drawSkillGrid() {
  const line = val("sk_line"), list = allSkills().filter(s => s.line === line && s.id !== curSkill);
  const rows = Math.max(6, ...list.map(s => s.row + 2), skPos.row + 2);
  let h = "";
  for (let r = 0; r < rows; r++) for (let t = 0; t < 4; t++) {
    const s = list.find(x => x.tier === t && x.row === r), me = skPos.tier === t && skPos.row === r;
    h += s ? `<div class="skCell used" title="${esc(s.name)}">${skIcon(s.img, s.pas)}<small>${esc(s.name)}</small></div>`
      : `<div class="skCell ${me ? "me" : ""}" onclick="skPos={tier:${t},row:${r}};drawSkillGrid()">${me ? skIcon(pickedImg.skill, curSkillPassive()) + "<small>วิชานี้</small>" : ""}</div>`;
  }
  $("sk_grid").innerHTML = h;
}
function skillFxChanged(d) {
  d = d || collectSkill() || {};
  const fx = val("sk_fx"), st = d.stats || {};
  const info = BUILTIN_SKILL_INFO[curSkill];
  $("sk_fxHint").textContent = fx === "original" ? `ใช้สูตรเดิม: ${info ? info[8] : ""} · ปรับได้แค่ค่า SP / คูลดาวน์ / เอฟเฟกต์` : SKILL_FX[fx][1];
  const vfx = `<div class="sub">เอฟเฟกต์</div><div class="grid"><div><label>เอฟเฟกต์ตอนใช้วิชา</label><select id="sk_vfx">${Object.entries(VFX_NAMES).map(([k, l]) => opt(k, l, d.vfx || "")).join("")}</select></div>
      ${fx === "magic" ? `<div><label>ลูกพลัง</label><select id="sk_proj">${Object.entries(PROJ_NAMES).map(([k, l]) => opt(k, l, d.proj || "orb")).join("")}</select></div>` : ""}
      <div style="align-self:end"><button class="btn sm ghost" onclick="previewVfx()">👁 ดูตัวอย่าง</button></div></div>
    <canvas id="sk_vfxPrev" width="260" height="170" style="border-radius:10px;border:2px solid var(--edge);background:#3f7a36;display:none"></canvas>`;
  const n = (k, label, def, extra = "") => `<div><label>${label}</label><input id="sk_${k}" type="number" value="${d[k] ?? def}" ${extra}></div>`;
  const status = `<div><label>สถานะที่ทำให้ศัตรู</label><select id="sk_status">${Object.entries(SK_STATUS).map(([k, l]) => opt(k, l, d.status || "")).join("")}</select></div>${n("statusChance", "โอกาสติดสถานะ %", 30, 'min="0" max="100"')}`;
  const stats = `<div class="grid">${STATS.map(k => `<div><label>${k.toUpperCase()} ต่อเลเวล</label><input id="sk_st_${k}" type="number" min="0" step="0.5" value="${st[k] || 0}"></div>`).join("")}
      ${n("atkPct", "ATK % ต่อเลเวล", 0, 'min="0" step="0.5"')}${n("defAdd", "DEF ต่อเลเวล", 0, 'min="0" step="0.5"')}</div>`;
  let h = "";
  if (fx === "strike") h = `<div class="grid">${n("base", "แรง % (เลเวล 0)", 150)}${n("per", "แรง % เพิ่มต่อเลเวล", 30)}${n("radius", "รัศมีกระจาย (0 = ตัวเดียว)", 0, 'min="0" max="400"')}${n("range", "ระยะใช้ (0 = ตามอาวุธ)", 0, 'min="0" max="400"')}${status}</div>`;
  else if (fx === "magic") h = `<div class="grid">${n("base", "ดาเมจพื้นฐาน", 40)}${n("per", "ดาเมจเพิ่มต่อเลเวล", 15)}${n("intMul", "ตัวคูณ INT", 1.5, 'step="0.1" min="0"')}${n("radius", "รัศมีกระจาย (0 = ตัวเดียว)", 0, 'min="0" max="400"')}${n("range", "ระยะยิง", 180, 'min="20" max="400"')}${status}</div>`;
  else if (fx === "blast") h = `<div class="grid">${n("base", "แรง (% หรือดาเมจเวท)", 120)}${n("per", "เพิ่มต่อเลเวล", 25)}${n("radius", "รัศมีรอบตัว", 90, 'min="30" max="400"')}${n("intMul", "ตัวคูณ INT (ถ้าเป็นเวท)", 1, 'step="0.1" min="0"')}${status}</div>
      <label class="chk"><input type="checkbox" id="sk_magic" ${d.magic ? "checked" : ""}> เป็นเวท (ใช้ INT ทะลุเกราะ) · ไม่ติ๊ก = ใช้พลังโจมตีปกติ</label>`;
  else if (fx === "heal") h = `<div class="grid">${n("base", "ฟื้น HP พื้นฐาน", 50)}${n("per", "เพิ่มต่อเลเวล", 25)}${n("intMul", "ตัวคูณ INT", 2, 'step="0.1" min="0"')}</div>`;
  else if (fx === "buff") h = `<div class="hint">ค่าด้านล่างคูณด้วยเลเวลวิชา เช่น STR 2 ต่อเลเวล → Lv3 ได้ STR +6</div>${stats}<div class="grid">${n("dur", "นาน (วินาที)", 30, 'min="1" max="600"')}</div>`;
  else if (fx === "passive") h = `<div class="hint">ค่าด้านล่างคูณด้วยเลเวลวิชา และทำงานตลอดเวลา</div>${stats}`;
  const passiveNow = fx === "passive" || (fx === "original" && info && info[0] === "passive");
  // รูปแบบการใช้: สกิลปกติ (กดใช้ทีละครั้ง) หรือ สกิลท่า (เปิดค้าง ตีธรรมดาออกเป็นท่านี้)
  const modeBlock = passiveNow ? "" : `<div class="sub">รูปแบบการใช้</div>
    <div class="row" style="max-width:520px"><select id="sk_mode">
      ${opt("normal", "⚡ สกิลปกติ (กดใช้ทีละครั้ง มีคูลดาวน์)", d.mode || "normal")}
      ${opt("stance", "🥋 สกิลท่า (เปิดค้างไว้ ตีปกติจะออกเป็นท่านี้)", d.mode || "normal")}
    </select></div>
    <div class="hint">สกิลท่า: กดเปิดแล้วการตีธรรมดาทุกครั้งจะออกเป็นสกิลนี้ และหัก SP ต่อครั้ง · กดซ้ำเพื่อปิด</div>`;
  const costNow = passiveNow ? "" : `<div class="sub">ค่าใช้</div><div class="grid">${n("spBase", "SP พื้นฐาน", 10, 'min="0"')}${n("spPer", "SP เพิ่มต่อเลเวล", 2, 'min="0"')}${n("cd", "คูลดาวน์ (วินาที)", 1.5, 'min="0" step="0.1"')}</div>`;
  $("sk_fxFields").innerHTML = h + modeBlock + costNow + (passiveNow ? "" : vfx);
  if ($("sk_grid")) drawSkillGrid();   // ไอคอนในตารางเปลี่ยนตามแอคทีฟ/พาสซีฟ
  if ($("sk_kind")) $("sk_kind").innerHTML = curSkillPassive() ? "🔰 พาสซีฟ (ติดตัว)" : "⚡ แอคทีฟ (กดใช้)";
}
// ตัวอย่างเอฟเฟกต์ (วาดแบบเดียวกับในเกม)
let vfxAnim = 0;
function previewVfx() {
  const cv = $("sk_vfxPrev"); if (!cv) return;
  cv.style.display = "block";
  const g = cv.getContext("2d"), kind = val("sk_vfx") || ({ strike: "slash", magic: "ring", blast: "ring", heal: "heal", buff: "pillar" }[val("sk_fx")] || "ring");
  const col = val("sk_color") || "#ffb627", proj = val("sk_proj");
  const life = { ring: .5, burst: .55, pillar: .9, vortex: .9, sparkle: .9, quake: .8, zap: .35, slash: .3, heal: 1 }[kind] || .6;
  const t0 = performance.now(), id = ++vfxAnim, x = 130, y = 115, seed = Math.random();
  const circ = (cx, cy, r) => { g.beginPath(); g.arc(cx, cy, r, 0, 7); };
  const ell = (cx, cy, rx, ry) => { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); };
  const frame = () => {
    if (id !== vfxAnim) return;
    const el = (performance.now() - t0) / 1000, total = life + (proj && proj !== "none" && val("sk_fx") === "magic" ? .25 : 0) + .4;
    g.globalAlpha = 1; g.fillStyle = "#3f7a36"; g.fillRect(0, 0, 260, 170);
    g.fillStyle = "rgba(0,0,0,.25)"; ell(x, y, 16, 6); g.fill();
    g.fillStyle = "#8a5a3b"; ell(x, y - 12, 18, 12); g.fill();   // มอนตัวอย่าง
    let tt = el;
    if (val("sk_fx") === "magic" && proj && proj !== "none") {
      if (tt < .25) {
        const p = tt / .25, sx = proj === "sky" || proj === "zap" ? x : 20, sy = proj === "sky" || proj === "zap" ? -20 : y - 20;
        g.globalCompositeOperation = "lighter"; g.fillStyle = col; circ(sx + (x - sx) * p, sy + (y - 14 - sy) * p, 7); g.fill(); g.globalCompositeOperation = "source-over";
        requestAnimationFrame(frame); return;
      }
      tt -= .25;
    }
    const p = Math.min(1, tt / life);
    g.globalAlpha = 1 - p; g.strokeStyle = g.fillStyle = col; g.lineCap = "round";
    if (kind === "ring") { g.lineWidth = 3; circ(x, y, 6 + p * 28); g.stroke(); }
    else if (kind === "slash") { g.lineWidth = 3 * (1 - p) + 1; g.beginPath(); g.arc(x, y - 14, 16, -2.4 + p, -.6 + p); g.stroke(); }
    else if (kind === "heal") { g.globalCompositeOperation = "lighter"; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28 + p * 3; circ(x + Math.cos(a) * 16, y - 10 - p * 50 - (i % 3) * 6, 3); g.fill(); } }
    else if (kind === "pillar") { g.globalCompositeOperation = "lighter"; const gr = g.createLinearGradient(0, y - 130, 0, y); gr.addColorStop(0, col + "00"); gr.addColorStop(1, col + "cc"); g.fillStyle = gr; const w = 18 + (1 - p) * 16; g.fillRect(x - w, y - 130 * Math.min(1, p * 3), w * 2, 130 * Math.min(1, p * 3)); }
    else if (kind === "burst") { g.globalCompositeOperation = "lighter"; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28, r1 = 8 + p * 30, r2 = 16 + p * 62; g.lineWidth = 4 * (1 - p) + 1; g.beginPath(); g.moveTo(x + Math.cos(a) * r1, y - 14 + Math.sin(a) * r1 * .6); g.lineTo(x + Math.cos(a) * r2, y - 14 + Math.sin(a) * r2 * .6); g.stroke(); } }
    else if (kind === "vortex") { g.globalCompositeOperation = "lighter"; for (let k = 0; k < 3; k++) { g.lineWidth = 3 - k * .7; g.beginPath(); for (let i = 0; i <= 30; i++) { const q = i / 30, a = q * 9.4 + p * 8 + k * 2.1, r = (1 - q) * (50 - p * 20) + 4; const px = x + Math.cos(a) * r, py = y - 10 + Math.sin(a) * r * .5; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); } }
    else if (kind === "sparkle") { g.globalCompositeOperation = "lighter"; for (let i = 0; i < 14; i++) { const a = i * 2.39 + p * 2, r = 14 + (i % 5) * 9 + p * 18, s = (3 + i % 3) * (1 - p) + 1, px = x + Math.cos(a) * r, py = y - 20 + Math.sin(a) * r * .6 - p * 20; g.fillRect(px - s * .5, py - s * 2, s, s * 4); g.fillRect(px - s * 2, py - s * .5, s * 4, s); } }
    else if (kind === "quake") { g.lineWidth = 3; for (let k = 0; k < 2; k++) { const R = 12 + (p + k * .25) * 70; ell(x, y, R, R * .6); g.stroke(); } }
    else if (kind === "zap") { g.globalCompositeOperation = "lighter"; g.lineWidth = 3; g.beginPath(); g.moveTo(x + seed * 20, y - 120); for (let i = 1; i <= 7; i++) g.lineTo(x + Math.sin(i * 7.3 + seed * 9) * 14 * (1 - i / 8), y - 120 + i * 120 / 7); g.stroke(); }
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    if (el < total) requestAnimationFrame(frame);
  };
  frame();
}
function collectSkill() {
  if (!$("sk_fx")) return null;
  const d = { name: val("sk_name").trim(), icon: kindIcon(curSkillPassive()), grade: numv("sk_grade", 2), max: numv("sk_max", 5), color: val("sk_color"),
    line: val("sk_line"), tier: skPos.tier, row: skPos.row, fx: val("sk_fx") };
  for (const k of ["base", "per", "radius", "range", "intMul", "statusChance", "spBase", "spPer", "cd", "dur", "atkPct", "defAdd"]) if ($("sk_" + k)) d[k] = numv("sk_" + k);
  if ($("sk_vfx")) d.vfx = val("sk_vfx");
  if ($("sk_proj")) d.proj = val("sk_proj");
  if ($("sk_status")) d.status = val("sk_status");
  if ($("sk_magic")) d.magic = $("sk_magic").checked;
  if ($("sk_st_str")) { d.stats = {}; for (const k of STATS) { const n = numv("sk_st_" + k); if (n) d.stats[k] = n; } }
  d.mode = $("sk_mode") ? val("sk_mode") : "normal";   // normal = สกิลปกติ · stance = สกิลท่า
  d.weapons = [...document.querySelectorAll(".sk_w:checked")].map(x => x.value);
  d.reqId = val("sk_req"); d.reqLv = numv("sk_reqLv", 1);
  if (pickedImg.skill) d.img = pickedImg.skill;   // รูปไอคอนวิชา (ไม่ใส่ = ใช้ไอคอนมาตรฐาน)
  return d;
}
async function saveSkill() {
  const id = val("sk_id").trim().toLowerCase(), d = collectSkill();
  if (!idOk(id)) return toast("รหัสต้องเป็นอังกฤษตัวเล็ก ตัวเลข หรือ _ ยาว 2–32 ตัว", true);
  if (isBuiltinSkill(id) && id !== curSkill) return toast("รหัสนี้ซ้ำกับวิชาเดิมในเกม", true);
  if (id !== curSkill && content.skill[id]) return toast("มีวิชารหัสนี้แล้ว", true);
  if (!d.name) return toast("ใส่ชื่อวิชาด้วย", true);
  if (allSkills().some(s => s.id !== curSkill && s.line === d.line && s.tier === d.tier && s.row === d.row)) return toast("ตำแหน่งนี้มีวิชาอื่นอยู่แล้ว เลือกช่องว่าง", true);
  if (["buff", "passive"].includes(d.fx) && !Object.keys(d.stats || {}).length && !d.atkPct && !d.defAdd) return toast("ใส่ค่าที่วิชานี้จะเพิ่มอย่างน้อย 1 อย่าง", true);
  if (await saveContent("skill", id, d, curSkill)) editSkill(id);
}

// ล็อกอินค้างอยู่ → เข้าเลย
if (sb && USE_HANDOFF) {
  lgMsg("กำลังเข้าสู่ระบบจากหน้าเกม…", true);
  sb.auth.setSession({ access_token: HANDOFF.a, refresh_token: HANDOFF.r }).then(({ data, error }) => {
    if (error || !data.session) lgMsg("เซสชันจากหน้าเกมหมดอายุ กรุณาล็อกอินอีกครั้ง");
    else enter(data.session.user);
  });
}
else if (sb) sb.auth.getSession().then(({ data }) => { if (data.session) enter(data.session.user); });
else lgMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วรีเฟรช");
