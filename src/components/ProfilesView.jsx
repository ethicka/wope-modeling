import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DISTRICTS } from '../data/districts.js';
import { FORMULA } from '../data/formula-params.js';
import { runFormula } from '../engine/sfra-formula.js';
import { fmt, fmtPct, fmtNum } from '../utils/format.js';
import Pill from './ui/Pill.jsx';
import Tip from './ui/Tip.jsx';
import StatCard from './ui/StatCard.jsx';

export default function ProfilesView({ selected, setSelected }) {
  const d = DISTRICTS[selected];
  const r = runFormula(d);
  const aidBreakdown = [
    { name: "Equalization", value: d.fy26Detail.eq, fill: d.color },
    { name: "Sp. Ed.", value: d.fy26Detail.sped, fill: d.accent },
    { name: "Transport", value: d.fy26Detail.trans, fill: "#a78bfa" },
    { name: "Security", value: d.fy26Detail.sec, fill: "#fbbf24" },
  ];
  const demoData = [
    { name: "At-Risk", pct: d.atRiskPct * 100 },
    { name: "LEP/ELL", pct: (d.lep / d.enr.total) * 100 },
    { name: "Sp. Ed.", pct: (FORMULA.spedRate) * 100 },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {Object.entries(DISTRICTS).map(([k, v]) => (
          <Pill key={k} active={selected === k} onClick={() => setSelected(k)} color={v.color}>{v.name}</Pill>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>District Profile</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: d.color, fontFamily: "'Instrument Serif', serif", marginBottom: 4 }}>{d.name}</div>
          <div style={{ fontSize: 14, color: "#8a8778" }}>{d.county} County · {d.type} · <Tip term="GCA">GCA</Tip>: {d.gca}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <div><span style={{ fontSize: 11, color: "#6a6758" }}>ENROLLMENT {d.onRoll ? "(RESIDENT)" : ""}</span><br/><span style={{ fontSize: 18, fontWeight: 600, color: "#e2e0d6" }}>{fmtNum(d.enr.total)}{d.onRoll ? <span style={{ fontSize: 12, color: "#6a6758" }}> ({fmtNum(d.onRoll)} on-roll)</span> : ""}</span></div>
            <div><span style={{ fontSize: 11, color: "#6a6758" }}>AT-RISK % (<Tip term="FRL">FRL</Tip>)</span><br/><span style={{ fontSize: 18, fontWeight: 600, color: "#e2e0d6" }}>{(d.atRiskPct * 100).toFixed(0)}%</span></div>
            <div><span style={{ fontSize: 11, color: "#6a6758" }}><Tip term="EV">EQUALIZED VALUE</Tip></span><br/><span style={{ fontSize: 18, fontWeight: 600, color: "#e2e0d6" }}>{fmt(d.ev3yr[0])}</span></div>
            <div><span style={{ fontSize: 11, color: "#6a6758" }}>LOCAL LEVY</span><br/><span style={{ fontSize: 18, fontWeight: 600, color: "#e2e0d6" }}>{fmt(d.levy)}</span></div>
          </div>
        </div>

        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>FY26 State Aid Breakdown</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={aidBreakdown} layout="vertical" margin={{ left: 60, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                {aidBreakdown.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="FY26 Total Aid" value={fmt(d.fy26)} sub={`${fmtPct(((d.fy26 - d.fy25) / d.fy25) * 100)} from FY25`} color={d.color} />
        <StatCard label={<>Aid <Tip term="PP">Per Pupil</Tip></>} value={fmt(d.fy26 / d.enr.total)} sub={`of ${fmt(d.budget)} total budget`} />
        <StatCard label="Aid % of Budget" value={`${(d.fy26 / d.budget * 100).toFixed(1)}%`} sub="state dependency" />
        <StatCard label="Formula Adequacy" value={fmt(r.adequacy)} sub={<><Tip term="LFS">LFS</Tip>: {fmt(r.lfs)}</>} />
      </div>
    </div>
  );
}
