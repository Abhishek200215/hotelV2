(async()=>{
  await AppState.init();
AppState.applyTheme();
mountNav("track");

function timelineSteps(){
  return [
    {key:"NEW", label:"Placed"},
    {key:"PREPARING", label:"Preparing"},
    {key:"READY", label:"Ready"},
    {key:"DELIVERED", label:"Delivered"},
  ];
}

function renderTimeline(status){
  const steps = timelineSteps();
  const idx = steps.findIndex(s=>s.key===status);
  const el = $("#timeline");
  el.innerHTML = steps.map((s,i)=>`
    <div class="tstep ${i<=idx ? "done" : ""} ${i===idx ? "active":""}">
      <div class="dot"></div>
      <div class="lbl">${s.label}</div>
    </div>
  `).join("");
}

async function refresh(){
  const q = AppState.parseQuery();
  const orderId = q.order || AppState.get().lastOrderId;

  const order = orderId ? await AppState.getOrder(orderId) : null;

  $("#empty").style.display = order ? "none" : "block";
  if(!order){
    $("#meta").textContent = "No order found.";
    return;
  }

  $("#oid").textContent = order.orderId;
  $("#meta").textContent = `${order.hotelName} · Table ${order.table} · ${order.createdAt}`;
  $("#eta").textContent = order.status === "DELIVERED" ? "0 min" : `${order.etaMinutes} min`;

  const itemsEl = $("#items");
  itemsEl.innerHTML = order.items.map(i=>`
    <li><span>${i.qty}× ${i.name}</span><b>${AppState.currency(i.price*i.qty)}</b></li>
  `).join("");

  $("#bill").innerHTML = `
    <div class="line"><span>Subtotal</span><b>${AppState.currency(order.subtotal)}</b></div>
    <div class="line total"><span>Total</span><b>${AppState.currency(order.total)}</b></div>
  `;

  renderTimeline(order.status);

  $("#openKitchen").href = `kitchen.html?hotel=${encodeURIComponent(order.hotelSlug)}`;
  $("#feedbackBtn").style.display = order.status==="DELIVERED" ? "inline-flex" : "none";
  $("#feedbackBtn").href = `feedback.html?order=${encodeURIComponent(order.orderId)}`;
}

$("#refresh").onclick = refresh;

await refresh();
setInterval(refresh, 2000);

})();
