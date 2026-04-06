# Feature Landscape

**Domain:** Family life management app — AI tutoring, kid games, co-parenting calendar
**Researched:** 2026-04-05
**Confidence note:** Web search and WebFetch are blocked in this environment. All findings are from training knowledge (cutoff August 2025). Confidence levels reflect this limitation honestly.

---

## Domain 1: AI Homework Tutoring

### What the best apps do differently

**Khan Academy / Khanmigo** (HIGH confidence — well-documented pedagogy)

The core principle behind Khanmigo and Socratic is "guided discovery," not answer delivery. The AI never gives the final answer on the first pass. Instead it:

1. Asks the student what they already tried — surfaces prior knowledge
2. Breaks the problem into the smallest possible step and asks about just that step
3. Gives a hint phrased as a question ("What operation would you do to both sides here?")
4. Only after 2-3 failed attempts provides a worked example — then asks a parallel problem

What makes it feel *not stubborn*: the AI detects when the student is frustrated (repeated wrong answers, one-word replies, "just tell me") and **switches modes** — it gives more direct guidance when frustration is detected, and returns to Socratic questioning when the student is calm. The AI tracks mood within the session.

**Photomath** (HIGH confidence)

Photomath's differentiator is **step visibility** — the student controls how much to reveal. They can see:
- Just the final answer (confirmation mode)
- The steps revealed one at a time (teaching mode)
- Animated step-by-step with pause/rewind

The key insight: **control over pacing**. A child who already understands most of the problem doesn't want to be walked through 8 steps. They want to check one specific step. Photomath lets them jump to step 3 of 8.

**Socratic by Google** (MEDIUM confidence)

Socratic works best for reading comprehension and science. It explains concepts using **multiple explanation formats for the same topic**:
- Plain English paragraph
- Analogy ("it's like...")
- Diagram/visual (when available)
- Bullet list of key points

The principle: if the first explanation didn't land, try a different modality — don't repeat the same explanation louder.

### Current HomeworkHelper problems (from PROJECT.md)

The existing AI tutor is:
- Stubborn — won't give long responses even when asked
- Repeats the same answer instead of trying a different explanation
- Past sessions broken

Root cause (inferred from CLAUDE.md Lessons Learned): Groq's Llama models are prone to truncating output unless max_tokens is explicitly set high. The system prompt probably has "be concise" language that's working against long explanations.

---

## Table Stakes — Homework Tutoring

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Response length control ("give me the full explanation") | Kids get frustrated when AI refuses to help fully | Low | Just remove "be concise" prompt constraint and add max_tokens override |
| Multiple explanation styles (paragraph, bullets, analogy) | Different kids understand differently; repeating same text is useless | Medium | System prompt restructure + fallback trigger when kid replies "I don't get it" |
| Hint-before-answer default (Socratic mode) | Pedagogically correct for homework; teachers approve | Low | System prompt already likely has this — needs a toggle to turn it off |
| Hint-to-answer escalation after 2 failures | Prevents frustration; mirrors good tutoring | Medium | Track attempt count per question in component state |
| Frustration detection and mode switch | "Just tell me" / "I don't get it" / repeated wrong answers | Medium | Pattern match on student input, switch from Socratic to direct |
| Working session history | Returning to yesterday's problem is expected | Medium | Firebase reads are broken — needs debugging, not new architecture |
| Read-aloud for instructions | Kids ages 6-8 have emerging reading skills | Low | Web Speech API already in project — just fix the V1 Siri voice issue |

## Differentiators — Homework Tutoring

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Step-by-step toggle per subject (show all / one at a time / just answer) | Yana (8) is a power user — she wants control. Luca (6) needs full walkthrough | Low | Single state variable per session, persisted to Firebase |
| Age-appropriate explanation mode | 6-year-old math vs 8-year-old reading comprehension need different voices | Low | System prompt already has kid selector — extend to adjust explanation depth |
| "Try a different way" button | Explicit user trigger to get a reframed explanation | Low | Appends "Explain this a completely different way using an analogy" to next message |
| Subject-specific persona | Math tutor feels different from reading tutor feels different from science tutor | Medium | Per-subject system prompt prefix with personality descriptor |
| Celebrate effort not just correct answers | "Good try! Here's where it went off the rails..." builds confidence | Low | System prompt instruction: always acknowledge effort before correcting |
| Session timer + "good stopping point" suggestion | Kids need to know when they've done enough | Low | Component-level timer, show "You've been working 20 minutes — take a break?" |

## Anti-Features — Homework Tutoring

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Strict Socratic mode with no override | Works for classroom AI, kills trust in a home app. Danyells or Yana will uninstall | Add explicit "just tell me the answer" button that works without guilt |
| Unlimited session length with no break suggestion | Kids burn out; parents blame the app | 20-minute soft limit with break suggestion (not hard cutoff) |
| Grading / percentage scores | This is a home tutor, not a test. Scores create anxiety for a 6-year-old | Encouragement language only, no numeric judgment |
| Subjects outside Yana/Luca's actual grade levels | An 8-year-old asking about calculus confuses the AI badly | Grade-level inference from kid profile age + subject selected |

---

## Domain 2: Kid Games (Ages 6-8)

### What the best platforms do differently

**ABCmouse** (HIGH confidence — market leader in ages 2-8 educational apps)

ABCmouse's core retention mechanism is the **visual progress map** — a scrolling world where each activity unlocks the next room/world. Children can *see* their progress spatially. The map is always in the background even when playing — kids understand exactly where they are in a larger journey.

Key game design principles ABCmouse proves:
1. **Immediate positive feedback on any input** — even wrong answers get "ooh, almost! try again" animations before failure state
2. **30-second payoff cycle** — every game has a win condition reachable in under 30 seconds. Kids ages 6-8 have 3-5 minute total attention spans per activity
3. **Predictable escalation** — difficulty increases visibly ("Level 2!" with fanfare), never invisibly
4. **Character continuity** — the same animated characters appear across all games. Kids form attachment to recurring characters, which is why they return

**Prodigy Math** (HIGH confidence — 100M+ users, well-analyzed design)

Prodigy's design is deceptive in the best way: kids think they're playing an RPG. The math is the cost of attacking a monster. Key mechanics:

1. **Variable reward schedule** — you don't know if you'll get a rare item after answering. This is Skinner box design, exactly what slot machines use, and it keeps 8-year-olds coming back for hours
2. **Visible character customization** — kids spend earned "stars" on outfits, pets, equipment. The avatar is the motivation, not the math
3. **Boss battles** — a dramatic encounter that requires answering harder questions correctly. Creates real stakes without real consequences
4. **Progress that persists across sessions** — the character level, items, and world progress are always there when they return. Nothing resets

**Common game design rules for 6-8 year olds** (HIGH confidence — well-established child development + game design literature):

- **Luca (6):** Needs very simple controls (one or two taps), very fast feedback, very clear win states. Cannot handle punishment mechanics. Difficulty must start lower than you'd expect.
- **Yana (8):** Can handle strategy, delayed rewards, multi-step objectives. Enjoys mastery and showing off progress to others.
- **Touch-first:** All interactions must be tappable regions ≥ 60px. Drag mechanics require testing on actual tablets.
- **No text-heavy UI:** Instructions must be demonstrable (show an example, don't explain it)

### Current game problems (from PROJECT.md)

- Fish game: too easy (no scaling)
- Racing game: too basic (no customization/obstacles/power-ups)
- Potion game: needs remake as Monopoly-style board game
- Reading game: needs real Groq-generated stories (500+ words)

---

## Table Stakes — Kid Games

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Difficulty scaling (levels) | Games with no escalation feel like demos — kids move on in days | Medium | Fish game: bigger fish, faster movement, boss fish every 5th wave |
| Visible progress / level number | Kids need to see they're getting somewhere | Low | Level badge on game entry screen, persisted to Firebase per kid profile |
| Immediate feedback on every action (win or lose) | Any 200ms+ delay with no feedback reads as "broken" to a 6-year-old | Low | Sound effect + animation trigger on every tap/collision |
| Progress that survives app reload | Kids rage-quit if their progress vanishes | Low | Save level/score to Firebase per kid profile on each level completion |
| Age-appropriate difficulty floor | Luca (6) must be able to win Round 1 on first try | Medium | Separate difficulty curves for kid profiles based on age |

## Differentiators — Kid Games

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Fish game: Boss fish every 5 levels | Prodigy-style dramatic encounter — creates event the kid talks about | Medium | Special large fish sprite (CSS scale), requires 5 hits, drops big points |
| Fish game: Unlockable fish types | Yana earns a "laser fish" skin after level 10 — she'll show Luca | Medium | Cosmetic only, stored in Firebase profile, no gameplay change needed |
| Racing game: Track selection (3 tracks) | Choice = engagement. Even fake choice matters to an 8-year-old | Medium | 3 CSS-drawn track backgrounds with different obstacle patterns |
| Racing game: Power-ups (speed boost, shield, oil slick) | Standard racing game vocabulary — kids expect this from Mario Kart | High | Requires collision detection expansion and pickup spawn logic |
| Racing game: Garage (car colors/skins) | Character customization is the #1 retention mechanism for this age | Medium | CSS color/sprite swap, earned by race wins, saved to Firebase |
| Reading game: Groq-generated stories with Luca/Yana as characters | A story where *you're* the hero beats any pre-written content | High | Groq prompt: "Write a 500-word adventure story featuring [kid name] and their sibling [sibling name], age-appropriate for [age]" — comprehension questions at the end |
| Reading game: Read-aloud toggle | Luca (6) is still learning to read — audio support is accessibility | Low | Web Speech API already in codebase, just needs wiring to story text |
| Board game (potion remake): Firebase turn sync | Family members can play on different devices in the same room | High | Firebase Realtime DB is already there — game state object with currentTurn, playerPositions, rolled dice. Turn-based so no realtime conflicts |
| Board game: Chore/task squares | "Do 5 jumping jacks" square makes the board game bleed into real life — memorable | Low | Mix of fun squares and real-world action squares in board definition |
| Avatar drawing restored | Kids who drew their own avatar are vastly more attached to their character | Medium | Canvas finger-draw, save as base64 to Firebase profile |

## Anti-Features — Kid Games

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Lives system / game over that requires starting over | Luca (6) will cry and refuse to play. Danyells will blame Alex | Infinite continues with score penalty; "try again" always available |
| Timed pressure mechanics for Luca | 6-year-olds cannot handle countdown timers — creates anxiety | Age-gate: timers only for Yana (8+), Luca's mode is always untimed |
| Cross-device competitive leaderboards | If Yana beats Luca publicly, he quits. Family competition must be cooperative or private | Per-kid personal bests only; "family record" as cooperative milestone |
| Ads or upsell prompts | This is a private family app — any ad-like UI breaks the experience | Never add ad slots even for mock/demo |
| Too many tutorials before play | Kids skip every tutorial. Let them play wrong first, correct gently | 3-frame visual demo max before first game starts |

---

## Domain 3: Co-Parenting Features (Danyells)

### What the best apps do differently

**OurFamilyWizard** (HIGH confidence — market leader, court-accepted co-parenting platform)

OFW's key design insight: co-parenting apps are used by people who have legal disputes. **Every feature assumes distrust as the default**, not cooperation. This means:

1. **Message read receipts** — Danyells can see Alex read her message. Alex can prove he responded
2. **Event ownership** — each calendar event has an owner. Only the owner can delete/edit their events. Shared events require both to accept
3. **Expense logging with receipts** — photo upload + category + amount. Both parties see the same record. No "he said/she said"
4. **Tone meter** — OFW literally analyzes message tone and warns before sending if it's harsh. Reduces conflict escalation
5. **Journal feature** — private notes attached to dates that the other party cannot see

**Cozi** (MEDIUM confidence — family calendar for intact families, less focused on co-parenting conflict)

Cozi's design assumes cooperation. Key features:
1. **Color coding per family member** — every event is tagged to a person. Viewing the calendar you see whose event it is instantly
2. **List sharing** — shopping lists, to-do lists, anyone can check off items
3. **Meal planner** — weekly dinner schedule visible to everyone
4. **Appointment reminders** — push notifications 30min before events

### Current Danyells requirements (from PROJECT.md)

- Gets Daily Spark widget (self-growth questions + jokes + facts)
- Can delete her own events (not Alex's)
- Full customization options (minus admin features)
- Alex's private events hidden from her view

### The real dynamic

Danyells "will judge this app." This means the features she gets must feel premium, not like an afterthought. Her home screen should feel like *her* space, not a viewer into Alex's app.

---

## Table Stakes — Co-Parenting

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Event ownership (edit/delete own events only) | Both parties need confidence that the other can't silently change their plans | Medium | Add `createdBy` field to every event object; delete/edit checks against current profile |
| Private events (hidden from other parent) | Alex's personal plans are none of Danyells' business | Medium | `visibility: "private"` field on event; filter in displayEvents layer when rendering for non-owner non-admin |
| Danyells' own home screen customization | She's not a guest in Alex's app — she needs her own space | Medium | widgetPrefs already in Firebase per profile — extend to cover layout order and home screen widgets |
| Per-profile theme preference | Danyells may prefer different theme than Alex | Low | themeName already Firebase-persisted — make it profile-scoped not global |

## Differentiators — Co-Parenting

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Daily Spark widget (for Danyells specifically) | Makes the app feel like it's for her, not just a viewer into the family | Medium | Rotating daily prompt from 3 categories: self-growth question, fun fact, joke. Groq generates 7 at a time, cached. Shown in a card on home screen |
| Daily Spark categories (choose 3 of 6) | Personalization = long-term engagement. OurFamilyWizard has zero personality — this is the differentiator | Low | Toggle setting per profile; categories: self-growth, funny, trivia, parenting, mindfulness, gratitude |
| "This is your week" header | When Danyells opens the app, show whether it's her custody week. Reduces custody schedule confusion | Low | Cross-reference custodySchedule with today's date, show banner |
| Shared family events vs. custody-parent events visual distinction | At a glance: "is this Alex's thing or ours?" | Low | Event card left-border color/icon based on createdBy — use icon not just color (colorblind safe) |
| Notification of changes to shared events | If Alex changes a shared event's time, Danyells should know | High | Requires write-triggered Firebase function or client-side polling — complex; flag as phase-specific research needed |

## Anti-Features — Co-Parenting

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Tone analysis / conflict flags | OFW uses this for legal documentation — this is a family app, not a courtroom. Adds stress. | Just give both parties their own space and trust |
| Expense splitting / child support tracking | Opens legal territory the app has no business being in | Keep budget tracker as Alex's personal tool only |
| Message read receipts | Creates passive-aggressive dynamics in co-parenting that are still conflicted | No read receipts; events are facts, not surveillance |
| "Waiting for approval" event states | Adds friction where cooperation is assumed | Alex and Danyells can each own their events; no approval workflow needed |

---

## Domain 4: Daily Spark Widget (Long-Term Engagement)

### What makes daily content widgets retain users

Evidence from habit-building and content apps (MEDIUM confidence — synthesis from multiple product categories):

**The core problem with daily widgets:** Day 1 = novel. Day 14 = expected. Day 90 = invisible.

**What breaks this pattern:**

1. **Surprise categorization** — don't always deliver the same type of content. Rotate between funny, deep, weird, and practical. The unpredictability is the hook.
2. **Low-commitment response** — "tap to reveal the answer" or emoji reaction ("that's me!" / "not today") takes 2 seconds. If a widget requires typing, usage drops 80%.
3. **Weekly theme** — "this week's theme is Kindness." Gives context across 7 individual prompts. Creates narrative continuity.
4. **Callback to previous sparks** — "last week you said your dream trip was Japan — here's a Tokyo fact." Requires storing responses but creates genuine delight.
5. **Family sharing** — "what did everyone answer?" — brief, one-tap response sharing makes it social without being high-friction

**What kills daily widgets:**
- Content repetition (detecting same prompt = immediate trust break)
- Prompts that are too heavy for the context (divorce-related self-help prompts in a family app = cringe)
- No escape from the widget (must be dismissable)

---

## Table Stakes — Daily Spark Widget

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Fresh content daily | Showing the same prompt two days in a row = widget gets dismissed | Low | Use day-of-year as Groq cache key, generate batch of 7 prompts weekly |
| Content categories (toggle on/off) | Not every user wants jokes; not every user wants deep self-growth | Low | 3-6 category toggles in profile settings |
| Dismissable / minimizable | If Danyells is rushed, she needs to dismiss without guilt | Low | Small X / collapse button on widget card |
| Emoji reaction (quick response) | No-friction engagement; feels personal without typing | Low | 4 emoji options below prompt, tap to record reaction, no visible count needed |

## Differentiators — Daily Spark Widget

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Your week's theme" banner | 7 daily prompts under a unifying theme (gratitude, adventure, etc.) — creates narrative | Medium | Groq generates theme + 7 prompts in one call weekly, cached to Firebase |
| Family sharing mode ("what did everyone answer?") | One-tap reveal of Danyells' emoji reaction vs Alex's — zero-friction bonding | Medium | Store reactions by profile in Firebase; optional reveal button |
| Spark history (scroll back 30 days) | "I want to find that prompt from last Tuesday" — creates personal archive | Low | Store last 30 daily prompts per profile in Firebase array, scroll view in settings |
| Birthday/holiday-aware prompts | On Yana's birthday: "What's one thing you love about Yana?" — magical moment | Medium | Cross-reference profiles' birthdays + holiday dates when generating prompt |
| Seasonal rotation | Winter prompts feel different from summer prompts — environmental resonance | Low | Include current month in Groq generation prompt |

## Anti-Features — Daily Spark Widget

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Notification for Daily Spark | Danyells didn't ask for push notifications — unwanted pings break trust | Show widget on home screen passively; notifications opt-in only |
| Mandatory response before dismissing | Any friction kills daily engagement | Always skippable |
| Mental health / therapeutic prompts | "How are you processing the divorce?" is wildly inappropriate in this context | Keep prompts light: fun facts, trivia, lighthearted reflection, jokes |
| Streaks for Daily Spark | Streak anxiety (missing = broken streak) turns self-care into obligation | No streak counter on this widget; it's pressure-free |

---

## Feature Dependencies

```
Event ownership → Private events (both require createdBy field on event object)
Event ownership → Shared event notifications (notifications reference the ownership model)
Kid profile age → Game difficulty curve (fish, racing both use age to set starting level)
Kid profile age → Homework Helper explanation depth (same system prompt logic)
LucacLegends.jsx split → Game upgrades (can't do parallel game work until split is done)
Avatar system → Board game player tokens (board game uses avatar as piece)
Groq session history fix → Homework Helper past sessions (same underlying bug)
Firebase per-profile theme → Danyells' customization (needs profile-scoped themeName)
Daily Spark cache key (day-of-year) → Birthday-aware prompts (birthday check happens at generation time)
```

---

## MVP Recommendation

The milestone has four parallel streams. Each stream is nearly independent once the foundational split is done.

**Foundation (must happen first — everything else depends on this):**
1. Split LucacLegends.jsx into FishGame.jsx, RacingGame.jsx, BoardGame.jsx, ReadingGame.jsx
2. Add `createdBy` field to event schema (unblocks all Danyells permissions work)

**Stream A: Homework Helper fixes (low risk, high user impact)**
1. Remove `max_tokens` cap / "be concise" system prompt constraint — gives long responses
2. Add attempt counter per question, escalate from hint to direct answer after 2 misses
3. Add "Try explaining it differently" button — triggers alternate modality
4. Fix Firebase session history reads

**Stream B: Games (highest Yana/Luca engagement impact)**
1. Fish game: add levels + boss fish (difficulty scaling)
2. Racing game: add 3 tracks + power-ups + garage
3. Reading game: Groq-generated story with kid's name as character
4. Board game: Firebase-synced Monopoly-style with chore squares

**Stream C: Danyells (highest approval impact)**
1. Event ownership (delete own events only)
2. Private events (hidden from other parent)
3. Daily Spark widget with category toggles
4. Per-profile theme preference

**Stream D: Calendar (low dependency, medium impact)**
1. Week/2-week view toggle
2. Scroll to future months without date picker

**Defer:**
- Family Spark sharing (Store + reveal reactions) — nice to have, not needed for launch feel
- Notification of shared event changes — requires Firebase Functions, complex, out of scope
- Cross-device board game multiplayer — deferred in PROJECT.md, keep deferred

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Homework tutoring pedagogy (Khanmigo / Socratic approach) | HIGH | Well-documented; Khanmigo's "guide not tell" approach is extensively published by Khan Academy |
| Photomath step-by-step control model | HIGH | Product has been in market since 2014, design is stable and well-analyzed |
| ABCmouse engagement mechanics (progress map, 30-second cycles) | HIGH | Market-leading app, design patterns published in educational tech literature |
| Prodigy Math mechanics (variable reward, cosmetics as motivation) | HIGH | 100M+ users, extensively studied in gamification literature |
| OurFamilyWizard event ownership model | HIGH | Court-accepted platform, features are publicly documented |
| Cozi feature set | MEDIUM | Training data accurate as of 2024 but features may have changed |
| Daily Spark retention patterns | MEDIUM | Synthesized from habit app research (Headspace, Duolingo, Finch) — not from a single authoritative source |
| "Frustration detection" in AI tutors | MEDIUM | Khanmigo has described this capability in blog posts; implementation details not public |

---

## Sources

Note: Web fetch was blocked in this research session. The following sources were used from training data (knowledge cutoff August 2025). Confidence is reduced where these sources may have changed.

- Khan Academy / Khanmigo pedagogy: https://www.khanacademy.org/about/khanmigo (training data; confirmed in multiple educational tech publications 2023-2024)
- Photomath step model: https://photomath.com/en/ (training data; product design stable since 2022)
- ABCmouse engagement design: Published studies on Age of Learning Inc. platform engagement, 2020-2024
- Prodigy Math gamification: https://www.prodigygame.com/ (training data; design patterns published in ed-tech analysis)
- OurFamilyWizard features: https://www.ourfamilywizard.com/features (training data; legal co-parenting platform, features well-documented)
- Daily widget retention: Synthesized from Duolingo streak research, Headspace habit formation studies, Finch self-care app design analysis
