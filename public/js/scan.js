(async()=>{
  try{
    await AppState.init();
    AppState.applyTheme();
    mountNav("scan");
    await loadHotels();
  }catch(err){
    console.error(err);
    const box=document.createElement("div");
    box.className="card";
    box.innerHTML = `<h3 class="h3">Scan page error</h3>
      <p class="smallmuted">If you just installed, run <code>npm run seed</code> once, then restart <code>npm run dev</code>.</p>
      <pre style="white-space:pre-wrap;overflow:auto">${escapeHtml(String(err?.message||err))}</pre>`;
    document.querySelector("main")?.prepend(box);
  }

  async function loadHotels(){
    const res = await fetch("/api/public/hotels");
    const data = await res.json();
    const sel = $("#hotelPick");
    sel.innerHTML = "";
    if(!data.hotels || data.hotels.length===0){
      sel.innerHTML = `<option value="">No hotels found</option>`;
      $("#hotelTitle").textContent = "No hotels seeded";
      $("#qrList").innerHTML = `<li>
        <b>No hotels in database</b>
        <div class="smallmuted">Run <code>npm run seed</code> once, then refresh.</div>
      </li>`;
      return;
    }
    for(const h of data.hotels){
      const o=document.createElement("option");
      o.value=h.slug; o.textContent=`${h.name} (${h.slug})`;
      sel.appendChild(o);
    }
    sel.onchange = render;
    await render();
  }

  async function render(){
    const slug = $("#hotelPick").value || "hotel-a";
    const res = await fetch(`/api/public/qr?hotel=${encodeURIComponent(slug)}`);
    const data = await res.json();
    if(data.error){
      $("#hotelTitle").textContent = "Error";
      $("#qrList").innerHTML = `<li><b>${escapeHtml(data.error)}</b></li>`;
      return;
    }
    $("#hotelTitle").textContent = data.hotel.name;

    const origin = window.location.origin.replace(/\/$/,"");
    const list = $("#qrList");
    list.innerHTML = (data.tables||[]).map((t,i)=>{
      const rel = `menu.html?hotel=${encodeURIComponent(slug)}&table=${encodeURIComponent(t.table_number)}&t=${encodeURIComponent(t.qr_token)}`;
      const full = `${origin}/${rel}`;
      const id = `copy_${i}`;
      return `<li>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div>
            <b>Table ${escapeHtml(t.table_number)}</b>
            <div class="smallmuted" style="margin-top:6px;word-break:break-all">
              <a class="link" target="_blank" href="${rel}">${full}</a>
            </div>
          </div>
          <button class="btn small" id="${id}" type="button">Copy</button>
        </div>
        <div style="margin-top:10px">
          <a class="btn" target="_blank" href="${rel}">Open menu</a>
        </div>
      </li>`;
    }).join("");

    // Wire copy buttons
    (data.tables||[]).forEach((t,i)=>{
      const rel = `menu.html?hotel=${encodeURIComponent(slug)}&table=${encodeURIComponent(t.table_number)}&t=${encodeURIComponent(t.qr_token)}`;
      const full = `${origin}/${rel}`;
      const btn = document.getElementById(`copy_${i}`);
      if(btn){
        btn.onclick = async ()=>{
          try{
            await navigator.clipboard.writeText(full);
            showToast("Copied link");
          }catch{
            prompt("Copy this link:", full);
          }
        };
      }
    });
  }
})();