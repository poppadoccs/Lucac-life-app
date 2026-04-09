import { useState, useEffect, useRef } from "react";
import { getApp } from "firebase/app";
import {
  getDatabase, ref, onValue, runTransaction, onDisconnect, set as dbSet,
} from "firebase/database";
import { generateMathProblem, GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";
import { BOARD_TILES, TILE_POSITIONS } from "./board/boardData";

// ── constants ─────────────────────────────────────────────────────────────────
const TILE_SZ = 44;          // px — meets 44px touch target
const WIN_POTIONS = 5;
const WIN_STARS = 100;
const DICE_FACE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const BG = "linear-gradient(160deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)";

function getDb() { return getDatabase(getApp()); }

function genCode() {
  const C = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => C[Math.floor(Math.random() * C.length)]).join("");
}

function initPlayer(p) {
  return {
    name: p?.name || "Player",
    emoji: p?.emoji || "🧙",
    position: 0, stars: 0, potions: 0, inJail: false,
  };
}

function nextTurn(cur, count) { return (cur + 1) % count; }

function addEvent(events, msg) {
  return [...(events || []).slice(-4), msg];
}

// ── component ─────────────────────────────────────────────────────────────────
export default function BoardGame({ profile, kidsData, fbSet, addStars, transitionTo, curriculum }) {
  const ageBand = ageBandFromProfile(profile);
  const mathDiff = ageBand === "luca" ? "easy" : "medium";

  const [screen, setScreen]       = useState("lobby");   // lobby | waiting | playing | gameover
  const [code, setCode]           = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [errMsg, setErrMsg]       = useState("");
  const [gameState, setGameState] = useState(null);
  const [myIdx, setMyIdx]         = useState(null);
  const [diceAnim, setDiceAnim]   = useState(false);
  const [mathUI, setMathUI]       = useState(null);

  const unsubRef  = useRef(null);
  const presRef   = useRef(null);
  const diceTimer = useRef(null);

  // ── Firebase subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    const gameRef = ref(getDb(), `boardGames/${code}`);
    unsubRef.current = onValue(gameRef, snap => {
      const val = snap.val();
      if (val) setGameState(val);
    });
    return () => unsubRef.current?.();
  }, [code]);

  // Auto-transition on phase changes
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase === "playing" && screen === "waiting") setScreen("playing");
    if (gameState.phase === "gameover" && screen === "playing") {
      setScreen("gameover");
      const me = gameState.players?.[myIdx];
      if (me && gameState.winner === me.name) {
        const stars = me.stars >= WIN_STARS ? 3 : me.potions >= WIN_POTIONS ? 3 : 1;
        recordGameHistory(fbSet, profile, "board", me.stars, stars, {
          potions: me.potions, roomCode: code,
        });
      }
    }
  }, [gameState?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show math challenge UI when pendingEffect targets me
  useEffect(() => {
    if (!gameState?.pendingEffect || gameState.pendingEffect.playerIdx !== myIdx || mathUI) return;
    const { type } = gameState.pendingEffect;
    if (type === "potion") {
      setMathUI({
        type: "potion",
        p1: generateMathProblem(mathDiff),
        p2: generateMathProblem(mathDiff),
        chosen: null, result: null,
      });
    } else if (type === "math") {
      setMathUI({ type: "math", problem: generateMathProblem(mathDiff), chosen: null, correct: null });
    }
  }, [gameState?.pendingEffect?.playerIdx, gameState?.pendingEffect?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubRef.current?.();
      presRef.current?.cancel();
      clearTimeout(diceTimer.current);
    };
  }, []);

  // ── helpers ───────────────────────────────────────────────────────────────
  function setupPresence(roomCode, playerIdx) {
    const offRef = ref(getDb(), `boardGames/${roomCode}/players/${playerIdx}/offline`);
    const disc = onDisconnect(offRef);
    disc.set(true);
    presRef.current = disc;
  }

  async function createGame() {
    setErrMsg("");
    const newCode = genCode();
    await dbSet(ref(getDb(), `boardGames/${newCode}`), {
      phase: "waiting",
      currentTurn: 0,
      dice: null,
      pendingEffect: null,
      players: [initPlayer(profile)],
      events: [],
      winner: null,
    });
    setCode(newCode);
    setMyIdx(0);
    setupPresence(newCode, 0);
    setScreen("waiting");
  }

  async function joinGame() {
    const c = joinInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (c.length !== 4) { setErrMsg("Enter a 4-character code"); return; }
    setErrMsg("");

    const result = await runTransaction(ref(getDb(), `boardGames/${c}`), cur => {
      if (!cur || cur.phase === "gameover") return undefined; // abort
      if (!cur.players) cur.players = [];
      cur.players.push(initPlayer(profile));
      if (cur.players.length >= 2) cur.phase = "playing";
      return cur;
    });

    if (!result.committed) { setErrMsg("Game not found or already ended"); return; }

    const finalState = result.snapshot.val();
    const joinedIdx = finalState.players.findIndex(p => p.name === profile?.name);
    const idx = joinedIdx >= 0 ? joinedIdx : finalState.players.length - 1;

    setCode(c);
    setMyIdx(idx);
    setupPresence(c, idx);
    setScreen("waiting");
  }

  async function handleRoll() {
    if (!gameState || gameState.currentTurn !== myIdx || diceAnim || gameState.pendingEffect) return;
    setDiceAnim(true);
    diceTimer.current = setTimeout(() => setDiceAnim(false), 800);

    await runTransaction(ref(getDb(), `boardGames/${code}`), cur => {
      if (!cur || cur.currentTurn !== myIdx || cur.pendingEffect) return undefined;
      const me = cur.players[myIdx];
      const pCount = cur.players.length;

      // Jail: skip this turn
      if (me.inJail) {
        me.inJail = false;
        cur.dice = null;
        cur.events = addEvent(cur.events, `🔓 ${me.name} was freed from jail!`);
        cur.currentTurn = nextTurn(myIdx, pCount);
        return cur;
      }

      const roll = Math.floor(Math.random() * 6) + 1;
      cur.dice = roll;
      const newPos = (me.position + roll) % BOARD_TILES.length;
      me.position = newPos;
      const tile = BOARD_TILES[newPos];
      cur.events = addEvent(cur.events, `🎲 ${me.name} rolled ${roll} → ${tile.emoji} ${tile.label}`);

      switch (tile.type) {
        case "start":
        case "free":
          cur.currentTurn = nextTurn(myIdx, pCount);
          break;

        case "bonus":
          me.stars += 5;
          cur.events = addEvent(cur.events, `⭐ ${me.name} earned +5 stars! (${me.stars} total)`);
          cur.currentTurn = nextTurn(myIdx, pCount);
          break;

        case "jail":
          me.inJail = true;
          cur.events = addEvent(cur.events, `🔒 ${me.name} is in jail — skip next turn`);
          cur.currentTurn = nextTurn(myIdx, pCount);
          break;

        case "trap":
          if (me.potions > 0) {
            me.potions -= 1;
            cur.events = addEvent(cur.events, `🕳️ ${me.name} fell in a trap! Lost a potion`);
          } else {
            me.position = Math.max(0, me.position - 3);
            cur.events = addEvent(cur.events, `🕳️ ${me.name} fell in a trap! Back 3 spaces`);
          }
          cur.currentTurn = nextTurn(myIdx, pCount);
          break;

        case "potion":
        case "math":
          // pendingEffect halts turn advancement until the player resolves it
          cur.pendingEffect = { type: tile.type, playerIdx: myIdx };
          break;

        default:
          cur.currentTurn = nextTurn(myIdx, pCount);
      }

      // Win check
      if (me.potions >= WIN_POTIONS || me.stars >= WIN_STARS) {
        cur.phase = "gameover";
        cur.winner = me.name;
      }
      return cur;
    });
  }

  async function resolvePotion(choiceIdx) {
    if (!mathUI || mathUI.chosen !== null) return;
    const { p1, p2 } = mathUI;
    const picked = choiceIdx === 0 ? p1 : p2;
    const other  = choiceIdx === 0 ? p2 : p1;
    const correct = picked.answer >= other.answer;
    setMathUI(m => ({ ...m, chosen: choiceIdx, result: correct ? "correct" : "wrong" }));

    setTimeout(async () => {
      await runTransaction(ref(getDb(), `boardGames/${code}`), cur => {
        if (!cur) return undefined;
        const me = cur.players[myIdx];
        if (correct) {
          me.potions += 1;
          cur.events = addEvent(cur.events, `🧪 ${me.name} brewed a POWERFUL potion! (${me.potions}/${WIN_POTIONS})`);
        } else {
          cur.events = addEvent(cur.events, `🧪 ${me.name}'s potion fizzled...`);
        }
        cur.pendingEffect = null;
        cur.currentTurn = nextTurn(myIdx, cur.players.length);
        if (me.potions >= WIN_POTIONS || me.stars >= WIN_STARS) {
          cur.phase = "gameover";
          cur.winner = me.name;
        }
        return cur;
      });
      setMathUI(null);
    }, 1400);
  }

  async function resolveMath(answer) {
    if (!mathUI || mathUI.chosen !== null) return;
    const correct = answer === mathUI.problem.answer;
    setMathUI(m => ({ ...m, chosen: answer, correct }));

    setTimeout(async () => {
      await runTransaction(ref(getDb(), `boardGames/${code}`), cur => {
        if (!cur) return undefined;
        const me = cur.players[myIdx];
        if (correct) {
          me.potions += 1;
          cur.events = addEvent(cur.events, `🔢 ${me.name} solved it! +1 potion (${me.potions}/${WIN_POTIONS})`);
        } else {
          cur.events = addEvent(cur.events, `🔢 ${me.name} missed the challenge`);
        }
        cur.pendingEffect = null;
        cur.currentTurn = nextTurn(myIdx, cur.players.length);
        if (me.potions >= WIN_POTIONS || me.stars >= WIN_STARS) {
          cur.phase = "gameover";
          cur.winner = me.name;
        }
        return cur;
      });
      setMathUI(null);
    }, 1400);
  }

  // ── wrapper ───────────────────────────────────────────────────────────────
  function Wrap({ children }) {
    return (
      <div style={{
        background: BG, minHeight: 500, padding: "12px 8px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box", maxWidth: "100vw", overflowX: "hidden",
      }}>
        {children}
      </div>
    );
  }

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  if (screen === "lobby") return (
    <Wrap>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 320, margin: "0 auto", paddingTop: 20 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52 }}>🎲</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24" }}>Family Board Game</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
            Collect {WIN_POTIONS} potions or {WIN_STARS} stars to win!
          </div>
        </div>

        <GameBtn color="#6d28d9" onClick={createGame} big>🏠 Create Game</GameBtn>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={joinInput}
            onChange={e => { setJoinInput(e.target.value.toUpperCase()); setErrMsg(""); }}
            placeholder="Code"
            maxLength={4}
            style={{
              flex: 1, fontSize: 22, padding: "10px 8px", borderRadius: 10,
              border: "2px solid #6d28d9", background: "#1e1b4b", color: "#fff",
              textAlign: "center", letterSpacing: 6, fontWeight: 800, outline: "none",
            }}
          />
          <GameBtn color="#2563eb" onClick={joinGame} style={{ width: "auto", flex: 0, padding: "10px 18px" }}>
            Join
          </GameBtn>
        </div>

        {errMsg && <div style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>{errMsg}</div>}
        <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back</GameBtn>
      </div>
    </Wrap>
  );

  // ── WAITING ───────────────────────────────────────────────────────────────
  if (screen === "waiting") return (
    <Wrap>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 320, margin: "0 auto", paddingTop: 28, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>Waiting for players…</div>

        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 14, padding: "14px 20px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Room code</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#fbbf24", letterSpacing: 10 }}>{code}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Share this with friends!</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(gameState?.players || []).map((p, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 14px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 22 }}>{p.emoji}</span>
              <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 15 }}>{p.name}</span>
              {i === 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>Host</span>}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          Game starts automatically when 2+ players join
        </div>

        <GameBtn color="#475569" onClick={() => { setScreen("lobby"); setCode(""); setGameState(null); }}>
          ← Leave
        </GameBtn>
      </div>
    </Wrap>
  );

  // ── GAMEOVER ──────────────────────────────────────────────────────────────
  if (screen === "gameover") {
    const winner = gameState?.winner;
    const isWinner = winner === profile?.name;
    return (
      <Wrap>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 320, margin: "0 auto", paddingTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: 56 }}>{isWinner ? "🏆" : "🎉"}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#fbbf24" }}>
            {isWinner ? "YOU WIN!" : `${winner} wins!`}
          </div>

          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px" }}>
            {(gameState?.players || []).map((p, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0",
                borderBottom: i < gameState.players.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}>
                <span style={{ fontSize: 15 }}>{p.emoji} <strong style={{ color: "#e2e8f0" }}>{p.name}</strong></span>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>🧪{p.potions} &nbsp;⭐{p.stars}</span>
              </div>
            ))}
          </div>

          <GameBtn
            color="#6d28d9"
            big
            onClick={() => {
              setScreen("lobby");
              setCode("");
              setGameState(null);
              setMathUI(null);
              setMyIdx(null);
              setJoinInput("");
            }}
          >
            🎲 Play Again
          </GameBtn>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back to Hub</GameBtn>
        </div>
      </Wrap>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  if (!gameState || screen !== "playing") return (
    <Wrap>
      <div style={{ color: "#fff", textAlign: "center", paddingTop: 60, fontSize: 16 }}>Connecting…</div>
    </Wrap>
  );

  const { players = [], currentTurn = 0, dice, pendingEffect, events = [] } = gameState;
  const myPlayer  = players[myIdx] ?? {};
  const isMyTurn  = currentTurn === myIdx;
  const canRoll   = isMyTurn && !diceAnim && !pendingEffect;
  const boardW    = TILE_SZ * 8;

  // ── board tiles render ──
  const playersByTile = {};
  players.forEach((p, pi) => {
    if (!playersByTile[p.position]) playersByTile[p.position] = [];
    playersByTile[p.position].push({ ...p, idx: pi });
  });

  const tileEls = BOARD_TILES.map((tile, ti) => {
    const { r, c }    = TILE_POSITIONS[ti];
    const here        = playersByTile[ti] || [];
    const iAmHere     = here.some(p => p.idx === myIdx);

    return (
      <div
        key={ti}
        style={{
          gridRow: r, gridColumn: c,
          width: TILE_SZ, height: TILE_SZ,
          background: `${tile.color}1a`,
          border: `2px solid ${iAmHere ? "#fbbf24" : tile.color + "55"}`,
          borderRadius: 6, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          position: "relative", boxSizing: "border-box", overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 15, lineHeight: 1 }}>{tile.emoji}</div>
        <div style={{ fontSize: 6.5, color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 1.1, maxWidth: "100%", padding: "0 1px" }}>
          {tile.label}
        </div>

        {/* Player pieces */}
        {here.length > 0 && (
          <div style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 1, padding: 1, flexWrap: "wrap", maxWidth: "100%" }}>
            {here.map(p => (
              <div key={p.idx} style={{ fontSize: 9, background: "rgba(0,0,0,0.65)", borderRadius: 3, padding: "0 1px", lineHeight: 1.3 }}>
                {p.emoji}
              </div>
            ))}
          </div>
        )}

        {/* Tile index (small, for reference) */}
        <div style={{ position: "absolute", bottom: 0, left: 1, fontSize: 5.5, color: "rgba(255,255,255,0.25)", lineHeight: 1 }}>
          {ti}
        </div>
      </div>
    );
  });

  // ── center info panel ──
  const centerPanel = (
    <div
      key="center"
      style={{
        gridRow: "2 / 6", gridColumn: "2 / 8",
        background: "rgba(0,0,0,0.45)", borderRadius: 6,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 6, padding: "6px 4px",
      }}
    >
      <div style={{ fontSize: 28, animation: diceAnim ? "ll-shake 0.6s" : "none", lineHeight: 1 }}>
        {dice ? DICE_FACE[dice] : "🎲"}
      </div>
      <div style={{ fontSize: 10, color: "#e2e8f0", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>
        {isMyTurn
          ? (pendingEffect ? "Solve it!" : "⭐ YOUR TURN")
          : `${players[currentTurn]?.name}'s turn`}
      </div>
      <div style={{ width: "100%", fontSize: 8, color: "rgba(255,255,255,0.65)", lineHeight: 1.45, textAlign: "left", padding: "0 4px" }}>
        {events.slice(-3).map((e, i) => <div key={i}>{e}</div>)}
      </div>
    </div>
  );

  return (
    <Wrap>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <GameBtn
            color="#475569"
            onClick={() => transitionTo("mini_games")}
            style={{ width: "auto", padding: "6px 10px", minHeight: 40, fontSize: 13 }}
          >
            ← Hub
          </GameBtn>
          <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 12 }}>Room: {code}</div>
          <div style={{ color: "#e2e8f0", fontSize: 12 }}>🧪{myPlayer.potions} ⭐{myPlayer.stars}</div>
        </div>

        {/* Board */}
        <div style={{ overflowX: "auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(8, ${TILE_SZ}px)`,
            gridTemplateRows:    `repeat(6, ${TILE_SZ}px)`,
            width: boardW,
          }}>
            {tileEls}
            {centerPanel}
          </div>
        </div>

        {/* Controls */}
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {pendingEffect && pendingEffect.playerIdx !== myIdx && (
            <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "6px 0" }}>
              ⏳ {players[pendingEffect.playerIdx]?.name} is solving a challenge…
            </div>
          )}
          {!pendingEffect && (
            <GameBtn color={canRoll ? "#6d28d9" : "#475569"} disabled={!canRoll} onClick={handleRoll} big>
              {isMyTurn
                ? (diceAnim ? "🎲 Rolling…" : myPlayer.inJail ? "🔓 Skip Jail Turn" : "🎲 Roll Dice")
                : `${players[currentTurn]?.name || "?"}'s turn`}
            </GameBtn>
          )}

          {/* Player roster */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {players.map((p, i) => (
              <div key={i} style={{
                background: i === currentTurn ? "rgba(109,40,217,0.3)" : "rgba(255,255,255,0.07)",
                border: `1.5px solid ${i === currentTurn ? "#a855f7" : "transparent"}`,
                borderRadius: 10, padding: "6px 10px", minWidth: 70, textAlign: "center", flexShrink: 0,
              }}>
                <div style={{ fontSize: 20 }}>{p.emoji}</div>
                <div style={{ fontSize: 10, color: "#e2e8f0", fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 9, color: "#94a3b8" }}>🧪{p.potions} ⭐{p.stars}</div>
                {p.inJail && <div style={{ fontSize: 8, color: "#f87171" }}>🔒 jailed</div>}
                {i === myIdx && <div style={{ fontSize: 7, color: "#60a5fa" }}>▶ you</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Math UI overlay — only visible to the current player */}
        {mathUI && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: 16,
          }}>
            {mathUI.type === "potion" ? (
              <div style={{ background: "#1e1b4b", borderRadius: 20, padding: 22, maxWidth: 340, width: "100%", textAlign: "center" }}>
                <div style={{ fontSize: 36 }}>🧪</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#c084fc", marginBottom: 2 }}>Pick the STRONGER potion!</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 14 }}>Higher answer = stronger</div>

                {mathUI.result && (
                  <div style={{ fontSize: 15, color: mathUI.result === "correct" ? "#22c55e" : "#f87171", fontWeight: 700, marginBottom: 10 }}>
                    {mathUI.result === "correct" ? "✓ Powerful brew! +1 potion" : "✗ Potion fizzled…"}
                  </div>
                )}

                <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
                  {[mathUI.p1, mathUI.p2].map((p, i) => {
                    const iChosen = mathUI.chosen === i;
                    const borderColor = iChosen
                      ? (mathUI.result === "correct" ? "#22c55e" : "#ef4444")
                      : "#a855f7";
                    return (
                      <div
                        key={i}
                        onClick={() => resolvePotion(i)}
                        style={{
                          background: iChosen
                            ? (mathUI.result === "correct" ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.14)")
                            : "rgba(168,85,247,0.12)",
                          border: `3px solid ${borderColor}`,
                          borderRadius: 16, padding: "18px 10px", flex: 1, maxWidth: 140,
                          cursor: mathUI.chosen !== null ? "default" : "pointer",
                          minHeight: 120,
                        }}
                      >
                        <div style={{ fontSize: 34 }}>🧪</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 6 }}>{p.question}</div>
                        {mathUI.chosen !== null && (
                          <div style={{ fontSize: 15, color: "#fbbf24", marginTop: 4, fontWeight: 700 }}>= {p.answer}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ background: "#1e1b4b", borderRadius: 20, padding: 22, maxWidth: 310, width: "100%", textAlign: "center" }}>
                <div style={{ fontSize: 36 }}>🔢</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#60a5fa", marginBottom: 2 }}>Math Challenge!</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 12 }}>Correct answer = +1 potion</div>

                {mathUI.correct !== null && (
                  <div style={{ fontSize: 15, color: mathUI.correct ? "#22c55e" : "#f87171", fontWeight: 700, marginBottom: 10 }}>
                    {mathUI.correct ? "✓ Correct! +1 potion" : `✗ The answer was ${mathUI.problem.answer}`}
                  </div>
                )}

                <div style={{
                  fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 16,
                  background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 0",
                }}>
                  {mathUI.problem.question} = ?
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {mathUI.problem.choices.map((ch, i) => {
                    let btnColor = "#3b82f6";
                    if (mathUI.chosen !== null) {
                      btnColor = ch === mathUI.problem.answer ? "#22c55e"
                               : mathUI.chosen === ch        ? "#ef4444"
                               : "#475569";
                    }
                    return (
                      <GameBtn
                        key={i}
                        color={btnColor}
                        disabled={mathUI.chosen !== null}
                        onClick={() => resolveMath(ch)}
                      >
                        {ch}
                      </GameBtn>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Wrap>
  );
}
