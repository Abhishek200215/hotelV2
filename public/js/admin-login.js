(async()=>{
  await AppState.init();
AppState.applyTheme();
mountNav("admin");

async function loadHotels(){
  const res = await fetch("/api/public/hotels");
  const data = await res.json();
  const sel = $("#hotelSelect");
  sel.innerHTML = "";
  for(const h of data.hotels){
    const o=document.createElement("option");
    o.value=h.slug;
    o.textContent=`${h.name} (${h.slug})`;
    sel.appendChild(o);
  }
}

$("#login").onclick = async ()=>{
  const hotelSlug = $("#hotelSelect").value;
  const email = $("#email").value.trim();
  const password = $("#password").value;
  if(!email || !password) return showToast("Enter email & password", "warn");
  const res = await fetch("/api/auth/login", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ hotelSlug, email, password })
  });
  if(!res.ok) return showToast("Login failed", "error");
  const data = await res.json();
  localStorage.setItem("foodieqr_hotel_token", data.token);
  localStorage.setItem("foodieqr_hotel_slug", hotelSlug);
  showToast(`Logged in: ${data.role}`);
  location.href = data.role==="KITCHEN" ? `kitchen.html?hotel=${encodeURIComponent(hotelSlug)}` : `admin.html?hotel=${encodeURIComponent(hotelSlug)}#profile`;
};

await loadHotels();

})();
