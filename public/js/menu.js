(async()=>{
  await AppState.init();
AppState.applyTheme();
mountNav("menu");
AppState.ensureContextFromQuery();

let activeCat = "All";
let filters = { veg:false, best:false, spicy:false };
let pendingItem = null;

function render(){
  const state = AppState.get();
  const hotel = AppState.getHotel(state.cart.hotelId);

  $("#ctxHotel").textContent = hotel.name;
  $("#ctxTable").textContent = `Table ${state.cart.table}`;

  // Categories
  const cats = ["All", ...Array.from(new Set(hotel.menu.map(m=>m.cat)))];
  const bar = $("#catBar");
  bar.innerHTML = "";
  for(const c of cats){
    const b = document.createElement("button");
    b.className = "pill" + (c===activeCat ? " active":"");
    b.textContent = c;
    b.onclick = ()=>{ activeCat=c; renderItems(); };
    bar.appendChild(b);
  }

  renderItems();
  renderCartAside();
}

function itemQtyInCart(itemId){
  const state = AppState.get();
  return (state.cart.items||[]).filter(ci=>ci.id===itemId).reduce((s,ci)=>s+ci.qty,0);
}

function matchesFilters(it){
  if(activeCat !== "All" && it.cat !== activeCat) return false;
  const q = $("#search").value.trim().toLowerCase();
  if(q){
    const hay = (it.name+" "+it.desc+" "+it.cat).toLowerCase();
    if(!hay.includes(q)) return false;
  }
  if(filters.veg && !it.veg) return false;
  if(filters.best && !it.bestseller) return false;
  if(filters.spicy && !it.spicy) return false;
  return true;
}

function renderItems(){
  const state = AppState.get();
  const hotel = AppState.getHotel(state.cart.hotelId);
  const list = hotel.menu.filter(matchesFilters);

  const wrap = $("#items");
  wrap.innerHTML = "";

  if(list.length === 0){
    wrap.innerHTML = `<div class="card pad" style="grid-column:1/-1">
      <div class="h3">No matches</div>
      <div class="smallmuted">Try a different search or clear filters.</div>
      <div class="sep"></div>
      <button class="btn" onclick="clearAll()">Clear all</button>
    </div>`;
    return;
  }

  for(const it of list){
    const qty = itemQtyInCart(it.id);
    const el = document.createElement("div");
    el.className = "card item";
    el.innerHTML = `
      <div class="img" style="background-image:url('${it.img}')"></div>
      <div class="body">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px">
          <div class="name">${it.name}</div>
          <span class="badge">${AppState.currency(it.price)}</span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px">
          <span class="badge">${it.veg ? "🥗 Veg" : "🍗 Non‑veg"}</span>
          ${it.bestseller ? `<span class="badge" style="border-color: rgba(255,107,53,.35); background: rgba(255,107,53,.10)">🔥 Bestseller</span>` : ""}
          ${it.spicy ? `<span class="badge" style="border-color: rgba(240,68,56,.25); background: rgba(240,68,56,.08)">🌶️ Spicy</span>` : ""}
          <span class="badge">⏱️ ${it.prep} min</span>
        </div>
        <div class="desc">${it.desc}</div>

        <div class="row">
          <button class="btn small" data-action="customize">Customize</button>
          <div class="stepper" aria-label="Quantity">
            <button data-action="minus" aria-label="Decrease">−</button>
            <div class="qty">${qty}</div>
            <button data-action="plus" aria-label="Increase">+</button>
          </div>
        </div>
      </div>
    `;

    el.querySelector('[data-action="plus"]').onclick = () => {
      AppState.addToCart(it, 1);
      showToast("Added to cart");
      renderCartAside();
      renderItems();
    };
    el.querySelector('[data-action="minus"]').onclick = () => {
      AppState.addToCart(it, -1);
      renderCartAside();
      renderItems();
    };
    el.querySelector('[data-action="customize"]').onclick = () => openNotes(it);

    wrap.appendChild(el);
  }
}

function renderCartAside(){
  const state = AppState.get();
  const hotel = AppState.getHotel(state.cart.hotelId);
  const cart = state.cart;

  const count = (cart.items||[]).reduce((s,it)=>s+it.qty,0);
  $("#cartMeta").textContent = count ? `${count} item(s) · Table ${cart.table}` : `Cart empty · Table ${cart.table}`;

  const list = $("#cartList");
  list.innerHTML = "";
  for(const it of (cart.items||[]).slice(0,6)){
    const line = document.createElement("div");
    line.className = "cart-line";
    line.innerHTML = `
      <div class="left">
        <img src="${it.img}" alt="">
        <div>
          <div class="nm">${it.name} <span class="smallmuted">×${it.qty}</span></div>
          ${it.notes ? `<div class="sm">📝 ${escapeHtml(it.notes).slice(0,48)}${it.notes.length>48?"…":""}</div>` : `<div class="sm">—</div>`}
        </div>
      </div>
      <div class="pr">${AppState.currency(it.price*it.qty)}</div>
    `;
    list.appendChild(line);
  }
  if((cart.items||[]).length > 6){
    const more = document.createElement("div");
    more.className = "smallmuted";
    more.textContent = `+ ${(cart.items.length-6)} more`;
    list.appendChild(more);
  }

  const totals = AppState.computeCartTotals(cart, hotel);
  $("#totals").innerHTML = `
    <div style="display:grid; gap:8px">
      <div style="display:flex; justify-content:space-between"><span class="smallmuted">Subtotal</span><b>${AppState.currency(totals.subtotal)}</b></div>
      <div style="display:flex; justify-content:space-between"><span class="smallmuted">Tax (5%)</span><b>${AppState.currency(totals.tax)}</b></div>
      <div style="display:flex; justify-content:space-between"><span class="smallmuted">Discount</span><b>− ${AppState.currency(totals.discount)}</b></div>
      <div class="sep"></div>
      <div style="display:flex; justify-content:space-between"><span style="font-weight:900">Total</span><span style="font-weight:900">${AppState.currency(totals.total)}</span></div>
    </div>
  `;

  const sticky = $("#stickyCart");
  if(count){
    sticky.style.display = "block";
    $("#stickyCount").textContent = `${count} item(s)`;
    $("#stickyTotal").textContent = `${AppState.currency(totals.total)}`;
  }else{
    sticky.style.display = "none";
  }

  $("#goCart").disabled = !count;
  $("#goCart").onclick = () => location.href = "cart.html";
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// Filters modal
$("#openFilters").onclick = () => $("#filtersModal").classList.add("show");
$("#closeFilters").onclick = () => $("#filtersModal").classList.remove("show");
$("#applyFilters").onclick = () => {
  filters.veg = $("#fVeg").checked;
  filters.best = $("#fBest").checked;
  filters.spicy = $("#fSpicy").checked;
  $("#filtersModal").classList.remove("show");
  renderItems();
};

// Notes modal
function openNotes(item){
  pendingItem = item;
  $("#notesTitle").textContent = `Customize: ${item.name}`;
  $("#notesText").value = "";
  $$('[data-addon]').forEach(c => c.checked = false);
  $("#notesModal").classList.add("show");
}
$("#closeNotes").onclick = () => $("#notesModal").classList.remove("show");

function getSelectedAddons(){
  return $$('[data-addon]:checked').map(c => ({
    name: c.dataset.addon,
    price: Number(c.dataset.addonprice || 0)
  }));
}

function addCustomized(qty, goCart=false){
  if(!pendingItem) return;
  const addons = getSelectedAddons();
  const addonPrice = addons.reduce((s,a)=>s+a.price,0);
  const notes = $("#notesText").value.trim();
  // Create a derived item with updated price
  const item = {...pendingItem, price: pendingItem.price + addonPrice};
  AppState.addToCart(item, qty, notes, addons.map(a=>a.name));
  showToast("Added with customization");
  $("#notesModal").classList.remove("show");
  renderCartAside();
  renderItems();
  if(goCart) location.href = "cart.html";
}
$("#addOnce").onclick = () => addCustomized(1, false);
$("#addAndGo").onclick = () => addCustomized(1, true);

function clearAll(){
  $("#search").value = "";
  activeCat = "All";
  filters = { veg:false, best:false, spicy:false };
  $("#fVeg").checked = false;
  $("#fBest").checked = false;
  $("#fSpicy").checked = false;
  render();
}

$("#search").addEventListener("input", () => renderItems());

// Initial render
render();
window.addEventListener("foodieqr:state", () => {
  AppState.applyTheme();
  renderCartAside();
});

})();
