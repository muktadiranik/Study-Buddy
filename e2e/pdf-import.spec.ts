import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import materials from "../tests/fixtures/materials.json" with { type: "json" };

const fixture = (name: string) => resolve(".qa/pdfs", name);
async function openEditor(page: Page, existing = false) {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { ai_enabled: false } }),
  );
  await page.route("**/api/generate", (route) => route.abort());
  await page.goto("/");
  await page
    .getByRole("button", {
      name: existing ? "Edit notes" : "New study set",
    })
    .click();
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
}

test("real PDF upload supports preview, page ranges, saving, refresh and generation", async ({
  page,
}, info) => {
  await openEditor(page);
  const original = await page
    .getByLabel("Your notes", { exact: true })
    .inputValue();
  await page
    .getByLabel("Choose PDF", { exact: true })
    .setInputFiles(fixture("Biology lecture.pdf"));
  await expect(
    page.getByRole("heading", { name: "PDF text preview" }),
  ).toBeVisible();
  const preview = page.getByLabel("Extracted PDF text (editable)");
  await expect(preview).toHaveValue(/\[PDF page 1\][\s\S]*\[PDF page 2\]/);
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue(
    original,
  );
  await expect(
    page.getByRole("button", { name: "Create study set", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("PDF start page").fill("2");
  await page.getByLabel("PDF end page").fill("2");
  await page
    .getByRole("button", { name: "Extract pages", exact: true })
    .click();
  await expect(preview).toHaveValue(/\[PDF page 2\]/);
  expect(await preview.inputValue()).not.toContain("[PDF page 1]");
  await preview.fill(
    `${await preview.inputValue()}\n\nMy revision reminder: focus on the stroma.`,
  );
  await page
    .getByRole("button", { name: "Use extracted text", exact: true })
    .click();
  await expect(page.getByLabel("Study set title")).toHaveValue(
    "Biology lecture",
  );
  await page.getByLabel("Subject", { exact: true }).fill("Biology");
  await page
    .getByRole("button", { name: "Create study set", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Biology lecture", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Search study sets").fill("Biology lecture");
  await page
    .getByRole("navigation", { name: "Study sets" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Read all notes" }).click();
  await expect(page.getByRole("dialog")).toContainText("[PDF page 2]");
  await expect(page.getByRole("dialog")).toContainText("My revision reminder");
  await page.getByRole("button", { name: "Back to studying" }).click();
  // Only generation is mocked. Upload and extraction above use the real Python worker.
  await page.route("**/api/generate", async (route) => {
    expect(route.request().postDataJSON().notes).toContain("[PDF page 2]");
    await route.fulfill({
      json: {
        materials: {
          ...materials,
          summary: [
            {
              text: "The Calvin cycle takes place in the stroma and uses ATP and NADPH.",
              sources: [1],
            },
          ],
          concepts: [],
          definitions: [],
          flashcards: [
            {
              question: "Where does the Calvin cycle take place?",
              answer: "In the stroma.",
              sources: [1],
            },
          ],
          quiz: [
            {
              question: "Where does the Calvin cycle take place?",
              options: [
                "The stroma",
                "The roots",
                "The cell wall",
                "Outside the plant",
              ],
              correct_index: 0,
              explanation: "The notes locate the Calvin cycle in the stroma.",
              simpler_example:
                "Imagine the stroma as the workspace where the cycle runs.",
              sources: [1],
            },
          ],
        },
        cached: false,
      },
    });
  });
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { ai_enabled: true } }),
  );
  await page.reload();
  await page.getByLabel("Search study sets").fill("Biology lecture");
  await page
    .getByRole("navigation", { name: "Study sets" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Generate study materials" }).click();
  await expect(
    page.getByRole("heading", { name: "The big picture", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit notes", exact: true }).click();
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
  await page
    .getByLabel("Choose PDF", { exact: true })
    .setInputFiles(fixture("Biology lecture.pdf"));
  await expect(
    page.getByRole("heading", { name: "PDF text preview" }),
  ).toBeVisible();
  await page.screenshot({
    path: `.qa/pdf-preview-${info.project.name}.png`,
    fullPage: true,
  });
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Replace notes with PDF text" })
    .click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Your notes have changed.", { exact: false }),
  ).toBeVisible();
});

test("real PDF errors preserve notes and long previews must be shortened before applying", async ({
  page,
}) => {
  await openEditor(page, true);
  const notes = page.getByLabel("Your notes", { exact: true });
  const original = await notes.inputValue();
  const upload = page.getByLabel("Choose PDF", { exact: true });
  await upload.setInputFiles(fixture("scanned.pdf"));
  await expect(page.getByRole("alert")).toContainText("No readable text", {
    timeout: 90_000,
  });
  await expect(notes).toHaveValue(original);
  await upload.setInputFiles(fixture("locked.pdf"));
  await expect(page.getByRole("alert")).toContainText("password-protected");
  await expect(notes).toHaveValue(original);
  await upload.setInputFiles({
    name: "broken.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByRole("alert")).toContainText("not a valid PDF");
  await upload.setInputFiles(fixture("many-pages.pdf"));
  await expect(page.getByRole("alert")).toContainText("up to 20 pages");
  await page.getByLabel("PDF start page").fill("21");
  await page.getByLabel("PDF end page").fill("21");
  await page
    .getByRole("button", { name: "Extract pages", exact: true })
    .click();
  await expect(page.getByLabel("Extracted PDF text (editable)")).toHaveValue(
    /\[PDF page 21\]/,
  );
  await page.getByRole("button", { name: "Discard PDF preview" }).click();
  await expect(notes).toHaveValue(original);
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
  await upload.setInputFiles(fixture("long.pdf"));
  await expect(
    page.getByText("Shorten the preview or extract fewer pages", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replace notes with PDF text" }),
  ).toBeDisabled();
  await page
    .getByLabel("Extracted PDF text (editable)")
    .fill("[PDF page 1]\nA shorter excerpt about photosynthesis.");
  await page
    .getByRole("button", { name: "Replace notes with PDF text" })
    .click();
  await expect(notes).toHaveValue(
    "[PDF page 1]\nA shorter excerpt about photosynthesis.",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Edit notes", exact: true }).click();
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue(
    original,
  );
});

test("mocked extraction can be canceled and malformed results are rejected", async ({
  page,
}) => {
  await openEditor(page, true);
  const original = await page
    .getByLabel("Your notes", { exact: true })
    .inputValue();
  let release: (() => void) | undefined;
  await page.route("**/api/import/pdf?**", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route
      .fulfill({
        json: {
          text: "Bad data",
          page_count: 1,
          start_page: 1,
          end_page: 1,
          imported_pages: [99],
          empty_pages: [],
          warnings: [],
        },
      })
      .catch(() => {});
  });
  await page
    .getByLabel("Choose PDF", { exact: true })
    .setInputFiles(fixture("Biology lecture.pdf"));
  await expect(
    page.getByRole("button", { name: "Cancel extraction" }),
  ).toBeVisible();
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.getByRole("button", { name: "Cancel extraction" }).click();
  release?.();
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue(
    original,
  );
  await page.unroute("**/api/import/pdf?**");
  await page.route("**/api/import/pdf?**", (route) =>
    route.fulfill({
      json: {
        text: "Bad data",
        page_count: 1,
        start_page: 1,
        end_page: 1,
        imported_pages: [99],
        empty_pages: [],
        warnings: [],
      },
    }),
  );
  await page
    .getByRole("button", { name: "Extract pages", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("invalid PDF preview");
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue(
    original,
  );
});
