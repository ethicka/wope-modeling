export default function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ padding: "16px 18px", background: "#1a1914", borderRadius: 10, border: "1px solid #2a2820", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#e2e0d6", fontFamily: "'Instrument Serif', serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#8a8778", marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>{sub}</div>}
    </div>
  );
}
