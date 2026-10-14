(() => {
  if(!window.supabase || !window.HIVE_SUPABASE_URL || !window.HIVE_SUPABASE_PUBLISHABLE_KEY || window.HIVE_SUPABASE_PUBLISHABLE_KEY==="PASTE_YOUR_SB_PUBLISHABLE_KEY_HERE"){location.replace("login.html");return;}
  const client=window.supabase.createClient(window.HIVE_SUPABASE_URL,window.HIVE_SUPABASE_PUBLISHABLE_KEY);
  client.auth.getSession().then(({data,error})=>{if(error||!data.session){location.replace("login.html");return;}window.HIVE_SUPABASE_CLIENT=client;window.dispatchEvent(new CustomEvent("hive-auth-ready",{detail:{client,session:data.session}}));}).catch(e=>{console.error(e);location.replace("login.html");});
})();