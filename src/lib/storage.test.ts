import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/materials.json";
import { generationSchema, type StudySet } from "./models";
import { sampleSet } from "./sample";
import {
  loadStudySets,
  saveStudySets,
  STORAGE_KEY,
  type Storage,
} from "./storage";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function activeSet(): StudySet {
  const set = sampleSet();
  set.generation = generationSchema.parse({
    id: "g",
    notes: set.notes,
    createdAt: set.createdAt,
    materials: fixture,
  });
  set.cardReviews = { "0": "review", "1": "got-it" };
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
      kind: "full",
      createdAt: set.createdAt,
      questions: set.generation.materials.quiz,
      answers: [3, 1],
    },
  ];
  return set;
}

describe("browser persistence", () => {
  it("seeds 520 examples plus the original sample, then round-trips study activity", () => {
    const storage = memoryStorage();
    expect(loadStudySets(storage).sets).toHaveLength(521);
    const set = activeSet();
    expect(saveStudySets(storage, [set])).toBeNull();
    expect(loadStudySets(storage).sets).toEqual([set]);
  });
  it("upgrades an old library once without changing existing notes or progress", () => {
    const storage = memoryStorage();
    const existing = activeSet();
    existing.title = "My own photosynthesis notes";
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, sets: [existing] }),
    );
    const loaded = loadStudySets(storage);
    expect(loaded.sets).toHaveLength(521);
    expect(loaded.sets[0]).toEqual(existing);
    expect(saveStudySets(storage, loaded.sets)).toBeNull();
    expect(loadStudySets(storage).sets).toEqual(loaded.sets);
  });
  it("does not restore deleted examples on subsequent loads", () => {
    const storage = memoryStorage();
    const initial = loadStudySets(storage).sets;
    const removedId = initial[1].id;
    saveStudySets(
      storage,
      initial.filter((set) => set.id !== removedId),
    );
    const reloaded = loadStudySets(storage);
    expect(reloaded.sets).toHaveLength(520);
    expect(reloaded.sets.some((set) => set.id === removedId)).toBe(false);
  });
  it("keeps an intentionally empty library empty after refresh", () => {
    const storage = memoryStorage();
    saveStudySets(storage, []);
    expect(loadStudySets(storage).sets).toEqual([]);
  });
  it.each([
    "{broken json",
    '{"version":2,"sets":[]}',
    '{"version":1,"sets":[{}]}',
  ])("preserves unusable saved data: %s", (raw) => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const loaded = loadStudySets(storage);
    expect(loaded.writable).toBe(false);
    expect(loaded.warning).toContain("untouched");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it("reports blocked/full storage rather than claiming success", () => {
    const storage: Storage = {
      getItem: () => {
        throw new Error("Blocked");
      },
      setItem: () => {
        throw new Error("Quota");
      },
    };
    expect(loadStudySets(storage).writable).toBe(false);
    expect(saveStudySets(storage, [sampleSet()])).toContain("could not save");
  });
  it("rejects a corrupt draft or tampered quiz score inputs", () => {
    const storage = memoryStorage(),
      set = activeSet();
    set.quizDraft!.indices = [4];
    expect(saveStudySets(storage, [set])).not.toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});
