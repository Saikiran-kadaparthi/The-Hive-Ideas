(() => {
  const form=document.getElementById("loginForm"), errorBox=document.getElementById("loginError");
  const password=document.getElementById("password"), toggle=document.getElementById("togglePassword"), button=document.getElementById("signInButton");
  function client(){
    if(!window.supabase || !window.HIVE_SUPABASE_URL || !window.HIVE_SUPABASE_PUBLISHABLE_KEY || window.HIVE_SUPABASE_PUBLISHABLE_KEY==="PASTE_YOUR_SB_PUBLISHABLE_KEY_HERE") throw new Error("Setup needed: add your Supabase publishable key to config.js.");
    return window.supabase.createClient(window.HIVE_SUPABASE_URL,window.HIVE_SUPABASE_PUBLISHABLE_KEY);
  }
  toggle.addEventListener("click",()=>{const show=password.type==="text";password.type=show?"password":"text";toggle.textContent=show?"Show":"Hide";});
  form.addEventListener("submit",async e=>{e.preventDefault();errorBox.textContent="";button.disabled=true;button.textContent="Signing in…";
    try{const {error}=await client().auth.signInWithPassword({email:document.getElementById("email").value.trim(),password:password.value});if(error)throw error;location.replace("index.html");}
    catch(err){console.error(err);errorBox.textContent=err.message.includes("Setup needed")?err.message:"Sign-in failed. Check your email/password and Supabase user confirmation.";button.disabled=false;button.innerHTML='Unlock The Hive <span>→</span>';}
  });
  try{client().auth.getSession().then(({data})=>{if(data.session)location.replace("index.html");}).catch(console.error);}catch(err){errorBox.textContent=err.message;}
})();