import { describe, expect, it } from "vitest";
import { pdfResultSchema } from "./pdf";

const preview = {
  text: "[PDF page 1]\nPhotosynthesis converts light to chemical energy.",
  page_count: 2,
  start_page: 1,
  end_page: 2,
  imported_pages: [1],
  empty_pages: [2],
  warnings: ["Page 2 has no text."],
};

describe("PDF preview validation", () => {
  it("accepts page references including explicitly skipped pages", () => {
    expect(pdfResultSchema.parse(preview)).toEqual(preview);
  });
  it("accepts local image OCR and mixed PDF provenance", () => {
    expect(
      pdfResultSchema.safeParse({ ...preview, ocr_pages: [2] }).success,
    ).toBe(true);
    expect(
      pdfResultSchema.safeParse({
        ...preview,
        source_type: "image",
        page_count: 1,
        end_page: 1,
        imported_pages: [1],
        empty_pages: [],
        ocr_pages: [1],
      }).success,
    ).toBe(true);
  });
  it.each([
    { ...preview, text: "" },
    { ...preview, text: "x".repeat(100_001) },
    { ...preview, page_count: 201 },
    { ...preview, start_page: 0 },
    { ...preview, imported_pages: [1, 2], empty_pages: [2] },
    { ...preview, imported_pages: [3] },
    { ...preview, empty_pages: [] },
    { ...preview, imported_pages: [], empty_pages: [1, 2] },
    { ...preview, end_page: 21, page_count: 21 },
    { ...preview, ocr_pages: [3] },
    { ...preview, ocr_pages: [1, 1] },
    { ...preview, ocr_engine: "untrusted-provider" },
    { ...preview, source_type: "image", ocr_pages: [1] },
    {
      ...preview,
      source_type: "image",
      page_count: 1,
      end_page: 1,
      empty_pages: [],
      ocr_pages: [],
    },
  ])("rejects incomplete or inconsistent PDF previews", (result) => {
    expect(pdfResultSchema.safeParse(result).success).toBe(false);
  });
});
