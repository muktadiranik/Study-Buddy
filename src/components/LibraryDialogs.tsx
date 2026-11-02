import { useState } from "react";
import { Download, FolderPlus, Upload } from "lucide-react";
import { Modal } from "./Dialogs";
import {
  MAX_BACKUP_BYTES,
  parseBackup,
  serializeBackup,
  type RestoreMode,
} from "../lib/backup";
import { makeLibrary } from "../lib/storage";
import type { Folder, Library, StudySet } from "../lib/models";

export function BackupDialog({
  sets,
  folders,
  onClose,
  onRestore,
  busy,
}: {
  sets: StudySet[];
  folders: Folder[];
  onClose: () => void;
  onRestore: (library: Library, mode: RestoreMode) => string | null;
  busy: boolean;
}) {
  const [incoming, setIncoming] = useState<Library | null>(null);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function download() {
    try {
      const contents = serializeBackup(makeLibrary(sets, folders));
      const url = URL.createObjectURL(
        new Blob([contents], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `study-buddy-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Backup download started. Keep the file somewhere safe.");
      setError("");
    } catch {
      setError(
        "A backup could not be created. Check your current library and try again.",
      );
    }
  }
  async function readFile(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    setIncoming(null);
    setConfirmed(false);
    setReading(true);
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("Choose a backup smaller than 20 MB.");
      setIncoming(parseBackup(await file.text()));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setReading(false);
    }
  }
  return (
    <Modal title="Backup and restore" onClose={onClose} wide>
      <p className="muted modal-intro">
        Keep a copy of your notes, folders, tags, generated materials, quiz
        history, and review schedule. Server API settings are not included.
      </p>
      <section className="backup-section">
        <h3>Download your library</h3>
        <p className="small muted">
          {sets.length} study sets · {folders.length} folders. The JSON file
          stays on your device.
        </p>
        <button className="button primary" onClick={download}>
          <Download size={16} />
          Download backup
        </button>
      </section>
      <section className="backup-section">
        <h3>Restore from a file</h3>
        <p className="small muted">
          The entire file is validated before anything changes. Maximum file
          size: 20 MB.
        </p>
        <label className="import-button backup-file">
          <Upload size={16} />
          {reading ? "Checking backup…" : "Choose backup file"}
          <input
            aria-label="Choose backup file"
            type="file"
            accept=".json,application/json"
            disabled={reading}
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {incoming && (
          <div className="restore-preview">
            <h4>Backup preview</h4>
            <p>
              {incoming.sets.length} study sets · {incoming.folders.length}{" "}
              folders ·{" "}
              {incoming.sets.reduce(
                (n, s) => n + Object.keys(s.cardSchedule).length,
                0,
              )}{" "}
              scheduled cards
            </p>
            <fieldset>
              <legend>How should this backup be restored?</legend>
              <label>
                <input
                  type="radio"
                  name="restore-mode"
                  checked={mode === "merge"}
                  onChange={() => {
                    setMode("merge");
                    setConfirmed(false);
                  }}
                />{" "}
                Merge: add missing sets and keep existing versions
              </label>
              <label>
                <input
                  type="radio"
                  name="restore-mode"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                />{" "}
                Replace: use only the library in this backup
              </label>
            </fieldset>
            {mode === "merge" && (
              <p className="small muted">
                Matching set IDs are skipped, including edits and progress saved
                on this device.
              </p>
            )}
            {mode === "replace" && (
              <label className="confirm-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I understand this replaces all study sets and progress currently
                on this device.
              </label>
            )}
            {busy && (
              <p className="notice">
                Let the current AI generation finish before restoring a backup.
              </p>
            )}
            <button
              className={`button ${mode === "replace" ? "danger" : "primary"}`}
              disabled={busy || reading || (mode === "replace" && !confirmed)}
              onClick={() => {
                const failure = onRestore(incoming, mode);
                if (failure) setError(failure);
                else onClose();
              }}
            >
              Restore backup
            </button>
          </div>
        )}
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-footer end">
        <button className="button secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

export function FoldersDialog({
  folders,
  sets,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: Folder[];
  sets: StudySet[];
  onClose: () => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState(folders[0]?.id ?? "");
  const [rename, setRename] = useState(folders[0]?.name ?? "");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  function act(action: () => void) {
    try {
      action();
      setError("");
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <Modal title="Organize your folders" onClose={onClose}>
      <p className="muted modal-intro">
        Create a folder for a course, chapter, or exam. Choose a folder and tags
        when you edit a study set.
      </p>
      <form
        className="folder-create"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => {
            onCreate(newName);
            setNewName("");
          });
        }}
      >
        <label>
          New folder name
          <input
            required
            maxLength={50}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Biology final"
          />
        </label>
        <button className="button primary">
          <FolderPlus size={16} />
          Create folder
        </button>
      </form>
      {folders.length > 0 ? (
        <div className="folder-manage">
          <label>
            Folder to manage
            <select
              aria-label="Folder to manage"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setRename(folders.find((f) => f.id === e.target.value)!.name);
                setDeleting(false);
              }}
            >
              <option value="" disabled>
                Choose a folder
              </option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name} (
                  {sets.filter((set) => set.folderId === folder.id).length})
                </option>
              ))}
            </select>
          </label>
          {selected && folders.some((folder) => folder.id === selected) && (
            <>
              <label>
                Rename folder
                <input
                  maxLength={50}
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                />
              </label>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() => act(() => onRename(selected, rename))}
                >
                  Save folder name
                </button>
                <button
                  className="button secondary"
                  onClick={() => setDeleting(true)}
                >
                  Remove folder
                </button>
              </div>
              {deleting && (
                <div className="notice folder-confirm">
                  <p>
                    Remove this folder? Its study sets will move to Unfiled.
                    Notes and progress will be kept.
                  </p>
                  <div className="button-row">
                    <button
                      className="button danger"
                      onClick={() =>
                        act(() => {
                          onDelete(selected);
                          setSelected("");
                          setRename("");
                          setDeleting(false);
                        })
                      }
                    >
                      Confirm remove folder
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setDeleting(false)}
                    >
                      Keep folder
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="small muted">
          No folders yet. Your study sets are currently Unfiled.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-footer end">
        <button className="button secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
