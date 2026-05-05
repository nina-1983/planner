import { useState, useEffect } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const quotes = [
  "One thing at a time. Everything else can wait.",
  "Small moves. Steady pace. Real results.",
  "You don't need more hours — you need clearer priorities.",
  "Build the day before it builds itself.",
  "Slow is smooth. Smooth is fast.",
];

const todayQuote = quotes[new Date().getDay() % quotes.length];

const today = new Date();
const todayStr = today.toLocaleDateString("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function fetchNotionData() {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `Use the Notion tools to fetch Nina's weekly planner data.

1. Query the "My Tasks" database view at: https://www.notion.so/325c1adacbe780dd883ef6b16f3b5855 to get tasks due this week (Status = "Not Started" or "In Progress")
2. Query the "Client Work Board" view at: https://www.notion.so/325c1adacbe78069a815f10225fe8910?v=f32171a8-d34a-4009-ae8c-57f1c0cbdbc0 to get "Focus This Week" client items
3. Fetch the "Daily Home Board" database at: https://www.notion.so/dd7ba18f385d407c977d1eb47f0671f2 to get today's home entry

Return only valid JSON with this exact structure:
{
  "weekTasks": [{"name": "...", "priority": "...", "dueDate": "...", "status": "..."}],
  "clientFocus": [{"client": "...", "focus": "...", "nextStep": "..."}],
  "homeToday": {
    "mealPlan": "...",
    "movement": "...",
    "dailyBasics": [...],
    "homeAnchors": [...],
    "energyNote": "..."
  }
}

If any fetch fails, return empty arrays/objects for that section.`,
          },
        ],
        mcp_servers: [
          { type: "url", url: "https://mcp.notion.com/mcp", name: "notion" },
        ],
      }),
    });

    const data = await response.json();
    const content = data.content[0]?.text || "{}";
    const cleanJson = content.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Notion fetch error:", error);
    return {
      weekTasks: [],
      clientFocus: [],
      homeToday: {},
    };
  }
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: #F5F0EB;
    color: #2C2420;
  }

  :root {
    --cream: #F5F0EB;
    --warm-white: #FDFAF7;
    --sage: #8A9E8A;
    --sage-light: #C8D8C8;
    --dusty-rose: #C49A8A;
    --warm-brown: #2C2420;
    --muted: #7A6E68;
    --border: #E8E0D8;
    --shadow: 0 2px 16px rgba(44,36,32,0.07);
    --shadow-hover: 0 6px 24px rgba(44,36,32,0.12);
  }

  .planner {
    min-height: 100vh;
    padding: 24px 16px 48px;
    background: var(--cream);
    background-image: 
      radial-gradient(circle at 15% 10%, rgba(138,158,138,0.12) 0%, transparent 50%),
      radial-gradient(circle at 85% 80%, rgba(196,154,138,0.10) 0%, transparent 50%);
  }

  .inner { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }

  .header {
    background: var(--warm-white);
    border-radius: 24px;
    padding: 28px 32px;
    box-shadow: var(--shadow);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
  }

  .header-left { flex: 1; }

  .header-date {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--dusty-rose);
    font-weight: 500;
    margin-bottom: 8px;
  }

  .header-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(26px, 4vw, 38px);
    font-weight: 600;
    color: var(--warm-brown);
    line-height: 1.2;
  }

  .header-quote {
    font-size: 13px;
    color: var(--muted);
    margin-top: 8px;
    font-style: italic;
  }

  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
  }

  .header-dot {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--sage-light), var(--sage));
    opacity: 0.6;
    flex-shrink: 0;
  }

  .sync-button {
    background: var(--sage);
    color: var(--warm-white);
    border: none;
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sync-button:hover { background: #7A8D7A; }
  .sync-button:disabled { opacity: 0.5; cursor: not-allowed; }

  .sync-indicator {
    font-size: 11px;
    color: var(--sage);
    letter-spacing: 0.5px;
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .sync-indicator.visible { opacity: 1; }

  .card {
    background: var(--warm-white);
    border-radius: 20px;
    padding: 24px;
    box-shadow: var(--shadow);
    transition: box-shadow 0.2s ease;
  }

  .card:hover { box-shadow: var(--shadow-hover); }

  .card-title {
    font-family: 'Playfair Display', serif;
    font-size: 17px;
    font-weight: 500;
    color: var(--warm-brown);
    margin-bottom: 18px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .section-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--dusty-rose);
    font-weight: 600;
    margin-bottom: 12px;
    padding-top: 8px;
  }

  .task-item {
    padding: 10px 12px;
    background: var(--cream);
    border-radius: 10px;
    margin-bottom: 8px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .task-content {
    flex: 1;
    font-size: 13.5px;
  }

  .task-priority {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
    margin-top: 3px;
  }

  .task-list { display: flex; flex-direction: column; gap: 6px; }

  .focus-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    margin-bottom: 6px;
    font-weight: 500;
  }

  .home-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }

  @media(max-width: 700px) { .home-grid { grid-template-columns: 1fr; } }

  .home-item {
    padding: 12px;
    background: var(--cream);
    border-radius: 10px;
  }

  .home-item-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--muted);
    font-weight: 600;
    margin-bottom: 4px;
  }

  .home-item-value {
    font-size: 13px;
    color: var(--warm-brown);
    font-weight: 500;
  }

  .basics-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .basic-tag {
    background: var(--sage);
    color: var(--warm-white);
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 500;
  }

  .client-item {
    padding: 12px;
    background: var(--cream);
    border-radius: 10px;
    margin-bottom: 8px;
    border-left: 3px solid var(--dusty-rose);
  }

  .client-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--warm-brown);
    margin-bottom: 4px;
  }

  .client-focus {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 3px;
  }

  .brain-textarea { min-height: 160px; }
  .notes-textarea { min-height: 110px; }

  input[type="text"], textarea {
    width: 100%;
    background: var(--cream);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    padding: 10px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13.5px;
    color: var(--warm-brown);
    outline: none;
    transition: border-color 0.2s, background 0.2s;
    resize: none;
  }

  input[type="text"]:focus, textarea:focus {
    border-color: var(--sage);
    background: var(--warm-white);
  }

  input[type="text"]::placeholder, textarea::placeholder { color: #B0A8A2; }

  .loading {
    text-align: center;
    padding: 20px;
    font-size: 13px;
    color: var(--muted);
  }
`;

export default function PlannerDashboard() {
  const [brainDump, setBrainDump] = useState(() => load("planner_brainDump", ""));
  const [notes, setNotes] = useState(() => load("planner_notes", ""));
  const [synced, setSynced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notionData, setNotionData] = useState(() => 
    load("planner_notionData", { weekTasks: [], clientFocus: [], homeToday: {} })
  );

  useEffect(() => {
    localStorage.setItem("planner_notionData", JSON.stringify(notionData));
  }, [notionData]);

  useEffect(() => {
    localStorage.setItem("planner_brainDump", JSON.stringify(brainDump));
    localStorage.setItem("planner_notes", JSON.stringify(notes));
  }, [brainDump, notes]);

  const handleSync = async () => {
    setLoading(true);
    const data = await fetchNotionData();
    setNotionData(data);
    setSynced(true);
    setTimeout(() => setSynced(false), 2000);
    setLoading(false);
  };

  const { weekTasks = [], clientFocus = [], homeToday = {} } = notionData;

  const todaysTasks = weekTasks.filter(t => {
    const due = new Date(t.dueDate);
    const todayDate = new Date();
    return due.toDateString() === todayDate.toDateString();
  });

  return (
    <>
      <style>{styles}</style>
      <div className="planner">
        <div className="inner">

          {/* Header */}
          <header className="header">
            <div className="header-left">
              <p className="header-date">{todayStr}</p>
              <h1 className="header-title">My Planner Dashboard</h1>
              <p className="header-quote">{todayQuote}</p>
            </div>
            <div className="header-right">
              <button 
                className="sync-button" 
                onClick={handleSync}
                disabled={loading}
              >
                {loading ? "Syncing..." : "Sync Notion"}
              </button>
              <span className={`sync-indicator${synced ? " visible" : ""}`}>✓ synced</span>
              <div className="header-dot" />
            </div>
          </header>

          {/* Work Section */}
          <div className="card">
            <h2 className="card-title">Work</h2>
            
            {todaysTasks.length > 0 && (
              <>
                <p className="section-label">Today's priority</p>
                <div className="task-list">
                  {todaysTasks.slice(0, 1).map((task, i) => (
                    <div className="task-item" key={i}>
                      <div className="task-content">
                        <div>{task.name}</div>
                        <div className="task-priority">{task.priority}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {weekTasks.length > 0 && (
              <>
                <p className="section-label" style={{ marginTop: "16px" }}>This week</p>
                <div className="task-list">
                  {weekTasks.slice(0, 4).map((task, i) => (
                    <div className="task-item" key={i}>
                      <div className="task-content">
                        <div>{task.name}</div>
                        <div className="task-priority">{task.priority} • {task.dueDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {clientFocus.length > 0 && (
              <>
                <p className="section-label" style={{ marginTop: "16px" }}>Client focus</p>
                <div className="task-list">
                  {clientFocus.map((item, i) => (
                    <div className="client-item" key={i}>
                      <div className="client-name">{item.client}</div>
                      <div className="client-focus">{item.focus}</div>
                      {item.nextStep && <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "3px" }}>Next: {item.nextStep}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Home Section */}
          <div className="card">
            <h2 className="card-title">Home</h2>
            
            {Object.keys(homeToday).length > 0 ? (
              <div className="home-grid">
                {homeToday.mealPlan && (
                  <div className="home-item">
                    <div className="home-item-label">Meal plan</div>
                    <div className="home-item-value">{homeToday.mealPlan}</div>
                  </div>
                )}
                {homeToday.movement && (
                  <div className="home-item">
                    <div className="home-item-label">Movement</div>
                    <div className="home-item-value">{homeToday.movement}</div>
                  </div>
                )}
                {homeToday.energyNote && (
                  <div className="home-item">
                    <div className="home-item-label">Energy</div>
                    <div className="home-item-value">{homeToday.energyNote}</div>
                  </div>
                )}
                {homeToday.dailyBasics && homeToday.dailyBasics.length > 0 && (
                  <div className="home-item">
                    <div className="home-item-label">Daily basics</div>
                    <div className="basics-list">
                      {homeToday.dailyBasics.map((basic, i) => (
                        <div key={i} className="basic-tag">{basic}</div>
                      ))}
                    </div>
                  </div>
                )}
                {homeToday.homeAnchors && homeToday.homeAnchors.length > 0 && (
                  <div className="home-item">
                    <div className="home-item-label">Anchors</div>
                    <div className="basics-list">
                      {homeToday.homeAnchors.map((anchor, i) => (
                        <div key={i} className="basic-tag">{anchor}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "13px" }}>No home data yet. Hit "Sync Notion" to pull today's entry.</p>
            )}
          </div>

          {/* Brain Dump */}
          <div className="card">
            <h2 className="card-title">Brain dump</h2>
            <textarea
              className="brain-textarea"
              value={brainDump}
              onChange={(e) => setBrainDump(e.target.value)}
              placeholder="Get it out of your head..."
            />
          </div>

          {/* Notes */}
          <div className="card">
            <h2 className="card-title">Notes & reminders</h2>
            <textarea
              className="notes-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you don't want to forget..."
            />
          </div>

        </div>
      </div>
    </>
  );
}
