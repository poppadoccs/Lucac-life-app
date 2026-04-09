import { useState, useEffect, useRef } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GMAIL_STORAGE_KEY = "gmail_auth"; // { token, expiresAt }

export default function GmailWidget({ V, currentProfile, showToast }) {
  const card = { background: V.bgCard, borderRadius: V.r3, padding: V.sp4, boxShadow: V.shadowCard, marginBottom: V.sp3 };
  const btnBase = { minHeight: 44, minWidth: 44, border: "none", borderRadius: V.r2, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" };
  const btnPrimary = { ...btnBase, background: V.accent, color: "#fff", padding: "0 16px" };
  const btnOutline = { ...btnBase, background: "transparent", color: V.accent, border: `1.5px solid ${V.accent}`, padding: "0 14px" };

  const role = currentProfile?.type || "guest";
  if (role === "kid" || role === "guest") return null;

  const [gisReady, setGisReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);
  const tokenClientRef = useRef(null);

  useEffect(() => {
    // Check for existing valid token first
    try {
      const stored = JSON.parse(localStorage.getItem(GMAIL_STORAGE_KEY) || "null");
      if (stored && stored.token && stored.expiresAt > Date.now()) {
        setConnected(true);
        fetchEmails(stored.token);
      }
    } catch (_) {}

    // Load GIS script
    if (document.getElementById("gis-script")) {
      setGisReady(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => setGisReady(true);
    script.onerror = () => setError("Failed to load Google Sign-In");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!gisReady || !GOOGLE_CLIENT_ID || tokenClientRef.current) return;
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      callback: handleTokenResponse,
    });
  }, [gisReady]);

  function handleTokenResponse(response) {
    if (response.error) {
      showToast("Gmail auth failed: " + response.error, "error");
      return;
    }
    const expiresAt = Date.now() + (response.expires_in || 3600) * 1000;
    localStorage.setItem(GMAIL_STORAGE_KEY, JSON.stringify({ token: response.access_token, expiresAt }));
    setConnected(true);
    fetchEmails(response.access_token);
  }

  async function fetchEmails(token) {
    setLoading(true);
    setError(null);
    try {
      const listRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10",
        { headers: { Authorization: "Bearer " + token } }
      );
      if (listRes.status === 401) {
        localStorage.removeItem(GMAIL_STORAGE_KEY);
        setConnected(false);
        setEmails([]);
        showToast("Gmail session expired — please reconnect", "error");
        setLoading(false);
        return;
      }
      if (!listRes.ok) throw new Error("Gmail list failed: " + listRes.status);
      const listData = await listRes.json();
      const messages = listData.messages || [];

      const detailed = await Promise.all(
        messages.map(async ({ id }) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: "Bearer " + token } }
          );
          if (!msgRes.ok) return null;
          const msg = await msgRes.json();
          const headers = msg.payload?.headers || [];
          const getHeader = name => headers.find(h => h.name === name)?.value || "";
          return {
            id,
            subject: getHeader("Subject") || "(No subject)",
            sender: getHeader("From") || "Unknown",
            date: getHeader("Date") || "",
            snippet: msg.snippet || "",
          };
        })
      );
      setEmails(detailed.filter(Boolean));
    } catch (e) {
      setError("Could not load emails: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function connectGmail() {
    if (!tokenClientRef.current) {
      showToast("Google Sign-In not ready yet", "error");
      return;
    }
    tokenClientRef.current.requestAccessToken();
  }

  function disconnectGmail() {
    localStorage.removeItem(GMAIL_STORAGE_KEY);
    setConnected(false);
    setEmails([]);
    showToast("Gmail disconnected", "info");
  }

  function refreshEmails() {
    try {
      const stored = JSON.parse(localStorage.getItem(GMAIL_STORAGE_KEY) || "null");
      if (stored && stored.token && stored.expiresAt > Date.now()) {
        fetchEmails(stored.token);
      } else {
        showToast("Session expired — please reconnect", "error");
        setConnected(false);
      }
    } catch (_) {
      showToast("Could not refresh", "error");
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      return dateStr.slice(0, 16);
    }
  }

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div style={card}>
        <div style={{ fontSize: 13, color: V.textMuted, textAlign: "center", padding: 16 }}>
          Gmail not configured — add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>.env.local</code>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: V.textPrimary }}>📧 Gmail</span>
        <div style={{ display: "flex", gap: 6 }}>
          {connected && (
            <>
              <button onClick={refreshEmails} disabled={loading} style={{ ...btnOutline, padding: "0 12px", fontSize: 12 }}>
                ↻ Refresh
              </button>
              <button onClick={disconnectGmail} style={{ ...btnBase, padding: "0 10px", background: V.bgCardAlt, color: V.textMuted, fontSize: 12 }}>
                Disconnect
              </button>
            </>
          )}
          {!connected && (
            <button onClick={connectGmail} style={btnPrimary}>
              Connect Gmail
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: V.danger, padding: "8px 0", textAlign: "center" }}>
          ⚠ {error}
        </div>
      )}

      {/* Not connected */}
      {!connected && !error && (
        <div style={{ textAlign: "center", padding: "16px 0", color: V.textMuted, fontSize: 13 }}>
          View your recent emails here
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 16, color: V.textMuted, fontSize: 13 }}>
          Fetching emails...
        </div>
      )}

      {/* Empty state */}
      {connected && !loading && emails.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: 16, color: V.textMuted, fontSize: 13 }}>
          No emails found
        </div>
      )}

      {/* Email list */}
      {connected && !loading && emails.map(email => {
        const isExpanded = expandedId === email.id;
        return (
          <div
            key={email.id}
            style={{
              borderBottom: `1px solid ${V.borderSubtle}`,
              padding: "10px 0",
            }}
          >
            {/* Collapsed header — tappable */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : email.id)}
              style={{
                width: "100%", background: "transparent", border: "none", cursor: "pointer",
                padding: 0, textAlign: "left", minHeight: 44,
                display: "flex", flexDirection: "column", gap: 2,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary, flex: 1, wordBreak: "break-word" }}>
                  {email.subject}
                </span>
                <span style={{ fontSize: 11, color: V.textMuted, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {formatDate(email.date)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: V.textSecondary }}>
                {email.sender}
              </div>
            </button>

            {/* Expanded body */}
            {isExpanded && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${V.borderSubtle}` }}>
                <p style={{ fontSize: 12, color: V.textMuted, margin: "0 0 10px 0", lineHeight: 1.5 }}>
                  {email.snippet}
                </p>
                <a
                  href={`https://mail.google.com/mail/u/0/#inbox/${email.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12, color: V.accent, fontWeight: 600,
                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  Open in Gmail ↗
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
