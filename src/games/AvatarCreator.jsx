import { useState } from "react";

// ─── EMOTION MAP ─────────────────────────────────────────
const EMOTION_MAP = {
  happy: "😊", scared: "😨", determined: "😤", victorious: "🎉", hurt: "😣", idle: null,
};

// ─── AVATAR COMPONENT ────────────────────────────────────
// Displays a profile emoji with an optional emotion overlay and animation.
// Used by RPGCore for player character display in adventure/battle screens.
export default function AvatarCreator({ emoji, emotion, anim, size = 60, style: extraStyle }) {
  const face = EMOTION_MAP[emotion] || null;
  let animName = "none";
  if (anim === "bounce") animName = "ll-bounce 0.6s ease-in-out infinite";
  if (anim === "shake") animName = "ll-shake 0.5s ease-in-out";
  if (anim === "jump") animName = "ll-jump 0.8s ease-in-out";
  if (anim === "pulse") animName = "ll-pulse 1s ease-in-out infinite";

  return (
    <div style={{ position: "relative", display: "inline-block", animation: animName, ...extraStyle }}>
      <div style={{ fontSize: size, lineHeight: 1 }}>{emoji}</div>
      {face && (
        <div style={{ position: "absolute", bottom: -4, right: -4, fontSize: size * 0.4,
          background: "rgba(0,0,0,0.5)", borderRadius: "50%", width: size * 0.45, height: size * 0.45,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          {face}
        </div>
      )}
    </div>
  );
}
