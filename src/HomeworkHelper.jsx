import { useState, useRef, useEffect, useCallback } from "react";
import { groqFetch, createSpeechRecognition, triggerConfetti, speakText } from "./utils";

const SUBJECTS = [
  { key: "math", label: "Math", icon: "\u{1F522}" },
  { key: "reading", label: "Reading", icon: "\u{1F4D6}" },
  { key: "science", label: "Science", icon: "\u{1F52C}" },
  { key: "funfacts", label: "Fun Facts", icon: "\u{1F31F}" },
];

const MAX_MESSAGES = 20;

const MATH_VERIFICATION_PROMPT =
  "CRITICAL: Always double-check your arithmetic before responding. Verify every calculation step by step. 5x10=50, NOT 40. 7x8=56. 12+15=27. Never give a wrong mathematical answer — accuracy is critical for children's education.";

function getAge(kid) {
  if (kid && kid.age) return kid.age;
  return 8;
}

function buildSystemPrompt(name, age, subject, modes = {}) {
  const { detailMode = false, stepByStep = true, socraticAttempts = 0 } = modes;
  const subjectLabel = SUBJECTS.find((s) => s.key === subject)?.label || "General";
  const ageNote =
    age <= 7
      ? "Use very simple words, lots of emojis, max 2 short sentences."
      : "Use full sentences appropriate for a grade 3-4 student.";
  const SAFETY =
    "SAFETY: If the child asks anything inappropriate, off-topic, or not school-related, kindly redirect them back to homework. " +
    "Never discuss violence, adult content, or anything not age-appropriate.";

  // HW-05: Fun Facts mode — celebrates everything, never corrects
  if (subject === "funfacts") {
    return (
      `You are a fun facts buddy for ${name}, a ${age} year old. ` +
      `When ${name} shares a thought, idea, or guess: celebrate it enthusiastically (use emojis and warm phrases). ` +
      `Then share a related amazing fun fact they probably don't know. ` +
      `Then ask an open-ended follow-up question to keep the conversation going. ` +
      `NEVER say "almost", "try again", "not quite", "wrong", or "incorrect". There are no wrong answers in fun facts mode — only curiosity. ` +
      `Do NOT use Socratic questioning. Do NOT make them guess answers. Just celebrate, share, and ask. ` +
      `${ageNote} ` +
      SAFETY
    );
  }

  // HW-03: Frustration switch — after 2 failed Socratic attempts, drop the guidance and explain directly
  if (socraticAttempts >= 2) {
    return (
      `You are a kind, patient tutor for ${name}, a ${age} year old. Subject: ${subjectLabel}. ` +
      `${name} has been trying to figure this out and is getting stuck. Stop guiding with questions — explain the concept DIRECTLY with a clear worked example. ` +
      `Walk through the solution step-by-step, showing exactly how to do it. ` +
      `After you finish the explanation, kindly ask if they want another problem to try on their own. ` +
      `Use warm, encouraging language. Never use the words "wrong" or "incorrect". ` +
      `${ageNote} ` +
      (subject === "math" ? MATH_VERIFICATION_PROMPT + " " : "") +
      SAFETY
    );
  }

  // HW-01 + HW-02: Standard tutor with detailMode and stepByStep modulation
  const lengthGuidance = detailMode
    ? "Give thorough, structured explanations. Use examples, analogies, and multiple approaches when they help. Be comprehensive — the student wants depth, so don't hold back on detail."
    : "Be concise and clear. Get to the point quickly without unnecessary fluff.";

  const scaffoldGuidance = stepByStep
    ? "Walk through your reasoning step-by-step. Show each step clearly so the student can follow along."
    : "Give direct answers without breaking things into steps. Trust the student to follow.";

  return (
    `You are a kind, patient tutor for ${name}, a ${age} year old. Subject: ${subjectLabel}. ` +
    `NEVER give the final answer directly on the first turn — guide them with questions to figure it out. ` +
    `If they get it right, celebrate with enthusiasm. If they're off-track, say 'Almost! Let's try again \u{1F4AA}' — never say 'wrong' or 'incorrect'. ` +
    `${lengthGuidance} ${scaffoldGuidance} ` +
    `${ageNote} ` +
    `When the student asks for more detail or says they don't understand, go DEEPER — do NOT repeat your previous explanation. Reference what you already said and build on it with a new angle or analogy. NEVER repeat yourself. ` +
    (subject === "math" ? MATH_VERIFICATION_PROMPT + " " : "") +
    SAFETY
  );
}

function shouldCelebrate(text, age) {
  const lower = (text || "").toLowerCase();
  if (age <= 7) {
    return /great|awesome|correct|right|amazing|fantastic|wonderful|good job|well done|perfect|excellent|bravo/.test(lower);
  }
  return /correct|well done|excellent|perfect/.test(lower);
}

export default function HomeworkHelper({ V, profiles, kidsData, fbSet, GROQ_KEY, showToast, homeworkSessions }) {
  const [selectedKid, setSelectedKid] = useState("");
  const [subject, setSubject] = useState("math");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [sessionId, setSessionId] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${d.getTime()}`;
  });
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [pastSessions, setPastSessions] = useState(null);
  const [muted, setMuted] = useState(false);
  // HW-01: detailMode toggles brief vs detailed responses (maxTokens 300 vs 1500)
  const [detailMode, setDetailMode] = useState(false);
  // HW-02: stepByStep toggle persisted per-kid in kidsData/{name}/hwPrefs/stepByStep
  const [stepByStep, setStepByStep] = useState(true);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceTimeoutRef = useRef(null);
  // HW-03: frustration counter (ref, not state — only read inside doAICall, never drives UI render)
  const socraticAttemptsRef = useRef(0);
  const rateLimited = msgCount >= MAX_MESSAGES;

  const kidProfiles = Object.entries(profiles || {}).filter(
    ([, p]) => p.type === "kid"
  );

  const currentKid = selectedKid ? (profiles || {})[selectedKid] : null;
  const kidAge = currentKid ? getAge(currentKid) : 8;
  const kidName = currentKid ? currentKid.name || selectedKid : "";
  const isLucaMode = kidAge <= 7;
  const ttsAvailable = typeof window !== "undefined" && !!window.speechSynthesis;

  // Feature 13: Auto-read for young kids
  const autoRead = isLucaMode && ttsAvailable && !muted;

  useEffect(() => {
    const rec = createSpeechRecognition();
    if (rec) {
      setSpeechSupported(true);
      recognitionRef.current = rec;
      // Feature 15: voice input fixes
      rec.continuous = false;
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
        setRecording(false);
        if (isLucaMode) {
          // Auto-submit after 2 second pause for young kids
          setInput(transcript);
          voiceTimeoutRef.current = setTimeout(() => {
            sendMessageDirect(transcript);
          }, 2000);
        } else {
          setInput((prev) => (prev ? prev + " " + transcript : transcript));
        }
      };
      rec.onerror = () => setRecording(false);
      rec.onend = () => setRecording(false);
    }
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) { /* ignore */ }
      }
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
    };
  }, [isLucaMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  // HW-02: Load persisted stepByStep preference for the selected kid (default true)
  useEffect(() => {
    if (!selectedKid) return;
    const persisted = kidsData?.[selectedKid]?.hwPrefs?.stepByStep;
    setStepByStep(persisted !== false); // default true unless explicitly false
  }, [selectedKid, kidsData]);

  // Save session to Firebase
  useEffect(() => {
    if (messages.length > 0 && kidName && fbSet) {
      fbSet(`homeworkSessions/${kidName}/${sessionId}`, {
        subject,
        messages,
        updatedAt: Date.now(),
      });
    }
  }, [messages, kidName, sessionId, subject, fbSet]);

  // HW-04: Auto-prune oldest sessions when count exceeds 50 per kid.
  // Separate effect (not inlined into the save effect) so we read the
  // freshest homeworkSessions snapshot from Firebase rather than a stale closure.
  // Self-stabilizes: after pruning, Firebase pushes the smaller set back,
  // this effect re-fires with count <= 50 and exits without action.
  useEffect(() => {
    if (!kidName || !fbSet) return;
    const kidSessions = homeworkSessions?.[kidName];
    if (!kidSessions) return;
    const sessionKeys = Object.keys(kidSessions);
    if (sessionKeys.length <= 50) return;
    const sorted = [...sessionKeys].sort((a, b) => {
      const aTime = kidSessions[a]?.updatedAt || 0;
      const bTime = kidSessions[b]?.updatedAt || 0;
      return aTime - bTime;
    });
    const toDelete = sorted.slice(0, sessionKeys.length - 50);
    toDelete.forEach((oldKey) => {
      fbSet(`homeworkSessions/${kidName}/${oldKey}`, null);
    });
  }, [homeworkSessions, kidName, fbSet]);

  // Feature 13: Auto-read latest assistant message for young kids
  useEffect(() => {
    if (!autoRead || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "assistant") {
      speakText(lastMsg.content);
    }
  }, [messages, autoRead]);

  // Direct send function that doesn't depend on input state (for voice auto-submit)
  const sendMessageDirect = useCallback(async (text) => {
    if (!text || !text.trim() || !selectedKid || loading || rateLimited) return;
    const userMsg = { role: "user", content: text.trim() };
    setMessages((prev) => {
      const newMessages = [...prev, userMsg];
      doAICall(newMessages);
      return newMessages;
    });
    setInput("");
    setMsgCount((c) => c + 1);
  }, [selectedKid, loading, rateLimited, kidName, kidAge, subject, GROQ_KEY]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doAICall(newMessages) {
    setLoading(true);
    const systemPrompt = buildSystemPrompt(kidName, kidAge, subject, {
      detailMode,
      stepByStep,
      socraticAttempts: socraticAttemptsRef.current,
    });
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...newMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    ];

    // HW-01: detailMode bumps maxTokens 300 -> 1500 for thorough responses
    const result = await groqFetch(GROQ_KEY, apiMessages, {
      maxTokens: detailMode ? 1500 : 300,
    });
    setLoading(false);

    if (result.ok && result.data) {
      const assistantMsg = { role: "assistant", content: result.data };
      setMessages((prev) => [...prev, assistantMsg]);
      setMsgCount((c) => c + 1);

      // HW-03: frustration tracking — only for Socratic subjects (not funfacts)
      if (subject !== "funfacts") {
        if (shouldCelebrate(result.data, kidAge)) {
          // celebration = student got it right, reset the frustration counter
          socraticAttemptsRef.current = 0;
        } else if (/almost|try again|let'?s try|not quite/i.test(result.data)) {
          // inverse-celebrate language = another failed attempt
          socraticAttemptsRef.current += 1;
        }
      }

      if (shouldCelebrate(result.data, kidAge)) {
        triggerConfetti(document.body, kidAge <= 7 ? "small" : "small");
      }
    } else {
      showToast && showToast("Oops, tutor had a hiccup. Try again!");
    }
  }

  async function sendMessage(text) {
    if (!text.trim() || !selectedKid || loading || rateLimited) return;
    const userMsg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setMsgCount((c) => c + 1);
    await doAICall(newMessages);
  }

  function toggleRecording() {
    if (!recognitionRef.current) return;
    if (recording) {
      recognitionRef.current.abort();
      setRecording(false);
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
    } else {
      setRecording(true);
      try {
        recognitionRef.current.start();
      } catch (_) { /* already started */ }
      // Feature 15: 10-second timeout instead of cutting off too fast
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (_) { /* ignore */ }
        }
        setRecording(false);
      }, 10000);
    }
  }

  // Feature 12: switching subject clears chat
  function switchSubject(newSubject) {
    if (newSubject === subject) return;
    // Stop any speech
    if (ttsAvailable) window.speechSynthesis.cancel();
    setSubject(newSubject);
    setMessages([]);
    setMsgCount(0);
    // HW-03: subject change resets frustration counter
    socraticAttemptsRef.current = 0;
    // New session ID for the new subject
    const d = new Date();
    setSessionId(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${d.getTime()}`);
  }

  // Feature 5 (brain break): reset everything
  function resetSession() {
    if (ttsAvailable) window.speechSynthesis.cancel();
    setMessages([]);
    setMsgCount(0);
    setInput("");
    // HW-03: brain break resets frustration counter
    socraticAttemptsRef.current = 0;
    const d = new Date();
    setSessionId(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${d.getTime()}`);
  }

  function loadPastSessions() {
    setShowPastSessions((p) => !p);
    if (!showPastSessions && kidsData && kidName) {
      const sessions = homeworkSessions?.[kidName] || null;
      setPastSessions(sessions);
    }
  }

  // ---- STYLES ----
  const wrap = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: V.bgApp,
    color: V.textPrimary,
    fontFamily: "inherit",
  };
  const headerStyle = {
    padding: V.sp4,
    background: V.bgCard,
    borderBottom: `1px solid ${V.borderDefault}`,
    boxShadow: V.shadowCard,
  };
  const titleRow = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  };
  const titleStyle = {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    color: V.textPrimary,
  };
  const muteBtn = {
    minWidth: 44,
    minHeight: 44,
    padding: "6px 12px",
    borderRadius: V.r2,
    border: `1px solid ${V.borderDefault}`,
    background: muted ? V.danger : V.bgCardAlt,
    color: muted ? "#fff" : V.textSecondary,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  const selectStyle = {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    marginTop: 8,
    borderRadius: V.r2,
    border: `1px solid ${V.borderDefault}`,
    background: V.bgInput,
    color: V.textPrimary,
    fontSize: 16,
    appearance: "none",
    WebkitAppearance: "none",
  };
  const subjectRow = {
    display: "flex",
    gap: 8,
    padding: `${V.sp3} ${V.sp4}`,
    overflowX: "auto",
    background: V.bgCard,
    borderBottom: `1px solid ${V.borderSubtle}`,
  };
  const subjectBtnStyle = (active) => ({
    minWidth: 44,
    minHeight: 44,
    padding: "8px 16px",
    borderRadius: V.r3,
    border: active ? `2px solid ${V.accent}` : `1px solid ${V.borderDefault}`,
    background: active ? V.accent : V.bgCardAlt,
    color: active ? "#fff" : V.textPrimary,
    fontWeight: active ? 700 : 500,
    fontSize: 14,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  });
  const chatArea = {
    flex: 1,
    overflowY: "auto",
    padding: V.sp4,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
  const bubbleStyle = (isUser) => ({
    maxWidth: "82%",
    alignSelf: isUser ? "flex-end" : "flex-start",
    background: isUser ? V.accent : V.bgElevated || V.bgCardAlt,
    color: isUser ? "#fff" : V.textPrimary,
    padding: "10px 14px",
    borderRadius: V.r3,
    fontSize: 15,
    lineHeight: 1.5,
    wordBreak: "break-word",
    boxShadow: V.shadowCard,
  });
  const speakBtnStyle = {
    minWidth: 44,
    minHeight: 44,
    padding: "4px 8px",
    marginTop: 6,
    borderRadius: V.r2,
    border: `1px solid ${V.borderSubtle}`,
    background: V.bgCardAlt,
    color: V.textSecondary,
    fontSize: 16,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  };
  const inputRow = {
    display: "flex",
    gap: 8,
    padding: V.sp3,
    background: V.bgCard,
    borderTop: `1px solid ${V.borderDefault}`,
    alignItems: "center",
  };
  const textInput = {
    flex: 1,
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: V.r3,
    border: `1px solid ${V.borderDefault}`,
    background: V.bgInput,
    color: V.textPrimary,
    fontSize: 16,
    outline: "none",
  };
  const sendBtnStyle = {
    minWidth: 44,
    minHeight: 44,
    borderRadius: V.r3,
    border: "none",
    background: V.accent,
    color: "#fff",
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  };
  const micBtnBase = (active) => ({
    minWidth: isLucaMode ? 80 : 44,
    minHeight: isLucaMode ? 80 : 44,
    borderRadius: "50%",
    border: "none",
    background: active ? V.danger : V.bgCardAlt,
    color: active ? "#fff" : V.textSecondary,
    fontSize: isLucaMode ? 32 : 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  });
  const stepBtn = {
    minHeight: 44,
    padding: "8px 16px",
    borderRadius: V.r3,
    border: `1px solid ${V.borderSubtle}`,
    background: V.bgCardAlt,
    color: V.textSecondary,
    fontSize: 13,
    cursor: "pointer",
    alignSelf: "flex-start",
    marginTop: 4,
  };
  const pastBtn = {
    minHeight: 44,
    padding: "8px 16px",
    borderRadius: V.r2,
    border: `1px solid ${V.borderSubtle}`,
    background: V.bgCardAlt,
    color: V.textSecondary,
    fontSize: 13,
    cursor: "pointer",
    marginTop: 8,
  };
  const emptyState = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: V.sp5,
    color: V.textMuted,
    textAlign: "center",
  };
  const newSessionBtn = {
    minWidth: 44,
    minHeight: 44,
    padding: "10px 20px",
    marginTop: 10,
    borderRadius: V.r3,
    border: "none",
    background: V.accent,
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  };
  const typingIndicator = {
    maxWidth: "82%",
    alignSelf: "flex-start",
    background: V.bgElevated || V.bgCardAlt,
    color: V.textMuted,
    padding: "10px 14px",
    borderRadius: V.r3,
    fontSize: 15,
    lineHeight: 1.5,
    fontStyle: "italic",
    boxShadow: V.shadowCard,
    display: "flex",
    alignItems: "center",
    gap: 8,
  };
  const pulsingDot = {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: V.accent,
    animation: "pulse 1s infinite",
  };

  // ---- KEYFRAME INJECTION (mic pulse + recording dot) ----
  useEffect(() => {
    if (document.getElementById("hw-helper-styles")) return;
    const style = document.createElement("style");
    style.id = "hw-helper-styles";
    style.textContent = `
      @keyframes micPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 10px rgba(239,68,68,0)} }
      @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:0.6} }
      @keyframes recordPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    `;
    document.head.appendChild(style);
    return () => { try { style.remove(); } catch (_) { /* ignore */ } };
  }, []);

  // ---- NO KIDS ----
  if (kidProfiles.length === 0) {
    return (
      <div style={wrap}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{"\u{1F4DA}"} Homework Helper</h2>
        </div>
        <div style={emptyState}>
          <span style={{ fontSize: 48 }}>{"\u{1F9D1}\u200D\u{1F393}"}</span>
          <p style={{ fontSize: 16 }}>No kid profiles found. Add a kid profile first!</p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      {/* HEADER + KID SELECTOR */}
      <div style={headerStyle}>
        <div style={titleRow}>
          <h2 style={titleStyle}>{"\u{1F4DA}"} Homework Helper</h2>
          {selectedKid && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {/* HW-01: detailMode toggle — Brief vs Detailed responses */}
              <button
                style={{
                  ...muteBtn,
                  background: detailMode ? V.accent : V.bgCardAlt,
                  color: detailMode ? "#fff" : V.textSecondary,
                }}
                onClick={() => setDetailMode((m) => !m)}
                aria-label={detailMode ? "Switch to brief responses" : "Switch to detailed responses"}
                aria-pressed={detailMode}
              >
                {detailMode ? "\u{1F4D6} Detailed" : "\u{1F4DD} Brief"}
              </button>
              {/* HW-02: stepByStep toggle — persists per-kid via Firebase */}
              <button
                style={{
                  ...muteBtn,
                  background: stepByStep ? V.accent : V.bgCardAlt,
                  color: stepByStep ? "#fff" : V.textSecondary,
                }}
                onClick={() => {
                  const next = !stepByStep;
                  setStepByStep(next);
                  if (kidName && fbSet) {
                    fbSet(`kidsData/${kidName}/hwPrefs/stepByStep`, next);
                  }
                }}
                aria-label={stepByStep ? "Switch to direct answers" : "Switch to step-by-step"}
                aria-pressed={stepByStep}
              >
                {stepByStep ? "\u{1FA9C} Steps" : "\u{27A1} Direct"}
              </button>
              {/* Feature 13: Mute toggle */}
              {ttsAvailable && (
                <button
                  style={muteBtn}
                  onClick={() => {
                    if (!muted && ttsAvailable) window.speechSynthesis.cancel();
                    setMuted((m) => !m);
                  }}
                  aria-label={muted ? "Unmute auto-read" : "Mute auto-read"}
                >
                  {muted ? "\u{1F507} Muted" : "\u{1F50A} Sound"}
                </button>
              )}
            </div>
          )}
        </div>
        <select
          style={selectStyle}
          value={selectedKid}
          onChange={(e) => {
            if (ttsAvailable) window.speechSynthesis.cancel();
            setSelectedKid(e.target.value);
            setMessages([]);
            setMsgCount(0);
            // HW-03: kid change resets frustration counter
            socraticAttemptsRef.current = 0;
            const d = new Date();
            setSessionId(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${d.getTime()}`);
          }}
          aria-label="Select a kid"
        >
          <option value="">-- Pick a learner --</option>
          {kidProfiles.map(([key, p]) => (
            <option key={key} value={key}>
              {p.emoji || "\u{1F9D2}"} {p.name || key}
            </option>
          ))}
        </select>

        {/* Past Sessions button */}
        {selectedKid && (
          <button style={pastBtn} onClick={loadPastSessions}>
            {"\u{1F4CB}"} Past Sessions
          </button>
        )}
      </div>

      {/* PAST SESSIONS PANEL */}
      {showPastSessions && selectedKid && (
        <div
          style={{
            maxHeight: 220,
            overflowY: "auto",
            background: V.bgCardAlt,
            padding: V.sp3,
            borderBottom: `1px solid ${V.borderSubtle}`,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: V.textSecondary }}>
            {"\u{1F4CB}"} Past Sessions for {kidName}
          </div>
          {pastSessions ? (
            Object.entries(pastSessions)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 10)
              .map(([sid, data]) => {
                const subjectInfo =
                  SUBJECTS.find((s) => s.key === data.subject) || { icon: "\u{1F4DA}", label: "General" };
                const dateStr = sid.split("_")[0];
                const msgs = data.messages || [];
                return (
                  <button
                    type="button"
                    key={sid}
                    onClick={() => {
                      // HW-04: Resume — load messages into a new sessionId so the original record stays immutable
                      if (ttsAvailable) window.speechSynthesis.cancel();
                      setMessages(msgs);
                      setSubject(data.subject || "math");
                      setMsgCount(msgs.length);
                      socraticAttemptsRef.current = 0;
                      const d = new Date();
                      setSessionId(
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${d.getTime()}`
                      );
                      setShowPastSessions(false);
                    }}
                    aria-label={`Resume session from ${dateStr}, subject ${subjectInfo.label}, ${msgs.length} messages`}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      marginBottom: 6,
                      minHeight: 44,
                      borderRadius: V.r2,
                      background: V.bgCard,
                      border: `1px solid ${V.borderSubtle}`,
                      fontSize: 13,
                      color: V.textSecondary,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, color: V.textPrimary }}>{dateStr}</span>
                      <span style={{ color: V.textMuted }}>
                        {subjectInfo.icon} {subjectInfo.label}
                      </span>
                      <span style={{ color: V.textMuted, fontSize: 12 }}>{msgs.length} msgs</span>
                    </span>
                    <span style={{ fontWeight: 700, color: V.accent, whiteSpace: "nowrap" }}>
                      {"\u{25B6}"} Resume
                    </span>
                  </button>
                );
              })
          ) : (
            <div style={{ fontSize: 13, color: V.textMuted }}>No past sessions found.</div>
          )}
        </div>
      )}

      {/* SUBJECT TABS — Feature 12: ALWAYS visible when a kid is selected */}
      {selectedKid && (
        <div style={subjectRow}>
          {SUBJECTS.map((s) => (
            <button
              key={s.key}
              style={subjectBtnStyle(subject === s.key)}
              onClick={() => switchSubject(s.key)}
              aria-label={`Subject: ${s.label}`}
              aria-pressed={subject === s.key}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      )}

      {/* CHAT OR EMPTY STATE */}
      {!selectedKid ? (
        <div style={emptyState}>
          <span style={{ fontSize: 48 }}>{"\u{1F9D1}\u200D\u{1F393}"}</span>
          <p style={{ fontSize: 16 }}>Select a kid above to start tutoring!</p>
        </div>
      ) : (
        <>
          <div style={chatArea}>
            {messages.length === 0 && (
              <div style={{ ...emptyState, flex: "unset", padding: "32px 0" }}>
                <span style={{ fontSize: 40 }}>{"\u{1F44B}"}</span>
                <p style={{ fontSize: 15, color: V.textMuted }}>
                  Hi {kidName}! Ask me a {SUBJECTS.find((s) => s.key === subject)?.label.toLowerCase() || ""} question!
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={bubbleStyle(m.role === "user")}>
                {m.role === "assistant" && (
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: V.textMuted }}>
                    {"\u{1F9D1}\u200D\u{1F3EB}"} Tutor
                  </div>
                )}
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                {/* Feature 13: Speak button on every assistant message */}
                {m.role === "assistant" && ttsAvailable && (
                  <button
                    style={speakBtnStyle}
                    onClick={() => speakText(m.content)}
                    aria-label="Read aloud"
                  >
                    {"\u{1F50A}"} Read Aloud
                  </button>
                )}
              </div>
            ))}
            {/* Typing indicator */}
            {loading && (
              <div style={typingIndicator}>
                <div style={pulsingDot} />
                {"\u{1F9D1}\u200D\u{1F3EB}"} Tutor is thinking...
              </div>
            )}
            {/* Brain break with reset button */}
            {rateLimited && (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  borderRadius: V.r3,
                  background: V.bgElevated || V.bgCardAlt,
                  color: V.success,
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                Great work today! Take a brain break {"\u{1F9E0}"}
                <br />
                <button style={newSessionBtn} onClick={resetSession}>
                  {"\u{1F504}"} Start New Session
                </button>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* INPUT BAR */}
          <div style={inputRow}>
            <input
              style={textInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={rateLimited ? "Session complete!" : "Ask a question..."}
              disabled={rateLimited || loading}
              aria-label="Type your question"
            />
            {speechSupported && (
              <button
                style={micBtnBase(recording)}
                onClick={toggleRecording}
                disabled={rateLimited}
                aria-label={recording ? "Stop recording" : "Start voice input"}
              >
                {recording && (
                  <span
                    style={{
                      position: "absolute",
                      top: isLucaMode ? 8 : 4,
                      right: isLucaMode ? 8 : 4,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#ef4444",
                      animation: "recordPulse 1s infinite",
                    }}
                  />
                )}
                {recording ? "\u{1F534}" : "\u{1F3A4}"}
              </button>
            )}
            <button
              style={{
                ...sendBtnStyle,
                opacity: !input.trim() || loading || rateLimited ? 0.5 : 1,
              }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading || rateLimited}
              aria-label="Send message"
            >
              {"\u27A4"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
