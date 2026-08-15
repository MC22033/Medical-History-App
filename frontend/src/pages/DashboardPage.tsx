import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { api, ApiError } from "../api/client";
import type { TreeSummary } from "../types";
import "./DashboardPage.css";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [trees, setTrees] = useState<TreeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  function refresh() {
    api
      .listTrees()
      .then((res) => setTrees(res.trees))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load your family trees"));
  }

  useEffect(refresh, []);

  return (
    <AppShell title="Your family trees">
      {error && <div className="error-banner">{error}</div>}

      <div className="dash-actions">
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Start a new family tree
        </button>
        <button className="btn btn-secondary" onClick={() => setShowJoin(true)}>
          Join with an invite code
        </button>
      </div>

      {trees === null ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : trees.length === 0 ? (
        <div className="empty-state card">
          <p>No family trees yet. Start one, or join a relative's tree with their invite code.</p>
        </div>
      ) : (
        <div className="tree-grid">
          {trees.map((t) => (
            <button key={t.id} className="tree-card card" onClick={() => navigate(`/trees/${t.id}`)}>
              <div className="tree-card-name">{t.name}</div>
              <div className="tree-card-meta">
                <span className="badge badge-core">{t.role}</span>
                <span>Invite code: {t.inviteCode}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && <CreateTreeModal onClose={() => setShowCreate(false)} onCreated={(id) => navigate(`/trees/${id}`)} />}
      {showJoin && (
        <JoinTreeModal
          onClose={() => setShowJoin(false)}
          onJoined={(id) => navigate(`/trees/${id}`)}
        />
      )}
    </AppShell>
  );
}

function CreateTreeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [treeName, setTreeName] = useState("");
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
      const detail = await api.createTree({
        treeName,
        corePersonFirstName: firstName,
        corePersonLastName: lastName || undefined,
        corePersonSex: sex,
      });
      onCreated(detail.tree.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create family tree");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>Start a new family tree</h2>
        <p className="field-hint" style={{ marginBottom: "1rem" }}>
          You'll be added as the tree's first person — the "core person" everyone else's connection is measured
          against. You can change this later.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="treeName">Family tree name</label>
            <input
              id="treeName"
              required
              placeholder="e.g. The Nguyen Family"
              value={treeName}
              onChange={(e) => setTreeName(e.target.value)}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="firstName">Your first name</label>
              <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="sex">Sex</label>
            <select id="sex" value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="UNKNOWN">Prefer not to say</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create tree"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JoinTreeModal({ onClose, onJoined }: { onClose: () => void; onJoined: (id: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.joinTree(code.trim());
      onJoined(res.treeId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to join family tree");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>Join a family tree</h2>
        <p className="field-hint" style={{ marginBottom: "1rem" }}>
          Ask whoever started the tree for their invite code, found on their dashboard.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="code">Invite code</label>
            <input
              id="code"
              required
              placeholder="e.g. CRZ89KDP"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Joining…" : "Join tree"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
