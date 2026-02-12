import "dotenv/config";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db, migrate } from "./db.js";

migrate();

function ensureHotel(slug, name, theme, hero, phone, address){
  const ex=db.prepare("SELECT * FROM hotels WHERE slug=?").get(slug);
  if(ex) return ex.id;
  const id=nanoid(10);
  db.prepare("INSERT INTO hotels (id,slug,name,theme_accent,hero_image,phone,address) VALUES (?,?,?,?,?,?,?)")
    .run(id,slug,name,theme,hero,phone,address);
  return id;
}

function ensureUser(hotelId,email,password,role){
  const hash=bcrypt.hashSync(password,10);
  db.prepare("INSERT OR IGNORE INTO hotel_users (id,hotel_id,email,password_hash,role) VALUES (?,?,?,?,?)")
    .run(nanoid(10),hotelId,email.toLowerCase(),hash,role);
}

function ensureTable(hotelId,num){
  const tn=String(num).padStart(2,"0");
  const ex=db.prepare("SELECT * FROM tables WHERE hotel_id=? AND table_number=?").get(hotelId,tn);
  if(ex) return;
  db.prepare("INSERT INTO tables (id,hotel_id,table_number,qr_token) VALUES (?,?,?,?)")
    .run(nanoid(10),hotelId,tn,nanoid(32));
}

function cat(hotelId,name,sort){
  const ex=db.prepare("SELECT * FROM categories WHERE hotel_id=? AND name=?").get(hotelId,name);
  if(ex) return ex.id;
  const id=nanoid(10);
  db.prepare("INSERT INTO categories (id,hotel_id,name,sort_order) VALUES (?,?,?,?)").run(id,hotelId,name,sort);
  return id;
}
function item(hotelId,catId,name,rupees,opts={}){
  db.prepare(`INSERT INTO items (id,hotel_id,category_id,name,price,is_veg,is_best,is_spicy,in_stock,prep_minutes,image_url)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(nanoid(10),hotelId,catId,name,Math.round(Number(rupees)*100),
         opts.veg?1:0, opts.best?1:0, opts.spicy?1:0, 1, opts.prep||10, opts.img||"");
}

const hero1="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80";
const hero2="https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1600&q=80";

const h1=ensureHotel("hotel-a","Hotel A - Spice Garden","#ff6b35",hero1,"+91 90000 00001","Hirekerur");
const h2=ensureHotel("hotel-b","Hotel B - City Diner","#2b7cff",hero2,"+91 90000 00002","Haveri");

ensureUser(h1,"admin@hotel-a.com","admin123","ADMIN");
ensureUser(h2,"admin@hotel-b.com","admin123","ADMIN");
ensureUser(h1,"kitchen@hotel-a.com","kitchen123","KITCHEN");

for(let i=1;i<=5;i++){ ensureTable(h1,i); ensureTable(h2,i); }

const c1=cat(h1,"Breakfast",1);
const c2=cat(h1,"Veg",2);
const c3=cat(h1,"Non-Veg",3);
const c4=cat(h2,"Snacks",1);
const c5=cat(h2,"Beverages",2);

item(h1,c1,"Masala Dosa",60,{veg:true,best:true,prep:12,img:"https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=1200&q=80"});
item(h1,c1,"Idli Vada",45,{veg:true,prep:10,img:"https://images.unsplash.com/photo-1668236542559-0f3e4f7c3b7b?auto=format&fit=crop&w=1200&q=80"});
item(h1,c2,"Paneer Butter Masala",160,{veg:true,best:true,prep:18,img:"https://images.unsplash.com/photo-1604908812850-1bf3eefec9e3?auto=format&fit=crop&w=1200&q=80"});
item(h1,c3,"Chicken Biryani",220,{veg:false,best:true,spicy:true,prep:20,img:"https://images.unsplash.com/photo-1604908177522-0402691debd2?auto=format&fit=crop&w=1200&q=80"});

item(h2,c4,"Veg Burger",90,{veg:true,best:true,prep:12,img:"https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80"});
item(h2,c4,"Margherita Pizza",180,{veg:true,prep:15,img:"https://images.unsplash.com/photo-1548365328-8b849e6f2c04?auto=format&fit=crop&w=1200&q=80"});
item(h2,c5,"Fresh Lime Soda",40,{veg:true,prep:5,img:"https://images.unsplash.com/photo-1542444459-db63c32f4b55?auto=format&fit=crop&w=1200&q=80"});

console.log("✅ Seeded.");
console.log("Admin A: admin@hotel-a.com / admin123");
console.log("Admin B: admin@hotel-b.com / admin123");
console.log("Kitchen A: kitchen@hotel-a.com / kitchen123");
