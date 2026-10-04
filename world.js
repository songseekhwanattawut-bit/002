// =====================================================================
//  แผนที่โลก "แดนมนตรา" (กด M) — ทวีปแบ่งเป็นช่อง 1 ช่อง = 1 แผนที่ (แบบ Ragnarok)
//  วางตามเนื้อเรื่อง ~100 ช่อง · ช่องที่ยังไม่มีแผนที่จริง = 🔒 เร็ว ๆ นี้
// =====================================================================
const WM_COLS = 18, WM_ROWS = 13;
// ภูมิภาคเรียงตามเนื้อเรื่อง · cells = [c1, r1, c2, r2] (รวมขอบ) · maps = ช่องที่มีแผนที่จริงในเกม
const WM_REGIONS = [
  { id: "city",     name: "เมืองท่าสุวรรณ",   lv: "เมืองหลวง",  color: "#e8c27a", town: true, cells: [5, 6, 5, 6], maps: { "5,6": "city" },
    desc: "เมืองหลวงแห่งที่ 1 ริมทะเลตะวันตก · พระนครในกำแพงมีวัดหลวงและตลาด · ท่าเรือฝั่งตะวันตก · หมู่บ้านริมนาทางใต้ · เขตปลอดภัย" },
  { id: "field",    name: "ทุ่งนาริมกรุง",     lv: "Lv 1–9",   color: "#8cc86a", cells: [6, 5, 8, 7], maps: { "6,6": "main" },
    desc: "ทุ่งนาและป่ารอบเมือง จุดเริ่มต้นของนักผจญภัย · ลิงกังขโมยเศษดาบชิ้นแรกไปซ่อน" },
  { id: "bamboo",   name: "ป่าไผ่",            lv: "Lv 5–12",  color: "#6fae58", cells: [6, 3, 9, 4],
    desc: "ป่าไผ่ทึบทางเหนือ ถิ่นของลิงกังและงูเห่า" },
  { id: "plain",    name: "ที่ราบลุ่มน้ำ",      lv: "Lv 62–110", color: "#a8c66a", cells: [5, 8, 8, 9], custom: true, maps: { "6,8": "plain" },
    desc: "ที่ราบลุ่มแม่น้ำทางใต้ของเมือง · แผนที่ที่แอดมินสร้างจะมาอยู่ที่นี่" },
  { id: "himmapan", name: "ป่าหิมพานต์",       lv: "Lv 10–18", color: "#3f7d5a", cells: [9, 5, 11, 7],
    desc: "ป่าลึกที่ผีกระสือออกหากิน · ซากเจดีย์โบราณเล่าตำนานนาคผู้พิทักษ์" },
  { id: "naga",     name: "บึงพญานาค",        lv: "Lv 16–20", color: "#5d5a82", boss: "พญานาค", cells: [9, 8, 11, 9],
    desc: "บึงใหญ่ทางอาคเนย์ · พญานาคถูกสาปจนคลุ้มคลั่ง · เศษดาบชิ้นที่ 2" },
  { id: "valley",   name: "หุบเขาหมอก",        lv: "Lv 14–24", color: "#6f9a8f", boss: "ยักษ์กุมภัณฑ์", cells: [10, 2, 12, 4], maps: { "10,4": "valley" },
    desc: "หุบเขาหมอกหนาทางตะวันออกเฉียงเหนือ · ยักษ์กุมภัณฑ์เฝ้าเศษดาบชิ้นที่ 3" },
  { id: "mangrove", name: "ป่าชายเลนปากน้ำ",   lv: "Lv 22–28", color: "#4f8a6e", boss: "จระเข้ชาละวัน", cells: [2, 7, 4, 10],
    desc: "ป่าโกงกางริมทะเล · จระเข้ชาละวันกลืนเรือสินค้าของเมืองท่า" },
  { id: "ruins",    name: "กรุงร้างศิลา",       lv: "Lv 28–34", color: "#b8a07a", boss: "พระยาเปรตเฝ้าคลัง", cells: [5, 10, 8, 11],
    desc: "เมืองโบราณที่ล่มสลาย · ภาพสลักเผยความลับของศิษย์ฤๅษีชื่อ \"จันทร์\"" },
  { id: "capital2", name: "กรุงศรีนาคา",       lv: "เมืองหลวง",  color: "#f0d080", town: true, cells: [12, 6, 12, 6],
    desc: "เมืองหลวงแห่งที่ 2 บนฝั่งตะวันออก · พระฤๅษีวาโยเฒ่าพำนักอยู่ที่นี่" },
  { id: "cave",     name: "ถ้ำนาคราช",          lv: "Lv 34–40", color: "#6b5a4a", boss: "นาคสามเศียร", cells: [12, 8, 13, 10],
    desc: "ถ้ำใต้ดินหลายชั้น คริสตัลเรืองแสง · นาคสามเศียรเฝ้าเศษดาบชิ้นที่ 4" },
  { id: "fire",     name: "ดินแดนเพลิงกาฬ",    lv: "Lv 40–46", color: "#c8643a", boss: "ครุฑเพลิง", cells: [13, 2, 16, 5],
    desc: "ทุ่งลาวาและทรายแดงทางตะวันออกไกล · ครุฑเพลิงเฝ้าเศษดาบชิ้นสุดท้าย" },
  { id: "gate",     name: "ประตูหิมพานต์",      lv: "Lv 46–50", color: "#8a6ad0", boss: "หมอผีจันทร์ร่างอสูร", cells: [15, 7, 16, 10],
    desc: "เกาะรอยแยกระหว่างสองโลก · ศึกสุดท้ายกับหมอผีจันทร์" },
];
// ข้อมูลของแผนที่ที่เปิดแล้ว (ทับคำอธิบายภูมิภาค) · พาส 1
const WM_MAP_INFO = {
  main: { lv: "Lv 1–60", desc: "ทุ่งนา Lv 1–18 · ป่าไผ่ Lv 22–38 · ป่าหิมพานต์ Lv 42–57 · บึงต้องห้าม",
          mini: "หมูป่าเขี้ยวเหล็ก Lv 18 · จ่าฝูงลิงกัง Lv 35 · ผีกองกอยเจ้าป่า Lv 52", boss: "แม่กระสือราชินี Lv 60 (สุ่มเกิดที่บึงต้องห้าม)" },
  valley: { lv: "Lv 115–196", desc: "ทางคดเคี้ยวผ่านลานในหมอก · ลานแรก Lv 115–128 → ลานกลาง 140–152 → ลานใต้ 165–178 → ลานเหนือ 190–196",
          mini: "ปอบเจ้าป่า Lv 130 · ตะขาบพันปี Lv 145", boss: "พญาเสือสมิง Lv 150 (ตัวเดียวทั้งเซิร์ฟเวอร์ · ลานลับข้างบึง)" },
  plain: { lv: "Lv 62–110", desc: "ทุ่งเหนือแม่น้ำ Lv 62–80 · ข้ามสะพานไม้ไปบึงบัว Lv 84–104 · ดงเก้งทองทางตะวันออกเฉียงใต้",
          mini: "หมาในจ่าฝูง Lv 80 · นกแสกเจ้าราตรี Lv 100", boss: "เก้งทองคำเจ้าป่า Lv 110 (ตัวเดียวทั้งเซิร์ฟเวอร์)" },
};
// ทางเชื่อมระหว่างแผนที่ที่เปิดแล้ว (ประตูมิติในเกม)
const WM_LINKS = [["city", "main"], ["main", "valley"], ["main", "plain"]];

let WM_CELLS = null;   // [{ c, r, reg, map, name }]
function wmBuildCells() {
  const cells = [], seen = new Set();
  const customs = Object.keys(typeof CUSTOM_MAPS === "object" ? CUSTOM_MAPS : {});
  let ci = 0;
  for (const reg of WM_REGIONS) {
    const [c1, r1, c2, r2] = reg.cells, list = [];
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (!seen.has(c + "," + r)) { seen.add(c + "," + r); list.push({ c, r }); }
    list.forEach((cell, i) => {
      let map = reg.maps && reg.maps[cell.c + "," + cell.r];
      if (!map && reg.custom && ci < customs.length) map = customs[ci++];   // แผนที่ของแอดมินเรียงลงช่องที่ราบลุ่มน้ำ
      const name = !map || !CUSTOM_MAPS[map] ? (map || list.length < 2 ? reg.name : `${reg.name} ${i + 1}`)
        : map ? (CUSTOM_MAPS[map].name || reg.name) : list.length > 1 ? `${reg.name} ${i + 1}` : reg.name;
      cells.push({ ...cell, reg, map: map || null, name });
    });
  }
  WM_CELLS = cells;
  return cells;
}
const wmOpen = cell => !!cell.map;
function wmCellOf(mapId) { return (WM_CELLS || wmBuildCells()).find(x => x.map === mapId); }

// สุ่มแบบคงที่ (แผนที่หน้าตาเหมือนเดิมทุกครั้ง)
function wmRng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const wmCv = $("worldMap"), wmCtx = wmCv.getContext("2d");
let wmBase = null, wmHover = null, wmCell = 0;
function wmSize() {
  const w = Math.min(innerWidth - 60, (innerHeight - 150) * WM_COLS / WM_ROWS, 1080), h = w * WM_ROWS / WM_COLS;
  wmCv.style.width = w + "px"; wmCv.style.height = h + "px";
  const W = Math.round(w * DPR), H = Math.round(h * DPR);
  if (wmCv.width !== W || wmCv.height !== H) { wmCv.width = W; wmCv.height = H; wmBase = null; }
  wmCell = W / WM_COLS;
}
// ภาพพื้นหลังทวีป (ทะเล ชายฝั่ง สีภูมิภาค ช่องแผนที่) วาดครั้งเดียวแล้วเก็บไว้
function wmDrawBase() {
  const W = wmCv.width, H = wmCv.height, S = wmCell, rnd = wmRng(7);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  // ทะเล
  const sea = g.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, "#2b5f7a"); sea.addColorStop(1, "#1d4560");
  g.fillStyle = sea; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(190,230,240,.18)"; g.lineWidth = Math.max(1, S * .03);
  for (let i = 0; i < 140; i++) { const x = rnd() * W, y = rnd() * H, l = S * (.2 + rnd() * .35); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - S * .06, x + l, y); g.stroke(); }
  const cells = WM_CELLS;
  const blobs = (grow, colorOf) => {   // ก้อนกลมซ้อนกันรอบทุกช่อง = แผ่นดินขอบโค้งแบบธรรมชาติ
    for (const cell of cells) {
      const r2 = wmRng(cell.c * 97 + cell.r * 13 + 1);
      g.fillStyle = colorOf(cell);
      for (let k = 0; k < 6; k++) {
        const x = (cell.c + .5 + (r2() - .5) * .7) * S, y = (cell.r + .5 + (r2() - .5) * .7) * S;
        g.beginPath(); g.arc(x, y, S * (.5 + r2() * .22) + grow, 0, Math.PI * 2); g.fill();
      }
    }
  };
  blobs(S * .32, () => "rgba(120,190,200,.35)");   // น้ำตื้นรอบเกาะ
  blobs(S * .14, () => "#e6d39c");                  // หาดทราย
  blobs(0, cell => cell.reg.color);                 // เนื้อดินตามภูมิภาค
  // ลายพื้นผิว: จุดหญ้า/หิน
  for (const cell of cells) {
    const r2 = wmRng(cell.c * 31 + cell.r * 7 + 3);
    for (let k = 0; k < 14; k++) {
      g.fillStyle = r2() < .5 ? "rgba(0,0,0,.12)" : "rgba(255,255,230,.12)";
      g.fillRect((cell.c + r2()) * S, (cell.r + r2()) * S, S * .05, S * .05);
    }
  }
  // ช่องแผนที่ (กรอบสี่เหลี่ยมแบบ RO)
  for (const cell of cells) {
    const x = cell.c * S, y = cell.r * S, pad = S * .07;
    g.fillStyle = "rgba(0,0,0,.08)"; g.fillRect(x + pad, y + pad, S - pad * 2, S - pad * 2);
    g.strokeStyle = "rgba(40,25,10,.45)"; g.lineWidth = Math.max(1, S * .025); g.strokeRect(x + pad, y + pad, S - pad * 2, S - pad * 2);
  }
  // ชื่อภูมิภาค
  g.textAlign = "center"; g.textBaseline = "middle";
  for (const reg of WM_REGIONS) {
    if (reg.town) continue;
    const [c1, r1, c2] = reg.cells, cx = (c1 + c2 + 1) / 2 * S, cy = r1 * S + S * .02;   // ชื่อภูมิภาคไว้ขอบบน ไม่ทับชื่อช่อง
    g.font = `700 ${S * .24}px ${FONT}`;
    g.lineWidth = S * .07; g.strokeStyle = "rgba(20,12,5,.75)"; g.strokeText(`${reg.name} · ${reg.lv}`, cx, cy);
    g.fillStyle = "rgba(255,246,220,.8)"; g.fillText(`${reg.name} · ${reg.lv}`, cx, cy);
  }
  // ชื่อทวีป + เข็มทิศ
  g.font = `700 ${S * .55}px Mitr, ${FONT}`; g.textAlign = "left";
  g.lineWidth = S * .1; g.strokeStyle = "rgba(10,25,35,.7)"; g.strokeText("แดนมนตรา", S * .45, S * .75);
  g.fillStyle = "#ffe9b0"; g.fillText("แดนมนตรา", S * .45, S * .75);
  const kx = W - S * .9, ky = H - S * .9;
  g.strokeStyle = "rgba(255,240,200,.7)"; g.lineWidth = Math.max(1, S * .03);
  g.beginPath(); g.arc(kx, ky, S * .38, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#ffe9b0"; g.beginPath(); g.moveTo(kx, ky - S * .34); g.lineTo(kx + S * .09, ky); g.lineTo(kx, ky + S * .08); g.lineTo(kx - S * .09, ky); g.closePath(); g.fill();
  g.font = `700 ${S * .2}px ${FONT}`; g.textAlign = "center"; g.fillText("N", kx, ky - S * .5);
  wmBase = c;
}
function drawWorld() {
  wmBuildCells(); wmSize();
  if (!wmBase) wmDrawBase();
  const g = wmCtx, S = wmCell, t = performance.now() / 1000;
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(wmBase, 0, 0);
  const center = cell => [(cell.c + .5) * S, (cell.r + .5) * S];
  // ช่องที่ยังไม่เปิด: มืดลง + กุญแจ
  g.textAlign = "center"; g.textBaseline = "middle";
  for (const cell of WM_CELLS) {
    if (wmOpen(cell)) continue;
    const pad = S * .07;
    g.fillStyle = "rgba(15,10,5,.42)"; g.fillRect(cell.c * S + pad, cell.r * S + pad, S - pad * 2, S - pad * 2);
    if (cell.reg.town) { g.font = `${S * .42}px ${FONT}`; g.globalAlpha = .55; g.fillText("🏯", ...center(cell)); g.globalAlpha = 1; }
    else { g.font = `${S * .22}px ${FONT}`; g.globalAlpha = .5; g.fillText("🔒", ...center(cell)); g.globalAlpha = 1; }
  }
  // ทางเชื่อมระหว่างแผนที่ที่เปิดแล้ว
  const links = WM_LINKS.slice();
  for (const [id, m] of Object.entries(CUSTOM_MAPS)) {   // ประตูมิติของแผนที่แอดมิน
    if (m.entry && m.entry.map) links.push([m.entry.map, id]);
  }
  g.setLineDash([S * .08, S * .07]); g.lineWidth = Math.max(1.5, S * .045); g.strokeStyle = "rgba(255,226,140,.9)";
  for (const [a, b] of links) {
    const A = wmCellOf(a), B = wmCellOf(b); if (!A || !B) continue;
    g.beginPath(); g.moveTo(...center(A)); g.lineTo(...center(B)); g.stroke();
  }
  g.setLineDash([]);
  // ช่องที่เปิดแล้ว: กรอบทอง + ไอคอน + ชื่อ
  for (const cell of WM_CELLS) {
    if (!wmOpen(cell)) continue;
    const pad = S * .07, [x, y] = center(cell);
    g.strokeStyle = "#ffd76a"; g.lineWidth = Math.max(2, S * .06); g.strokeRect(cell.c * S + pad, cell.r * S + pad, S - pad * 2, S - pad * 2);
    g.font = `${S * .4}px ${FONT}`; g.fillText(cell.reg.town ? "🏯" : cell.reg.boss && cell.map === "valley" ? "⛰️" : "🌳", x, y - S * .06);
    g.font = `700 ${S * .17}px ${FONT}`;
    const tw = g.measureText(cell.name).width;
    if (tw > S * .98) g.font = `700 ${S * .17 * S * .98 / tw}px ${FONT}`;   // ชื่อยาว: ย่อให้พอดีช่อง
    g.lineWidth = S * .05; g.strokeStyle = "rgba(20,10,5,.9)"; g.strokeText(cell.name, x, y + S * .36);
    g.fillStyle = "#fff4d6"; g.fillText(cell.name, x, y + S * .36);
  }
  // ท่านอยู่ที่นี่
  const here = mode === "play" ? wmCellOf(currentMap) : null;
  if (here) {
    const [x, y] = center(here), k = 1 + Math.sin(t * 4) * .12;
    g.strokeStyle = "#ffffff"; g.lineWidth = Math.max(2, S * .05);
    g.beginPath(); g.arc(x, y, S * .55 * k, 0, Math.PI * 2); g.stroke();
    g.font = `700 ${S * .18}px ${FONT}`; g.lineWidth = S * .05; g.strokeStyle = "rgba(120,20,20,.95)";
    g.strokeText("★ ท่านอยู่ที่นี่", x, y - S * .62); g.fillStyle = "#fff"; g.fillText("★ ท่านอยู่ที่นี่", x, y - S * .62);
  }
  // ช่องที่เมาส์ชี้
  if (wmHover) { g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = Math.max(1.5, S * .03); g.strokeRect(wmHover.c * S + 2, wmHover.r * S + 2, S - 4, S - 4); }
  const open = WM_CELLS.filter(wmOpen).length;
  $("worldCount").textContent = `เปิดแล้ว ${open} / ${WM_CELLS.length} แผนที่`;
}
function wmTip(cell, ev) {
  const tip = $("worldTip");
  if (!cell) { tip.style.display = "none"; return; }
  const r = cell.reg, open = wmOpen(cell), info = WM_MAP_INFO[cell.map] || {};
  tip.innerHTML = `<b>${cell.name}</b> <span class="lv">${info.lv || r.lv}</span><br>${info.desc || r.desc}`
    + (info.mini ? `<br>👑 มินิบอส: ${info.mini}` : "")
    + ((info.boss || r.boss) ? `<br>💀 บอส: ${info.boss || r.boss}` : "")
    + `<br>${open ? `<span class="ok">✔ เปิดแล้ว</span>` : `<span class="lock">🔒 เร็ว ๆ นี้</span>`}`;
  tip.style.display = "block";
  const box = wmCv.parentElement.getBoundingClientRect();
  let x = ev.clientX - box.left + 14, y = ev.clientY - box.top + 14;
  if (x + 260 > box.width) x -= 280;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
wmCv.addEventListener("pointermove", e => {
  const b = wmCv.getBoundingClientRect(), c = Math.floor((e.clientX - b.left) / b.width * WM_COLS), r = Math.floor((e.clientY - b.top) / b.height * WM_ROWS);
  const cell = (WM_CELLS || []).find(x => x.c === c && x.r === r) || null;
  if (cell !== wmHover) { wmHover = cell; drawWorld(); }
  wmTip(cell, e);
});
wmCv.addEventListener("pointerleave", () => { wmHover = null; wmTip(null); drawWorld(); });
addEventListener("resize", () => { if (isOpen("worldWin")) drawWorld(); });
setInterval(() => { if (isOpen("worldWin")) drawWorld(); }, 120);   // วงกระพริบ "ท่านอยู่ที่นี่"
