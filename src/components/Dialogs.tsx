import { useEffect, useRef, useState, type ReactNode } from "react";
import { FileText, Upload, X, Terminal, ShieldCheck } from "lucide-react";
import {
  MAX_NOTES,
  paragraphs,
  type Folder,
  type StudySet,
} from "../lib/models";
import { normalizeTags } from "../lib/organization";
import { PdfImport } from "./PdfImport";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Editor({
  initial,
  onClose,
  onSave,
  folders = [],
}: {
  initial: StudySet | null;
  onClose: () => void;
  onSave: (
    value: Pick<StudySet, "title" | "subject" | "notes" | "folderId" | "tags">,
  ) => void;
  folders?: Folder[];
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [folderId, setFolderId] = useState(initial?.folderId ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [pdfPending, setPdfPending] = useState(false);
  async function importFile(file?: File) {
    if (!file) return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".txt"))
      return setError(
        "Choose a plain .txt file. Other file types are not supported yet.",
      );
    if (file.size > 100_000)
      return setError(
        "This file is too large. Import a section with at most 20,000 characters.",
      );
    setImporting(true);
    try {
      const content = (await file.text())
        .replace(/^\uFEFF/, "")
        .replace(/\r\n?/g, "\n");
      if (!content.trim())
        throw new Error("This file is empty. Choose a file containing notes.");
      if (content.length > MAX_NOTES)
        throw new Error(
          "These notes exceed 20,000 characters. Split them into smaller study sets.",
        );
      if (content.includes("\0") || content.includes("\uFFFD"))
        throw new Error(
          "This does not look like a UTF-8 text file. Save the file as plain UTF-8 text and retry.",
        );
      setNotes(content);
      if (!title.trim())
        setTitle(file.name.replace(/\.txt$/i, "").slice(0, 100));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not read the file. Try pasting your notes.",
      );
    } finally {
      setImporting(false);
    }
  }
  return (
    <Modal
      title={initial ? "Edit study set" : "Create a study set"}
      onClose={onClose}
      wide
    >
      <p className="muted modal-intro">
        Start with what you have. A lecture, a chapter, a few good notes.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pdfPending) {
            setError("Apply or discard the import preview before saving.");
            return;
          }
          if (!title.trim() || !subject.trim() || !notes.trim()) {
            setError("Add a title, subject, and some notes first.");
            return;
          }
          let normalizedTags: string[];
          try {
            normalizedTags = normalizeTags(tags);
          } catch (error) {
            setError((error as Error).message);
            return;
          }
          onSave({
            title: title.trim(),
            subject: subject.trim(),
            notes: notes.trim(),
            folderId: folderId || null,
            tags: normalizedTags,
          });
        }}
      >
        <div className="form-row">
          <label>
            Study set title
            <input
              autoFocus
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The science of photosynthesis"
            />
          </label>
          <label>
            Subject
            <input
              required
              maxLength={60}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Biology"
            />
          </label>
        </div>
        <div className="form-row organization-fields">
          <label>
            Folder
            <select
              aria-label="Folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">Unfiled</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tags
            <input
              aria-label="Tags"
              aria-describedby="tags-help"
              value={tags}
              maxLength={300}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. exam, chapter-1"
            />
            <span className="small muted" id="tags-help">
              Separate tags with commas. Up to 10.
            </span>
          </label>
        </div>
        <PdfImport
          disabled={importing}
          hasNotes={!!notes.trim()}
          onPendingChange={setPdfPending}
          onApply={(text, filename) => {
            setNotes(text);
            setError("");
            if (!title.trim())
              setTitle(
                filename.replace(/\.(pdf|png|jpe?g|webp)$/i, "").slice(0, 100),
              );
          }}
        />
        <div className="notes-label">
          <label htmlFor="notes-input">Your notes</label>
          <label className={`import-button ${importing ? "disabled" : ""}`}>
            <Upload size={15} />
            {importing ? "Reading…" : "Import .txt"}
            <input
              type="file"
              accept=".txt,text/plain"
              aria-label="Import text file"
              disabled={importing || pdfPending}
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <textarea
          id="notes-input"
          required
          maxLength={MAX_NOTES}
          rows={11}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onPaste={(e) => {
            const field = e.currentTarget;
            const selectedLength = field.selectionEnd - field.selectionStart;
            if (
              notes.length -
                selectedLength +
                e.clipboardData.getData("text").length >
              MAX_NOTES
            ) {
              e.preventDefault();
              setError(
                "These notes exceed 20,000 characters. Paste a shorter section or split your notes into multiple study sets.",
              );
            }
          }}
          placeholder="Paste your notes here. Leave a blank line between paragraphs so you can trace ideas back to their source."
        />
        <div className="field-hint">
          <span>Separate paragraphs with a blank line.</span>
          <span>{notes.length.toLocaleString()} / 20,000</span>
        </div>
        {initial &&
          initial.notes.trim() !== notes.trim() &&
          initial.generation && (
            <p className="notice">
              Changing notes will mark your study materials outdated. Quiz
              history is kept.
            </p>
          )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <span className="small muted">
            <ShieldCheck size={15} /> Saved on this device
          </span>
          <div className="button-row">
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={importing || pdfPending}
              type="submit"
            >
              {initial ? "Save changes" : "Create study set"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function SetupDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Give your notes a little AI help" onClose={onClose}>
      <div className="setup-icon">
        <Terminal size={26} />
      </div>
      <p>
        You can create and edit notes right now. To generate study materials,
        connect the Python server to OpenAI:
      </p>
      <ol className="setup-steps">
        <li>
          Copy <code>.env.example</code> to <code>.env</code> in the project
          folder.
        </li>
        <li>
          Replace the placeholder with your OpenAI API key. Choose your model
          using <code>OPENAI_MODEL</code>.
        </li>
        <li>Restart the Python server, then refresh this page.</li>
      </ol>
      <div className="notice">
        <ShieldCheck size={19} />
        <span>
          Your API key stays on the server. When you generate, your selected
          notes, title, and subject are sent to OpenAI. API usage may have a
          cost.
        </span>
      </div>
      <p className="small muted">
        The README has the complete setup commands. No API key is needed to
        manage your notes.
      </p>
      <div className="modal-footer end">
        <button className="button primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  );
}

export function SourcesDialog({
  notes,
  selected,
  onClose,
  outdated,
}: {
  notes: string;
  selected: number;
  onClose: () => void;
  outdated: boolean;
}) {
  useEffect(() => {
    requestAnimationFrame(() =>
      document
        .getElementById(`paragraph-${selected}`)
        ?.scrollIntoView({ block: "center" }),
    );
  }, [selected]);
  return (
    <Modal
      title={outdated ? "Source notes · saved version" : "Your source notes"}
      onClose={onClose}
      wide
    >
      <p className="muted modal-intro">
        <FileText size={16} /> Blank lines define paragraphs. Source labels link
        back here.
      </p>
      {outdated && (
        <p className="notice">
          These are the notes used for the saved materials. Your current notes
          have changed.
        </p>
      )}
      <div className="source-paragraphs">
        {paragraphs(notes).map((p, i) => (
          <div
            key={i}
            id={`paragraph-${i + 1}`}
            className={`source-paragraph ${selected === i + 1 ? "highlight" : ""}`}
          >
            <span className="paragraph-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p>{p}</p>
          </div>
        ))}
      </div>
      <div className="modal-footer end">
        <button className="button secondary" onClick={onClose}>
          Back to studying
        </button>
      </div>
    </Modal>
  );
}
