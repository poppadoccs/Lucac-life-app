import { useState, useRef, useEffect } from "react";
import { groqFetch, createSpeechRecognition, triggerConfetti } from "./utils";

const SUBJECTS = [
  { key: "math", label: "Math", icon: "\u{1F522}" },
  { key: "reading", label: "Reading", icon: "\u{1F4D6}" },
  { key: "science", label: "Science", icon: "\u{1F52C}" },
  { key: "funfacts", label: "Fun Facts", icon: "\u{1F31F}" },
];

const MAX_MESSAGES = 20;

function getAge(kid) {
  if (kid && kid.age) return kid.age;
  return 8;
}

function buildSystemPrompt(name, age, subject) {
  const subjectLabel = SUBJECTS.find((s) => s.key === subject)?.label || "General";
  const ageNote =
    age <= 7
      ? "Use very simple words, lots of emojis, max 2 short sentences."
      : "Use full sentences appropriate for a grade 3-4 student. Show your work for math problems.";
  return (
    `You are a kind, patient tutor for a ${age} year old named ${name}. Subject: ${subjectLabel}. ` +
    `NEVER give the answer directly. Always guide them to figure it out. Use encouraging language. ` +
    `If they get it right, celebrate with enthusiasm. If wrong, say 'Almost! Let's try again \u{1F4AA}' — never say 'wrong' or 'incorrect'. ` +
    `For math, show step by step. Keep responses under 100 words. ${ageNote} ` +
    `SAFETY: If the child asks anything inappropriate, off-topic, or not school-related, kindly redirect them back to homework. ` +
    `Never discuss violence, adult content, or anything not age-appropriate.`
  );
}

function shouldCelebrate(text, age) {
  const lower = (text || "").toLowerCase();
  if (age <= 7) {
    return /great|awesome|correct|right|amazing|fantastic|wonderful|good job|well done|perfect|excellent|bravo/.test(lower);
  }
  return /correct|well done|excellent|perfect/.test(lower);
}

export default function HomeworkHelper({ V, profiles, kidsData, fbSet, GROQ_KEY, showToast }) {
  const [selectedKid, setSelectedKid] = useState("");
  const [subject, setSubject] = useState("math");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [sessionId] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${d.getTime()}`;
  });
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [pastSessions, setPastSessions] = useState(null);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const rateLimited = msgCount >= MAX_MESSAGES;

  const kidProfiles = Object.entries(profiles || {}).filter(
    ([, p]) => p.type === "kid"
  );

  const currentKid = selectedKid ? (profiles || {})[selectedKid] : null;
  const kidAge = currentKid ? getAge(currentKid) : 8;
  const kidName = currentKid ? currentKid.name || selectedKid : "";

  useEffect(() => {
    const rec = createSpeechRecognition();
    if (rec) {
      setSpeechSupported(true);
      recognitionRef.current = rec;
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setInput((prev) => (prev ? prev + " " + transcript : transcript));
        setRecording(false);
      };
      rec.onerror = () => setRecording(false);
      rec.onend = () => setRecording(false);
    }
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) { /* ignore */ }
      }
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0 && kidName && fbSet) {
      fbSet(`homeworkSessions/${kidName}/${sessionId}`, {
        subject,
        messages,
        updatedAt: Date.now(),
      });
    }
  }, [messages, kidName, sessionId, subject, fbSet]);

  async function sendMessage(text) {
    if (!text.trim() || !selectedKid || loading || rateLimited) return;
    const userMsg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setMsgCount((c) => c + 1);
    setLoading(true);

    const systemPrompt = buildSystemPrompt(kidName, kidAge, subject);
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...newMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const result = await groqFetch(GROQ_KEY, apiMessages, { maxTokens: 300 });
    setLoading(false);

    if (result.ok && result.data) {
      const assistantMsg = { role: "assistant", content: result.data };
      setMessages((prev) => [...prev, assistantMsg]);
      setMsgCount((c) => c + 1);
      if (shouldCelebrate(result.data, kidAge)) {
        triggerConfetti(document.body, kidAge <= 7 ? "small" : "small");
      }
    } else {
      showToast && showToast("Oops, tutor had a hiccup. Try again!");
    }
  }

  function handleStepByStep() {
    sendMessage("Can you show me step by step?");
  }

  function toggleRecording() {
    if (!recognitionRef.current) return;
    if (recording) {
      recognitionRef.current.abort();
      setRecording(false);
    } else {
      setRecording(true);
      recognitionRef.current.start();
    }
  }

  function loadPastSessions() {
    setShowPastSessions((p) => !p);
    if (!showPastSessions && kidsData && kidName) {
      const sessions = kidsData?.homeworkSessions?.[kidName] || null;
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
  const header = {
    padding: V.sp4,
    background: V.bgCard,
    borderBottom: `1px solid ${V.borderDefault}`,
    boxShadow: V.shadowCard,
  };
  const title = {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    color: V.textPrimary,
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
  const subjectBtn = (active) => ({
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
  const bubble = (isUser) => ({
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
  const sendBtn = {
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
  const micBtn = (active) => ({
    minWidth: 44,
    minHeight: 44,
    borderRadius: "50%",
    border: "none",
    background: active ? V.danger : V.bgCardAlt,
    color: active ? "#fff" : V.textSecondary,
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: active ? "micPulse 1s infinite" : "none",
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

  // ---- MIC PULSE KEYFRAME (injected once) ----
  useEffect(() => {
    if (document.getElementById("hw-mic-pulse-style")) return;
    const style = document.createElement("style");
    style.id = "hw-mic-pulse-style";
    style.textContent = `@keyframes micPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 10px rgba(239,68,68,0)} }`;
    document.head.appendChild(style);
    return () => { try { style.remove(); } catch (_) { /* ignore */ } };
  }, []);

  // ---- NO KIDS ----
  if (kidProfiles.length === 0) {
    return (
      <div style={wrap}>
        <div style={header}>
          <h2 style={title}>{"\u{1F4DA}"} Homework Helper</h2>
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
      <div style={header}>
        <h2 style={title}>{"\u{1F4DA}"} Homework Helper</h2>
        <select
          style={selectStyle}
          value={selectedKid}
          onChange={(e) => {
            setSelectedKid(e.target.value);
            setMessages([]);
            setMsgCount(0);
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

        {/* Past Sessions button (admin/parent review) */}
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
              .map(([sid, data]) => (
                <div
                  key={sid}
                  style={{
                    padding: "6px 10px",
                    marginBottom: 4,
                    borderRadius: V.r2,
                    background: V.bgCard,
                    fontSize: 13,
                    color: V.textSecondary,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{sid.split("_")[0]}</span>
                  {" — "}
                  {data.subject || "General"}
                  {" — "}
                  {(data.messages || []).length} messages
                </div>
              ))
          ) : (
            <div style={{ fontSize: 13, color: V.textMuted }}>No past sessions found.</div>
          )}
        </div>
      )}

      {/* SUBJECT BUTTONS */}
      {selectedKid && (
        <div style={subjectRow}>
          {SUBJECTS.map((s) => (
            <button
              key={s.key}
              style={subjectBtn(subject === s.key)}
              onClick={() => setSubject(s.key)}
              aria-label={`Subject: ${s.label}`}
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
              <div key={i} style={bubble(m.role === "user")}>
                {m.role === "assistant" && (
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: m.role === "user" ? "#fff" : V.textMuted }}>
                    {"\u{1F9D1}\u200D\u{1F3EB}"} Tutor
                  </div>
                )}
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            ))}
            {/* Step by step prompt for math */}
            {subject === "math" && messages.length > 0 && messages[messages.length - 1].role === "assistant" && !rateLimited && (
              <button style={stepBtn} onClick={handleStepByStep}>
                {"\u{1F4DD}"} Show me step by step
              </button>
            )}
            {loading && (
              <div
                style={{
                  ...bubble(false),
                  fontStyle: "italic",
                  color: V.textMuted,
                }}
              >
                {"\u{1F914}"} Thinking...
              </div>
            )}
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
                style={micBtn(recording)}
                onClick={toggleRecording}
                disabled={rateLimited}
                aria-label={recording ? "Stop recording" : "Start voice input"}
              >
                {recording ? "\u{1F534}" : "\u{1F3A4}"}
              </button>
            )}
            <button
              style={{
                ...sendBtn,
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
