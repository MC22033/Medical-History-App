import type { ConditionComparisonRow } from "../types";
import "./RiskChart.css";

const SERIES: { key: "paternalCount" | "maternalCount" | "coreCount"; label: string; cls: string }[] = [
  { key: "paternalCount", label: "Paternal side", cls: "paternal" },
  { key: "maternalCount", label: "Maternal side", cls: "maternal" },
  { key: "coreCount", label: "Core line", cls: "core" },
];

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export default function RiskChart({ rows }: { rows: ConditionComparisonRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="empty-state card">
        <p>No health conditions recorded yet — add some from a person's card to see the comparison here.</p>
      </div>
    );
  }

  const shown = rows.slice(0, 10);
  const max = niceMax(Math.max(...shown.map((r) => Math.max(r.paternalCount, r.maternalCount, r.coreCount))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <div className="risk-chart card">
      <div className="risk-chart-legend">
        {SERIES.map((s) => (
          <span key={s.key} className={`risk-chart-legend-item ${s.cls}`}>
            <i /> {s.label}
          </span>
        ))}
      </div>

      <div className="risk-chart-plot">
        <div className="risk-chart-yaxis">
          {ticks
            .slice()
            .reverse()
            .map((t) => (
              <span key={t}>{t}</span>
            ))}
        </div>
        <div className="risk-chart-grid">
          {ticks.map((t) => (
            <div key={t} className="risk-chart-gridline" style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
          <div className="risk-chart-groups">
            {shown.map((row) => (
              <div className="risk-chart-group" key={row.conditionName}>
                <div className="risk-chart-bars">
                  {SERIES.map((s) => {
                    const value = row[s.key];
                    const pct = max > 0 ? (value / max) * 100 : 0;
                    return (
                      <div className="bar-wrap" key={s.key} tabIndex={value > 0 ? 0 : -1}>
                        {value > 0 && <span className="bar-value">{value}</span>}
                        <div className={`bar ${s.cls}`} style={{ height: `${pct}%` }} />
                        {value > 0 && (
                          <div className="bar-tooltip">
                            <strong>{row.conditionName}</strong>
                            <br />
                            {s.label}: {value} {value === 1 ? "relative" : "relatives"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="risk-chart-group-label" title={row.conditionName}>
                  {row.conditionName}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
