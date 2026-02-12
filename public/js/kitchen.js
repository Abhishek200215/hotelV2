(async()=>{
  await AppState.init();
AppState.applyTheme();
mountNav("kitchen");

const token = localStorage.getItem("foodieqr_hotel_token");
if(!token){ location.href="admin-login.html"; throw new Error("no token"); }

async function api(path, opts={}){
  const res = await fetch(path, { ...opts, headers: { ...(opts.headers||{}), "Authorization": `Bearer ${token}`, "Content-Type":"application/json" }});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

let orders = [];

function render(){
  const wrap = $("#orders");
  if(!orders.length){
    wrap.innerHTML = `<div class="card"><div class="smallmuted">No orders yet.</div></div>`;
    return;
  }
  wrap.innerHTML = orders.map(o=>{
    const items = o.items.map(i=>`${i.qty}× ${i.name}`).join(", ");
    return `
      <div class="card order">
        <div class="row">
          <div>
            <div class="title">Table ${o.table} · <span class="badge">${o.status}</span></div>
            <div class="smallmuted">${items}</div>
            <div class="smallmuted">ETA ${o.etaMinutes}m · Total ${AppState.currency(o.total)}</div>
          </div>
          <div class="actions">
            <button class="btn sm" data-id="${o.orderId}" data-s="PREPARING">Preparing</button>
            <button class="btn sm" data-id="${o.orderId}" data-s="READY">Ready</button>
            <button class="btn sm" data-id="${o.orderId}" data-s="DELIVERED">Delivered</button>
            <button class="btn sm" data-id="${o.orderId}" data-s="CANCELLED">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  $$("button[data-id]").forEach(b=>{
    b.onclick = async ()=>{
      const id=b.dataset.id, status=b.dataset.s;
      await api(`/api/hotel/orders/${encodeURIComponent(id)}/status`, { method:"PATCH", body: JSON.stringify({ status }) });
      await refresh();
    };
  });
}

async function refresh(){
  const data = await api("/api/hotel/orders");
  orders = data.orders;
  render();
}

await refresh();
setInterval(refresh, 2000);

})();
