(async()=>{
  await AppState.init();
AppState.applyTheme();
mountNav("cart");
AppState.ensureContextFromQuery();

function render(){
  const state = AppState.get();
  const hotel = AppState.getHotel(state.cart.hotelId);
  const cart = state.cart;
  const linkMenu = `menu.html?hotel=${encodeURIComponent(hotel.id)}&table=${encodeURIComponent(cart.table)}`;
  $("#backToMenu").href = linkMenu;
  $("#emptyToMenu").href = linkMenu;

  $("#ctx").textContent = `${hotel.name} · Table ${cart.table}`;

  const wrap = $("#cartLines");
  wrap.innerHTML = "";

  const items = cart.items || [];
  $("#emptyState").style.display = items.length ? "none" : "block";

  for(const it of items){
    const line = document.createElement("div");
    line.className = "line";
    line.innerHTML = `
      <div style="display:flex; gap:12px">
        <img src="${it.img}" alt="">
        <div>
          <div class="nm">${it.name}</div>
          <div class="sm">${it.notes ? "📝 "+escapeHtml(it.notes) : "—"}</div>
          <div class="sm">${(it.addons && it.addons.length) ? "➕ "+it.addons.join(", ") : ""}</div>
          <div class="qty">
            <button aria-label="Decrease">−</button>
            <b>${it.qty}</b>
            <button aria-label="Increase">+</button>
            <span class="badge">${AppState.currency(it.price)}</span>
          </div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:900">${AppState.currency(it.price * it.qty)}</div>
        <button class="btn small" style="margin-top:10px" aria-label="Remove">Remove</button>
      </div>
    `;
    const [minus, plus] = line.querySelectorAll(".qty button");
    minus.onclick = () => { AppState.addToCart(it, -1, it.notes, it.addons); render(); };
    plus.onclick = () => { AppState.addToCart(it, 1, it.notes, it.addons); render(); };
    line.querySelector('[aria-label="Remove"]').onclick = () => {
      // remove all qty
      AppState.addToCart(it, -it.qty, it.notes, it.addons);
      render();
    };
    wrap.appendChild(line);
  }

  const totals = AppState.computeCartTotals(cart, hotel);
  $("#billHint").textContent = items.length ? `Items: ${items.reduce((s,i)=>s+i.qty,0)} · Tax 5% · Discount demo` : "—";
  $("#bill").innerHTML = `
    <div style="display:flex; justify-content:space-between"><span class="smallmuted">Subtotal</span><b>${AppState.currency(totals.subtotal)}</b></div>
    <div style="display:flex; justify-content:space-between"><span class="smallmuted">Tax</span><b>${AppState.currency(totals.tax)}</b></div>
    <div style="display:flex; justify-content:space-between"><span class="smallmuted">Discount</span><b>− ${AppState.currency(totals.discount)}</b></div>
    <div class="sep"></div>
    <div style="display:flex; justify-content:space-between"><span style="font-weight:900">Total payable</span><span style="font-weight:900">${AppState.currency(totals.total)}</span></div>
  `;

  $("#proceed").disabled = !items.length;
  $("#proceed").onclick = () => location.href = "checkout.html";
  $("#clearCart").disabled = !items.length;
  $("#clearCart").onclick = () => { AppState.clearCart(); showToast("Cart cleared"); render(); };
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

render();
window.addEventListener("foodieqr:state", render);

})();
