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
  "CRITICAL MATH RULE: Any arithmetic you write (like 5+4=X, 5x10=X) is AUTOMATICALLY VERIFIED by JavaScript before the student ever sees it. If you write a wrong answer, it will be silently corrected. So ALWAYS compute step-by-step and double-check. Examples: 5x10=50 (not 40). 7x8=56. 5+4=9. 12+15=27. Kids are trusting you — the numbers you write must be correct.";

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

  // BF-B/C/F: Fun Facts mode — safety-first rewrite.
  // Note: the primary safety layer is detectUnsafeInput() in doAICall which
  // runs BEFORE this prompt is ever built. This prompt is the SECOND line of
  // defense for edge cases that slip past the regex. Previous version put the
  // SAFETY clause at the end after a "NEVER correct" instruction, which
  // Groq prioritized — leading to celebration of unsafe and factually-wrong
  // content. New structure: SAFETY OVERRIDE first, FACTUAL HONESTY second,
  // TONE rules third, fun-facts behavior last. Bans ALL CAPS, multiple
  // exclamation marks, and hallucinated catchphrases like "ya nay nay".
  if (subject === "funfacts") {
    return (
      // SAFETY OVERRIDE — absolute, takes precedence over everything below
      `SAFETY OVERRIDE (this rule takes precedence over EVERY other rule in this prompt): If ${name} mentions self-harm, suicide, dying, "ending it", violence, hatred toward themselves or others, sexual content, drugs, or anything that suggests they are in danger or distress — STOP fun facts mode immediately. Respond with warmth and care. Do NOT celebrate the input. Do NOT continue the fun facts game with that input. Gently redirect and if it sounds serious suggest they talk to a trusted grown-up like a parent or teacher. This rule overrides "never correct" and "always celebrate" below. ` +
      // FACTUAL HONESTY — wrong claims get warmly corrected, not affirmed
      `FACTUAL HONESTY: If ${name} says something that is factually wrong (examples: "bacon is made from dog livers", "the sky is purple", "dogs lay eggs"), gently and warmly correct it. Never affirm a wrong fact as if it were right. Format: "That's a creative idea! Actually, [the truth]. Want to know something cool about [the real topic]?" Children learn from honest correction, and they get hurt by being told false things are true. ` +
      // TONE — kill the sycophancy and the hallucinated catchphrase
      `TONE: Speak naturally and warmly, like a kind friend or favorite aunt/uncle. Do NOT use ALL CAPS for emphasis. Do NOT use multiple exclamation marks together — one "!" is fine, "!!!" is not. Do NOT invent catchphrases or pet names. NEVER say "ya nay nay" or anything like it — use ${name}'s real name. Be enthusiastic but not exhausting. One emoji per response is plenty, not five. ` +
      // CORE FUN FACTS BEHAVIOR (only applies after the safety + honesty + tone rules above)
      `When ${name} asks a curious question or shares an idea (and the input is safe AND factually plausible), share a real, true, age-appropriate fun fact about that topic. Then ask one open-ended follow-up question to keep their curiosity going. ` +
      `Do not Socratically scaffold or make them guess. Do not lecture. Just engage warmly, share knowledge, and invite more curiosity. ` +
      `${ageNote}`
    );
  }

  // BF-A: Reading mode — when the student wants content, GENERATE it directly.
  // Reading was previously falling through to the standard Socratic branch which
  // refused to write passages and instead asked "what might page 1 contain?".
  if (subject === "reading") {
    return (
      `${SAFETY} ` +
      `You are a kind reading tutor and storyteller for ${name}, a ${age} year old. ${name} wants to practice reading. ` +
      `When ${name} asks you to write a story, passage, paragraph, report, or anything to read — ACTUALLY WRITE IT. ` +
      `Do not ask them to write it for you. Do not Socratically ask "what might be on page 1?" or "what should the title be?". Just WRITE the content directly. ` +
      `Length guide: for a 6 year old, write 150-300 words; for an 8+ year old, write 300-600 words. Use age-appropriate vocabulary, short sentences, and a clear beginning-middle-end. ` +
      `If ${name} asks about a word they don't know, define it in simple terms with an example sentence. ` +
      `If ${name} asks comprehension questions about a story you already wrote, answer them gently and ask one easy follow-up question to check understanding. ` +
      `If ${name} asks you to repeat a single word many times "to learn it", politely explain that's not how reading practice works and offer to write a fun short story that uses that word a few times in context. ` +
      `${age <= 7 ? "Use very simple words and short sentences a 6-year-old can follow. Include emojis." : "Use full sentences appropriate for a grade 3-4 student."}`
    );
  }

  // BF-D: Frustration switch — after 2 failed Socratic attempts, STOP guiding and answer directly.
  // Previous version was too abstract. New version uses a few-shot example IN
  // the prompt with explicit "FORMAT EXAMPLE ONLY" guard so llama-8b doesn't
  // parrot the example numbers into its response. Also note: doAICall resets
  // the counter after this branch fires, so the frustration mode is a ONE-SHOT
  // unsticking nudge, not a permanent mode lock.
  if (socraticAttempts >= 2) {
    return (
      `${SAFETY} ` +
      `You are a kind, patient tutor for ${name}, a ${age} year old. Subject: ${subjectLabel}. ` +
      `IMPORTANT: ${name} has tried to solve the current problem 2 or more times and is stuck. They are getting frustrated. ` +
      `STOP using Socratic questioning. STOP making them guess. Do NOT ask "can you try again?" or "what do you think?" or "let's count together". ` +
      `Instead, walk through the solution to ${name}'s EXACT CURRENT QUESTION step by step, then STATE THE FINAL ANSWER EXPLICITLY. ` +
      (subject === "math" ? `Write it as "<their question> = <computed answer>" so the student can SEE the exact number. ` : `Give a clear, direct answer in plain language so the student can see the solution. `) +
      `They cannot figure it out on their own right now. ` +
      `FORMAT EXAMPLE ONLY — NEVER reuse these numbers. Repeat the student's exact expression from the latest turn before answering; do not substitute new numbers. Example format only: for a hypothetical "what is 12 + 12" question the response would look like: "Let's solve this together. 12 + 12 means we add 12 to itself. Counting up from 12: 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24. So 12 + 12 = 24. Want to try a similar one like 13 + 13 on your own?" That is the FORMAT. Use the student's real question and real numbers, NOT 12 + 12 (unless that is literally what they asked). ` +
      `Use warm, encouraging language. Never use the words "wrong" or "incorrect". Never say "almost" or "try again" in this mode — those phrases restart the Socratic loop and are banned here. ` +
      `${ageNote} ` +
      (subject === "math" ? MATH_VERIFICATION_PROMPT + " " : "")
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

// JavaScript ground-truth math verification.
// LLMs pattern-match arithmetic; they don't actually compute. Every time we ask
// Groq to explain 5+4, there's a real chance it writes "= 8" or "= 10". This
// function scans the AI's response for "<expression> = <answer>" patterns,
// computes the true answer in a sandboxed Function() (only digits and
// arithmetic operators allowed — no arbitrary code), and silently rewrites any
// wrong answer to the correct one before the student ever sees it.
//
// Handles: 5+4=9, 5 + 4 = 9, 5×10=50, 5x10=50, 12÷3=4, 1+2+3=6, 5+4*2=13.
// Skips: word-answer forms ("five plus four is nine"), fractional answers like
// "3/4" that can't be a trailing number, word problems without explicit
// expressions, and any expression containing non-numeric chars.
//
// Background: the "5×10=40 incident" from earlier in this project got a
// prompt-only "please double-check" fix, which LLMs ignore ~5% of the time.
// This is the hard fix that actually guarantees correctness.
function verifyMath(text) {
  if (typeof text !== "string" || !text) return text;
  // Match: <number>(<op><number>)+ = <number>
  // Operators: + - * x × / ÷    (x and × are kid/teacher multiply notation)
  const pattern = /(\d+(?:\.\d+)?(?:\s*[+\-*x×/÷]\s*\d+(?:\.\d+)?)+)\s*=\s*(-?\d+(?:\.\d+)?)/gi;
  return text.replace(pattern, (match, expr, statedAnswer) => {
    // Normalize kid-friendly operators to JS operators
    const normalized = expr.replace(/[x×]/gi, "*").replace(/÷/g, "/");
    // Whitelist: only digits, standard operators, dots, whitespace — NO letters,
    // NO keywords, NO function calls. This makes Function() safe against code injection.
    if (!/^[\d\s+\-*/.]+$/.test(normalized)) return match;
    try {
      // eslint-disable-next-line no-new-func
      const trueAnswer = Function(`"use strict"; return (${normalized});`)();
      if (typeof trueAnswer !== "number" || !isFinite(trueAnswer)) return match;
      // Float-tolerance comparison (0.1 + 0.2 = 0.30000000000000004 shouldn't trip us)
      if (Math.abs(Number(statedAnswer) - trueAnswer) < 1e-9) return match;
      // AI was WRONG. Replace with the correct answer while keeping the expression formatting.
      return `${expr} = ${trueAnswer}`;
    } catch {
      return match;
    }
  });
}

// BF-0: Deterministic safety guard for kid input.
// Follows the same principle as verifyMath: anything safety-critical lives in
// JavaScript, not in LLM prompt instructions. An 8B Llama model cannot be
// trusted to reliably follow "never celebrate self-harm" instructions under
// adversarial phrasing. This function runs BEFORE groqFetch in doAICall; if
// unsafe input is detected, Groq is never called and a hardcoded safe response
// is returned instead. False positives are acceptable (a borderline message
// gets redirected gently); false negatives are not (unsafe content reaching
// Groq and getting celebrated).
const SAFETY_RESPONSE_TEXT =
  "I'm really glad you told me. You matter. I can't talk about this here — please tell a trusted grown-up right now, like a parent, teacher, or school counselor. They want to help. When you're ready, I'm here to help with homework or fun facts about something else.";

const UNSAFE_INPUT_PATTERNS = [
  // === Self-harm & suicide — direct phrasing ===
  /\bkill(ing)?\s+my\s?self\b/i,
  /\bhurt(ing)?\s+my\s?self\b/i,
  /\bcut(ting)?\s+my\s?self\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend(ing)?\s+(my|his|her|their)\s+life\b/i,
  /\bend\s+(it\s+all|everything)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bwanna\s+die\b/i,
  /\bi\s+want\s+it\s+to\s+end\b/i,
  /\bi\s+(should|wanna|want\s+to)\s+just\s+end\s+(it|everything)\b/i,
  // === Self-harm & suicide — wish/hypothetical phrasing ===
  /\bi\s+wish\s+i\s+(was|were)\s+dead\b/i,
  /\bi\s+wish\s+i\s+(wasn'?t|was\s+never|wasn't\s+ever)\s+(born|alive|here)\b/i,
  /\bi\s+(don'?t|do\s+not)\s+want\s+to\s+(be\s+alive|live|exist|be\s+here)\b/i,
  /\blife\s+(isn'?t|is\s+not)\s+worth\s+(it|living|anything)\b/i,
  /\bi\s+(hate|can'?t\s+stand)\s+(living|being\s+alive|my\s+life)\b/i,
  /\bi\s+can'?t\s+(go\s+on|do\s+this\s+anymore|keep\s+going)\b/i,
  /\bi\s+want\s+to\s+dis[sa]*p+ear(\s+(forever|for\s+good))?\b/i,
  // === Self-harm & suicide — isolation/worthlessness phrasing ===
  /\bi\s+hate\s+my\s?self\b/i,
  /\bnobody\s+(cares|loves|likes)\s+(about\s+)?me\b/i,
  /\bno\s+one\s+(cares|loves|likes)\s+(about\s+)?me\b/i,
  /\bno\s+one\s+would\s+(care|notice|miss\s+me)\s+if\s+i\s+(died|was\s+gone|wasn'?t\s+here|disappear)/i,
  /\beveryone\s+(would|'d)\s+be\s+better\s+(off\s+)?without\s+me\b/i,
  /\bworld\s+(is|would\s+be)\s+better\s+without\s+me\b/i,
  /\bdying\s+(is|would\s+be|sounds)\s+(better|nice|cool|fun)\b/i,
  // === Self-harm & suicide — slang abbreviations ===
  /\bkms\b/i,         // "kill myself" slang, common in text
  /\bkys\b/i,         // "kill yourself" slang, aimed at others but still unsafe context
  // === Violence towards others ===
  /\b(kill|hurt|shoot|stab|beat\s+up|punch|attack|strangle)\s+(him|her|them|you|my\s+(mom|dad|sister|brother|friend|classmate)|the\s+(teacher|kid|boy|girl|bus\s+driver))\b/i,
  /\bi'?m\s+(gonna|going\s+to)\s+(kill|hurt|shoot|stab|beat|attack)\s+(him|her|them|you|my\s*(self|mom|dad|sister|brother|friend)|the\s+(teacher|kid|boy|girl))\b/i,
  // === Sexual content — action/intent based, NOT bare anatomy ===
  // (bare anatomy nouns removed per codex review — penis/vagina/breast/nipple
  // can appear in legitimate science questions. We match sexualized context.)
  /\b(porn|pornography|horny|masturbat(e|ing|ion))\b/i,
  /\b(sex|naked|nude)\s+(with|video|pic|photo|picture|time|me|you)\b/i,
  /\bshow\s+me\s+(your|the)\s+(body|privates|naked|butt)\b/i,
  /\btouch\s+(my|your)\s+(private|privates|pee\s?pee)\b/i,
  // === Drugs — action/intent, NOT educational curiosity ===
  /\b(i|we)\s+(want\s+to\s+try|tried|did|took|used)\s+(drugs|cocaine|heroin|meth|weed|crack|acid|ecstasy)\b/i,
  /\bgetting\s+high\s+(on|with|off)\b/i,
];

function detectUnsafeInput(text) {
  if (typeof text !== "string" || !text) return false;
  return UNSAFE_INPUT_PATTERNS.some((pattern) => pattern.test(text));
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

    // BF-0: Deterministic safety guard — check the kid's latest message BEFORE
    // calling Groq. If unsafe phrasing is detected (self-harm, violence, etc.),
    // emit a hardcoded safe response and bypass the LLM entirely. This is the
    // first line of defense; the Fun Facts prompt rewrite is the second. This
    // applies to ALL subjects, not just funfacts, because any subject can
    // receive distressing input.
    const lastUserMsg = newMessages[newMessages.length - 1];
    if (lastUserMsg?.role === "user" && detectUnsafeInput(lastUserMsg.content)) {
      const safeMsg = { role: "assistant", content: SAFETY_RESPONSE_TEXT };
      setMessages((prev) => [...prev, safeMsg]);
      setMsgCount((c) => c + 1);
      setLoading(false);
      // Reset frustration counter so the next safe turn starts clean
      socraticAttemptsRef.current = 0;
      return;
    }

    const systemPrompt = buildSystemPrompt(kidName, kidAge, subject, {
      detailMode,
      stepByStep,
      socraticAttempts: socraticAttemptsRef.current,
    });
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...newMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    ];

    // BF-A: Reading subject auto-bumps maxTokens to 1500 so generated passages
    // don't get truncated mid-story (brief mode 300 tokens ≈ 225 words, not
    // enough for the Reading prompt's 300-600 word range). HW-01: detailMode
    // ALSO bumps maxTokens to 1500 for thorough standard-mode responses.
    let result;
    try {
      result = await groqFetch(GROQ_KEY, apiMessages, {
        maxTokens: (detailMode || subject === "reading") ? 1500 : 300,
      });
    } finally {
      setLoading(false);
    }

    if (result?.ok && result.data) {
      // MATH GROUND-TRUTH: silently correct any wrong arithmetic BEFORE the student sees it.
      // This is the hard fix for the "5x10=40 incident" class of bugs. Prompt-level
      // "please double-check" is unreliable; JavaScript is not. See verifyMath() for details.
      const verifiedContent = verifyMath(result.data);
      const assistantMsg = { role: "assistant", content: verifiedContent };
      setMessages((prev) => [...prev, assistantMsg]);
      setMsgCount((c) => c + 1);

      // BF-D: Capture whether THIS response was emitted under frustration mode.
      // If so, reset the counter — frustration mode is a one-shot unsticking
      // nudge, not a permanent mode lock. Without this reset the counter
      // sticks at >=2 forever (unless the tutor happens to use a specific
      // celebration word) and subsequent Socratic turns never resume.
      const wasFrustrationMode = socraticAttemptsRef.current >= 2;

      // HW-03: frustration tracking — only for Socratic subjects (not funfacts)
      if (subject !== "funfacts") {
        if (wasFrustrationMode) {
          // One direct-explain response fired; reset so next turn is Socratic again
          socraticAttemptsRef.current = 0;
        } else if (shouldCelebrate(verifiedContent, kidAge)) {
          // celebration = student got it right, reset the frustration counter
          socraticAttemptsRef.current = 0;
        } else if (/almost|try again|let'?s try|not quite/i.test(verifiedContent)) {
          // inverse-celebrate language = another failed attempt
          socraticAttemptsRef.current += 1;
        }
      }

      if (shouldCelebrate(verifiedContent, kidAge)) {
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
