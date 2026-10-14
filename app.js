(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const CATEGORIES = [
    "Game Development","3D Art and Animation","Workshop and Fabrication",
    "Electronics and Robotics","Homestead and Farming","Worldbuilding and Dioramas",
    "Software and Tools","Business Ideas","Random Ideas"
  ];
  const SYMBOLS = ["✳","⬡","⌘","⚙","♧","◇","▣","✦","✿"];
  let client = null, user = null, categories = [], ideas = [];
  let currentView = "Dashboard", searchText = "", toastTimer;
  let categoryIdByName = new Map();

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function showToast(message) {
    const toast=$("toast"); toast.textContent=message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove("show"),2800);
  }
  function iconFor(category) { const i=CATEGORIES.indexOf(category); return SYMBOLS[i<0?SYMBOLS.length-1:i]; }
  function formatDate(date) {
    if(!date) return "just now";
    return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(date));
  }
  function isArchived(i) { return i.is_archived || i.status==="Archived"; }
  function visibleIdeas() { return ideas.filter(i=>!isArchived(i)); }

  async function ensureCategories() {
    const {data:existing,error:readError}=await client.from("categories").select("id,name,sort_order").eq("user_id",user.id).order("sort_order");
    if(readError) throw readError;
    const existingNames=new Set((existing||[]).map(c=>c.name));
    const missing=CATEGORIES.filter(name=>!existingNames.has(name)).map((name,index)=>({user_id:user.id,name,sort_order:CATEGORIES.indexOf(name)}));
    if(missing.length) {
      const {error}=await client.from("categories").insert(missing);
      if(error) throw error;
    }
    const {data,error}=await client.from("categories").select("id,name,sort_order").eq("user_id",user.id).order("sort_order");
    if(error) throw error;
    categories=data||[];
    categoryIdByName=new Map(categories.map(c=>[c.name,c.id]));
  }
  async function loadIdeas() {
    const {data,error}=await client.from("ideas")
      .select("id,user_id,category_id,title,description,status,priority,is_favorite,is_archived,reference_links,notes,estimated_cost,required_materials,prerequisites,created_at,updated_at,category:categories(name)")
      .eq("user_id",user.id)
      .order("created_at",{ascending:false});
    if(error) throw error;
    ideas=(data||[]).map(row=>({...row,category:row.category?.name||"Random Ideas",favorite:row.is_favorite,archived:row.is_archived,createdAt:row.created_at,updatedAt:row.updated_at}));
  }
  function renderStats() {
    const active=visibleIdeas();
    $("ideasStat").textContent=active.length;
    $("projectsStat").textContent=active.filter(i=>i.status==="Active").length.toString().padStart(2,"0");
    $("favoritesStat").textContent=active.filter(i=>i.favorite).length.toString().padStart(2,"0");
    $("inboxCount").textContent=active.filter(i=>i.status==="Inbox").length;
  }
  function renderCategoryOptions() {
    const filter=$("categoryFilter"), selected=filter.value;
    filter.innerHTML='<option value="">All categories</option>'+categories.map(c=>`<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join("");
    if(categories.some(c=>c.name===selected))filter.value=selected;
    $("ideaCategory").innerHTML=categories.map(c=>`<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join("");
  }
  function renderCategories() {
    const counts=categories.map(c=>({name:c.name,count:visibleIdeas().filter(i=>i.category_id===c.id).length}));
    $("categoryList").innerHTML=counts.map((c,i)=>`<button class="category-row" data-category="${escapeHTML(c.name)}"><span class="category-dot" style="background:${["#f2bd55","#8eb2a0","#c9a0dc","#81a8d5","#a7bd83","#d9a16d","#b5b1e1","#e18e7f","#c6c1b0"][i%9]}"></span><span class="category-name">${escapeHTML(c.name)}</span><span class="category-total">${c.count}</span></button>`).join("");
    $("categoryList").querySelectorAll("[data-category]").forEach(button=>button.addEventListener("click",()=>{$("categoryFilter").value=button.dataset.category;currentView="Ideas";updateView();renderIdeas();}));
  }
  function filteredIdeas() {
    let list=ideas.filter(i=>{
      const archived=isArchived(i);
      if(currentView==="Archive"&&!archived)return false;
      if(currentView!=="Archive"&&archived)return false;
      if(currentView==="Inbox"&&i.status!=="Inbox")return false;
      if(currentView==="Projects"&&i.status!=="Active")return false;
      if(currentView==="Favorites"&&!i.favorite)return false;
      if(["Ideas","Dashboard","Categories"].includes(currentView)&&$("categoryFilter").value&&i.category!==$("categoryFilter").value)return false;
      const q=searchText.trim().toLowerCase();
      if(q&&!`${i.title} ${i.description||""} ${i.category||""} ${i.status||""}`.toLowerCase().includes(q))return false;
      return true;
    });
    const sort=$("sortSelect").value;
    if(sort==="oldest")list.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    else if(sort==="az")list.sort((a,b)=>a.title.localeCompare(b.title));
    else if(sort==="priority"){const rank={High:0,Medium:1,Low:2};list.sort((a,b)=>(rank[a.priority]??1)-(rank[b.priority]??1));}
    else list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    if(currentView==="Dashboard")list=list.slice(0,5);
    return list;
  }
  function renderIdeas() {
    const list=filteredIdeas();
    $("ideaList").innerHTML=list.map(i=>`
      <article class="idea-card" data-id="${escapeHTML(i.id)}">
        <div class="idea-symbol">${iconFor(i.category)}</div>
        <div class="idea-main"><div class="idea-title-row"><h3 class="idea-title">${escapeHTML(i.title)}</h3>${i.favorite?'<span title="Pinned favorite" style="color:var(--honey)">★</span>':''}</div>
        ${i.description?`<p class="idea-description">${escapeHTML(i.description)}</p>`:""}
        <div class="idea-meta"><span class="tag">${escapeHTML(i.category||"Random Ideas")}</span><span class="status-tag">${escapeHTML(i.status||"Inbox")}</span><span>Updated ${formatDate(i.updated_at||i.created_at)}</span></div></div>
        <div class="idea-actions"><button class="mini-button ${i.favorite?"favorited":""}" data-action="favorite" title="${i.favorite?"Unpin favorite":"Pin favorite"}" aria-label="Toggle favorite">${i.favorite?"★":"☆"}</button>
        <button class="mini-button" data-action="edit" title="Edit idea" aria-label="Edit idea">✎</button>
        <button class="mini-button" data-action="archive" title="${isArchived(i)?"Restore idea":"Archive idea"}" aria-label="${isArchived(i)?"Restore":"Archive"}">${isArchived(i)?"↶":"▱"}</button></div>
      </article>`).join("");
    $("emptyState").classList.toggle("hidden",list.length!==0);
    $("ideaList").classList.toggle("hidden",list.length===0);
    $("listHeading").textContent=({Dashboard:"Recently captured",Favorites:"Pinned favorites",Archive:"Archived ideas",Inbox:"Your inbox",Projects:"Active projects",Categories:"Ideas by category"})[currentView]||(currentView==="Ideas"?"All ideas":"Recently captured");
    $("ideaList").querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>handleIdeaAction(button.closest(".idea-card").dataset.id,button.dataset.action)));
  }
  function updateView() {
    const titles={Dashboard:["Dashboard","Your creative universe","Nothing lost. Nothing rushed."],Inbox:["Inbox","A landing spot for thoughts.","Capture now. Organize when you're ready."],Ideas:["Ideas","Every thought has a place.","Search, browse, and rediscover."],Projects:["Projects","Things in motion.","Ideas you're actively bringing to life."],Categories:["Categories","Your ideas, in their own worlds.","Choose a category to narrow your collection."],Archive:["Archive","Kept safe, out of the way.","Old ideas aren't gone. They're just resting."],Favorites:["Favorites","The ideas close to your heart.","Your pinned collection."]};
    const [title,greeting,subtitle]=titles[currentView]||titles.Dashboard;
    $("pageTitle").textContent=title;$("greeting").innerHTML=`${escapeHTML(greeting.replace(/\.$/,""))}<span class="title-period">.</span>`;$("pageSubtitle").textContent=subtitle;
    document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===currentView));
    renderStats();renderCategories();renderIdeas();
  }
  function openModal(idea=null) {
    $("ideaForm").dataset.editId=idea?.id||"";
    $("modalTitle").textContent=idea?"Edit idea":"Capture an idea";
    $("ideaTitle").value=idea?.title||"";$("ideaDescription").value=idea?.description||"";
    $("ideaCategory").value=idea?.category||categories[0]?.name||"Random Ideas";
    $("ideaStatus").value=idea?.status||"Inbox";$("ideaModal").classList.remove("hidden");
    setTimeout(()=>$("ideaTitle").focus(),30);
  }
  function closeModal(){$("ideaModal").classList.add("hidden");$("ideaForm").reset();$("ideaForm").dataset.editId="";}
  async function handleIdeaAction(id,action) {
    const idea=ideas.find(i=>i.id===id);if(!idea)return;
    try {
      if(action==="favorite"){
        const {error}=await client.from("ideas").update({is_favorite:!idea.favorite}).eq("id",id).eq("user_id",user.id);
        if(error)throw error;await refresh();showToast(idea.favorite?"Removed from favorites.":"Pinned to your favorites.");
      } else if(action==="archive"){
        const restoring=isArchived(idea);
        if(!restoring&&!confirm(`Archive “${idea.title}”? You can restore it later.`))return;
        const update=restoring?{is_archived:false,status:idea.status==="Archived"?"Someday":idea.status}:{is_archived:true,status:"Archived"};
        const {error}=await client.from("ideas").update(update).eq("id",id).eq("user_id",user.id);
        if(error)throw error;await refresh();showToast(restoring?"Idea restored.":"Idea safely archived.");
      } else if(action==="edit")openModal(idea);
    } catch(error){console.error(error);showToast("Couldn't update that idea. Please try again.");}
  }
  async function saveIdea(title,description,category,status,editId="") {
    const cleanTitle=title.trim();if(!cleanTitle){showToast("Give your idea a title first.");return false;}
    const category_id=categoryIdByName.get(category)||null;
    const payload={user_id:user.id,title:cleanTitle,description:description.trim(),category_id,status,updated_at:new Date().toISOString()};
    try {
      let result;
      if(editId)result=await client.from("ideas").update(payload).eq("id",editId).eq("user_id",user.id);
      else result=await client.from("ideas").insert({...payload,priority:"Medium",is_favorite:false,is_archived:false});
      if(result.error)throw result.error;
      await refresh();return true;
    } catch(error){console.error("Saving idea failed:",error);showToast("Couldn't save the idea. Your form text is still here; try again.");return false;}
  }
  async function refresh(){await loadIdeas();updateView();}
  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",e=>{
      e.preventDefault();const view=el.dataset.view;if(!view)return;
      currentView=view;searchText="";$("globalSearch").value="";$("categoryFilter").value="";updateView();$("sidebar").classList.remove("open");
    }));
    $("quickForm").addEventListener("submit",async e=>{
      e.preventDefault();const input=$("quickTitle"),value=input.value;
      if(await saveIdea(value,"","Random Ideas","Inbox")){input.value="";showToast("Idea saved to your hive.");}
    });
    $("topAdd").addEventListener("click",()=>openModal());$("emptyAdd").addEventListener("click",()=>openModal());
    $("closeModal").addEventListener("click",closeModal);$("cancelModal").addEventListener("click",closeModal);
    $("ideaModal").addEventListener("click",e=>{if(e.target===$("ideaModal"))closeModal();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("globalSearch").focus();}});
    $("ideaForm").addEventListener("submit",async e=>{
      e.preventDefault();const editId=$("ideaForm").dataset.editId;
      if(await saveIdea($("ideaTitle").value,$("ideaDescription").value,$("ideaCategory").value,$("ideaStatus").value,editId)){closeModal();showToast(editId?"Idea updated.":"Idea saved to your hive.");}
    });
    $("globalSearch").addEventListener("input",e=>{searchText=e.target.value;if(searchText&&currentView==="Dashboard")currentView="Ideas";updateView();});
    $("categoryFilter").addEventListener("change",renderIdeas);$("sortSelect").addEventListener("change",renderIdeas);
    $("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
    $("themeToggle").addEventListener("click",()=>{document.body.classList.toggle("light-mode");try{localStorage.setItem("the-hive-theme",document.body.classList.contains("light-mode")?"light":"dark");}catch(_){}});
    $("globalSearch").setAttribute("placeholder","Search your hive…");
    $("logoutButton")?.addEventListener("click",async()=>{await client.auth.signOut();location.replace("login.html");});
  }
  async function init(authClient,session) {
    client=authClient;user=session.user;
    try {
      await ensureCategories();renderCategoryOptions();await loadIdeas();bindEvents();
      try{if(localStorage.getItem("the-hive-theme")==="light")document.body.classList.add("light-mode");}catch(_){}
      updateView();
      // The current prototype's example records are intentionally not imported.
      // Only records in the authenticated database are shown.
    } catch(error) {
      console.error("The Hive initialization failed:",error);
      showToast("Couldn't load your database. Check Supabase settings and RLS policies.");
      $("listHeading").textContent="Couldn't load ideas";
      $("emptyState").classList.remove("hidden");
      $("emptyState").querySelector("h3").textContent="Database connection issue";
      $("emptyState").querySelector("p").textContent="Your data wasn't changed. Check the browser console or send the error to your assistant.";
    }
  }
  window.addEventListener("hive-auth-ready",event=>init(event.detail.client,event.detail.session),{once:true});
  if(window.HIVE_SUPABASE_CLIENT) {
    window.HIVE_SUPABASE_CLIENT.auth.getSession().then(({data,error})=>{
      if(!error&&data.session)init(window.HIVE_SUPABASE_CLIENT,data.session);
    });
  }
})();