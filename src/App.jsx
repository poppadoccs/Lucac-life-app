import { useState, useEffect, useRef, useCallback } from "react";
import LucacLegends from "./LucacLegends";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, push, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBJpT2hiZhKPei0NMb4d_JDd5OXgq7UvEk",
  authDomain: "lucac-life-app.firebaseapp.com",
  databaseURL: "https://lucac-life-app-default-rtdb.firebaseio.com",
  projectId: "lucac-life-app",
  storageBucket: "lucac-life-app.firebasestorage.app",
  messagingSenderId: "159387832856",
  appId: "1:159387832856:web:2b7ed2ef8a1674fab4a96d"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const GROQ_KEY   = import.meta.env.VITE_GROQ_KEY;
const TAVILY_KEY = import.meta.env.VITE_TAVILY_KEY;

const groq = async (messages, system, maxTokens=400) => {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${GROQ_KEY}`},
    body: JSON.stringify({ model:"llama-3.3-70b-versatile", max_tokens:maxTokens,
      messages: system ? [{role:"system",content:system},...messages] : messages })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
};

const tavilySearch = async (query) => {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ api_key:TAVILY_KEY, query, search_depth:"basic", max_results:3 })
    });
    const data = await res.json();
    return data.results?.map(r=>`${r.title}: ${r.content}`).join("\n\n") || "";
  } catch { return ""; }
};

const fbSet    = async (p,v) => { try { if(db) await set(ref(db,p),v); } catch(e){} };
const fbPush   = async (p,v) => { try { if(db){ const r=await push(ref(db,p),v); return r.key; } } catch(e){} return Date.now().toString(); };
const fbDel    = async (p)   => { try { if(db) await remove(ref(db,p)); } catch(e){} };
const fbListen = (p,cb)      => { try { if(db) onValue(ref(db,p),s=>cb(s.val())); } catch(e){} };

const THEMES = {
  midnight:{ bg:"#0f0f1a", card:"#1a1a2e", accent:"#f59e0b", text:"#f1f5f9", sub:"#94a3b8", border:"#2d2d4e", label:"Midnight" },
  ocean:   { bg:"#0c1445", card:"#132057", accent:"#38bdf8", text:"#f0f9ff", sub:"#93c5fd", border:"#1e3a8a", label:"Ocean" },
  forest:  { bg:"#0d1f12", card:"#132a1a", accent:"#4ade80", text:"#f0fdf4", sub:"#86efac", border:"#166534", label:"Forest" },
  rose:    { bg:"#1a0a10", card:"#2a1020", accent:"#f43f5e", text:"#fff1f2", sub:"#fda4af", border:"#9f1239", label:"Rose" },
  violet:  { bg:"#0f0a1e", card:"#1a1030", accent:"#a78bfa", text:"#f5f3ff", sub:"#c4b5fd", border:"#4c1d95", label:"Violet" },
  sunset:  { bg:"#1a0f00", card:"#2a1a00", accent:"#fb923c", text:"#fff7ed", sub:"#fdba74", border:"#9a3412", label:"Sunset" },
  arctic:  { bg:"#f0f9ff", card:"#ffffff", accent:"#0ea5e9", text:"#0c4a6e", sub:"#475569", border:"#bae6fd", label:"Arctic" },
  graphite:{ bg:"#111111", card:"#1c1c1c", accent:"#e2e8f0", text:"#f8fafc", sub:"#64748b", border:"#2d2d2d", label:"Graphite" },
  cherry:  { bg:"#1a0008", card:"#2a0012", accent:"#ff6b9d", text:"#fff0f5", sub:"#ffb3d1", border:"#8b0032", label:"Cherry" },
  gold:    { bg:"#0f0a00", card:"#1a1400", accent:"#ffd700", text:"#fffde7", sub:"#ffe066", border:"#7a6000", label:"Gold" },
  emerald: { bg:"#001a0a", card:"#002914", accent:"#00e676", text:"#f0fff5", sub:"#69f0ae", border:"#006622", label:"Emerald" },
  bumblebee:{ bg:"#111100", card:"#1a1a00", accent:"#ffdd00", text:"#fffff0", sub:"#cccc00", border:"#333300", label:"🐝 Bumblebee" },
  neon:    { bg:"#000000", card:"#0a0a0a", accent:"#39ff14", text:"#f0fff0", sub:"#00ff41", border:"#003300", label:"Neon" },
  purple:  { bg:"#0d0015", card:"#1a0030", accent:"#e040fb", text:"#fdf0ff", sub:"#ce93d8", border:"#4a0060", label:"Purple" },
  coral:   { bg:"#1a0a05", card:"#2a1510", accent:"#ff7043", text:"#fff3ef", sub:"#ffab91", border:"#8b3a20", label:"Coral" },
};

const ALL_MACROS = [
  { key:"calories", label:"Calories", unit:"kcal", color:"#f59e0b" },
  { key:"protein",  label:"Protein",  unit:"g",    color:"#3b82f6" },
  { key:"carbs",    label:"Carbs",    unit:"g",    color:"#8b5cf6" },
  { key:"fat",      label:"Fat",      unit:"g",    color:"#f43f5e" },
  { key:"fiber",    label:"Fiber",    unit:"g",    color:"#4ade80" },
  { key:"sugar",    label:"Sugar",    unit:"g",    color:"#fb923c" },
  { key:"sodium",   label:"Sodium",   unit:"mg",   color:"#94a3b8" },
];

const RECIPES = [
  { name:"Scrambled Eggs",    ingredients:["eggs","butter","salt"],           nutrition:{calories:220,protein:18,carbs:2, fat:16,fiber:0,sugar:1, sodium:320}, steps:["Crack 3 eggs, whisk with salt","Melt butter on medium heat","Stir gently until fluffy"] },
  { name:"Pasta with Butter", ingredients:["pasta","butter","salt"],          nutrition:{calories:380,protein:10,carbs:62,fat:12,fiber:3,sugar:2, sodium:280}, steps:["Boil salted water","Cook pasta 8-10 min","Drain and toss with butter"] },
  { name:"Chicken Stir Fry",  ingredients:["chicken","onion","oil","salt"],   nutrition:{calories:310,protein:35,carbs:8, fat:15,fiber:2,sugar:4, sodium:420}, steps:["Cut chicken into strips","Cook in hot oil 5-6 min","Add onion, season"] },
  { name:"Grilled Cheese",    ingredients:["bread","butter","cheese"],        nutrition:{calories:350,protein:14,carbs:28,fat:22,fiber:1,sugar:3, sodium:620}, steps:["Butter both sides of bread","Layer cheese inside","Cook 2-3 min per side"] },
  { name:"Chicken & Rice",    ingredients:["chicken","rice","salt","oil"],    nutrition:{calories:450,protein:40,carbs:48,fat:10,fiber:1,sugar:0, sodium:440}, steps:["Season and cook chicken 6-8 min per side","Serve over cooked rice"] },
  { name:"French Toast",      ingredients:["bread","eggs","milk","butter","sugar"], nutrition:{calories:320,protein:12,carbs:38,fat:14,fiber:1,sugar:14,sodium:310}, steps:["Dip bread in eggs+milk+sugar","Cook in butter 2-3 min per side"] },
  { name:"Rice & Beans",      ingredients:["rice","beans","salt","oil"],      nutrition:{calories:420,protein:14,carbs:78,fat:6, fiber:12,sugar:2, sodium:380}, steps:["Cook rice per package","Heat beans with oil","Season and serve together"] },
];

const FRIDGE_ITEMS = ["eggs","butter","milk","chicken","pasta","rice","beans","bread","cheese","onion","banana","oats","tuna","oil","salt","garlic","potato","tomato","sugar","flour"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const todayKey = () => new Date().toISOString().split("T")[0];
const timeNow  = () => new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const greet    = () => { const h=new Date().getHours(); return h<12?"Good Morning":h<17?"Good Afternoon":"Good Evening"; };
const fmtDate  = (d) => { try { return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}); } catch { return d; } };

const DEFAULT_COLORS = { me:"#f59e0b", dad:"#f59e0b", dada:"#f59e0b", mom:"#a78bfa", yana:"#f43f5e", luca:"#38bdf8" };
const getColor = (name, pc) => {
  if(!name) return "#4ade80";
  const k=name.toLowerCase();
  if(pc?.[k]) return pc[k];
  for(const [key,val] of Object.entries(DEFAULT_COLORS)) { if(k.includes(key)) return val; }
  return "#4ade80";
};

const DEFAULT_PROFILES  = [{ id:"admin", name:"Dada", emoji:"👑", type:"admin", pin:"1234" }];
const DEFAULT_NUT_GOALS = { calories:2000, protein:150, carbs:250, fat:65, fiber:25, sugar:50, sodium:2300 };
const DEFAULT_TRACKED   = ["calories","protein"];

const store = {
  get: async (k) => { try { const r=await window.storage.get(k); return r?JSON.parse(r.value):null; } catch { return null; } },
  set: async (k,v) => { try { await window.storage.set(k,JSON.stringify(v)); } catch {} },
};

export default function LifeApp() {
  const [screen,      setScreen]      = useState("profiles");
  const [profiles,    setProfiles]    = useState(DEFAULT_PROFILES);
  const [current,     setCurrent]     = useState(null);
  const [pending,     setPending]     = useState(null);
  const [pinIn,       setPinIn]       = useState("");
  const [pinErr,      setPinErr]      = useState(false);
  const [theme,       setTheme]       = useState("midnight");
  const [showTheme,   setShowTheme]   = useState(false);
  const [tab,         setTab]         = useState("home");
  const [showGame,    setShowGame]    = useState(false);
  const [syncStatus,  setSyncStatus]  = useState("⚡ Live");

  // Firebase shared state
  const [sharedCal,    setSharedCal]    = useState([]);
  const [kids,         setKids]         = useState([]);
  const [personColors, setPersonColors] = useState({});
  const [custody,      setCustody]      = useState({momDays:[1,2],dadDays:[3,4],bedtimeYana:"20:00",bedtimeLuca:"20:00"});
  const [coRules,      setCoRules]      = useState([]);
  const [exchangeLog,  setExchangeLog]  = useState([]);

  // Local state
  const [fridge,        setFridge]        = useState([]);
  const [allNutrition,  setAllNutrition]  = useState({});
  const [allGoals,      setAllGoals]      = useState({});
  const [allRoutines,   setAllRoutines]   = useState({});
  const [dailyQuote,    setDailyQuote]    = useState("");
  const [quoteLoad,     setQuoteLoad]     = useState(false);
  const [notifOn,       setNotifOn]       = useState(false);
  const [remindMins,    setRemindMins]    = useState(30);
  const [customFoods,   setCustomFoods]   = useState([]);
  const [recentFoods,   setRecentFoods]   = useState([]);
  const [profileCustom, setProfileCustom] = useState({});
  const [contactNumbers,setContactNumbers]= useState({dadPhone:"",momPhone:""});

  // Calendar state
  const [calYear,   setCalYear]   = useState(new Date().getFullYear());
  const [calMonth,  setCalMonth]  = useState(new Date().getMonth());
  const [selDay,    setSelDay]    = useState(null);
  const [showAddEv, setShowAddEv] = useState(false);
  const [multiEvs,  setMultiEvs]  = useState([{title:"",time:"",assignedTo:"",note:""}]);

  // Dashboard widget state (top level - no hooks in render!)
  const [routineInput, setRoutineInput] = useState("");
  const [goalInput,    setGoalInput]    = useState("");

  // Food state
  const [foodSect,       setFoodSect]       = useState("fridge");
  const [matched,        setMatched]        = useState([]);
  const [selRecipe,      setSelRecipe]      = useState(null);
  const [addedCal,       setAddedCal]       = useState(false);
  const [fridgeChefLoad, setFridgeChefLoad] = useState(false);
  const [fridgeChefRes,  setFridgeChefRes]  = useState(null);
  const [nutQuery,       setNutQuery]       = useState("");
  const [nutAiLoad,      setNutAiLoad]      = useState(false);
  const [nutAiResult,    setNutAiResult]    = useState(null);
  const [logLabel,       setLogLabel]       = useState("");
  const [logNut,         setLogNut]         = useState({});
  const [aiEmail,        setAiEmail]        = useState("");
  const [aiEmailLoad,    setAiEmailLoad]    = useState(false);
  const [aiEmailRes,     setAiEmailRes]     = useState(null);

  // Kids state
  const [kidName,   setKidName]   = useState("");
  const [kidEmoji,  setKidEmoji]  = useState("🧒");
  const [taskText,  setTaskText]  = useState("");
  const [taskPts,   setTaskPts]   = useState("10");
  const [activeKid, setActiveKid] = useState(null);

  // Co-parent state
  const [newRule,    setNewRule]    = useState("");
  const [exchNote,   setExchNote]  = useState("");
  const [exchTimer,  setExchTimer] = useState(null);

  // Settings state (all top level - no hooks in render!)
  const [subSet,   setSubSet]   = useState("profile");
  const [sDName,   setSDName]   = useState("");
  const [sDPin,    setSDPin]    = useState("");
  const [sDad,     setSDad]     = useState("");
  const [sMom,     setSMom]     = useState("");
  const [lFont,    setLFont]    = useState(1);
  const [lBg,      setLBg]      = useState("");
  const [lCard,    setLCard]    = useState("normal");
  const [newPName, setNewPName] = useState("");
  const [newPEmoji,setNewPEmoji]= useState("😊");
  const [newPType, setNewPType] = useState("family");
  const [sSaved,   setSSaved]   = useState(false);
  const [cSaved,   setCSaved]   = useState(false);
  const [coSaved,  setCoSaved]  = useState(false);
  const [nSaved,   setNSaved]   = useState(false);
  const [fSaved,   setFSaved]   = useState(false);

  // AI chat
  const [showAI,     setShowAI]     = useState(false);
  const [aiChat,     setAiChat]     = useState([]);
  const [aiInput,    setAiInput]    = useState("");
  const [aiChatLoad, setAiChatLoad] = useState(false);

  const T        = THEMES[theme] || THEMES.midnight;
  const pid      = current?.id;
  const isAdmin  = current?.type === "admin";
  const isKid    = current?.type === "kid";
  const myColor  = getColor(current?.name, personColors);
  const myCustom = profileCustom[pid] || {};

  // Load from storage
  useEffect(()=>{
    (async()=>{
      const p  = await store.get("profiles");      if(p)  setProfiles(p);
      const f  = await store.get("fridge");        if(f)  setFridge(f);
      const an = await store.get("allNutrition");  if(an) setAllNutrition(an);
      const ag = await store.get("allGoals");      if(ag) setAllGoals(ag);
      const ar = await store.get("allRoutines");   if(ar) setAllRoutines(ar);
      const th = await store.get("theme");         if(th) setTheme(th);
      const pc = await store.get("personColors");  if(pc) setPersonColors(pc);
      const rm = await store.get("remindMins");    if(rm!=null) setRemindMins(rm);
      const ne = await store.get("notifOn");       if(ne) setNotifOn(ne);
      const cf = await store.get("customFoods");   if(cf) setCustomFoods(cf);
      const rf = await store.get("recentFoods");   if(rf) setRecentFoods(rf);
      const pc2= await store.get("profileCustom"); if(pc2)setProfileCustom(pc2);
      const cn = await store.get("contactNumbers");if(cn) setContactNumbers(cn);
      fetchQuote();
    })();
    fbListen("sharedCal",   d=>setSharedCal(d?Object.entries(d).map(([k,v])=>({...v,fbKey:k})):[]));
    fbListen("kids",        d=>setKids(d?Object.entries(d).map(([k,v])=>({...v,fbKey:k})):[]));
    fbListen("personColors",d=>{ if(d){ setPersonColors(d); store.set("personColors",d); }});
    fbListen("custody",     d=>{ if(d) setCustody(d); });
    fbListen("coRules",     d=>setCoRules(d?Object.entries(d).map(([k,v])=>({...v,fbKey:k})):[]));
    fbListen("exchangeLog", d=>setExchangeLog(d?Object.entries(d).map(([k,v])=>({...v,fbKey:k})):[]));
  },[]);

  useEffect(()=>{ if(current){ setSDName(current.name||""); setSDPin(""); } },[current]);
  useEffect(()=>{ setSDad(contactNumbers.dadPhone||""); setSMom(contactNumbers.momPhone||""); },[contactNumbers]);
  useEffect(()=>{
    const c=profileCustom[pid]||{};
    setLFont(c.fontSize||1); setLBg(c.bg||""); setLCard(c.cardSize||"normal");
  },[pid, profileCustom]);

  // Fridge matcher
  useEffect(()=>{
    if(!fridge.length){setMatched([]);return;}
    setMatched(RECIPES.filter(r=>r.ingredients.every(i=>fridge.includes(i))));
    setSelRecipe(null); setAddedCal(false);
  },[fridge]);

  // Helpers
  const saveProfiles = v=>{setProfiles(v);store.set("profiles",v);};
  const saveFridge   = v=>{setFridge(v);store.set("fridge",v);};
  const saveTheme    = v=>{setTheme(v);store.set("theme",v);};
  const saveColor    = async(name,color)=>{ const u={...personColors,[name.toLowerCase()]:color}; setPersonColors(u); store.set("personColors",u); await fbSet("personColors",u); };
  const saveCustom   = updates=>{ const u={...profileCustom,[pid]:{...myCustom,...updates}}; setProfileCustom(u); store.set("profileCustom",u); };
  const revertCustom = ()=>{ const u={...profileCustom}; delete u[pid]; setProfileCustom(u); store.set("profileCustom",u); };
  const saveContacts = updates=>{ const u={...contactNumbers,...updates}; setContactNumbers(u); store.set("contactNumbers",u); };

  const myNut      = allNutrition[pid]||{};
  const myTracked  = myNut.tracked||DEFAULT_TRACKED;
  const myNutGoals = myNut.goals||DEFAULT_NUT_GOALS;
  const todayLog   = myNut[todayKey()]||[];
  const myGoals    = allGoals[pid]||[];
  const myRoutines = allRoutines[pid]||[];

  const saveNut      = v=>{const n={...allNutrition,[pid]:v};setAllNutrition(n);store.set("allNutrition",n);};
  const saveGoals    = v=>{const n={...allGoals,[pid]:v};setAllGoals(n);store.set("allGoals",n);};
  const saveRoutines = v=>{const n={...allRoutines,[pid]:v};setAllRoutines(n);store.set("allRoutines",n);};

  const todayTotals = todayLog.reduce((acc,item)=>{ALL_MACROS.forEach(m=>{acc[m.key]=(acc[m.key]||0)+(item.nutrition?.[m.key]||0);});return acc;},{});
  const addEntry    = (label,nutrition)=>saveNut({...myNut,[todayKey()]:[...todayLog,{label,nutrition,time:timeNow(),id:Date.now()}]});
  const removeEntry = id=>saveNut({...myNut,[todayKey()]:todayLog.filter(e=>e.id!==id)});
  const updateTracked = key=>saveNut({...myNut,tracked:myTracked.includes(key)?myTracked.filter(k=>k!==key):[...myTracked,key]});
  const updateGoal    = (key,val)=>saveNut({...myNut,goals:{...myNutGoals,[key]:parseInt(val)||0}});

  // Calendar helpers
  const getEventsForDay=(year,month,day)=>{
    const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const dow=new Date(dateStr+"T12:00:00").getDay();
    return sharedCal.filter(e=>e.recurrence==="daily"||(e.recurrence==="weekly"&&e.days?.includes(dow))||e.date===dateStr);
  };
  const saveEvent   = async ev=>{setSyncStatus("🔄 Syncing...");await fbPush("sharedCal",{...ev,addedBy:current?.name,id:Date.now()});setSyncStatus("⚡ Live");};
  const deleteEvent = fbKey=>fbDel(`sharedCal/${fbKey}`);
  const toggleEvent = async ev=>fbSet(`sharedCal/${ev.fbKey}`,{...ev,done:!ev.done});

  const addKid    = async kid=>fbPush("kids",kid);
  const updateKid = async(fbKey,updates)=>{if(fbKey)await fbSet(`kids/${fbKey}`,updates);};
  const removeKid = fbKey=>fbDel(`kids/${fbKey}`);

  const handleGamePoints = useCallback(pts=>{
    if(!pid)return;
    const kid=kids.find(k=>k.name===current?.name);
    if(!kid)return;
    updateKid(kid.fbKey,{...kid,points:(kid.points||0)+pts});
  },[kids,current,pid]);

  const fetchQuote = async()=>{
    const saved=await store.get("dailyQuote");
    if(saved?.date===todayKey()){setDailyQuote(saved.quote);return;}
    setQuoteLoad(true);
    try {
      const q=await groq([{role:"user",content:"One short powerful motivational quote for a single dad building a business and raising two young kids. Under 20 words. Just the quote, no quotes or attribution."}],null,80);
      setDailyQuote(q||"Every day you show up for your kids is a win. 💙");
      store.set("dailyQuote",{date:todayKey(),quote:q});
    } catch { setDailyQuote("Every day you show up for your kids is a win. 💙"); }
    setQuoteLoad(false);
  };

  const lookupNutrition = async(query)=>{
    if(!query.trim())return;
    setNutAiLoad(true); setNutAiResult(null);
    try {
      const text=await groq([{role:"user",content:`Nutrition lookup: "${query}". Return ONLY valid JSON, no markdown: {"food":"string","serving":"string","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"sodium":0}`}],null,300);
      setNutAiResult(JSON.parse(text.replace(/\`\`\`json|\`\`\`/g,"").trim()));
    } catch { setNutAiResult({error:true}); }
    setNutAiLoad(false);
  };

  const askFridgeChef = async()=>{
    if(!fridge.length)return;
    setFridgeChefLoad(true); setFridgeChefRes(null);
    try {
      const text=await groq([{role:"user",content:`I have: ${fridge.join(", ")}. Give me ONE detailed recipe I can make RIGHT NOW. Include name, ingredients with amounts, step-by-step instructions, approximate nutrition. Make it sound delicious!`}],null,600);
      setFridgeChefRes(text);
    } catch { setFridgeChefRes("Couldn't get a recipe — try again!"); }
    setFridgeChefLoad(false);
  };

  const sendAIChat = async(msg)=>{
    if(!msg.trim())return;
    const userMsg={role:"user",content:msg};
    const newHistory=[...aiChat,userMsg];
    setAiChat(newHistory); setAiInput(""); setAiChatLoad(true);
    try {
      const needsSearch=/weather|news|today|current|near me|price|score|latest|lawyer|doctor|restaurant|open|hours/i.test(msg);
      let webContext="";
      if(needsSearch&&TAVILY_KEY) webContext=await tavilySearch(msg);
      const system=`You are the LUCAC Family App AI. User: ${current?.name}. Today: ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}. Kids: Yana (8) and Luca (6). Help with nutrition, meals, parenting, schedules, motivation. Keep answers SHORT and friendly.${webContext?`\n\nWeb info:\n${webContext}`:""}`;
      const reply=await groq(newHistory.slice(-6),system,400);
      setAiChat(h=>[...h,{role:"assistant",content:reply||"Sorry, try again!"}]);
    } catch { setAiChat(h=>[...h,{role:"assistant",content:"Connection issue — try again!"}]); }
    setAiChatLoad(false);
  };

  const parseEmail = async()=>{
    if(!aiEmail.trim())return;
    setAiEmailLoad(true); setAiEmailRes(null);
    try {
      const text=await groq([{role:"user",content:`Extract appointment from this email. Return ONLY valid JSON: {"title":"string","date":"YYYY-MM-DD","time":"HH:MM","note":"string"}. Email: ${aiEmail}`}],null,200);
      setAiEmailRes(JSON.parse(text.replace(/\`\`\`json|\`\`\`/g,"").trim()));
    } catch { setAiEmailRes({error:true}); }
    setAiEmailLoad(false);
  };

  const enableNotif = async()=>{
    if(!("Notification" in window)){alert("Notifications not supported.");return;}
    const p=await Notification.requestPermission();
    if(p==="granted"){setNotifOn(true);store.set("notifOn",true);}
    else alert("Please allow notifications in browser settings!");
  };

  // Styles
  const activeBg = myCustom.bg || T.bg;
  const cardPad  = {compact:"10px",normal:"16px",spacious:"22px",giant:"28px"}[myCustom.cardSize||"normal"]||"16px";
  const fScale   = myCustom.fontSize || 1;

  const s = {
    wrap: {minHeight:"100vh",background:activeBg,color:T.text,fontFamily:"'Segoe UI',sans-serif",paddingBottom:"80px",fontSize:`${14*fScale}px`},
    hdr:  {background:T.card,borderBottom:`1px solid ${T.border}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100},
    page: {padding:"12px"},
    card: {background:T.card,border:`1px solid ${T.border}`,borderRadius:"16px",padding:cardPad,marginBottom:"12px"},
    h2:   {fontSize:`${16*fScale}px`,fontWeight:"bold",color:T.accent,margin:"0 0 10px 0"},
    h3:   {fontSize:"10px",color:T.sub,marginBottom:"6px",textTransform:"uppercase",letterSpacing:"1px"},
    inp:  {background:activeBg,border:`1px solid ${T.border}`,borderRadius:"10px",padding:"10px 14px",color:T.text,fontSize:`${14*fScale}px`,width:"100%",boxSizing:"border-box",fontFamily:"'Segoe UI',sans-serif"},
    txa:  {background:activeBg,border:`1px solid ${T.border}`,borderRadius:"10px",padding:"10px 14px",color:T.text,fontSize:`${14*fScale}px`,width:"100%",boxSizing:"border-box",fontFamily:"'Segoe UI',sans-serif",minHeight:"80px",resize:"vertical"},
    btn:  {background:T.accent,color:T.bg,border:"none",borderRadius:"10px",padding:"10px 18px",fontWeight:"bold",fontSize:`${14*fScale}px`,cursor:"pointer"},
    btnSm:{background:T.accent,color:T.bg,border:"none",borderRadius:"8px",padding:"7px 12px",fontWeight:"bold",fontSize:"12px",cursor:"pointer"},
    btnO: {background:"none",color:T.accent,border:`1px solid ${T.accent}`,borderRadius:"10px",padding:"8px 14px",fontSize:"13px",cursor:"pointer"},
    nav:  {position:"fixed",bottom:0,left:0,right:0,background:T.card,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-around",padding:"8px 0 14px",zIndex:100},
    nBtn: (a)=>({background:"none",border:"none",color:a?T.accent:T.sub,fontSize:"9px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",padding:"0 4px",minWidth:"44px"}),
    tag:  (a,c)=>({background:a?(c||T.accent):activeBg,color:a?T.bg:T.sub,border:`1px solid ${a?(c||T.accent):T.border}`,borderRadius:"20px",padding:"5px 11px",fontSize:"12px",cursor:"pointer",margin:"3px",display:"inline-block"}),
    row:  {display:"flex",gap:"8px"},
    g2:   {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"},
    pbar: {background:T.border,borderRadius:"10px",height:"8px",overflow:"hidden",margin:"4px 0"},
    pfil: (p,c)=>({height:"100%",borderRadius:"10px",background:p>=100?"#ef4444":(c||T.accent),width:Math.min(p,100)+"%"}),
    box:  {background:activeBg,borderRadius:"12px",padding:"10px",textAlign:"center"},
    irow: {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${T.border}`},
  };

  const tabs = isKid
    ? [{id:"home",icon:"⭐",label:"Stars"},{id:"game",icon:"🎮",label:"Game"}]
    : [{id:"home",icon:"🏠",label:"Home"},{id:"food",icon:"🍽️",label:"Food"},{id:"kids",icon:"⭐",label:"Kids"},{id:"coparent",icon:"🤝",label:"Family"},{id:"settings",icon:"⚙️",label:"Settings"}];

  // ─── PROFILE SELECT ───
  if(screen==="profiles") return (
    <div style={{...s.wrap,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"24px"}}>
      <div style={{fontSize:"52px",marginBottom:"8px"}}>👑</div>
      <div style={{fontSize:"28px",fontWeight:"bold",color:T.accent,letterSpacing:"4px",marginBottom:"4px"}}>LUCAC</div>
      <div style={{fontSize:"12px",color:T.sub,marginBottom:"40px",letterSpacing:"2px"}}>FAMILY HQ</div>
      <div style={{display:"flex",flexDirection:"column",gap:"12px",width:"100%",maxWidth:"320px"}}>
        {profiles.map(p=>(
          <button key={p.id} onClick={()=>{ if(p.pin){setPending(p);setPinIn("");setPinErr(false);setScreen("pin");} else {setCurrent(p);setScreen("app");setTab("home");} }}
            style={{background:T.card,border:`2px solid ${getColor(p.name,personColors)}`,borderRadius:"16px",padding:"16px",display:"flex",alignItems:"center",gap:"16px",cursor:"pointer",width:"100%",textAlign:"left"}}>
            <span style={{fontSize:"36px"}}>{p.emoji}</span>
            <div><div style={{fontSize:"17px",fontWeight:"bold",color:T.text}}>{p.name}</div><div style={{fontSize:"12px",color:T.sub}}>{p.type}</div></div>
          </button>
        ))}
      </div>
    </div>
  );

  // ─── PIN SCREEN ───
  if(screen==="pin") return (
    <div style={{...s.wrap,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"24px"}}>
      <div style={{fontSize:"48px",marginBottom:"12px"}}>{pending?.emoji}</div>
      <div style={{fontSize:"20px",fontWeight:"bold",marginBottom:"6px"}}>{pending?.name}</div>
      <div style={{fontSize:"13px",color:T.sub,marginBottom:"32px"}}>Enter your PIN</div>
      <div style={{display:"flex",gap:"12px",marginBottom:"16px"}}>
        {Array.from({length:Math.max(4,pinIn.length)}).map((_,i)=>(<div key={i} style={{width:"16px",height:"16px",borderRadius:"50%",background:pinIn[i]?T.accent:T.border}}/>))}
      </div>
      {pinErr&&<div style={{color:"#ef4444",fontSize:"13px",marginBottom:"16px"}}>Wrong PIN — try again</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px",width:"240px"}}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
          <button key={i} style={{background:k===""?"transparent":T.card,color:T.text,border:`1px solid ${T.border}`,borderRadius:"50%",width:"64px",height:"64px",fontSize:"22px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
            onClick={()=>{
              if(k==="⌫"){setPinIn(p=>p.slice(0,-1));setPinErr(false);}
              else if(k!==""){
                const np=pinIn+k; setPinIn(np);
                if(np===pending?.pin){setCurrent(pending);setScreen("app");setTab("home");setPinIn("");}
                else if(np.length>=(pending?.pin?.length||4)){setPinErr(true);setTimeout(()=>{setPinIn("");setPinErr(false);},800);}
              }
            }}>{k}</button>
        ))}
      </div>
      <button style={{...s.btnO,marginTop:"24px"}} onClick={()=>setScreen("profiles")}>← Back</button>
    </div>
  );

  // ─── GAME ───
  if(showGame) return <LucacLegends onBack={()=>setShowGame(false)} onPoints={handleGamePoints} theme={T}/>;

  // ─── MAIN APP ───
  return (
    <div style={s.wrap}>
      {/* HEADER */}
      <div style={s.hdr}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"22px",cursor:"pointer"}} onClick={()=>setScreen("profiles")}>{current?.emoji||"👤"}</span>
          <div>
            <div style={{fontSize:"14px",fontWeight:"bold",color:T.accent,letterSpacing:"2px"}}>LUCAC ✦</div>
            <div style={{fontSize:"10px",color:"#4ade80"}}>{syncStatus}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:"8px",alignItems:"center",position:"relative"}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"13px",fontWeight:"bold"}}>{new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
            <div style={{fontSize:"10px",color:T.sub}}>{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
          </div>
          <button onClick={()=>setShowTheme(x=>!x)} style={s.btnSm}>🎨</button>
          {showTheme&&(
            <div style={{position:"absolute",top:"44px",right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:"14px",padding:"14px",display:"flex",flexWrap:"wrap",gap:"10px",zIndex:200,boxShadow:"0 10px 40px rgba(0,0,0,0.5)",width:"230px"}}>
              {Object.entries(THEMES).map(([name,t])=>(
                <div key={name} onClick={()=>{saveTheme(name);setShowTheme(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",cursor:"pointer"}}>
                  <div style={{width:"30px",height:"30px",borderRadius:"50%",background:t.accent,border:theme===name?"3px solid white":"3px solid transparent"}}/>
                  <div style={{fontSize:"9px",color:T.sub}}>{t.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={s.page}>

        {/* ══════════════════════════════════════
            HOME DASHBOARD
        ══════════════════════════════════════ */}
        {tab==="home"&&(<>

          {/* DAILY QUOTE */}
          <div style={{...s.card,borderLeft:`4px solid ${myColor}`,padding:"12px 16px",marginBottom:"10px"}}>
            {quoteLoad
              ? <div style={{color:T.sub,fontSize:"13px"}}>Loading... ✨</div>
              : <div style={{fontStyle:"italic",lineHeight:1.6,fontSize:"13px",color:T.sub}}>✦ {dailyQuote}</div>
            }
          </div>

          {/* BIG CALENDAR */}
          {(()=>{
            const now=new Date();
            const firstDay=new Date(calYear,calMonth,1).getDay();
            const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
            const monthName=new Date(calYear,calMonth).toLocaleString("en-US",{month:"long",year:"numeric"});
            const prevMo=()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);};
            const nextMo=()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);};
            const todayStr=todayKey();
            const selStr=selDay?`${selDay.y}-${String(selDay.m+1).padStart(2,"0")}-${String(selDay.d).padStart(2,"0")}`:"";
            const cells=[]; for(let i=0;i<firstDay;i++) cells.push(null); for(let d=1;d<=daysInMonth;d++) cells.push(d);

            return(
              <div style={s.card}>
                {/* Month nav */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                  <button style={{...s.btnSm,padding:"6px 16px",fontSize:"20px"}} onClick={prevMo}>‹</button>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"4px"}}>
                    <div style={{fontWeight:"bold",fontSize:`${15*fScale}px`,color:T.accent}}>{monthName}</div>
                    <button onClick={()=>{setCalYear(now.getFullYear());setCalMonth(now.getMonth());setSelDay({y:now.getFullYear(),m:now.getMonth(),d:now.getDate()});}}
                      style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"8px",color:T.sub,fontSize:"10px",padding:"2px 12px",cursor:"pointer"}}>Today</button>
                  </div>
                  <button style={{...s.btnSm,padding:"6px 16px",fontSize:"20px"}} onClick={nextMo}>›</button>
                </div>

                {/* Day headers */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:"2px"}}>
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>(<div key={d} style={{textAlign:"center",fontSize:"10px",color:T.sub,padding:"3px 0",fontWeight:"bold"}}>{d}</div>))}
                </div>

                {/* Calendar grid */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"2px"}}>
                  {cells.map((day,i)=>{
                    if(!day) return <div key={i}/>;
                    const dateStr=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    const isToday=dateStr===todayStr;
                    const isSel=dateStr===selStr;
                    const evts=getEventsForDay(calYear,calMonth,day);
                    const dots=[...new Set(evts.map(e=>getColor(e.assignedTo||e.addedBy||"",personColors)))].slice(0,3);
                    return(
                      <div key={i} onClick={()=>{setSelDay({y:calYear,m:calMonth,d:day});setMultiEvs([{title:"",time:"",assignedTo:"",note:""}]);setShowAddEv(false);}}
                        style={{textAlign:"center",padding:"5px 2px",borderRadius:"8px",background:isSel?T.accent:isToday?T.accent+"44":"transparent",cursor:"pointer",minHeight:"38px",border:`2px solid ${isSel?T.accent:"transparent"}`}}>
                        <div style={{fontSize:`${12*fScale}px`,fontWeight:(isToday||isSel)?"bold":"normal",color:isSel?T.bg:isToday?T.accent:T.text}}>{day}</div>
                        <div style={{display:"flex",justifyContent:"center",gap:"2px",marginTop:"2px"}}>
                          {dots.map((c,ci)=>(<div key={ci} style={{width:"5px",height:"5px",borderRadius:"50%",background:isSel?T.bg:c}}/>))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected day panel */}
                {selDay&&(()=>{
                  const selDate=`${selDay.y}-${String(selDay.m+1).padStart(2,"0")}-${String(selDay.d).padStart(2,"0")}`;
                  const selDow=new Date(selDate+"T12:00:00").getDay();
                  const selEvts=sharedCal.filter(e=>e.recurrence==="daily"||(e.recurrence==="weekly"&&e.days?.includes(selDow))||e.date===selDate).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
                  const selLabel=new Date(selDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
                  return(
                    <div style={{marginTop:"12px",borderTop:`1px solid ${T.border}`,paddingTop:"12px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                        <div style={{fontWeight:"bold",fontSize:`${13*fScale}px`,color:T.accent}}>{selLabel}</div>
                        {!isKid&&<button style={{...s.btnSm,fontSize:"12px"}} onClick={()=>setShowAddEv(x=>!x)}>{showAddEv?"✕ Cancel":"➕ Add"}</button>}
                      </div>

                      {/* Add event form */}
                      {showAddEv&&!isKid&&(
                        <div style={{background:activeBg,borderRadius:"12px",padding:"12px",marginBottom:"10px",border:`1px solid ${T.border}`}}>
                          {multiEvs.map((ev,ei)=>(
                            <div key={ei} style={{background:T.card,borderRadius:"10px",padding:"10px",marginBottom:"8px",border:`1px solid ${T.border}`}}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                                <span style={{fontSize:"11px",color:T.sub,fontWeight:"bold"}}>Event {ei+1}</span>
                                {ei>0&&<span onClick={()=>setMultiEvs(m=>m.filter((_,j)=>j!==ei))} style={{color:T.sub,cursor:"pointer",fontSize:"18px"}}>×</span>}
                              </div>
                              <input style={{...s.inp,marginBottom:"6px"}} placeholder="Event name..." value={ev.title} onChange={e=>setMultiEvs(m=>m.map((x,j)=>j===ei?{...x,title:e.target.value}:x))}/>
                              <div style={{display:"flex",gap:"6px",marginBottom:"6px"}}>
                                <input style={{...s.inp,flex:1}} type="time" value={ev.time} onChange={e=>setMultiEvs(m=>m.map((x,j)=>j===ei?{...x,time:e.target.value}:x))}/>
                                <input style={{...s.inp,flex:1}} placeholder="Who?" value={ev.assignedTo} onChange={e=>setMultiEvs(m=>m.map((x,j)=>j===ei?{...x,assignedTo:e.target.value}:x))}/>
                              </div>
                              <input style={s.inp} placeholder="Notes (optional)" value={ev.note} onChange={e=>setMultiEvs(m=>m.map((x,j)=>j===ei?{...x,note:e.target.value}:x))}/>
                            </div>
                          ))}
                          <button style={{...s.btnO,width:"100%",marginBottom:"8px",fontSize:"12px"}} onClick={()=>setMultiEvs(m=>[...m,{title:"",time:"",assignedTo:"",note:""}])}>+ Add Another Event</button>
                          <button style={{...s.btn,width:"100%"}} onClick={async()=>{
                            const valid=multiEvs.filter(e=>e.title.trim());
                            if(!valid.length)return;
                            for(const ev of valid) await saveEvent({...ev,date:selDate,recurrence:"once",days:[]});
                            setShowAddEv(false); setMultiEvs([{title:"",time:"",assignedTo:"",note:""}]);
                          }}>💾 Save {multiEvs.filter(e=>e.title.trim()).length} Event{multiEvs.filter(e=>e.title.trim()).length!==1?"s":""}</button>
                        </div>
                      )}

                      {selEvts.length===0&&!showAddEv&&<div style={{color:T.sub,fontSize:"12px",textAlign:"center",padding:"8px"}}>Nothing planned — tap ➕ Add!</div>}
                      {selEvts.map((a,i)=>{
                        const col=getColor(a.assignedTo||a.addedBy||"",personColors);
                        return(
                          <div key={i} style={{display:"flex",gap:"8px",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`}}>
                            <div onClick={()=>toggleEvent(a)} style={{width:"20px",height:"20px",borderRadius:"50%",border:`2px solid ${col}`,background:a.done?col:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {a.done&&<span style={{color:"#000",fontSize:"10px"}}>✓</span>}
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:"13px",fontWeight:"bold",textDecoration:a.done?"line-through":"none"}}>{a.title}</div>
                              <div style={{fontSize:"11px",color:col}}>{a.time||"All day"}{a.assignedTo?` · ${a.assignedTo}`:""}</div>
                            </div>
                            {!isKid&&<span onClick={()=>deleteEvent(a.fbKey)} style={{color:T.sub,cursor:"pointer",fontSize:"18px"}}>×</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ROUTINES + GOALS SIDE BY SIDE */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"10px"}}>

            {/* ROUTINES WIDGET */}
            <div style={s.card}>
              <div style={{fontSize:`${13*fScale}px`,fontWeight:"bold",color:"#4ade80",marginBottom:"8px"}}>✅ Routines</div>
              {myRoutines.length===0&&<div style={{color:T.sub,fontSize:"11px",marginBottom:"8px"}}>Add daily habits below!</div>}
              {myRoutines.map((r,i)=>{
                const done=r.doneOn===todayKey();
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:"6px",padding:"5px 0",borderBottom:`1px solid ${T.border}`}}>
                    <div onClick={()=>saveRoutines(myRoutines.map((x,j)=>j===i?{...x,doneOn:done?"":todayKey()}:x))}
                      style={{width:"18px",height:"18px",borderRadius:"50%",border:`2px solid ${done?"#4ade80":T.border}`,background:done?"#4ade80":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {done&&<span style={{color:"#000",fontSize:"9px"}}>✓</span>}
                    </div>
                    <span style={{fontSize:"11px",textDecoration:done?"line-through":"none",color:done?T.sub:T.text,flex:1,lineHeight:1.3}}>{r.title}</span>
                    <span onClick={()=>saveRoutines(myRoutines.filter((_,j)=>j!==i))} style={{color:T.sub,cursor:"pointer",fontSize:"14px",flexShrink:0}}>×</span>
                  </div>
                );
              })}
              <div style={{display:"flex",gap:"4px",marginTop:"8px"}}>
                <input style={{...s.inp,flex:1,padding:"5px 8px",fontSize:"11px"}} placeholder="Add..." value={routineInput} onChange={e=>setRoutineInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&routineInput.trim()){saveRoutines([...myRoutines,{title:routineInput.trim(),doneOn:"",id:Date.now()}]);setRoutineInput("");}}}/>
                <button style={{...s.btnSm,padding:"5px 8px",fontSize:"16px"}} onClick={()=>{if(routineInput.trim()){saveRoutines([...myRoutines,{title:routineInput.trim(),doneOn:"",id:Date.now()}]);setRoutineInput("");}}}>+</button>
              </div>
              {myRoutines.length>0&&<div style={{fontSize:"10px",color:T.sub,marginTop:"5px",textAlign:"center"}}>{myRoutines.filter(r=>r.doneOn===todayKey()).length}/{myRoutines.length} done</div>}
            </div>

            {/* GOALS WIDGET */}
            <div style={s.card}>
              <div style={{fontSize:`${13*fScale}px`,fontWeight:"bold",color:myColor,marginBottom:"8px"}}>🎯 Goals</div>
              {myGoals.length===0&&<div style={{color:T.sub,fontSize:"11px",marginBottom:"8px"}}>Add today's goals!</div>}
              {myGoals.map((g,i)=>(
                <div key={g.id||i} style={{display:"flex",alignItems:"center",gap:"6px",padding:"5px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div onClick={()=>saveGoals(myGoals.map((gm,idx)=>idx===i?{...gm,done:!gm.done}:gm))}
                    style={{width:"18px",height:"18px",borderRadius:"50%",border:`2px solid ${g.done?myColor:T.border}`,background:g.done?myColor:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {g.done&&<span style={{color:T.bg,fontSize:"9px"}}>✓</span>}
                  </div>
                  <span style={{fontSize:"11px",textDecoration:g.done?"line-through":"none",color:g.done?T.sub:T.text,flex:1,lineHeight:1.3}}>{g.text}</span>
                  <span onClick={()=>saveGoals(myGoals.filter((_,idx)=>idx!==i))} style={{color:T.sub,cursor:"pointer",fontSize:"14px",flexShrink:0}}>×</span>
                </div>
              ))}
              <div style={{display:"flex",gap:"4px",marginTop:"8px"}}>
                <input style={{...s.inp,flex:1,padding:"5px 8px",fontSize:"11px"}} placeholder="Add..." value={goalInput} onChange={e=>setGoalInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&goalInput.trim()){saveGoals([...myGoals,{text:goalInput.trim(),done:false,id:Date.now()}]);setGoalInput("");}}}/>
                <button style={{...s.btnSm,padding:"5px 8px",fontSize:"16px"}} onClick={()=>{if(goalInput.trim()){saveGoals([...myGoals,{text:goalInput.trim(),done:false,id:Date.now()}]);setGoalInput("");}}}>+</button>
              </div>
              {myGoals.length>0&&<div style={{fontSize:"10px",color:T.sub,marginTop:"5px",textAlign:"center"}}>{myGoals.filter(g=>g.done).length}/{myGoals.length} done</div>}
            </div>
          </div>

          {/* QUICK STATS ROW */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"10px"}}>
            {[
              {icon:"🔥",label:"Calories",val:`${todayTotals.calories||0}`},
              {icon:"✅",label:"Routines",val:`${myRoutines.filter(r=>r.doneOn===todayKey()).length}/${myRoutines.length}`},
              {icon:"🎯",label:"Goals",val:`${myGoals.filter(g=>g.done).length}/${myGoals.length}`},
            ].map((it,i)=>(
              <div key={i} style={s.box}>
                <div style={{fontSize:"20px"}}>{it.icon}</div>
                <div style={{fontSize:"10px",color:T.sub,marginTop:"2px"}}>{it.label}</div>
                <div style={{fontSize:"13px",fontWeight:"bold",color:myColor,marginTop:"1px"}}>{it.val}</div>
              </div>
            ))}
          </div>
        </>)}

        {/* ══════════════════════════════════════
            FOOD TAB
        ══════════════════════════════════════ */}
        {tab==="food"&&(<>
          <div style={{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"}}>
            {[["fridge","🧊 Fridge"],["nutrition","🔥 Nutrition"],["myfoods","🥩 My Foods"],["email","📧 Email→Cal"]].map(([id,lbl])=>(
              <button key={id} style={{...s.btnO,background:foodSect===id?T.accent:"none",color:foodSect===id?T.bg:T.accent,fontSize:"12px",padding:"6px 12px"}} onClick={()=>setFoodSect(id)}>{lbl}</button>
            ))}
          </div>

          {foodSect==="fridge"&&(<>
            <div style={s.card}>
              <div style={s.h2}>🧊 What's In Your Fridge?</div>
              <div style={{color:T.sub,fontSize:"12px",marginBottom:"10px"}}>Tap what you have — AI Chef cooks for you!</div>
              <div>{FRIDGE_ITEMS.map(item=>(<span key={item} style={s.tag(fridge.includes(item))} onClick={()=>saveFridge(fridge.includes(item)?fridge.filter(f=>f!==item):[...fridge,item])}>{item}</span>))}</div>
            </div>
            {fridge.length>0&&(
              <div style={{...s.card,borderLeft:"4px solid #f59e0b"}}>
                <div style={s.h2}>👨‍🍳 AI Fridge Chef</div>
                <div style={{color:T.sub,fontSize:"12px",marginBottom:"10px"}}>You have: {fridge.join(", ")}</div>
                <button style={{...s.btn,width:"100%",background:"linear-gradient(135deg,#f59e0b,#fb923c)"}} onClick={askFridgeChef} disabled={fridgeChefLoad}>
                  {fridgeChefLoad?"👨‍🍳 Cooking...":"🍳 Chef! What can I make right now?"}
                </button>
                {fridgeChefRes&&(
                  <div style={{background:activeBg,borderRadius:"12px",padding:"14px",marginTop:"12px",whiteSpace:"pre-wrap",fontSize:"13px",lineHeight:1.8,border:`1px solid ${T.border}`}}>
                    {fridgeChefRes}
                    <button style={{...s.btnO,width:"100%",marginTop:"10px",fontSize:"12px"}} onClick={()=>setFridgeChefRes(null)}>Try Another ↻</button>
                  </div>
                )}
              </div>
            )}
            {matched.map((r,i)=>(
              <div key={i} style={s.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontWeight:"bold",fontSize:"15px"}}>{r.name}</div><div style={{color:T.accent,fontSize:"12px",marginTop:"2px"}}>🔥 {r.nutrition.calories} cal · 💪 {r.nutrition.protein}g protein</div></div>
                  <button style={s.btnO} onClick={()=>setSelRecipe(selRecipe?.name===r.name?null:r)}>{selRecipe?.name===r.name?"▲":"▼"}</button>
                </div>
                {selRecipe?.name===r.name&&(
                  <div style={{marginTop:"12px"}}>
                    <div style={{background:activeBg,borderRadius:"10px",padding:"12px",marginBottom:"10px"}}>
                      {ALL_MACROS.map(m=>(<div key={m.key} style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}><span style={{fontSize:"12px",color:T.sub}}>{m.label}</span><span style={{fontSize:"12px",fontWeight:"bold",color:m.color}}>{r.nutrition[m.key]||0}{m.unit}</span></div>))}
                    </div>
                    {r.steps.map((step,si)=>(<div key={si} style={{display:"flex",gap:"8px",marginBottom:"8px"}}><div style={{background:T.accent,color:T.bg,borderRadius:"50%",width:"22px",height:"22px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"bold",flexShrink:0}}>{si+1}</div><div style={{fontSize:"13px",lineHeight:1.5}}>{step}</div></div>))}
                    <button style={{...s.btn,width:"100%",marginTop:"8px",opacity:addedCal?0.6:1}} onClick={()=>{if(!addedCal){addEntry(r.name,r.nutrition);setAddedCal(true);setTimeout(()=>setAddedCal(false),2500);}}}>{addedCal?"✅ Logged!":"➕ Log This Meal"}</button>
                  </div>
                )}
              </div>
            ))}
          </>)}

          {foodSect==="nutrition"&&(<>
            <div style={s.card}>
              <div style={s.h2}>🔥 Today's Nutrition</div>
              {myTracked.map(key=>{
                const m=ALL_MACROS.find(x=>x.key===key); if(!m)return null;
                const val=todayTotals[key]||0; const goal=myNutGoals[key]||1; const pct=(val/goal)*100;
                return(<div key={key} style={{marginBottom:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"13px",marginBottom:"3px"}}>
                    <span style={{fontWeight:"bold",color:m.color}}>{m.label}</span>
                    <span>{val}{m.unit} <span style={{color:T.sub}}>/ {goal}{m.unit}</span></span>
                  </div>
                  <div style={s.pbar}><div style={s.pfil(pct,m.color)}/></div>
                </div>);
              })}
            </div>
            <div style={s.card}>
              <div style={s.h2}>🔍 AI Nutrition Lookup</div>
              <div style={{...s.row,marginBottom:"8px"}}>
                <input style={{...s.inp,flex:1}} placeholder="322g white rice, 1 banana..." value={nutQuery} onChange={e=>setNutQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")lookupNutrition(nutQuery);}}/>
                <button style={s.btnSm} onClick={()=>lookupNutrition(nutQuery)} disabled={nutAiLoad}>{nutAiLoad?"⏳":"🔍"}</button>
              </div>
              {nutAiResult&&!nutAiResult.error&&(
                <div style={{background:activeBg,borderRadius:"12px",padding:"14px",border:`1px solid ${T.border}`}}>
                  <div style={{fontWeight:"bold",fontSize:"15px",marginBottom:"2px"}}>{nutAiResult.food}</div>
                  <div style={{color:T.sub,fontSize:"12px",marginBottom:"10px"}}>{nutAiResult.serving}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px",marginBottom:"10px"}}>
                    {ALL_MACROS.map(m=>(<div key={m.key} style={{display:"flex",justifyContent:"space-between",padding:"4px 8px",background:T.card,borderRadius:"8px"}}><span style={{fontSize:"11px",color:T.sub}}>{m.label}</span><span style={{fontSize:"12px",fontWeight:"bold",color:m.color}}>{nutAiResult[m.key]||0}{m.unit}</span></div>))}
                  </div>
                  <button style={{...s.btn,width:"100%"}} onClick={()=>{addEntry(nutAiResult.food,nutAiResult);setNutAiResult(null);setNutQuery("");}}>➕ Log This</button>
                </div>
              )}
              {nutAiResult?.error&&<div style={{color:"#ef4444",fontSize:"13px"}}>Couldn't find that — try being more specific!</div>}
            </div>
            <div style={s.card}>
              <div style={s.h2}>✏️ Log Manually</div>
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                <input style={s.inp} placeholder="Food name..." value={logLabel} onChange={e=>setLogLabel(e.target.value)}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                  {ALL_MACROS.map(m=>(<div key={m.key}><div style={{fontSize:"10px",color:m.color,marginBottom:"2px"}}>{m.label} ({m.unit})</div><input style={{...s.inp,padding:"6px 10px",fontSize:"12px"}} type="number" placeholder="0" value={logNut[m.key]||""} onChange={e=>setLogNut(n=>({...n,[m.key]:e.target.value?parseInt(e.target.value):0}))}/></div>))}
                </div>
                <button style={s.btn} onClick={()=>{if(!logLabel.trim())return;addEntry(logLabel,logNut);setLogLabel("");setLogNut({});}}>Add to Log</button>
              </div>
            </div>
            {todayLog.length>0&&(
              <div style={s.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                  <div style={s.h2}>📋 Today's Log</div>
                  <button style={{...s.btnO,fontSize:"11px",padding:"4px 8px"}} onClick={()=>saveNut({...myNut,[todayKey()]:[]})}>Clear</button>
                </div>
                {todayLog.map((e,i)=>(<div key={e.id||i} style={s.irow}><div><div style={{fontWeight:"bold",fontSize:"13px"}}>{e.label}</div><div style={{fontSize:"10px",color:T.sub}}>{e.time}</div></div><span onClick={()=>removeEntry(e.id)} style={{color:T.sub,cursor:"pointer",fontSize:"20px"}}>×</span></div>))}
              </div>
            )}
          </>)}

          {foodSect==="myfoods"&&(
            <div style={s.card}>
              <div style={s.h2}>🥩 My Food Database</div>
              <div style={{color:T.sub,fontSize:"12px",marginBottom:"12px"}}>Search any food — save it forever for quick logging!</div>
              <div style={{...s.row,marginBottom:"10px"}}>
                <input style={{...s.inp,flex:1}} placeholder="Search: ox tail, muenster, tamales..." value={nutQuery} onChange={e=>setNutQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")lookupNutrition(nutQuery);}}/>
                <button style={s.btnSm} onClick={()=>lookupNutrition(nutQuery)} disabled={nutAiLoad}>{nutAiLoad?"⏳":"🔍"}</button>
              </div>
              {nutAiResult&&!nutAiResult.error&&(
                <div style={{background:activeBg,borderRadius:"12px",padding:"12px",border:`1px solid ${T.border}`,marginBottom:"10px"}}>
                  <div style={{fontWeight:"bold",fontSize:"14px"}}>{nutAiResult.food}</div>
                  <div style={{fontSize:"11px",color:T.sub,marginBottom:"8px"}}>{nutAiResult.serving}</div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}>
                    {ALL_MACROS.slice(0,4).map(m=>(<span key={m.key} style={{background:T.card,borderRadius:"8px",padding:"3px 8px",fontSize:"11px",color:m.color}}>{m.label}: {nutAiResult[m.key]||0}{m.unit}</span>))}
                  </div>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button style={{...s.btn,flex:1,fontSize:"12px"}} onClick={()=>{addEntry(nutAiResult.food,nutAiResult);const u=[{label:nutAiResult.food,nutrition:nutAiResult,id:Date.now()},...recentFoods.filter(f=>f.label!==nutAiResult.food)].slice(0,20);setRecentFoods(u);store.set("recentFoods",u);setNutAiResult(null);setNutQuery("");}}>➕ Log</button>
                    <button style={{...s.btnO,flex:1,fontSize:"12px"}} onClick={()=>{const u=[...customFoods.filter(f=>f.name!==nutAiResult.food),{name:nutAiResult.food,...nutAiResult}];setCustomFoods(u);store.set("customFoods",u);setNutAiResult(null);setNutQuery("");}}>💾 Save</button>
                  </div>
                </div>
              )}
              {recentFoods.length>0&&(<div><div style={s.h3}>Recent</div>{recentFoods.slice(0,5).map((f,i)=>(<div key={i} style={s.irow}><span style={{fontSize:"13px"}}>{f.label}</span><button style={{...s.btnSm,fontSize:"11px"}} onClick={()=>addEntry(f.label,f.nutrition)}>+Log</button></div>))}</div>)}
              {customFoods.length>0&&(<div style={{marginTop:"12px"}}><div style={s.h3}>Saved Foods</div>{customFoods.map((f,i)=>(<div key={i} style={s.irow}><span style={{fontSize:"13px"}}>{f.name}</span><div style={{display:"flex",gap:"6px"}}><button style={{...s.btnSm,fontSize:"11px"}} onClick={()=>addEntry(f.name,f)}>+Log</button><span onClick={()=>{const u=customFoods.filter((_,j)=>j!==i);setCustomFoods(u);store.set("customFoods",u);}} style={{color:T.sub,cursor:"pointer",fontSize:"18px"}}>×</span></div></div>))}</div>)}
            </div>
          )}

          {foodSect==="email"&&isAdmin&&(
            <div style={{...s.card,borderLeft:"4px solid #8b5cf6"}}>
              <div style={{fontSize:"16px",fontWeight:"bold",color:"#8b5cf6",marginBottom:"10px"}}>🤖 Email → Calendar</div>
              <div style={{color:T.sub,fontSize:"12px",marginBottom:"10px"}}>Paste any email with an appointment — AI extracts it!</div>
              <textarea style={s.txa} placeholder="Paste email text here..." value={aiEmail} onChange={e=>setAiEmail(e.target.value)}/>
              <button style={{...s.btn,background:"#8b5cf6",width:"100%",marginTop:"10px"}} onClick={parseEmail} disabled={aiEmailLoad}>{aiEmailLoad?"🤖 Reading...":"🤖 Extract Appointment"}</button>
              {aiEmailRes&&!aiEmailRes.error&&(
                <div style={{background:activeBg,borderRadius:"12px",padding:"12px",marginTop:"10px"}}>
                  {[["Title",aiEmailRes.title],["Date",aiEmailRes.date],["Time",aiEmailRes.time],["Note",aiEmailRes.note]].map(([k,v])=>v?<div key={k} style={{fontSize:"13px",marginBottom:"4px"}}><span style={{color:T.sub}}>{k}: </span><b>{v}</b></div>:null)}
                  <button style={{...s.btn,width:"100%",marginTop:"10px"}} onClick={()=>{saveEvent({...aiEmailRes,assignedTo:"",recurrence:"once",days:[]});setAiEmailRes(null);setAiEmail("");}}>📅 Add to Calendar</button>
                </div>
              )}
              {aiEmailRes?.error&&<div style={{color:"#ef4444",fontSize:"13px",marginTop:"8px"}}>Couldn't extract — try pasting more of the email!</div>}
            </div>
          )}
        </>)}

        {/* ══════════════════════════════════════
            KIDS TAB
        ══════════════════════════════════════ */}
        {tab==="kids"&&(<>
          {/* Call buttons */}
          {isKid&&(
            <div style={{...s.card,textAlign:"center"}}>
              <div style={s.h2}>📞 Need someone?</div>
              <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
                {contactNumbers.dadPhone&&(
                  <a href={`tel:${contactNumbers.dadPhone}`} style={{flex:1,background:"linear-gradient(135deg,#f59e0b,#fb923c)",borderRadius:"14px",padding:"20px 8px",textDecoration:"none",color:"#000",fontWeight:"bold",fontSize:"14px",display:"flex",flexDirection:"column",alignItems:"center",gap:"6px"}}>
                    <span style={{fontSize:"36px"}}>👑</span>Call Dada
                  </a>
                )}
                {contactNumbers.momPhone&&(
                  <a href={`tel:${contactNumbers.momPhone}`} style={{flex:1,background:"linear-gradient(135deg,#a78bfa,#e040fb)",borderRadius:"14px",padding:"20px 8px",textDecoration:"none",color:"#fff",fontWeight:"bold",fontSize:"14px",display:"flex",flexDirection:"column",alignItems:"center",gap:"6px"}}>
                    <span style={{fontSize:"36px"}}>💜</span>Call Mom
                  </a>
                )}
                {!contactNumbers.dadPhone&&!contactNumbers.momPhone&&<div style={{color:T.sub,fontSize:"12px",width:"100%",padding:"10px"}}>Ask a parent to add phone numbers in Settings 📱</div>}
              </div>
            </div>
          )}

          {/* Game launcher */}
          <div style={{...s.card,textAlign:"center",background:"linear-gradient(135deg,#030712,#1a0a2e)",border:`1px solid #f59e0b44`}}>
            <div style={{fontSize:"40px",marginBottom:"6px"}}>👑</div>
            <div style={{fontSize:"18px",fontWeight:"bold",background:"linear-gradient(135deg,#f59e0b,#f43f5e,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"2px",marginBottom:"4px"}}>LUCAC LEGENDS</div>
            <button onClick={()=>setShowGame(true)} style={{background:"linear-gradient(135deg,#f59e0b,#f97316)",border:"none",borderRadius:"12px",padding:"12px 36px",fontSize:"16px",fontWeight:"bold",color:"#000",cursor:"pointer",width:"100%"}}>▶ PLAY</button>
          </div>

          {/* Add kid */}
          {isAdmin&&(
            <div style={s.card}>
              <div style={s.h2}>⭐ Add a Kid</div>
              <div style={s.row}>
                <input style={{...s.inp,flex:2}} placeholder="Kid's name..." value={kidName} onChange={e=>setKidName(e.target.value)}/>
                <input style={{...s.inp,flex:1,maxWidth:"60px"}} placeholder="😀" value={kidEmoji} onChange={e=>setKidEmoji(e.target.value)}/>
                <button style={s.btn} onClick={()=>{if(!kidName.trim())return;addKid({id:Date.now(),name:kidName,emoji:kidEmoji||"🧒",points:0,tasks:[]});setKidName("");setKidEmoji("🧒");}}>Add</button>
              </div>
            </div>
          )}

          {kids.filter(k=>isKid?k.name===current?.name:true).map(kid=>{
            const kc=getColor(kid.name,personColors); const lvl=Math.floor((kid.points||0)/100); const prog=(kid.points||0)%100;
            return(
              <div key={kid.fbKey||kid.id} style={{...s.card,borderLeft:`4px solid ${kc}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                    <span style={{fontSize:"28px"}}>{kid.emoji}</span>
                    <div><div style={{fontSize:"16px",fontWeight:"bold",color:kc}}>{kid.name}</div><div style={{fontSize:"11px",color:T.sub}}>🏆 Level {lvl} · {kid.points||0} pts</div></div>
                  </div>
                  <div style={{background:kc,color:"#000",borderRadius:"20px",padding:"4px 12px",fontWeight:"bold",fontSize:"13px"}}>⭐ {kid.points||0}</div>
                </div>
                <div style={{marginBottom:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:T.sub,marginBottom:"3px"}}><span>Next reward</span><span>{prog}/100</span></div>
                  <div style={s.pbar}><div style={s.pfil(prog,kc)}/></div>
                </div>
                {isAdmin&&(
                  <div style={{...s.row,marginBottom:"10px"}}>
                    <input style={{...s.inp,flex:3}} placeholder="Add task..." value={activeKid===kid.fbKey?taskText:""} onChange={e=>{setTaskText(e.target.value);setActiveKid(kid.fbKey);}}/>
                    <input style={{...s.inp,flex:1,maxWidth:"52px"}} type="number" placeholder="pts" value={activeKid===kid.fbKey?taskPts:"10"} onChange={e=>{setTaskPts(e.target.value);setActiveKid(kid.fbKey);}}/>
                    <button style={s.btnSm} onClick={()=>{if(!taskText.trim())return;updateKid(kid.fbKey,{...kid,tasks:[...(kid.tasks||[]),{text:taskText,done:false,pts:parseInt(taskPts)||10,id:Date.now()}]});setTaskText("");setTaskPts("10");}}>+</button>
                  </div>
                )}
                {(kid.tasks||[]).map((task,ti)=>(
                  <div key={task.id||ti} style={s.irow}>
                    <span style={{fontSize:"13px",textDecoration:task.done?"line-through":"none",flex:1,color:task.done?T.sub:T.text}}>{task.text}</span>
                    {!task.done
                      ?<button style={{...s.btnSm,background:kc,color:"#000"}} onClick={()=>updateKid(kid.fbKey,{...kid,points:(kid.points||0)+(task.pts||10),tasks:(kid.tasks||[]).map((t,j)=>j===ti?{...t,done:true}:t)})}>✓ +{task.pts||10}</button>
                      :<span style={{color:kc,fontSize:"11px"}}>✅ Done!</span>
                    }
                  </div>
                ))}
                {isAdmin&&(
                  <div style={{display:"flex",gap:"6px",marginTop:"12px"}}>
                    <button style={{...s.btnO,fontSize:"11px"}} onClick={()=>updateKid(kid.fbKey,{...kid,points:0,tasks:(kid.tasks||[]).map(t=>({...t,done:false}))})}>Reset</button>
                    <button style={{...s.btnO,fontSize:"11px",borderColor:"#ef4444",color:"#ef4444"}} onClick={()=>removeKid(kid.fbKey)}>Remove</button>
                  </div>
                )}
              </div>
            );
          })}
        </>)}

        {/* ══════════════════════════════════════
            CO-PARENT TAB
        ══════════════════════════════════════ */}
        {tab==="coparent"&&(<>
          {(()=>{
            const dow=new Date().getDay();
            const isMomDay=custody.momDays?.includes(dow);
            const isDadDay=custody.dadDays?.includes(dow);
            const who=isMomDay?"Mom's Day 💜":isDadDay?"Dad's Day 👑":"Shared Day 🤝";
            const col=isMomDay?"#a78bfa":isDadDay?"#f59e0b":"#4ade80";
            return(
              <div style={{...s.card,borderLeft:`4px solid ${col}`,background:`${col}18`}}>
                <div style={{fontWeight:"bold",fontSize:"20px",color:col}}>{who}</div>
                <div style={{fontSize:"13px",color:T.sub,marginTop:"4px"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
                <div style={{display:"flex",gap:"16px",marginTop:"10px",fontSize:"12px",color:T.sub}}>
                  <span>😴 Yana: {custody.bedtimeYana||"8:00 PM"}</span>
                  <span>😴 Luca: {custody.bedtimeLuca||"8:00 PM"}</span>
                </div>
              </div>
            );
          })()}

          <div style={s.card}>
            <div style={s.h2}>📅 Weekly Schedule</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px"}}>
              {DAYS.map((d,i)=>{
                const isMom=custody.momDays?.includes(i); const isDad=custody.dadDays?.includes(i);
                const col=isMom?"#a78bfa":isDad?"#f59e0b":T.border; const isToday=new Date().getDay()===i;
                return(
                  <div key={i} style={{textAlign:"center",padding:"8px 2px",borderRadius:"8px",background:`${col}22`,border:`2px solid ${isToday?col:T.border}`}}>
                    <div style={{fontSize:"10px",fontWeight:"bold",color:col}}>{d}</div>
                    <div style={{fontSize:"10px",color:T.sub,marginTop:"2px"}}>{isMom?"Mom":isDad?"Dad":"—"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={s.card}>
            <div style={s.h2}>📋 Shared Rules</div>
            {coRules.length===0&&<div style={{color:T.sub,fontSize:"13px",padding:"12px",textAlign:"center"}}>No shared rules yet</div>}
            {coRules.map((rule,i)=>(
              <div key={i} style={s.irow}>
                <span style={{fontSize:"13px",flex:1}}>{rule.text}</span>
                <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                  {rule.status==="pending"&&isAdmin&&(<>
                    <button style={{...s.btnSm,background:"#4ade80",color:"#000",fontSize:"11px"}} onClick={()=>fbSet(`coRules/${rule.fbKey}`,{...rule,status:"approved"})}>✓</button>
                    <button style={{...s.btnSm,background:"#ef4444",fontSize:"11px"}} onClick={()=>fbSet(`coRules/${rule.fbKey}`,{...rule,status:"rejected"})}>✗</button>
                  </>)}
                  <span style={{fontSize:"10px",color:rule.status==="approved"?"#4ade80":rule.status==="rejected"?"#ef4444":"#f59e0b"}}>{rule.status||"pending"}</span>
                </div>
              </div>
            ))}
            <div style={{...s.row,marginTop:"10px"}}>
              <input style={{...s.inp,flex:1}} placeholder="Add a shared rule..." value={newRule} onChange={e=>setNewRule(e.target.value)}/>
              <button style={s.btn} onClick={()=>{if(!newRule.trim())return;fbPush("coRules",{text:newRule,status:"pending",addedBy:current?.name,date:todayKey()});setNewRule("");}}>+</button>
            </div>
          </div>

          {isAdmin&&(
            <div style={{...s.card,borderLeft:"4px solid #ef4444"}}>
              <div style={{fontSize:"15px",fontWeight:"bold",color:"#ef4444",marginBottom:"10px"}}>⏱ Exchange Log <span style={{fontSize:"10px",color:T.sub,fontWeight:"normal"}}>🔒 Private</span></div>
              {!exchTimer
                ?<button style={{...s.btn,width:"100%",background:"#4ade80",color:"#000"}} onClick={()=>setExchTimer({start:new Date().toISOString()})}>⏱ Start — I'm Waiting Now</button>
                :<div>
                  <div style={{background:"#0f2010",borderRadius:"10px",padding:"10px",marginBottom:"8px"}}>
                    <div style={{color:"#4ade80",fontWeight:"bold"}}>⏱ Timer running...</div>
                    <div style={{fontSize:"12px",color:T.sub}}>Started: {new Date(exchTimer.start).toLocaleTimeString()}</div>
                  </div>
                  <input style={{...s.inp,marginBottom:"8px"}} placeholder="Notes (optional)..." value={exchNote} onChange={e=>setExchNote(e.target.value)}/>
                  <button style={{...s.btn,width:"100%"}} onClick={()=>{
                    const arrived=new Date().toISOString();
                    const mins=Math.round((new Date(arrived)-new Date(exchTimer.start))/60000);
                    fbPush("exchangeLog",{startTime:exchTimer.start,arrivedTime:arrived,minutesWaited:mins,note:exchNote,loggedBy:current?.name,date:todayKey()});
                    setExchTimer(null);setExchNote("");
                  }}>✅ They Arrived — Log It</button>
                </div>
              }
              {exchangeLog.length>0&&(
                <div style={{marginTop:"12px"}}>
                  <div style={s.h3}>Recent Logs</div>
                  {[...exchangeLog].sort((a,b)=>new Date(b.startTime)-new Date(a.startTime)).slice(0,6).map((log,i)=>(
                    <div key={i} style={{background:activeBg,borderRadius:"8px",padding:"8px",marginBottom:"4px"}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <div style={{fontSize:"12px",fontWeight:"bold"}}>{fmtDate(log.date)}</div>
                        <div style={{fontSize:"12px",color:log.minutesWaited>5?"#ef4444":"#4ade80",fontWeight:"bold"}}>{log.minutesWaited} min wait</div>
                      </div>
                      <div style={{fontSize:"10px",color:T.sub}}>{new Date(log.startTime).toLocaleTimeString()} → {new Date(log.arrivedTime).toLocaleTimeString()}</div>
                      {log.note&&<div style={{fontSize:"11px",marginTop:"2px"}}>{log.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>)}

        {/* ══════════════════════════════════════
            SETTINGS TAB
        ══════════════════════════════════════ */}
        {tab==="settings"&&(
          <div style={s.card}>
            <div style={s.h2}>⚙️ Settings</div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"16px"}}>
              {[["profile","👤 Profile"],["customize","🎨 Look"],["contacts","📞 Contacts"],["colors","🖌️ Colors"],["nutrition","🔥 Nutrition"],["alerts","🔔 Alerts"],["family","👨‍👩‍👧‍👦 Family"],["info","ℹ️ Info"]].map(([id,lbl])=>(
                <button key={id} style={{...s.btnO,background:subSet===id?T.accent:"none",color:subSet===id?T.bg:T.accent,fontSize:"11px",padding:"5px 10px"}} onClick={()=>setSubSet(id)}>{lbl}</button>
              ))}
            </div>

            {subSet==="profile"&&(
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                <div style={s.h3}>Display Name</div>
                <input style={s.inp} value={sDName} onChange={e=>setSDName(e.target.value)} placeholder="Your name..."/>
                <div style={s.h3}>Change PIN (4–6 digits)</div>
                <input style={s.inp} type="password" maxLength={6} placeholder="New PIN..." value={sDPin} onChange={e=>setSDPin(e.target.value.replace(/\D/g,""))}/>
                <button style={{...s.btn,background:sSaved?"#4ade80":T.accent,color:sSaved?"#000":T.bg}} onClick={()=>{
                  let u=profiles;
                  if(sDName.trim()) u=u.map(p=>p.id===current.id?{...p,name:sDName.trim()}:p);
                  if(sDPin.length>=4) u=u.map(p=>p.id==="admin"?{...p,pin:sDPin}:p);
                  saveProfiles(u); setSSaved(true); setTimeout(()=>setSSaved(false),2000);
                }}>{sSaved?"✅ Saved!":"💾 Save Changes"}</button>
              </div>
            )}

            {subSet==="customize"&&(
              <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
                <div>
                  <div style={s.h3}>Font Size</div>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                    {[["Small",0.85],["Normal",1],["Large",1.15],["XL",1.3]].map(([lbl,val])=>(<span key={val} style={s.tag(lFont===val)} onClick={()=>setLFont(val)}>{lbl}</span>))}
                  </div>
                </div>
                <div>
                  <div style={s.h3}>Card Padding</div>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                    {[["Compact","compact"],["Normal","normal"],["Spacious","spacious"],["Giant","giant"]].map(([lbl,val])=>(<span key={val} style={s.tag(lCard===val)} onClick={()=>setLCard(val)}>{lbl}</span>))}
                  </div>
                </div>
                <div>
                  <div style={s.h3}>Background Color</div>
                  <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                    <input type="color" value={lBg||T.bg} onChange={e=>setLBg(e.target.value)} style={{width:"44px",height:"36px",borderRadius:"8px",border:"none",cursor:"pointer"}}/>
                    <span style={{fontSize:"12px",color:T.sub}}>Custom background</span>
                    {lBg&&<button style={{...s.btnO,fontSize:"11px",padding:"3px 8px"}} onClick={()=>setLBg("")}>Clear</button>}
                  </div>
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button style={{...s.btn,flex:1,background:cSaved?"#4ade80":T.accent,color:cSaved?"#000":T.bg}} onClick={()=>{saveCustom({fontSize:lFont,bg:lBg||null,cardSize:lCard});setCSaved(true);setTimeout(()=>setCSaved(false),2000);}}>{cSaved?"✅ Saved!":"💾 Save"}</button>
                  <button style={{...s.btnO,fontSize:"12px"}} onClick={()=>{revertCustom();setLFont(1);setLBg("");setLCard("normal");}}>↩ Reset</button>
                </div>
              </div>
            )}

            {subSet==="contacts"&&(
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                <div style={s.h3}>Dada's Phone Number (for kids' call button)</div>
                <input style={s.inp} type="tel" placeholder="Dad's number..." value={sDad} onChange={e=>setSDad(e.target.value)}/>
                <div style={s.h3}>Mom's Phone Number (for kids' call button)</div>
                <input style={s.inp} type="tel" placeholder="Mom's number..." value={sMom} onChange={e=>setSMom(e.target.value)}/>
                <button style={{...s.btn,background:coSaved?"#4ade80":T.accent,color:coSaved?"#000":T.bg}} onClick={()=>{saveContacts({dadPhone:sDad,momPhone:sMom});setCoSaved(true);setTimeout(()=>setCoSaved(false),2000);}}>{coSaved?"✅ Saved!":"💾 Save Numbers"}</button>
              </div>
            )}

            {subSet==="colors"&&(
              <div>
                <div style={s.h3}>Color code each person</div>
                {profiles.map(p=>(<div key={p.id} style={s.irow}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}><div style={{width:"26px",height:"26px",borderRadius:"50%",background:getColor(p.name,personColors)}}/><span>{p.emoji} {p.name}</span></div>
                  <input type="color" value={getColor(p.name,personColors)} onChange={e=>saveColor(p.name,e.target.value)} style={{width:"38px",height:"30px",borderRadius:"8px",border:"none",cursor:"pointer"}}/>
                </div>))}
                <div style={{color:T.sub,fontSize:"11px",marginTop:"8px"}}>Colors sync to all devices instantly 🎨</div>
              </div>
            )}

            {subSet==="nutrition"&&(
              <div>
                <div style={s.h3}>Track these macros</div>
                <div style={{marginBottom:"14px"}}>{ALL_MACROS.map(m=>(<span key={m.key} style={s.tag(myTracked.includes(m.key),m.color)} onClick={()=>updateTracked(m.key)}>{m.label}</span>))}</div>
                <div style={s.h3}>Daily Goals</div>
                {ALL_MACROS.filter(m=>myTracked.includes(m.key)).map(m=>(<div key={m.key} style={{...s.row,marginBottom:"8px",alignItems:"center"}}>
                  <span style={{color:m.color,fontSize:"12px",minWidth:"72px"}}>{m.label}</span>
                  <input style={{...s.inp,flex:1}} type="number" value={myNutGoals[m.key]||""} onChange={e=>updateGoal(m.key,e.target.value)}/>
                  <span style={{color:T.sub,fontSize:"11px",minWidth:"28px"}}>{m.unit}</span>
                </div>))}
                <button style={{...s.btn,width:"100%",background:nSaved?"#4ade80":T.accent,color:nSaved?"#000":T.bg,marginTop:"8px"}} onClick={()=>{setNSaved(true);setTimeout(()=>setNSaved(false),2000);}}>{nSaved?"✅ Saved!":"💾 Save Goals"}</button>
              </div>
            )}

            {subSet==="alerts"&&(
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                <div style={s.h3}>Remind me before calendar events</div>
                {!notifOn
                  ?<button style={s.btn} onClick={enableNotif}>🔔 Turn On Reminders</button>
                  :<div style={{background:"#0f2010",borderRadius:"10px",padding:"10px",color:"#4ade80",fontSize:"13px"}}>✅ Reminders are ON!</div>
                }
                <div>
                  <div style={s.h3}>How early?</div>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                    {[5,10,15,30,60].map(m=>(<span key={m} style={s.tag(remindMins===m)} onClick={()=>{setRemindMins(m);store.set("remindMins",m);}}>{m} min</span>))}
                  </div>
                </div>
              </div>
            )}

            {subSet==="family"&&(
              <div>
                <div style={s.h3}>Add Family Member</div>
                <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"14px"}}>
                  <input style={s.inp} placeholder="Name..." value={newPName} onChange={e=>setNewPName(e.target.value)}/>
                  <div style={s.row}>
                    <input style={{...s.inp,flex:1}} placeholder="Emoji 😊" value={newPEmoji} onChange={e=>setNewPEmoji(e.target.value)}/>
                    <select style={{...s.inp,flex:1}} value={newPType} onChange={e=>setNewPType(e.target.value)}><option value="family">Family</option><option value="kid">Kid</option></select>
                  </div>
                  <button style={{...s.btn,background:fSaved?"#4ade80":T.accent,color:fSaved?"#000":T.bg}} onClick={()=>{
                    if(!newPName.trim())return;
                    saveProfiles([...profiles,{id:`p_${Date.now()}`,name:newPName,emoji:newPEmoji||"😊",type:newPType}]);
                    setNewPName("");setNewPEmoji("😊");setFSaved(true);setTimeout(()=>setFSaved(false),2000);
                  }}>{fSaved?"✅ Added!":"Add Member"}</button>
                </div>
                {profiles.map((p,i)=>(<div key={i} style={s.irow}>
                  <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                    <div style={{width:"26px",height:"26px",borderRadius:"50%",background:getColor(p.name,personColors),display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px"}}>{p.emoji}</div>
                    <div><div style={{fontSize:"13px",fontWeight:"bold"}}>{p.name}</div><div style={{fontSize:"11px",color:T.sub}}>{p.type}</div></div>
                  </div>
                  {p.id!=="admin"&&<span onClick={()=>saveProfiles(profiles.filter((_,idx)=>idx!==i))} style={{color:T.sub,cursor:"pointer",fontSize:"20px"}}>×</span>}
                </div>))}
              </div>
            )}

            {subSet==="info"&&(
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {[
                  ["👑","LUCAC Life v12 — Dashboard Edition"],
                  ["📅","Big calendar — tap any day to add events"],
                  ["✅","Routines + Goals side by side on home"],
                  ["⚡","Firebase real-time sync — all devices"],
                  ["🌐","Groq AI + Tavily web search"],
                  ["👨‍🍳","AI Fridge Chef"],
                  ["📧","Email → Calendar AI extraction"],
                  ["🎮","LUCAC LEGENDS — 5 worlds, 25 levels"],
                  ["💙","Built for Yana 🌸, Luca ⚔️ & Dada 👑"],
                  ["🏢","Lucac LLC"],
                ].map(([icon,v])=>(<div key={icon} style={{background:activeBg,borderRadius:"10px",padding:"10px",display:"flex",gap:"8px",alignItems:"center"}}><span style={{fontSize:"18px"}}>{icon}</span><span style={{fontSize:"13px"}}>{v}</span></div>))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* FLOATING AI BUTTON */}
      <div style={{position:"fixed",bottom:"90px",right:"16px",zIndex:150}}>
        <button onClick={()=>setShowAI(x=>!x)} style={{width:"52px",height:"52px",borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},#8b5cf6)`,border:"none",fontSize:"22px",cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {showAI?"✕":"🤖"}
        </button>
      </div>

      {/* AI CHAT PANEL */}
      {showAI&&(
        <div style={{position:"fixed",bottom:"154px",right:"12px",left:"12px",zIndex:149,background:T.card,border:`1px solid ${T.border}`,borderRadius:"18px",boxShadow:"0 10px 40px rgba(0,0,0,0.5)",display:"flex",flexDirection:"column",maxHeight:"380px"}}>
          <div style={{padding:"12px 14px",borderBottom:`1px solid ${T.border}`,fontWeight:"bold",color:T.accent,fontSize:"14px"}}>🤖 LUCAC AI {TAVILY_KEY?"🌐":""}</div>
          <div style={{flex:1,overflowY:"auto",padding:"10px",display:"flex",flexDirection:"column",gap:"6px",maxHeight:"240px"}}>
            {aiChat.length===0&&<div style={{color:T.sub,fontSize:"12px",textAlign:"center",padding:"16px"}}>Ask me anything!<br/>"Weather today?" · "Lawyer near me?" · "What can Luca eat?"</div>}
            {aiChat.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}><div style={{background:m.role==="user"?T.accent:activeBg,color:m.role==="user"?T.bg:T.text,borderRadius:"12px",padding:"7px 11px",maxWidth:"80%",fontSize:"13px",lineHeight:1.5}}>{m.content}</div></div>))}
            {aiChatLoad&&<div style={{color:T.sub,fontSize:"12px"}}>🤖 thinking...</div>}
          </div>
          <div style={{padding:"8px",borderTop:`1px solid ${T.border}`,display:"flex",gap:"6px"}}>
            <input style={{...s.inp,flex:1,padding:"8px 12px"}} placeholder="Ask anything..." value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendAIChat(aiInput);}}/>
            <button style={{...s.btnSm,flexShrink:0}} onClick={()=>sendAIChat(aiInput)} disabled={aiChatLoad}>Send</button>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav style={s.nav}>
        {tabs.map(t=>(
          <button key={t.id} style={s.nBtn(tab===t.id)} onClick={()=>setTab(t.id)}>
            <span style={{fontSize:"20px"}}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
