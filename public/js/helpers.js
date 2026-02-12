function $(sel, root=document){ return root.querySelector(sel); }
function escapeHtml(str){
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}
function $$(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function mountNav(active){
  const nav = $("#topNavLinks");
  if(!nav) return;
  $$("#topNavLinks a").forEach(a => {
    if(a.dataset.nav === active) a.style.background = "rgba(255,255,255,.75)";
  });
}

function showToast(msg){
  const t = $("#toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> t.classList.remove("show"), 2200);
}

function formatTime(ms){
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2,"0");
  const mm = d.getMinutes().toString().padStart(2,"0");
  return `${hh}:${mm}`;
}

function statusLabel(s){
  return ({
    "NEW":"Placed",
    "PREPARING":"Preparing",
    "READY":"Ready",
    "DELIVERED":"Delivered",
    "CANCELLED":"Cancelled",
  })[s] || s;
}
