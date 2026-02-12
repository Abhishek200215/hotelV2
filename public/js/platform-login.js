(function(){
  const KEY="platform_token";
  const form=document.getElementById("loginForm");
  const msg=document.getElementById("msg");

  // already logged in
  const t=localStorage.getItem(KEY);
  if(t){ location.href="platform.html"; return; }

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    msg.textContent="Logging in...";
    const email=document.getElementById("email").value.trim();
    const password=document.getElementById("password").value;
    try{
      const res=await fetch("/api/platform/login",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ email, password })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Login failed");
      localStorage.setItem(KEY, data.token);
      location.href="platform.html";
    }catch(err){
      msg.textContent=String(err.message||err);
      showToast("Login failed");
    }
  });
})();