import { useState, useEffect } from "react";
import { groqFetch, SWATCH_COLORS, triggerConfetti, cacheGet, cacheSet } from "./utils";
import { DAYS, MONTHS, dateKey } from "./shared";
import { getActionPreviewLabel } from "./aiAgent";

// ── Local helper components (copied from App.jsx) ──

function formatTime(h, m, ampm) {
  const hh = String(h).padStart(2,"0");
  const mm = String(m).padStart(2,"0");
  return `${hh}:${mm} ${ampm}`;
}

function parseTime(timeStr) {
  if (!timeStr) return { h: 12, m: 0, ampm: "PM" };
  const parts = timeStr.split(" ");
  const ampm = parts[1] || "AM";
  const [hStr, mStr] = (parts[0] || "12:00").split(":");
  return { h: parseInt(hStr) || 12, m: parseInt(mStr) || 0, ampm };
}

function TimePicker({ value, onChange }) {
  const { h, m, ampm } = parseTime(value);
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const mins = ["00","05","10","15","20","25","30","35","40","45","50","55"];
  const selStyle = { background:"#f0f1f3", color:"#1f2937", border:"1px solid #d1d5db", borderRadius:6, padding:"6px 8px", fontSize:13 };
  return (
    <div style={{ display:"flex", gap:4, alignItems:"center" }}>
      <select value={h} onChange={e => onChange(formatTime(e.target.value, m, ampm))} style={selStyle}>
        {hours.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span style={{ color:"#6b7280" }}>:</span>
      <select value={String(m).padStart(2,"0")} onChange={e => onChange(formatTime(h, e.target.value, ampm))} style={selStyle}>
        {mins.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
      <select value={ampm} onChange={e => onChange(formatTime(h, m, e.target.value))} style={selStyle}>
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
}

function SwatchPicker({ value, onChange, label }) {
  const isCustom = value && !SWATCH_COLORS.some(c => c.hex === value);
  return (
    <div style={{ marginBottom:10 }}>
      {label && <div style={{ fontSize:12, color:"#6b7280", marginBottom:6 }}>{label}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6 }}>
        {SWATCH_COLORS.map(c => {
          const sel = value === c.hex;
          return (
            <button key={c.hex} onClick={() => onChange(c.hex)} title={c.label}
              style={{ width:44, height:44, borderRadius:10, background:c.hex, border: sel ? "3px solid #fff" : "2px solid transparent",
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: sel ? `0 0 0 2px ${c.hex}, 0 2px 8px ${c.hex}44` : "0 1px 3px rgba(0,0,0,0.15)",
                transition:"box-shadow 0.15s, border 0.15s" }}>
              {sel && <span style={{ color:"#fff", fontSize:18, fontWeight:700, textShadow:"0 1px 2px rgba(0,0,0,0.4)" }}>✓</span>}
            </button>
          );
        })}
        {/* Custom color option */}
        <label title="Custom color" style={{ width:44, height:44, borderRadius:10, cursor:"pointer",
          background: isCustom ? value : "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)",
          border: isCustom ? "3px solid #fff" : "2px solid transparent",
          boxShadow: isCustom ? `0 0 0 2px ${value}` : "0 1px 3px rgba(0,0,0,0.15)",
          display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
          {isCustom && <span style={{ color:"#fff", fontSize:18, fontWeight:700, textShadow:"0 1px 2px rgba(0,0,0,0.4)" }}>✓</span>}
          {!isCustom && <span style={{ fontSize:14, textShadow:"0 1px 2px rgba(0,0,0,0.4)", color:"#fff" }}>+</span>}
          <input type="color" value={value || "#3b82f6"} onChange={e => onChange(e.target.value)}
            style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer", width:"100%", height:"100%" }} />
        </label>
      </div>
    </div>
  );
}

function BlockStyleEditor({ style, onChange, onClose }) {
  const s = style || {};
  const [bg, setBg] = useState(s.bg || "#3b82f6");
  const [color, setColor] = useState(s.color || "#ffffff");
  const [size, setSize] = useState(s.size || 13);
  const [bold, setBold] = useState(s.bold || false);
  const [italic, setItalic] = useState(s.italic || false);
  const [cursive, setCursive] = useState(s.cursive || false);

  function save() {
    onChange({ bg, color, size, bold, italic, cursive });
    onClose();
  }

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:20, width:320, border:"1px solid #e5e7eb", boxShadow:"0 12px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ fontWeight:700, color:"#1f2937", marginBottom:14, fontSize:15 }}>🎨 Customize Block</div>
        <SwatchPicker label="Background Color" value={bg} onChange={setBg} />
        <SwatchPicker label="Text Color" value={color} onChange={setColor} />
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>Font Size: {size}px</div>
          <input type="range" min={10} max={24} value={size} onChange={e => setSize(Number(e.target.value))}
            style={{ width:"100%", accentColor:"#f59e0b" }} />
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <button onClick={() => setBold(!bold)} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #d1d5db", background: bold ? "#f59e0b" : "#f3f4f6", color: bold ? "#fff" : "#374151", fontWeight:700, cursor:"pointer" }}>B</button>
          <button onClick={() => setItalic(!italic)} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #d1d5db", background: italic ? "#f59e0b" : "#f3f4f6", color: italic ? "#fff" : "#374151", fontStyle:"italic", cursor:"pointer" }}>I</button>
          <button onClick={() => setCursive(!cursive)} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #d1d5db", background: cursive ? "#f59e0b" : "#f3f4f6", color: cursive ? "#fff" : "#374151", fontFamily:"cursive", cursor:"pointer" }}>C</button>
        </div>
        <div style={{ background: bg, borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:size, color, fontWeight: bold ? 700 : 400, fontStyle: italic ? "italic" : "normal", fontFamily: cursive ? "cursive" : "inherit" }}>
          Preview text
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={save} style={{ flex:1, padding:"10px", borderRadius:10, background:"#f59e0b", color:"#fff", fontWeight:700, border:"none", cursor:"pointer" }}>Save</button>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:10, background:"#f3f4f6", color:"#374151", border:"1px solid #d1d5db", cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main HomeTab component ──

export default function HomeTab({
  V, themeName, profiles, currentProfile,
  calYear, calMonth, setCalMonth, setCalYear,
  calView, setCalView, selectedDay, setSelectedDay,
  calendarSize, setCalendarSize,
  events, visibleEvents, eventStyles,
  addingEvents, setAddingEvents,
  editingStyle, setEditingStyle,
  eventPrivate, setEventPrivate,
  routines, routineStyles, goals, goalStyles,
  newRoutine, setNewRoutine, newGoal, setNewGoal,
  editingRoutineStyle, setEditingRoutineStyle,
  editingGoalStyle, setEditingGoalStyle,
  quickAddInput, setQuickAddInput, quickAddLoading,
  quickAddPreview, setQuickAddPreview,
  quickAddDeleteMatches, setQuickAddDeleteMatches,
  quickAddEditPreview, setQuickAddEditPreview,
  agentActions, setAgentActions,
  agentResponse, setAgentResponse,
  agentClarification, setAgentClarification,
  spotlightInput, setSpotlightInput,
  spotlightResponse, setSpotlightResponse,
  spotlightLoading, setSpotlightLoading,
  shoppingInput, setShoppingInput, shoppingList,
  editingWidget, setEditingWidget, widgetPrefs,
  birthdayExpanded, setBirthdayExpanded,
  quote, setQuote,
  suggestedGoals, setSuggestedGoals, goalsLoading,
  placeholderIdx,
  isRecording, startVoiceInput, stopVoiceInput,
  isAdmin, isParent, fbSet, showToast, GROQ_KEY,
  cardStyle, btnPrimary, btnSecondary, inputStyle,
  todayStr, todayCalories, foodLog,
  handleQuickAdd, confirmQuickAdd,
  executeDeleteMatch, executeEditMatch, executeAgentActions,
  saveEvents, deleteEvent, saveEventStyle, getEventStyle, getPersonColor,
  updateEventDuration, getWidgetPref, setWidgetPref,
  addRoutine, toggleRoutine, deleteRoutine,
  addGoal, toggleGoal, deleteGoal, suggestGoals,
  getUpcomingBirthdays, getDaysInMonth, getFirstDay,
  generateRepeats,
  todayKey, familyNames,
  getCustodyForDate,
  myRules, theirRules, sharedRules, exchangeLog, tab, setTab,
  setFamilySubTab,
}) {
  const today = new Date();

  // ── Daily Spark (T01) — self-growth widget for parent role ──
  const [sparkData, setSparkData] = useState(null);
  const [sparkLoading, setSparkLoading] = useState(false);
  const SPARK_CATEGORIES = ["growth", "mindfulness", "resilience", "joy", "connection"];
  const SPARK_EMOJIS = ["🌱", "💡", "🤩", "🙏", "🫶"];

  function parseSparkContent(raw) {
    const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
    let question = "", jokeSetup = "", jokePunchline = "", fact = "", tips = [];
    for (const line of lines) {
      if (line.startsWith("QUESTION:")) question = line.replace("QUESTION:", "").trim();
      else if (line.startsWith("TIPS:")) {
        tips = line.replace("TIPS:", "").split("•").map(s => s.trim()).filter(Boolean);
      } else if (line.startsWith("JOKE:")) {
        const jokeStr = line.replace("JOKE:", "").trim();
        if (jokeStr.includes("|")) {
          const parts = jokeStr.split("|");
          jokeSetup = parts[0].trim();
          jokePunchline = parts[1].trim();
        } else {
          jokeSetup = jokeStr;
          jokePunchline = "";
        }
      } else if (line.startsWith("FACT:")) fact = line.replace("FACT:", "").trim();
    }
    return { question, tips, jokeSetup, jokePunchline, fact };
  }

  async function fetchSpark(category, bypassCache = false) {
    if (!GROQ_KEY) return;
    const currentDate = new Date().toISOString().split('T')[0]; // always live date
    const cacheKey = `spark_${currentDate}_${category}`;
    if (!bypassCache) {
      const cached = cacheGet(cacheKey);
      if (cached) { setSparkData(cached); return; }
    }
    setSparkLoading(true);
    const result = await groqFetch(GROQ_KEY, [{
      role: "user",
      content: `Generate daily spark content for a co-parenting parent focused on personal growth. Theme: ${category}.

Format your response EXACTLY like this — no intro text, nothing else:
QUESTION: [A specific, honest self-reflection question about a real parenting/emotional challenge. No clichés.]
TIPS: [Practical tip 1 — unusual, specific, actionable] • [Practical tip 2] • [Practical tip 3]
JOKE: [A clean, light-hearted setup | punchline]
FACT: [A surprising, uplifting fact about human connection, resilience, or wellbeing]

For TIPS: give 3 real, out-of-the-ordinary techniques. Think cognitive reframing, nervous system regulation, communication shifts — not generic "take deep breaths" advice.`
    }], { maxTokens: 500 });
    setSparkLoading(false);
    if (result.ok && result.data) {
      const parsed = parseSparkContent(result.data);
      const newData = { ...parsed, category, date: currentDate, reaction: null };
      setSparkData(newData);
      cacheSet(cacheKey, newData);
    } else {
      showToast("Couldn't load Daily Spark — try again", "error");
    }
  }

  function saveSparkReaction(emoji) {
    const currentDate = new Date().toISOString().split('T')[0];
    const cacheKey = `spark_${currentDate}_${sparkData?.category}`;
    const updated = { ...sparkData, reaction: emoji };
    setSparkData(updated);
    cacheSet(cacheKey, updated);
    fbSet(`sparkReaction/${currentDate}`, emoji);
  }

  useEffect(() => {
    if (!isParent || isAdmin) return;
    const currentDate = new Date().toISOString().split('T')[0];
    const category = SPARK_CATEGORIES[new Date().getDay() % SPARK_CATEGORIES.length];
    // If sparkData is already fresh for today, skip fetch
    if (sparkData?.date === currentDate) return;
    fetchSpark(category);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]); // todayStr changes at midnight → triggers fresh fetch

  const QUICK_ADD_HINTS = [
    "Try: 'add soccer Tuesday 4pm for Luca'",
    "Try: 'how much did I spend this week?'",
    "Try: 'add milk to shopping list'",
    "Try: 'what's on the schedule tomorrow?'",
    "Try: 'rewrite this nicely: you were late again'",
    "Try: 'give me today's family briefing'",
  ];

  // ── Shared day detail popup — used by Skylight and Cozyla ──
  function renderDayPopup(dk) {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: V.bgOverlay, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: V.sp4, backdropFilter: "blur(4px)"
      }}
        onClick={e => { if(e.target === e.currentTarget) setSelectedDay(null); }}>
        <div style={{
          background: V.bgCard, borderRadius: V.r4, width: "100%", maxWidth: 420,
          maxHeight: "85vh", overflowY: "auto",
          border: `1px solid ${V.borderSubtle}`, boxShadow: V.shadowModal
        }}>
          <div style={{
            padding: `${V.sp4}px ${V.sp5}px`, borderBottom: `1px solid ${V.borderDefault}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            position: "sticky", top: 0, background: V.bgCard, zIndex: 1, borderRadius: `${V.r4}px ${V.r4}px 0 0`
          }}>
            <div>
              <div style={{ fontWeight: 800, color: V.accent, fontSize: 18 }}>
                {new Date(calYear, calMonth, selectedDay).toLocaleDateString("en-US",{weekday:"long"})}
              </div>
              <div style={{ fontSize: 13, color: V.textMuted, marginTop: 2 }}>
                {MONTHS[calMonth]} {selectedDay}, {calYear}
              </div>
            </div>
            <button onClick={() => setSelectedDay(null)}
              style={{ width: 36, height: 36, borderRadius: "50%", background: V.bgElevated,
                border: `1px solid ${V.borderSubtle}`, color: V.textMuted,
                fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ✕
            </button>
          </div>

          <div style={{ padding: V.sp5 }}>
            {(visibleEvents[dk]||[]).length > 0 && (
              <div style={{ marginBottom: V.sp4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: V.textDim, textTransform: "uppercase",
                  letterSpacing: 1, marginBottom: V.sp2 }}>
                  Events ({(visibleEvents[dk]||[]).length})
                </div>
                {(visibleEvents[dk]||[]).map((ev, idx) => {
                  const s = getEventStyle(dk, idx, ev);
                  const pColor = ev.who ? getPersonColor(ev.who) : V.info;
                  const dur = ev.duration || 60;
                  return (
                    <div key={idx} style={{
                      background: V.bgCardAlt, borderRadius: V.r2,
                      padding: `${V.sp3}px ${V.sp4}px`, marginBottom: V.sp2,
                      borderLeft: `4px solid ${s?.bg || pColor}`, position:"relative",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{
                          color: s?.color || V.textPrimary, fontSize: s?.size || 15, fontWeight: s?.bold ? 700 : 600,
                        }}>
                          {ev.repeat && <span style={{ marginRight:4 }}>🔁</span>}
                          {ev.title}
                          {(ev.isPrivate || ev.private) && isAdmin && (
                            <span style={{
                              fontSize: 11, fontWeight: 700, color: V.accent,
                              background: `${V.accent}18`, padding: "2px 8px",
                              borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4,
                              marginLeft: 6
                            }}>
                              🔒 Private
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: V.sp1, alignItems: "center" }}>
                          <button onClick={() => setEditingStyle({ dk: ev._baseDk || dk, idx: ev._baseIdx != null ? ev._baseIdx : idx })}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 4 }}>🎨</button>
                          {/* Edit/Delete: admin can edit all, parent can edit their own */}
                          {(isAdmin || ev.creator === currentProfile?.name) && <button onClick={() => {
                            const u = [...addingEvents];
                            u[0] = { title: ev.title, time: ev.time || "12:00 PM", who: ev.who || "", notes: ev.notes || "", repeat: ev.repeat || "none", repeatEnd: ev.repeatEnd || "", repeatCount: ev.repeatCount || 0, duration: ev.duration || 60 };
                            setAddingEvents(u);
                            deleteEvent(dk, idx, ev);
                            showToast("Event loaded for editing below", "info");
                          }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 4 }}>✏️</button>}
                          {(isAdmin || ev.creator === currentProfile?.name) && <button onClick={() => {
                            if (window.confirm(`Delete "${ev.title}"?${ev.repeat ? " This will delete the entire repeating series." : ""}`)) {
                              deleteEvent(dk, idx, ev);
                              showToast(`Deleted "${ev.title}"`, "success");
                            }
                          }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: V.danger, padding: 4 }}>🗑️</button>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: V.sp3, marginTop: V.sp1, flexWrap: "wrap", alignItems: "center" }}>
                        {ev.time && (
                          <span style={{ fontSize: 12, color: V.textDim, display: "flex", alignItems: "center", gap: 4 }}>
                            🕐 {ev.time}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: V.textDim }}>({dur} min)</span>
                        {ev.who && (
                          <span style={{ fontSize: 11, color: pColor, background: `${pColor}22`, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                            {ev.who}
                          </span>
                        )}
                      </div>
                      {ev.notes && <div style={{ fontSize: 12, color: V.textMuted, marginTop: V.sp2, lineHeight: 1.4 }}>{ev.notes}</div>}
                      {/* Resize handle */}
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, paddingTop:6, borderTop:`1px dashed ${V.borderDefault}` }}>
                        <span style={{ fontSize:11, color:V.textDim }}>Duration:</span>
                        <input type="range" min={30} max={480} step={15} value={dur}
                          onChange={e => updateEventDuration(dk, idx, Number(e.target.value), ev)}
                          style={{ flex:1, accentColor: V.accent, height:4 }} />
                        <span style={{ fontSize:11, color:V.textMuted, fontWeight:600, minWidth:42 }}>{dur >= 60 ? `${Math.floor(dur/60)}h${dur%60 ? " "+dur%60+"m":""}` : `${dur}m`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(visibleEvents[dk]||[]).length === 0 && (
              <div style={{ textAlign: "center", padding: `${V.sp5}px 0 ${V.sp4}px`, color: V.textDim, fontSize: 13 }}>
                {(isAdmin || isParent) ? "No events yet — add one below" : "No events on this day"}
              </div>
            )}

            {/* Add Event section — only for admin and parent */}
            {(isAdmin || isParent) && (
            <div style={{ borderTop: `1px solid ${V.borderDefault}`, paddingTop: V.sp4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: V.textDim, textTransform: "uppercase",
                letterSpacing: 1, marginBottom: V.sp3 }}>
                Add Event{addingEvents.length > 1 ? "s" : ""}
              </div>
              {addingEvents.map((ev, i) => (
                <div key={i} style={{ background: V.bgCardAlt, borderRadius: V.r2, padding: V.sp3, marginBottom: V.sp2 }}>
                  {addingEvents.length > 1 && <div style={{ fontSize: 11, color: V.textDim, marginBottom: V.sp1, fontWeight: 600 }}>Event {i+1}</div>}
                  <input placeholder="Event title" value={ev.title} onChange={e => {
                    const u = [...addingEvents]; u[i] = {...u[i], title:e.target.value}; setAddingEvents(u);
                  }} style={{ ...inputStyle, marginBottom: V.sp2 }} />
                  <div style={{ display: "flex", gap: V.sp2, marginBottom: V.sp2, flexWrap: "wrap" }}>
                    <TimePicker value={ev.time} onChange={val => {
                      const u = [...addingEvents]; u[i] = {...u[i], time:val}; setAddingEvents(u);
                    }} />
                    <select value={ev.who} onChange={e => {
                      const u = [...addingEvents]; u[i] = {...u[i], who:e.target.value}; setAddingEvents(u);
                    }} style={{ ...inputStyle, width: "auto", flex: 1 }}>
                      <option value="">Who?</option>
                      {familyNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <input placeholder="Notes (optional)" value={ev.notes} onChange={e => {
                    const u = [...addingEvents]; u[i] = {...u[i], notes:e.target.value}; setAddingEvents(u);
                  }} style={{ ...inputStyle, marginBottom: V.sp2 }} />
                  {/* Repeat + Duration */}
                  <div style={{ display:"flex", gap:V.sp2, flexWrap:"wrap", alignItems:"center" }}>
                    <select value={ev.repeat} onChange={e => {
                      const u = [...addingEvents]; u[i] = {...u[i], repeat:e.target.value}; setAddingEvents(u);
                    }} style={{ ...inputStyle, width:"auto", flex:1 }}>
                      <option value="none">No Repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <select value={ev.duration} onChange={e => {
                      const u = [...addingEvents]; u[i] = {...u[i], duration:Number(e.target.value)}; setAddingEvents(u);
                    }} style={{ ...inputStyle, width:"auto" }}>
                      {[30,45,60,90,120,180,240].map(m => <option key={m} value={m}>{m >= 60 ? `${Math.floor(m/60)}h${m%60 ? " "+m%60+"m":""}` : `${m}m`}</option>)}
                    </select>
                  </div>
                  {ev.repeat !== "none" && (
                    <div style={{ display:"flex", gap:V.sp2, marginTop:V.sp2, flexWrap:"wrap", alignItems:"center" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:V.textDim, marginBottom:2 }}>End date (optional)</div>
                        <input type="date" value={ev.repeatEnd} onChange={e => {
                          const u = [...addingEvents]; u[i] = {...u[i], repeatEnd:e.target.value}; setAddingEvents(u);
                        }} style={{ ...inputStyle, fontSize:12 }} />
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:V.textDim, marginBottom:2 }}>Or # times</div>
                        <input type="number" min={0} max={100} value={ev.repeatCount||""} placeholder="0" onChange={e => {
                          const u = [...addingEvents]; u[i] = {...u[i], repeatCount:Number(e.target.value)||0}; setAddingEvents(u);
                        }} style={{ ...inputStyle, width:70, fontSize:12 }} />
                      </div>
                    </div>
                  )}
                  {/* Alert dropdown */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:V.sp2 }}>
                    <span style={{ fontSize:12, color:V.textDim }}>🔔 Alert:</span>
                    <select value={ev.alert||"none"} onChange={e => {
                      const u = [...addingEvents]; u[i] = {...u[i], alert:e.target.value}; setAddingEvents(u);
                    }} style={{...inputStyle,width:"auto",flex:1,padding:"4px 8px",fontSize:12}}>
                      <option value="none">None</option>
                      <option value="0">At time of event</option>
                      <option value="5">5 min before</option>
                      <option value="15">15 min before</option>
                      <option value="30">30 min before</option>
                      <option value="60">1 hour before</option>
                      <option value="1440">1 day before</option>
                    </select>
                  </div>
                  {/* Private event toggle — admin only */}
                  {isAdmin && i === 0 && (
                    <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:V.sp2, cursor:"pointer", fontSize:13, color:V.textSecondary }}>
                      <input type="checkbox" checked={eventPrivate} onChange={e => setEventPrivate(e.target.checked)}
                        style={{ width:18, height:18, accentColor:V.accent }} />
                      🔒 Private (only you can see this event)
                    </label>
                  )}
                </div>
              ))}
              <button onClick={() => setAddingEvents(a => [...a, { title:"", time:"12:00 PM", who:"", notes:"", repeat:"none", repeatEnd:"", repeatCount:0, duration:60 }])}
                style={{ ...btnSecondary, width: "100%", marginBottom: V.sp2, fontSize: 13 }}>+ Add Another Event</button>
              <button onClick={saveEvents} style={{ ...btnPrimary, width: "100%" }}>
                Save {addingEvents.filter(e=>e.title.trim()).length > 1 ? `${addingEvents.filter(e=>e.title.trim()).length} Events` : "Event"}
              </button>
            </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // SKYLIGHT HOME — big monthly grid (default)
  // ═══════════════════════════════════════════
  function renderHomeSkylight() {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDay(calYear, calMonth);
    const allCells = [];
    for (let i = 0; i < firstDay; i++) allCells.push(null);
    for (let d = 1; d <= daysInMonth; d++) allCells.push(d);
    // Filter cells based on calendar view
    let cells = allCells;
    if (calView === "W" || calView === "2W" || calView === "3W") {
      const todayDate = today.getDate();
      const todayDow = today.getDay();
      const weekStart = todayDate - todayDow;
      const daysToShow = calView === "W" ? 7 : calView === "2W" ? 14 : 21;
      cells = [];
      for (let i = 0; i < daysToShow; i++) {
        const d = weekStart + i;
        if (d >= 1 && d <= daysInMonth) cells.push(d);
        else cells.push(null);
      }
      // Pad start to align with day of week
      const padStart = cells[0] ? new Date(calYear, calMonth, cells.find(d=>d)).getDay() : 0;
      for (let i = 0; i < padStart; i++) cells.unshift(null);
    }
    const isToday = (d) => d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const dk = selectedDay ? dateKey(calYear, calMonth, selectedDay) : null;

    const routinePref = getWidgetPref("routines");
    const goalPref = getWidgetPref("goals");
    const statsPref = getWidgetPref("stats");

    return (
      <div style={{ padding:12 }}>
        {/* ═══ AI QUICK ADD + VOICE (admin/parent only) ═══ */}
        {(isAdmin || isParent) && (
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          <button onClick={() => isRecording ? stopVoiceInput() : startVoiceInput(text => setQuickAddInput(text))}
            style={{ width:44, height:44, borderRadius:"50%", border:"none", cursor:"pointer", fontSize:18,
              background: isRecording ? V.danger : V.bgElevated, color: isRecording ? "#fff" : V.textMuted,
              animation: isRecording ? "pulse 1s infinite" : "none", flexShrink:0 }}>
            🎤
          </button>
          <input value={quickAddInput} onChange={e => setQuickAddInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleQuickAdd()}
            placeholder={QUICK_ADD_HINTS[placeholderIdx]}
            style={{ ...inputStyle, flex:1, padding:"10px 14px", fontSize:13, borderRadius:24 }} />
          <button onClick={handleQuickAdd} disabled={quickAddLoading || !quickAddInput.trim()}
            style={{ ...btnPrimary, borderRadius:24, padding:"10px 16px", fontSize:16, opacity: quickAddLoading ? 0.6 : 1 }}>
            {quickAddLoading ? "..." : "✨"}
          </button>
        </div>
        )}
        {/* Loading indicator */}
        {quickAddLoading && (
          <div style={{ textAlign:"center", padding:"8px 0", color:V.textMuted, fontSize:13, fontStyle:"italic" }}>
            Jr. is thinking<span style={{ display:"inline-block", animation:"pulse 1.5s infinite" }}>...</span>
          </div>
        )}

        {/* ═══ AGENT RESPONSE ═══ */}
        {agentResponse && !agentActions.length && !agentClarification && (
          <div style={{ ...cardStyle, border:`1px solid ${V.accent}33`, marginBottom:12 }}>
            <div style={{ fontSize:13, color:V.textPrimary, whiteSpace:"pre-wrap", lineHeight:1.5 }}>{agentResponse}</div>
            <button onClick={() => setAgentResponse("")} style={{ fontSize:11, color:V.textDim, background:"none", border:"none", cursor:"pointer", marginTop:4, padding:0 }}>Dismiss</button>
          </div>
        )}

        {/* ═══ AGENT ACTION PREVIEW CARDS ═══ */}
        {agentActions.length > 0 && (
          <div style={{ ...cardStyle, border:`2px solid ${V.accent}`, marginBottom:12 }}>
            <div style={{ fontWeight:700, color:V.accent, marginBottom:8 }}>Jr. wants to:</div>
            {agentActions.map((action, i) => (
              <div key={i} style={{ fontSize:13, color:V.textPrimary, marginBottom:6, padding:"8px 10px", background:V.bgCardAlt, borderRadius:V.r2, fontWeight:600 }}>
                {getActionPreviewLabel(action)}
              </div>
            ))}
            {agentResponse && <div style={{ fontSize:12, color:V.textMuted, marginTop:4, marginBottom:8 }}>{agentResponse}</div>}
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button onClick={() => { executeAgentActions(agentActions); setAgentResponse(""); }}
                style={{ ...btnPrimary, flex:1, minHeight:48, background:V.success, fontSize:15 }}>✅ Confirm</button>
              <button onClick={() => { setAgentActions([]); setAgentResponse(""); showToast("Cancelled","info"); }}
                style={{ ...btnSecondary, flex:1, minHeight:48, fontSize:15 }}>❌ Cancel</button>
            </div>
          </div>
        )}

        {/* ═══ AGENT CLARIFICATION ═══ */}
        {agentClarification && (
          <div style={{ ...cardStyle, border:`2px solid ${V.info}`, marginBottom:12 }}>
            <div style={{ fontSize:14, color:V.textPrimary, fontWeight:600, marginBottom:10 }}>{agentClarification.question}</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {(agentClarification.options || []).map((opt, i) => (
                <button key={i} onClick={() => {
                  setAgentClarification(null); setQuickAddInput(opt);
                  setTimeout(() => handleQuickAdd(), 100);
                }}
                  style={{ padding:"10px 16px", borderRadius:20, background:V.bgElevated, border:`1px solid ${V.borderSubtle}`,
                    color:V.textPrimary, cursor:"pointer", fontSize:13, fontWeight:600, minHeight:44 }}>
                  {opt}
                </button>
              ))}
            </div>
            <button onClick={() => setAgentClarification(null)}
              style={{ fontSize:11, color:V.textDim, background:"none", border:"none", cursor:"pointer", marginTop:8, padding:0 }}>Dismiss</button>
          </div>
        )}

        {/* AI Quick Add Preview (legacy — kept for backward compat) */}
        {quickAddPreview && (
          <div style={{ ...cardStyle, border:`2px solid ${V.accent}`, marginBottom:12 }}>
            <div style={{ fontWeight:700, color:V.accent, marginBottom:8 }}>Creating {quickAddPreview.totalInstances} event{quickAddPreview.totalInstances>1?"s":""}{quickAddPreview.repeatDesc}</div>
            {quickAddPreview.events.slice(0,5).map((ev,i) => (
              <div key={i} style={{ fontSize:13, color:V.textSecondary, marginBottom:4 }}>
                {ev.repeat && ev.repeat !== "none" && "🔁 "}{ev.title} — {ev.date} {ev.time || ""} {ev.who ? `(${ev.who})` : ""}
                {ev.repeat && ev.repeat !== "none" && ` · ${ev.repeat}${ev.repeatCount ? ` x${ev.repeatCount}` : ""}`}
              </div>
            ))}
            {quickAddPreview.events.length > 5 && <div style={{fontSize:12,color:V.textDim}}>+{quickAddPreview.events.length-5} more...</div>}
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button onClick={confirmQuickAdd} style={{ ...btnPrimary, flex:1 }}>Confirm</button>
              <button onClick={() => setQuickAddPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Delete confirmation cards */}
        {quickAddDeleteMatches && (
          <div style={{ ...cardStyle, border:`2px solid ${V.danger}`, marginBottom:12 }}>
            <div style={{ fontWeight:700, color:V.danger, marginBottom:8 }}>
              🗑️ Found {quickAddDeleteMatches.matches.length} "{quickAddDeleteMatches.keyword}" event{quickAddDeleteMatches.matches.length>1?"s":""}
            </div>
            {quickAddDeleteMatches.single ? (
              <div>
                <div style={{ fontSize:13, color:V.textSecondary, marginBottom:8 }}>
                  {quickAddDeleteMatches.matches[0].ev.title} — {quickAddDeleteMatches.matches[0].dk} {quickAddDeleteMatches.matches[0].ev.time || ""}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => executeDeleteMatch(quickAddDeleteMatches.matches[0].dk, quickAddDeleteMatches.matches[0].idx)}
                    style={{ ...btnPrimary, flex:1, background:V.danger }}>Delete</button>
                  <button onClick={() => setQuickAddDeleteMatches(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize:12, color:V.textDim, marginBottom:8 }}>Tap the one you want to delete:</div>
                {quickAddDeleteMatches.matches.slice(0,8).map((m, i) => (
                  <div key={i} onClick={() => executeDeleteMatch(m.dk, m.idx)}
                    style={{ padding:"10px 12px", background:V.bgCardAlt, borderRadius:V.r2, marginBottom:6, cursor:"pointer",
                      border:`1px solid ${V.borderDefault}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontWeight:600, color:V.textPrimary, fontSize:13 }}>{m.ev.title}</div>
                      <div style={{ fontSize:11, color:V.textDim }}>{m.dk} {m.ev.time || ""} {m.ev.who ? `· ${m.ev.who}` : ""}</div>
                    </div>
                    <span style={{ color:V.danger, fontSize:18 }}>🗑️</span>
                  </div>
                ))}
                <button onClick={() => setQuickAddDeleteMatches(null)} style={{ ...btnSecondary, width:"100%", marginTop:4 }}>Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Edit confirmation card */}
        {quickAddEditPreview && (
          <div style={{ ...cardStyle, border:`2px solid ${V.info}`, marginBottom:12 }}>
            <div style={{ fontWeight:700, color:V.info, marginBottom:8 }}>✏️ Edit Event</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:8, alignItems:"center", marginBottom:10 }}>
              <div style={{ padding:8, background:V.bgCardAlt, borderRadius:V.r2, fontSize:13, color:V.textMuted }}>
                <div style={{ fontWeight:600 }}>{quickAddEditPreview.ev.title}</div>
                <div style={{ fontSize:11 }}>{quickAddEditPreview.ev.time || "no time"}</div>
              </div>
              <span style={{ fontSize:18 }}>→</span>
              <div style={{ padding:8, background:`${V.info}15`, borderRadius:V.r2, fontSize:13, color:V.textPrimary, border:`1px solid ${V.info}33` }}>
                <div style={{ fontWeight:600 }}>{quickAddEditPreview.changes.title || quickAddEditPreview.ev.title}</div>
                <div style={{ fontSize:11 }}>{quickAddEditPreview.changes.time || quickAddEditPreview.ev.time || "no time"}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => executeEditMatch(quickAddEditPreview.dk, quickAddEditPreview.idx, quickAddEditPreview.changes)}
                style={{ ...btnPrimary, flex:1 }}>Confirm</button>
              <button onClick={() => setQuickAddEditPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ═══ DAILY SPOTLIGHT — admin only (Alex's motivational quote widget) ═══ */}
        {isAdmin && (
          <div style={{ background: V.bgCardAlt, borderRadius:10, padding:"10px 14px", marginBottom:12,
            border:`1px solid ${V.borderDefault}` }}>
            <div onClick={() => {
              groqFetch(GROQ_KEY, [{role:"user",content:"Give me one short motivational quote (under 15 words) for a single dad. Just the quote."}], {maxTokens:80})
                .then(r => { if(r.ok && r.data) { setQuote(r.data.replace(/"/g,"")); setSpotlightResponse(""); } });
            }} style={{ fontSize:13, color: V.textMuted, fontStyle:"italic", cursor:"pointer", marginBottom:spotlightResponse?8:0 }}>
              ✦ {spotlightResponse || quote} <span style={{fontSize:10,opacity:0.5}}>tap for new quote</span>
            </div>
            {spotlightLoading && <div style={{fontSize:12,color:V.textDim,fontStyle:"italic"}}>Thinking...</div>}
            <div style={{display:"flex",gap:6,marginTop:6}}>
              <input value={spotlightInput} onChange={e=>setSpotlightInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter" && spotlightInput.trim()){
                  setSpotlightLoading(true);
                  const q = spotlightInput.trim(); setSpotlightInput("");
                  groqFetch(GROQ_KEY, [{role:"user",content:q}], {maxTokens:300})
                    .then(r=>{setSpotlightLoading(false);if(r.ok&&r.data){setSpotlightResponse(r.data);fbSet("spotlightResponse",r.data);}
                      else{showToast("Couldn't reach AI — showing daily quote instead","error");}});
                }}}
                placeholder="Ask anything... facts, news, motivation"
                style={{...inputStyle,flex:1,padding:"6px 10px",fontSize:12,borderRadius:16}} />
              <button onClick={()=>{
                if(!spotlightInput.trim()) return;
                setSpotlightLoading(true);
                const q = spotlightInput.trim(); setSpotlightInput("");
                groqFetch(GROQ_KEY, [{role:"user",content:q}], {maxTokens:300})
                  .then(r=>{setSpotlightLoading(false);if(r.ok&&r.data){setSpotlightResponse(r.data);fbSet("spotlightResponse",r.data);}
                    else{showToast("Couldn't reach AI — showing daily quote instead","error");}});
              }} style={{...btnPrimary,borderRadius:16,padding:"6px 12px",fontSize:12}}>Ask</button>
            </div>
          </div>
        )}

        {/* ═══ DAILY SPARK — parent home widget (Danyells) ═══ */}
        {isParent && !isAdmin && (
          <div style={{ background: V.bgCardAlt, borderRadius:10, padding:"12px 14px", marginBottom:12,
            border:`1px solid ${V.borderDefault}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontWeight:700, fontSize:14, color:V.accent }}>✨ Daily Spark</div>
              <button onClick={() => {
                const cat = SPARK_CATEGORIES[new Date().getDay() % SPARK_CATEGORIES.length];
                fetchSpark(cat, true);
              }} disabled={sparkLoading}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:V.textDim,
                  padding:"2px 8px", borderRadius:8, opacity: sparkLoading ? 0.4 : 1 }}>
                {sparkLoading ? "Loading…" : "↻ Refresh"}
              </button>
            </div>

            {sparkLoading && (
              <div style={{ fontSize:12, color:V.textDim, fontStyle:"italic", textAlign:"center", padding:"10px 0" }}>
                Generating your spark…
              </div>
            )}

            {!sparkLoading && !sparkData && (
              <div style={{ textAlign:"center", padding:"8px 0" }}>
                <button onClick={() => {
                  const cat = SPARK_CATEGORIES[new Date().getDay() % SPARK_CATEGORIES.length];
                  fetchSpark(cat);
                }} style={{ ...btnPrimary, padding:"8px 16px", fontSize:13 }}>Load Today's Spark</button>
              </div>
            )}

            {!sparkLoading && sparkData && (
              <>
                {sparkData.question && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:V.textDim, textTransform:"uppercase",
                      letterSpacing:1, marginBottom:4 }}>Today's Question</div>
                    <div style={{ fontSize:13, color:V.textPrimary, lineHeight:1.5 }}>{sparkData.question}</div>
                  </div>
                )}
                {sparkData.tips?.length > 0 && (
                  <div style={{ marginBottom:10, padding:"8px 10px", background:`${V.accent}0d`, borderRadius:8,
                    border:`1px solid ${V.accent}22` }}>
                    <div style={{ fontSize:10, fontWeight:700, color:V.accent, textTransform:"uppercase",
                      letterSpacing:1, marginBottom:6 }}>💡 Try This</div>
                    {sparkData.tips.map((tip, i) => (
                      <div key={i} style={{ display:"flex", gap:8, marginBottom: i < sparkData.tips.length-1 ? 6 : 0 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:V.accent, flexShrink:0 }}>{i+1}.</span>
                        <span style={{ fontSize:13, color:V.textSecondary, lineHeight:1.5 }}>{tip}</span>
                      </div>
                    ))}
                  </div>
                )}
                {sparkData.jokeSetup && (
                  <div style={{ marginBottom:10, padding:"8px 10px", background:`${V.accent}12`, borderRadius:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:V.accent, marginBottom:3 }}>😄 Laugh Break</div>
                    <div style={{ fontSize:13, color:V.textSecondary }}>{sparkData.jokeSetup}</div>
                    {sparkData.jokePunchline && (
                      <div style={{ fontSize:13, color:V.textPrimary, fontWeight:600, marginTop:4,
                        borderTop:`1px dashed ${V.borderDefault}`, paddingTop:4 }}>
                        {sparkData.jokePunchline}
                      </div>
                    )}
                  </div>
                )}
                {sparkData.fact && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:V.textDim, textTransform:"uppercase",
                      letterSpacing:1, marginBottom:4 }}>Did You Know?</div>
                    <div style={{ fontSize:13, color:V.textMuted, lineHeight:1.5 }}>{sparkData.fact}</div>
                  </div>
                )}
                <div style={{ display:"flex", gap:6, justifyContent:"center",
                  paddingTop:8, borderTop:`1px solid ${V.borderDefault}` }}>
                  {SPARK_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => saveSparkReaction(emoji)}
                      aria-label={`React with ${emoji}`}
                      style={{ fontSize:22, background: sparkData.reaction === emoji ? `${V.accent}22` : "none",
                        border: sparkData.reaction === emoji ? `2px solid ${V.accent}` : "2px solid transparent",
                        borderRadius:"50%", width:44, height:44, cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ CALENDAR ═══ */}
        <div style={{
          background: V.bgCard, borderRadius: V.r3, border: `1px solid ${V.borderDefault}`,
          boxShadow: V.shadowCard, overflow: "hidden", marginBottom: V.sp3
        }}>
          <div style={{
            background: V.calBgHeader, padding: `${V.sp4}px ${V.sp5}px`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${V.borderDefault}`
          }}>
            <button onClick={() => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }}
              style={{ width: 44, height: 44, borderRadius: V.r2, background: V.bgElevated,
                border: `1px solid ${V.borderSubtle}`, color: V.textSecondary, fontSize: 20,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-label="Previous month">‹</button>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontWeight: 800, color: V.accent, fontSize: 22, letterSpacing: 0.5, lineHeight: 1.2 }}>{MONTHS[calMonth]}</div>
              <div style={{ fontSize: 13, color: V.textDim, fontWeight: 500, marginTop: 2 }}>{calYear}</div>
              <button onClick={() => { setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); }}
                style={{ background: V.accentGlow, border: `1px solid ${V.accent}33`, color: V.accent, fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 20, padding: "3px 14px", marginTop: 6 }}>Today</button>
              <div style={{ display:"flex", gap:4, marginTop:6, flexWrap:"wrap", justifyContent:"center" }}>
                {["W","2W","3W","M"].map(v => (
                  <button key={v} onClick={() => setCalView(v)}
                    style={{ padding:"2px 10px", borderRadius:12, fontSize:10, fontWeight:600, cursor:"pointer", border:"none",
                      background: calView === v ? V.accent : V.bgElevated, color: calView === v ? "#fff" : V.textDim }}>{v === "W" ? "1 Week" : v === "2W" ? "2 Weeks" : v === "3W" ? "3 Weeks" : "Month"}</button>
                ))}
                <span style={{width:1,background:V.borderSubtle,margin:"0 2px"}} />
                {[{k:"compact",l:"Small"},{k:"default",l:"Default"},{k:"expanded",l:"Large"}].map(s => (
                  <button key={s.k} onClick={() => {setCalendarSize(s.k);fbSet("calendarSize",s.k);}}
                    style={{ padding:"2px 8px", borderRadius:12, fontSize:10, fontWeight:600, cursor:"pointer", border:"none",
                      background: calendarSize === s.k ? V.info : V.bgElevated, color: calendarSize === s.k ? "#fff" : V.textDim }}>{s.l}</button>
                ))}
              </div>
              {/* Jump to month — CAL-02 forward scroll affordance */}
              <div style={{ marginTop:6, display:"flex", justifyContent:"center" }}>
                <select
                  aria-label="Jump to month"
                  value={`${calYear}-${calMonth}`}
                  onChange={e => {
                    const [y, m] = e.target.value.split("-").map(Number);
                    setCalYear(y);
                    setCalMonth(m);
                  }}
                  style={{ fontSize:11, borderRadius:10, padding:"4px 8px", border:`1px solid ${V.borderSubtle}`,
                    background:V.bgElevated, color:V.textSecondary, cursor:"pointer", minHeight:30 }}>
                  {Array.from({length:13}, (_,i) => {
                    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
                    const m = d.getMonth(); const y = d.getFullYear();
                    return <option key={`${y}-${m}`} value={`${y}-${m}`}>{MONTHS[m]} {y}</option>;
                  })}
                </select>
              </div>
            </div>
            <button onClick={() => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }}
              style={{ width: 44, height: 44, borderRadius: V.r2, background: V.bgElevated,
                border: `1px solid ${V.borderSubtle}`, color: V.textSecondary, fontSize: 20,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-label="Next month">›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: V.calBgWeekday, borderBottom: `1px solid ${V.borderDefault}` }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: (d === "Sun" || d === "Sat") ? V.accent + "99" : V.textDim, padding: `${V.sp2}px 0`, letterSpacing: 0.5, textTransform: "uppercase" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, background: V.borderDefault, padding: 1 }}>
            {cells.map((d, i) => {
              const cellH = calendarSize === "compact" ? 55 : calendarSize === "expanded" ? 110 : 85;
              if (!d) return <div key={i} style={{ background: V.bgApp, minHeight: cellH }} />;
              const dk2 = dateKey(calYear, calMonth, d);
              const dayEvents = visibleEvents[dk2] || [];
              const isTodayCell = isToday(d);
              const selected = selectedDay === d;
              const isWeekend = (i % 7 === 0) || (i % 7 === 6);
              return (
                <div key={i}
                  onClick={() => { setSelectedDay(d); setAddingEvents([{ title:"", time:"12:00 PM", who:"", notes:"", repeat:"none", repeatEnd:"", repeatCount:0, duration:60 }]); }}
                  style={{
                    minHeight: cellH, padding: V.sp1 + 2, cursor: "pointer",
                    background: selected ? V.calBgSelected : isTodayCell ? V.calBgToday : isWeekend ? V.bgApp : V.calBgCell,
                    boxShadow: isTodayCell ? `inset 0 0 0 2px ${V.accent}` : selected ? `inset 0 0 0 2px ${V.info}` : "none",
                    display: "flex", flexDirection: "column"
                  }}>
                  <div style={{ fontSize: isTodayCell ? 15 : 13, fontWeight: isTodayCell ? 800 : 500,
                    color: isTodayCell ? V.bgApp : selected ? V.textPrimary : V.textMuted, marginBottom: V.sp1,
                    display: "flex", alignItems: "center", gap: 4 }}>
                    {isTodayCell ? (
                      <span style={{ background: V.accent, color: V.bgApp, borderRadius: "50%", width: 26, height: 26,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 13, boxShadow: `0 0 8px ${V.accentGlowStrong}` }}>{d}</span>
                    ) : <span>{d}</span>}
                    {/* Custody badge — pattern-based, text label for colorblind safety */}
                    {(() => {
                      const custodyVal = getCustodyForDate(dk2);
                      if (custodyVal === "Dad") return <span style={{ fontSize:8, fontWeight:700, background:"#fef3c7", color:"#92400e", borderRadius:3, padding:"0 3px", lineHeight:"14px" }}>Dad</span>;
                      if (custodyVal === "Mom") return <span style={{ fontSize:8, fontWeight:700, background:"#f3e8ff", color:"#6b21a8", borderRadius:3, padding:"0 3px", lineHeight:"14px" }}>Mom</span>;
                      return null;
                    })()}
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
                    {dayEvents.slice(0,3).map((ev, idx) => {
                      const s = getEventStyle(dk2, idx, ev);
                      const hasPastel = V.pillColors && V.pillTextColors;
                      const pillBg = hasPastel ? V.pillColors[idx % V.pillColors.length] : `${s?.bg || (ev.who ? getPersonColor(ev.who) : V.info)}22`;
                      const pillText = hasPastel ? V.pillTextColors[idx % V.pillTextColors.length] : (s?.color || V.textPrimary);
                      const pillBorder = hasPastel ? V.pillTextColors[idx % V.pillTextColors.length] + "55" : (s?.bg || (ev.who ? getPersonColor(ev.who) : V.info));
                      const initials = ev.who ? ev.who.slice(0,2) : "";
                      return (
                        <div key={idx} style={{
                          background: s?.bg ? `${s.bg}22` : pillBg, borderLeft: `3px solid ${s?.bg || pillBorder}`,
                          color: s?.color || pillText, fontSize: 10, fontWeight: 600, borderRadius: V.r1, padding: "2px 5px",
                          overflow: "hidden", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3,
                          maxHeight: 28,
                        }}>
                          {ev.repeat && <span style={{ marginRight:2 }}>🔁</span>}
                          {initials ? <span style={{ fontWeight:700, marginRight:3, opacity:0.7 }}>{initials}</span> : null}
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && <div style={{ fontSize: 9, color: V.textDim, fontWeight: 600 }}>+{dayEvents.length-3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ DAY DETAIL POPUP ═══ */}
        {selectedDay && renderDayPopup(dk)}

        {/* ═══ WIDGETS: Routines + Goals ═══ */}
        {(!routinePref.hidden || !goalPref.hidden) && (
          <div style={{ display:"grid", gridTemplateColumns: routinePref.hidden || goalPref.hidden ? "1fr" : "1fr 1fr", gap:12 }}>
            {!routinePref.hidden && (
              <div style={{ ...cardStyle, margin:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontWeight:700, color: V.success, fontSize:14 }}>✅ {routinePref.name || "Routines"}</div>
                  <button onClick={() => setEditingWidget("routines")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, padding:2 }}>✏️</button>
                </div>
                {(routines||[]).map((r, i) => {
                  const s = routineStyles?.[i] || {};
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6,
                      background: s.bg || "transparent", borderRadius:6, padding: s.bg ? "4px 6px" : "0",
                      minHeight: 28, maxHeight: 40, overflow: "hidden" }}>
                      <div onClick={() => toggleRoutine(i)} style={{ width:18, height:18, borderRadius:4,
                        background: r.done ? V.success : V.borderSubtle, cursor:"pointer", flexShrink:0,
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {r.done && <span style={{ color:"#fff", fontSize:11 }}>✓</span>}
                      </div>
                      <span style={{ flex:1, fontSize: Math.min(s.size||13, 16), color: s.color||(r.done? V.textDim : V.textSecondary),
                        textDecoration: r.done?"line-through":"none", fontWeight: s.bold?700:400 }}>
                        {r.text}
                        {r.streakCount > 0 && <span style={{ marginLeft:4, fontSize:11, textDecoration:"none" }}>🔥{r.streakCount}{r.hasCrown ? " 👑" : ""}</span>}
                      </span>
                      <button onClick={() => setEditingRoutineStyle(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13 }}>🎨</button>
                      <button onClick={() => deleteRoutine(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color: V.danger }}>✕</button>
                    </div>
                  );
                })}
                <div style={{ display:"flex", gap:4, marginTop:4 }}>
                  <input value={newRoutine} onChange={e=>setNewRoutine(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addRoutine()}
                    placeholder="Add routine..." style={{ ...inputStyle, flex:1, padding:"6px 10px", fontSize:12 }} />
                  <button onClick={addRoutine} style={{ ...btnPrimary, padding:"6px 10px" }}>+</button>
                </div>
              </div>
            )}
            {!goalPref.hidden && (
              <div style={{ ...cardStyle, margin:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontWeight:700, color: V.pink, fontSize:14 }}>🎯 {goalPref.name || "Goals"}</div>
                  <button onClick={() => setEditingWidget("goals")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, padding:2 }}>✏️</button>
                </div>
                {(goals||[]).map((g, i) => {
                  const s = goalStyles?.[i] || {};
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6,
                      background: s.bg || "transparent", borderRadius:6, padding: s.bg ? "4px 6px" : "0" }}>
                      <div onClick={() => toggleGoal(i)} style={{ width:18, height:18, borderRadius:4,
                        background: g.done ? V.pink : V.borderSubtle, cursor:"pointer", flexShrink:0,
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {g.done && <span style={{ color:"#fff", fontSize:11 }}>✓</span>}
                      </div>
                      <span style={{ flex:1, fontSize: s.size||13, color: s.color||(g.done? V.textDim : V.textSecondary),
                        textDecoration: g.done?"line-through":"none", fontWeight: s.bold?700:400 }}>{g.text}</span>
                      <button onClick={() => setEditingGoalStyle(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13 }}>🎨</button>
                      <button onClick={() => deleteGoal(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color: V.danger }}>✕</button>
                    </div>
                  );
                })}
                <div style={{ display:"flex", gap:4, marginTop:4 }}>
                  <input value={newGoal} onChange={e=>setNewGoal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGoal()}
                    placeholder="Add goal..." style={{ ...inputStyle, flex:1, padding:"6px 10px", fontSize:12 }} />
                  <button onClick={addGoal} style={{ ...btnPrimary, padding:"6px 10px" }}>+</button>
                </div>
                <button onClick={suggestGoals} disabled={goalsLoading}
                  style={{ ...btnSecondary, width:"100%", marginTop:6, fontSize:12, padding:"6px 10px", opacity: goalsLoading ? 0.6 : 1 }}>
                  {goalsLoading ? "Thinking..." : "✨ Suggest goals"}
                </button>
                {suggestedGoals.length > 0 && (
                  <div style={{ marginTop:6 }}>
                    {suggestedGoals.map((sg, si) => (
                      <div key={si} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                        <span style={{ flex:1, fontSize:11, color:V.textMuted }}>{sg}</span>
                        <button onClick={() => {
                          const updated = [...(goals||[]), { id:Date.now()+si, text:sg, done:false }];
                          fbSet("goals", updated); showToast("Goal added!", "success");
                        }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:V.success }}>+</button>
                      </div>
                    ))}
                    <button onClick={() => suggestGoals()} style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:V.accent, padding:0, marginTop:2 }}>
                      🔄 More suggestions
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        {!statsPref.hidden && (
          <div style={{ marginTop:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <div style={{ fontSize:12, fontWeight:600, color:V.textDim, textTransform:"uppercase", letterSpacing:0.5 }}>
                {statsPref.name || "Quick Stats"}
              </div>
              <button onClick={() => setEditingWidget("stats")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, padding:2 }}>✏️</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {[
                { icon:"🔥", label:"Calories", val: todayCalories },
                { icon:"✅", label:"Routines", val:`${(routines||[]).filter(r=>r.done).length}/${(routines||[]).length}` },
                { icon:"🎯", label:"Goals", val:`${(goals||[]).filter(g=>g.done).length}/${(goals||[]).length}` },
              ].map(s => (
                <div key={s.label} style={{ background: V.bgCard, borderRadius:10, padding:"10px 8px", textAlign:"center", border:`1px solid ${V.borderDefault}`, boxShadow:V.shadowCard }}>
                  <div style={{ fontSize:22 }}>{s.icon}</div>
                  <div style={{ fontSize:18, fontWeight:800, color: V.accent }}>{s.val}</div>
                  <div style={{ fontSize:11, color: V.textDim }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ BIRTHDAY COUNTDOWNS (collapsible, auto-expand within 30 days) ═══ */}
        {(() => {
          const upcoming = getUpcomingBirthdays();
          const todayBdays = upcoming.filter(b => b.daysUntil === 0);
          const closeBdays = upcoming.filter(b => b.daysUntil > 0 && b.daysUntil <= 30);
          if (todayBdays.length > 0) setTimeout(() => triggerConfetti(document.body, "big"), 300);
          const autoExpand = todayBdays.length > 0 || closeBdays.length > 0;
          const isOpen = birthdayExpanded || autoExpand;
          return (
            <div style={{ marginTop: 12, marginBottom: 4 }}>
              {/* Today's birthdays always show */}
              {todayBdays.map((b, i) => (
                <div key={"bdt"+i} style={{ padding: 14, borderRadius: V.r3, background: `linear-gradient(135deg, ${V.accent}33, ${V.accent}11)`,
                  border: "2px solid gold", textAlign: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: V.textPrimary }}>🎂 TODAY IS {b.name.toUpperCase()}'S BIRTHDAY! 👑🎉</div>
                </div>
              ))}
              {/* Collapsible header */}
              <div onClick={() => setBirthdayExpanded(!birthdayExpanded)}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", padding:"6px 0" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: V.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  🎂 Birthdays {closeBdays.length > 0 && `(${closeBdays.length} soon)`}
                </span>
                <span style={{ fontSize: 12, color: V.textDim }}>{isOpen ? "▼" : "▶"}</span>
              </div>
              {isOpen && upcoming.filter(b => b.daysUntil > 0).map((b, i) => (
                <div key={"bd"+i} style={{ padding: 10, borderRadius: V.r2, background: V.bgCard, marginBottom: 4,
                  border: b.daysUntil <= 7 ? "2px solid gold" : `1px solid ${V.borderDefault}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  boxShadow: b.daysUntil <= 7 ? "0 0 10px rgba(255,215,0,0.15)" : "none" }}>
                  <span style={{ color: V.textSecondary, fontWeight: 600, fontSize: 13 }}>
                    {b.emoji} {b.name} — {b.daysUntil} day{b.daysUntil !== 1 ? "s" : ""}
                  </span>
                  {b.daysUntil <= 7 && <span style={{ fontSize: 16 }}>🎂</span>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* ═══ SHOPPING LIST WIDGET ═══ */}
        <div style={{ ...cardStyle, margin:"0 0 12px 0" }}>
          <div style={{ fontWeight:700, color:V.accent, fontSize:14, marginBottom:8 }}>🛒 Shopping List</div>
          {(shoppingList||[]).map((item,i) => (
            <div key={item.id||i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:`1px solid ${V.borderDefault}` }}>
              <div onClick={() => {
                const updated = (shoppingList||[]).map((it,j) => j===i ? {...it, bought:!it.bought} : it);
                fbSet("shoppingList", updated);
              }} style={{ width:20, height:20, borderRadius:4, border:`2px solid ${item.bought ? V.success : V.borderSubtle}`,
                background:item.bought ? V.success : "transparent", cursor:"pointer", flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center" }}>
                {item.bought && <span style={{color:"#fff",fontSize:12}}>✓</span>}
              </div>
              <span style={{ flex:1, fontSize:13, color:item.bought?V.textDim:V.textPrimary,
                textDecoration:item.bought?"line-through":"none" }}>{typeof item === "string" ? item : item.text}</span>
              <button onClick={() => {
                const updated = (shoppingList||[]).filter((_,j) => j!==i);
                fbSet("shoppingList", updated);
              }} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:V.danger,padding:4}}>✕</button>
            </div>
          ))}
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <input value={shoppingInput} onChange={e=>setShoppingInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&shoppingInput.trim()){
                fbSet("shoppingList",[...(shoppingList||[]),{id:Date.now(),text:shoppingInput.trim(),bought:false}]);
                setShoppingInput("");
              }}}
              placeholder="Add item..." style={{...inputStyle,flex:1,padding:"6px 10px",fontSize:13}} />
            <button onClick={()=>{
              if(!shoppingInput.trim())return;
              fbSet("shoppingList",[...(shoppingList||[]),{id:Date.now(),text:shoppingInput.trim(),bought:false}]);
              setShoppingInput("");
            }} style={{...btnPrimary,padding:"6px 14px"}}>+</button>
          </div>
        </div>

        {/* ═══ WIDGET EDIT MODAL ═══ */}
        {editingWidget && (() => {
          const wp = getWidgetPref(editingWidget);
          const defaults = { routines:"Routines", goals:"Goals", stats:"Quick Stats" };
          return (
            <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:V.bgOverlay, zIndex:1000,
              display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
              onClick={e => { if(e.target === e.currentTarget) setEditingWidget(null); }}>
              <div style={{ background:V.bgCard, borderRadius:V.r4, padding:20, width:"100%", maxWidth:340,
                border:`1px solid ${V.borderSubtle}`, boxShadow:V.shadowModal }}>
                <div style={{ fontWeight:700, color:V.textPrimary, fontSize:16, marginBottom:14 }}>
                  Edit "{wp.name || defaults[editingWidget]}" Widget
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, color:V.textMuted, marginBottom:4 }}>Widget Name</div>
                  <input value={wp.name || ""} onChange={e => setWidgetPref(editingWidget, {...wp, name: e.target.value})}
                    placeholder={defaults[editingWidget]} style={{...inputStyle}} />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                  <button onClick={() => setWidgetPref(editingWidget, {...wp, hidden: !wp.hidden})}
                    style={{ width:44, height:26, borderRadius:13, border:"none", cursor:"pointer",
                      background: wp.hidden ? V.borderSubtle : V.success, position:"relative", transition:"background 0.2s" }}>
                    <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff",
                      position:"absolute", top:3, left: wp.hidden ? 3 : 21, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                  <span style={{ fontSize:13, color: V.textSecondary }}>{wp.hidden ? "Hidden" : "Visible"}</span>
                </div>
                <button onClick={() => setEditingWidget(null)} style={{ ...btnPrimary, width:"100%" }}>Done</button>
              </div>
            </div>
          );
        })()}

        {/* Style editors */}
        {editingStyle && (
          <BlockStyleEditor style={getEventStyle(editingStyle.dk, editingStyle.idx)}
            onChange={s => saveEventStyle(editingStyle.dk, editingStyle.idx, s)}
            onClose={() => setEditingStyle(null)} />
        )}
        {editingRoutineStyle !== null && (
          <BlockStyleEditor style={routineStyles?.[editingRoutineStyle]}
            onChange={s => { fbSet("routineStyles", {...(routineStyles||{}), [editingRoutineStyle]:s}); }}
            onClose={() => setEditingRoutineStyle(null)} />
        )}
        {editingGoalStyle !== null && (
          <BlockStyleEditor style={goalStyles?.[editingGoalStyle]}
            onChange={s => { fbSet("goalStyles", {...(goalStyles||{}), [editingGoalStyle]:s}); }}
            onClose={() => setEditingGoalStyle(null)} />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // COZYLA HOME — warm day-view timeline layout
  // ═══════════════════════════════════════════════
  function renderHomeCozyla() {
    const dk = todayKey();
    const todayEvents = visibleEvents[dk] || [];
    const nowHour = today.getHours();
    const greeting = nowHour < 12 ? "Good morning" : nowHour < 17 ? "Good afternoon" : "Good evening";
    const timeSlots = [
      { label: "Morning", range: "6 AM – 12 PM", filterFn: ev => { const p = parseTime(ev.time); const h24 = p.ampm === "AM" ? (p.h === 12 ? 0 : p.h) : (p.h === 12 ? 12 : p.h + 12); return h24 >= 6 && h24 < 12; }},
      { label: "Afternoon", range: "12 PM – 5 PM", filterFn: ev => { const p = parseTime(ev.time); const h24 = p.ampm === "AM" ? (p.h === 12 ? 0 : p.h) : (p.h === 12 ? 12 : p.h + 12); return h24 >= 12 && h24 < 17; }},
      { label: "Evening", range: "5 PM – 10 PM", filterFn: ev => { const p = parseTime(ev.time); const h24 = p.ampm === "AM" ? (p.h === 12 ? 0 : p.h) : (p.h === 12 ? 12 : p.h + 12); return h24 >= 17; }},
    ];
    const todayMeals = (foodLog||[]).filter(f => f.date === todayStr && f.profile === currentProfile?.name);

    return (
      <div style={{ padding: 0 }}>
        {/* Warm gradient header */}
        <div style={{
          background: "linear-gradient(135deg, #e87f5f 0%, #f4a853 100%)",
          padding: "24px 20px 20px", color: "#fff"
        }}>
          <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 500 }}>{greeting}</div>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>
            {today.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
          </div>
          <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
            {today.toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric"})}
          </div>
        </div>

        {/* Person bubbles */}
        <div style={{
          display: "flex", gap: 14, padding: "16px 20px 8px", overflowX: "auto",
          background: V.bgApp
        }}>
          {(profiles||[]).map(p => (
            <div key={p.id} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:52 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: p.color || V.accent, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 800, color: "#fff",
                border: `3px solid ${V.bgCard}`, boxShadow: `0 2px 8px ${p.color || V.accent}44`
              }}>
                {p.emoji || p.name?.charAt(0)}
              </div>
              <span style={{ fontSize: 11, color: V.textMuted, fontWeight: 600, textAlign:"center" }}>{p.name}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "8px 14px 14px" }}>
          {/* Today's schedule — timeline */}
          <div style={{
            background: V.bgCard, borderRadius: 20, padding: 18,
            border: `1px solid ${V.borderDefault}`, boxShadow: V.shadowCard, marginBottom: 14
          }}>
            <div style={{ fontWeight: 800, color: V.textPrimary, fontSize: 16, marginBottom: 14 }}>
              Today's Schedule
            </div>
            {timeSlots.map(slot => {
              const slotEvents = todayEvents.filter(slot.filterFn);
              return (
                <div key={slot.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: V.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {slot.label}
                    </div>
                    <div style={{ flex: 1, height: 1, background: V.borderDefault }} />
                    <div style={{ fontSize: 10, color: V.textDim }}>{slot.range}</div>
                  </div>
                  {slotEvents.length === 0 && (
                    <div style={{ fontSize: 12, color: V.textDim, fontStyle: "italic", padding: "4px 0 2px" }}>
                      Nothing scheduled
                    </div>
                  )}
                  {slotEvents.map((ev, idx) => {
                    const pColor = ev.who ? getPersonColor(ev.who) : V.accent;
                    return (
                      <div key={idx} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        background: `${pColor}12`, borderRadius: 14, marginBottom: 6,
                        borderLeft: `4px solid ${pColor}`
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%", background: pColor,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0
                        }}>
                          {ev.who ? ev.who.charAt(0) : "?"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: V.textPrimary }}>{ev.title}</div>
                          <div style={{ fontSize: 11, color: V.textDim, marginTop: 1 }}>
                            {ev.time}{ev.who ? ` · ${ev.who}` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {(isAdmin || isParent) && (
            <button onClick={() => { setSelectedDay(today.getDate()); setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); setAddingEvents([{ title:"", time:"12:00 PM", who:"", notes:"", repeat:"none", repeatEnd:"", repeatCount:0, duration:60 }]); }}
              style={{ ...btnPrimary, width: "100%", borderRadius: 14, background: V.accent, marginTop: 4 }}>
              + Add Event
            </button>
            )}
          </div>

          {/* Bottom two widgets */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Today's Meals */}
            <div style={{
              background: V.bgCard, borderRadius: 20, padding: 14,
              border: `1px solid ${V.borderDefault}`, boxShadow: V.shadowCard
            }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: V.textPrimary, marginBottom: 10 }}>
                🍽️ Today's Meals
              </div>
              {todayMeals.length === 0 && (
                <div style={{ fontSize: 12, color: V.textDim, fontStyle: "italic" }}>No meals logged</div>
              )}
              {todayMeals.slice(0,4).map((m, i) => (
                <div key={i} style={{
                  fontSize: 12, color: V.textSecondary, padding: "4px 0",
                  borderBottom: i < Math.min(todayMeals.length, 4) - 1 ? `1px solid ${V.borderDefault}` : "none"
                }}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: V.textDim }}>{m.calories || 0} cal</div>
                </div>
              ))}
              {todayMeals.length > 4 && <div style={{ fontSize: 11, color: V.textDim }}>+{todayMeals.length-4} more</div>}
              <button onClick={() => setTab("food")}
                style={{ fontSize: 11, color: V.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 700, marginTop: 6, padding: 0 }}>
                View all →
              </button>
            </div>

            {/* Task Tracking */}
            <div style={{
              background: V.bgCard, borderRadius: 20, padding: 14,
              border: `1px solid ${V.borderDefault}`, boxShadow: V.shadowCard
            }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: V.textPrimary, marginBottom: 10 }}>
                ✅ Routines
              </div>
              {(routines||[]).length === 0 && (
                <div style={{ fontSize: 12, color: V.textDim, fontStyle: "italic" }}>No routines yet</div>
              )}
              {(routines||[]).slice(0,5).map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div onClick={() => toggleRoutine(i)} style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: r.done ? V.success : "transparent",
                    border: `2px solid ${r.done ? V.success : V.borderSubtle}`,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>
                    {r.done && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                  </div>
                  <span style={{
                    flex: 1, fontSize: 12, color: r.done ? V.textDim : V.textSecondary,
                    textDecoration: r.done ? "line-through" : "none"
                  }}>
                    {r.text}
                    {r.streakCount > 0 && <span style={{ marginLeft:4, fontSize:11, textDecoration:"none" }}>🔥{r.streakCount}{r.hasCrown ? " 👑" : ""}</span>}
                  </span>
                </div>
              ))}
              {(routines||[]).length > 5 && <div style={{ fontSize: 11, color: V.textDim }}>+{(routines||[]).length-5} more</div>}
            </div>
          </div>
        </div>

        {/* ═══ AI QUICK ADD + VOICE (Cozyla) — admin/parent only ═══ */}
        {(isAdmin || isParent) && (
        <div style={{ padding: "0 14px 8px" }}>
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            <button onClick={() => isRecording ? stopVoiceInput() : startVoiceInput(text => setQuickAddInput(text))}
              style={{ width:44, height:44, borderRadius:"50%", border:"none", cursor:"pointer", fontSize:18,
                background: isRecording ? V.danger : V.bgElevated, color: isRecording ? "#fff" : V.textMuted, flexShrink:0 }}>🎤</button>
            <input value={quickAddInput} onChange={e => setQuickAddInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleQuickAdd()}
              placeholder="Add anything..."
              style={{ ...inputStyle, flex:1, padding:"10px 14px", fontSize:13, borderRadius:20 }} />
            <button onClick={handleQuickAdd} disabled={quickAddLoading || !quickAddInput.trim()}
              style={{ ...btnPrimary, borderRadius:20, padding:"10px 14px", fontSize:16, opacity: quickAddLoading ? 0.6 : 1 }}>
              {quickAddLoading ? "..." : "✨"}</button>
          </div>
          {quickAddPreview && (
            <div style={{ ...cardStyle, border:`2px solid ${V.accent}`, marginBottom:10 }}>
              <div style={{ fontWeight:700, color:V.accent, marginBottom:6 }}>Creating {quickAddPreview.totalInstances} event{quickAddPreview.totalInstances>1?"s":""}{quickAddPreview.repeatDesc}</div>
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <button onClick={confirmQuickAdd} style={{ ...btnPrimary, flex:1 }}>Confirm</button>
                <button onClick={() => setQuickAddPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
              </div>
            </div>
          )}
          {quickAddDeleteMatches && (
            <div style={{ ...cardStyle, border:`2px solid ${V.danger}`, marginBottom:10 }}>
              <div style={{ fontWeight:700, color:V.danger, marginBottom:6 }}>🗑️ Found {quickAddDeleteMatches.matches.length} match{quickAddDeleteMatches.matches.length>1?"es":""}</div>
              {quickAddDeleteMatches.matches.slice(0,6).map((m,i) => (
                <div key={i} onClick={() => executeDeleteMatch(m.dk, m.idx)}
                  style={{ padding:8, background:V.bgCardAlt, borderRadius:V.r2, marginBottom:4, cursor:"pointer" }}>
                  <span style={{ fontWeight:600, color:V.textPrimary, fontSize:13 }}>{m.ev.title}</span>
                  <span style={{ fontSize:11, color:V.textDim, marginLeft:6 }}>{m.dk}</span>
                </div>
              ))}
              <button onClick={() => setQuickAddDeleteMatches(null)} style={{ ...btnSecondary, width:"100%", marginTop:4 }}>Cancel</button>
            </div>
          )}
          {quickAddEditPreview && (
            <div style={{ ...cardStyle, border:`2px solid ${V.info}`, marginBottom:10 }}>
              <div style={{ fontWeight:700, color:V.info, marginBottom:6 }}>✏️ Edit: {quickAddEditPreview.ev.title} → {quickAddEditPreview.changes.title || quickAddEditPreview.changes.time}</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => executeEditMatch(quickAddEditPreview.dk, quickAddEditPreview.idx, quickAddEditPreview.changes)} style={{ ...btnPrimary, flex:1 }}>Confirm</button>
                <button onClick={() => setQuickAddEditPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ═══ BIRTHDAY COUNTDOWNS (Cozyla) ═══ */}
        <div style={{ padding: "0 14px" }}>
          {(() => {
            const upcoming = getUpcomingBirthdays();
            const todayBdays = upcoming.filter(b => b.daysUntil === 0);
            if (todayBdays.length > 0) setTimeout(() => triggerConfetti(document.body, "big"), 300);
            return upcoming.length > 0 ? (
              <div style={{ marginBottom: 10 }}>
                {todayBdays.map((b, i) => (
                  <div key={"cbdt"+i} style={{ padding:12, borderRadius:20, background:`linear-gradient(135deg, ${V.accent}33, ${V.accent}11)`,
                    border:"2px solid gold", textAlign:"center", marginBottom:8 }}>
                    <div style={{ fontSize:18, fontWeight:800, color:V.textPrimary }}>🎂 TODAY IS {b.name.toUpperCase()}'S BIRTHDAY! 👑🎉</div>
                  </div>
                ))}
                {upcoming.filter(b => b.daysUntil > 0).map((b, i) => (
                  <div key={"cbd"+i} style={{ padding:10, borderRadius:14, background:V.bgCard, marginBottom:6,
                    border: b.daysUntil <= 7 ? "2px solid gold" : `1px solid ${V.borderDefault}`,
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ color:V.textSecondary, fontWeight:600, fontSize:13 }}>{b.emoji} {b.name} in {b.daysUntil}d 🎉</span>
                    {b.daysUntil <= 7 && <span style={{ fontSize:18 }}>🎂</span>}
                  </div>
                ))}
              </div>
            ) : null;
          })()}
        </div>

        {/* Day detail popup */}
        {selectedDay && renderDayPopup(dateKey(calYear, calMonth, selectedDay))}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // FAMILYWALL HOME — bold widget grid layout
  // ═══════════════════════════════════════════════
  function renderHomeFamilyWall() {
    const nowHour = today.getHours();
    const greeting = nowHour < 12 ? "Good morning" : nowHour < 17 ? "Good afternoon" : "Good evening";
    const userName = currentProfile?.name || "there";
    const userEmoji = currentProfile?.emoji || "👑";

    // Stats for widget cards
    const dk = todayKey();
    const todayEventCount = (visibleEvents[dk] || []).length;
    // Count events this week
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    let weekEventCount = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const wk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      weekEventCount += (visibleEvents[wk] || []).length;
    }
    const routinesDone = (routines||[]).filter(r=>r.done).length;
    const routinesTotal = (routines||[]).length;
    const goalsDone = (goals||[]).filter(g=>g.done).length;
    const goalsTotal = (goals||[]).length;
    const todayMeals = (foodLog||[]).filter(f => f.date === todayStr && f.profile === currentProfile?.name);
    const allRules = [...(myRules||[]), ...(theirRules||[]), ...(sharedRules||[])];
    const recentExchanges = (exchangeLog||[]).slice(-3);

    const fwCard = {
      background: V.bgCard, borderRadius: V.r3, padding: 16,
      border: `2px solid ${V.borderDefault}`,
      boxShadow: "0 2px 6px rgba(10,20,50,0.08), 0 4px 14px rgba(10,20,50,0.04)",
      cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s"
    };

    const widgets = [
      {
        icon: "📅", title: "Calendar", stat: `${todayEventCount} today · ${weekEventCount} this week`,
        action: () => setTab("home"),
        content: (() => {
          // Mini month grid
          const daysInMonth = getDaysInMonth(calYear, calMonth);
          const firstDay = getFirstDay(calYear, calMonth);
          const miniCells = [];
          for (let i = 0; i < firstDay; i++) miniCells.push(null);
          for (let d = 1; d <= daysInMonth; d++) miniCells.push(d);
          const isTodayD = (d) => d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
          return (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, marginTop: 8 }}>
                {["S","M","T","W","T","F","S"].map((d,i) => (
                  <div key={i} style={{ textAlign:"center", fontSize:9, fontWeight:700, color: V.textDim, padding:"2px 0" }}>{d}</div>
                ))}
                {miniCells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const dk2 = dateKey(calYear, calMonth, d);
                  const hasEv = (visibleEvents[dk2]||[]).length > 0;
                  return (
                    <div key={i} onClick={e => { e.stopPropagation(); setSelectedDay(d); setAddingEvents([{title:"",time:"12:00 PM",who:"",notes:"",repeat:"none",repeatEnd:"",repeatCount:0,duration:60}]); }}
                      style={{
                        textAlign: "center", fontSize: 10, padding: "3px 0", borderRadius: "50%",
                        fontWeight: isTodayD(d) ? 800 : hasEv ? 700 : 400,
                        color: isTodayD(d) ? "#fff" : hasEv ? V.accent : V.textMuted,
                        background: isTodayD(d) ? V.accent : "transparent",
                        cursor: "pointer"
                      }}>{d}</div>
                  );
                })}
              </div>
            </div>
          );
        })()
      },
      {
        icon: "✅", title: "Routines", stat: `${routinesDone}/${routinesTotal} done`,
        action: () => {},
        content: (
          <div style={{ marginTop: 8 }}>
            {(routines||[]).slice(0,4).map((r,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <div onClick={e => { e.stopPropagation(); toggleRoutine(i); }} style={{
                  width:16, height:16, borderRadius:3, flexShrink:0, cursor:"pointer",
                  background: r.done ? V.success : "transparent",
                  border: `2px solid ${r.done ? V.success : V.borderSubtle}`,
                  display:"flex", alignItems:"center", justifyContent:"center"
                }}>
                  {r.done && <span style={{color:"#fff",fontSize:9}}>✓</span>}
                </div>
                <span style={{ fontSize:12, color: r.done ? V.textDim : V.textPrimary,
                  textDecoration: r.done ? "line-through" : "none" }}>{r.text}</span>
              </div>
            ))}
            {routinesTotal > 4 && <div style={{fontSize:11,color:V.textDim}}>+{routinesTotal-4} more</div>}
          </div>
        )
      },
      {
        icon: "🎯", title: "Goals", stat: `${goalsDone}/${goalsTotal} achieved`,
        action: () => {},
        content: (
          <div style={{ marginTop: 8 }}>
            {(goals||[]).slice(0,4).map((g,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <div onClick={e => { e.stopPropagation(); toggleGoal(i); }} style={{
                  width:16, height:16, borderRadius:3, flexShrink:0, cursor:"pointer",
                  background: g.done ? V.pink : "transparent",
                  border: `2px solid ${g.done ? V.pink : V.borderSubtle}`,
                  display:"flex", alignItems:"center", justifyContent:"center"
                }}>
                  {g.done && <span style={{color:"#fff",fontSize:9}}>✓</span>}
                </div>
                <span style={{ fontSize:12, color: g.done ? V.textDim : V.textPrimary,
                  textDecoration: g.done ? "line-through" : "none" }}>{g.text}</span>
              </div>
            ))}
            {goalsTotal > 4 && <div style={{fontSize:11,color:V.textDim}}>+{goalsTotal-4} more</div>}
          </div>
        )
      },
      {
        icon: "🔥", title: "Food Log", stat: `${todayCalories} cal today`,
        action: () => setTab("food"),
        content: (
          <div style={{ marginTop: 8 }}>
            {todayMeals.length === 0 && <div style={{fontSize:12,color:V.textDim,fontStyle:"italic"}}>No meals logged</div>}
            {todayMeals.slice(0,3).map((m,i) => (
              <div key={i} style={{ fontSize:12, color: V.textSecondary, marginBottom:3 }}>
                {m.name} <span style={{color:V.textDim}}>· {m.calories||0} cal</span>
              </div>
            ))}
            {todayMeals.length > 3 && <div style={{fontSize:11,color:V.textDim}}>+{todayMeals.length-3} more</div>}
          </div>
        )
      },
      {
        icon: "📋", title: "Family Rules", stat: `${allRules.length} rules`,
        action: () => { setTab("family"); setFamilySubTab?.("rules"); },
        content: (
          <div style={{ marginTop: 8 }}>
            {allRules.length === 0 && <div style={{fontSize:12,color:V.textDim,fontStyle:"italic"}}>No rules set</div>}
            {allRules.slice(0,3).map((r,i) => (
              <div key={i} style={{ fontSize:12, color: V.textSecondary, marginBottom:3, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                · {typeof r === "string" ? r : r.text || r}
              </div>
            ))}
            {allRules.length > 3 && <div style={{fontSize:11,color:V.textDim}}>+{allRules.length-3} more</div>}
          </div>
        )
      },
      {
        icon: "🔄", title: "Exchange Log", stat: `${(exchangeLog||[]).length} entries`,
        action: () => { setTab("family"); setFamilySubTab?.("exchange"); },
        content: (
          <div style={{ marginTop: 8 }}>
            {recentExchanges.length === 0 && <div style={{fontSize:12,color:V.textDim,fontStyle:"italic"}}>No exchanges yet</div>}
            {recentExchanges.map((ex,i) => (
              <div key={i} style={{ fontSize:11, color: V.textSecondary, marginBottom:3 }}>
                {typeof ex === "string" ? ex : (ex.date || "") + " " + (ex.type || ex.note || "")}
              </div>
            ))}
          </div>
        )
      },
    ];

    return (
      <div style={{ padding: 14 }}>
        {/* Big greeting */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: V.textPrimary, lineHeight: 1.2 }}>
            {greeting}, {userName}! {userEmoji}
          </div>
          <div style={{ fontSize: 13, color: V.textDim, marginTop: 4 }}>
            {today.toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric", year:"numeric"})}
          </div>
        </div>

        {/* Widget grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {widgets.map((w, i) => (
            <div key={i} onClick={w.action} style={fwCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 24 }}>{w.icon}</span>
                <div style={{ fontWeight: 800, fontSize: 15, color: V.accent }}>{w.title}</div>
              </div>
              <div style={{ fontSize: 12, color: V.textMuted, fontWeight: 600 }}>{w.stat}</div>
              {w.content}
            </div>
          ))}
        </div>

        {/* ═══ AI QUICK ADD + VOICE (FamilyWall) — admin/parent only ═══ */}
        {(isAdmin || isParent) && (<>
        <div style={{ display:"flex", gap:6, marginTop:12, marginBottom:10 }}>
          <button onClick={() => isRecording ? stopVoiceInput() : startVoiceInput(text => setQuickAddInput(text))}
            style={{ width:44, height:44, borderRadius:"50%", border:"none", cursor:"pointer", fontSize:18,
              background: isRecording ? V.danger : V.bgElevated, color: isRecording ? "#fff" : V.textMuted, flexShrink:0 }}>🎤</button>
          <input value={quickAddInput} onChange={e => setQuickAddInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleQuickAdd()}
            placeholder="Add anything..."
            style={{ ...inputStyle, flex:1, padding:"10px 14px", fontSize:13, borderRadius:V.r2 }} />
          <button onClick={handleQuickAdd} disabled={quickAddLoading || !quickAddInput.trim()}
            style={{ ...btnPrimary, borderRadius:V.r2, padding:"10px 14px", fontSize:16, opacity: quickAddLoading ? 0.6 : 1 }}>
            {quickAddLoading ? "..." : "✨"}</button>
        </div>
        {quickAddPreview && (
          <div style={{ ...cardStyle, border:`2px solid ${V.accent}`, marginBottom:10 }}>
            <div style={{ fontWeight:700, color:V.accent, marginBottom:6 }}>Creating {quickAddPreview.totalInstances} event{quickAddPreview.totalInstances>1?"s":""}{quickAddPreview.repeatDesc}</div>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button onClick={confirmQuickAdd} style={{ ...btnPrimary, flex:1 }}>Confirm</button>
              <button onClick={() => setQuickAddPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
            </div>
          </div>
        )}
        {quickAddDeleteMatches && (
          <div style={{ ...cardStyle, border:`2px solid ${V.danger}`, marginBottom:10 }}>
            <div style={{ fontWeight:700, color:V.danger, marginBottom:6 }}>🗑️ Found {quickAddDeleteMatches.matches.length} match{quickAddDeleteMatches.matches.length>1?"es":""}</div>
            {quickAddDeleteMatches.matches.slice(0,6).map((m,i) => (
              <div key={i} onClick={() => executeDeleteMatch(m.dk, m.idx)}
                style={{ padding:10, background:V.bgCardAlt, borderRadius:V.r2, marginBottom:4, cursor:"pointer",
                  border:`2px solid ${V.borderDefault}` }}>
                <span style={{ fontWeight:700, color:V.textPrimary, fontSize:14 }}>{m.ev.title}</span>
                <span style={{ fontSize:11, color:V.textDim, marginLeft:8 }}>{m.dk}</span>
              </div>
            ))}
            <button onClick={() => setQuickAddDeleteMatches(null)} style={{ ...btnSecondary, width:"100%", marginTop:4 }}>Cancel</button>
          </div>
        )}
        {quickAddEditPreview && (
          <div style={{ ...cardStyle, border:`2px solid ${V.info}`, marginBottom:10 }}>
            <div style={{ fontWeight:700, color:V.info, marginBottom:6 }}>✏️ Edit: {quickAddEditPreview.ev.title} → {quickAddEditPreview.changes.title || quickAddEditPreview.changes.time}</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => executeEditMatch(quickAddEditPreview.dk, quickAddEditPreview.idx, quickAddEditPreview.changes)} style={{ ...btnPrimary, flex:1 }}>Confirm</button>
              <button onClick={() => setQuickAddEditPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
            </div>
          </div>
        )}
        </>)}

        {/* ═══ BIRTHDAY COUNTDOWNS (FamilyWall) ═══ */}
        {(() => {
          const upcoming = getUpcomingBirthdays();
          const todayBdays = upcoming.filter(b => b.daysUntil === 0);
          if (todayBdays.length > 0) setTimeout(() => triggerConfetti(document.body, "big"), 300);
          return upcoming.length > 0 ? (
            <div style={{ marginBottom: 10 }}>
              {todayBdays.map((b, i) => (
                <div key={"fwbdt"+i} style={{ padding:14, borderRadius:V.r3, background:`${V.accent}15`,
                  border:`2px solid ${V.accent}`, textAlign:"center", marginBottom:8 }}>
                  <div style={{ fontSize:20, fontWeight:900, color:V.textPrimary }}>🎂 TODAY IS {b.name.toUpperCase()}'S BIRTHDAY! 👑🎉</div>
                </div>
              ))}
              {upcoming.filter(b => b.daysUntil > 0).map((b, i) => (
                <div key={"fwbd"+i} style={{ padding:12, borderRadius:V.r2, background:V.bgCard, marginBottom:6,
                  border: b.daysUntil <= 7 ? `2px solid ${V.accent}` : `2px solid ${V.borderDefault}`,
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  boxShadow: b.daysUntil <= 7 ? V.shadowGlow : "none" }}>
                  <span style={{ color:V.textPrimary, fontWeight:700, fontSize:14 }}>{b.emoji} {b.name} in {b.daysUntil}d 🎉</span>
                  {b.daysUntil <= 7 && <span style={{ fontSize:20 }}>🎂</span>}
                </div>
              ))}
            </div>
          ) : null;
        })()}

        {/* Day detail popup */}
        {selectedDay && renderDayPopup(dateKey(calYear, calMonth, selectedDay))}
      </div>
    );
  }

  // ── Dispatcher ──
  if (themeName === "cozyla") return renderHomeCozyla();
  if (themeName === "familywall") return renderHomeFamilyWall();
  return renderHomeSkylight();
}
