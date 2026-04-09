import { useState } from "react";
import { testGroqConnection } from "./aiAgent";
import { LEARNING_SUBJECTS, getCurriculum, getELI5 } from "./LearningEngine";

export default function SettingsTab({ V, THEMES, themeName, setThemeName, profiles, currentProfile, setCurrentProfile, widgetPrefs, setWidgetPref, fbSet, showToast, isAdmin, isParent, GROQ_KEY, cardStyle, btnPrimary, btnSecondary, inputStyle, alertMinutes, setAlertMinutes, callButtons, setCallButtons, contactDad, contactMom, curriculum = {}, learningStats = {} }) {
  const [settingsSubTab, setSettingsSubTab] = useState("profiles");
  const [profileNameEdit, setProfileNameEdit] = useState("");
  const [pinEdit, setPinEdit] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmoji, setNewMemberEmoji] = useState("😊");
  const [newMemberType, setNewMemberType] = useState("parent");
  const [saveFeedback, setSaveFeedback] = useState("");
  const [eliModal, setEliModal] = useState(null); // { subjectLabel, text } | null
  const [eliLoading, setEliLoading] = useState(false);

  function showSave(msg) { setSaveFeedback(msg); setTimeout(() => setSaveFeedback(""), 2000); }

  return (
    <div style={{padding:12}}>
      {saveFeedback && (
        <div style={{background:"#22c55e",color:"#fff",borderRadius:8,padding:"8px 14px",marginBottom:10,fontWeight:700,textAlign:"center"}}>
          ✓ {saveFeedback}
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {["profiles","theme",
          ...(isAdmin ? ["alerts","learning"] : []),
          ...((isAdmin || isParent) ? ["widgets","contacts"] : [])
        ].map(t=>(
          <button key={t} onClick={()=>setSettingsSubTab(t)}
            style={{...settingsSubTab===t?btnPrimary:btnSecondary,padding:"6px 12px",fontSize:12}}>
            {t==="profiles"?"👤 Profiles":t==="theme"?"🎨 Theme":t==="widgets"?"📦 Widgets":t==="contacts"?"📞 Contacts":t==="learning"?"📚 Learning":"🔔 Alerts"}
          </button>
        ))}
      </div>

      {settingsSubTab === "profiles" && (
        <div>
          {(isAdmin || isParent) && (
            <div style={cardStyle}>
              <div style={{fontWeight:700,color:V.accent,marginBottom:10}}>My Profile</div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:12,color:V.textMuted,marginBottom:3}}>Name</div>
                <div style={{display:"flex",gap:6}}>
                  <input value={profileNameEdit} onChange={e=>setProfileNameEdit(e.target.value)}
                    onFocus={e=>{if(!profileNameEdit)setProfileNameEdit(currentProfile?.name||"");e.target.select();}}
                    placeholder={currentProfile?.name||"Your name"}
                    style={{...inputStyle,flex:1}} />
                  <button onClick={()=>{
                    const name=profileNameEdit.trim()||currentProfile?.name;
                    const updated=(profiles||[]).map(p=>p.id===currentProfile?.id?{...p,name}:p);
                    fbSet("profiles",updated);setCurrentProfile(p=>({...p,name}));setProfileNameEdit("");showSave("Name saved!");
                  }} style={{...btnPrimary,padding:"8px 12px",fontSize:12}}>Save</button>
                </div>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:12,color:V.textMuted,marginBottom:3}}>PIN (4-15 characters, letters + numbers)</div>
                <div style={{display:"flex",gap:6}}>
                  <div style={{flex:1,position:"relative"}}>
                    <input type={showPin?"text":"password"} value={pinEdit} onChange={e=>setPinEdit(e.target.value)}
                      placeholder="New PIN" maxLength={15} style={{...inputStyle,paddingRight:40}} />
                    <button onClick={()=>setShowPin(!showPin)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",
                      background:"none",border:"none",cursor:"pointer",fontSize:16,padding:4}}>{showPin?"🙈":"👁"}</button>
                  </div>
                  <button onClick={()=>{
                    if(pinEdit.length>=4 && pinEdit.length<=15){
                      const updated=(profiles||[]).map(p=>p.id===currentProfile?.id?{...p,pin:pinEdit}:p);
                      fbSet("profiles",updated);setCurrentProfile(p=>({...p,pin:pinEdit}));setPinEdit("");showSave("PIN saved!");
                    } else { showToast("PIN must be 4-15 characters","error"); }
                  }} style={{...btnPrimary,padding:"8px 12px",fontSize:12}}>Save</button>
                </div>
              </div>
            </div>
          )}
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>Family Members</div>
            {(profiles||[]).map((p,i)=>(
              <div key={p.id} style={{padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:22}}>{p.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,color:p.color||V.textPrimary,fontSize:14}}>{p.name}</div>
                    <div style={{fontSize:11,color:V.textDim}}>
                      {p.type === "admin" ? "👑 Admin" : p.type === "parent" || p.type === "family" ? "👨‍👩‍👧 Parent" : p.type === "kid" ? "🧒 Kid" : "👤 Guest"}
                      {p.birthday ? ` · 🎂 ${p.birthday}` : ""}
                    </div>
                  </div>
                  <input type="color" value={p.color||"#f59e0b"} onChange={e=>{
                    const updated=(profiles||[]).map(pp=>pp.id===p.id?{...pp,color:e.target.value}:pp);
                    fbSet("profiles",updated);
                  }} style={{width:28,height:28,border:"none",borderRadius:4,cursor:"pointer",background:"none"}} />
                </div>
                {isAdmin && (
                  <div style={{display:"flex",gap:6,marginTop:6,marginLeft:30,flexWrap:"wrap"}}>
                    <select value={p.type || "kid"} onChange={e=>{
                      if (e.target.value === "admin" && p.type !== "admin") {
                        showToast("Only one admin allowed", "error"); return;
                      }
                      const updated=(profiles||[]).map(pp=>pp.id===p.id?{...pp,type:e.target.value}:pp);
                      fbSet("profiles",updated); showSave(`${p.name} is now ${e.target.value}`);
                    }} style={{...inputStyle,width:"auto",flex:"0 0 auto",padding:"4px 8px",fontSize:12}}>
                      {p.type === "admin" && <option value="admin">👑 Admin</option>}
                      <option value="parent">👨‍👩‍👧 Parent</option>
                      <option value="kid">🧒 Kid</option>
                      <option value="guest">👤 Guest</option>
                    </select>
                    {p.id === currentProfile?.id && (
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:11,color:V.textDim}}>PIN:</span>
                        <span style={{fontSize:12,color:V.textMuted,letterSpacing:2}}>{"●".repeat((p.pin||"").length) || "none"}</span>
                      </div>
                    )}
                    <select value={p.birthday ? p.birthday.split("-")[0] : ""} onChange={e=>{
                      const mm=e.target.value; const dd=p.birthday?p.birthday.split("-")[1]:"01";
                      const updated=(profiles||[]).map(pp=>pp.id===p.id?{...pp,birthday:mm?mm+"-"+dd:""}:pp);
                      fbSet("profiles",updated);
                    }} style={{...inputStyle,width:"auto",flex:1,padding:"4px 8px",fontSize:12}}>
                      <option value="">Month...</option>
                      {["01-Jan","02-Feb","03-Mar","04-Apr","05-May","06-Jun","07-Jul","08-Aug","09-Sep","10-Oct","11-Nov","12-Dec"].map(m=>{
                        const [val,label]=m.split("-"); return <option key={val} value={val}>{label}</option>;
                      })}
                    </select>
                    <select value={p.birthday ? p.birthday.split("-")[1] : ""} onChange={e=>{
                      const dd=e.target.value; const mm=p.birthday?p.birthday.split("-")[0]:"01";
                      const updated=(profiles||[]).map(pp=>pp.id===p.id?{...pp,birthday:dd?mm+"-"+dd:""}:pp);
                      fbSet("profiles",updated);
                    }} style={{...inputStyle,width:"auto",flex:1,padding:"4px 8px",fontSize:12}}>
                      <option value="">Day...</option>
                      {Array.from({length:31},(_,i)=>{const d=String(i+1).padStart(2,"0"); return <option key={d} value={d}>{i+1}</option>;})}
                    </select>
                    {p.type !== "admin" && (
                      <button onClick={()=>{
                        if(confirm(`Remove ${p.name} from your family?`)){
                          const updated=(profiles||[]).filter(pp=>pp.id!==p.id);
                          fbSet("profiles",updated); showSave(`${p.name} removed`);
                        }
                      }} style={{width:36,height:36,borderRadius:8,background:`${V.danger}15`,border:`1px solid ${V.danger}33`,
                        color:V.danger,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                        🗑️
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isAdmin && (
              <div style={{marginTop:10}}>
                <div style={{fontSize:12,color:V.textMuted,marginBottom:6}}>Add Family Member</div>
                <div style={{display:"flex",gap:6,marginBottom:6}}>
                  <input value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Name" style={{...inputStyle,flex:1}} />
                  <input value={newMemberEmoji} onChange={e=>setNewMemberEmoji(e.target.value)} placeholder="😊" style={{...inputStyle,width:60}} />
                </div>
                <select value={newMemberType} onChange={e=>setNewMemberType(e.target.value)} style={{...inputStyle,marginBottom:6}}>
                  <option value="parent">👨‍👩‍👧 Parent</option>
                  <option value="kid">🧒 Kid</option>
                  <option value="guest">👤 Guest</option>
                </select>
                <button onClick={()=>{
                  if(!newMemberName.trim())return;
                  const newP={id:Date.now()+"",name:newMemberName,emoji:newMemberEmoji||"😊",type:newMemberType,color:"#3b82f6",pin:""};
                  fbSet("profiles",[...(profiles||[]),newP]);
                  setNewMemberName("");setNewMemberEmoji("😊");showSave("Member added!");
                }} style={{...btnPrimary,width:"100%"}}>Add Member</button>
              </div>
            )}
          </div>
        </div>
      )}

      {settingsSubTab === "theme" && (
        <div style={cardStyle}>
          <div style={{fontWeight:700,color:V.accent,marginBottom:4,fontSize:15}}>App Theme</div>
          <div style={{fontSize:12,color:V.textMuted,marginBottom:14}}>Choose a look for the whole app</div>
          {Object.entries(THEMES).map(([key, t]) => {
            const active = themeName === key;
            return (
              <button key={key} onClick={() => { setThemeName(key); fbSet("themeName", key); showSave(`${t.label} theme applied!`); }}
                style={{
                  display:"flex", alignItems:"center", gap:12, width:"100%",
                  background: active ? `${t.accent}15` : V.bgCardAlt,
                  border: active ? `2px solid ${t.accent}` : `2px solid transparent`,
                  borderRadius: V.r3, padding:"14px 16px", marginBottom:V.sp2,
                  cursor:"pointer", transition:"border 0.15s, background 0.15s", textAlign:"left"
                }}>
                <span style={{fontSize:28}}>{t.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:V.textPrimary}}>
                    {t.label} {active && <span style={{fontSize:11,fontWeight:600,color:t.accent,marginLeft:6}}>Active</span>}
                  </div>
                  <div style={{fontSize:12,color:V.textMuted,marginTop:2}}>{t.desc}</div>
                </div>
                <div style={{display:"flex",gap:4}}>
                  {[t.bgApp, t.accent, t.calBgToday, t.textPrimary].map((c,i) => (
                    <div key={i} style={{width:16,height:16,borderRadius:"50%",background:c,
                      border:`1px solid ${t.borderSubtle}`}} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {settingsSubTab === "widgets" && (
        <div style={cardStyle}>
          <div style={{fontWeight:700,color:V.accent,marginBottom:4,fontSize:15}}>📦 Home Screen Widgets</div>
          <div style={{fontSize:12,color:V.textMuted,marginBottom:14}}>Control what appears on your home screen</div>
          {(() => {
            const profilePrefs = (widgetPrefs || {})[currentProfile?.name] || {};
            const allWidgets = [
              {key:"calendar",label:"Calendar",icon:"📅"},
              {key:"routines",label:"Routines",icon:"✅"},
              {key:"goals",label:"Goals",icon:"🎯"},
              {key:"stats",label:"Quick Stats",icon:"📊"},
              {key:"shopping",label:"Shopping List",icon:"🛒"},
              {key:"spotlight",label:"Daily Spotlight",icon:"✦"},
              {key:"birthdays",label:"Birthday Countdowns",icon:"🎂"},
            ];
            return (
              <div>
                {allWidgets.map(w => {
                  const pref = profilePrefs[w.key] || {};
                  const isHidden = pref.hidden;
                  return (
                    <div key={w.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${V.borderDefault}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:18}}>{w.icon}</span>
                        <div>
                          <div style={{fontSize:14,color:V.textPrimary,fontWeight:600}}>{pref.name || w.label}</div>
                          <div style={{fontSize:11,color:isHidden?V.danger:V.success,fontWeight:600}}>{isHidden?"Hidden":"Visible"}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <select value={pref.size||"default"} onChange={e=>{
                          setWidgetPref(w.key,{...pref,size:e.target.value});
                        }} style={{...inputStyle,width:"auto",padding:"3px 6px",fontSize:11}}>
                          <option value="compact">Small</option>
                          <option value="default">Default</option>
                          <option value="expanded">Large</option>
                        </select>
                        <button onClick={() => setWidgetPref(w.key, {...pref, hidden:!isHidden})}
                          style={{...isHidden?btnPrimary:btnSecondary,padding:"5px 10px",fontSize:11}}>
                          {isHidden?"Show":"Hide"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {settingsSubTab === "contacts" && (
        <div style={cardStyle}>
          <div style={{fontWeight:700,color:V.accent,marginBottom:10}}>📞 Call Buttons</div>
          <div style={{fontSize:12,color:V.textMuted,marginBottom:12}}>Add call buttons for kids to use. Shows on Kids tab.</div>
          {(contactDad || contactMom) && !callButtons.length && (
            <div style={{fontSize:11,color:V.textDim,marginBottom:8}}>
              <button onClick={()=>{
                const btns = [];
                if(contactDad) btns.push({id:Date.now()+"d",name:"Dada",number:contactDad,emoji:"📞",color:"#f59e0b"});
                if(contactMom) btns.push({id:Date.now()+"m",name:"Mom",number:contactMom,emoji:"📞",color:"#7c3aed"});
                fbSet("callButtons",btns); setCallButtons(btns); showSave("Migrated!");
              }} style={{...btnSecondary,fontSize:11,padding:"4px 10px"}}>Migrate old contacts →</button>
            </div>
          )}
          {(callButtons||[]).map((btn,i) => (
            <div key={btn.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`}}>
              <span style={{fontSize:20}}>{btn.emoji||"📞"}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:V.textPrimary,fontSize:14}}>{btn.name}</div>
                <div style={{fontSize:11,color:V.textDim}}>{btn.number}</div>
              </div>
              <div style={{width:20,height:20,borderRadius:"50%",background:btn.color||V.accent}} />
              <button onClick={()=>{
                const updated=(callButtons||[]).filter((_,j)=>j!==i);
                fbSet("callButtons",updated); setCallButtons(updated);
              }} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:V.danger,padding:4}}>🗑️</button>
            </div>
          ))}
          {isAdmin && (
            <div style={{marginTop:10,padding:10,background:V.bgCardAlt,borderRadius:V.r2}}>
              <div style={{fontSize:12,color:V.textMuted,marginBottom:6}}>Add Call Button</div>
              <div style={{display:"flex",gap:6,marginBottom:6}}>
                <input id="cb-name" placeholder="Name" style={{...inputStyle,flex:1}} />
                <input id="cb-number" placeholder="555-000-0000" style={{...inputStyle,flex:1}} />
              </div>
              <div style={{display:"flex",gap:6}}>
                <input id="cb-emoji" placeholder="📞" style={{...inputStyle,width:50}} />
                <input id="cb-color" type="color" defaultValue="#f59e0b" style={{width:44,height:38,border:"none",borderRadius:V.r2,cursor:"pointer"}} />
                <button onClick={()=>{
                  const n=document.getElementById("cb-name").value.trim();
                  const num=document.getElementById("cb-number").value.trim();
                  const em=document.getElementById("cb-emoji").value||"📞";
                  const col=document.getElementById("cb-color").value;
                  if(!n||!num) return;
                  const updated=[...(callButtons||[]),{id:Date.now()+"",name:n,number:num,emoji:em,color:col}];
                  fbSet("callButtons",updated); setCallButtons(updated);
                  document.getElementById("cb-name").value=""; document.getElementById("cb-number").value="";
                  showSave("Button added!");
                }} style={{...btnPrimary,padding:"8px 14px"}}>Add</button>
              </div>
            </div>
          )}
        </div>
      )}

      {isAdmin && settingsSubTab === "learning" && (
        <div>
          {/* ELI5 modal */}
          {eliModal && (
            <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
              onClick={()=>setEliModal(null)}>
              <div style={{background:V.bgCard,borderRadius:16,padding:20,maxWidth:360,width:"100%",border:`1px solid ${V.borderSubtle}`}}
                onClick={e=>e.stopPropagation()}>
                <div style={{fontWeight:700,color:V.accent,marginBottom:8,fontSize:15}}>📖 {eliModal.subjectLabel}</div>
                <div style={{fontSize:13,color:V.textPrimary,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{eliModal.text}</div>
                <button onClick={()=>setEliModal(null)} style={{...btnSecondary,marginTop:14,width:"100%"}}>Close</button>
              </div>
            </div>
          )}
          {/* Per-kid curriculum editor */}
          {(profiles||[]).filter(p=>p.type==="kid").map(p => {
            const config = getCurriculum(curriculum, p.name);
            const kidStats = learningStats?.[p.name] || {};
            function accuracy(subjId) {
              const attempts = Object.values(kidStats[subjId] || {});
              if (attempts.length < 3) return null;
              return attempts.filter(a=>a.correct).length / attempts.length;
            }
            return (
              <div key={p.id} style={{...cardStyle,marginBottom:12}}>
                <div style={{fontWeight:700,color:V.accent,marginBottom:10,fontSize:15}}>{p.emoji} {p.name}</div>
                {LEARNING_SUBJECTS.map(subj => {
                  const active = (config.activeSubjects||[]).includes(subj.id);
                  const acc = accuracy(subj.id);
                  return (
                    <div key={subj.id} style={{borderBottom:`1px solid ${V.borderDefault}`,paddingBottom:8,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                        <input type="checkbox" checked={active} id={`${p.id}-${subj.id}`}
                          onChange={e=>{
                            const next = e.target.checked
                              ? [...(config.activeSubjects||[]), subj.id]
                              : (config.activeSubjects||[]).filter(s=>s!==subj.id);
                            if (fbSet) fbSet(`curriculum/${p.name}/activeSubjects`, next);
                          }}
                          style={{width:18,height:18,cursor:"pointer",accentColor:V.accent}} />
                        <label htmlFor={`${p.id}-${subj.id}`} style={{fontSize:13,color:V.textPrimary,fontWeight:600,cursor:"pointer",flex:1}}>
                          {subj.label}
                        </label>
                        <button onClick={async()=>{
                          setEliLoading(true);
                          const text = await getELI5(GROQ_KEY, p.name, subj.id);
                          setEliLoading(false);
                          setEliModal({subjectLabel:subj.label,text});
                        }} disabled={eliLoading}
                          style={{...btnSecondary,padding:"6px 12px",fontSize:12,minHeight:36}}>
                          {eliLoading?"...":"💡 Refresh"}
                        </button>
                      </div>
                      {acc !== null && (
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{flex:1,height:6,background:V.bgElevated,borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${Math.round(acc*100)}%`,background:acc>=0.7?V.success:acc>=0.4?"#f59e0b":V.danger,borderRadius:3,transition:"width 0.4s"}} />
                          </div>
                          <span style={{fontSize:11,color:V.textMuted,fontWeight:700,minWidth:32}}>{Math.round(acc*100)}%</span>
                        </div>
                      )}
                      {acc === null && <div style={{fontSize:11,color:V.textDim}}>No data yet (need 3+ attempts)</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {(profiles||[]).filter(p=>p.type==="kid").length === 0 && (
            <div style={{...cardStyle,color:V.textMuted,fontSize:13}}>No kid profiles found. Add a kid in Profiles first.</div>
          )}
        </div>
      )}

      {isAdmin && settingsSubTab === "alerts" && (
        <div style={cardStyle}>
          <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>🔔 Event Reminders</div>
          <div style={{fontSize:13,color:V.textMuted,marginBottom:12}}>How many minutes before an event to get reminded?</div>
          <div style={{textAlign:"center",fontSize:36,fontWeight:800,color:"#f59e0b",marginBottom:6}}>{alertMinutes} min</div>
          <input type="range" min={1} max={120} value={alertMinutes} onChange={e=>setAlertMinutes(Number(e.target.value))}
            style={{width:"100%",accentColor:"#f59e0b",marginBottom:12}} />
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:V.textDim,marginBottom:12}}>
            <span>1 min</span><span>30 min</span><span>1 hour</span><span>2 hours</span>
          </div>
          <button onClick={()=>{fbSet("alertMinutes",alertMinutes);showSave("Alert saved!");}} style={{...btnPrimary,width:"100%"}}>💾 Save</button>
          <div style={{marginTop:16,paddingTop:12,borderTop:`1px solid ${V.borderDefault}`}}>
            <div style={{fontSize:12,color:V.textDim,marginBottom:6}}>AI Diagnostics</div>
            <button onClick={async()=>{
              showToast("Testing Groq connection...","info");
              const r = await testGroqConnection(GROQ_KEY);
              if(r.ok) showToast("Groq connected! Model works.","success");
              else showToast(`Groq failed: ${r.status || r.error}`,"error");
            }} style={{...btnSecondary,width:"100%",marginBottom:6}}>Test AI Connection</button>
            <div style={{fontSize:10,color:V.textDim}}>Key: {GROQ_KEY ? `${GROQ_KEY.slice(0,8)}... (${GROQ_KEY.length} chars)` : "MISSING"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
