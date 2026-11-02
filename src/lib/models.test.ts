import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/materials.json";
import { generationSchema, materialsSchema, paragraphs } from "./models";

describe("AI data validation in the browser", () => {
  it("accepts a correctly structured, grounded generation", () => {
    expect(
      generationSchema.safeParse({
        id: "g",
        notes: "A useful paragraph.",
        createdAt: "",
        materials: fixture,
      }).success,
    ).toBe(true);
  });
  it("rejects citations that point outside the source notes", () => {
    const materials = structuredClone(fixture);
    materials.quiz[0].sources = [2];
    expect(
      generationSchema.safeParse({
        id: "g",
        notes: "One paragraph.",
        createdAt: "",
        materials,
      }).success,
    ).toBe(false);
  });
  it("rejects repeated options and invalid correct indexes", () => {
    const materials = structuredClone(fixture);
    materials.quiz[0].options[1] = materials.quiz[0].options[0];
    expect(materialsSchema.safeParse(materials).success).toBe(false);
    materials.quiz[0].correct_index = 4;
    expect(materialsSchema.safeParse(materials).success).toBe(false);
  });
  it("requires empty materials for insufficient notes", () => {
    expect(
      materialsSchema.safeParse({ ...fixture, status: "insufficient" }).success,
    ).toBe(false);
    expect(
      materialsSchema.safeParse({
        status: "insufficient",
        message: "Add details.",
        summary: [],
        concepts: [],
        definitions: [],
        flashcards: [],
        quiz: [],
      }).success,
    ).toBe(true);
  });
  it("numbers paragraphs consistently across blank lines and Windows line endings", () => {
    expect(paragraphs("  First.\r\n\r\n Second.\n \nThird.  ")).toEqual([
      "First.",
      "Second.",
      "Third.",
    ]);
  });
});
