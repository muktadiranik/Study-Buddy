import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";

const fixture = (name: string) => resolve(".qa/ocr", name);
async function openEditor(page: Page) {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { ai_enabled: false } }),
  );
  await page.route("**/api/generate", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "New study set" }).click();
}

test("real English image OCR can be corrected, saved and restored after refresh", async ({
  page,
}, info) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Import image", exact: true }).click();
  await page
    .getByLabel("Choose image", { exact: true })
    .setInputFiles(fixture("English study notes.jpg"));
  const preview = page.getByLabel("Extracted image text (editable)");
  await expect(preview).toHaveValue(
    /Photosynthesis converts light into chemical energy/,
    { timeout: 95_000 },
  );
  await expect(page.getByText("OCR was used.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Create study set", exact: true }),
  ).toBeDisabled();
  const text = `${await preview.inputValue()}\n\nMy corrected revision reminder.`;
  await preview.fill(text);
  await page.screenshot({
    path: `.qa/ocr-preview-${info.project.name}.png`,
    fullPage: true,
  });
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations.map((v) => v.id)).toEqual([]);
  await page
    .getByRole("button", { name: "Use extracted text", exact: true })
    .click();
  await expect(page.getByLabel("Study set title")).toHaveValue(
    "English study notes",
  );
  await page.getByLabel("Subject", { exact: true }).fill("Biology");
  await page
    .getByRole("button", { name: "Create study set", exact: true })
    .click();
  await page.reload();
  await page.getByLabel("Search study sets").fill("English study notes");
  await page
    .getByRole("navigation", { name: "Study sets" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Read all notes" }).click();
  await expect(page.getByRole("dialog")).toContainText("[Image OCR]");
  await expect(page.getByRole("dialog")).toContainText(
    "My corrected revision reminder.",
  );
});

test("real scanned and mixed PDFs support automatic and text-only recognition", async ({
  page,
}) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
  await page
    .getByLabel("Choose PDF", { exact: true })
    .setInputFiles(fixture("Mixed biology.pdf"));
  const preview = page.getByLabel("Extracted PDF text (editable)");
  await expect(preview).toHaveValue(
    /\[PDF page 1\][\s\S]*\[PDF page 2\] \(OCR\)/,
    { timeout: 95_000 },
  );
  await expect(
    page.getByText("OCR used on pages 2.", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Text recognition", { exact: true })
    .selectOption("off");
  await page
    .getByRole("button", { name: "Extract pages", exact: true })
    .click();
  await expect(preview).toHaveValue(/\[PDF page 1\]/);
  expect(await preview.inputValue()).not.toContain("[PDF page 2]");
  await expect(
    page.getByText("These pages were skipped", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Text recognition", { exact: true })
    .selectOption("always");
  await page.getByLabel("PDF start page").fill("2");
  await page
    .getByRole("button", { name: "Extract pages", exact: true })
    .click();
  await expect(preview).toHaveValue(
    /\[PDF page 2\] \(OCR\)[\s\S]*Calvin cycle/,
    { timeout: 95_000 },
  );
  await page
    .getByRole("button", { name: "Discard PDF preview", exact: true })
    .click();
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue("");
});

test("bad image uploads preserve notes and rotation is sent on reread", async ({
  page,
}) => {
  await openEditor(page);
  await page
    .getByLabel("Your notes", { exact: true })
    .fill("My original study notes.");
  await page.getByRole("button", { name: "Import image", exact: true }).click();
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({
    name: "damaged.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("could not be read");
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue(
    "My original study notes.",
  );
  // Only this rotation-contract check is mocked; the image and PDF tests above use real OCR.
  await page.route("**/api/import/image?**", (route) => {
    expect(route.request().url()).toContain("rotation=90");
    return route.fulfill({
      json: {
        text: "[Image OCR]\nRotated study notes.",
        source_type: "image",
        page_count: 1,
        start_page: 1,
        end_page: 1,
        imported_pages: [1],
        empty_pages: [],
        ocr_pages: [1],
        warnings: [],
      },
    });
  });
  await page.getByLabel("Rotate image clockwise").selectOption("90");
  await page.getByRole("button", { name: "Read image", exact: true }).click();
  await expect(page.getByLabel("Extracted image text (editable)")).toHaveValue(
    /Rotated study notes/,
  );
  await page
    .getByRole("button", { name: "Discard image preview", exact: true })
    .click();
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue(
    "My original study notes.",
  );
});

test("real phone-photo preparation can be switched off and retried", async ({
  page,
}) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Import image", exact: true }).click();
  await page
    .getByLabel("Choose image", { exact: true })
    .setInputFiles(fixture("Phone photo.jpg"));
  const preview = page.getByLabel("Extracted image text (editable)");
  await expect(preview).toHaveValue(
    /Photosynthesis converts light into chemical energy/,
    { timeout: 95_000 },
  );
  await expect(
    page.getByText("Photo preparation:", { exact: false }),
  ).toContainText("corrected page perspective");
  await expect(
    page.getByRole("button", { name: "Read image", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Improve phone photo:", { exact: false }).uncheck();
  const request = page.waitForRequest("**/api/import/image?**");
  await page.getByRole("button", { name: "Read image", exact: true }).click();
  expect((await request).url()).toContain("enhance=false");
  await expect(preview).toHaveValue(/Chlorophyll/, { timeout: 95_000 });
  await expect(
    page.getByText("Photo preparation:", { exact: false }),
  ).toHaveCount(0);
});

test("mocked handwriting vision requires fresh consent for each file and preserves uncertain text", async ({
  page,
}, info) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Import image", exact: true }).click();
  await page
    .getByLabel("Recognition method", { exact: true })
    .selectOption("vision");
  let calls = 0;
  await page.route("**/api/import/image?**", (route) => {
    calls += 1;
    const url = route.request().url();
    expect(url).toContain("engine=vision");
    expect(url).toContain("cloud_consent=true");
    return route.fulfill({
      json: {
        text: "[Image OCR]\nHandwritten English notes: energy is [unclear].",
        page_count: 1,
        start_page: 1,
        end_page: 1,
        source_type: "image",
        ocr_engine: "vision",
        imported_pages: [1],
        empty_pages: [],
        ocr_pages: [1],
        warnings: [
          "Handwriting vision used OpenAI. Check every line against the source.",
          "Some handwriting is uncertain. Correct [unclear] before saving.",
        ],
      },
    });
  });
  const upload = page.getByLabel("Choose image", { exact: true });
  await upload.setInputFiles(fixture("Phone photo.jpg"));
  const read = page.getByRole("button", { name: "Read image", exact: true });
  const consent = page.getByLabel(
    "Allow sending this file’s selected page images to OpenAI",
    { exact: false },
  );
  await expect(read).toBeDisabled();
  expect(calls).toBe(0);
  await consent.check();
  await read.click();
  const preview = page.getByLabel("Extracted image text (editable)");
  await expect(preview).toHaveValue(/energy is \[unclear\]/);
  await expect(read).toBeDisabled();
  expect(calls).toBe(1);
  await page.screenshot({
    path: `.qa/handwriting-preview-${info.project.name}.png`,
    fullPage: true,
  });
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations.map((v) => v.id)).toEqual([]);
  await upload.setInputFiles(fixture("English study notes.png"));
  await expect(consent).not.toBeChecked();
  await expect(read).toBeDisabled();
  expect(calls).toBe(1);
  await consent.check();
  await read.click();
  await expect(preview).toHaveValue(/\[unclear\]/);
  await preview.fill(
    "[Image OCR]\nHandwritten English notes: energy is conserved.",
  );
  await page
    .getByRole("button", { name: "Use extracted text", exact: true })
    .click();
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue(
    /energy is conserved/,
  );
});

test("page corner placement works with tapping, keyboard fields, reset, and real local OCR", async ({
  page,
}, info) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Import image", exact: true }).click();
  await page
    .getByLabel("Choose image", { exact: true })
    .setInputFiles(fixture("Phone photo.jpg"));
  await expect(page.getByLabel("Extracted image text (editable)")).toHaveValue(
    /Photosynthesis/,
    { timeout: 95_000 },
  );
  await page
    .getByLabel("Select one page to crop and straighten", { exact: true })
    .check();
  const crop = page.locator(".crop-photo");
  await expect
    .poll(() =>
      crop
        .locator("img")
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await crop.scrollIntoViewIfNeeded();
  const bounds = (await crop.boundingBox())!;
  await crop.click({
    position: { x: bounds.width * 0.128, y: bounds.height * 0.146 },
  });
  await expect
    .poll(async () =>
      Number(
        await page.getByLabel("Corner X percent", { exact: true }).inputValue(),
      ),
    )
    .toBeCloseTo(12.8, 0);
  await page
    .getByRole("button", { name: "Reset corners", exact: true })
    .click();
  await expect(
    page.getByLabel("Corner X percent", { exact: true }),
  ).toHaveValue("0");
  const corners = [
    [12.8, 14.6],
    [90, 7.7],
    [87.2, 80],
    [8.3, 88.5],
  ];
  for (let i = 0; i < 4; i++) {
    await page
      .getByLabel("Selected page corner", { exact: true })
      .selectOption(String(i));
    await page
      .getByLabel("Corner X percent", { exact: true })
      .fill(String(corners[i][0]));
    await page
      .getByLabel("Corner Y percent", { exact: true })
      .fill(String(corners[i][1]));
  }
  await expect(page.getByLabel("Rotate image clockwise")).toBeDisabled();
  await crop.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `.qa/page-crop-${info.project.name}.png`,
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
  const request = page.waitForRequest("**/api/import/image?**");
  await page.getByRole("button", { name: "Read image", exact: true }).click();
  expect(
    JSON.parse(new URL((await request).url()).searchParams.get("corners")!),
  ).toEqual(corners);
  await expect(page.getByLabel("Extracted image text (editable)")).toHaveValue(
    /Photosynthesis converts light into chemical energy/,
    { timeout: 95_000 },
  );
  await expect(
    page.getByText("Only the selected page area was transcribed.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use extracted text", exact: true })
    .click();
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue(
    /Calvin cycle/,
  );
});
