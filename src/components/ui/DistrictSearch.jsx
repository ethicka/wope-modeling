import { useState, useRef, useEffect } from "react";
import { DISTRICT_LIST } from '../../data/districts.js';

const COUNTIES = [...new Set(DISTRICT_LIST.map(d => d.county))].sort();

export default function DistrictSearch({ onSelect, placeholder = "Search districts..." }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [countyFilter, setCountyFilter] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = query.toLowerCase();
  const filtered = DISTRICT_LIST.filter(d => {
    if (countyFilter && d.county !== countyFilter) return false;
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || d.county.toLowerCase().includes(q) || d.key.toLowerCase().includes(q);
  }).slice(0, 50);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 8,
            border: "1px solid #2a2820", background: "#1a1914",
            color: "#e2e0d6", fontSize: 13, outline: "none",
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
        <select
          value={countyFilter}
          onChange={e => { setCountyFilter(e.target.value); setOpen(true); }}
          style={{
            padding: "6px 8px", borderRadius: 8,
            border: "1px solid #2a2820", background: "#1a1914",
            color: "#8a8778", fontSize: 12, outline: "none", cursor: "pointer",
          }}
        >
          <option value="">All Counties</option>
          {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          maxHeight: 300, overflowY: "auto", marginTop: 4,
          background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          {filtered.map(d => (
            <div
              key={d.key}
              onClick={() => { onSelect(d.key); setQuery(""); setOpen(false); }}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: 13,
                borderBottom: "1px solid #1f1e18",
                color: "#e2e0d6",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#2a2820"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontWeight: 600 }}>{d.name}</span>
              <span style={{ color: "#6a6758", marginLeft: 8, fontSize: 11 }}>{d.county} Co. {d.dfg ? `· ${d.dfg}` : ""} · {d.type}</span>
            </div>
          ))}
          {filtered.length === 50 && (
            <div style={{ padding: "6px 12px", fontSize: 11, color: "#6a6758", textAlign: "center" }}>
              Showing first 50 results. Type more to narrow...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ComparisonBar({ compared, districts, onRemove, onAdd }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em" }}>Comparing:</span>
        {compared.map(key => {
          const d = districts[key];
          if (!d) return null;
          return (
            <span key={key} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 20, fontSize: 12,
              background: `${d.color}20`, border: `1px solid ${d.color}40`,
              color: d.color, fontWeight: 600,
            }}>
              {d.short || d.name.slice(0, 4)}
              <span
                onClick={() => onRemove(key)}
                style={{ cursor: "pointer", opacity: 0.6, fontWeight: 400, marginLeft: 2 }}
                title="Remove from comparison"
              >x</span>
            </span>
          );
        })}
        {compared.length < 8 && (
          <div style={{ flex: 1, maxWidth: 300 }}>
            <DistrictSearch
              onSelect={(key) => { if (!compared.includes(key)) onAdd(key); }}
              placeholder="+ Add district..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
