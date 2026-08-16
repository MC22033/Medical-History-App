import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import FamilyTreeCanvas from "../components/FamilyTreeCanvas";
import PersonEditorDrawer from "../components/PersonEditorDrawer";
import ImportGedcomModal from "../components/ImportGedcomModal";
import { api, ApiError } from "../api/client";
import type { TreeDetail } from "../types";
import "./TreePage.css";

export default function TreePage() {
  const { treeId } = useParams<{ treeId: string }>();
  const [tree, setTree] = useState<TreeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showImportGedcom, setShowImportGedcom] = useState(false);

  function refresh() {
    if (!treeId) return;
    api
      .getTree(treeId)
      .then(setTree)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load family tree"));
  }

  useEffect(refresh, [treeId]);

  if (error) {
    return (
      <AppShell title="Family tree">
        <div className="error-banner">{error}</div>
        <Link to="/">← Back to your trees</Link>
      </AppShell>
    );
  }

  if (!tree || !treeId) {
    return (
      <AppShell title="Family tree">
        <div className="page-loading">
          <div className="spinner" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={tree.tree.name}
      breadcrumb={<Link to="/">All trees</Link>}
      actions={
        <>
          <Link className="btn btn-secondary btn-sm" to={`/trees/${treeId}/risk`}>
            📊 Risk dashboard
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowInvite(true)}>
            Invite family
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImportGedcom(true)}>
            Import GEDCOM
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddPerson(true)}>
            + Add person
          </button>
        </>
      }
    >
      <FamilyTreeCanvas
        people={tree.people}
        relationships={tree.relationships}
        partnerships={tree.partnerships}
        onSelectPerson={setSelectedPersonId}
      />

      {selectedPersonId && (
        <PersonEditorDrawer
          treeId={treeId}
          personId={selectedPersonId}
          tree={tree}
          onClose={() => setSelectedPersonId(null)}
          onChanged={setTree}
        />
      )}

      {showInvite && <InviteModal inviteCode={tree.tree.inviteCode} onClose={() => setShowInvite(false)} />}

      {showImportGedcom && (
        <ImportGedcomModal
          treeId={treeId}
          onClose={() => setShowImportGedcom(false)}
          onImported={setTree}
        />
      )}

      {showAddPerson && (
        <AddPersonModal
          treeId={treeId}
          onClose={() => setShowAddPerson(false)}
          onCreated={(fresh, newestId) => {
            setTree(fresh);
            setShowAddPerson(false);
            setSelectedPersonId(newestId);
          }}
        />
      )}
    </AppShell>
  );
}

function InviteModal({ inviteCode, onClose }: { inviteCode: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>Invite your family</h2>
        <p className="field-hint" style={{ marginBottom: "1rem" }}>
          Share this code with relatives. Anyone who signs up and enters it can view and add to this tree.
        </p>
        <div className="invite-code-box">{inviteCode}</div>
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: "0.9rem" }}
          onClick={() => {
            navigator.clipboard?.writeText(inviteCode).catch(() => {});
            setCopied(true);
          }}
        >
          {copied ? "Copied!" : "Copy code"}
        </button>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AddPersonModal({
  treeId,
  onClose,
  onCreated,
}: {
  treeId: string;
  onClose: () => void;
  onCreated: (fresh: TreeDetail, newestId: string) => void;
}) {
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
      const fresh = await api.createPerson(treeId, { firstName, lastName: lastName || undefined, sex });
      const newest = fresh.people[fresh.people.length - 1];
      onCreated(fresh, newest.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add person");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add a person</h2>
        <p className="field-hint" style={{ marginBottom: "1rem" }}>
          You'll be able to link them to parents, a partner, or children right after.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>First name</label>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="field">
              <label>Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Sex</label>
            <select value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="UNKNOWN">Unknown</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add & link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
