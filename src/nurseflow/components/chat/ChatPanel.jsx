import React, { useState, useRef, useEffect } from "react";

const AGENT_LABELS = {
  "Scheduling Agent": { color: "#1976D2" }, // blue
  "Forecast Agent": { color: "#8e24aa" }, // purple
  "Compliance Agent": { color: "#43a047" }, // green
  "Emergency Agent": { color: "#e53935" }, // red
};

function formatTimestamp(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const ChatPanel = async (e) => {
  const [activityLog, setActivityLog] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Scroll to bottom when activityLog updates
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activityLog]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const addToLog = ({ agent, text }) => {
    setActivityLog((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        agent,
        text,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 2. Include current_schedule in the request body
        body: JSON.stringify({ 
          disruption: inputValue,
          current_schedule: currentSchedule 
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      addToLog({
        agent: "Emergency Agent",
        text: data.action_taken || "(No action_taken returned)",
      });
      setInputValue("");
    } catch (err) {
      addToLog({
        agent: "Emergency Agent",
        text: `Error: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Render a log entry
  const renderLogEntry = (entry) => {
    const agentStyle = {
      color: "#fff",
      background: AGENT_LABELS[entry.agent]?.color || "#888",
      padding: "3px 9px",
      borderRadius: "8px",
      marginRight: "10px",
      fontWeight: "bold",
      fontSize: "0.92em",
      display: "inline-block",
      minWidth: "115px",
      textAlign: "center",
    };
    return (
      <div
        className="activity-log-entry"
        key={entry.id}
        style={{
          display: "flex",
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <span style={agentStyle}>{entry.agent}</span>
        <div style={{ flex: 1 }}>
          <span>{entry.text}</span>
          <span
            style={{
              marginLeft: 14,
              color: "#777",
              fontSize: "0.82em",
              verticalAlign: "middle",
            }}
            title={entry.timestamp.toString()}
          >
            {formatTimestamp(entry.timestamp)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: "12px",
        maxWidth: 500,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        height: 440,
        background: "#fafbfc",
        boxShadow: "0 4px 16px #0001",
        overflow: "hidden",
      }}
    >
      {/* Activity Log */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 22px 10px 22px",
        }}
      >
        {activityLog.length === 0 ? (
          <div style={{ color: "#aaa", textAlign: "center", paddingTop: 38, fontSize: "1.04em" }}>
            No agent activity yet.
          </div>
        ) : (
          activityLog.map(renderLogEntry)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSubmit}
        style={{
          borderTop: "1px solid #eee",
          padding: "16px 18px 12px 18px",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <input
          type="text"
          value={inputValue}
          disabled={loading}
          onChange={handleInputChange}
          placeholder="Describe a disruption..."
          autoFocus
          style={{
            flex: 1,
            padding: "7px 13px",
            borderRadius: 7,
            border: "1px solid #bbb",
            fontSize: "1em",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading || !inputValue.trim()}
          style={{
            background: "#e53935",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            padding: "7px 26px",
            fontWeight: 600,
            fontSize: "1em",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            minWidth: 90,
            justifyContent: "center",
            position: "relative",
          }}
        >
          {loading ? (
            <span
              style={{
                height: 17,
                width: 17,
                display: "inline-block",
                border: "2.5px solid #fff",
                borderTop: "2.5px solid #e57373",
                borderRadius: "50%",
                animation: "spin 0.95s linear infinite",
              }}
            />
          ) : (
            "Submit"
          )}
        </button>
        {/* Spinner animation */}
        <style>{`
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </form>
    </div>
  );
};

export default ChatPanel;