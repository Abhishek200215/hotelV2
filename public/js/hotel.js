(async()=>{
  await AppState.init();
AppState.applyTheme();
mountNav("demo");
AppState.ensureContextFromQuery();

function render(){
  const state = AppState.get();
  const q = AppState.parseQuery();
  const hotelId = q.hotel || state.cart.hotelId;
  const table = q.table || state.cart.table || "01";
  const hotel = AppState.getHotel(hotelId);

  $("#hotelName").textContent = hotel.name;
  $("#tableBadge").textContent = `Table ${table}`;
  $("#ratingBadge").textContent = `⭐ ${hotel.rating}`;
  $("#timingBadge").textContent = `⏰ ${hotel.timing}`;
  $("#addrBadge").textContent = `📍 ${hotel.address}`;

  const cover = $("#cover");
  cover.style.backgroundImage = `url('${hotel.cover?.[0] || ""}')`;

  const link = `menu.html?hotel=${encodeURIComponent(hotel.id)}&table=${encodeURIComponent(table)}`;
  $("#startBtn").href = link;
  $("#openMenuBtn").href = link;

  const best = hotel.menu.filter(m => m.bestseller).slice(0,4);
  const wrap = $("#highlights");
  wrap.innerHTML = "";
  for(const it of best){
    const el = document.createElement("a");
    el.href = link;
    el.className = "card";
    el.style.overflow = "hidden";
    el.innerHTML = `
      <div style="height:130px; background:url('${it.img}') center/cover"></div>
      <div style="padding:12px">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px">
          <div style="font-weight:800">${it.name}</div>
          <div class="badge">${AppState.currency(it.price)}</div>
        </div>
        <div class="smallmuted" style="margin-top:6px; line-height:1.4">${it.desc}</div>
      </div>
    `;
    wrap.appendChild(el);
  }
}

render();
window.addEventListener("foodieqr:state", render);

})();
