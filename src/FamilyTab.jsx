import { useState, useEffect } from "react";
import { DAYS } from "./shared";
import BudgetTab from "./BudgetTab";

export default function FamilyTab({ V, profiles, currentProfile, events, visibleEvents, custodySchedule, custodyPattern, custodyOverrides, myRules, theirRules, sharedRules, ruleProposals, exchangeLog, budgetData, fbSet, showToast, isAdmin, isParent, cardStyle, btnPrimary, btnSecondary, inputStyle, getCustodyForDate, todayStr, GROQ_KEY }) {
  const [familySubTab, setFamilySubTab] = useState("schedule");
  const [newMyRule, setNewMyRule] = useState("");
  const [newTheirRule, setNewTheirRule] = useState("");
  const [newProposal, setNewProposal] = useState("");
  const [editingProposal, setEditingProposal] = useState(null);
  const [rewriteText, setRewriteText] = useState("");
  const [exchangeStart, setExchangeStart] = useState(null);
  const [exchangeTimer, setExchangeTimer] = useState(null);
  const [exchangeNote, setExchangeNote] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [editingCustodyPattern, setEditingCustodyPattern] = useState(null);
  const [custodyStartDate, setCustodyStartDate] = useState("");

  const CUSTODY_PRESETS = {
    "7-7": { label: "Week on / Week off", pattern: ["D","D","D","D","D","D","D","M","M","M","M","M","M","M"] },
    "2-2-3": { label: "2-2-3 alternating", pattern: ["D","D","M","M","D","D","D","M","M","D","D","M","M","M"] },
    "2-2-5-5": { label: "2-2-5-5", pattern: ["M","M","D","D","D","D","D","D","D","M","M","M","M","M"] },
  };

  function custodyColor(val) {
    if (val === "Dad") return "#fef3c7";
    if (val === "Mom") return "#f3e8ff";
    return V.bgCardAlt;
  }
  function custodyTextColor(val) {
    if (val === "Dad") return "#92400e";
    if (val === "Mom") return "#6b21a8";
    return V.textDim;
  }
  function cycleCustodyOverride(dateStr) {
    if (!isAdmin) return;
    const current = getCustodyForDate(dateStr);
    const next = current === "Free" ? "Dad" : current === "Dad" ? "Mom" : "Free";
    const updated = { ...(custodyOverrides||{}), [dateStr]: next };
    fbSet("custodyOverrides", updated);
  }
  function setCustodyPreset(presetKey) {
    if (!isAdmin) return;
    const preset = CUSTODY_PRESETS[presetKey];
    if (!preset) return;
    const startDate = todayStr;
    const cp = { pattern: preset.pattern, startDate, preset: presetKey };
    fbSet("custodyPattern", cp);
    showToast(`${preset.label} custody pattern set!`, "success");
  }
  function startExchange() {
    const now = new Date();
    setExchangeStart(now);
    const interval = setInterval(() => {}, 1000);
    setExchangeTimer(interval);
  }
  function logArrival(notes) {
    if (!exchangeStart) return;
    clearInterval(exchangeTimer);
    const now = new Date();
    const mins = Math.round((now - exchangeStart) / 60000);
    const entry = {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      waitMinutes: mins,
      notes: notes || "",
      timestamp: now.toISOString()
    };
    fbSet("exchangeLog", [...(exchangeLog||[]), entry]);
    setExchangeStart(null);
    setExchangeTimer(null);
  }

  useEffect(() => {
    if (!exchangeStart) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed(Math.round((new Date() - exchangeStart)/1000)), 1000);
    return () => clearInterval(iv);
  }, [exchangeStart]);

  return (
    <div style={{padding:12}}>
      <div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto"}}>
        {["calendar","schedule","proposals","shared",
          ...(isAdmin ? ["myrules","theirrules","log","budget"] : [])
        ].map(t=>(
          <button key={t} onClick={()=>setFamilySubTab(t)}
            style={{...familySubTab===t?btnPrimary:btnSecondary,whiteSpace:"nowrap",padding:"6px 12px",fontSize:12}}>
            {t==="calendar"?"📅 Calendar":t==="schedule"?"🔄 Custody":t==="proposals"?"📝 Proposals":t==="shared"?"🤝 Agreed Rules":t==="myrules"?"👑 My Rules":t==="theirrules"?"💜 Their Rules":t==="log"?"📋 Log":"💰 Budget"}
          </button>
        ))}
      </div>

      {/* FAMILY SHARED CALENDAR */}
      {familySubTab === "calendar" && (
        <div style={cardStyle}>
          <div style={{fontWeight:700,color:V.accent,marginBottom:10}}>📅 Family Calendar</div>
          <div style={{fontSize:12,color:V.textDim,marginBottom:12}}>Shared events visible to both parents. Private events are hidden.</div>
          {(() => {
            const today = new Date();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const weeks = [];
            for (let w = 0; w < 2; w++) {
              const days = [];
              for (let d = 0; d < 7; d++) {
                const dt = new Date(startOfWeek);
                dt.setDate(startOfWeek.getDate() + w * 7 + d);
                const ds = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
                const dayEvs = (visibleEvents[ds] || []).filter(ev => !ev.private);
                const custody = getCustodyForDate(ds);
                const isToday3 = ds === todayStr;
                days.push(
                  <div key={ds} style={{background:custodyColor(custody),borderRadius:6,padding:4,
                    border:isToday3?`2px solid ${V.accent}`:`1px solid ${V.borderDefault}`,minHeight:60}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:11,fontWeight:isToday3?800:500,color:isToday3?V.accent:V.textMuted}}>{dt.getDate()}</span>
                      <span style={{fontSize:8,fontWeight:700,color:custodyTextColor(custody)}}>{custody}</span>
                    </div>
                    {dayEvs.slice(0,2).map((ev,i) => {
                      const creatorColor = profiles?.find(p=>p.name===ev.creator)?.color || V.info;
                      return (
                        <div key={i} style={{fontSize:9,padding:"1px 3px",borderRadius:3,marginTop:2,
                          background:`${creatorColor}22`,borderLeft:`2px solid ${creatorColor}`,
                          overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",color:V.textPrimary}}>
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvs.length > 2 && <div style={{fontSize:8,color:V.textDim}}>+{dayEvs.length-2}</div>}
                  </div>
                );
              }
              weeks.push(
                <div key={w} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>{days}</div>
              );
            }
            return (
              <div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
                  {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:V.textDim}}>{d}</div>)}
                </div>
                {weeks}
              </div>
            );
          })()}
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <span style={{fontSize:10,color:"#92400e",fontWeight:600}}>■ Dad</span>
            <span style={{fontSize:10,color:"#6b21a8",fontWeight:600}}>■ Mom</span>
          </div>
        </div>
      )}

      {familySubTab === "schedule" && (
        <div style={cardStyle}>
          <div style={{fontWeight:700,color:V.accent,marginBottom:10}}>📅 Custody Schedule</div>
          {isAdmin && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:V.textDim,marginBottom:6}}>Custody pattern:</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                {Object.entries(CUSTODY_PRESETS).map(([key, p]) => (
                  <button key={key} onClick={() => {setCustodyPreset(key);setEditingCustodyPattern(null);}}
                    style={{...custodyPattern?.preset === key ? btnPrimary : btnSecondary, padding:"6px 10px", fontSize:11}}>
                    {p.label} {custodyPattern?.preset === key && "✓"}
                  </button>
                ))}
                <button onClick={() => {
                  setEditingCustodyPattern(custodyPattern?.pattern || ["D","D","D","D","D","D","D","M","M","M","M","M","M","M"]);
                  setCustodyStartDate(custodyPattern?.startDate || todayStr);
                }} style={{...editingCustodyPattern ? btnPrimary : btnSecondary, padding:"6px 10px", fontSize:11}}>
                  ✏️ Custom {editingCustodyPattern && "✓"}
                </button>
              </div>
              {editingCustodyPattern && (
                <div style={{padding:12,background:V.bgCardAlt,borderRadius:V.r2,marginBottom:8}}>
                  <div style={{fontSize:11,color:V.textDim,marginBottom:6}}>Tap each day to cycle: Dad → Mom → Free. This pattern repeats.</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
                    {editingCustodyPattern.map((val,i) => (
                      <button key={i} onClick={() => {
                        const next = val === "D" ? "M" : val === "M" ? "F" : "D";
                        const updated = [...editingCustodyPattern]; updated[i] = next; setEditingCustodyPattern(updated);
                      }} style={{width:40,height:44,borderRadius:6,cursor:"pointer",border:`1px solid ${V.borderDefault}`,
                        background: val==="D"?"#fef3c7":val==="M"?"#f3e8ff":V.bgCardAlt,
                        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:10}}>
                        <span style={{fontWeight:700,color:val==="D"?"#92400e":val==="M"?"#6b21a8":V.textDim}}>{val==="D"?"Dad":val==="M"?"Mom":"Free"}</span>
                        <span style={{fontSize:8,color:V.textDim}}>Day {i+1}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                    <button onClick={() => setEditingCustodyPattern([...editingCustodyPattern,"D"])}
                      style={{...btnSecondary,padding:"4px 10px",fontSize:11}}>+ Day</button>
                    {editingCustodyPattern.length > 7 && (
                      <button onClick={() => setEditingCustodyPattern(editingCustodyPattern.slice(0,-1))}
                        style={{...btnSecondary,padding:"4px 10px",fontSize:11}}>− Day</button>
                    )}
                    <span style={{fontSize:11,color:V.textDim}}>{editingCustodyPattern.length}-day cycle</span>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:11,color:V.textDim}}>Start date:</span>
                    <input type="date" value={custodyStartDate} onChange={e=>setCustodyStartDate(e.target.value)}
                      style={{...inputStyle,width:"auto",padding:"4px 8px",fontSize:12}} />
                  </div>
                  <button onClick={() => {
                    fbSet("custodyPattern",{pattern:editingCustodyPattern,startDate:custodyStartDate,preset:"custom"});
                    setEditingCustodyPattern(null);
                    showToast(`Custom ${editingCustodyPattern.length}-day custody pattern saved!`,"success");
                  }} style={{...btnPrimary,width:"100%"}}>Save Custom Pattern</button>
                </div>
              )}
              {custodyPattern && !editingCustodyPattern && <div style={{fontSize:11,color:V.textDim}}>
                {custodyPattern.preset === "custom" ? "Custom" : CUSTODY_PRESETS[custodyPattern.preset]?.label || "Custom"} pattern · Started {custodyPattern.startDate} · {custodyPattern.pattern.length}-day cycle
              </div>}
            </div>
          )}
          <div style={{fontSize:12,color:V.textDim,marginBottom:8}}>{isAdmin ? "Tap any day to override" : "View only"}</div>
          {(() => {
            const today = new Date();
            const rows = [];
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            for (let w = 0; w < 2; w++) {
              const cells = [];
              for (let d = 0; d < 7; d++) {
                const dt = new Date(startOfWeek);
                dt.setDate(startOfWeek.getDate() + w * 7 + d);
                const ds = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
                const val = getCustodyForDate(ds);
                const isOverride = custodyOverrides && custodyOverrides[ds];
                const isToday2 = ds === todayStr;
                cells.push(
                  <div key={ds} onClick={() => isAdmin && cycleCustodyOverride(ds)}
                    style={{textAlign:"center",padding:"8px 2px",borderRadius:8,cursor:isAdmin?"pointer":"default",
                      background:custodyColor(val),border:isToday2?`2px solid ${V.accent}`:`1px solid ${V.borderDefault}`,
                      position:"relative"}}>
                    <div style={{fontSize:10,color:V.textMuted}}>{DAYS[dt.getDay()]}</div>
                    <div style={{fontSize:13,fontWeight:700,color:isToday2?V.accent:V.textPrimary}}>{dt.getDate()}</div>
                    <div style={{fontSize:10,fontWeight:700,color:custodyTextColor(val)}}>{val}</div>
                    {isOverride && <div style={{position:"absolute",top:1,right:2,fontSize:8}}>✏️</div>}
                  </div>
                );
              }
              rows.push(<div key={w} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>{cells}</div>);
            }
            return rows;
          })()}
          <div style={{display:"flex",gap:12,marginTop:8}}>
            <span style={{fontSize:11,color:"#92400e",fontWeight:600}}>■ Dad</span>
            <span style={{fontSize:11,color:"#6b21a8",fontWeight:600}}>■ Mom</span>
            <span style={{fontSize:11,color:V.textDim}}>■ Free</span>
          </div>
        </div>
      )}

      {/* RULE PROPOSALS */}
      {familySubTab === "proposals" && (
        <div style={cardStyle}>
          <div style={{fontWeight:700,color:V.accent,marginBottom:10}}>📝 Rule Proposals</div>
          <div style={{fontSize:12,color:V.textDim,marginBottom:12}}>Propose rules for both households. The other parent can accept, decline, or rewrite.</div>
          {(isAdmin || isParent) && (
            <div style={{display:"flex",gap:6,marginBottom:12}}>
              <input value={newProposal} onChange={e=>setNewProposal(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter" && newProposal.trim()){
                  const proposal = {id:Date.now()+"",text:newProposal.trim(),proposedBy:currentProfile?.name,status:"pending",timestamp:new Date().toISOString()};
                  fbSet("ruleProposals",[...(ruleProposals||[]),proposal]); setNewProposal(""); showToast("Rule proposed!","success");
                }}}
                placeholder="Propose a new rule..." style={{...inputStyle,flex:1}} />
              <button onClick={()=>{
                if(!newProposal.trim()) return;
                const proposal = {id:Date.now()+"",text:newProposal.trim(),proposedBy:currentProfile?.name,status:"pending",timestamp:new Date().toISOString()};
                fbSet("ruleProposals",[...(ruleProposals||[]),proposal]); setNewProposal(""); showToast("Rule proposed!","success");
              }} style={{...btnPrimary,padding:"8px 14px"}}>Propose</button>
            </div>
          )}
          {(ruleProposals||[]).filter(p=>p.status==="pending"||p.status==="rewritten").map(p => {
            const isMyProposal = p.proposedBy === currentProfile?.name;
            const showActions = !isMyProposal && (isAdmin || isParent);
            const displayText = p.status === "rewritten" && p.rewriteText ? p.rewriteText : p.text;
            return (
              <div key={p.id} style={{padding:12,background:V.bgCardAlt,borderRadius:V.r2,marginBottom:8,
                borderLeft:`4px solid ${isMyProposal ? V.accent : V.info}`}}>
                <div style={{fontSize:13,color:V.textPrimary,marginBottom:4,fontWeight:600}}>"{displayText}"</div>
                <div style={{fontSize:11,color:V.textDim,marginBottom:8}}>
                  Proposed by {p.proposedBy} · {p.status === "rewritten" ? "Rewritten — needs your review" : "Pending"}
                </div>
                {showActions && editingProposal !== p.id && (
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{
                      const agreed = {text:displayText,proposedBy:p.proposedBy,acceptedBy:currentProfile?.name,agreedDate:new Date().toISOString()};
                      fbSet("sharedRules",[...(sharedRules||[]),agreed]);
                      fbSet("ruleProposals",(ruleProposals||[]).filter(r=>r.id!==p.id));
                      showToast("Rule accepted! Moved to Agreed Rules.","success");
                    }} style={{...btnPrimary,padding:"6px 12px",fontSize:12,background:V.success}}>✅ Accept</button>
                    <button onClick={()=>{
                      fbSet("ruleProposals",(ruleProposals||[]).filter(r=>r.id!==p.id));
                      showToast("Rule declined","info");
                    }} style={{...btnSecondary,padding:"6px 12px",fontSize:12,color:V.danger}}>❌ Decline</button>
                    <button onClick={()=>{setEditingProposal(p.id);setRewriteText(displayText);}}
                      style={{...btnSecondary,padding:"6px 12px",fontSize:12}}>✏️ Rewrite</button>
                  </div>
                )}
                {editingProposal === p.id && (
                  <div style={{marginTop:8}}>
                    <input value={rewriteText} onChange={e=>setRewriteText(e.target.value)}
                      style={{...inputStyle,marginBottom:6}} />
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{
                        const updated = (ruleProposals||[]).map(r=>r.id===p.id?{...r,status:"rewritten",rewriteText:rewriteText.trim(),rewrittenBy:currentProfile?.name}:r);
                        fbSet("ruleProposals",updated); setEditingProposal(null); setRewriteText(""); showToast("Rewrite sent back for review","info");
                      }} style={{...btnPrimary,padding:"6px 12px",fontSize:12}}>Send Rewrite</button>
                      <button onClick={()=>{setEditingProposal(null);setRewriteText("");}}
                        style={{...btnSecondary,padding:"6px 12px",fontSize:12}}>Cancel</button>
                    </div>
                  </div>
                )}
                {isMyProposal && p.status === "pending" && (
                  <div style={{fontSize:11,color:V.textDim,fontStyle:"italic"}}>Waiting for other parent to respond...</div>
                )}
              </div>
            );
          })}
          {!(ruleProposals||[]).filter(p=>p.status==="pending"||p.status==="rewritten").length && (
            <div style={{fontSize:13,color:V.textDim,textAlign:"center",padding:16}}>No pending proposals. Propose a rule above!</div>
          )}
        </div>
      )}

      {familySubTab === "myrules" && (
        <div>
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>👑 My House Rules</div>
            {(myRules||[]).map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`,fontSize:13}}>
                <span style={{color:V.textSecondary}}>• {r}</span>
                {isAdmin&&<button onClick={()=>fbSet("myRules",(myRules||[]).filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer"}}>✕</button>}
              </div>
            ))}
            {isAdmin&&(
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <input value={newMyRule} onChange={e=>setNewMyRule(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(fbSet("myRules",[...(myRules||[]),newMyRule]),setNewMyRule(""))}
                  placeholder="Add your rule..." style={{...inputStyle,flex:1}} />
                <button onClick={()=>{fbSet("myRules",[...(myRules||[]),newMyRule]);setNewMyRule("");}} style={{...btnPrimary}}>+</button>
              </div>
            )}
          </div>
        </div>
      )}

      {familySubTab === "theirrules" && (
        <div style={cardStyle}>
          <div style={{fontWeight:700,color:"#a855f7",marginBottom:10}}>💜 Their House Rules</div>
          {(theirRules||[]).map((r,i)=>(
            <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`,fontSize:13,color:V.textSecondary}}>• {r}</div>
          ))}
          {isAdmin&&(
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <input value={newTheirRule} onChange={e=>setNewTheirRule(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(fbSet("theirRules",[...(theirRules||[]),newTheirRule]),setNewTheirRule(""))}
                placeholder="Add their rule..." style={{...inputStyle,flex:1}} />
              <button onClick={()=>{fbSet("theirRules",[...(theirRules||[]),newTheirRule]);setNewTheirRule("");}} style={{...btnPrimary}}>+</button>
            </div>
          )}
        </div>
      )}

      {familySubTab === "shared" && (
        <div style={cardStyle}>
          <div style={{fontWeight:700,color:V.success,marginBottom:10}}>🤝 Agreed Rules</div>
          <div style={{fontSize:12,color:V.textDim,marginBottom:10}}>Rules both parents have agreed to. Propose new rules in the Proposals tab.</div>
          {(sharedRules||[]).map((r,i)=>{
            const text = typeof r === "string" ? r : r.text;
            const meta = typeof r === "object" ? r : null;
            return (
              <div key={i} style={{padding:"10px 0",borderBottom:`1px solid ${V.borderDefault}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,color:V.textPrimary,fontWeight:600}}>✓ {text}</span>
                  {isAdmin && <button onClick={()=>{
                    if(confirm(`Remove rule: "${text}"?`)){
                      fbSet("sharedRules",(sharedRules||[]).filter((_,j)=>j!==i)); showToast("Rule removed","info");
                    }
                  }} style={{background:"none",border:"none",color:V.danger,cursor:"pointer",fontSize:12,padding:4}}>✕</button>}
                </div>
                {meta?.proposedBy && (
                  <div style={{fontSize:10,color:V.textDim,marginTop:2}}>
                    Proposed by {meta.proposedBy}{meta.acceptedBy ? ` · Accepted by ${meta.acceptedBy}` : ""}
                    {meta.agreedDate ? ` · ${new Date(meta.agreedDate).toLocaleDateString()}` : ""}
                  </div>
                )}
              </div>
            );
          })}
          {!(sharedRules||[]).length && <div style={{fontSize:13,color:V.textDim,textAlign:"center",padding:16}}>No agreed rules yet. Start proposing!</div>}
        </div>
      )}

      {familySubTab === "log" && isAdmin && (
        <div>
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:"#f59e0b",marginBottom:8}}>⏱ Exchange Log</div>
            <div style={{fontSize:12,color:V.textDim,marginBottom:10}}>Track pickup/dropoff times. Only visible to you.</div>
            {!exchangeStart ? (
              <button onClick={startExchange} style={{...btnPrimary,width:"100%",padding:12}}>▶ Start Exchange Timer</button>
            ) : (
              <div>
                <div style={{textAlign:"center",fontSize:32,fontWeight:800,color:"#f59e0b",marginBottom:8}}>
                  {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}
                </div>
                <div style={{fontSize:12,color:V.textDim,textAlign:"center",marginBottom:10}}>Waiting since {exchangeStart.toLocaleTimeString()}</div>
                <input value={exchangeNote} onChange={e=>setExchangeNote(e.target.value)}
                  placeholder="Notes (optional)" style={{...inputStyle,marginBottom:8}} />
                <button onClick={()=>logArrival(exchangeNote)} style={{...btnPrimary,width:"100%",padding:12}}>✓ They Arrived</button>
              </div>
            )}
          </div>
          {(exchangeLog||[]).slice().reverse().slice(0,10).map((entry,i)=>(
            <div key={i} style={{...cardStyle,borderLeft:`3px solid ${entry.waitMinutes>15?"#ef4444":"#22c55e"}`}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontWeight:600,color:V.textSecondary,fontSize:13}}>{entry.date} {entry.time}</span>
                <span style={{color:entry.waitMinutes>15?"#ef4444":"#22c55e",fontWeight:700,fontSize:13}}>{entry.waitMinutes} min wait</span>
              </div>
              {entry.notes&&<div style={{fontSize:12,color:V.textMuted,marginTop:4}}>{entry.notes}</div>}
            </div>
          ))}
        </div>
      )}
      {familySubTab === "log" && !isAdmin && (
        <div style={{...cardStyle,color:V.textDim,textAlign:"center"}}>Exchange log is admin only.</div>
      )}
      {familySubTab === "budget" && (
        <BudgetTab V={V} currentProfile={currentProfile} fbSet={fbSet} GROQ_KEY={GROQ_KEY}
          showToast={showToast} profiles={profiles} custodySchedule={custodySchedule}
          budgetData={budgetData} isAdmin={isAdmin} />
      )}
    </div>
  );
}
