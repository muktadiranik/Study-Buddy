import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fixture from "../tests/fixtures/materials.json" with { type: "json" };

// Only tests intercept AI calls. The application itself has no demo-output mode.
async function mockedAI(page: Page, materials: unknown = fixture) {
  let calls = 0;
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { ai_enabled: true } }),
  );
  await page.route("**/api/generate", async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body.notes).toContain("Photosynthesis");
    await route.fulfill({ json: { materials, cached: false } });
  });
  return () => calls;
}

async function checkNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("local backend health and mocked no-key setup, note import, edit, refresh, and delete", async ({
  page,
  request,
}, info) => {
  const status = await request.get("/api/status");
  expect(status.ok()).toBe(true);
  expect(typeof (await status.json()).ai_enabled).toBe("boolean");
  // Simulate an unconfigured UI even when the developer has a real key locally.
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { ai_enabled: false } }),
  );
  await page.route("**/api/generate", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "AI is disabled in this test." },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByText("The science of photosynthesis", { exact: true }).last(),
  ).toBeVisible();
  await page.screenshot({
    path: `.qa/${info.project.name}-initial.png`,
    fullPage: true,
  });
  await checkNoOverflow(page);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await expect(
    page.getByText("Your notes are ready. Enable AI when you are."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate study materials" }).click();
  await expect(page.getByRole("dialog")).toContainText("OPENAI_MODEL");
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "New study set" }).click();
  await page.getByLabel("Import text file").setInputFiles({
    name: "Plant notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Photosynthesis produces glucose.\n\nChlorophyll absorbs light.",
    ),
  });
  await expect(page.getByLabel("Study set title")).toHaveValue("Plant notes");
  await page.getByLabel("Subject", { exact: true }).fill("Biology");
  await page
    .getByRole("button", { name: "Create study set", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Plant notes" }),
  ).toBeVisible();
  await page.reload();
  // The first set is selected on load; imported set remains in the sidebar.
  await page.getByRole("button", { name: "Plant notes Biology" }).click();
  await page.getByRole("button", { name: "Edit notes", exact: true }).click();
  await page.getByLabel("Study set title").fill("My plant notes");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "My plant notes" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete study set", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete study set", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /My plant notes Biology/ }),
  ).toHaveCount(0);
  await page.getByLabel("Search study sets").fill("not-in-library");
  await expect(page.getByText("No matching sets.")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("tab", { name: "Summary" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Flashcards" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Flashcards" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("mocked AI: generate once, review cards, quiz mistakes, retries, persistence, and stale notes", async ({
  page,
}, info) => {
  const callCount = await mockedAI(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Generate study materials" }).click();
  await expect(
    page.getByRole("heading", { name: "The big picture" }),
  ).toBeVisible();
  await page.screenshot({
    path: `.qa/${info.project.name}-generated.png`,
    fullPage: true,
  });
  await checkNoOverflow(page);
  await page
    .getByRole("button", { name: "Read note paragraph 1" })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Photosynthesis is the process",
  );
  await page.getByRole("button", { name: "Back to studying" }).click();
  await page.getByRole("tab", { name: "Flashcards" }).click();
  await page.getByRole("button", { name: "Study all cards" }).click();
  await expect(page.getByText("Glucose.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "Review again", exact: true }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Revisit review cards (1)" }).click();
  await expect(page.getByText("Card 1 of 1")).toBeVisible();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("tab", { name: "Quiz", exact: true }).click();
  await page.getByRole("button", { name: "Start practice quiz" }).click();
  await expect(page.getByText("Correct answer:", { exact: false })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Check my answers" }),
  ).toBeDisabled();
  const questions = page.locator("fieldset");
  await questions.nth(0).getByRole("radio").nth(3).check();
  await page.reload();
  await page.getByRole("tab", { name: "Quiz", exact: true }).click();
  await expect(
    page.locator("fieldset").nth(0).getByRole("radio").nth(3),
  ).toBeChecked();
  await page.locator("fieldset").nth(1).getByRole("radio").nth(1).check();
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Check my answers" }).click();
  await expect(
    page.getByText("1 of 2 correct.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Illustrative example — not from your notes"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry missed questions (1)" })
    .click();
  await expect(page.locator("fieldset")).toHaveCount(1);
  await page.locator("fieldset").getByRole("radio").nth(0).check();
  await page.getByRole("button", { name: "Check my answers" }).click();
  await expect(
    page.getByText("1 of 1 correct.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Progress" }).click();
  await expect(page.getByText("1 full quiz · 1 retry")).toBeVisible();
  await expect(page.getByText("100% marked “Got it”")).toBeVisible();
  await page.screenshot({
    path: `.qa/${info.project.name}-progress.png`,
    fullPage: true,
  });
  expect(callCount()).toBe(1);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Edit notes", exact: true }).click();
  const notes = page.getByLabel("Your notes", { exact: true });
  await notes.fill(
    `${await notes.inputValue()}\n\nNew note: light is required.`,
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("tab", { name: "Flashcards" }).click();
  await expect(
    page.getByRole("heading", { name: "Bring your practice up to date." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Update study materials", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Study all cards" }),
  ).toBeVisible();
  expect(callCount()).toBe(2);
  await page.getByRole("tab", { name: "Progress" }).click();
  await expect(page.getByText("100% marked “Got it”")).toHaveCount(0);
  await expect(page.getByText("1 full quiz · 1 retry")).toBeVisible();
});

test("mocked AI: insufficient notes are explicit", async ({ page }) => {
  await mockedAI(page, {
    status: "insufficient",
    message: "Add more factual details before making a quiz.",
    summary: [],
    concepts: [],
    definitions: [],
    flashcards: [],
    quiz: [],
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Generate study materials" }).click();
  await expect(
    page.getByText("Add more factual details before making a quiz."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to your notes" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("mocked AI: malformed results are not saved and generation can be retried", async ({
  page,
}) => {
  const invalid = structuredClone(fixture);
  invalid.quiz[0].correct_index = 9;
  const calls = await mockedAI(page, invalid);
  await page.goto("/");
  await page.getByRole("button", { name: "Generate study materials" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "invalid study materials",
  );
  await expect(
    page.getByRole("heading", { name: "The big picture", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Generate study materials" }),
  ).toBeVisible();
  expect(calls()).toBe(1);
});
