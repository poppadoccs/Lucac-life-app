// ═══ SHARED CONSTANTS & HELPERS ═══
// Used across multiple component files

export const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

export function todayStr() {
  return new Date().toISOString().slice(0,10);
}

export function parseTime(timeStr) {
  if (!timeStr) return { h: 12, m: 0, ampm: "PM" };
  const parts = timeStr.split(" ");
  const ampm = parts[1] || "AM";
  const [hStr, mStr] = (parts[0] || "12:00").split(":");
  return { h: parseInt(hStr) || 12, m: parseInt(mStr) || 0, ampm };
}
