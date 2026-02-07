export const fmt = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs/1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs/1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs/1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

export const fmtPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export const fmtNum = (n) => n.toLocaleString();
