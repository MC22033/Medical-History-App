import { useMemo, useState, type FormEvent } from "react";
import type { Person, TreeDetail } from "../types";
import { api, ApiError } from "../api/client";
import "./PersonEditorDrawer.css";

const CONDITION_CATEGORIES = [
  "Cardiovascular",
  "Endocrine / Diabetes",
  "Cancer",
  "Neurological",
  "Mental Health",
  "Respiratory",
  "Autoimmune / Immune",
  "Musculoskeletal",
  "Kidney / Renal",
  "Genetic / Congenital",
  "Other",
];

type Tab = "details" | "family" | "conditions";

export default function PersonEditorDrawer({
  treeId,
  personId,
  tree,
  onClose,
  onChanged,
}: {
  treeId: string;
  personId: string;
  tree: TreeDetail;
  onClose: () => void;
  onChanged: (fresh: TreeDetail) => void;
}) {
  const [tab, setTab] = useState<Tab>("details");
  const person = tree.people.find((p) => p.id === personId);

  if (!person) return null;

  async function refetchAndReport(promise: Promise<TreeDetail>) {
    const fresh = await promise;
    onChanged(fresh);
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <div>
            <h2 style={{ fontSize: "1.05rem" }}>{person.displayName || "Unnamed person"}</h2>
            <span className="field-hint">{person.isCore ? "Core Person" : person.relation.relationLabel}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="tabs">
          <button className={`tab ${tab === "details" ? "active" : ""}`} onClick={() => setTab("details")}>
            Details
          </button>
          <button className={`tab ${tab === "family" ? "active" : ""}`} onClick={() => setTab("family")}>
            Family links
          </button>
          <button className={`tab ${tab === "conditions" ? "active" : ""}`} onClick={() => setTab("conditions")}>
            Health ({person.conditions.length})
          </button>
        </div>
        <div className="drawer-body">
          {tab === "details" && (
            <DetailsTab
              treeId={treeId}
              person={person}
              isCore={person.isCore}
              onChanged={refetchAndReport}
              onClose={onClose}
            />
          )}
          {tab === "family" && (
            <FamilyTab treeId={treeId} person={person} tree={tree} onChanged={refetchAndReport} />
          )}
          {tab === "conditions" && (
            <ConditionsTab treeId={treeId} person={person} onChanged={refetchAndReport} />
          )}
        </div>
      </div>
    </>
  );
}

// ---------------- Details ----------------

function DetailsTab({
  treeId,
  person,
  isCore,
  onChanged,
  onClose,
}: {
  treeId: string;
  person: Person;
  isCore: boolean;
  onChanged: (p: Promise<TreeDetail>) => Promise<void>;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState(person.firstName);
  const [lastName, setLastName] = useState(person.lastName || "");
  const [sex, setSex] = useState<string>(person.sex || "UNKNOWN");
  const [birthDate, setBirthDate] = useState(person.birthDate || "");
  const [isDeceased, setIsDeceased] = useState(person.isDeceased);
  const [deathDate, setDeathDate] = useState(person.deathDate || "");
  const [causeOfDeath, setCauseOfDeath] = useState(person.causeOfDeath || "");
  const [notes, setNotes] = useState(person.notes || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onChanged(
        api.updatePerson(treeId, person.id, {
          firstName,
          lastName: lastName || null,
          sex,
          birthDate: birthDate || null,
          isDeceased,
          deathDate: isDeceased ? deathDate || null : null,
          causeOfDeath: isDeceased ? causeOfDeath || null : null,
          notes: notes || null,
        })
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetCore() {
    setError(null);
    try {
      await onChanged(api.updateTree(treeId, { corePersonId: person.id }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change core person");
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove ${person.displayName || "this person"} from the tree? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await onChanged(api.deletePerson(treeId, person.id));
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove person");
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      {error && <div className="error-banner">{error}</div>}

      {!isCore && (
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginBottom: "1rem" }} onClick={handleSetCore}>
          ★ View tree from this person
        </button>
      )}

      <div className="field-row">
        <div className="field">
          <label>First name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Last name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Sex</label>
          <select value={sex || "UNKNOWN"} onChange={(e) => setSex(e.target.value)}>
            <option value="UNKNOWN">Unknown</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </div>
        <div className="field">
          <label>Birth date</label>
          <input placeholder="e.g. 1954 or 1954-03-02" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label style={{ flexDirection: "row", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <input type="checkbox" checked={isDeceased} onChange={(e) => setIsDeceased(e.target.checked)} style={{ width: "auto" }} />
          Deceased
        </label>
      </div>

      {isDeceased && (
        <>
          <div className="field">
            <label>Date of death</label>
            <input placeholder="e.g. 2019" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Cause of death</label>
            <input
              placeholder="As listed on death certificate, if known"
              value={causeOfDeath}
              onChange={(e) => setCauseOfDeath(e.target.value)}
            />
            <span className="field-hint">
              You can also record this as a health condition on the Health tab (marked "cause of death") so it
              feeds into the risk dashboard.
            </span>
          </div>
        </>
      )}

      <div className="field">
        <label>Notes</label>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </button>

      {!isCore && (
        <button
          type="button"
          className="btn btn-danger btn-block"
          style={{ marginTop: "0.6rem" }}
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Removing…" : "Remove from tree"}
        </button>
      )}
    </form>
  );
}

// ---------------- Family links ----------------

function FamilyTab({
  treeId,
  person,
  tree,
  onChanged,
}: {
  treeId: string;
  person: Person;
  tree: TreeDetail;
  onChanged: (p: Promise<TreeDetail>) => Promise<void>;
}) {
  const parents = tree.relationships
    .filter((r) => r.childId === person.id)
    .map((r) => ({ relId: r.id, person: tree.people.find((p) => p.id === r.parentId) }))
    .filter((x): x is { relId: string; person: Person } => !!x.person);

  const children = tree.relationships
    .filter((r) => r.parentId === person.id)
    .map((r) => ({ relId: r.id, person: tree.people.find((p) => p.id === r.childId) }))
    .filter((x): x is { relId: string; person: Person } => !!x.person);

  const partners = tree.partnerships
    .filter((pt) => pt.personAId === person.id || pt.personBId === person.id)
    .map((pt) => ({
      partnershipId: pt.id,
      person: tree.people.find((p) => p.id === (pt.personAId === person.id ? pt.personBId : pt.personAId)),
    }))
    .filter((x): x is { partnershipId: string; person: Person } => !!x.person);

  return (
    <div>
      <RelationGroup
        title="Parents"
        emptyHint="No parents recorded."
        items={parents.map((x) => ({ id: x.relId, person: x.person }))}
        onRemove={(relId) => onChanged(api.removeRelationship(treeId, relId))}
        addLabel="+ Add parent"
        renderAdd={(close) => (
          <LinkPersonForm
            treeId={treeId}
            tree={tree}
            excludeIds={[person.id, ...parents.map((p) => p.person.id)]}
            onLink={async (otherId) => {
              await onChanged(api.addRelationship(treeId, otherId, person.id));
              close();
            }}
          />
        )}
      />

      <RelationGroup
        title="Partners"
        emptyHint="No spouse/partner recorded."
        items={partners.map((x) => ({ id: x.partnershipId, person: x.person }))}
        onRemove={(id) => onChanged(api.removePartnership(treeId, id))}
        addLabel="+ Add partner"
        renderAdd={(close) => (
          <LinkPersonForm
            treeId={treeId}
            tree={tree}
            excludeIds={[person.id, ...partners.map((p) => p.person.id)]}
            onLink={async (otherId) => {
              await onChanged(api.addPartnership(treeId, person.id, otherId, "MARRIED"));
              close();
            }}
          />
        )}
      />

      <RelationGroup
        title="Children"
        emptyHint="No children recorded."
        items={children.map((x) => ({ id: x.relId, person: x.person }))}
        onRemove={(relId) => onChanged(api.removeRelationship(treeId, relId))}
        addLabel="+ Add child"
        renderAdd={(close) => (
          <LinkPersonForm
            treeId={treeId}
            tree={tree}
            excludeIds={[person.id, ...children.map((p) => p.person.id)]}
            onLink={async (otherId) => {
              await onChanged(api.addRelationship(treeId, person.id, otherId));
              close();
            }}
          />
        )}
      />
    </div>
  );
}

function RelationGroup({
  title,
  emptyHint,
  items,
  onRemove,
  addLabel,
  renderAdd,
}: {
  title: string;
  emptyHint: string;
  items: { id: string; person: Person }[];
  onRemove: (id: string) => void;
  addLabel: string;
  renderAdd: (close: () => void) => React.ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="drawer-section">
      <h3>{title}</h3>
      {items.length === 0 && <p className="field-hint" style={{ marginBottom: "0.6rem" }}>{emptyHint}</p>}
      <ul className="relation-list">
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.person.displayName}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => onRemove(item.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        renderAdd(() => setAdding(false))
      ) : (
        <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
          {addLabel}
        </button>
      )}
    </div>
  );
}

function LinkPersonForm({
  treeId,
  tree,
  excludeIds,
  onLink,
}: {
  treeId: string;
  tree: TreeDetail;
  excludeIds: string[];
  onLink: (personId: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const candidates = useMemo(
    () => tree.people.filter((p) => !excludeIds.includes(p.id)),
    [tree.people, excludeIds]
  );
  const [selectedId, setSelectedId] = useState(candidates[0]?.id || "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState("UNKNOWN");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "existing") {
        if (!selectedId) {
          setError("Choose a person");
          setSubmitting(false);
          return;
        }
        await onLink(selectedId);
      } else {
        const created = await api.createPerson(treeId, {
          firstName,
          lastName: lastName || undefined,
          sex,
        });
        const newest = created.people[created.people.length - 1];
        await onLink(newest.id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to link person");
      setSubmitting(false);
    }
  }

  return (
    <form className="link-form" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}
      <div className="link-form-mode">
        <button type="button" className={`tab ${mode === "existing" ? "active" : ""}`} onClick={() => setMode("existing")}>
          Existing person
        </button>
        <button type="button" className={`tab ${mode === "new" ? "active" : ""}`} onClick={() => setMode("new")}>
          New person
        </button>
      </div>

      {mode === "existing" ? (
        candidates.length === 0 ? (
          <p className="field-hint">Everyone else is already linked. Add a new person instead.</p>
        ) : (
          <div className="field">
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        )
      ) : (
        <div className="field-row">
          <div className="field">
            <input placeholder="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="field">
            <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="field">
            <select value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="UNKNOWN">Unknown</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-sm" type="submit" disabled={submitting}>
        {submitting ? "Linking…" : "Link"}
      </button>
    </form>
  );
}

// ---------------- Conditions ----------------

function ConditionsTab({
  treeId,
  person,
  onChanged,
}: {
  treeId: string;
  person: Person;
  onChanged: (p: Promise<TreeDetail>) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {person.conditions.length === 0 && (
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          No health conditions recorded yet.
        </p>
      )}
      <ul className="condition-list">
        {person.conditions.map((c) => (
          <li key={c.id} className="condition-item">
            <div>
              <div className="condition-item-name">
                {c.conditionName}
                {c.isCauseOfDeath && <span className="condition-item-cod">Cause of death</span>}
              </div>
              <div className="field-hint">
                {[c.category, c.ageAtDiagnosis ? `diagnosed age ${c.ageAtDiagnosis}` : null, c.source?.replace("_", " ").toLowerCase()]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {c.notes && <div className="field-hint">{c.notes}</div>}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onChanged(api.deleteCondition(treeId, c.id))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <ConditionForm
          treeId={treeId}
          personId={person.id}
          onDone={async (p) => {
            await onChanged(p);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
          + Add health condition
        </button>
      )}
    </div>
  );
}

function ConditionForm({
  treeId,
  personId,
  onDone,
  onCancel,
}: {
  treeId: string;
  personId: string;
  onDone: (p: Promise<TreeDetail>) => Promise<void>;
  onCancel: () => void;
}) {
  const [conditionName, setConditionName] = useState("");
  const [category, setCategory] = useState(CONDITION_CATEGORIES[0]);
  const [ageAtDiagnosis, setAgeAtDiagnosis] = useState("");
  const [isCauseOfDeath, setIsCauseOfDeath] = useState(false);
  const [source, setSource] = useState("FAMILY_RECOLLECTION");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onDone(
        api.addCondition(treeId, personId, {
          conditionName,
          category,
          ageAtDiagnosis: ageAtDiagnosis ? Number(ageAtDiagnosis) : undefined,
          isCauseOfDeath,
          source,
          notes: notes || undefined,
        })
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add condition");
      setSubmitting(false);
    }
  }

  return (
    <form className="condition-form" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}
      <div className="field">
        <label>Condition</label>
        <input
          required
          list="condition-suggestions"
          placeholder="e.g. Type 2 Diabetes"
          value={conditionName}
          onChange={(e) => setConditionName(e.target.value)}
        />
        <datalist id="condition-suggestions">
          <option value="Type 2 Diabetes" />
          <option value="Type 1 Diabetes" />
          <option value="Breast Cancer" />
          <option value="Prostate Cancer" />
          <option value="Colon Cancer" />
          <option value="Heart Attack" />
          <option value="Stroke" />
          <option value="High Blood Pressure" />
          <option value="High Cholesterol" />
          <option value="Alzheimer's / Dementia" />
          <option value="Depression" />
          <option value="Anxiety" />
          <option value="Asthma" />
        </datalist>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CONDITION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Age at diagnosis</label>
          <input type="number" min={0} max={130} value={ageAtDiagnosis} onChange={(e) => setAgeAtDiagnosis(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Source</label>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="FAMILY_RECOLLECTION">Family recollection</option>
          <option value="SELF_REPORTED">Self reported</option>
          <option value="DEATH_CERTIFICATE">Death certificate</option>
          <option value="MEDICAL_RECORD">Medical record</option>
        </select>
      </div>
      <div className="field">
        <label style={{ flexDirection: "row", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <input type="checkbox" checked={isCauseOfDeath} onChange={(e) => setIsCauseOfDeath(e.target.checked)} style={{ width: "auto" }} />
          This was a/the cause of death
        </label>
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add condition"}
        </button>
      </div>
    </form>
  );
}
