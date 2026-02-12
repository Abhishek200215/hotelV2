import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import http from "node:http";
import { Server as SocketServer } from "socket.io";
import path from "node:path";

import { db, migrate } from "./db.js";
import { signJwt, requireHotelAuth, requireRole, requirePlatform } from "./auth.js";

migrate();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(process.cwd(), "public")));

const server = http.createServer(app);
const io = new SocketServer(server, { cors:{ origin:"*" }});

function moneyToPaise(n){ return Math.round(Number(n)*100); }
function paiseToRupees(p){ return (p/100).toFixed(2); }

function hotelBySlug(slug){
  return db.prepare("SELECT * FROM hotels WHERE slug=? AND is_active=1").get(slug);
}
function tableByToken(hotelId, tableNumber, token){
  return db.prepare("SELECT * FROM tables WHERE hotel_id=? AND table_number=? AND qr_token=? AND is_active=1")
    .get(hotelId, tableNumber, token);
}
function getMenu(hotelId){
  const cats = db.prepare("SELECT id,name,sort_order FROM categories WHERE hotel_id=? AND is_active=1 ORDER BY sort_order,name").all(hotelId);
  const items = db.prepare(`
    SELECT i.*, c.name AS category_name 
    FROM items i JOIN categories c ON c.id=i.category_id
    WHERE i.hotel_id=? AND i.in_stock=1
    ORDER BY c.sort_order,c.name,i.name
  `).all(hotelId);
  return { cats, items };
}

function getOrder(orderId){
  const o = db.prepare(`
    SELECT o.*, t.table_number, h.slug AS hotel_slug, h.name AS hotel_name
    FROM orders o
    JOIN tables t ON t.id=o.table_id
    JOIN hotels h ON h.id=o.hotel_id
    WHERE o.id=?
  `).get(orderId);
  if(!o) return null;
  const items = db.prepare("SELECT name_snapshot, price_snapshot, qty, notes FROM order_items WHERE order_id=?").all(orderId);
  return {
    orderId: o.id,
    hotelId: o.hotel_id,
    hotelSlug: o.hotel_slug,
    hotelName: o.hotel_name,
    table: o.table_number,
    status: o.status,
    etaMinutes: o.eta_minutes,
    subtotal: Number(paiseToRupees(o.subtotal)),
    total: Number(paiseToRupees(o.total)),
    createdAt: o.created_at,
    items: items.map(i=>({
      name: i.name_snapshot,
      price: Number(paiseToRupees(i.price_snapshot)),
      qty: i.qty,
      notes: i.notes || ""
    }))
  };
}

/* ---------- Public ---------- */

app.get("/api/public/hotels", (req,res)=>{
  const hotels=db.prepare("SELECT slug,name FROM hotels WHERE is_active=1 ORDER BY name").all();
  res.json({ hotels });
});

app.get("/api/public/context", (req,res)=>{
  const slug=(req.query.hotel||"").toString();
  const table=(req.query.table||"").toString();
  const token=(req.query.t||"").toString();
  if(!slug||!table||!token) return res.status(400).json({error:"Missing hotel/table/token"});
  const hotel=hotelBySlug(slug);
  if(!hotel) return res.status(404).json({error:"Hotel not found"});
  const trow=tableByToken(hotel.id, table, token);
  if(!trow) return res.status(401).json({error:"Invalid token"});
  const menu=getMenu(hotel.id);
  res.json({
    hotel:{
      id: hotel.id,
      slug: hotel.slug,
      name: hotel.name,
      phone: hotel.phone,
      address: hotel.address,
      theme:{ accent: hotel.theme_accent },
      hero: hotel.hero_image
    },
    table:{ id: trow.id, number: trow.table_number },
    menu: menu.items.map(i=>({
      id:i.id, cat:i.category_name, name:i.name,
      price:Number(paiseToRupees(i.price)),
      veg:!!i.is_veg, best:!!i.is_best, spicy:!!i.is_spicy,
      prep:i.prep_minutes, img:i.image_url
    }))
  });
});

app.get("/api/public/qr", (req,res)=>{
  const slug=(req.query.hotel||"").toString();
  const hotel=hotelBySlug(slug);
  if(!hotel) return res.status(404).json({error:"Hotel not found"});
  const tables=db.prepare("SELECT table_number, qr_token FROM tables WHERE hotel_id=? AND is_active=1 ORDER BY table_number").all(hotel.id);
  res.json({ hotel:{slug:hotel.slug,name:hotel.name}, tables });
});

app.post("/api/public/orders", (req,res)=>{
  const { hotelSlug, tableNumber, token, items } = req.body || {};
  if(!hotelSlug||!tableNumber||!token) return res.status(400).json({error:"Missing context"});
  if(!Array.isArray(items)||items.length===0) return res.status(400).json({error:"Empty cart"});
  const hotel=hotelBySlug(hotelSlug);
  if(!hotel) return res.status(404).json({error:"Hotel not found"});
  const trow=tableByToken(hotel.id, String(tableNumber).padStart(2,"0"), token);
  if(!trow) return res.status(401).json({error:"Invalid token"});

  const ids=items.map(x=>x.id);
  const rows=db.prepare(`SELECT id,name,price FROM items WHERE hotel_id=? AND id IN (${ids.map(()=>"?").join(",")})`).all(hotel.id, ...ids);
  const map=new Map(rows.map(r=>[r.id,r]));

  let subtotal=0;
  for(const it of items){
    const row=map.get(it.id);
    if(!row) return res.status(400).json({error:"Invalid item"});
    const qty=Math.max(1,Math.min(99,Number(it.qty||1)));
    subtotal += row.price * qty;
  }
  const total=subtotal;

  const orderId=nanoid(12);
  db.prepare("INSERT INTO orders (id,hotel_id,table_id,status,eta_minutes,subtotal,total) VALUES (?,?,?,?,?,?,?)")
    .run(orderId, hotel.id, trow.id, "NEW", 15, subtotal, total);

  const ins=db.prepare("INSERT INTO order_items (id,order_id,item_id,name_snapshot,price_snapshot,qty,notes) VALUES (?,?,?,?,?,?,?)");
  for(const it of items){
    const row=map.get(it.id);
    const qty=Math.max(1,Math.min(99,Number(it.qty||1)));
    ins.run(nanoid(10), orderId, row.id, row.name, row.price, qty, "");
  }

  const order=getOrder(orderId);
  io.to(`hotel:${hotel.id}`).emit("order_created", order);
  res.json({ order });
});

app.get("/api/public/orders/:id", (req,res)=>{
  const order=getOrder(req.params.id);
  if(!order) return res.status(404).json({error:"Not found"});
  res.json({ order });
});

app.post("/api/public/feedback", (req,res)=>{
  const { orderId, rating, comment } = req.body || {};
  const o=db.prepare("SELECT id,status FROM orders WHERE id=?").get(orderId);
  if(!o) return res.status(404).json({error:"Order not found"});
  if(o.status!=="DELIVERED") return res.status(400).json({error:"Only after delivered"});
  try{
    db.prepare("INSERT INTO feedback (id,order_id,rating,comment) VALUES (?,?,?,?)")
      .run(nanoid(10), orderId, Math.max(1,Math.min(5,Number(rating))), String(comment||"").slice(0,500));
  }catch{
    return res.status(400).json({error:"Feedback already submitted"});
  }
  res.json({ ok:true });
});

/* ---------- Hotel Auth + Admin/Kitchen ---------- */

app.post("/api/auth/login", (req,res)=>{
  const { hotelSlug, email, password } = req.body || {};
  if(!hotelSlug||!email||!password) return res.status(400).json({error:"Missing fields"});
  const hotel=hotelBySlug(hotelSlug);
  if(!hotel) return res.status(404).json({error:"Hotel not found"});
  const user=db.prepare("SELECT * FROM hotel_users WHERE hotel_id=? AND email=?").get(hotel.id, String(email).toLowerCase());
  if(!user) return res.status(401).json({error:"Invalid"});
  if(!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({error:"Invalid"});
  const token=signJwt({ kind:"HOTEL", hotelId: hotel.id, role: user.role, email: user.email }, process.env.JWT_SECRET, "7d");
  res.json({ token, role:user.role, hotel:{ slug:hotel.slug, name:hotel.name } });
});

app.get("/api/hotel/me", requireHotelAuth(), (req,res)=>{
  const hotel=db.prepare("SELECT id,slug,name,phone,address,theme_accent,hero_image FROM hotels WHERE id=?").get(req.user.hotelId);
  res.json({ hotel });
});

app.put("/api/hotel/profile", requireHotelAuth(), requireRole("ADMIN"), (req,res)=>{
  const { name, phone, address, themeAccent, heroImage } = req.body || {};
  db.prepare("UPDATE hotels SET name=?, phone=?, address=?, theme_accent=?, hero_image=? WHERE id=?")
    .run(String(name||"").slice(0,80), String(phone||"").slice(0,30), String(address||"").slice(0,200),
         String(themeAccent||"#ff6b35").slice(0,20), String(heroImage||"").slice(0,400), req.user.hotelId);
  res.json({ ok:true });
});

app.get("/api/hotel/tables", requireHotelAuth(), (req,res)=>{
  const tables=db.prepare("SELECT id,table_number,qr_token,is_active FROM tables WHERE hotel_id=? ORDER BY table_number").all(req.user.hotelId);
  res.json({ tables });
});

app.post("/api/hotel/tables", requireHotelAuth(), requireRole("ADMIN"), (req,res)=>{
  const tn=String((req.body||{}).tableNumber||"").padStart(2,"0").slice(0,2);
  const id=nanoid(10);
  const token=nanoid(32);
  db.prepare("INSERT INTO tables (id,hotel_id,table_number,qr_token) VALUES (?,?,?,?)").run(id, req.user.hotelId, tn, token);
  res.json({ table:{ id, table_number: tn, qr_token: token } });
});

app.get("/api/hotel/menu", requireHotelAuth(), (req,res)=>{
  const cats=db.prepare("SELECT id,name,sort_order FROM categories WHERE hotel_id=? AND is_active=1 ORDER BY sort_order,name").all(req.user.hotelId);
  const items=db.prepare("SELECT i.*, c.name as category_name FROM items i JOIN categories c ON c.id=i.category_id WHERE i.hotel_id=? ORDER BY c.sort_order,c.name,i.name").all(req.user.hotelId);
  res.json({ menu:{ categories: cats, items } });
});

app.post("/api/hotel/categories", requireHotelAuth(), requireRole("ADMIN"), (req,res)=>{
  const { name, sortOrder } = req.body||{};
  const id=nanoid(10);
  db.prepare("INSERT INTO categories (id,hotel_id,name,sort_order) VALUES (?,?,?,?)").run(id, req.user.hotelId, String(name||"").slice(0,60), Number(sortOrder||0));
  res.json({ category:{ id } });
});

app.post("/api/hotel/items", requireHotelAuth(), requireRole("ADMIN"), (req,res)=>{
  const { categoryId, name, price, veg=true, best=false, spicy=false, prep=10, imageUrl="" } = req.body||{};
  const id=nanoid(10);
  db.prepare(`INSERT INTO items 
    (id,hotel_id,category_id,name,price,is_veg,is_best,is_spicy,in_stock,prep_minutes,image_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.user.hotelId, categoryId, String(name||"").slice(0,80), moneyToPaise(price||0),
         veg?1:0, best?1:0, spicy?1:0, 1, Number(prep||10), String(imageUrl||"").slice(0,400));
  res.json({ item:{ id } });
});

app.get("/api/hotel/orders", requireHotelAuth(), (req,res)=>{
  const rows=db.prepare("SELECT id FROM orders WHERE hotel_id=? ORDER BY created_at DESC LIMIT 200").all(req.user.hotelId);
  res.json({ orders: rows.map(r=>getOrder(r.id)) });
});

app.patch("/api/hotel/orders/:id/status", requireHotelAuth(), (req,res)=>{
  const { status, etaMinutes } = req.body || {};
  const allowed=new Set(["NEW","PREPARING","READY","DELIVERED","CANCELLED"]);
  if(!allowed.has(String(status))) return res.status(400).json({error:"Bad status"});
  const o=db.prepare("SELECT * FROM orders WHERE id=? AND hotel_id=?").get(req.params.id, req.user.hotelId);
  if(!o) return res.status(404).json({error:"Not found"});
  const eta = etaMinutes==null ? o.eta_minutes : Number(etaMinutes);
  db.prepare("UPDATE orders SET status=?, eta_minutes=? WHERE id=?").run(String(status), eta, req.params.id);
  const updated=getOrder(req.params.id);
  io.to(`hotel:${req.user.hotelId}`).emit("order_updated", updated);
  res.json({ order: updated });
});

/* ---------- Platform ---------- */
app.post("/api/platform/login", (req,res)=>{
  const { email, password } = req.body||{};
  if(email!==process.env.PLATFORM_EMAIL || password!==process.env.PLATFORM_PASSWORD) return res.status(401).json({error:"Invalid"});
  const token=signJwt({ kind:"PLATFORM", email }, process.env.JWT_SECRET, "7d");
  res.json({ token });
});

app.get("/api/platform/hotels", requirePlatform(), (req,res)=>{
  const hotels=db.prepare("SELECT id,slug,name,phone,address,is_active,created_at FROM hotels ORDER BY created_at DESC").all();
  const counts=db.prepare("SELECT hotel_id, COUNT(*) as orders FROM orders GROUP BY hotel_id").all();
  const map=new Map(counts.map(c=>[c.hotel_id,c.orders]));
  res.json({ hotels: hotels.map(h=>({ ...h, orders: map.get(h.id)||0 })) });
});


app.get("/api/platform/summary", requirePlatform(), (req,res)=>{
  const hotels_total = db.prepare("SELECT COUNT(*) as c FROM hotels").get().c;
  const hotels_active = db.prepare("SELECT COUNT(*) as c FROM hotels WHERE is_active=1").get().c;

  // "today" in SQLite = date('now') (UTC). Good enough for MVP.
  const orders_today = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at)=date('now')").get().c;
  const revenue_today = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE date(created_at)=date('now') AND status!='CANCELLED'").get().s;

  res.json({
    hotels_total,
    hotels_active,
    orders_today,
    revenue_today: Number(paiseToRupees(revenue_today))
  });
});

app.get("/api/platform/orders", requirePlatform(), (req,res)=>{
  const limit = Math.min(Number(req.query.limit||50), 200);
  const status = (req.query.status||"").toString().trim();
  let rows;
  if(status){
    rows = db.prepare(`
      SELECT o.created_at,o.status,o.total, t.table_number, h.name as hotel_name, h.slug as hotel_slug
      FROM orders o
      JOIN tables t ON t.id=o.table_id
      JOIN hotels h ON h.id=o.hotel_id
      WHERE o.status=?
      ORDER BY o.created_at DESC
      LIMIT ?
    `).all(status, limit);
  }else{
    rows = db.prepare(`
      SELECT o.created_at,o.status,o.total, t.table_number, h.name as hotel_name, h.slug as hotel_slug
      FROM orders o
      JOIN tables t ON t.id=o.table_id
      JOIN hotels h ON h.id=o.hotel_id
      ORDER BY o.created_at DESC
      LIMIT ?
    `).all(limit);
  }
  res.json({
    orders: rows.map(r=>({
      created_at: r.created_at,
      status: r.status,
      total_rupees: Number(paiseToRupees(r.total)),
      table_number: r.table_number,
      hotel_name: r.hotel_name,
      hotel_slug: r.hotel_slug
    }))
  });
});

app.patch("/api/platform/hotels/:id/active", requirePlatform(), (req,res)=>{
  const id = req.params.id;
  const is_active = Number(req.body?.is_active ? 1 : 0);
  const exists = db.prepare("SELECT id FROM hotels WHERE id=?").get(id);
  if(!exists) return res.status(404).json({error:"Hotel not found"});
  db.prepare("UPDATE hotels SET is_active=? WHERE id=?").run(is_active, id);
  res.json({ ok:true });
});

/* ---------- Socket ---------- */
io.on("connection",(socket)=>{
  socket.on("join_hotel", ({ hotelSlug })=>{
    const h=hotelBySlug(hotelSlug);
    if(h) socket.join(`hotel:${h.id}`);
  });
});

const PORT=Number(process.env.PORT||3000);
server.listen(PORT, ()=>console.log(`http://localhost:${PORT}`));
