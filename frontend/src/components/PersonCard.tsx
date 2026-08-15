import type { Person } from "../types";
import "./PersonCard.css";

const SIDE_LABEL: Record<string, string> = {
  paternal: "Paternal",
  maternal: "Maternal",
  core: "Core",
  unknown: "Unlinked",
};

function lifeSpan(p: Person): string {
  const birth = p.birthDate || "?";
  if (!p.isDeceased) return `b. ${birth}`;
  return `${birth} – ${p.deathDate || "?"}`;
}

export default function PersonCard({
  person,
  onClick,
  compact,
}: {
  person: Person;
  onClick: () => void;
  compact?: boolean;
}) {
  const side = person.relation?.side || "unknown";
  const conditionCount = person.conditions.length;
  const causeOfDeathConditions = person.conditions.filter((c) => c.isCauseOfDeath);

  return (
    <button
      className={`person-card side-${side}${person.isCore ? " is-core" : ""}${compact ? " compact" : ""}`}
      onClick={onClick}
      title={`${person.displayName} — ${person.relation?.relationLabel || ""}`}
    >
      {person.isCore && <span className="person-card-core-star">★</span>}
      <div className="person-card-name">
        {person.displayName || <em>Unnamed</em>}
        {person.isDeceased && <span className="person-card-deceased-mark">†</span>}
      </div>
      <div className="person-card-life">{lifeSpan(person)}</div>
      <div className="person-card-relation">
        {person.isCore ? "Core Person" : person.relation?.relationLabel || "—"}
      </div>
      <div className="person-card-footer">
        <span className={`badge badge-${side}`}>{SIDE_LABEL[side]}</span>
        {conditionCount > 0 && (
          <span className="person-card-condition-count" title={`${conditionCount} recorded condition(s)`}>
            ⚕ {conditionCount}
          </span>
        )}
        {causeOfDeathConditions.length > 0 && (
          <span className="person-card-cod" title={`Cause of death: ${causeOfDeathConditions.map((c) => c.conditionName).join(", ")}`}>
            ✝
          </span>
        )}
      </div>
    </button>
  );
}
