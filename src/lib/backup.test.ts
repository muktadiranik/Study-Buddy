import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/materials.json";
import { MAX_STUDY_SETS, generationSchema, librarySchema } from "./models";
import { parseBackup, prepareRestore, serializeBackup } from "./backup";
import { scheduleReview } from "./repetition";
import { sampleSet } from "./sample";
import {
  loadStudySets,
  makeLibrary,
  saveLibrary,
  STORAGE_KEY,
} from "./storage";

function library() {
  const set = sampleSet();
  set.folderId = "biology";
  set.tags = ["exam", "chapter-1"];
  set.generation = generationSchema.parse({
    id: "g",
    notes: set.notes,
    createdAt: set.createdAt,
    materials: fixture,
  });
  set.cardReviews = { "0": "got-it" };
  set.cardSchedule = {
    "0": scheduleReview(
      undefined,
      "got-it",
      Date.parse("2026-11-02T00:00:00Z"),
    ),
  };
  set.quizDraft = {
    generationId: "g",
    kind: "full",
    indices: [0, 1],
    answers: [0, null],
  };
  set.attempts = [
    {
      id: "a",
      generationId: "g",
      createdAt: set.createdAt,
      kind: "full",
      questions: set.generation.materials.quiz,
      answers: [3, 1],
    },
  ];
  return makeLibrary([set], [{ id: "biology", name: "Biology final" }]);
}

describe("backup and restore", () => {
  it("round-trips the whole library, including organization, AI output, drafts and schedules", () => {
    const original = library();
    expect(parseBackup(serializeBackup(original))).toEqual(original);
  });
  it("exports known library fields only, excluding server configuration", () => {
    const original = { ...library(), OPENAI_API_KEY: "dummy-secret-not-real" };
    expect(serializeBackup(original)).not.toContain("dummy-secret-not-real");
    expect(serializeBackup(original)).not.toContain("OPENAI_API_KEY");
  });
  it.each(["not json", "{}", '{"backupVersion":2}', '{"version":1,"sets":[]}'])(
    "rejects unsupported files: %s",
    (value) => {
      expect(() => parseBackup(value)).toThrow("Nothing has been changed");
    },
  );
  it.each([
    (l: ReturnType<typeof library>) => {
      l.sets.push(structuredClone(l.sets[0]));
    },
    (l: ReturnType<typeof library>) => {
      l.sets[0].folderId = "missing";
    },
    (l: ReturnType<typeof library>) => {
      l.folders[0].id = "all";
      l.sets[0].folderId = "all";
    },
    (l: ReturnType<typeof library>) => {
      l.folders.push({ id: "other", name: "BIOLOGY FINAL" });
    },
    (l: ReturnType<typeof library>) => {
      l.sets[0].cardSchedule["0"].dueAt = "invalid";
    },
    (l: ReturnType<typeof library>) => {
      l.sets[0].cardSchedule["0"].intervalDays = -1;
    },
    (l: ReturnType<typeof library>) => {
      l.sets[0].cardSchedule["9"] = l.sets[0].cardSchedule["0"];
    },
    (l: ReturnType<typeof library>) => {
      l.sets[0].cardSchedule["01"] = l.sets[0].cardSchedule["0"];
    },
    (l: ReturnType<typeof library>) => {
      l.sets[0].cardSchedule["0"].dueAt = "2020-01-01T00:00:00Z";
    },
    (l: ReturnType<typeof library>) => {
      l.sets[0].tags = ["exam", "EXAM"];
    },
  ])("rejects corrupt references and schedules", (change) => {
    const value = JSON.parse(serializeBackup(library()));
    change(value.library);
    expect(() => parseBackup(JSON.stringify(value))).toThrow();
  });
  it("migrates older saved records with safe empty organization and schedules", () => {
    const old = library();
    old.folders = [];
    const value = JSON.parse(JSON.stringify(old));
    delete value.sets[0].folderId;
    delete value.sets[0].tags;
    delete value.sets[0].cardSchedule;
    delete value.folders;
    const storage = { getItem: () => JSON.stringify(value), setItem: () => {} };
    const migrated = loadStudySets(storage);
    expect(migrated.writable).toBe(true);
    expect(migrated.folders).toEqual([]);
    expect(migrated.sets[0].cardReviews).toEqual(old.sets[0].cardReviews);
    expect(migrated.sets[0].cardSchedule).toEqual({});
    expect(migrated.sets[0].folderId).toBeNull();
  });
  it("merges without replacing edited notes or progress and remains idempotent", () => {
    const current = library(),
      incoming = library();
    incoming.sets[0].title = "An older copy";
    const result = prepareRestore(current, incoming, "merge");
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.library).toEqual(current);
    expect(prepareRestore(result.library, incoming, "merge").library).toEqual(
      current,
    );
  });
  it("remaps colliding folder IDs and reuses folders with the same name", () => {
    const current = library(),
      incoming = library();
    incoming.folders[0].name = "Physics";
    incoming.sets[0].id = "another-set";
    const result = prepareRestore(
      current,
      incoming,
      "merge",
      () => "new-folder-id",
    );
    expect(result.library.sets[1].folderId).toBe("new-folder-id");
    expect(result.library.folders).toHaveLength(2);
    expect(prepareRestore(result.library, incoming, "merge").library).toEqual(
      result.library,
    );
  });
  it("supports exact replacement, including an empty library, without reseeding", () => {
    const incoming = makeLibrary([]);
    const result = prepareRestore(library(), incoming, "replace");
    let raw = "";
    const storage = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    };
    expect(saveLibrary(storage, result.library)).toBeNull();
    expect(loadStudySets(storage).sets).toEqual([]);
  });
  it("rejects a merged library exceeding the set limit", () => {
    const current = library();
    current.sets = Array.from({ length: MAX_STUDY_SETS }, (_, i) => ({
      ...current.sets[0],
      id: `existing-${i}`,
    }));
    expect(() => prepareRestore(current, library(), "merge")).toThrow();
  });
  it("preserves saved data when storage refuses a restore", () => {
    const original = serializeBackup(library());
    const raw = original;
    const storage = {
      getItem: (key: string) => (key === STORAGE_KEY ? raw : null),
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    };
    const next = makeLibrary([]);
    expect(saveLibrary(storage, next)).not.toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBe(original);
  });
  it("validates unique IDs at the persistence boundary", () => {
    const current = library();
    current.sets.push(current.sets[0]);
    expect(librarySchema.safeParse(current).success).toBe(false);
  });
});
