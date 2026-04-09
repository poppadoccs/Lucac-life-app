import { useRef, useState, useEffect } from "react";

// Logical canvas size in CSS pixels — scaled by DPR for retina sharpness
const LOGICAL_SIZE = 300;
const MAX_UNDO = 20;

// All colors are labeled — Alex is deutan colorblind, never use color alone
const COLORS = [
  { name: "Black",  hex: "#111827" },
  { name: "Red",    hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Yellow", hex: "#fbbf24" },
  { name: "Green",  hex: "#22c55e" },
  { name: "Blue",   hex: "#3b82f6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink",   hex: "#ec4899" },
  { name: "Brown",  hex: "#78350f" },
  { name: "White",  hex: "#f9fafb" },
];

// Props: { profile, fbSet, onSave, onClose }
// onSave(dataUrl) fires after writing to Firebase
export default function AvatarCreator({ profile, fbSet, onSave, onClose }) {
  const canvasRef = useRef(null);
  const [color, setColor] = useState("#111827");
  const [brushSize, setBrushSize] = useState(8);
  const [isEraser, setIsEraser] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);

  // Initialize canvas: DPR scaling, white fill, load existing avatar
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = LOGICAL_SIZE * dpr;
    canvas.height = LOGICAL_SIZE * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    if (profile?.avatarDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
      img.src = profile.avatarDataUrl;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function getCtx() { return canvasRef.current?.getContext("2d"); }

  // Map pointer clientX/Y to logical canvas coordinates
  function getCanvasPoint(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (LOGICAL_SIZE / rect.width),
      y: (e.clientY - rect.top) * (LOGICAL_SIZE / rect.height),
    };
  }

  function saveSnapshot() {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!ctx || !canvas) return;
    // Store raw ImageData (pixel coords, not logical) — putImageData expects same
    setUndoStack(s => [...s.slice(-(MAX_UNDO - 1)), ctx.getImageData(0, 0, canvas.width, canvas.height)]);
  }

  function startDraw(e) {
    e.preventDefault();
    // setPointerCapture ensures move events continue even when finger leaves canvas
    e.currentTarget.setPointerCapture(e.pointerId);
    saveSnapshot();
    isDrawing.current = true;
    const ctx = getCtx();
    const pt = getCanvasPoint(e);
    lastPoint.current = pt;
    // Paint a dot at the tap point so single taps leave a mark
    const sz = isEraser ? brushSize * 2 : brushSize;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, sz / 2, 0, Math.PI * 2);
    ctx.fillStyle = isEraser ? "#fff" : color;
    ctx.fill();
  }

  function draw(e) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx = getCtx();
    const pt = getCanvasPoint(e);
    const sz = isEraser ? brushSize * 2 : brushSize;
    ctx.lineWidth = sz;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = isEraser ? "#fff" : color;
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPoint.current = pt;
  }

  function endDraw() {
    isDrawing.current = false;
    lastPoint.current = null;
  }

  function handleUndo() {
    setUndoStack(s => {
      if (!s.length) return s;
      getCtx().putImageData(s[s.length - 1], 0, 0);
      return s.slice(0, -1);
    });
  }

  function handleClear() {
    const ctx = getCtx();
    saveSnapshot();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    // 0.5 JPEG quality keeps save under ~200KB for a 300px canvas
    const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
    if (fbSet && profile?.name) fbSet(`profiles/${profile.name}/avatarDataUrl`, dataUrl);
    onSave?.(dataUrl);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div style={{
        background: "#1a1a2e", borderRadius: 20, padding: 16,
        width: "min(95vw, 460px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24" }}>
            ✏️ Draw Your Avatar
          </div>
          <button
            onClick={onClose}
            aria-label="Close avatar creator"
            style={{
              background: "#374151", color: "#fff", border: "none",
              borderRadius: 8, fontSize: 18, cursor: "pointer",
              minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
          style={{
            width: "100%", aspectRatio: "1 / 1",
            borderRadius: 12, border: "3px solid #3b82f6",
            display: "block", touchAction: "none",
            cursor: isEraser ? "cell" : "crosshair",
          }}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          onPointerCancel={endDraw}
        />

        {/* Color palette — labeled for colorblind users */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 20, marginTop: 14 }}>
          {COLORS.map(c => (
            <div key={c.hex} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 40 }}>
              <button
                aria-label={c.name}
                title={c.name}
                onClick={() => { setColor(c.hex); setIsEraser(false); }}
                style={{
                  width: 36, height: 36, borderRadius: 8, background: c.hex,
                  border: `3px solid ${!isEraser && color === c.hex ? "#fbbf24" : "#374151"}`,
                  cursor: "pointer", minHeight: 36, minWidth: 36,
                }}
              />
              <span style={{ fontSize: 9, color: "#9ca3af" }}>{c.name}</span>
            </div>
          ))}
        </div>

        {/* Brush size + eraser toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ color: "#9ca3af", fontSize: 13, minWidth: 70 }}>Size: {brushSize}px</span>
          <input
            type="range" min={2} max={30} value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <button
            onClick={() => setIsEraser(v => !v)}
            style={{
              background: isEraser ? "#fbbf24" : "#374151",
              color: isEraser ? "#000" : "#fff",
              border: "none", borderRadius: 8, padding: "8px 14px",
              cursor: "pointer", fontSize: 13, fontWeight: 700,
              minHeight: 44, minWidth: 80,
            }}
          >{isEraser ? "✏️ Draw" : "🧹 Erase"}</button>
        </div>

        {/* Undo / Clear / Save */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleUndo}
            disabled={!undoStack.length}
            style={{
              flex: 1, border: "none", borderRadius: 10, padding: 12,
              fontSize: 14, fontWeight: 700, minHeight: 48,
              background: undoStack.length ? "#374151" : "#1f2937",
              color: undoStack.length ? "#fff" : "#6b7280",
              cursor: undoStack.length ? "pointer" : "not-allowed",
            }}
          >↩ Undo</button>
          <button
            onClick={handleClear}
            style={{
              flex: 1, background: "#7f1d1d", color: "#fff",
              border: "none", borderRadius: 10, padding: 12,
              cursor: "pointer", fontSize: 14, fontWeight: 700, minHeight: 48,
            }}
          >🗑 Clear</button>
          <button
            onClick={handleSave}
            style={{
              flex: 2, background: "#22c55e", color: "#fff",
              border: "none", borderRadius: 10, padding: 12,
              cursor: "pointer", fontSize: 16, fontWeight: 800, minHeight: 48,
            }}
          >💾 Save</button>
        </div>
      </div>
    </div>
  );
}
