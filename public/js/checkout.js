(async()=>{
  await AppState.init();
AppState.applyTheme();
mountNav("cart"); // checkout is cart flow
let payment = "UPI";

async function render(){
  const state = AppState.get();
  const hotel = AppState.getHotel(state.cart.hotelId);
  const cart = state.cart;
  $("#ctx").textContent = `${hotel.name} · Table ${cart.table}`;

  const totals = AppState.computeCartTotals(cart, hotel);
  const items = cart.items || [];
  $("#summary").innerHTML = `
    <div class="smallmuted">${items.length ? `${items.length} items` : "No items"}</div>
    <div class="line"><span>Subtotal</span><b>${AppState.currency(totals.subtotal)}</b></div>
    <div class="line"><span>Tax</span><b>${AppState.currency(totals.tax)}</b></div>
    <div class="line total"><span>Total</span><b>${AppState.currency(totals.total)}</b></div>
  `;

  const list = $("#items");
  list.innerHTML = "";
  const menuMap = new Map((hotel.menu||[]).map(i=>[i.id,i]));
  for(const it of items){
    const row = menuMap.get(it.id);
    if(!row) continue;
    const li = document.createElement("li");
    li.innerHTML = `<div><b>${row.name}</b><div class="smallmuted">${row.cat}</div></div><div><b>${AppState.currency(row.price*it.qty)}</b></div>`;
    list.appendChild(li);
  }
}

$$(".pay").forEach(b=>{
  b.onclick = ()=>{
    $$(".pay").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    payment = b.dataset.pay;
  };
});

$("#placeOrder").onclick = async ()=>{
  try{
    $("#placeOrder").disabled = true;
    const order = await AppState.createOrder(payment);
    showToast("Order placed!");
    location.href = `track.html?order=${encodeURIComponent(order.orderId)}`;
  }catch(e){
    console.error(e);
    showToast("Order failed", "error");
  }finally{
    $("#placeOrder").disabled = false;
  }
};

render();

})();
