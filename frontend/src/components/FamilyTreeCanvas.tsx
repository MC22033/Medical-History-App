import { Fragment, useMemo } from "react";
import type { Person, PartnershipEdge, RelationshipEdge } from "../types";
import { buildFamilyForest, type FamilyUnit } from "../lib/treeLayout";
import PersonCard from "./PersonCard";
import "./FamilyTreeCanvas.css";

function UnitNode({
  unit,
  peopleById,
  onSelect,
}: {
  unit: FamilyUnit;
  peopleById: Map<string, Person>;
  onSelect: (personId: string) => void;
}) {
  const members = unit.memberIds.map((id) => peopleById.get(id)).filter((p): p is Person => !!p);
  if (members.length === 0) return null;

  return (
    <li>
      <div className="unit-box">
        {members.map((m, i) => (
          <Fragment key={m.id}>
            {i > 0 && <span className="partner-link">⚭</span>}
            <PersonCard person={m} onClick={() => onSelect(m.id)} />
          </Fragment>
        ))}
      </div>
      {unit.children.length > 0 && (
        <ul>
          {unit.children.map((child) => (
            <UnitNode key={child.id} unit={child} peopleById={peopleById} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function FamilyTreeCanvas({
  people,
  relationships,
  partnerships,
  onSelectPerson,
}: {
  people: Person[];
  relationships: RelationshipEdge[];
  partnerships: PartnershipEdge[];
  onSelectPerson: (personId: string) => void;
}) {
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const forest = useMemo(
    () => buildFamilyForest(people, relationships, partnerships),
    [people, relationships, partnerships]
  );

  if (people.length === 0) {
    return (
      <div className="empty-state card">
        <p>This family tree has no one in it yet. Add the first person to get started.</p>
      </div>
    );
  }

  return (
    <div className="tree-canvas-scroll">
      <div className="tree-forest">
        {forest.map((root) => (
          <div className="tree" key={root.id}>
            <ul className="tree-root">
              <UnitNode unit={root} peopleById={peopleById} onSelect={onSelectPerson} />
            </ul>
          </div>
        ))}
      </div>
      <div className="tree-legend">
        <span className="badge badge-paternal">Paternal side</span>
        <span className="badge badge-maternal">Maternal side</span>
        <span className="badge badge-core">Core line</span>
        <span className="badge badge-unknown">Unlinked</span>
      </div>
    </div>
  );
}
