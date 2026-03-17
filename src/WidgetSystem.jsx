// ═══ WIDGET SYSTEM — size, order, pin, visibility ═══
// Extracted from App.jsx — shared widget infrastructure

export const WIDGET_SIZES = {
  compact: { minHeight: 48, maxHeight: 80, overflow: 'hidden', padding: '8px 12px' },
  default: { minHeight: 'auto', maxHeight: 'none', overflow: 'visible', padding: '14px' },
  tall: { minHeight: 400, maxHeight: 'none', overflow: 'auto', padding: '14px' },
  wide: { minHeight: 80, maxHeight: 160, width: '100%', overflow: 'hidden', padding: '10px 14px' },
};

export const DEFAULT_WIDGET_ORDER = { calendar:0, spotlight:1, quickStats:2, routines:3, goals:4, shoppingList:5, birthdays:6 };

export function getWidgetPref(widgetPrefs, currentProfile, key) {
  const profilePrefs = (widgetPrefs || {})[currentProfile?.name] || {};
  return { name: null, hidden: false, size: 'default', order: DEFAULT_WIDGET_ORDER[key] ?? 99, pinned: false, ...(profilePrefs[key] || {}) };
}

export function setWidgetPref(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, key, pref) {
  const profilePrefs = { ...((widgetPrefs || {})[currentProfile?.name] || {}), [key]: pref };
  const updated = { ...(widgetPrefs || {}), [currentProfile?.name]: profilePrefs };
  fbSet("widgetPrefs", updated);
  setWidgetPrefs(updated);
}

export function moveWidget(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, key, direction) {
  const pref = getWidgetPref(widgetPrefs, currentProfile, key);
  const newOrder = pref.order + (direction === 'up' ? -1.5 : 1.5);
  setWidgetPref(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, key, { ...pref, order: newOrder });
}

export function cycleWidgetSize(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, key) {
  const pref = getWidgetPref(widgetPrefs, currentProfile, key);
  const sizes = ['compact', 'default', 'tall', 'wide'];
  const next = sizes[(sizes.indexOf(pref.size || 'default') + 1) % sizes.length];
  setWidgetPref(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, key, { ...pref, size: next });
}

export function toggleWidgetPin(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, key) {
  const pref = getWidgetPref(widgetPrefs, currentProfile, key);
  setWidgetPref(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, key, { ...pref, pinned: !pref.pinned });
}

export function hideWidget(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, key) {
  const pref = getWidgetPref(widgetPrefs, currentProfile, key);
  setWidgetPref(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, key, { ...pref, hidden: true });
}

// Widget toolbar rendered at top-right of each widget
export function WidgetToolbar({ widgetKey, V, widgetPrefs, currentProfile, fbSet, setWidgetPrefs }) {
  const pref = getWidgetPref(widgetPrefs, currentProfile, widgetKey);
  const sizeLabels = { compact: 'Small', default: 'Default', tall: 'Tall', wide: 'Wide' };
  return (
    <div style={{ display:'flex', gap:4, alignItems:'center', fontSize:11 }}>
      <button onClick={() => cycleWidgetSize(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, widgetKey)} title="Resize"
        style={{ background:V.bgElevated, border:`1px solid ${V.borderSubtle}`, borderRadius:4, padding:'2px 6px', cursor:'pointer', color:V.textDim, fontSize:10 }}>
        📏 {sizeLabels[pref.size] || 'Default'}
      </button>
      <button onClick={() => toggleWidgetPin(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, widgetKey)} title={pref.pinned ? "Unpin" : "Pin"}
        style={{ background: pref.pinned ? `${V.accent}22` : V.bgElevated, border:`1px solid ${pref.pinned ? V.accent : V.borderSubtle}`,
          borderRadius:4, padding:'2px 6px', cursor:'pointer', color: pref.pinned ? V.accent : V.textDim, fontSize:10 }}>
        📌 {pref.pinned ? 'Pinned' : 'Pin'}
      </button>
      <button onClick={() => moveWidget(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, widgetKey, 'up')} title="Move up"
        style={{ background:V.bgElevated, border:`1px solid ${V.borderSubtle}`, borderRadius:4, padding:'2px 4px', cursor:'pointer', color:V.textDim, fontSize:10 }}>↑</button>
      <button onClick={() => moveWidget(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, widgetKey, 'down')} title="Move down"
        style={{ background:V.bgElevated, border:`1px solid ${V.borderSubtle}`, borderRadius:4, padding:'2px 4px', cursor:'pointer', color:V.textDim, fontSize:10 }}>↓</button>
      <button onClick={() => hideWidget(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, widgetKey)} title="Hide"
        style={{ background:V.bgElevated, border:`1px solid ${V.borderSubtle}`, borderRadius:4, padding:'2px 4px', cursor:'pointer', color:V.danger, fontSize:10 }}>👁️</button>
    </div>
  );
}

// Widget wrapper with size/pin styling
export function WidgetCard({ widgetKey, title, children, V, cardStyle, widgetPrefs, currentProfile, fbSet, setWidgetPrefs }) {
  const pref = getWidgetPref(widgetPrefs, currentProfile, widgetKey);
  if (pref.hidden) return null;
  const sizeStyle = WIDGET_SIZES[pref.size] || WIDGET_SIZES.default;
  return (
    <div style={{
      ...cardStyle, ...sizeStyle, margin: '0 0 12px 0',
      position: pref.pinned ? 'sticky' : 'relative',
      top: pref.pinned ? 60 : 'auto',
      zIndex: pref.pinned ? 10 : 'auto',
      border: pref.pinned ? `2px solid ${V.accent}` : cardStyle.border,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontWeight:700, color:V.accent, fontSize:14 }}>{title}</div>
        <WidgetToolbar widgetKey={widgetKey} V={V} widgetPrefs={widgetPrefs}
          currentProfile={currentProfile} fbSet={fbSet} setWidgetPrefs={setWidgetPrefs} />
      </div>
      {children}
    </div>
  );
}
