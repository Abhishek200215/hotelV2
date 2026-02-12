(async()=>{
  await AppState.init();
  AppState.applyTheme();
  mountNav("admin");

  const token = localStorage.getItem("foodieqr_hotel_token");
  const hotelSlug = new URLSearchParams(location.search).get("hotel") || localStorage.getItem("foodieqr_hotel_slug") || "hotel-a";
  if(!token){ location.href="admin-login.html"; return; }

  const h = (s)=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  async function api(path, opts={}){
    const res = await fetch(path, { ...opts, headers: { ...(opts.headers||{}), "Authorization": `Bearer ${token}`, "Content-Type":"application/json" }});
    if(!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function loadAll(){
    const me = await api("/api/hotel/me");
    const tables = await api("/api/hotel/tables");
    const menu = await api("/api/hotel/menu");
    const orders = await api("/api/hotel/orders");
    return { me: me.hotel, tables: tables.tables, menu: menu.menu, orders: orders.orders };
  }

  function section(){ return (location.hash || "#profile").slice(1); }

  function renderProfile(me){
    return `
      <h2>Hotel Profile</h2>
      <div class="card">
        <label class="label">Hotel Name</label><input class="input" id="p_name" value="${h(me.name)}"/>
        <label class="label">Phone</label><input class="input" id="p_phone" value="${h(me.phone||"")}"/>
        <label class="label">Address</label><input class="input" id="p_addr" value="${h(me.address||"")}"/>
        <label class="label">Theme Accent</label><input class="input" id="p_theme" value="${h(me.theme_accent||"#ff6b35")}"/>
        <label class="label">Hero Image URL</label><input class="input" id="p_hero" value="${h(me.hero_image||"")}"/>
        <button class="btn" id="p_save">Save</button>
      </div>
    `;
  }

  function renderTables(tables){
    const rows = tables.map(t=>`
      <tr>
        <td><b>${h(t.table_number)}</b></td>
        <td class="smallmuted">${h(t.qr_token)}</td>
        <td><a class="link" target="_blank" href="menu.html?hotel=${encodeURIComponent(hotelSlug)}&table=${encodeURIComponent(t.table_number)}&t=${encodeURIComponent(t.qr_token)}">Open</a></td>
      </tr>`).join("");
    return `
      <h2>Tables & QR</h2>
      <div class="card">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input class="input" id="t_new" placeholder="Table number e.g. 06" style="max-width:220px"/>
          <button class="btn" id="t_add">Add Table</button>
        </div>
        <div style="overflow:auto;margin-top:12px">
          <table class="table"><thead><tr><th>Table</th><th>Token</th><th>Test</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
      </div>
    `;
  }

  function renderMenu(menu){
    const cats = menu.categories||[];
    const items = menu.items||[];
    const catOpts = cats.map(c=>`<option value="${h(c.id)}">${h(c.name)}</option>`).join("");
    const itemRows = items.map(i=>`
      <tr>
        <td><b>${h(i.name)}</b><div class="smallmuted">${h(i.category_name)}</div></td>
        <td><b>₹${(i.price/100).toFixed(2)}</b></td>
        <td class="smallmuted">${i.is_veg? "Veg":"Non-veg"}${i.is_spicy? " · Spicy":""}${i.is_best? " · Best":""}</td>
      </tr>`).join("");
    return `
      <h2>Menu</h2>
      <div class="card">
        <h3>Add Category</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input class="input" id="c_name" placeholder="Category name" style="max-width:260px"/>
          <input class="input" id="c_sort" placeholder="Sort" style="max-width:120px"/>
          <button class="btn" id="c_add">Add</button>
        </div>
        <hr/>
        <h3>Add Item</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <select class="input" id="i_cat">${catOpts}</select>
          <input class="input" id="i_name" placeholder="Item name"/>
          <input class="input" id="i_price" placeholder="Price (₹)"/>
          <input class="input" id="i_prep" placeholder="Prep minutes"/>
          <input class="input" id="i_img" placeholder="Image URL (optional)" style="grid-column:1/-1"/>
          <label><input type="checkbox" id="i_veg" checked/> Veg</label>
          <label><input type="checkbox" id="i_best"/> Best</label>
          <label><input type="checkbox" id="i_spicy"/> Spicy</label>
        </div>
        <button class="btn" id="i_add" style="margin-top:10px">Add Item</button>
      </div>
      <div class="card" style="margin-top:14px;overflow:auto">
        <table class="table"><thead><tr><th>Item</th><th>Price</th><th>Tags</th></tr></thead><tbody>${itemRows}</tbody></table>
      </div>
    `;
  }

  function renderOrders(orders){
    const rows = orders.map(o=>`
      <tr>
        <td><b>${h(o.orderId)}</b><div class="smallmuted">Table ${h(o.table)} · ${h(o.createdAt)}</div></td>
        <td><b>${h(o.status)}</b><div class="smallmuted">ETA ${h(o.etaMinutes)}m</div></td>
        <td><b>${AppState.currency(o.total)}</b></td>
      </tr>`).join("");
    return `
      <h2>Orders</h2>
      <div class="card" style="overflow:auto">
        <table class="table"><thead><tr><th>Order</th><th>Status</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }

  async function render(){
    const data = await loadAll();
    $("#hotelName").textContent = data.me.name;

    const sec = section();
    const view = $("#view");
    if(sec==="tables") view.innerHTML = renderTables(data.tables);
    else if(sec==="menu") view.innerHTML = renderMenu(data.menu);
    else if(sec==="orders") view.innerHTML = renderOrders(data.orders);
    else view.innerHTML = renderProfile(data.me);

    if($("#p_save")) $("#p_save").onclick = async ()=>{
      await api("/api/hotel/profile",{ method:"PUT", body: JSON.stringify({
        name: $("#p_name").value, phone: $("#p_phone").value, address: $("#p_addr").value,
        themeAccent: $("#p_theme").value, heroImage: $("#p_hero").value
      })});
      showToast("Saved");
      location.reload();
    };

    if($("#t_add")) $("#t_add").onclick = async ()=>{
      await api("/api/hotel/tables",{ method:"POST", body: JSON.stringify({ tableNumber: $("#t_new").value })});
      showToast("Table added");
      render();
    };

    if($("#c_add")) $("#c_add").onclick = async ()=>{
      await api("/api/hotel/categories",{ method:"POST", body: JSON.stringify({ name: $("#c_name").value, sortOrder: $("#c_sort").value })});
      showToast("Category added");
      render();
    };

    if($("#i_add")) $("#i_add").onclick = async ()=>{
      await api("/api/hotel/items",{ method:"POST", body: JSON.stringify({
        categoryId: $("#i_cat").value, name: $("#i_name").value, price: $("#i_price").value,
        prep: $("#i_prep").value, imageUrl: $("#i_img").value,
        veg: $("#i_veg").checked, best: $("#i_best").checked, spicy: $("#i_spicy").checked
      })});
      showToast("Item added");
      render();
    };
  }

  window.addEventListener("hashchange", render);
  await render();
})();