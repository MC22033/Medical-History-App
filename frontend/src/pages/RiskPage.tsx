import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import RiskChart from "../components/RiskChart";
import { api, ApiError } from "../api/client";
import type { RiskSummary, TreeDetail } from "../types";
import "./RiskPage.css";

const SIDE_META: Record<string, { label: string; cls: string }> = {
  paternal: { label: "Paternal side", cls: "paternal" },
  maternal: { label: "Maternal side", cls: "maternal" },
  core: { label: "Core line (you, siblings, descendants)", cls: "core" },
};

export default function RiskPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const [tree, setTree] = useState<TreeDetail | null>(null);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!treeId) return;
    Promise.all([api.getTree(treeId), api.getRiskSummary(treeId)])
      .then(([t, s]) => {
        setTree(t);
        setSummary(s);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load risk summary"));
  }, [treeId]);

  if (error) {
    return (
      <AppShell title="Risk dashboard">
        <div className="error-banner">{error}</div>
      </AppShell>
    );
  }

  if (!tree || !summary || !treeId) {
    return (
      <AppShell title="Risk dashboard">
        <div className="page-loading">
          <div className="spinner" />
        </div>
      </AppShell>
    );
  }

  const corePerson = tree.people.find((p) => p.isCore);

  return (
    <AppShell
      title="Risk dashboard"
      breadcrumb={
        <>
          <Link to="/">All trees</Link> / <Link to={`/trees/${treeId}`}>{tree.tree.name}</Link>
        </>
      }
    >
      <p className="field-hint" style={{ marginBottom: "1.25rem" }}>
        Conditions relative to <strong>{corePerson?.displayName || "the core person"}</strong> — set who the tree
        is viewed from by opening their card and choosing "View tree from this person".
      </p>

      <div className="risk-stat-row">
        {(["paternal", "maternal", "core"] as const).map((side) => {
          const s = summary.sides[side];
          return (
            <div className="card risk-stat-tile" key={side}>
              <div className={`risk-stat-tile-label ${SIDE_META[side].cls}`}>{SIDE_META[side].label}</div>
              <div className="risk-stat-tile-value">{s.affectedPersonCount}</div>
              <div className="field-hint">
                of {s.bloodRelativeCount} blood relative{s.bloodRelativeCount === 1 ? "" : "s"} on record have a
                condition
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="risk-section-title">Conditions by side of the family</h2>
      <RiskChart rows={summary.comparison} />

      <h2 className="risk-section-title">Full breakdown</h2>
      <div className="card risk-table-wrap">
        <table className="risk-table">
          <thead>
            <tr>
              <th>Condition</th>
              <th>Category</th>
              <th className="paternal">Paternal</th>
              <th className="maternal">Maternal</th>
              <th className="core">Core line</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {summary.comparison.map((row) => (
              <tr key={row.conditionName}>
                <td>{row.conditionName}</td>
                <td className="field-hint">{row.category || "—"}</td>
                <td className="paternal">{row.paternalCount || "—"}</td>
                <td className="maternal">{row.maternalCount || "—"}</td>
                <td className="core">{row.coreCount || "—"}</td>
                <td>
                  <strong>{row.totalCount}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="risk-section-title">Who's affected</h2>
      <div className="risk-side-columns">
        {(["paternal", "maternal", "core"] as const).map((side) => (
          <div className="card risk-side-column" key={side}>
            <h3 className={SIDE_META[side].cls}>{SIDE_META[side].label}</h3>
            {summary.sides[side].conditions.length === 0 ? (
              <p className="field-hint">Nothing recorded on this side yet.</p>
            ) : (
              summary.sides[side].conditions.map((c) => (
                <details key={c.conditionName} className="risk-condition-detail">
                  <summary>
                    {c.conditionName} <span className="field-hint">× {c.count}</span>
                  </summary>
                  <ul>
                    {c.occurrences.map((o, i) => (
                      <li key={i}>
                        {o.personName} <span className="field-hint">({o.relationLabel})</span>
                        {o.ageAtDiagnosis ? <span className="field-hint"> · age {o.ageAtDiagnosis}</span> : null}
                        {o.isCauseOfDeath ? <span className="risk-cod-tag">cause of death</span> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ))
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
