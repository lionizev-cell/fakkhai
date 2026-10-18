// บอท Messenger เพจความลับพลังตัวเลข
// คำนวณด้วยสคริปต์จริงของเว็บ palangtuaylek ผลจึงตรงกับเว็บเสมอ
// ไม่ต้องติดตั้งแพ็กเกจเพิ่ม ใช้ Node 18 ขึ้นไป
const http = require("http");
const crypto = require("crypto");
const engine = require("./engine");

const PAGE_TOKEN = process.env.PAGE_ACCESS_TOKEN || "";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "palang-verify";
const APP_SECRET = process.env.APP_SECRET || "";
const DRY_RUN = process.env.DRY_RUN === "1";
const LINE_URL = process.env.LINE_URL || "https://lin.ee/7l0p6Up";
const SITE_URLS = [
  "https://www.palangtuaylek.com/palangtuaylek.html",
  "https://lionizev-cell.github.io/palangtuaylek.html",
];
const PAUSE_HOURS = +(process.env.PAUSE_HOURS || 12);

// ---------- โหลดสคริปต์จากเว็บ (โหลดใหม่ทุก 6 ชั่วโมง เว็บแก้อะไร บอทตามทันเอง) ----------
async function loadSite() {
  if (process.env.SITE_FILE) { engine.load(require("fs").readFileSync(process.env.SITE_FILE, "utf8")); return true; }
  for (const u of SITE_URLS) {
    try {
      const res = await fetch(u + "?t=" + Date.now());
      if (!res.ok) continue;
      const html = await res.text();
      const m = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
      if (!m) continue;
      const src = m[m.length - 1].replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
      engine.load(src);
      console.log("loaded site script from", u, src.length);
      return true;
    } catch (e) { console.error("load fail", u, e.message); }
  }
  return false;
}
setInterval(loadSite, 6 * 3600 * 1000);

// ---------- เก็บสถานะการคุยของแต่ละคน ----------
const S = new Map(); // psid -> {step, data, pausedUntil}
const st = id => { if (!S.has(id)) S.set(id, { step: null, data: {} }); return S.get(id); };

// ---------- อ่านข้อความลูกค้า ----------
const thaiDigits = s => String(s || "").replace(/[๐-๙]/g, c => "๐๑๒๓๔๕๖๗๘๙".indexOf(c));
function parsePhone(t) {
  let d = thaiDigits(t).replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("66")) d = "0" + d.slice(2);
  return /^0\d{9}$/.test(d) ? d : null;
}
const MONTHS = ["มกรา","กุมภา","มีนา","เมษา","พฤษภา","มิถุนา","กรกฎา","สิงหา","กันยา","ตุลา","พฤศจิกา","ธันวา"];
const MSHORT = ["ม.ค","ก.พ","มี.ค","เม.ย","พ.ค","มิ.ย","ก.ค","ส.ค","ก.ย","ต.ค","พ.ย","ธ.ค"];
function parseDate(t) {
  t = thaiDigits(t);
  let d, m, y;
  let r = t.match(/(\d{1,2})\s*[\/\-. ]\s*(\d{1,2})\s*[\/\-. ]\s*(\d{4})/);
  if (r) { d = +r[1]; m = +r[2]; y = +r[3]; }
  else {
    r = t.match(/(\d{1,2})\s*([^\d\s]+[^\d]*?)\s*(\d{4})/);
    if (!r) return null;
    d = +r[1];
    const w = r[2].replace(/\s/g, "");
    m = MONTHS.findIndex(x => w.includes(x)) + 1 || MSHORT.findIndex(x => w.replace(/\.$/, "").startsWith(x)) + 1;
    y = +r[3];
    if (!m) return null;
  }
  if (y > 2400) y -= 543;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || y < 1900 || y > new Date().getFullYear()) return null;
  return { d, m, y };
}
function parseTime(t) {
  t = thaiDigits(t);
  if (/ไม่ทราบ|ไม่รู้|จำไม่ได้|ไม่แน่ใจ/.test(t)) return { notime: true, h: 6, mi: 0 };
  const r = t.match(/(\d{1,2})\s*[:.น]\s*(\d{1,2})/) || t.match(/^(\d{1,2})\s*(?:โมง|นาฬิกา|น\.?)?\s*$/);
  if (!r) return null;
  const h = +r[1], mi = +(r[2] || 0);
  if (h > 23 || mi > 59) return null;
  return { notime: false, h, mi };
}
function parseProv(t) {
  const P = engine.provList(); t = String(t || "").replace(/\s/g, "").replace(/^จ\.|^จังหวัด/, "");
  if (/กทม|กรุงเทพ|bangkok/i.test(t)) return 0;
  if (/อยุธยา/.test(t)) return P.findIndex(p => p[0].includes("อยุธยา"));
  if (/ต่างประเทศ|เมืองนอก/.test(t)) return P.length - 1;
  const i = P.findIndex(p => t.includes(p[0]) || (t.length >= 3 && p[0].startsWith(t)));
  return i >= 0 ? i : null;
}
function parseSex(t) { if (/หญิง|ผญ|สาว|female/i.test(t)) return "f"; if (/ชาย|ผช|male/i.test(t)) return "m"; return null; }

// ---------- ส่งข้อความ ----------
async function send(psid, text, quick) {
  const chunks = [];
  let s = text;
  while (s.length > 1900) { let cut = s.lastIndexOf("\n", 1900); if (cut < 500) cut = 1900; chunks.push(s.slice(0, cut)); s = s.slice(cut).trim(); }
  chunks.push(s);
  for (let i = 0; i < chunks.length; i++) {
    const msg = { text: chunks[i] };
    if (quick && i === chunks.length - 1) msg.quick_replies = quick.map(q => ({ content_type: "text", title: q, payload: q }));
    if (DRY_RUN) { console.log("SEND>", psid, JSON.stringify(msg)); continue; }
    const res = await fetch("https://graph.facebook.com/v21.0/me/messages?access_token=" + encodeURIComponent(PAGE_TOKEN), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: psid }, messaging_type: "RESPONSE", message: msg }),
    });
    if (!res.ok) console.error("send fail", res.status, await res.text());
  }
}

// ---------- สร้างคำตอบจากผลของเว็บ ----------
function section(text, head, nextHeads) {
  const i = text.indexOf(head); if (i < 0) return "";
  let s = text.slice(i + head.length);
  let end = s.length; nextHeads.forEach(h => { const j = s.indexOf(h); if (j >= 0 && j < end) end = j; });
  return s.slice(0, end).replace(/\s+/g, " ").trim();
}
function buildReply(d, r) {
  const ph = d.phone.slice(0, 3) + "-" + d.phone.slice(3, 6) + "-" + d.phone.slice(6);
  const heads = ["ภาพรวม", "ท้ายเบอร์และผลรวม", "ช่วงวัยของคุณ", "เบอร์นี้ส่งผลกับชีวิตคุณอย่างไร", "อ่านคำอธิบาย", "พลังของเลขแต่ละตัว"];
  const p1 = section(r.text, "ภาพรวม\n", heads);
  const p2 = section(r.text, "ท้ายเบอร์และผลรวม\n", heads);
  const tip = section(r.text, "คำแนะนำ", heads.concat(["\n\n"]));
  const out = [];
  out.push("ผลเบอร์ " + ph);
  out.push(p1 || ("เบอร์นี้ได้ " + r.s1000 + " คะแนนจาก 1000"));
  if (p2) out.push(p2);
  out.push("เลขพลังดีในดวงคุณคือ " + (r.good.join(" ") || "ไม่มีตัวที่เด่นชัด") + " ส่วนเลขพลังอ่อนคือ " + (r.bad.join(" ") || "ไม่มี") + " เลขพลังอ่อนควรร้อยเรียงอย่างระวัง");
  if (tip) out.push(tip.replace(/^\s*/, ""));
  if (d.notime) out.push("ไม่ทราบเวลาเกิด ระบบใช้เวลา 06:00 ลัคนาจึงเป็นค่าโดยประมาณ");
  out.push("นี่คือผลเบื้องต้นจากระบบ ถ้าอยากให้ผมดูละเอียดทุกตำแหน่งเทียบกับดวงและงานของคุณ พิมพ์คำว่า เจาะลึก แล้วผมจะเข้ามาคุยเองครับ หรือแอดไลน์ " + LINE_URL);
  return out.join("\n\n");
}

// ---------- ลำดับการถาม ----------
const ASK = {
  phone: "ส่งเบอร์มือถือ 10 หลักที่อยากให้ดูมาได้เลยครับ",
  sex: "เบอร์นี้ใช้โดยผู้ชายหรือผู้หญิงครับ",
  date: "ขอวันเดือนปีเกิดของเจ้าของเบอร์ครับ เช่น 12/5/2533",
  time: "เกิดกี่โมงครับ เช่น 07:43 ถ้าไม่ทราบพิมพ์ ไม่ทราบ",
  prov: "เกิดจังหวัดอะไรครับ",
  job: "ทำงานอาชีพอะไรครับ เช่น ขายของออนไลน์ รับราชการ พนักงานบริษัท",
};
const ORDER = ["phone", "sex", "date", "time", "prov", "job"];
const QUICK = { sex: ["ชาย", "หญิง"], time: ["ไม่ทราบ"] };
function nextStep(d) { return ORDER.find(k => d[k] === undefined) || null; }
async function ask(psid, s) { s.step = nextStep(s.data); if (s.step) await send(psid, ASK[s.step], QUICK[s.step]); }

async function handleText(psid, raw) {
  const t = String(raw || "").trim(); const s = st(psid);
  if (s.pausedUntil && Date.now() < s.pausedUntil) return; // อาจารย์คุยอยู่ บอทเงียบ

  if (/^(เจาะลึก|คุยกับอาจารย์|คุยกับคน|แอดมิน)/.test(t)) {
    s.pausedUntil = Date.now() + PAUSE_HOURS * 3600e3; s.step = null;
    await send(psid, "รับทราบครับ เดี๋ยวผมเข้ามาคุยเองนะครับ ระหว่างนี้เตรียมบอกผมด้วยว่าอยากให้เบอร์ช่วยเรื่องอะไรเป็นหลัก");
    return;
  }
  if (/^(ยกเลิก|เริ่มใหม่)/.test(t)) { s.data = {}; s.step = null; await send(psid, "ล้างข้อมูลแล้วครับ พิมพ์ เช็คเบอร์ เมื่อพร้อม", ["เช็คเบอร์"]); return; }

  const phone = parsePhone(t);
  // เริ่มคุยเมื่อมีเบอร์ หรือพิมพ์ขอเช็คเบอร์ นอกนั้นบอทเงียบ ปล่อยให้อาจารย์ตอบเอง
  if (!s.step) {
    if (phone) {
      const keep = s.data.date ? s.data : {};
      s.data = { ...keep, phone };
      if (keep.date) await send(psid, "ใช้ข้อมูลวันเกิดเดิมนะครับ ถ้าเป็นของคนอื่นพิมพ์ เริ่มใหม่");
    } else if (/เช็ค?เบอร์|ดูเบอร์|วิเคราะห์เบอร์|เช็กเบอร์/.test(t)) {
      s.data = s.data.date ? { ...s.data, phone: undefined } : {};
    } else return;
    if (!s.data.date) await send(psid, "สวัสดีครับ ผมขอข้อมูลเจ้าของเบอร์ไม่กี่อย่าง เพื่อผูกดวงแล้วดูว่าเบอร์เข้ากับดวงไหมครับ");
    await ask(psid, s); if (!s.step) await finish(psid, s); return;
  }

  const k = s.step; let ok = true;
  if (k === "phone") { if (phone) s.data.phone = phone; else ok = false; }
  else if (k === "sex") { const v = parseSex(t); if (v) s.data.sex = v; else ok = false; }
  else if (k === "date") { const v = parseDate(t); if (v) Object.assign(s.data, { date: v }); else ok = false; }
  else if (k === "time") { const v = parseTime(t); if (v) Object.assign(s.data, { time: v, notime: v.notime }); else ok = false; }
  else if (k === "prov") { const v = parseProv(t); if (v !== null) s.data.prov = v; else ok = false; }
  else if (k === "job") { s.data.job = t.slice(0, 80); }
  if (!ok) { await send(psid, "ผมอ่านไม่ออกครับ " + ASK[k], QUICK[k]); return; }
  await ask(psid, s);
  if (!s.step) await finish(psid, s);
}

async function finish(psid, s) {
  const d = s.data, pv = engine.provList()[d.prov];
  const inp = { fname: "", lname: "", nick: "", sex: d.sex, jobText: d.job, d: d.date.d, m: d.date.m, y: d.date.y,
    h: d.time.h, mi: d.time.mi, notime: d.time.notime, lat: pv[1], lon: pv[2], provName: pv[0], phone: d.phone, lagOv: -1 };
  try {
    const r = engine.run(inp);
    await send(psid, buildReply({ ...d, notime: d.time.notime }, r), ["เช็คเบอร์อื่น", "เจาะลึก"]);
  } catch (e) {
    console.error("analyze error", e);
    await send(psid, "ระบบคำนวณขัดข้องครับ เดี๋ยวผมเข้ามาดูให้เองนะครับ");
  }
  s.step = null; s.data.phone = undefined;
}

// ---------- รับ webhook จาก Facebook ----------
function verifySig(req, body) {
  if (!APP_SECRET) return true;
  const sig = req.headers["x-hub-signature-256"] || "";
  const exp = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(body).digest("hex");
  return sig.length === exp.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp));
}
async function onEvent(ev) {
  const psid = ev.sender && ev.sender.id;
  if (ev.message && ev.message.is_echo) {
    // อาจารย์พิมพ์ตอบเองจากเพจ ให้บอทหยุดกับลูกค้าคนนี้ชั่วคราว
    if (!ev.message.app_id && ev.recipient) { const s = st(ev.recipient.id); s.pausedUntil = Date.now() + PAUSE_HOURS * 3600e3; s.step = null; }
    return;
  }
  if (!psid) return;
  if (ev.message && ev.message.quick_reply) {
    const p = ev.message.quick_reply.payload;
    return handleText(psid, p === "เช็คเบอร์อื่น" ? "เช็คเบอร์" : p);
  }
  if (ev.message && ev.message.text) return handleText(psid, ev.message.text);
  if (ev.postback) return handleText(psid, ev.postback.payload === "GET_STARTED" ? "เช็คเบอร์" : ev.postback.title || "");
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "GET" && u.pathname === "/webhook") {
    if (u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === VERIFY_TOKEN) {
      res.writeHead(200); return res.end(u.searchParams.get("hub.challenge"));
    }
    res.writeHead(403); return res.end("forbidden");
  }
  if (req.method === "POST" && u.pathname === "/webhook") {
    const bufs = []; req.on("data", c => bufs.push(c));
    req.on("end", () => {
      const body = Buffer.concat(bufs);
      if (!verifySig(req, body)) { res.writeHead(403); return res.end(); }
      res.writeHead(200); res.end("EVENT_RECEIVED");
      let j; try { j = JSON.parse(body); } catch { return; }
      if (j.object !== "page") return;
      (j.entry || []).forEach(e => (e.messaging || []).forEach(ev => onEvent(ev).catch(err => console.error(err))));
    });
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("palang bot ok, site loaded: " + (engine.loadedAt() ? new Date(engine.loadedAt()).toISOString() : "no"));
});

loadSite().then(ok => {
  if (!ok) console.error("โหลดสคริปต์เว็บไม่ได้ จะลองใหม่ใน 6 ชั่วโมง");
  server.listen(process.env.PORT || 3000, () => console.log("listening", process.env.PORT || 3000));
});
module.exports = { handleText, parseDate, parseTime, parseProv };
