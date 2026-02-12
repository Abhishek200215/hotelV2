(async()=>{
  await AppState.init();
AppState.applyTheme();
mountNav("feedback");

const q = AppState.parseQuery();
const orderId = q.order;

if(!orderId){
  $("#card").innerHTML = `<div class="smallmuted">Missing order id.</div>`;
} else {
  $("#orderId").textContent = orderId;
}

let rating = 5;
$$(".star").forEach(s=>{
  s.onclick = ()=>{
    rating = Number(s.dataset.val);
    $$(".star").forEach(x=>x.classList.toggle("on", Number(x.dataset.val)<=rating));
  };
});

$("#submit").onclick = async ()=>{
  try{
    const comment = $("#comment").value;
    const res = await fetch("/api/public/feedback", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ orderId, rating, comment })
    });
    if(!res.ok) throw new Error(await res.text());
    showToast("Thanks for feedback!");
    location.href = "index.html";
  }catch(e){
    console.error(e);
    showToast("Feedback failed", "error");
  }
};

})();
