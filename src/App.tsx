import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  Leaf,
  LoaderCircle,
  RotateCcw,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  TrendingUp,
  X,
  Download,
} from "lucide-react";
import { BackupDialog, FoldersDialog } from "./components/LibraryDialogs";
import { prepareRestore, type RestoreMode } from "./lib/backup";
import { filterStudySets, validateFolderName } from "./lib/organization";
import { dueCardIndices } from "./lib/repetition";
import {
  Editor,
  Modal,
  SetupDialog,
  SourcesDialog,
} from "./components/Dialogs";
import { Citations, Flashcards, Progress, Quiz } from "./components/Practice";
import { generateStudyMaterials } from "./lib/api";
import {
  MAX_STUDY_SETS,
  paragraphs,
  type StudySet,
  type Tab,
  type Folder,
  type Library,
} from "./lib/models";
import { isExampleStudySet } from "./lib/seeds";
import { sampleSet } from "./lib/sample";
import { loadStudySets, makeLibrary, saveLibrary } from "./lib/storage";
import { formatDate, isOutdated, masteredCount, scoreQuiz } from "./lib/study";

const tabs: Tab[] = ["Summary", "Flashcards", "Quiz", "Progress"];
const tabIcons = [FileText, Layers, GraduationCap, TrendingUp];
type Server = "checking" | "enabled" | "disabled" | "offline";

function NotebookArt() {
  return (
    <svg
      className="notebook-art"
      viewBox="0 0 300 235"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="158" cy="118" r="91" fill="#e8eddf" />
      <circle cx="234" cy="52" r="5" fill="#c6d6bb" />
      <path
        d="m59 155-14 3m19 12-8 10M235 170l11 10m-4-20 13 2"
        stroke="#b7c7a8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g transform="rotate(-9 150 120)">
        <rect x="78" y="40" width="130" height="169" rx="9" fill="#cad8bf" />
        <rect
          x="88"
          y="30"
          width="130"
          height="169"
          rx="8"
          fill="#fffef7"
          stroke="#c7d3bd"
          strokeWidth="1.5"
        />
        <path d="M112 31v168" stroke="#e3e8d9" />
        <path
          d="M131 74h60m-60 15h48m-48 28h60m-60 15h52m-52 15h59m-59 15h35"
          stroke="#c5ceb9"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="m99 51-17 0m17 25H82m17 25H82m17 25H82m17 25H82m17 25H82"
          stroke="#6d8872"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M204 202c-2-36 13-64 30-87m-23 50c-25-5-29-20-26-32 20 5 28 16 26 32Zm13-29c-1-19 10-31 24-32 2 18-9 30-24 32Zm-16 44c16 1 29-7 34-21-18-4-30 5-34 21Z"
        stroke="#628061"
        strokeWidth="2"
        fill="#9fb792"
        strokeLinejoin="round"
      />
      <path d="m230 42 2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8Z" fill="#b79c60" />
    </svg>
  );
}

function Summary({
  set,
  loading,
  onGenerate,
  onSource,
  onEdit,
}: {
  set: StudySet;
  loading: boolean;
  onGenerate: () => void;
  onSource: (n: number, current?: boolean) => void;
  onEdit: () => void;
}) {
  const g = set.generation,
    m = g?.materials;
  return (
    <div className="summary-grid">
      <div className="summary-main">
        {!m ? (
          <>
            <div className="panel generate-empty">
              <NotebookArt />
              <div className="empty-copy">
                <span className="eyebrow">FROM NOTES TO KNOW-HOW</span>
                <h2>
                  Good notes.
                  <br />
                  Deeper understanding.
                </h2>
                <p className="muted">
                  Turn what you’ve written into something that sticks. A clear
                  summary, flashcards, and a little practice — all from your
                  notes.
                </p>
                <button
                  className="button primary"
                  disabled={loading}
                  onClick={onGenerate}
                >
                  {loading ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Sparkles size={17} />
                  )}
                  {loading
                    ? "Finding the key ideas…"
                    : "Generate study materials"}
                  {!loading && <ArrowRight size={16} />}
                </button>
                <p className="privacy-line">
                  <ShieldCheck size={13} /> Your selected notes are sent to
                  OpenAI.
                </p>
              </div>
            </div>
            <div className="how-cards">
              {[
                {
                  icon: FileText,
                  color: "sage",
                  title: "See the big picture",
                  text: "Clear summaries, key ideas, and definitions.",
                },
                {
                  icon: Layers,
                  color: "lavender",
                  title: "Make it stick",
                  text: "Simple flashcards that build your recall.",
                },
                {
                  icon: GraduationCap,
                  color: "peach",
                  title: "Find your gaps",
                  text: "Practice questions with helpful explanations.",
                },
              ].map((item) => (
                <div className="how-card" key={item.title}>
                  <span className={`small-icon ${item.color}`}>
                    <item.icon size={18} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </>
        ) : m.status === "insufficient" ? (
          <div className="panel insufficient">
            <span className="round-icon peach">
              <FileText size={25} />
            </span>
            <h2>A little more detail will help.</h2>
            <p className="muted">{m.message}</p>
            <button className="button primary" onClick={onEdit}>
              <Pencil size={16} />
              Add to your notes
            </button>
          </div>
        ) : (
          <>
            <article className="panel summary-card">
              <div className="section-heading">
                <h2>
                  <span className="small-icon sage">
                    <FileText size={18} />
                  </span>
                  The big picture
                </h2>
                <span className="tiny-badge">From your notes</span>
              </div>
              <div className="summary-points">
                {m.summary.map((p, i) => (
                  <p key={i}>
                    {p.text}{" "}
                    <Citations sources={p.sources} onSource={onSource} />
                  </p>
                ))}
              </div>
              <div className="generated-foot">
                <Sparkles size={13} /> Generated {formatDate(g!.createdAt)} ·
                Check source references for accuracy
              </div>
            </article>
            {m.concepts.length > 0 && (
              <article className="panel concepts-card">
                <h2>
                  <span className="small-icon peach">
                    <Sparkles size={18} />
                  </span>
                  Key concepts
                </h2>
                <ul className="concepts-list">
                  {m.concepts.map((p, i) => (
                    <li key={i}>
                      <span className="concept-dot" />
                      <div>
                        {p.text}{" "}
                        <Citations sources={p.sources} onSource={onSource} />
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            )}
            {m.definitions.length > 0 && (
              <article className="panel definitions-card">
                <h2>
                  <span className="small-icon lavender">
                    <BookOpen size={18} />
                  </span>
                  Words to know
                </h2>
                <dl>
                  {m.definitions.map((p, i) => (
                    <div key={i}>
                      <dt>{p.term}</dt>
                      <dd>
                        {p.meaning}{" "}
                        <Citations sources={p.sources} onSource={onSource} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            )}
            <p className="small muted ai-message">
              <CircleHelp size={15} />
              {m.message}
            </p>
          </>
        )}
      </div>
      <aside className="notes-panel panel">
        <div className="section-heading">
          <h3>
            <FileText size={17} />
            Your notes
          </h3>
          <button
            className="icon-button"
            aria-label="Edit source notes"
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
        </div>
        <p className="small muted">The source of your next big idea.</p>
        <div className="note-meta">
          <span>{paragraphs(set.notes).length} paragraphs</span>
          <span>{set.notes.split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <div className="notes-preview">
          {paragraphs(set.notes)
            .slice(0, 3)
            .map((p, i) => (
              <div key={i}>
                <span className="paragraph-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p>{p}</p>
              </div>
            ))}
        </div>
        <button
          className="text-button view-notes"
          onClick={() => onSource(1, true)}
        >
          Read all notes <ArrowRight size={15} />
        </button>
        <div className="source-tip">
          <ShieldCheck size={16} />
          <p>
            Every generated idea links back to a numbered paragraph in your
            notes.
          </p>
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const loaded = loadStudySets(window.localStorage);
      if (loaded.writable)
        loaded.warning =
          saveLibrary(
            window.localStorage,
            makeLibrary(loaded.sets, loaded.folders),
          ) ?? "";
      return loaded;
    } catch {
      return {
        sets: [sampleSet()],
        folders: [] as Folder[],
        warning:
          "Browser storage is blocked. Changes in this session will not survive a refresh.",
        writable: false,
      };
    }
  });
  const dataRef = useRef(data); // Async generation must always update the latest set, not an old snapshot.
  const [selected, setSelected] = useState(data.sets[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("Summary");
  const [search, setSearch] = useState("");
  const [libraryLimit, setLibraryLimit] = useState(40);
  const [folderFilter, setFolderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [editor, setEditor] = useState<StudySet | "new" | null>(null);
  const [setup, setSetup] = useState(false);
  const [deleting, setDeleting] = useState<StudySet | null>(null);
  const [source, setSource] = useState<{
    notes: string;
    selected: number;
    outdated: boolean;
  } | null>(null);
  const [server, setServer] = useState<Server>("checking");
  const [serverCheck, setServerCheck] = useState(0);
  const [generating, setGenerating] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const active = data.sets.find((s) => s.id === selected) ?? data.sets[0];
  const outdated = active ? isOutdated(active) : false;
  const reviews = data.sets.reduce(
    (n, s) => n + dueCardIndices(s, now).length,
    0,
  );
  const mastered = data.sets.reduce((n, s) => n + masteredCount(s), 0);
  const allAttempts = data.sets
    .flatMap((s) => s.attempts)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recent = allAttempts.slice(0, 5);
  const average = recent.length
    ? Math.round(
        recent.reduce(
          (n, a) => n + scoreQuiz(a.questions, a.answers).percent,
          0,
        ) / recent.length,
      )
    : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/status", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setServer(d.ai_enabled ? "enabled" : "disabled"))
      .catch(() => {
        if (!abort.signal.aborted) setServer("offline");
      });
    return () => abort.abort();
  }, [serverCheck]);

  function commit(sets: StudySet[], folders = dataRef.current.folders) {
    const current = dataRef.current;
    let warning = current.warning;
    if (current.writable) {
      try {
        warning =
          saveLibrary(window.localStorage, makeLibrary(sets, folders)) ?? "";
      } catch {
        warning =
          "Browser storage is now blocked. Keep this tab open and copy your notes somewhere safe.";
      }
    }
    const next = { ...current, sets, folders, warning };
    dataRef.current = next;
    setData(next);
  }
  function updateSet(id: string, changes: Partial<StudySet>) {
    commit(
      dataRef.current.sets.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    );
  }
  function restoreBackup(incoming: Library, mode: RestoreMode): string | null {
    if (generating)
      return "Wait for the current generation to finish before restoring.";
    const current = dataRef.current;
    if (!current.writable && mode === "merge")
      return "Current saved data is unreadable. Choose Replace and confirm to recover from this backup.";
    try {
      const result = prepareRestore(
        makeLibrary(current.sets, current.folders),
        incoming,
        mode,
      );
      const failure = saveLibrary(window.localStorage, result.library);
      if (failure) return `${failure} Nothing has been restored.`;
      const next = {
        sets: result.library.sets,
        folders: result.library.folders,
        warning: "",
        writable: true,
      };
      dataRef.current = next;
      setData(next);
      setSelected(next.sets[0]?.id ?? "");
      setTab("Summary");
      clearFilters();
      setNotice(
        mode === "merge"
          ? `Restored ${result.added} study sets. Kept ${result.skipped} matching sets already on this device.`
          : `Replaced the library with ${next.sets.length} study sets from your backup.`,
      );
      return null;
    } catch {
      return "The backup could not be restored. Check that the combined library has at most 1,000 sets and 100 folders. Nothing has been changed.";
    }
  }
  function clearFilters() {
    setSearch("");
    setFolderFilter("all");
    setTagFilter("");
    setDueOnly(false);
    setLibraryLimit(40);
  }
  function createFolder(name: string) {
    const folders = dataRef.current.folders;
    if (folders.length >= 100)
      throw new Error("You can create up to 100 folders.");
    commit(dataRef.current.sets, [
      ...folders,
      { id: crypto.randomUUID(), name: validateFolderName(name, folders) },
    ]);
  }
  function renameFolder(id: string, name: string) {
    const folders = dataRef.current.folders;
    const valid = validateFolderName(name, folders, id);
    commit(
      dataRef.current.sets,
      folders.map((folder) =>
        folder.id === id ? { ...folder, name: valid } : folder,
      ),
    );
  }
  function removeFolder(id: string) {
    commit(
      dataRef.current.sets.map((set) =>
        set.folderId === id ? { ...set, folderId: null } : set,
      ),
      dataRef.current.folders.filter((folder) => folder.id !== id),
    );
    if (folderFilter === id) setFolderFilter("all");
  }
  function openSource(n: number, current = false) {
    if (active)
      setSource({
        notes: current
          ? active.notes
          : (active.generation?.notes ?? active.notes),
        selected: n,
        outdated: !current && outdated,
      });
  }
  async function generate() {
    if (!active) return;
    if (generating) {
      setNotice(
        "A study set is already generating. Let it finish before starting another.",
      );
      return;
    }
    if (active.generation && !outdated) {
      setNotice(
        "These materials are already saved. Explore the tabs to study them.",
      );
      return;
    }
    if (server === "disabled") {
      setSetup(true);
      return;
    }
    const snapshot = active;
    setGenerating(snapshot.id);
    setNotice("");
    try {
      const generation = await generateStudyMaterials(snapshot);
      const current = dataRef.current.sets.find((s) => s.id === snapshot.id);
      if (current) {
        updateSet(snapshot.id, {
          generation,
          cardReviews: {},
          cardSchedule: {},
          quizDraft: null,
        });
        if (current.notes !== snapshot.notes)
          setNotice(
            "Materials were generated from your earlier notes. Generate again to use your latest edits.",
          );
      }
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Generation failed. Please try again.",
      );
    } finally {
      setGenerating(null);
    }
  }
  function saveEditor(
    value: Pick<StudySet, "title" | "subject" | "notes" | "folderId" | "tags">,
  ) {
    const now = new Date().toISOString();
    if (editor && editor !== "new")
      updateSet(editor.id, {
        ...value,
        updatedAt: now,
        ...(value.notes !== editor.notes ? { quizDraft: null } : {}),
      });
    else {
      if (dataRef.current.sets.length >= MAX_STUDY_SETS) {
        setNotice(
          `This browser has reached ${MAX_STUDY_SETS.toLocaleString()} study sets. Delete an unused set before adding another.`,
        );
        return;
      }
      const created: StudySet = {
        ...value,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        generation: null,
        cardReviews: {},
        cardSchedule: {},
        attempts: [],
        quizDraft: null,
      };
      commit([...dataRef.current.sets, created]);
      setSelected(created.id);
      setTab("Summary");
    }
    setEditor(null);
  }
  const tags = [...new Set(data.sets.flatMap((set) => set.tags))].sort();
  const hasFilters =
    !!search || folderFilter !== "all" || !!tagFilter || dueOnly;
  const filtered = filterStudySets(data.sets, data.folders, {
    search,
    folder: folderFilter,
    tag: tagFilter,
    dueOnly,
    now,
  }).sort(
    (a, b) => Number(isExampleStudySet(a.id)) - Number(isExampleStudySet(b.id)),
  );
  // Avoid rendering hundreds of off-screen controls. Personal notes appear first.
  const visibleSets = filtered.slice(0, libraryLimit);
  const selectedMatch = filtered.find((s) => s.id === active?.id);
  if (selectedMatch && !visibleSets.some((s) => s.id === selectedMatch.id)) {
    visibleSets.unshift(selectedMatch);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to study workspace
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <BookOpen size={24} strokeWidth={1.7} />
          </span>
          <div>
            <strong>
              Study Buddy<span className="ai-tag">AI</span>
            </strong>
            <span>A little help. A lot of learning.</span>
          </div>
        </div>
        <button
          className="button primary new-set"
          onClick={() => setEditor("new")}
        >
          <Plus size={18} />
          New study set<span className="plus-shortcut">+</span>
        </button>
        <div className="library-tools">
          <button
            className="button secondary"
            onClick={() => setFoldersOpen(true)}
          >
            <FolderOpen size={14} />
            Folders
          </button>
          <button
            className="button secondary"
            onClick={() => setBackupOpen(true)}
          >
            <Download size={14} />
            Backup / restore
          </button>
        </div>
        <div className="library-label">
          <span>YOUR LIBRARY</span>
          <span>{data.sets.length.toString().padStart(2, "0")}</span>
        </div>
        <label className="search">
          <Search size={16} />
          <input
            placeholder="Find a study set…"
            aria-label="Search study sets"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLibraryLimit(40);
            }}
          />
          {search && (
            <button
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                setLibraryLimit(40);
              }}
            >
              <X size={14} />
            </button>
          )}
        </label>
        <div className="library-filters">
          <label>
            Folder
            <select
              aria-label="Filter by folder"
              value={folderFilter}
              onChange={(e) => {
                setFolderFilter(e.target.value);
                setLibraryLimit(40);
              }}
            >
              <option value="all">All folders</option>
              <option value="unfiled">Unfiled</option>
              {data.folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag
            <select
              aria-label="Filter by tag"
              value={tagFilter}
              onChange={(e) => {
                setTagFilter(e.target.value);
                setLibraryLimit(40);
              }}
            >
              <option value="">All tags</option>
              {tagFilter && !tags.includes(tagFilter) && (
                <option value={tagFilter}>{tagFilter}</option>
              )}
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="due-filter">
            <input
              type="checkbox"
              checked={dueOnly}
              onChange={(e) => {
                setDueOnly(e.target.checked);
                setLibraryLimit(40);
              }}
            />
            Due cards only
          </label>
          {hasFilters && (
            <button className="text-button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
        {filtered.length > visibleSets.length && (
          <div className="library-pagination">
            <span>
              Showing {visibleSets.length} of {filtered.length}
            </span>
            <button onClick={() => setLibraryLimit((n) => n + 40)}>
              Show more study sets
            </button>
          </div>
        )}
        <nav className="study-list" aria-label="Study sets">
          {visibleSets.map((s) => (
            <button
              key={s.id}
              className={`study-list-item ${active?.id === s.id ? "active" : ""}`}
              aria-current={active?.id === s.id ? "true" : undefined}
              onClick={() => {
                setSelected(s.id);
                setTab("Summary");
                setNotice("");
              }}
            >
              <span className="set-icon">
                <BookOpen size={18} />
              </span>
              <span className="set-item-copy">
                <strong>{s.title}</strong>
                <span>
                  {s.subject}
                  {isExampleStudySet(s.id) && " · Example set"}
                </span>
              </span>
              {active?.id === s.id && <span className="active-dot" />}
            </button>
          ))}
          {!filtered.length && (
            <div className="library-empty">
              <FolderOpen size={25} />
              <p>
                {hasFilters ? "No matching sets." : "Your library starts here."}
              </p>
              <span>
                {hasFilters
                  ? "Try a different title or subject."
                  : "Add your first set of notes."}
              </span>
            </div>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="study-tip">
            <span className="tip-icon">
              <Sprout size={27} strokeWidth={1.5} />
            </span>
            <h3>
              Little by little,
              <br />a little becomes a lot.
            </h3>
            <p>
              You don’t have to learn it all today. Just take the next step.
            </p>
          </div>
          <div className="sidebar-footer">
            <span>
              <ShieldCheck size={15} />
              Personal workspace
            </span>
            <button
              aria-label="AI setup and privacy information"
              onClick={() => setSetup(true)}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>My workspace</span>
            <ChevronRight size={13} />
            <strong>{active?.subject ?? "Your library"}</strong>
          </div>
          <span className={`local-badge ${data.warning ? "unsaved" : ""}`}>
            <span />
            {data.warning ? "Changes may not be saved" : "Saved on this device"}
          </span>
        </header>
        <div className="page-content">
          <section className="welcome">
            <div>
              <div className="eyebrow">
                <span className="welcome-spark">✳</span> YOUR SPACE TO
                UNDERSTAND
              </div>
              <h1>
                Small steps. <span>Bright ideas.</span>
              </h1>
              <p>A calmer way to turn your notes into knowledge.</p>
            </div>
            <div className="welcome-decoration" aria-hidden="true">
              <Leaf size={23} strokeWidth={1} />
              <span>Learn at your own pace.</span>
            </div>
          </section>
          <section className="overview-stats" aria-label="Your study activity">
            <div>
              <span className="small-icon sage">
                <FolderOpen size={18} />
              </span>
              <span>
                <strong>{data.sets.length}</strong>
                <span>Study {data.sets.length === 1 ? "set" : "sets"}</span>
              </span>
            </div>
            <div>
              <span className="small-icon lavender">
                <Layers size={18} />
              </span>
              <span>
                <strong>{mastered}</strong>
                <span>Cards you know</span>
              </span>
            </div>
            <div>
              <span className="small-icon peach">
                <TrendingUp size={18} />
              </span>
              <span>
                <strong>{average === null ? "—" : `${average}%`}</strong>
                <span>
                  Recent quiz average{" "}
                  <span className="stat-detail">
                    {recent.length
                      ? `· last ${recent.length}`
                      : "· no activity yet"}
                  </span>
                </span>
              </span>
            </div>
            <div>
              <span className="small-icon cream">
                <RotateCcw size={18} />
              </span>
              <span>
                <strong>{reviews}</strong>
                <span>Cards due for review</span>
              </span>
            </div>
          </section>
          {data.warning && (
            <div className="notice storage-warning" role="alert">
              <ShieldCheck size={18} />
              <span>{data.warning}</span>
            </div>
          )}
          {server === "disabled" && (
            <div className="setup-banner">
              <span className="small-icon cream">
                <Sparkles size={16} />
              </span>
              <p>
                <strong>Your notes are ready. Enable AI when you are.</strong>
                <span>
                  {" "}
                  Connect OpenAI to bring your study materials to life.
                </span>
              </p>
              <button onClick={() => setSetup(true)}>
                Set up AI <ArrowRight size={15} />
              </button>
            </div>
          )}
          {server === "offline" && (
            <div className="notice server-warning">
              <span>
                The Python server is offline. Notes still work. Start the
                backend to enable AI.
              </span>
              <button
                className="text-button"
                onClick={() => setServerCheck((n) => n + 1)}
              >
                Check again
              </button>
            </div>
          )}
          {notice && (
            <div className="notice app-notice" role="alert">
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {active ? (
            <section className="workspace" id="workspace" tabIndex={-1}>
              <div className="workspace-heading">
                <div>
                  <div className="set-heading-meta">
                    <span className="subject-tag">{active.subject}</span>
                    {isExampleStudySet(active.id) && (
                      <span className="sample-tag">Example study set</span>
                    )}
                  </div>
                  <h2>{active.title}</h2>
                  <p className="small muted">
                    {active.notes.split(/\s+/).filter(Boolean).length} words{" "}
                    <span className="separator">·</span> Updated{" "}
                    {formatDate(active.updatedAt)}{" "}
                    <span className="separator">·</span>{" "}
                    {active.generation
                      ? outdated
                        ? "Materials need updating"
                        : "Materials saved"
                      : "Ready to explore"}
                  </p>
                  <div className="set-tags">
                    {active.folderId && (
                      <span>
                        <FolderOpen size={12} />
                        {
                          data.folders.find(
                            (folder) => folder.id === active.folderId,
                          )?.name
                        }
                      </span>
                    )}
                    {active.tags.map((tag) => (
                      <button
                        key={tag}
                        aria-label={`Filter by tag ${tag}`}
                        onClick={() => {
                          setTagFilter(tag);
                          setLibraryLimit(40);
                        }}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="workspace-actions">
                  <button
                    className="button secondary compact"
                    onClick={() => setEditor(active)}
                  >
                    <Pencil size={15} />
                    Edit notes
                  </button>
                  <button
                    className="icon-button delete-button"
                    title="Delete study set"
                    aria-label="Delete study set"
                    onClick={() => setDeleting(active)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
              <div className="tabs-line">
                <div className="tabs" role="tablist" aria-label="Study tools">
                  {tabs.map((name, i) => {
                    const Icon = tabIcons[i];
                    return (
                      <button
                        role="tab"
                        id={`tab-${name}`}
                        aria-controls="study-panel"
                        aria-selected={tab === name}
                        tabIndex={tab === name ? 0 : -1}
                        key={name}
                        className={tab === name ? "selected" : ""}
                        onClick={() => setTab(name)}
                        onKeyDown={(e) => {
                          let next = i;
                          if (e.key === "ArrowRight")
                            next = (i + 1) % tabs.length;
                          else if (e.key === "ArrowLeft")
                            next = (i + 3) % tabs.length;
                          else if (e.key === "Home") next = 0;
                          else if (e.key === "End") next = 3;
                          else return;
                          e.preventDefault();
                          setTab(tabs[next]);
                          document.getElementById(`tab-${tabs[next]}`)?.focus();
                        }}
                      >
                        <Icon size={17} />
                        {name}
                        {name === "Flashcards" &&
                        active.generation?.materials.flashcards.length ? (
                          <span className="tab-count">
                            {active.generation.materials.flashcards.length}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {active.generation && (
                  <span className="material-status">
                    <Check size={13} />
                    {outdated ? "Update needed" : "Saved materials"}
                  </span>
                )}
              </div>
              {outdated && (
                <div className="notice outdated-notice">
                  <span>
                    Your notes have changed. The saved materials below use an
                    earlier version. Update them before practicing.
                  </span>
                  <button
                    className="button primary compact"
                    disabled={!!generating}
                    onClick={() => void generate()}
                  >
                    {generating === active.id ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : (
                      <Sparkles size={15} />
                    )}
                    Update materials
                  </button>
                </div>
              )}
              {generating === active.id && (
                <div className="generation-loading" role="status">
                  <LoaderCircle className="spin" size={18} />
                  <span>
                    Reading your notes and connecting the ideas. This can take
                    about a minute…
                  </span>
                </div>
              )}
              <div
                id="study-panel"
                role="tabpanel"
                aria-labelledby={`tab-${tab}`}
                tabIndex={0}
                key={`${active.id}-${active.generation?.id ?? "empty"}`}
              >
                {tab === "Summary" && (
                  <Summary
                    set={active}
                    loading={generating === active.id}
                    onGenerate={() => void generate()}
                    onSource={openSource}
                    onEdit={() => setEditor(active)}
                  />
                )}
                {tab === "Progress" && (
                  <Progress
                    set={active}
                    now={now}
                    onReview={() => setTab("Flashcards")}
                    onQuiz={() => setTab("Quiz")}
                  />
                )}
                {(tab === "Flashcards" || tab === "Quiz") &&
                  (active.generation?.materials.status === "ready" &&
                  !outdated ? (
                    tab === "Flashcards" ? (
                      <Flashcards
                        set={active}
                        now={now}
                        onUpdate={(c) => updateSet(active.id, c)}
                        onSource={openSource}
                      />
                    ) : (
                      <Quiz
                        set={active}
                        onUpdate={(c) => updateSet(active.id, c)}
                        onSource={openSource}
                      />
                    )
                  ) : (
                    <div className="panel practice-intro">
                      <span className="round-icon sage">
                        {tab === "Flashcards" ? (
                          <Layers size={26} />
                        ) : (
                          <GraduationCap size={26} />
                        )}
                      </span>
                      <p className="eyebrow">START WITH YOUR NOTES</p>
                      <h2>
                        {outdated
                          ? "Bring your practice up to date."
                          : "Your next study session starts here."}
                      </h2>
                      <p className="muted">
                        {active.generation?.materials.status ===
                          "insufficient" && !outdated
                          ? active.generation.materials.message
                          : "Generate study materials from your notes, then come back to practice."}
                      </p>
                      <button
                        className="button primary"
                        disabled={!!generating}
                        onClick={() =>
                          active.generation?.materials.status ===
                            "insufficient" && !outdated
                            ? setEditor(active)
                            : void generate()
                        }
                      >
                        <Sparkles size={17} />
                        {active.generation?.materials.status ===
                          "insufficient" && !outdated
                          ? "Add more notes"
                          : outdated
                            ? "Update study materials"
                            : "Generate study materials"}
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          ) : (
            <section className="panel no-sets" id="workspace">
              <span className="round-icon sage">
                <BookOpen size={27} />
              </span>
              <h2>A fresh page for a new idea.</h2>
              <p className="muted">
                Add your notes and make space for a little learning.
              </p>
              <button
                className="button primary"
                onClick={() => setEditor("new")}
              >
                <Plus size={18} />
                Create your first study set
              </button>
            </section>
          )}
          <footer className="page-footer">
            <span>
              <Sprout size={15} />A little progress, every day.
            </span>
            <span>Made for your mind. Saved in your browser.</span>
          </footer>
        </div>
      </main>
      {editor && (
        <Editor
          initial={editor === "new" ? null : editor}
          folders={data.folders}
          onSave={saveEditor}
          onClose={() => setEditor(null)}
        />
      )}
      {setup && <SetupDialog onClose={() => setSetup(false)} />}
      {backupOpen && (
        <BackupDialog
          sets={data.sets}
          folders={data.folders}
          busy={!!generating}
          onRestore={restoreBackup}
          onClose={() => setBackupOpen(false)}
        />
      )}
      {foldersOpen && (
        <FoldersDialog
          folders={data.folders}
          sets={data.sets}
          onClose={() => setFoldersOpen(false)}
          onCreate={createFolder}
          onRename={renameFolder}
          onDelete={removeFolder}
        />
      )}
      {source && <SourcesDialog {...source} onClose={() => setSource(null)} />}
      {deleting && (
        <Modal title="Delete this study set?" onClose={() => setDeleting(null)}>
          <p>
            <strong>{deleting.title}</strong> and its notes, materials, and
            practice history will be removed from this browser.
          </p>
          <p className="small muted">This cannot be undone.</p>
          <div className="modal-footer end">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              Keep study set
            </button>
            <button
              className="button danger"
              onClick={() => {
                commit(
                  dataRef.current.sets.filter((s) => s.id !== deleting.id),
                );
                setDeleting(null);
                setTab("Summary");
              }}
            >
              Delete study set
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
