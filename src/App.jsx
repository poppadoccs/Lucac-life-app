import { useState, useEffect, useRef, useCallback } from "react";
import LucacLegends from "./LucacLegends";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, push, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://REPLACE_WITH_YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

let db;
try { const app = initializeApp(firebaseConfig); db = getDatabase(app); } catch(e) {}

const fbSet    = async (p, v) => { try { if(db) await set(ref(db,p),v); } catch(e) {} };
const fbPush   = async (p, v) => { try { if(db) { const r=await push(ref(db,p),v); return r.key; } } catch(e) {} return Date.now().toString(); };
const fbDel    = async (p)    => { try { if(db) await remove(ref(db,p)); } catch(e) {} };
const fbListen = (p, cb)      => { try { if(db) onValue(ref(db,p), s=>cb(s.val())); } catch(e) {} };

const THEMES = {
  midnight: { bg:"#0f0f1a", card:"#1a1a2e", accent:"#f59e0b", text:"#f1f5f9", sub:"#94a3b8", border:"#2d2d4e", label:"Midnight" },
  ocean:    { bg:"#0c1445", card:"#132057", accent:"#38bdf8", text:"#f0f9ff", sub:"#93c5fd", border:"#1e3a8a", label:"Ocean" },
  forest:   { bg:"#0d1f12", card:"#132a1a", accent:"#4ade80", text:"#f0fdf4", sub:"#86efac", border:"#166534", label:"Forest" },
  rose:     { bg:"#1a0a10", card:"#2a1020", accent:"#f43f5e", text:"#fff1f2", sub:"#fda4af", border:"#9f1239", label:"Rose" },
  violet:   { bg:"#0f0a1e", card:"#1a1030", accent:"#a78bfa", text:"#f5f3ff", sub:"#c4b5fd", border:"#4c1d95", label:"Violet" },
  sunset:   { bg:"#1a0f00", card:"#2a1a00", accent:"#fb923c", text:"#fff7ed", sub:"#fdba74", border:"#9a3412", label:"Sunset" },
  arctic:   { bg:"#f0f9ff", card:"#ffffff", accent:"#0ea5e9", text:"#0c4a6e", sub:"#475569", border:"#bae6fd", label:"Arctic" },
  graphite: { bg:"#111111", card:"#1c1c1c", accent:"#e2e8f0", text:"#f8fafc", sub:"#64748b", border:"#2d2d2d", label:"Graphite" },
  cherry:   { bg:"#1a0008", card:"#2a0012", accent:"#ff6b9d", text:"#fff0f5", sub:"#ffb3d1", border:"#8b0032", label:"Cherry" },
  gold:     { bg:"#0f0a00", card:"#1a1400", accent:"#ffd700", text:"#fffde7", sub:"#ffe066", border:"#7a6000", label:"Gold" },
  emerald:  { bg:"#001a0a", card:"#002914", accent:"#00e676", text:"#f0fff5", sub:"#69f0ae", border:"#006622", label:"Emerald" },
  crimson:  { bg:"#1a0000", card:"#2a0000", accent:"#ff1744", text:"#fff5f5", sub:"#ff8a80", border:"#7f0000", label:"Crimson" },
  sky:      { bg:"#e8f4fd", card:"#ffffff", accent:"#0288d1", text:"#01234e", sub:"#546e7a", border:"#b3d9f7", label:"Sky" },
  slate:    { bg:"#0f1923", card:"#1a2840", accent:"#64b5f6", text:"#e3f2fd", sub:"#78909c", border:"#1e3a5f", label:"Slate" },
  coral:    { bg:"#1a0a05", card:"#2a1510", accent:"#ff7043", text:"#fff3ef", sub:"#ffab91", border:"#8b3a20", label:"Coral" },
  mint:     { bg:"#f0fdf8", card:"#ffffff", accent:"#00bfa5", text:"#003d33", sub:"#607d8b", border:"#b2dfdb", label:"Mint" },
  neon:     { bg:"#000000", card:"#0a0a0a", accent:"#39ff14", text:"#f0fff0", sub:"#00ff41", border:"#003300", label:"Neon" },
  purple:   { bg:"#0d0015", card:"#1a0030", accent:"#e040fb", text:"#fdf0ff", sub:"#ce93d8", border:"#4a0060", label:"Purple" },
  navy:     { bg:"#000a1a", card:"#001433", accent:"#4fc3f7", text:"#e3f2fd", sub:"#81d4fa", border:"#003366", label:"Navy" },
  autumn:   { bg:"#1a0800", card:"#2a1200", accent:"#ff8f00", text:"#fff8e1", sub:"#ffcc02", border:"#7a3800", label:"Autumn" },
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
  { name:"Scrambled Eggs",    ingredients:["eggs","butter","salt"],         nutrition:{calories:220,protein:18,carbs:2, fat:16,fiber:0,sugar:1, sodium:320}, steps:["Crack 3 eggs, whisk with salt","Melt butter on medium","Stir gently until fluffy"] },
  { name:"Pasta with Butter", ingredients:["pasta","butter","salt"],        nutrition:{calories:380,protein:10,carbs:62,fat:12,fiber:3,sugar:2, sodium:280}, steps:["Boil salted water","Cook pasta 8-10 min","Drain and toss with butter"] },
  { name:"Chicken Stir Fry",  ingredients:["chicken","onion","oil","salt"], nutrition:{calories:310,protein:35,carbs:8, fat:15,fiber:2,sugar:4, sodium:420}, steps:["Cut chicken into strips","Cook in hot oil 5-6 min","Add onion, season"] },
  { name:"Grilled Cheese",    ingredients:["bread","butter","cheese"],      nutrition:{calories:350,protein:14,carbs:28,fat:22,fiber:1,sugar:3, sodium:620}, steps:["Butter both sides of bread","Layer cheese inside","Cook 2-3 min per side"] },
  { name:"Chicken & Rice",    ingredients:["chicken","rice","salt","oil"],  nutrition:{calories:450,protein:40,carbs:48,fat:10,fiber:1,sugar:0, sodium:440}, steps:["Season and cook chicken 6-8 min per side","Serve over cooked rice"] },
  { name:"Garlic Pasta",      ingredients:["pasta","garlic","oil","salt"],  nutrition:{calories:410,protein:11,carbs:64,fat:14,fiber:3,sugar:2, sodium:300}, steps:["Cook pasta","Sauté garlic in oil 1 min","Toss together, season"] },
  { name:"French Toast",      ingredients:["bread","eggs","milk","butter","sugar"], nutrition:{calories:320,protein:12,carbs:38,fat:14,fiber:1,sugar:14,sodium:310}, steps:["Dip bread in eggs+milk+sugar","Cook in butter 2-3 min per side"] },
  { name:"Rice & Beans",      ingredients:["rice","beans","salt","oil"],    nutrition:{calories:420,protein:14,carbs:78,fat:6, fiber:12,sugar:2, sodium:380}, steps:["Cook rice per package","Heat beans with oil","Season and serve together"] },
];

const FRIDGE_ITEMS = ["eggs","butter","milk","chicken","pasta","rice","beans","bread","cheese","onion","banana","oats","tuna","oil","salt","garlic","potato","tomato","sugar","flour"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const store = {
  get: async (k) => { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  set: async (k, v) => { try { await window.storage.set(k, JSON.stringify(v)); } catch {} },
};

const todayKey = () => new Date().toISOString().split("T")[0];
const timeNow  = () => new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
const greet    = () => { const h=new Date().getHours(); return h<12?"Good Morning":h<17?"Good Afternoon":"Good Evening"; };
const fmtDate  = (d) => { try { return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}); } catch { return d; } };

const DEFAULT_COLORS = { me:"#f59e0b", dad:"#f59e0b", dada:"#f59e0b", mom:"#a78bfa", yana:"#f43f5e", luca:"#38bdf8" };
const getColor = (name, pc) => {
  if(!name) return "#4ade80";
  const k = name.toLowerCase();
  if(pc?.[k]) return pc[k];
  for(const [key,val] of Object.entries(DEFAULT_COLORS)) { if(k.includes(key)) return val; }
  return "#4ade80";
};

const DEFAULT_PROFILES  = [{ id:"admin", name:"Me", emoji:"👑", type:"admin", pin:"1234" }];
const DEFAULT_NUT_GOALS = { calories:2000, protein:150, carbs:250, fat:65, fiber:25, sugar:50, sodium:2300 };
const DEFAULT_TRACKED   = ["calories","protein"];

const sendNotif = (title, body) => { if(Notification.permission==="granted") new Notification(`👑 ${title}`, {body}); };

export default function LifeApp() {
  const [screen, setScreen]       = useState("profiles");
  const [profiles, setProfiles]   = useState(DEFAULT_PROFILES);
  const [current, setCurrent]     = useState(null);
  const [pending, setPending]     = useState(null);
  const [pinIn, setPinIn]         = useState("");
  const [pinErr, setPinErr]       = useState(false);
  const [theme, setTheme]         = useState("midnight");
  const [showTheme, setShowTheme] = useState(false);
  const [tab, setTab]             = useState("home");
  const [showGame, setShowGame]   = useState(false);
  const [syncStatus, setSyncStatus] = useState("⚡ Live");

  // Shared (Firebase)
  const [sharedCal, setSharedCal] = useState([]);
  const [routines, setRoutines]   = useState([]);
  const [kids, setKids]           = useState([]);
  const [personColors, setPersonColors] = useState({});

  // Local
  const [fridge, setFridge]             = useState([]);
  const [allNutrition, setAllNutrition] = useState({});
  const [allGoals, setAllGoals]         = useState({});
  const [matched, setMatched]           = useState([]);
  const [selRecipe, setSelRecipe]       = useState(null);
  const [addedCal, setAddedCal]         = useState(false);
  const [dailyQuote, setDailyQuote]     = useState("");
  const [quoteLoad, setQuoteLoad]       = useState(false);
  const [notifOn, setNotifOn]           = useState(false);
  const [remindMins, setRemindMins]     = useState(30);

  // Forms
  const [appt, setAppt]         = useState({title:"",date:"",time:"",note:"",assignedTo:"",recurrence:"once",days:[]});
  const [routine, setRoutine]   = useState({title:"",time:"",assignedTo:"",recurrence:"daily",days:[],note:""});
  const [kidName, setKidName]   = useState("");
  const [kidEmoji, setKidEmoji] = useState("🧒");
  const [taskText, setTaskText] = useState("");
  const [taskPts, setTaskPts]   = useState("10");
  const [activeKid, setActiveKid] = useState(null);
  const [aiEmail, setAiEmail]   = useState("");
  const [aiLoad, setAiLoad]     = useState(false);
  const [aiRes, setAiRes]       = useState(null);
  const [subSet, setSubSet]     = useState("profile");
  const [newPName, setNewPName] = useState("");
  const [newPEmoji, setNewPEmoji] = useState("😊");
  const [newPType, setNewPType] = useState("family");
  const [newGoal, setNewGoal]   = useState("");
  const [logLabel, setLogLabel] = useState("");
  const [logNut, setLogNut]     = useState({});
  const [nutQuery, setNutQuery] = useState("");
  const [nutAiLoad, setNutAiLoad] = useState(false);
  const [nutAiResult, setNutAiResult] = useState(null);

  // Floating AI assistant
  const [showAI, setShowAI]       = useState(false);
  const [aiChat, setAiChat]       = useState([]);
  const [aiInput, setAiInput]     = useState("");
  const [aiChatLoad, setAiChatLoad] = useState(false);

  // Custom food database
  const [customFoods, setCustomFoods]   = useState([]);
  const [showFoodDB, setShowFoodDB]     = useState(false);
  const [foodDBQuery, setFoodDBQuery]   = useState("");
  const [foodDBLoad, setFoodDBLoad]     = useState(false);
  const [recentFoods, setRecentFoods]   = useState([]);

  // Co-parenting
  const [custody, setCustody]         = useState({momDays:[1,2],dadDays:[3,4],bedtimeYana:"20:00",bedtimeLuca:"20:00"});
  const [coRules, setCoRules]         = useState([]);
  const [exchangeLog, setExchangeLog] = useState([]);
  const [newRule, setNewRule]         = useState("");
  const [exchangeNote, setExchangeNote] = useState("");
  const [exchangeTimer, setExchangeTimer] = useState(null);
  const [pendingCustody, setPendingCustody] = useState(null);

  const T   = THEMES[theme] || THEMES.midnight;
  const pid = current?.id;
  const isAdmin = current?.type === "admin";
  const isKid   = current?.type === "kid";
  const myColor = getColor(current?.name, personColors);

  useEffect(() => {
    (async () => {
      const p  = await store.get("profiles");     if(p)  setProfiles(p);
      const f  = await store.get("fridge");       if(f)  setFridge(f);
      const an = await store.get("allNutrition"); if(an) setAllNutrition(an);
      const ag = await store.get("allGoals");     if(ag) setAllGoals(ag);
      const th = await store.get("theme");        if(th) setTheme(th);
      const pc = await store.get("personColors"); if(pc) setPersonColors(pc);
      const rm = await store.get("remindMins");   if(rm) setRemindMins(rm);
      const ne = await store.get("notifOn");      if(ne) setNotifOn(ne);
      const cf = await store.get("customFoods");  if(cf) setCustomFoods(cf);
      const rf = await store.get("recentFoods");  if(rf) setRecentFoods(rf);
      fetchQuote();
    })();
    fbListen("sharedCal",    d=>setSharedCal(d?Object.entries(d).map(([k,v])=>({...v,fbKey:k})):[]));
    fbListen("routines",     d=>setRoutines(d?Object.entries(d).map(([k,v])=>({...v,fbKey:k})):[]));
    fbListen("kids",         d=>setKids(d?Object.entries(d).map(([k,v])=>({...v,fbKey:k})):[]));
    fbListen("personColors", d=>{ if(d){ setPersonColors(d); store.set("personColors",d); }});
    fbListen("custody",      d=>{ if(d) setCustody(d); });
    fbListen("coRules",      d=>setCoRules(d?Object.entries(d).map(([k,v])=>({...v,fbKey:k})):[]));
    fbListen("exchangeLog",  d=>setExchangeLog(d?Object.entries(d).map(([k,v])=>({...v,fbKey:k})):[]));
  }, []);

  useEffect(() => {
    if(!notifOn) return;
    const iv = setInterval(() => {
      const now=new Date(); const todayStr=todayKey(); const cur=now.getHours()*60+now.getMinutes();
      sharedCal.forEach(ev=>{
        if(ev.date===todayStr&&ev.time){ const [h,m]=ev.time.split(":").map(Number); const diff=h*60+m-cur; if(diff>0&&diff<=remindMins) sendNotif(ev.title,`In ${Math.round(diff)} minutes`); }
      });
      const dow=now.getDay();
      routines.forEach(r=>{
        const today=r.recurrence==="daily"||(r.recurrence==="weekly"&&r.days?.includes(dow));
        if(today&&r.time){ const [h,m]=r.time.split(":").map(Number); const diff=h*60+m-cur; if(diff>0&&diff<=remindMins) sendNotif(r.title,`${r.assignedTo||"Everyone"} — in ${Math.round(diff)} min`); }
      });
    }, 60000);
    return ()=>clearInterval(iv);
  }, [notifOn, sharedCal, routines, remindMins]);

  const fetchQuote = async () => {
    const saved = await store.get("dailyQuote");
    if(saved?.date===todayKey()){ setDailyQuote(saved.quote); return; }
    setQuoteLoad(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:80,messages:[{role:"user",content:"Give one short powerful motivational quote for a single dad building a small business and raising two young kids. Under 20 words. Just the quote, no quotes marks, no author."}]})});
      const data = await res.json();
      const q = data.content?.[0]?.text?.trim()||"You are building something real. Every day counts.";
      setDailyQuote(q); store.set("dailyQuote",{date:todayKey(),quote:q});
    } catch { setDailyQuote("You are building something real. Every day counts. 💙"); }
    setQuoteLoad(false);
  };

  const sv = (k,s) => v=>{s(v);store.set(k,v);};
  const saveProfiles = sv("profiles",setProfiles);
  const saveFridge   = sv("fridge",  setFridge);
  const saveTheme    = v=>{setTheme(v);store.set("theme",v);};
  const saveColor    = async (name,color) => { const u={...personColors,[name.toLowerCase()]:color}; setPersonColors(u); store.set("personColors",u); await fbSet("personColors",u); };

  const myNut      = allNutrition[pid]||{};
  const myTracked  = myNut.tracked  ||DEFAULT_TRACKED;
  const myNutGoals = myNut.goals    ||DEFAULT_NUT_GOALS;
  const todayLog   = myNut[todayKey()]||[];
  const myGoals    = allGoals[pid]  ||[];

  const saveNut   = v=>{const n={...allNutrition,[pid]:v};setAllNutrition(n);store.set("allNutrition",n);};
  const saveGoals = v=>{const n={...allGoals,[pid]:v};setAllGoals(n);store.set("allGoals",n);};

  const todayTotals = todayLog.reduce((acc,item)=>{ALL_MACROS.forEach(m=>{acc[m.key]=(acc[m.key]||0)+(item.nutrition?.[m.key]||0);});return acc;},{});
  const addEntry    = (label,nutrition)=>saveNut({...myNut,[todayKey()]:[...todayLog,{label,nutrition,time:timeNow(),id:Date.now()}]});
  const removeEntry = id=>saveNut({...myNut,[todayKey()]:todayLog.filter(e=>e.id!==id)});
  const updateTracked = key=>saveNut({...myNut,tracked:myTracked.includes(key)?myTracked.filter(k=>k!==key):[...myTracked,key]});
  const updateGoal    = (key,val)=>saveNut({...myNut,goals:{...myNutGoals,[key]:parseInt(val)||0}});

  useEffect(()=>{
    if(!fridge.length){setMatched([]);return;}
    setMatched(RECIPES.filter(r=>r.ingredients.every(i=>fridge.includes(i))));
    setSelRecipe(null);setAddedCal(false);
  },[fridge]);

  const todayDow     = new Date().getDay();
  const todayRoutines = routines.filter(r=>r.recurrence==="daily"||(r.recurrence==="weekly"&&r.days?.includes(todayDow)));

  const saveEvent    = async ev=>{setSyncStatus("🔄 Syncing...");await fbPush("sharedCal",{...ev,addedBy:current?.name,id:Date.now()});setSyncStatus("⚡ Live");};
  const deleteEvent  = fbKey=>fbDel(`sharedCal/${fbKey}`);
  const toggleEvent  = async ev=>fbSet(`sharedCal/${ev.fbKey}`,{...ev,done:!ev.done});
  const saveRoutineFb  = async r=>fbPush("routines",{...r,createdBy:current?.name,id:Date.now()});
  const deleteRoutine  = fbKey=>fbDel(`routines/${fbKey}`);
  const toggleRoutine  = async r=>{ const k=todayKey(); await fbSet(`routines/${r.fbKey}`,{...r,doneOn:{...(r.doneOn||{}),[k]:!r.doneOn?.[k]}}); };
  const addKid         = async kid=>fbPush("kids",kid);
  const updateKid      = async (fbKey,updates)=>{if(fbKey)await fbSet(`kids/${fbKey}`,updates);};
  const removeKid      = fbKey=>fbDel(`kids/${fbKey}`);

  const handleGamePoints = useCallback(pts=>{
    if(!pid)return; const kid=kids.find(k=>k.name===current?.name); if(!kid)return;
    updateKid(kid.fbKey,{...kid,points:(kid.points||0)+pts});
  },[kids,current,pid]);

  const addEntryWithRecent = (label, nutrition) => {
    addEntry(label, nutrition);
    const updated = [{ label, nutrition, id:Date.now() }, ...recentFoods.filter(f=>f.label!==label)].slice(0,20);
    setRecentFoods(updated); store.set("recentFoods", updated);
  };

  const saveCustomFood = (food) => {
    const updated = [...customFoods.filter(f=>f.name!==food.name), food];
    setCustomFoods(updated); store.set("customFoods", updated);
  };

  const deleteCustomFood = (name) => {
    const updated = customFoods.filter(f=>f.name!==name);
    setCustomFoods(updated); store.set("customFoods", updated);
  };

  const sendAIChat = async (msg) => {
    if(!msg.trim()) return;
    const userMsg = { role:"user", content:msg };
    const newHistory = [...aiChat, userMsg];
    setAiChat(newHistory); setAiInput(""); setAiChatLoad(true);
    try {
      const appContext = `You are the LUCAC Family App AI assistant. The user is ${current?.name}. 
Today is ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}.
Kids: Yana (age 8) and Luca (age 6).
Custody: Mom has Mon/Tue, Dad has Wed/Thu.
You can help with: nutrition advice, meal ideas, parenting tips, schedule suggestions, app features, motivation, bedtime routines, kids activities, anything family related.
Keep answers SHORT and friendly. If asked about nutrition for a specific food, give calories and main macros.
If asked to set up colors or themes, explain they can tap 🎨 in the top right.
If asked to add food to their log, give them the nutrition facts so they can tap Add.`;
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:300,
        system: appContext,
        messages: newHistory.slice(-6)
      })});
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry I couldn't process that!";
      setAiChat(h=>[...h, {role:"assistant", content:reply}]);
    } catch { setAiChat(h=>[...h,{role:"assistant",content:"Couldn't connect right now — try again!"}]); }
    setAiChatLoad(false);
  };

  const lookupNutrition = async (query) => {
    if(!query.trim()) return;
    setNutAiLoad(true); setNutAiResult(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,
        messages:[{role:"user",content:`You are a nutrition database. The user typed: "${query}". Figure out the food, standard serving size, and nutrition facts. Return ONLY valid JSON, no markdown:
{"food":"string","serving":"string (e.g. 100g or 1 cup)","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"sodium":0,"note":"any helpful tip"}
Use FDA standard values. If they mention a specific amount like "322 grams of X", calculate for that exact amount.`}]})});
      const data = await res.json();
      const text = data.content.map(c=>c.text||"").join("");
      setNutAiResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch { setNutAiResult({error:"Couldn't find that food — try being more specific!"}); }
    setNutAiLoad(false);
  };

  const parseEmail = async()=>{
    if(!aiEmail.trim())return; setAiLoad(true); setAiRes(null);
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,messages:[{role:"user",content:`Extract appointment from email. Return ONLY valid JSON: {"title":"string","date":"YYYY-MM-DD","time":"HH:MM","note":"string"}. Default date ${todayKey()} if missing. Email: ${aiEmail}`}]})});
      const data=await res.json(); const text=data.content.map(c=>c.text||"").join("");
      setAiRes(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch { setAiRes({error:"Couldn't read that — try pasting more of the email!"}); }
    setAiLoad(false);
  };

  const enableNotif = async()=>{
    if(!("Notification" in window)){alert("Notifications not supported on this browser.");return;}
    const p=await Notification.requestPermission();
    if(p==="granted"){ setNotifOn(true); store.set("notifOn",true); sendNotif("LUCAC ✦","Reminders are ON! You'll get pinged before events and routines."); }
    else alert("Please allow notifications in your browser or device settings!");
  };

  const tabs = isKid
    ? [{id:"rewards",icon:"⭐",label:"Stars"},{id:"game",icon:"🎮",label:"Game"},{id:"calendar",icon:"📅",label:"Events"},{id:"routines",icon:"🔄",label:"Routines"}]
    : [{id:"home",icon:"🏠",label:"Home"},{id:"food",icon:"🍽️",label:"Food"},{id:"myfoods",icon:"🥩",label:"My Foods"},{id:"nutrition",icon:"🔥",label:"Nutrition"},{id:"goals",icon:"🎯",label:"Goals"},{id:"kids",icon:"⭐",label:"Kids"},{id:"calendar",icon:"📅",label:"Calendar"},{id:"routines",icon:"🔄",label:"Routines"},{id:"coparent",icon:"🤝",label:"Co-Parent"},
       ...(isAdmin?[{id:"work",icon:"💼",label:"Work"},{id:"settings",icon:"⚙️",label:"Settings"}]:[])];

  const s = {
    wrap:{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"Georgia,serif",paddingBottom:"80px"},
    hdr: {background:T.card,borderBottom:`1px solid ${T.border}`,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100},
    page:{padding:"16px"},
    card:{background:T.card,border:`1px solid ${T.border}`,borderRadius:"16px",padding:"16px",marginBottom:"14px"},
    h2:  {fontSize:"17px",fontWeight:"bold",color:T.accent,margin:"0 0 12px 0"},
    h3:  {fontSize:"11px",color:T.sub,marginBottom:"8px",textTransform:"uppercase",letterSpacing:"1px"},
    inp: {background:T.bg,border:`1px solid ${T.border}`,borderRadius:"10px",padding:"10px 14px",color:T.text,fontSize:"14px",width:"100%",boxSizing:"border-box",fontFamily:"Georgia,serif"},
    txa: {background:T.bg,border:`1px solid ${T.border}`,borderRadius:"10px",padding:"10px 14px",color:T.text,fontSize:"14px",width:"100%",boxSizing:"border-box",fontFamily:"Georgia,serif",minHeight:"80px",resize:"vertical"},
    btn: {background:T.accent,color:T.bg,border:"none",borderRadius:"10px",padding:"10px 18px",fontWeight:"bold",fontSize:"14px",cursor:"pointer",fontFamily:"Georgia,serif"},
    btnSm:{background:T.accent,color:T.bg,border:"none",borderRadius:"8px",padding:"7px 12px",fontWeight:"bold",fontSize:"12px",cursor:"pointer"},
    btnO:{background:"none",color:T.accent,border:`1px solid ${T.accent}`,borderRadius:"10px",padding:"8px 14px",fontSize:"13px",cursor:"pointer"},
    nav: {position:"fixed",bottom:0,left:0,right:0,background:T.card,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-around",padding:"8px 0 14px",zIndex:100,overflowX:"auto"},
    nBtn:(a)=>({background:"none",border:"none",color:a?T.accent:T.sub,fontSize:"9px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",fontFamily:"Georgia,serif",padding:"0 2px",minWidth:"38px"}),
    tag: (a,c)=>({background:a?(c||T.accent):T.bg,color:a?T.bg:T.sub,border:`1px solid ${a?(c||T.accent):T.border}`,borderRadius:"20px",padding:"5px 11px",fontSize:"12px",cursor:"pointer",margin:"3px",display:"inline-block"}),
    row: {display:"flex",gap:"8px"},
    g2:  {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},
    pbar:{background:T.border,borderRadius:"10px",height:"8px",overflow:"hidden",margin:"4px 0"},
    pfil:(p,c)=>({height:"100%",borderRadius:"10px",background:p>=100?"#ef4444":(c||T.accent),width:Math.min(p,100)+"%"}),
    box: {background:T.bg,borderRadius:"12px",padding:"12px",textAlign:"center"},
    irow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`},
  };

  if(showGame) return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:"#030712"}}>
      <button onClick={()=>setShowGame(false)} style={{position:"absolute",top:"16px",left:"16px",background:"rgba(0,0,0,0.8)",border:"1px solid #444",borderRadius:"10px",padding:"8px 14px",color:"white",cursor:"pointer",zIndex:201,fontSize:"14px"}}>← Back</button>
      <LucacLegends onEarnPoints={handleGamePoints} currentKid={current}/>
    </div>
  );

  if(screen==="profiles") return (
    <div style={{...s.wrap,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"20px"}}>
      <div style={{textAlign:"center",marginBottom:"32px"}}>
        <div style={{fontSize:"32px",fontWeight:"bold",color:T.accent,letterSpacing:"3px"}}>LUCAC ✦</div>
        <div style={{color:T.sub,fontSize:"14px",marginTop:"6px"}}>Who's using the app?</div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"14px",maxWidth:"400px"}}>
        {profiles.map(p=>{
          const col=getColor(p.name,personColors);
          return(<div key={p.id} onClick={()=>{if(p.type==="admin"){setPending(p);setPinIn("");setPinErr(false);setScreen("pin");}else{setCurrent(p);setTab(p.type==="kid"?"rewards":"home");setScreen("app");}}} style={{background:T.card,border:`3px solid ${col}`,borderRadius:"20px",padding:"20px 22px",textAlign:"center",cursor:"pointer",minWidth:"110px",boxShadow:`0 4px 20px ${col}33`}}>
            <div style={{fontSize:"38px"}}>{p.emoji}</div>
            <div style={{fontWeight:"bold",marginTop:"8px",fontSize:"14px",color:col}}>{p.name}</div>
            <div style={{fontSize:"11px",color:T.sub,marginTop:"3px"}}>{p.type==="admin"?"🔒 Admin":p.type==="kid"?"👦 Kid":"👤 Family"}</div>
          </div>);
        })}
        <div onClick={()=>{setCurrent({id:"guest",name:"Guest",type:"guest"});setTab("home");setScreen("app");}} style={{background:"none",border:`2px dashed ${T.border}`,borderRadius:"20px",padding:"20px 22px",textAlign:"center",cursor:"pointer",minWidth:"110px",color:T.sub}}>
          <div style={{fontSize:"38px"}}>👤</div>
          <div style={{fontSize:"14px",marginTop:"8px"}}>Guest</div>
        </div>
      </div>
    </div>
  );

  if(screen==="pin") return (
    <div style={{...s.wrap,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{fontSize:"40px",marginBottom:"8px"}}>{pending?.emoji}</div>
      <div style={{fontSize:"18px",fontWeight:"bold"}}>{pending?.name}</div>
      <div style={{color:T.sub,fontSize:"14px",marginTop:"4px",marginBottom:"28px"}}>Enter your PIN</div>
      <div style={{display:"flex",gap:"14px",marginBottom:"28px"}}>{[0,1,2,3].map(i=>(<div key={i} style={{width:"15px",height:"15px",borderRadius:"50%",background:i<pinIn.length?T.accent:T.border}}/>))}</div>
      {pinErr&&<div style={{color:"#ef4444",fontSize:"14px",marginBottom:"16px"}}>Wrong PIN — try again</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,72px)",gap:"12px"}}>
        {[1,2,3,4,5,6,7,8,9,"",0,"DEL"].map((d,i)=>(
          <button key={i} onClick={()=>{if(d==="")return;if(d==="DEL"){setPinIn(x=>x.slice(0,-1));return;}const n=pinIn+d;setPinIn(n);if(n.length===4){if(n===pending.pin){setCurrent(pending);setTab("home");setScreen("app");setPinErr(false);}else{setPinErr(true);setTimeout(()=>{setPinIn("");setPinErr(false);},900);}}}}
            style={{height:"68px",borderRadius:"50%",background:d===""?"transparent":T.card,border:d===""?"none":`1px solid ${T.border}`,color:d==="DEL"?T.sub:T.text,fontSize:d==="DEL"?"14px":"22px",cursor:d===""?"default":"pointer",fontWeight:"bold",fontFamily:"Georgia,serif"}}>{d}</button>
        ))}
      </div>
      <button onClick={()=>setScreen("profiles")} style={{marginTop:"24px",background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:"14px"}}>← Back</button>
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.hdr}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"22px",cursor:"pointer"}} onClick={()=>setScreen("profiles")}>{current?.emoji||"👤"}</span>
          <div style={{fontSize:"16px",fontWeight:"bold",color:T.accent,letterSpacing:"2px"}}>LUCAC ✦</div>
          <div style={{fontSize:"10px",color:"#4ade80",background:"#0f2010",borderRadius:"8px",padding:"2px 7px"}}>{syncStatus}</div>
        </div>
        <div style={{display:"flex",gap:"8px",alignItems:"center",position:"relative"}}>
          <div style={{fontSize:"11px",color:T.sub}}>{new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
          {notifOn&&<span title="Notifications ON">🔔</span>}
          <button onClick={()=>setShowTheme(x=>!x)} style={s.btnSm}>🎨</button>
          {showTheme&&(<div style={{position:"absolute",top:"38px",right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:"14px",padding:"14px",display:"flex",flexWrap:"wrap",gap:"10px",zIndex:200,boxShadow:"0 10px 40px rgba(0,0,0,0.5)",width:"220px"}}>
            {Object.entries(THEMES).map(([name,t])=>(<div key={name} onClick={()=>{saveTheme(name);setShowTheme(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",cursor:"pointer"}}><div style={{width:"30px",height:"30px",borderRadius:"50%",background:t.accent,border:theme===name?"3px solid white":"3px solid transparent"}}/><div style={{fontSize:"9px",color:T.sub}}>{t.label}</div></div>))}
          </div>)}
        </div>
      </div>

      <div style={s.page}>

      {/* HOME */}
      {tab==="home"&&(<>
        <div style={{...s.card,borderLeft:`4px solid ${myColor}`}}>
          <div style={{fontSize:"10px",color:T.sub,marginBottom:"6px",letterSpacing:"1.5px",textTransform:"uppercase"}}>✦ Today's Quote</div>
          {quoteLoad?<div style={{color:T.sub,fontSize:"13px"}}>Loading... ✨</div>:<div style={{fontStyle:"italic",lineHeight:1.8,fontSize:"15px"}}>"{dailyQuote}"</div>}
          <button onClick={fetchQuote} style={{background:"none",border:"none",color:T.sub,fontSize:"11px",cursor:"pointer",marginTop:"6px"}}>↻ New quote</button>
        </div>
        <div style={s.card}>
          <div style={s.h2}>{greet()}, {current?.name?.split(" ")[0]}! 👋</div>
          <div style={s.g2}>
            {[{icon:"🔥",label:"Calories",val:`${todayTotals.calories||0} kcal`},{icon:"🎯",label:"Goals",val:`${myGoals.filter(g=>g.done).length}/${myGoals.length}`},{icon:"📅",label:"Today",val:sharedCal.filter(e=>e.date===todayKey()).length+" events"},{icon:"🔄",label:"Routines",val:`${todayRoutines.filter(r=>r.doneOn?.[todayKey()]).length}/${todayRoutines.length} done`}].map((it,i)=>(
              <div key={i} style={s.box}><div style={{fontSize:"24px"}}>{it.icon}</div><div style={{fontSize:"12px",color:T.sub,marginTop:"4px"}}>{it.label}</div><div style={{fontSize:"13px",fontWeight:"bold",color:myColor,marginTop:"2px"}}>{it.val}</div></div>
            ))}
          </div>
        </div>
        {todayRoutines.length>0&&(<div style={s.card}>
          <div style={s.h2}>🔄 Today's Routines</div>
          {todayRoutines.map((r,i)=>{
            const done=r.doneOn?.[todayKey()]; const col=getColor(r.assignedTo||"",personColors);
            return(<div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
              <div onClick={()=>toggleRoutine(r)} style={{width:"24px",height:"24px",borderRadius:"50%",border:`2px solid ${col}`,background:done?col:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done&&<span style={{color:"#000",fontSize:"12px"}}>✓</span>}</div>
              <div style={{flex:1}}><div style={{fontSize:"14px",textDecoration:done?"line-through":"none"}}>{r.title}</div>{r.assignedTo&&<div style={{fontSize:"11px",color:col}}>{r.assignedTo}{r.time?` · ${r.time}`:""}</div>}</div>
            </div>);
          })}
        </div>)}
        {sharedCal.filter(e=>e.date>=todayKey()).length>0&&(<div style={s.card}>
          <div style={s.h2}>📅 Coming Up</div>
          {[...sharedCal].filter(e=>e.date>=todayKey()).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,5).map((a,i)=>{
            const col=getColor(a.assignedTo||a.addedBy||"",personColors);
            return(<div key={i} style={{display:"flex",gap:"10px",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{background:col,color:"#000",borderRadius:"8px",padding:"4px 8px",fontSize:"11px",fontWeight:"bold",whiteSpace:"nowrap",minWidth:"60px",textAlign:"center"}}>{a.recurrence&&a.recurrence!=="once"?"🔄":fmtDate(a.date)}</div>
              <div><div style={{fontSize:"14px",fontWeight:"bold"}}>{a.title}</div><div style={{fontSize:"11px",color:T.sub}}>{a.time||""}{a.assignedTo?` · ${a.assignedTo}`:""}</div></div>
            </div>);
          })}
        </div>)}
      </>)}

      {/* FOOD */}
      {tab==="food"&&(<>
        <div style={s.card}>
          <div style={s.h2}>🧊 What's In Your Fridge?</div>
          <div style={{color:T.sub,fontSize:"13px",marginBottom:"12px"}}>Tap what you have — I'll find recipes!</div>
          <div>{FRIDGE_ITEMS.map(item=>(<span key={item} style={s.tag(fridge.includes(item))} onClick={()=>saveFridge(fridge.includes(item)?fridge.filter(f=>f!==item):[...fridge,item])}>{item}</span>))}</div>
        </div>
        {fridge.length>0&&matched.length===0&&<div style={{...s.card,textAlign:"center",color:T.sub,padding:"24px"}}><div style={{fontSize:"32px"}}>🥄</div><div style={{marginTop:"8px"}}>No matches yet — add more ingredients!</div></div>}
        {matched.map((r,i)=>(<div key={i} style={s.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:"bold",fontSize:"15px"}}>{r.name}</div><div style={{color:T.accent,fontSize:"13px",marginTop:"3px"}}>🔥 {r.nutrition.calories} cal · 💪 {r.nutrition.protein}g</div></div>
            <button style={s.btnO} onClick={()=>setSelRecipe(selRecipe?.name===r.name?null:r)}>{selRecipe?.name===r.name?"▲":"▼"}</button>
          </div>
          {selRecipe?.name===r.name&&(<div style={{marginTop:"14px"}}>
            <div style={{background:T.bg,borderRadius:"12px",padding:"14px",marginBottom:"12px",border:`1px solid ${T.border}`}}>
              <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"10px",color:T.accent}}>📊 Nutrition Facts</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>{ALL_MACROS.map(m=>(<div key={m.key} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:"12px",color:T.sub}}>{m.label}</span><span style={{fontSize:"12px",fontWeight:"bold",color:m.color}}>{r.nutrition[m.key]||0}{m.unit}</span></div>))}</div>
            </div>
            {r.steps.map((step,si)=>(<div key={si} style={{display:"flex",gap:"10px",marginBottom:"10px"}}><div style={{background:T.accent,color:T.bg,borderRadius:"50%",width:"24px",height:"24px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"bold",flexShrink:0}}>{si+1}</div><div style={{fontSize:"14px",lineHeight:1.6}}>{step}</div></div>))}
            <button style={{...s.btn,width:"100%",marginTop:"12px",opacity:addedCal?0.65:1}} onClick={()=>{if(!addedCal){addEntry(r.name,r.nutrition);setAddedCal(true);setTimeout(()=>setAddedCal(false),2500);}}}>{addedCal?"✅ Logged!":"➕ Log This Meal"}</button>
          </div>)}
        </div>))}
      </>)}

      {/* NUTRITION */}
      {tab==="nutrition"&&(<>
        <div style={s.card}>
          <div style={s.h2}>🔥 Today</div>
          {myTracked.map(key=>{ const m=ALL_MACROS.find(x=>x.key===key);if(!m)return null; const val=todayTotals[key]||0;const goal=myNutGoals[key]||1;const pct=(val/goal)*100;
            return(<div key={key} style={{marginBottom:"14px"}}><div style={{display:"flex",justifyContent:"space-between",fontSize:"14px",marginBottom:"4px"}}><span style={{fontWeight:"bold",color:m.color}}>{m.label}</span><span>{val}{m.unit} <span style={{color:T.sub}}>/ {goal}{m.unit}</span></span></div><div style={s.pbar}><div style={s.pfil(pct,m.color)}/></div></div>);
          })}
        </div>
        <div style={s.card}>
          <div style={s.h2}>🤖 AI Nutrition Lookup</div>
          <div style={{color:T.sub,fontSize:"13px",marginBottom:"12px"}}>Type any food or amount — like "322 grams of rice" or "1 slice of pizza" and I'll get the nutrition facts!</div>
          <div style={{...s.row,marginBottom:"10px"}}>
            <input style={{...s.inp,flex:1}} placeholder="e.g. 322 grams of white rice, 1 banana, 2 eggs..." value={nutQuery} onChange={e=>setNutQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")lookupNutrition(nutQuery);}}/>
            <button style={s.btnSm} onClick={()=>lookupNutrition(nutQuery)} disabled={nutAiLoad}>{nutAiLoad?"⏳":"🔍"}</button>
          </div>
          {nutAiLoad&&<div style={{color:T.sub,fontSize:"13px",textAlign:"center",padding:"12px"}}>🤖 Looking up nutrition facts...</div>}
          {nutAiResult&&!nutAiResult.error&&(<div style={{background:T.bg,borderRadius:"12px",padding:"14px",border:`1px solid ${T.border}`}}>
            <div style={{fontWeight:"bold",fontSize:"16px",marginBottom:"2px"}}>{nutAiResult.food}</div>
            <div style={{color:T.sub,fontSize:"12px",marginBottom:"12px"}}>Serving: {nutAiResult.serving}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"12px"}}>
              {ALL_MACROS.map(m=>(<div key={m.key} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:T.card,borderRadius:"8px"}}><span style={{fontSize:"12px",color:T.sub}}>{m.label}</span><span style={{fontSize:"13px",fontWeight:"bold",color:m.color}}>{nutAiResult[m.key]||0}{m.unit}</span></div>))}
            </div>
            {nutAiResult.note&&<div style={{fontSize:"12px",color:T.accent,marginBottom:"12px"}}>💡 {nutAiResult.note}</div>}
            <button style={{...s.btn,width:"100%"}} onClick={()=>{addEntry(nutAiResult.food,{calories:nutAiResult.calories,protein:nutAiResult.protein,carbs:nutAiResult.carbs,fat:nutAiResult.fat,fiber:nutAiResult.fiber,sugar:nutAiResult.sugar,sodium:nutAiResult.sodium});setNutAiResult(null);setNutQuery("");}}>➕ Log This</button>
          </div>)}
          {nutAiResult?.error&&<div style={{color:"#ef4444",fontSize:"13px"}}>{nutAiResult.error}</div>}
        </div>

        <div style={s.card}>
          <div style={s.h2}>➕ Log Food Manually</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            <input style={s.inp} placeholder="Food name..." value={logLabel} onChange={e=>setLogLabel(e.target.value)}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>{ALL_MACROS.map(m=>(<div key={m.key}><div style={{fontSize:"11px",color:m.color,marginBottom:"3px"}}>{m.label} ({m.unit})</div><input style={{...s.inp,padding:"8px 10px",fontSize:"13px"}} type="number" placeholder="0" value={logNut[m.key]||""} onChange={e=>setLogNut(n=>({...n,[m.key]:e.target.value?parseInt(e.target.value):0}))}/></div>))}</div>
            <button style={s.btn} onClick={()=>{if(!logLabel.trim())return;addEntry(logLabel,logNut);setLogLabel("");setLogNut({});}}>Add to Log</button>
          </div>
        </div>
        {todayLog.length>0&&(<div style={s.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}><div style={{fontWeight:"bold",fontSize:"17px",color:T.accent}}>Today's Log</div><button style={{...s.btnO,fontSize:"11px",padding:"4px 10px"}} onClick={()=>saveNut({...myNut,[todayKey()]:[]})}>Clear</button></div>
          {todayLog.map((e,i)=>(<div key={e.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}><div><div style={{fontWeight:"bold",fontSize:"14px"}}>{e.label}</div><div style={{fontSize:"11px",color:T.sub}}>{e.time}</div></div><span onClick={()=>removeEntry(e.id)} style={{color:T.sub,cursor:"pointer",fontSize:"20px"}}>×</span></div>))}
        </div>)}
      </>)}

      {/* GOALS */}
      {tab==="goals"&&(<div style={s.card}>
        <div style={s.h2}>🎯 Daily Goals</div>
        <div style={{...s.row,marginBottom:"16px"}}>
          <input style={{...s.inp,flex:1}} placeholder="Add a goal..." value={newGoal} onChange={e=>setNewGoal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newGoal.trim()){saveGoals([...myGoals,{text:newGoal,done:false,id:Date.now()}]);setNewGoal("");}}}/>
          <button style={s.btn} onClick={()=>{if(newGoal.trim()){saveGoals([...myGoals,{text:newGoal,done:false,id:Date.now()}]);setNewGoal("");}}}>+</button>
        </div>
        {myGoals.length===0&&<div style={{color:T.sub,textAlign:"center",padding:"20px"}}>No goals yet! Add one 💪</div>}
        {myGoals.map((g,i)=>(<div key={g.id||i} style={s.irow}>
          <div style={{display:"flex",alignItems:"center",gap:"12px",flex:1}}>
            <div onClick={()=>saveGoals(myGoals.map((gm,idx)=>idx===i?{...gm,done:!gm.done}:gm))} style={{width:"24px",height:"24px",borderRadius:"50%",border:`2px solid ${g.done?myColor:T.border}`,background:g.done?myColor:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{g.done&&<span style={{color:T.bg,fontSize:"13px"}}>✓</span>}</div>
            <span style={{fontSize:"15px",textDecoration:g.done?"line-through":"none",color:g.done?T.sub:T.text}}>{g.text}</span>
          </div>
          <span onClick={()=>saveGoals(myGoals.filter((_,idx)=>idx!==i))} style={{color:T.sub,cursor:"pointer",fontSize:"22px"}}>×</span>
        </div>))}
        {myGoals.length>0&&<div style={{textAlign:"center",color:T.sub,fontSize:"13px",marginTop:"12px"}}>{myGoals.filter(g=>g.done).length}/{myGoals.length} — {myGoals.every(g=>g.done)?"🎉 All done!":"keep going!"}</div>}
      </div>)}

      {/* KIDS */}
      {(tab==="kids"||tab==="rewards")&&(<>
        {isAdmin&&tab==="kids"&&(<div style={s.card}>
          <div style={s.h2}>⭐ Add a Kid</div>
          <div style={s.row}>
            <input style={{...s.inp,flex:2}} placeholder="Kid's name..." value={kidName} onChange={e=>setKidName(e.target.value)}/>
            <input style={{...s.inp,flex:1,maxWidth:"58px"}} placeholder="😀" value={kidEmoji} onChange={e=>setKidEmoji(e.target.value)}/>
            <button style={s.btn} onClick={()=>{if(!kidName.trim())return;addKid({id:Date.now(),name:kidName,emoji:kidEmoji||"🧒",points:0,tasks:[]});setKidName("");setKidEmoji("🧒");}}>Add</button>
          </div>
        </div>)}
        {kids.filter(k=>isKid?k.name===current?.name:true).map((kid)=>{
          const kc=getColor(kid.name,personColors); const lvl=Math.floor((kid.points||0)/100); const prog=(kid.points||0)%100;
          return(<div key={kid.fbKey||kid.id} style={{...s.card,borderLeft:`4px solid ${kc}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <span style={{fontSize:"28px"}}>{kid.emoji}</span>
                <div><div style={{fontSize:"17px",fontWeight:"bold",color:kc}}>{kid.name}</div><div style={{fontSize:"12px",color:T.sub}}>🏆 Lvl {lvl} · {kid.points||0} pts</div></div>
              </div>
              <div style={{background:kc,color:"#000",borderRadius:"20px",padding:"5px 14px",fontWeight:"bold",fontSize:"14px"}}>⭐ {kid.points||0}</div>
            </div>
            <div style={{marginBottom:"14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"12px",color:T.sub,marginBottom:"4px"}}><span>To next reward</span><span>{prog}/100</span></div>
              <div style={s.pbar}><div style={s.pfil(prog,kc)}/></div>
            </div>
            {isAdmin&&(<div style={{marginBottom:"12px"}}>
              <div style={s.h3}>Add Task</div>
              <div style={s.row}>
                <input style={{...s.inp,flex:3}} placeholder="Task name..." value={activeKid===kid.fbKey?taskText:""} onChange={e=>{setTaskText(e.target.value);setActiveKid(kid.fbKey);}}/>
                <input style={{...s.inp,flex:1,maxWidth:"58px"}} type="number" placeholder="pts" value={activeKid===kid.fbKey?taskPts:"10"} onChange={e=>{setTaskPts(e.target.value);setActiveKid(kid.fbKey);}}/>
                <button style={s.btnSm} onClick={()=>{if(!taskText.trim())return;const u={...kid,tasks:[...(kid.tasks||[]),{text:taskText,done:false,pts:parseInt(taskPts)||10,id:Date.now()}]};updateKid(kid.fbKey,u);setTaskText("");setTaskPts("10");}}>+</button>
              </div>
            </div>)}
            {(kid.tasks||[]).map((task,ti)=>(<div key={task.id||ti} style={s.irow}>
              <span style={{fontSize:"14px",textDecoration:task.done?"line-through":"none",flex:1,color:task.done?T.sub:T.text}}>{task.text}</span>
              {!task.done?<button style={{...s.btnSm,background:kc,color:"#000"}} onClick={()=>{const u={...kid,points:(kid.points||0)+(task.pts||10),tasks:(kid.tasks||[]).map((t,j)=>j===ti?{...t,done:true}:t)};updateKid(kid.fbKey,u);}}>✓ +{task.pts||10}</button>:<span style={{color:kc,fontSize:"12px"}}>✅</span>}
            </div>))}
            {isAdmin&&(<div style={{display:"flex",gap:"8px",marginTop:"14px"}}>
              <button style={{...s.btnO,fontSize:"12px"}} onClick={()=>updateKid(kid.fbKey,{...kid,points:0,tasks:(kid.tasks||[]).map(t=>({...t,done:false}))})}>Reset</button>
              <button style={{...s.btnO,fontSize:"12px",borderColor:"#ef4444",color:"#ef4444"}} onClick={()=>removeKid(kid.fbKey)}>Remove</button>
            </div>)}
          </div>);
        })}
      </>)}

      {/* MY FOODS — custom food database */}
      {tab==="myfoods"&&(<>
        <div style={s.card}>
          <div style={s.h2}>🥩 My Food Database</div>
          <div style={{color:T.sub,fontSize:"13px",marginBottom:"14px"}}>Your personal foods — ox tail, muenster cheese, whatever YOU actually eat. AI fills the nutrition, you save it forever.</div>
          <div style={{...s.row,marginBottom:"10px"}}>
            <input style={{...s.inp,flex:1}} placeholder="Type any food (e.g. ox tail, muenster cheese, 3 tamales...)..." value={foodDBQuery} onChange={e=>setFoodDBQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")lookupNutrition(foodDBQuery)&&setNutAiResult(null);}}/>
            <button style={s.btnSm} onClick={async()=>{ await lookupNutrition(foodDBQuery); }} disabled={foodDBLoad}>{foodDBLoad?"⏳":"🔍 AI"}</button>
          </div>
          {nutAiLoad&&<div style={{color:T.sub,fontSize:"13px",textAlign:"center",padding:"12px"}}>🤖 Looking up nutrition...</div>}
          {nutAiResult&&!nutAiResult.error&&(<div style={{background:T.bg,borderRadius:"12px",padding:"14px",border:`1px solid ${T.accent}`,marginBottom:"12px"}}>
            <div style={{fontWeight:"bold",fontSize:"16px",marginBottom:"2px"}}>{nutAiResult.food}</div>
            <div style={{fontSize:"12px",color:T.sub,marginBottom:"10px"}}>Serving: {nutAiResult.serving}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px",marginBottom:"12px"}}>
              {ALL_MACROS.map(m=>(<div key={m.key} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:T.card,borderRadius:"8px"}}><span style={{fontSize:"11px",color:T.sub}}>{m.label}</span><span style={{fontSize:"12px",fontWeight:"bold",color:m.color}}>{nutAiResult[m.key]||0}{m.unit}</span></div>))}
            </div>
            {nutAiResult.note&&<div style={{fontSize:"12px",color:T.accent,marginBottom:"10px"}}>💡 {nutAiResult.note}</div>}
            <div style={s.row}>
              <button style={{...s.btn,flex:1,fontSize:"13px"}} onClick={()=>{ saveCustomFood({name:nutAiResult.food,serving:nutAiResult.serving,nutrition:{calories:nutAiResult.calories,protein:nutAiResult.protein,carbs:nutAiResult.carbs,fat:nutAiResult.fat,fiber:nutAiResult.fiber,sugar:nutAiResult.sugar,sodium:nutAiResult.sodium},note:nutAiResult.note,id:Date.now()}); setNutAiResult(null); setFoodDBQuery(""); }}>💾 Save to My Foods</button>
              <button style={{...s.btnO,flex:1,fontSize:"13px"}} onClick={()=>{ addEntryWithRecent(nutAiResult.food,{calories:nutAiResult.calories,protein:nutAiResult.protein,carbs:nutAiResult.carbs,fat:nutAiResult.fat,fiber:nutAiResult.fiber,sugar:nutAiResult.sugar,sodium:nutAiResult.sodium}); setNutAiResult(null); }}>➕ Log Now</button>
            </div>
          </div>)}
        </div>

        {/* Recent foods */}
        {recentFoods.length>0&&(<div style={s.card}>
          <div style={s.h2}>⚡ Quick Log — Recent Foods</div>
          <div style={{color:T.sub,fontSize:"12px",marginBottom:"10px"}}>One tap to re-log anything you've eaten before!</div>
          {recentFoods.slice(0,10).map((f,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
              <div>
                <div style={{fontSize:"14px",fontWeight:"bold"}}>{f.label}</div>
                <div style={{fontSize:"11px",color:T.sub}}>🔥 {f.nutrition?.calories||0} cal · 💪 {f.nutrition?.protein||0}g protein</div>
              </div>
              <button style={s.btnSm} onClick={()=>addEntryWithRecent(f.label,f.nutrition)}>+ Log</button>
            </div>
          ))}
        </div>)}

        {/* Saved custom foods */}
        {customFoods.length>0&&(<div style={s.card}>
          <div style={s.h2}>💾 My Saved Foods</div>
          {customFoods.map((f,i)=>(
            <div key={i} style={{background:T.bg,borderRadius:"12px",padding:"12px",marginBottom:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:"bold",fontSize:"14px"}}>{f.name}</div>
                  <div style={{fontSize:"11px",color:T.sub,marginTop:"2px"}}>Per {f.serving} · 🔥 {f.nutrition?.calories||0} cal · 💪 {f.nutrition?.protein||0}g</div>
                  {f.note&&<div style={{fontSize:"11px",color:T.accent,marginTop:"2px"}}>💡 {f.note}</div>}
                </div>
                <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                  <button style={{...s.btnSm,fontSize:"11px"}} onClick={()=>addEntryWithRecent(f.name,f.nutrition)}>+ Log</button>
                  <span onClick={()=>deleteCustomFood(f.name)} style={{color:T.sub,cursor:"pointer",fontSize:"18px",marginLeft:"4px"}}>×</span>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"4px",marginTop:"8px"}}>
                {ALL_MACROS.slice(0,4).map(m=>(<div key={m.key} style={{background:T.card,borderRadius:"6px",padding:"4px",textAlign:"center"}}><div style={{fontSize:"9px",color:T.sub}}>{m.label}</div><div style={{fontSize:"11px",fontWeight:"bold",color:m.color}}>{f.nutrition?.[m.key]||0}</div></div>))}
              </div>
            </div>
          ))}
        </div>)}

        {customFoods.length===0&&recentFoods.length===0&&(
          <div style={{...s.card,textAlign:"center",color:T.sub,padding:"32px"}}>
            <div style={{fontSize:"48px",marginBottom:"12px"}}>🥩</div>
            <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"6px"}}>Your food database is empty!</div>
            <div style={{fontSize:"13px"}}>Search any food above — ox tail, muenster cheese, tamales, whatever you actually eat — and save it here forever!</div>
          </div>
        )}
      </>)}

      {/* GAME */}
      {tab==="game"&&(<div style={{...s.card,textAlign:"center",background:"linear-gradient(135deg,#030712,#1a0a2e)",border:`1px solid #f59e0b44`}}>
        <div style={{fontSize:"64px",marginBottom:"10px"}}>👑</div>
        <div style={{fontSize:"24px",fontWeight:"bold",background:"linear-gradient(135deg,#f59e0b,#f43f5e,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"3px",marginBottom:"4px"}}>LUCAC LEGENDS</div>
        <div style={{color:"#64748b",fontSize:"13px",marginBottom:"20px"}}>5 worlds · 25 levels · Draw your way to victory!</div>
        <button onClick={()=>setShowGame(true)} style={{background:"linear-gradient(135deg,#f59e0b,#f97316)",border:"none",borderRadius:"16px",padding:"16px 48px",fontSize:"20px",fontWeight:"bold",color:"#000",cursor:"pointer",width:"100%",boxShadow:"0 0 30px #f59e0b66"}}>▶ PLAY!</button>
      </div>)}

      {/* CALENDAR */}
      {tab==="calendar"&&(<>
        <div style={{...s.card,borderLeft:"3px solid #4ade80",padding:"10px 16px"}}><div style={{fontSize:"12px",color:"#4ade80"}}>⚡ Live sync — events from any phone show everywhere instantly!</div></div>
        {!isKid&&(<div style={s.card}>
          <div style={s.h2}>📅 Add Event</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            <input style={s.inp} placeholder="Event name (Soccer Practice, Doctor, School Play...)..." value={appt.title} onChange={e=>setAppt(a=>({...a,title:e.target.value}))}/>
            <div style={s.row}>
              <input style={{...s.inp,flex:1}} type="date" value={appt.date} onChange={e=>setAppt(a=>({...a,date:e.target.value}))}/>
              <input style={{...s.inp,flex:1}} type="time" value={appt.time} onChange={e=>setAppt(a=>({...a,time:e.target.value}))}/>
            </div>
            <input style={s.inp} placeholder="Who is this for? (Yana, Luca, Everyone, Dada...)" value={appt.assignedTo} onChange={e=>setAppt(a=>({...a,assignedTo:e.target.value}))}/>
            <input style={s.inp} placeholder="Notes (optional)" value={appt.note} onChange={e=>setAppt(a=>({...a,note:e.target.value}))}/>
            <div style={s.h3}>Repeats?</div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {[["once","One time"],["daily","Every day"],["weekly","Pick days"]].map(([v,l])=>(<span key={v} style={s.tag(appt.recurrence===v)} onClick={()=>setAppt(a=>({...a,recurrence:v}))}>{l}</span>))}
            </div>
            {appt.recurrence==="weekly"&&(<div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {DAYS.map((d,i)=>(<span key={i} style={s.tag(appt.days?.includes(i))} onClick={()=>setAppt(a=>({...a,days:a.days?.includes(i)?a.days.filter(x=>x!==i):[...(a.days||[]),i]}))}>{d}</span>))}
            </div>)}
            <button style={{...s.btn,background:getColor(appt.assignedTo||current?.name||"",personColors)}} onClick={()=>{if(!appt.title)return;saveEvent(appt);setAppt({title:"",date:"",time:"",note:"",assignedTo:"",recurrence:"once",days:[]});}}>📅 Save Event</button>
          </div>
        </div>)}
        <div style={s.card}>
          <div style={s.h2}>📋 Events</div>
          {sharedCal.length===0&&<div style={{color:T.sub,textAlign:"center",padding:"16px"}}>No events yet!</div>}
          {[...sharedCal].sort((a,b)=>{if(a.recurrence!=="once"&&b.recurrence==="once")return-1;if(a.recurrence==="once"&&b.recurrence!=="once")return 1;return new Date(a.date)-new Date(b.date);}).map((a,i)=>{
            const col=getColor(a.assignedTo||a.addedBy||"",personColors);
            return(<div key={i} style={{background:T.bg,borderRadius:"12px",padding:"12px",marginBottom:"8px",borderLeft:`4px solid ${col}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",gap:"10px",flex:1}}>
                  <div onClick={()=>toggleEvent(a)} style={{width:"22px",height:"22px",borderRadius:"50%",border:`2px solid ${col}`,background:a.done?col:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>{a.done&&<span style={{color:"#000",fontSize:"11px"}}>✓</span>}</div>
                  <div>
                    <div style={{fontWeight:"bold",textDecoration:a.done?"line-through":"none",fontSize:"14px"}}>{a.title}</div>
                    <div style={{color:col,fontSize:"12px",marginTop:"2px"}}>{a.recurrence==="daily"?"🔄 Every day":a.recurrence==="weekly"?`🔄 ${a.days?.map(d=>DAYS[d]).join(", ")}`:fmtDate(a.date)}{a.time?` · ${a.time}`:""}</div>
                    {a.assignedTo&&<div style={{fontSize:"11px",color:T.sub}}>👤 {a.assignedTo}</div>}
                    {a.note&&<div style={{fontSize:"11px",color:T.sub}}>{a.note}</div>}
                    {a.addedBy&&<div style={{fontSize:"10px",color:T.sub}}>Added by {a.addedBy}</div>}
                  </div>
                </div>
                {!isKid&&<span onClick={()=>deleteEvent(a.fbKey)} style={{color:T.sub,cursor:"pointer",fontSize:"20px",marginLeft:"8px"}}>×</span>}
              </div>
            </div>);
          })}
        </div>
      </>)}

      {/* ROUTINES */}
      {tab==="routines"&&(<>
        {!isKid&&(<div style={s.card}>
          <div style={s.h2}>🔄 Add Routine</div>
          <div style={{color:T.sub,fontSize:"13px",marginBottom:"12px"}}>Routines repeat automatically — brush teeth, bedtime, soccer, cuddle time 💙</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            <input style={s.inp} placeholder="Routine name (Brush Teeth, Cuddle Time, Soccer Practice...)..." value={routine.title} onChange={e=>setRoutine(r=>({...r,title:e.target.value}))}/>
            <div style={s.row}>
              <input style={{...s.inp,flex:1}} type="time" value={routine.time} onChange={e=>setRoutine(r=>({...r,time:e.target.value}))}/>
              <input style={{...s.inp,flex:1}} placeholder="Who? (Yana, Luca, Everyone...)" value={routine.assignedTo} onChange={e=>setRoutine(r=>({...r,assignedTo:e.target.value}))}/>
            </div>
            <input style={s.inp} placeholder="Notes (optional)" value={routine.note} onChange={e=>setRoutine(r=>({...r,note:e.target.value}))}/>
            <div style={s.h3}>How often?</div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {[["daily","Every day 🔄"],["weekly","Specific days 📅"]].map(([v,l])=>(<span key={v} style={s.tag(routine.recurrence===v)} onClick={()=>setRoutine(r=>({...r,recurrence:v}))}>{l}</span>))}
            </div>
            {routine.recurrence==="weekly"&&(<div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {DAYS.map((d,i)=>(<span key={i} style={s.tag(routine.days?.includes(i))} onClick={()=>setRoutine(r=>({...r,days:r.days?.includes(i)?r.days.filter(x=>x!==i):[...(r.days||[]),i]}))}>{d}</span>))}
            </div>)}
            <button style={s.btn} onClick={()=>{if(!routine.title.trim())return;saveRoutineFb(routine);setRoutine({title:"",time:"",assignedTo:"",recurrence:"daily",days:[],note:""});}}>🔄 Save Routine</button>
          </div>
        </div>)}
        {todayRoutines.length>0&&(<div style={s.card}>
          <div style={s.h2}>✅ Today — {new Date().toLocaleDateString("en-US",{weekday:"long"})}</div>
          {todayRoutines.map((r,i)=>{
            const done=r.doneOn?.[todayKey()]; const col=getColor(r.assignedTo||"",personColors);
            return(<div key={i} style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px",marginBottom:"8px",background:T.bg,borderRadius:"12px",borderLeft:`4px solid ${col}`,opacity:done?0.7:1}}>
              <div onClick={()=>toggleRoutine(r)} style={{width:"28px",height:"28px",borderRadius:"50%",border:`2px solid ${col}`,background:done?col:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done&&<span style={{color:"#000",fontSize:"14px"}}>✓</span>}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:"15px",fontWeight:"bold",textDecoration:done?"line-through":"none"}}>{r.title}</div>
                <div style={{fontSize:"12px",color:col}}>{r.assignedTo||"Everyone"}{r.time?` · ${r.time}`:""}</div>
                {r.note&&<div style={{fontSize:"11px",color:T.sub}}>{r.note}</div>}
              </div>
              {!isKid&&<span onClick={()=>deleteRoutine(r.fbKey)} style={{color:T.sub,cursor:"pointer",fontSize:"18px"}}>×</span>}
            </div>);
          })}
          <div style={{textAlign:"center",color:T.sub,fontSize:"13px",marginTop:"6px"}}>{todayRoutines.filter(r=>r.doneOn?.[todayKey()]).length}/{todayRoutines.length} done{todayRoutines.every(r=>r.doneOn?.[todayKey()])?" 🎉":""}</div>
        </div>)}
        <div style={s.card}>
          <div style={s.h2}>📋 All Routines</div>
          {routines.length===0&&<div style={{color:T.sub,textAlign:"center",padding:"16px"}}>No routines yet! Add brush teeth, soccer, cuddle time... 💙</div>}
          {routines.map((r,i)=>{
            const col=getColor(r.assignedTo||"",personColors);
            return(<div key={i} style={s.irow}>
              <div><div style={{fontWeight:"bold",fontSize:"14px"}}>{r.title}</div><div style={{fontSize:"12px",color:col,marginTop:"2px"}}>{r.recurrence==="daily"?"Every day":r.days?.map(d=>DAYS[d]).join(", ")}{r.time?` · ${r.time}`:""}{r.assignedTo?` · ${r.assignedTo}`:""}</div></div>
              {!isKid&&<span onClick={()=>deleteRoutine(r.fbKey)} style={{color:T.sub,cursor:"pointer",fontSize:"20px"}}>×</span>}
            </div>);
          })}
        </div>
      </>)}

      {/* CO-PARENTING */}
      {tab==="coparent"&&(<>
        {/* Whose day is it */}
        {(()=>{
          const dow=new Date().getDay();
          const dadHas=custody.dadDays?.includes(dow);
          const momHas=custody.momDays?.includes(dow);
          const whose=dadHas?"Dad's Day 👑":momHas?"Mom's Day 💜":"Weekend — check schedule";
          const whoseColor=dadHas?"#f59e0b":momHas?"#a78bfa":"#4ade80";
          return(
            <div style={{...s.card,borderLeft:`4px solid ${whoseColor}`,textAlign:"center"}}>
              <div style={{fontSize:"13px",color:T.sub,marginBottom:"4px",textTransform:"uppercase",letterSpacing:"1px"}}>Today is</div>
              <div style={{fontSize:"28px",fontWeight:"bold",color:whoseColor}}>{whose}</div>
              <div style={{fontSize:"12px",color:T.sub,marginTop:"6px"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
            </div>
          );
        })()}

        {/* Custody Schedule */}
        <div style={s.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
            <div style={s.h2}>📅 Custody Schedule</div>
            {isAdmin&&<button style={{...s.btnO,fontSize:"11px",padding:"4px 10px"}} onClick={()=>setPendingCustody({...custody})}>Edit</button>}
          </div>
          <div style={s.g2}>
            <div style={{background:T.bg,borderRadius:"12px",padding:"12px"}}>
              <div style={{fontSize:"12px",color:"#a78bfa",marginBottom:"6px",fontWeight:"bold"}}>💜 Mom's Days</div>
              <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>{custody.momDays?.map(d=><span key={d} style={{background:"#a78bfa22",color:"#a78bfa",borderRadius:"8px",padding:"3px 8px",fontSize:"12px"}}>{DAYS[d]}</span>)}</div>
            </div>
            <div style={{background:T.bg,borderRadius:"12px",padding:"12px"}}>
              <div style={{fontSize:"12px",color:"#f59e0b",marginBottom:"6px",fontWeight:"bold"}}>👑 Dad's Days</div>
              <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>{custody.dadDays?.map(d=><span key={d} style={{background:"#f59e0b22",color:"#f59e0b",borderRadius:"8px",padding:"3px 8px",fontSize:"12px"}}>{DAYS[d]}</span>)}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:"10px",marginTop:"12px",background:T.bg,borderRadius:"12px",padding:"12px"}}>
            <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:"11px",color:T.sub}}>Yana's Bedtime</div><div style={{fontWeight:"bold",color:T.accent}}>{custody.bedtimeYana||"8:00 PM"}</div></div>
            <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:"11px",color:T.sub}}>Luca's Bedtime</div><div style={{fontWeight:"bold",color:T.accent}}>{custody.bedtimeLuca||"8:00 PM"}</div></div>
          </div>
          {/* Pending change request */}
          {custody.pendingChange&&(<div style={{background:"#1a1000",border:"1px solid #f59e0b",borderRadius:"12px",padding:"12px",marginTop:"12px"}}>
            <div style={{color:"#f59e0b",fontWeight:"bold",marginBottom:"8px"}}>⏳ Schedule Change Requested by {custody.pendingChange.requestedBy}</div>
            <div style={{fontSize:"13px",marginBottom:"10px"}}>{custody.pendingChange.note}</div>
            {isAdmin&&custody.pendingChange.requestedBy!==current?.name&&(<div style={s.row}>
              <button style={{...s.btn,flex:1,fontSize:"13px"}} onClick={()=>fbSet("custody",{...custody,...custody.pendingChange.newSchedule,pendingChange:null})}>✅ Accept</button>
              <button style={{...s.btnO,flex:1,fontSize:"13px",borderColor:"#ef4444",color:"#ef4444"}} onClick={()=>fbSet("custody",{...custody,pendingChange:null})}>❌ Decline</button>
            </div>)}
            {custody.pendingChange.requestedBy===current?.name&&<div style={{fontSize:"12px",color:T.sub}}>Waiting for the other parent to approve...</div>}
          </div>)}
        </div>

        {/* Edit custody modal */}
        {pendingCustody&&isAdmin&&(<div style={{...s.card,border:`2px solid #f59e0b`}}>
          <div style={s.h2}>✏️ Edit Schedule</div>
          <div style={s.h3}>Mom's Days</div>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>{DAYS.map((d,i)=>(<span key={i} style={s.tag(pendingCustody.momDays?.includes(i),"#a78bfa")} onClick={()=>setPendingCustody(p=>({...p,momDays:p.momDays?.includes(i)?p.momDays.filter(x=>x!==i):[...(p.momDays||[]),i]}))
}>{d}</span>))}</div>
          <div style={s.h3}>Dad's Days</div>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>{DAYS.map((d,i)=>(<span key={i} style={s.tag(pendingCustody.dadDays?.includes(i),"#f59e0b")} onClick={()=>setPendingCustody(p=>({...p,dadDays:p.dadDays?.includes(i)?p.dadDays.filter(x=>x!==i):[...(p.dadDays||[]),i]}))}>{d}</span>))}</div>
          <div style={s.g2}>
            <div><div style={s.h3}>Yana Bedtime</div><input style={s.inp} type="time" value={pendingCustody.bedtimeYana||"20:00"} onChange={e=>setPendingCustody(p=>({...p,bedtimeYana:e.target.value}))}/></div>
            <div><div style={s.h3}>Luca Bedtime</div><input style={s.inp} type="time" value={pendingCustody.bedtimeLuca||"20:00"} onChange={e=>setPendingCustody(p=>({...p,bedtimeLuca:e.target.value}))}/></div>
          </div>
          <div style={{...s.row,marginTop:"12px"}}>
            <button style={{...s.btn,flex:1}} onClick={()=>{fbSet("custody",pendingCustody);setPendingCustody(null);}}>Save Changes</button>
            <button style={{...s.btnO,flex:1}} onClick={()=>setPendingCustody(null)}>Cancel</button>
          </div>
        </div>)}

        {/* Shared Rules */}
        <div style={s.card}>
          <div style={s.h2}>📋 House Rules — Both Homes</div>
          <div style={{color:T.sub,fontSize:"13px",marginBottom:"12px"}}>Rules both parents agree on. Either parent can propose, both must agree to add.</div>
          {!isKid&&(<div style={{...s.row,marginBottom:"14px"}}>
            <input style={{...s.inp,flex:1}} placeholder="Propose a rule (e.g. No phones on weekdays)..." value={newRule} onChange={e=>setNewRule(e.target.value)}/>
            <button style={s.btnSm} onClick={()=>{if(!newRule.trim())return;fbPush("coRules",{text:newRule,proposedBy:current?.name,status:"pending",id:Date.now()});setNewRule("");}}>+</button>
          </div>)}
          {coRules.length===0&&<div style={{color:T.sub,textAlign:"center",padding:"16px"}}>No rules yet — propose one above!</div>}
          {coRules.map((rule,i)=>(
            <div key={i} style={{background:T.bg,borderRadius:"12px",padding:"12px",marginBottom:"8px",borderLeft:`4px solid ${rule.status==="agreed"?"#4ade80":rule.status==="pending"?"#f59e0b":"#ef4444"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:"14px",fontWeight:"bold"}}>{rule.text}</div>
                  <div style={{fontSize:"11px",color:T.sub,marginTop:"2px"}}>Proposed by {rule.proposedBy} · {rule.status==="agreed"?"✅ Both agree":rule.status==="pending"?"⏳ Pending approval":"❌ Declined"}</div>
                </div>
                <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                  {rule.status==="pending"&&rule.proposedBy!==current?.name&&(<>
                    <button style={{...s.btnSm,background:"#4ade80",color:"#000",fontSize:"11px"}} onClick={()=>fbSet(`coRules/${rule.fbKey}`,{...rule,status:"agreed",agreedBy:current?.name})}>✅</button>
                    <button style={{...s.btnSm,background:"#ef4444",fontSize:"11px"}} onClick={()=>fbSet(`coRules/${rule.fbKey}`,{...rule,status:"declined"})}>❌</button>
                  </>)}
                  {isAdmin&&<span onClick={()=>fbDel(`coRules/${rule.fbKey}`)} style={{color:T.sub,cursor:"pointer",fontSize:"18px",marginLeft:"4px"}}>×</span>}
                </div>
              </div>
              {rule.privateNote&&isAdmin&&<div style={{fontSize:"11px",color:"#f59e0b",marginTop:"6px"}}>🔒 Your note: {rule.privateNote}</div>}
            </div>
          ))}
        </div>

        {/* SECRET Exchange Log — admin only, invisible label */}
        {isAdmin&&(<div style={{...s.card,borderLeft:"4px solid #4ade80"}}>
          <div style={s.h2}>📊 Exchange Log <span style={{fontSize:"11px",color:T.sub}}>🔒 Only you see this</span></div>
          <div style={{color:T.sub,fontSize:"13px",marginBottom:"12px"}}>Tap Start when you're waiting. Tap Arrived when kids show up. Timestamp is automatic and locked.</div>
          {!exchangeTimer
            ?<button style={{...s.btn,width:"100%",background:"#4ade80",color:"#000"}} onClick={()=>setExchangeTimer({start:new Date().toISOString(),label:new Date().toLocaleString()})}>⏱ Start — Waiting Now</button>
            :<div>
              <div style={{background:"#0f2010",borderRadius:"12px",padding:"12px",marginBottom:"10px"}}>
                <div style={{color:"#4ade80",fontWeight:"bold"}}>⏱ Timer running...</div>
                <div style={{fontSize:"13px",color:T.sub}}>Started: {new Date(exchangeTimer.start).toLocaleTimeString()}</div>
              </div>
              <input style={{...s.inp,marginBottom:"8px"}} placeholder="Notes (optional — e.g. kids dropped off, she was late)..." value={exchangeNote} onChange={e=>setExchangeNote(e.target.value)}/>
              <button style={{...s.btn,width:"100%"}} onClick={()=>{
                const arrived=new Date().toISOString();
                const mins=Math.round((new Date(arrived)-new Date(exchangeTimer.start))/60000);
                fbPush("exchangeLog",{startTime:exchangeTimer.start,arrivedTime:arrived,minutesWaited:mins,note:exchangeNote,loggedBy:current?.name,date:todayKey()});
                setExchangeTimer(null);setExchangeNote("");
              }}>✅ They Arrived — Log It</button>
            </div>
          }
          {exchangeLog.length>0&&(<div style={{marginTop:"14px"}}>
            <div style={s.h3}>Recent Logs</div>
            {[...exchangeLog].sort((a,b)=>new Date(b.startTime)-new Date(a.startTime)).slice(0,10).map((log,i)=>(
              <div key={i} style={{background:T.bg,borderRadius:"10px",padding:"10px",marginBottom:"6px"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div style={{fontSize:"13px",fontWeight:"bold"}}>{fmtDate(log.date)}</div>
                  <div style={{fontSize:"13px",color:log.minutesWaited>5?"#ef4444":"#4ade80",fontWeight:"bold"}}>{log.minutesWaited} min wait</div>
                </div>
                <div style={{fontSize:"11px",color:T.sub,marginTop:"2px"}}>{new Date(log.startTime).toLocaleTimeString()} → {new Date(log.arrivedTime).toLocaleTimeString()}</div>
                {log.note&&<div style={{fontSize:"12px",marginTop:"4px"}}>{log.note}</div>}
              </div>
            ))}
          </div>)}
        </div>)}
      </>)}

      {/* WORK */}
      {tab==="work"&&isAdmin&&(<>
        <div style={{...s.card,borderLeft:"4px solid #3b82f6"}}>
          <div style={{fontSize:"17px",fontWeight:"bold",color:"#3b82f6",marginBottom:"12px"}}>💼 Work Calendar <span style={{fontSize:"11px",color:T.sub}}>🔒 Private</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            <input style={s.inp} placeholder="Work event..." value={appt.title} onChange={e=>setAppt(a=>({...a,title:e.target.value}))}/>
            <div style={s.row}>
              <input style={{...s.inp,flex:1}} type="date" value={appt.date} onChange={e=>setAppt(a=>({...a,date:e.target.value}))}/>
              <input style={{...s.inp,flex:1}} type="time" value={appt.time} onChange={e=>setAppt(a=>({...a,time:e.target.value}))}/>
            </div>
            <input style={s.inp} placeholder="Notes..." value={appt.note} onChange={e=>setAppt(a=>({...a,note:e.target.value}))}/>
            <button style={{...s.btn,background:"#3b82f6"}} onClick={async()=>{if(!appt.title||!appt.date)return;await fbPush("workCal",{...appt,id:Date.now()});setAppt({title:"",date:"",time:"",note:"",assignedTo:"",recurrence:"once",days:[]});}}>Save Work Event</button>
          </div>
        </div>
        <div style={{...s.card,borderLeft:"4px solid #8b5cf6"}}>
          <div style={{fontSize:"17px",fontWeight:"bold",color:"#8b5cf6",marginBottom:"8px"}}>🤖 AI: Email → Calendar</div>
          <textarea style={s.txa} placeholder="Paste email text here..." value={aiEmail} onChange={e=>setAiEmail(e.target.value)}/>
          <button style={{...s.btn,background:"#8b5cf6",width:"100%",marginTop:"10px"}} onClick={parseEmail} disabled={aiLoad}>{aiLoad?"🤖 Reading...":"🤖 Extract Appointment"}</button>
          {aiRes&&!aiRes.error&&(<div style={{background:T.bg,borderRadius:"12px",padding:"14px",marginTop:"12px"}}>
            <div style={{color:"#8b5cf6",fontWeight:"bold",marginBottom:"10px"}}>✅ Found:</div>
            {[["Title",aiRes.title],["Date",aiRes.date],["Time",aiRes.time],["Note",aiRes.note]].map(([k,v])=>v?<div key={k} style={{fontSize:"14px",marginBottom:"5px"}}><span style={{color:T.sub}}>{k}: </span><b>{v}</b></div>:null)}
            <div style={{...s.row,marginTop:"12px"}}>
              <button style={{...s.btn,flex:1,background:"#3b82f6",fontSize:"13px"}} onClick={async()=>{await fbPush("workCal",{...aiRes,id:Date.now()});setAiRes(null);setAiEmail("");}}>Work 💼</button>
              <button style={{...s.btn,flex:1,fontSize:"13px"}} onClick={()=>{saveEvent({...aiRes,assignedTo:"",recurrence:"once",days:[]});setAiRes(null);setAiEmail("");}}>Family 📅</button>
            </div>
          </div>)}
        </div>
      </>)}

      {/* SETTINGS */}
      {tab==="settings"&&isAdmin&&(<div style={s.card}>
        <div style={s.h2}>⚙️ Settings</div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"18px"}}>
          {[["profile","Profile"],["colors","🎨 Colors"],["nutrition","Nutrition"],["alerts","🔔 Alerts"],["profiles","Family"],["info","Info"]].map(([id,lbl])=>(
            <button key={id} style={{...s.btnO,background:subSet===id?T.accent:"none",color:subSet===id?T.bg:T.accent,fontSize:"12px",padding:"7px 12px"}} onClick={()=>setSubSet(id)}>{lbl}</button>
          ))}
        </div>

        {subSet==="profile"&&(<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          <div style={s.h3}>Display Name</div>
          <input style={s.inp} defaultValue={current?.name} onChange={e=>saveProfiles(profiles.map(p=>p.id===current.id?{...p,name:e.target.value}:p))}/>
          <div style={s.h3}>Change PIN</div>
          <input style={s.inp} type="password" maxLength={4} placeholder="New 4-digit PIN..." onChange={e=>{if(e.target.value.length===4)saveProfiles(profiles.map(p=>p.id==="admin"?{...p,pin:e.target.value}:p));}}/>
        </div>)}

        {subSet==="colors"&&(<div>
          <div style={s.h3}>Color code each person — their events, tasks & card use their color</div>
          {profiles.map(p=>(<div key={p.id} style={s.irow}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"28px",height:"28px",borderRadius:"50%",background:getColor(p.name,personColors),border:`2px solid ${T.border}`}}/>
              <span>{p.emoji} {p.name}</span>
            </div>
            <input type="color" value={getColor(p.name,personColors)} onChange={e=>saveColor(p.name,e.target.value)} style={{width:"40px",height:"32px",borderRadius:"8px",border:"none",cursor:"pointer"}}/>
          </div>))}
          <div style={{color:T.sub,fontSize:"12px",marginTop:"10px"}}>Tap the color dot to change it. Syncs to all devices! 🎨</div>
        </div>)}

        {subSet==="nutrition"&&(<div>
          <div style={s.h3}>Track these macros</div>
          <div style={{marginBottom:"18px"}}>{ALL_MACROS.map(m=>(<span key={m.key} style={s.tag(myTracked.includes(m.key),m.color)} onClick={()=>updateTracked(m.key)}>{m.label}</span>))}</div>
          <div style={s.h3}>Daily Goals</div>
          {ALL_MACROS.filter(m=>myTracked.includes(m.key)).map(m=>(<div key={m.key} style={{...s.row,marginBottom:"10px",alignItems:"center"}}>
            <span style={{color:m.color,fontSize:"13px",minWidth:"80px"}}>{m.label}</span>
            <input style={{...s.inp,flex:1}} type="number" value={myNutGoals[m.key]||""} onChange={e=>updateGoal(m.key,e.target.value)}/>
            <span style={{color:T.sub,fontSize:"12px",minWidth:"30px"}}>{m.unit}</span>
          </div>))}
        </div>)}

        {subSet==="alerts"&&(<div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div style={s.h3}>Get reminders on this device before events & routines</div>
          {!notifOn
            ?<button style={s.btn} onClick={enableNotif}>🔔 Turn On Reminders</button>
            :<div style={{background:"#0f2010",borderRadius:"12px",padding:"12px",color:"#4ade80",fontSize:"14px"}}>✅ Reminders are ON on this device!</div>
          }
          <div>
            <div style={s.h3}>How far in advance?</div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              {[5,10,15,30,60].map(m=>(<span key={m} style={s.tag(remindMins===m)} onClick={()=>{setRemindMins(m);store.set("remindMins",m);}}>{m} min</span>))}
            </div>
          </div>
          <div style={{background:T.bg,borderRadius:"12px",padding:"14px",color:T.sub,fontSize:"13px",lineHeight:1.8}}>
            💡 <b style={{color:T.text}}>To get reminders on your phone:</b><br/>
            1. Open this app in Chrome on your phone<br/>
            2. Tap ⋮ menu → "Add to Home Screen"<br/>
            3. Open from home screen icon<br/>
            4. Come here and tap "Turn On Reminders"<br/>
            5. You'll get pings even in the background!
          </div>
        </div>)}

        {subSet==="profiles"&&(<div>
          <div style={s.h3}>Add Family Member</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"18px"}}>
            <input style={s.inp} placeholder="Name..." value={newPName} onChange={e=>setNewPName(e.target.value)}/>
            <div style={s.row}>
              <input style={{...s.inp,flex:1}} placeholder="Emoji 😊" value={newPEmoji} onChange={e=>setNewPEmoji(e.target.value)}/>
              <select style={{...s.inp,flex:1}} value={newPType} onChange={e=>setNewPType(e.target.value)}><option value="family">Family (adult)</option><option value="kid">Kid (limited)</option></select>
            </div>
            <button style={s.btn} onClick={()=>{if(!newPName.trim())return;saveProfiles([...profiles,{id:`p_${Date.now()}`,name:newPName,emoji:newPEmoji||"😊",type:newPType}]);setNewPName("");setNewPEmoji("😊");}}>Add</button>
          </div>
          {profiles.map((p,i)=>(<div key={i} style={s.irow}>
            <div style={{display:"flex",gap:"10px",alignItems:"center"}}><div style={{width:"28px",height:"28px",borderRadius:"50%",background:getColor(p.name,personColors),display:"flex",alignItems:"center",justifyContent:"center"}}>{p.emoji}</div><div><div style={{fontSize:"14px",fontWeight:"bold"}}>{p.name}</div><div style={{fontSize:"12px",color:T.sub}}>{p.type}</div></div></div>
            {p.id!=="admin"&&<span onClick={()=>saveProfiles(profiles.filter((_,idx)=>idx!==i))} style={{color:T.sub,cursor:"pointer",fontSize:"22px"}}>×</span>}
          </div>))}
        </div>)}

        {subSet==="info"&&(<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {[["📱","LUCAC Life v6.0 — The Complete Edition"],["⚡","Firebase real-time sync across all devices"],["🔄","Recurring routines with daily checkmarks"],["🎨","Color coded per family member"],["🔔","Browser reminders with custom timing"],["🎮","LUCAC LEGENDS — 5 worlds, 25 levels"],["👾","Danyells the Dark Queen 💅"],["💙","Built for Yana, Luca & Dada"],["🏢","Lucac LLC"]].map(([icon,v])=>(<div key={icon} style={{background:T.bg,borderRadius:"12px",padding:"12px",display:"flex",gap:"10px",alignItems:"center"}}><span style={{fontSize:"20px"}}>{icon}</span><div style={{fontSize:"14px"}}>{v}</div></div>))}
        </div>)}
      </div>)}

      </div>
      {/* FLOATING AI ASSISTANT */}
      <div style={{position:"fixed",bottom:"90px",right:"16px",zIndex:150}}>
        <button onClick={()=>setShowAI(x=>!x)} style={{width:"56px",height:"56px",borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},#8b5cf6)`,border:"none",fontSize:"24px",cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {showAI?"✕":"🤖"}
        </button>
      </div>

      {showAI&&(<div style={{position:"fixed",bottom:"160px",right:"16px",left:"16px",zIndex:149,background:T.card,border:`1px solid ${T.border}`,borderRadius:"20px",boxShadow:"0 10px 40px rgba(0,0,0,0.5)",display:"flex",flexDirection:"column",maxHeight:"400px"}}>
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,fontWeight:"bold",color:T.accent,fontSize:"15px"}}>🤖 Ask the App AI</div>
        <div style={{flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:"8px",minHeight:"100px",maxHeight:"260px"}}>
          {aiChat.length===0&&(<div style={{color:T.sub,fontSize:"13px",textAlign:"center",padding:"20px"}}>Ask me anything!<br/>"What should Luca eat for breakfast?"<br/>"How many calories in 3 slices of muenster?"<br/>"Suggest a bedtime routine for 8 year old"</div>)}
          {aiChat.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{background:m.role==="user"?T.accent:T.bg,color:m.role==="user"?T.bg:T.text,borderRadius:"14px",padding:"8px 12px",maxWidth:"80%",fontSize:"13px",lineHeight:1.5}}>{m.content}</div>
            </div>
          ))}
          {aiChatLoad&&<div style={{color:T.sub,fontSize:"12px",padding:"8px"}}>🤖 thinking...</div>}
        </div>
        <div style={{padding:"10px",borderTop:`1px solid ${T.border}`,display:"flex",gap:"8px"}}>
          <input style={{...s.inp,flex:1,padding:"8px 12px"}} placeholder="Ask anything..." value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendAIChat(aiInput);}}/>
          <button style={{...s.btnSm,flexShrink:0}} onClick={()=>sendAIChat(aiInput)} disabled={aiChatLoad}>Send</button>
        </div>
      </div>)}

      <nav style={s.nav}>
        {tabs.map(t=>(<button key={t.id} style={s.nBtn(tab===t.id)} onClick={()=>setTab(t.id)}><span style={{fontSize:"18px"}}>{t.icon}</span><span>{t.label}</span></button>))}
      </nav>
    </div>
  );
}
