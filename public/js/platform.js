(async function(){
  const KEY="platform_token";
  const token=localStorage.getItem(KEY);
  if(!token){ location.href="platform-login.html"; return; }

  const headers={ "Authorization": `Bearer ${token}` };

  const kpisEl=document.getElementById("kpis");
  const hotelTBody=document.querySelector("#hotelTable tbody");
  const orderTBody=document.querySelector("#orderTable tbody");
  const search=document.getElementById("hotelSearch");
  const refreshBtn=document.getElementById("refreshBtn");
  const statusFilter=document.getElementById("statusFilter");

  document.getElementById("logoutBtn").onclick=()=>{
    localStorage.removeItem(KEY);
    location.href="platform-login.html";
  };

  refreshBtn.onclick=loadAll;
  search.oninput=renderHotels;
  statusFilter.onchange=loadOrders;

  let hotelsCache=[];
  await loadAll();
  setInterval(loadOrders, 5000);

  async function loadAll(){
    await Promise.all([loadSummary(), loadHotels(), loadOrders()]);
  }

  async function api(path, opts={}){
    const res=await fetch(path, { ...opts, headers:{...(opts.headers||{}), ...headers} });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||`Request failed (${res.status})`);
    return data;
  }

  async function loadSummary(){
    const data=await api("/api/platform/summary");
    const kpis=[
      { label:"Hotels", val:data.hotels_total },
      { label:"Active", val:data.hotels_active },
      { label:"Orders (today)", val:data.orders_today },
      { label:"Revenue (today)", val:`₹${data.revenue_today}` },
    ];
    kpisEl.innerHTML = kpis.map(k=>`<div class="kpi"><span class="smallmuted">${escapeHtml(k.label)}</span><b>${escapeHtml(String(k.val))}</b></div>`).join("");
  }

  async function loadHotels(){
    const data=await api("/api/platform/hotels");
    hotelsCache=data.hotels||[];
    renderHotels();
  }

  function renderHotels(){
    const q=(search.value||"").trim().toLowerCase();
    const rows = hotelsCache
      .filter(h=>!q || (h.name||"").toLowerCase().includes(q) || (h.slug||"").toLowerCase().includes(q))
      .map(h=>{
        const active=!!h.is_active;
        const badge = active ? '<span class="badge on">ACTIVE</span>' : '<span class="badge off">SUSPENDED</span>';
        const btnText = active ? "Suspend" : "Activate";
        return `<tr>
          <td><b>${escapeHtml(h.name)}</b><div class="smallmuted">${escapeHtml(h.address||"")}</div></td>
          <td>${escapeHtml(h.slug)}</td>
          <td>${escapeHtml(h.phone||"")}</td>
          <td>${escapeHtml(String(h.orders||0))}</td>
          <td>${badge}</td>
          <td><button class="btn small" data-id="${escapeHtml(h.id)}" data-active="${active?1:0}">${btnText}</button></td>
        </tr>`;
      }).join("");
    hotelTBody.innerHTML = rows || `<tr><td colspan="6" class="smallmuted">No hotels</td></tr>`;

    // wire buttons
    hotelTBody.querySelectorAll("button[data-id]").forEach(btn=>{
      btn.onclick = async ()=>{
        const id=btn.getAttribute("data-id");
        const cur=btn.getAttribute("data-active")==="1";
        btn.disabled=true;
        try{
          await api(`/api/platform/hotels/${encodeURIComponent(id)}/active`,{
            method:"PATCH",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({ is_active: cur?0:1 })
          });
          showToast(cur ? "Hotel suspended" : "Hotel activated");
          await loadAll();
        }catch(err){
          showToast("Action failed");
          alert(String(err.message||err));
        }finally{
          btn.disabled=false;
        }
      };
    });
  }

  async function loadOrders(){
    const status=statusFilter.value;
    const qs = new URLSearchParams();
    qs.set("limit","50");
    if(status) qs.set("status", status);
    const data=await api(`/api/platform/orders?${qs.toString()}`);
    const rows = (data.orders||[]).map(o=>{
      return `<tr>
        <td>${escapeHtml(o.created_at)}</td>
        <td><b>${escapeHtml(o.hotel_name)}</b><div class="smallmuted">${escapeHtml(o.hotel_slug)}</div></td>
        <td>${escapeHtml(o.table_number)}</td>
        <td>${escapeHtml(o.status)}</td>
        <td>${escapeHtml(String(o.total_rupees))}</td>
      </tr>`;
    }).join("");
    orderTBody.innerHTML = rows || `<tr><td colspan="5" class="smallmuted">No orders</td></tr>`;
  }
})();