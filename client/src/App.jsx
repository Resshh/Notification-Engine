
import { useState } from "react";

import QuerySetup from "./pages/QuerySetup";
import Connections from "./pages/Connections";

import "./styles.css";

export default function App() {
  const [active, setActive] = useState("Connections");

  const menu = [
    "Job Dashboard",
    "Recipient Lists",
    "Templates",
    "Run History",
    "Connections",
    "Query setup and testing",
  ];

  const renderPage = () => {
    switch (active) {
      case "Connections":
        return <Connections />;

      case "Query setup and testing":
        return <QuerySetup />;

      default:
        return (
          <section className="panel">
            <h1>{active}</h1>
            <p>
              This section belongs to the shared application or
              another team member's implementation.
            </p>
          </section>
        );
    }
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="topbar">
        <div className="brand-mark">N</div>

        <strong>Notification Engine</strong>

        <span className="batch-label">
          BATCH 2 – DATA CONNECTORS
        </span>
      </header>

      <div className="workspace">
        {/* Sidebar */}
        <aside className="sidebar">
          <p className="nav-caption">WORKSPACE</p>

          {menu.map((item) => (
            <button
              key={item}
              type="button"
              className={`nav-item ${
                active === item ? "active" : ""
              }`}
              onClick={() => setActive(item)}
            >
              {item}
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
