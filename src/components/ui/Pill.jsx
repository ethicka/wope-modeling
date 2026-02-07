export default function Pill({ active, onClick, children, color }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${active ? color || "#e2e0d6" : "#3a382f"}`,
      background: active ? (color ? color + "18" : "#2a2820") : "transparent",
      color: active ? (color || "#e2e0d6") : "#8a8778", cursor: "pointer",
      fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: "'DM Sans', sans-serif",
      transition: "all 0.2s", letterSpacing: "0.01em"
    }}>{children}</button>
  );
}
