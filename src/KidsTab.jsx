import { useState } from "react";
import LucacLegends from "./LucacLegends";
import HomeworkHelper from "./HomeworkHelper";
import { triggerConfetti } from "./utils";

export default function KidsTab({ V, profiles, currentProfile, kidsData, chores, fbSet, showToast, isAdmin, isParent, cardStyle, btnPrimary, btnSecondary, inputStyle, contactDad, contactMom, GROQ_KEY }) {
  const [showGame, setShowGame] = useState(false);
  const [newTask, setNewTask] = useState({});
  const [selectedTaskEmoji, setSelectedTaskEmoji] = useState("📝");
  const [newChoreName, setNewChoreName] = useState("");
  const [newChoreEmoji, setNewChoreEmoji] = useState("🧹");
  const [newChoreKid, setNewChoreKid] = useState("");
  const [newChoreStars, setNewChoreStars] = useState(5);

  const TASK_EMOJIS = ["🧹","🍽️","🛏️","📚","🐕","🧺","🪥","🎒","🧸","🎨","🏃","🚿","🗑️","🪴","📝","👕","🧤","🥤","🍎","✏️","🎵","🐱","🚗","💤","🪣","📖","🎮","🧹","🪥","⭐"];
  const kidProfiles = (profiles||[]).filter(p => p.type === "kid");

  function getKidData(name) { return (kidsData || {})[name] || { points: 0, tasks: [] }; }
  function addKidTask(kidName) {
    const t = (newTask[kidName] || "").trim();
    if (!t) return;
    const kd = getKidData(kidName);
    const updated = { ...(kidsData||{}), [kidName]: { ...kd, tasks: [...(kd.tasks||[]), { text:t, done:false, emoji: selectedTaskEmoji }] }};
    fbSet("kidsData", updated);
    setNewTask({...newTask, [kidName]:""}); setSelectedTaskEmoji("📝");
    showToast("Task added!", "success");
  }
  function completeKidTask(kidName, idx) {
    const kd = getKidData(kidName);
    const tasks = [...(kd.tasks||[])];
    tasks[idx] = { ...tasks[idx], done: true };
    const points = (kd.points || 0) + 10;
    const updated = { ...(kidsData||{}), [kidName]: { ...kd, tasks, points }};
    fbSet("kidsData", updated);
    triggerConfetti(document.body, "small");
    showToast("Great job! +10 points! ⭐", "success");
  }

  if (showGame) {
    return (
      <div style={{ padding:12 }}>
        <button onClick={()=>setShowGame(false)} style={{...btnSecondary, marginBottom:12}}>← Back</button>
        <LucacLegends profile={currentProfile} kidsData={kidsData} fbSet={fbSet} />
      </div>
    );
  }

  return (
    <div style={{ padding:12 }}>
      {(isAdmin || isParent) && (
        <button onClick={()=>setShowGame(true)} style={{...btnPrimary, width:"100%", marginBottom:12, padding:14, fontSize:15}}>
          🎮 LUCAC Legends
        </button>
      )}
      {kidProfiles.map(kid => {
        const kd = getKidData(kid.name);
        return (
          <div key={kid.id} style={cardStyle}>
            {/* Header with name, points, call buttons */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:24 }}>{kid.emoji}</span>
                <div>
                  <div style={{ fontWeight:700, color:kid.color||"#f59e0b" }}>{kid.name}</div>
                  <div style={{ fontSize:12, color:V.textDim }}>⭐ {kd.points || 0} points</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {contactDad && <button onClick={()=>window.location.href=`tel:${contactDad}`} style={{...btnPrimary,padding:"4px 8px",fontSize:12}}>📞 Dada</button>}
                {contactMom && <button onClick={()=>window.location.href=`tel:${contactMom}`} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:12,cursor:"pointer",fontWeight:700}}>📞 Mom</button>}
              </div>
            </div>
            {/* Task cards grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginTop:8}}>
              {(kd.tasks||[]).map((task,i) => (
                <div key={i} onClick={()=>!task.done&&completeKidTask(kid.name,i)}
                  style={{minHeight:120,borderRadius:14,background:task.done?V.bgCardAlt:V.bgCard,
                    border:`2px solid ${task.done?V.borderDefault:V.accent}`,
                    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    padding:14,cursor:task.done?"default":"pointer",position:"relative",
                    opacity:task.done?0.5:1,boxShadow:task.done?"none":V.shadowCard}}>
                  {task.done && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:44,borderRadius:12,background:"rgba(255,255,255,0.3)",zIndex:1}}>✅</div>}
                  <div style={{fontSize:44,marginBottom:6}}>{task.emoji||"📝"}</div>
                  <div style={{fontSize:13,fontWeight:700,color:V.textPrimary,textAlign:"center",wordBreak:"break-word"}}>{task.text}</div>
                  {isAdmin && <button onClick={e=>{e.stopPropagation();
                    const tasks=[...(kd.tasks||[])]; tasks.splice(i,1);
                    fbSet("kidsData",{...(kidsData||{}),[kid.name]:{...kd,tasks}});
                  }} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.1)",border:"none",borderRadius:"50%",
                    width:24,height:24,fontSize:12,color:V.textDim,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>✕</button>}
                </div>
              ))}
            </div>
            {/* Emoji picker + add task (admin only) */}
            {isAdmin && (
              <div style={{marginTop:10}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(6,44px)",gap:4,marginBottom:8,justifyContent:"center"}}>
                  {TASK_EMOJIS.map((em,ei) => (
                    <button key={ei} onClick={()=>setSelectedTaskEmoji(em)}
                      style={{width:44,height:44,fontSize:20,borderRadius:10,cursor:"pointer",
                        border:selectedTaskEmoji===em?`2px solid ${V.accent}`:`1px solid ${V.borderSubtle}`,
                        background:selectedTaskEmoji===em?`${V.accent}22`:V.bgCardAlt,
                        display:"flex",alignItems:"center",justifyContent:"center"}}>{em}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <input value={newTask[kid.name]||""} onChange={e=>setNewTask({...newTask,[kid.name]:e.target.value})}
                    onKeyDown={e=>e.key==="Enter"&&addKidTask(kid.name)}
                    placeholder="New task..." style={{...inputStyle,flex:1,padding:"8px 12px",fontSize:13}} />
                  <button onClick={()=>addKidTask(kid.name)} style={{...btnPrimary,padding:"8px 14px",fontSize:14}}>Add</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!kidProfiles.length && <div style={{...cardStyle,color:V.textDim,textAlign:"center"}}>Add kids in Settings → Profiles</div>}

      {/* CHORES MANAGEMENT (admin/parent only) */}
      {(isAdmin || isParent) && (
        <div style={cardStyle}>
          <div style={{fontWeight:700,color:V.accent,marginBottom:10}}>📋 Manage Chores</div>
          {(chores||[]).map((chore,i) => {
            const completed = chore.completedBy && !chore.verified;
            return (
              <div key={chore.id||i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`}}>
                <span style={{fontSize:24}}>{chore.emoji||"📝"}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,color:V.textPrimary,fontSize:13}}>{chore.name}</div>
                  <div style={{fontSize:11,color:V.textDim}}>
                    For: {chore.assignedTo||"Anyone"} · ⭐ {chore.stars||5} stars
                    {completed && <span style={{color:V.accent,fontWeight:700}}> · Waiting for approval</span>}
                    {chore.verified && <span style={{color:V.success,fontWeight:700}}> · Verified ✓</span>}
                  </div>
                </div>
                {completed && (
                  <button onClick={()=>{
                    const updated=[...(chores||[])]; updated[i]={...updated[i],verified:true};
                    fbSet("chores",updated);
                    const kidName=chore.completedBy;
                    const kd=getKidData(kidName);
                    fbSet("kidsData",{...(kidsData||{}),[kidName]:{...kd,points:(kd.points||0)+(chore.stars||5)}});
                    triggerConfetti(document.body,"small");
                    showToast(`${kidName} earned ${chore.stars||5} stars! ⭐`,"success");
                  }} style={{...btnPrimary,padding:"6px 12px",fontSize:12,background:V.success}}>✅ Verify</button>
                )}
                <button onClick={()=>{
                  if(confirm(`Delete chore "${chore.name}"?`)){
                    fbSet("chores",(chores||[]).filter((_,j)=>j!==i));
                  }
                }} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:V.danger,padding:4}}>🗑️</button>
              </div>
            );
          })}
          {/* Add new chore form */}
          <div style={{marginTop:10,padding:10,background:V.bgCardAlt,borderRadius:V.r2}}>
            <div style={{fontSize:12,color:V.textMuted,marginBottom:6}}>Add Chore</div>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <input value={newChoreName} onChange={e=>setNewChoreName(e.target.value)} placeholder="Chore name"
                style={{...inputStyle,flex:1}} />
              <input value={newChoreEmoji} onChange={e=>setNewChoreEmoji(e.target.value)} placeholder="🧹"
                style={{...inputStyle,width:50}} />
            </div>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <select value={newChoreKid} onChange={e=>setNewChoreKid(e.target.value)} style={{...inputStyle,flex:1}}>
                <option value="">Assign to...</option>
                {kidProfiles.map(k=><option key={k.id} value={k.name}>{k.name}</option>)}
              </select>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:12,color:V.textDim}}>⭐</span>
                <input type="number" min={1} max={50} value={newChoreStars} onChange={e=>setNewChoreStars(Number(e.target.value)||5)}
                  style={{...inputStyle,width:50,padding:"4px 8px",fontSize:12}} />
              </div>
            </div>
            <button onClick={()=>{
              if(!newChoreName.trim())return;
              const chore={id:Date.now()+"",name:newChoreName.trim(),emoji:newChoreEmoji||"📝",assignedTo:newChoreKid,stars:newChoreStars,verified:false};
              fbSet("chores",[...(chores||[]),chore]);
              setNewChoreName("");setNewChoreEmoji("🧹");setNewChoreKid("");setNewChoreStars(5);
              showToast("Chore added!","success");
            }} style={{...btnPrimary,width:"100%"}}>Add Chore</button>
          </div>
        </div>
      )}

      {/* Homework Helper */}
      <HomeworkHelper V={V} profiles={profiles} kidsData={kidsData} fbSet={fbSet}
        GROQ_KEY={GROQ_KEY} showToast={showToast} />
    </div>
  );
}
