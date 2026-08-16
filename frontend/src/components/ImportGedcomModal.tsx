import { useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { GedcomParseResult, TreeDetail } from "../types";
import "./ImportGedcomModal.css";

type Step = "pick" | "previewing" | "preview" | "importing" | "done";

export default function ImportGedcomModal({
  treeId,
  onClose,
  onImported,
}: {
  treeId: string;
  onClose: () => void;
  onImported: (fresh: TreeDetail) => void;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<GedcomParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importedCounts, setImportedCounts] = useState<{ people: number; relationships: number; partnerships: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setStep("previewing");
    try {
      const text = await file.text();
      const result = await api.previewGedcomImport(treeId, text);
      setParseResult(result);
      setStep("preview");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to read that file.");
      setStep("pick");
    }
  }

  async function handleConfirm() {
    if (!parseResult) return;
    setError(null);
    setStep("importing");
    try {
      const outcome = await api.commitGedcomImport(treeId, parseResult);
      setImportedCounts(outcome.imported);
      onImported(outcome.tree);
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import that file.");
      setStep("preview");
    }
  }

  const sampleNames = parseResult?.people.slice(0, 8).map((p) => [p.firstName, p.lastName].filter(Boolean).join(" ")) || [];

  return (
    <div className="modal-backdrop" onClick={step === "importing" ? undefined : onClose}>
      <div className="card modal gedcom-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Import from GEDCOM</h2>

        {step === "pick" && (
          <>
            <p className="field-hint" style={{ marginBottom: "1rem" }}>
              Have a tree already built in Ancestry, MyHeritage, FamilySearch, or Gramps? Export it as a GEDCOM
              (.ged) file and drop it here — names, dates, and how everyone's related come in automatically.
              Health conditions aren't part of the GEDCOM standard, so you'll still add those by hand afterward.
            </p>
            {error && <div className="error-banner">{error}</div>}
            <div
              className="gedcom-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <div style={{ fontSize: "1.6rem" }}>📄</div>
              <p>
                <strong>Click to choose a file</strong> or drag one here
              </p>
              <p className="field-hint">.ged or .gedcom</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ged,.gedcom,text/plain"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === "previewing" && (
          <div className="gedcom-status">
            <div className="spinner" />
            <p>Reading {fileName}…</p>
          </div>
        )}

        {step === "preview" && parseResult && (
          <>
            {error && <div className="error-banner">{error}</div>}
            <p className="field-hint" style={{ marginBottom: "0.9rem" }}>
              From <strong>{fileName}</strong> — nothing has been added to your tree yet.
            </p>
            <div className="gedcom-summary">
              <div>
                <strong>{parseResult.people.length}</strong> people
              </div>
              <div>
                <strong>{parseResult.relationships.length}</strong> parent-child links
              </div>
              <div>
                <strong>{parseResult.partnerships.length}</strong> couples
              </div>
            </div>
            {sampleNames.length > 0 && (
              <p className="field-hint" style={{ marginBottom: "0.9rem" }}>
                Includes: {sampleNames.join(", ")}
                {parseResult.people.length > sampleNames.length ? ", …" : ""}
              </p>
            )}
            {parseResult.warnings.length > 0 && (
              <div className="gedcom-warnings">
                {parseResult.warnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            )}
            <p className="field-hint" style={{ marginBottom: "1rem" }}>
              Everyone here will be added as new people in this tree — they won't be matched against people
              already in it. You can connect an imported branch to the rest of the tree afterward from each
              person's card.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setStep("pick")}>
                Choose a different file
              </button>
              <button className="btn btn-primary" onClick={handleConfirm}>
                Import {parseResult.people.length} people
              </button>
            </div>
          </>
        )}

        {step === "importing" && (
          <div className="gedcom-status">
            <div className="spinner" />
            <p>Importing…</p>
          </div>
        )}

        {step === "done" && importedCounts && (
          <>
            <p style={{ marginBottom: "1rem" }}>
              ✅ Imported <strong>{importedCounts.people}</strong> people, <strong>{importedCounts.relationships}</strong>{" "}
              parent-child links, and <strong>{importedCounts.partnerships}</strong> couples.
            </p>
            <p className="field-hint" style={{ marginBottom: "1rem" }}>
              New arrivals may show up disconnected from the rest of the tree until you link them — open a
              person's card and use "Family links" to add a parent, partner, or child.
            </p>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>
                View tree
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
