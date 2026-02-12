/* AppState (Full-stack MVP) */
const AppState = (() => {
  const CART_KEY = "foodieqr_cart_v2";
  const LAST_ORDER_KEY = "foodieqr_last_order_v2";

  let ctx = null; // loaded from /api/public/context
  let cart = { hotelSlug:null, table:"01", token:"", items:[] };

  function parseQuery(){
    const p = new URLSearchParams(location.search);
    const out = {};
    for (const [k,v] of p.entries()) out[k]=v;
    return out;
  }

  async function init(){
    try{
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "null");
      if (saved && saved.items) cart = saved;
    }catch{}

    const q = parseQuery();
    if (q.hotel) cart.hotelSlug = q.hotel;
    if (q.table) cart.table = String(q.table).padStart(2,"0");
    if (q.t) cart.token = q.t;

    // If token present, fetch context (menu/profile)
    if (cart.hotelSlug && cart.table && cart.token){
      const res = await fetch(`/api/public/context?hotel=${encodeURIComponent(cart.hotelSlug)}&table=${encodeURIComponent(cart.table)}&t=${encodeURIComponent(cart.token)}`);
      if (res.ok) ctx = await res.json();
    }
    save();
  }

  function save(){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
  function set(next){ cart = { ...cart, ...next }; save(); }
  function get(){
    return {
      theme: { accent: ctx?.hotel?.theme?.accent || "#ff6b35" },
      cart: { hotelId: cart.hotelSlug || "hotel-a", table: cart.table, items: cart.items },
      hotels: ctx ? [{ id: ctx.hotel.slug, name: ctx.hotel.name, hero: ctx.hotel.hero, menu: ctx.menu }] : [],
      lastOrderId: localStorage.getItem(LAST_ORDER_KEY)
    };
  }

  function applyTheme(){
    const accent = ctx?.hotel?.theme?.accent || "#ff6b35";
    document.documentElement.style.setProperty("--accent", accent);
  }

  function ensureContextFromQuery(){}

  function getHotel(hotelSlug){
    if (ctx && ctx.hotel.slug === hotelSlug){
      return { id: ctx.hotel.slug, name: ctx.hotel.name, hero: ctx.hotel.hero, phone: ctx.hotel.phone, address: ctx.hotel.address, menu: ctx.menu };
    }
    return { id: hotelSlug, name: hotelSlug, menu: [] };
  }

  function uid(){ return Math.random().toString(36).slice(2,10); }
  function currency(n){ return `₹${Number(n).toFixed(2)}`; }

  function computeCartTotals(cartObj, hotel){
    const map = new Map((hotel.menu||[]).map(i => [i.id, i]));
    let subtotal = 0;
    for (const it of (cartObj.items||[])){
      const row = map.get(it.id);
      if (!row) continue;
      subtotal += Number(row.price) * Number(it.qty || 1);
    }
    const tax = 0;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }

  function addToCart(itemId, qty=1){
    const f = cart.items.find(x=>x.id===itemId);
    if(f) f.qty += qty;
    else cart.items.push({ id:itemId, qty });
    save();
  }
  function removeFromCart(itemId){
    cart.items = cart.items.filter(x=>x.id!==itemId);
    save();
  }
  function updateCartQty(itemId, qty){
    const f = cart.items.find(x=>x.id===itemId);
    if(f) f.qty = Math.max(1, Math.min(99, Number(qty||1)));
    save();
  }
  function clearCart(){ cart.items=[]; save(); }

  async function createOrder(paymentMethod="UPI"){
    const payload = { hotelSlug: cart.hotelSlug, tableNumber: cart.table, token: cart.token, items: cart.items.map(i=>({id:i.id, qty:i.qty})) };
    const res = await fetch("/api/public/orders", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    localStorage.setItem(LAST_ORDER_KEY, data.order.orderId);
    clearCart();
    return data.order;
  }

  async function getOrder(orderId){
    const res = await fetch(`/api/public/orders/${encodeURIComponent(orderId)}`);
    if(!res.ok) return null;
    const data = await res.json();
    return data.order;
  }

  return {
    init, parseQuery, applyTheme, ensureContextFromQuery,
    get, set, save,
    getHotel, uid, currency,
    computeCartTotals,
    addToCart, removeFromCart, updateCartQty, clearCart,
    createOrder, getOrder
  };
})();
