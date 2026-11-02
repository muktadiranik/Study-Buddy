import { describe, expect, it } from "vitest";
import {
  normalizeTags,
  filterStudySets,
  validateFolderName,
} from "./organization";
import { sampleSet } from "./sample";

describe("library organization", () => {
  it("normalizes tags and rejects excessive input", () => {
    expect(normalizeTags(" Exam, biology, exam, , Chapter-1 ")).toEqual([
      "exam",
      "biology",
      "chapter-1",
    ]);
    expect(() => normalizeTags("a".repeat(25))).toThrow();
    expect(() =>
      normalizeTags(Array.from({ length: 11 }, (_, i) => `tag${i}`).join(",")),
    ).toThrow();
  });
  it("validates folder creation and renaming without case-only duplicates", () => {
    const folders = [{ id: "bio", name: "Biology" }];
    expect(validateFolderName(" Final exam ", folders)).toBe("Final exam");
    expect(() => validateFolderName("BIOLOGY", folders)).toThrow();
    expect(validateFolderName("biology", folders, "bio")).toBe("biology");
    expect(() => validateFolderName(" ", folders)).toThrow();
  });
  it("combines folder, tag, text, and due filters across the whole library", () => {
    const a = sampleSet();
    a.folderId = "bio";
    a.tags = ["exam"];
    const b = { ...sampleSet(), id: "second", title: "Other notes" };
    const folders = [{ id: "bio", name: "Biology final" }];
    const base = {
      search: "",
      folder: "all",
      tag: "",
      dueOnly: false,
      now: Date.now(),
    };
    expect(
      filterStudySets([a, b], folders, {
        ...base,
        search: "final",
        tag: "exam",
      }),
    ).toEqual([a]);
    expect(
      filterStudySets([a, b], folders, { ...base, folder: "unfiled" }),
    ).toEqual([b]);
    expect(
      filterStudySets([a, b], folders, {
        ...base,
        folder: "bio",
        tag: "missing",
      }),
    ).toEqual([]);
    expect(
      filterStudySets([a, b], folders, { ...base, dueOnly: true }),
    ).toEqual([]);
  });
});
