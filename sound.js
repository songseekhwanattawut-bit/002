// =====================================================================
//  เสียงในเกม: เสียงประกอบสังเคราะห์ด้วย WebAudio (ไม่ต้องมีไฟล์) + คำพูดภาษาไทยด้วยเสียงอ่านของเบราว์เซอร์ (th-TH)
//  ต่อเข้ากับเกมโดยห่อฟังก์ชันเดิม (playVfx, floatText, gainExp, log, showDialog …) ไม่ต้องแก้ game.js
// =====================================================================
const SND = { on: (() => { try { return localStorage.getItem("siam-snd") !== "0"; } catch (e) { return true; } })(), ac: null, out: null, vol: 0.9, last: {} };
function sndCtx() {
  if (!SND.ac) {
    try { SND.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    const comp = SND.ac.createDynamicsCompressor(), boost = SND.ac.createGain();   // ดันเสียงให้ดังและหนักแน่น แต่ไม่แตก
    comp.threshold.value = -18; comp.ratio.value = 6; boost.gain.value = 1.8;
    boost.connect(comp).connect(SND.ac.destination); SND.out = boost;
  }
  if (SND.ac.state === "suspended") SND.ac.resume();
  return SND.ac;
}
// เบราว์เซอร์ไม่ให้เล่นเสียงจนกว่าผู้เล่นจะแตะหน้าเว็บ (รวมหลังรีเฟรช) → ปลุกเสียงทุกครั้งที่คลิก/กดปุ่ม/แตะ
for (const ev of ["pointerdown", "keydown", "touchstart"]) addEventListener(ev, () => { if (SND.on) { sndCtx(); hideSndHint(); } }, { passive: true });
function hideSndHint() { const h = document.getElementById("sndHint"); if (h) h.remove(); }
setTimeout(() => {   // ยังไม่ได้แตะหน้าจอหลังรีเฟรช → บอกให้แตะเพื่อเปิดเสียง
  if (!SND.on || (SND.ac && SND.ac.state === "running")) return;
  const h = document.createElement("div"); h.id = "sndHint"; h.textContent = "🔊 แตะหน้าจอเพื่อเปิดเสียง";
  h.style.cssText = "position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:50;background:rgba(30,16,6,.88);color:#ffe9b0;padding:6px 14px;border-radius:10px;font:600 13px Mitr,Tahoma,sans-serif;pointer-events:none";
  document.body.appendChild(h);
}, 2500);
const sTone = (f, dur, type = "square", v = 0.3, f2 = null, delay = 0) => {
  const ac = sndCtx(); if (!ac || !SND.on) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(v * SND.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(SND.out); o.start(t); o.stop(t + dur + 0.02);
};
const noise = (dur, freq = 1200, v = 0.3, delay = 0, q = 1) => {
  const ac = sndCtx(); if (!ac || !SND.on) return;
  const t = ac.currentTime + delay, buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = buf; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(v * SND.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(SND.out); s.start(t);
};
const SFX = {
  swing: () => noise(0.12, 2400, 0.35, 0, 0.8),
  slice: () => { noise(0.08, 3800, 0.35); noise(0.08, 3200, 0.3, 0.06); },
  hit: () => { sTone(150, 0.14, "square", 0.5, 55); sTone(75, 0.12, "sine", 0.6, 40); noise(0.09, 700, 0.55, 0, 0.7); },          // ตุบหนัก ๆ
  crit: () => { sTone(1100, 0.07, "square", 0.35, 1800); sTone(120, 0.25, "sawtooth", 0.55, 45, 0.02); sTone(60, 0.25, "sine", 0.7, 35, 0.02); noise(0.18, 1200, 0.7, 0.02, 0.6); },   // ปั้ง!
  magic: () => { sTone(500, 0.25, "sine", 0.22, 1200); sTone(750, 0.25, "triangle", 0.15, 1800, 0.05); },
  zap: () => { sTone(1400, 0.12, "sawtooth", 0.18, 300); noise(0.1, 4000, 0.2); },
  boom: () => { sTone(120, 0.3, "sawtooth", 0.3, 40); noise(0.3, 400, 0.35); },
  holy: () => [523, 659, 784, 1047].forEach((f, i) => sTone(f, 0.35, "sine", 0.16, null, i * 0.06)),
  chime: () => [784, 988, 1175].forEach((f, i) => sTone(f, 0.4, "triangle", 0.18, null, i * 0.08)),
  coin: () => { sTone(988, 0.06, "square", 0.15); sTone(1319, 0.18, "square", 0.15, null, 0.06); },
  pickup: () => sTone(660, 0.08, "triangle", 0.2, 990),
  levelup: () => [523, 659, 784, 1047, 1319].forEach((f, i) => sTone(f, 0.22, "square", 0.14, null, i * 0.09)),
  quest: () => [392, 523, 659, 784, 659, 1047].forEach((f, i) => sTone(f, 0.2, "triangle", 0.18, null, i * 0.11)),
  boss: () => { sTone(98, 0.9, "sawtooth", 0.25, 73); sTone(147, 0.9, "sawtooth", 0.18, 110, 0.1); },
  portal: () => { sTone(300, 0.5, "sine", 0.2, 900); noise(0.5, 1500, 0.15, 0, 0.5); },
  hurt: () => sTone(200, 0.12, "sawtooth", 0.18, 90),
  death: () => [392, 330, 262, 196].forEach((f, i) => sTone(f, 0.35, "triangle", 0.2, null, i * 0.2)),
  click: () => sTone(1200, 0.03, "square", 0.1),
};
function sfx(name, gap = 0.04) {   // กันเสียงเดิมซ้อนรัวเกินไป
  if (!SND.on || !SFX[name]) return;
  const t = performance.now() / 1000; if (t - (SND.last[name] || 0) < gap) return;
  SND.last[name] = t; SFX[name]();
}
// ---------- คำพูดภาษาไทย ----------
let thVoice = null;
const pickVoice = () => { const vs = speechSynthesis.getVoices(); thVoice = vs.find(v => /^th/i.test(v.lang)) || null; };
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text, { rate = 1.05, pitch = 1, force = false } = {}) {
  if (!SND.on || !window.speechSynthesis || !text || !thVoice) return;   // ไม่มีเสียงอ่านภาษาไทยในเครื่อง = ไม่พูด (กันอ่านเพี้ยน)
  const t = String(text).replace(/[^฀-๿a-zA-Z0-9 .,!?…]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
  if (!t) return;
  if (speechSynthesis.speaking && !force) return;   // ไม่พูดแทรกกัน (ยกเว้นเรื่องสำคัญ)
  if (force) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t); u.lang = "th-TH"; if (thVoice) u.voice = thVoice;
  u.rate = rate; u.pitch = pitch; u.volume = Math.min(1, SND.vol * 2.4);
  speechSynthesis.speak(u);
}
// ---------- ต่อเข้ากับเกม ----------
const VFX_SFX = { crescent: "swing", slash: "swing", xslash: "slice", runes: "magic", lotus: "chime", heal: "chime", coins: "coin", zap: "zap", burst: "boom", pillar: "holy", quake: "boom", vortex: "magic", sparkle: "magic", ring: "hit" };
{ const o = playVfx; playVfx = function (kind, ...a) { if (mode === "play") sfx(VFX_SFX[kind] || "hit"); return o.call(this, kind, ...a); }; }
{ const o = floatText; floatText = function (x, y, text, color, size, big) {
    if (mode === "play") {
      if (typeof text === "number" && big && size >= 28) sfx("crit");
      else if (typeof text === "number" && color === "#fff") sfx("hit", 0.06);
      else if (text === "หลบ" && color === "#9ee7ff") sfx("hurt");
    }
    return o.call(this, x, y, text, color, size, big);
  }; }
{ const o = chantFx; chantFx = function (dur, sayIt = true) { o.call(this, dur, sayIt); if (sayIt && floats.length) say(floats[floats.length - 1].text || "", { rate: 0.95, pitch: 0.8 }); }; }
{ const o = gainExp; gainExp = function (n) { const lv = P.lvl; o.call(this, n); if (P.lvl > lv) { sfx("levelup"); say(`เลเวลอัป! เลเวล ${P.lvl}`, { force: true }); } }; }
{ const o = takeDamage; takeDamage = function (...a) { const r = o.apply(this, a); sfx("hurt", 0.25); return r; }; }
{ const o = addItem; addItem = function (...a) { if (mode === "play") sfx("pickup", 0.08); return o.apply(this, a); }; }
{ const o = changeMap; changeMap = function (...a) { sfx("portal"); return o.apply(this, a); }; }
{ const o = showZoneBanner; showZoneBanner = function (z, ...a) { if (mode === "play" && ZONES[z]) say(ZONES[z].name); return o.call(this, z, ...a); }; }
{ const o = log; log = function (msg, ...a) {
    const m = String(msg);
    if (/ภารกิจ ".*" สำเร็จ/.test(m)) { sfx("quest"); say("ภารกิจสำเร็จ! กลับไปรายงานขุนศึกเพชร", { force: true }); }
    else if (/MVP/.test(m)) { sfx("quest"); say("ยอดเยี่ยม! ท่านคือ เอ็มวีพี", { force: true }); }
    else if (/ปรากฏตัว/.test(m) && /💀|⚠/.test(m)) { sfx("boss"); say(m.replace(/[💀⚠]/g, ""), { force: true }); }
    else if (/ปราบ .* สำเร็จ/.test(m) || /ถูกปราบแล้ว/.test(m)) sfx("boss");
    else if (/สิ้นสติ/.test(m)) { sfx("death"); say("ท่านสิ้นสติ", { force: true }); }
    else if (/ซื้อ|ขาย/.test(m) && /เบี้ย/.test(m)) sfx("coin");
    return o.call(this, msg, ...a);
  }; }
{ const o = showDialog; showDialog = function (title, text, btns, npc, ...a) {   // NPC พูดประโยคแรก
    if (npc && mode === "play") say(String(text).split(/\n/)[0], { force: true, pitch: npc.look && npc.look.gender === "f" ? 1.25 : 0.9 });
    return o.call(this, title, text, btns, npc, ...a);
  }; }
function toggleSound() {
  SND.on = !SND.on;
  try { localStorage.setItem("siam-snd", SND.on ? "1" : "0"); } catch (e) {}
  if (!SND.on && window.speechSynthesis) speechSynthesis.cancel();
  if (SND.on) { sndCtx(); sfx("click"); }
  const b = document.getElementById("sndBtn"); if (b) b.textContent = SND.on ? "🔊" : "🔇";
}
{ const b = document.getElementById("sndBtn"); if (b) b.textContent = SND.on ? "🔊" : "🔇"; }
