import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const db = () => getStore("hn-data");
const imgs = () => getStore("hn-images");
const DEF = {
  settings: {
    shopName: "HỮU NHÂN SHOP", slogan: "UY TÍN TẠO THƯƠNG HIỆU – CHẤT LƯỢNG TẠO NIỀM TIN",
    heroText: "", services: "IOS, ANDROID, PC, LAPTOP, IPAD", logo: "", avatar: "", cover: "", banner: "",
    adminName: "HỮU NHÂN", bio: "", about: "", joined: "", achievements: "",
    zalo: "", tiktok: "", facebook: "", bank_name: "", bank_account: "", bank_holder: "", bank_qr: ""
  },
  boxes: [1, 2, 3, 4, 5].map(i => ({ id: i, name: "BOX TỔNG " + i, link: "", active: true })),
  products: []
};
const get = async (k, d) => (await db().get(k, { type: "json" })) ?? d;
const put = (k, v) => db().setJSON(k, v);
const mac = b => crypto.createHmac("sha256", process.env.SESSION_SECRET || "").update(b).digest("base64url");
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString("base64url"); return b + "." + mac(b); };
const verify = t => { try { const [b, s] = t.split("."); return safeEq(s, mac(b)) && JSON.parse(Buffer.from(b, "base64url")).exp > Date.now(); } catch { return false; } };

async function markPaid(o, orders, products) {
  if (o.status === "paid") return;
  o.status = "paid"; o.paidAt = new Date().toISOString();
  for (const it of o.items) { const p = products.find(x => x.id === it.id); if (p && p.qty != null) p.qty = Math.max(0, p.qty - it.qty); }
  await put("products", products); await put("orders", orders);
}

export default async (req) => {
  const p = new URL(req.url).pathname.replace(/^\/(\.netlify\/functions\/)?api\/?/, "").split("/");
  const m = req.method;
  const admin = () => process.env.SESSION_SECRET && verify((req.headers.get("authorization") || "").slice(7));
  const body = () => req.json().catch(() => ({}));
  try {
    if (p[0] === "login" && m === "POST") {
      const { password } = await body();
      if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET || !password || !safeEq(password, process.env.ADMIN_PASSWORD)) return J({ error: "Sai mật khẩu hoặc chưa cấu hình ADMIN_PASSWORD/SESSION_SECRET" }, 401);
      return J({ token: sign({ exp: Date.now() + 864e5 }) });
    }
    if (p[0] === "img" && m === "GET") {
      const b = await imgs().getWithMetadata(p[1], { type: "arrayBuffer" });
      if (!b) return new Response("", { status: 404 });
      return new Response(b.data, { headers: { "content-type": b.metadata?.type || "image/jpeg", "cache-control": "public,max-age=31536000" } });
    }
    if (p[0] === "upload" && m === "POST") {
      if (!admin()) return J({ error: "Chưa đăng nhập" }, 401);
      const type = req.headers.get("content-type") || "";
      const buf = await req.arrayBuffer();
      if (!type.startsWith("image/") || buf.byteLength > 4e6) return J({ error: "Chỉ nhận ảnh ≤ 4MB" }, 400);
      const key = crypto.randomUUID();
      await imgs().set(key, buf, { metadata: { type } });
      return J({ url: "/api/img/" + key });
    }
    if (DEF[p[0]]) {
      if (m === "GET") { const d = await get(p[0], DEF[p[0]]); return J(p[0] === "settings" ? { ...DEF.settings, ...d } : d); }
      if (m === "PUT") {
        if (!admin()) return J({ error: "Chưa đăng nhập" }, 401);
        const d = await body();
        if (Array.isArray(DEF[p[0]]) !== Array.isArray(d)) return J({ error: "Dữ liệu sai định dạng" }, 400);
        await put(p[0], d); return J(d);
      }
    }
    if (p[0] === "orders") {
      const orders = await get("orders", []);
      if (m === "POST" && !p[1]) {
        const { name, phone, items } = await body();
        const products = await get("products", []);
        if (!name || !phone || !Array.isArray(items) || !items.length) return J({ error: "Thiếu thông tin" }, 400);
        const lines = [];
        for (const it of items) {
          const pr = products.find(x => x.id === it.id), qty = Math.max(1, parseInt(it.qty) || 1);
          if (!pr || (pr.qty != null && pr.qty < qty)) return J({ error: "Sản phẩm không tồn tại hoặc hết hàng" }, 400);
          lines.push({ id: pr.id, name: pr.name, qty, price: Number(pr.sale || pr.price) });
        }
        const o = { code: "HN" + Date.now().toString(36).toUpperCase() + crypto.randomInt(100, 999), name: String(name).slice(0, 80), phone: String(phone).slice(0, 20), items: lines, total: lines.reduce((s, l) => s + l.price * l.qty, 0), status: "pending", createdAt: new Date().toISOString() };
        orders.push(o); await put("orders", orders); return J(o);
      }
      if (m === "GET" && p[1]) { const o = orders.find(x => x.code === p[1]); return o ? J({ code: o.code, items: o.items, total: o.total, status: o.status, createdAt: o.createdAt }) : J({ error: "Không tìm thấy đơn" }, 404); }
      if (!admin()) return J({ error: "Chưa đăng nhập" }, 401);
      if (m === "GET") return J(orders);
      if (m === "PUT" && p[1]) {
        const o = orders.find(x => x.code === p[1]); if (!o) return J({ error: "Không tìm thấy đơn" }, 404);
        const { status } = await body();
        if (status === "paid") await markPaid(o, orders, await get("products", [])); else { o.status = status; await put("orders", orders); }
        return J(o);
      }
    }
    if (p[0] === "customers" && m === "GET") {
      if (!admin()) return J({ error: "Chưa đăng nhập" }, 401);
      const map = {};
      for (const o of await get("orders", [])) { const c = map[o.phone] ||= { phone: o.phone, name: o.name, orders: 0, spent: 0, history: [] }; c.orders++; c.history.push(o.code); if (o.status === "paid") c.spent += o.total; }
      return J(Object.values(map).sort((a, b) => b.spent - a.spent));
    }
    // Webhook từ cổng thanh toán (SePay/Casso...): xác nhận thật theo mã đơn + số tiền
    if (p[0] === "webhook" && m === "POST") {
      if (!process.env.PAYMENT_WEBHOOK_KEY || !safeEq(req.headers.get("x-api-key") || "", process.env.PAYMENT_WEBHOOK_KEY)) return J({ error: "Unauthorized" }, 401);
      const { code, amount } = await body();
      const orders = await get("orders", []), o = orders.find(x => x.code === code);
      if (!o || Number(amount) < o.total) return J({ ok: false });
      await markPaid(o, orders, await get("products", [])); return J({ ok: true });
    }
    return J({ error: "Not found" }, 404);
  } catch (e) { return J({ error: "Lỗi máy chủ" }, 500); }
};
