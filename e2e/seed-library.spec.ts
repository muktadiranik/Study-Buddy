import { expect, test } from "@playwright/test";
import fixture from "../tests/fixtures/materials.json" with { type: "json" };

test("seed migration preserves existing progress and supports searching, editing, and deleting 520 examples", async ({
  page,
}) => {
  const now = "2026-11-01T00:00:00.000Z";
  const notes =
    "Photosynthesis converts light energy into chemical energy stored in glucose.";
  const saved = {
    id: "my-existing-set",
    title: "My existing Biology notes",
    subject: "Biology",
    notes,
    createdAt: now,
    updatedAt: now,
    generation: {
      id: "existing-generation",
      notes,
      createdAt: now,
      materials: fixture,
    },
    cardReviews: { "0": "review", "1": "got-it" },
    attempts: [
      {
        id: "existing-attempt",
        generationId: "existing-generation",
        createdAt: now,
        kind: "full",
        questions: fixture.quiz,
        answers: [3, 1],
      },
    ],
    quizDraft: null,
  };
  // Simulate a pre-seed browser record. Run once, so reloads test the real saved state.
  await page.addInitScript((record) => {
    if (!localStorage.getItem("seed-test-initialized")) {
      localStorage.setItem(
        "ai-study-buddy:v1",
        JSON.stringify({ version: 1, sets: [record] }),
      );
      localStorage.setItem("seed-test-initialized", "true");
    }
  }, saved);
  await page.goto("/");
  const store = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("ai-study-buddy:v1")!));
  expect((await store()).sets).toHaveLength(521);
  expect((await store()).sets[0]).toEqual({
    ...saved,
    folderId: null,
    tags: [],
    cardSchedule: {},
  });
  await expect(
    page.getByRole("navigation", { name: "Study sets" }).getByRole("button"),
  ).toHaveCount(40);
  await page.getByRole("button", { name: "Show more study sets" }).click();
  await expect(
    page.getByRole("navigation", { name: "Study sets" }).getByRole("button"),
  ).toHaveCount(80);
  await page.getByRole("tab", { name: "Progress" }).click();
  await expect(page.getByText("50%", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1 full quiz · 0 retries")).toBeVisible();
  const search = page.getByLabel("Search study sets");
  await search.fill("break-even");
  await expect(
    page.getByRole("navigation", { name: "Study sets" }).getByRole("button"),
  ).toHaveCount(20);
  await page
    .getByRole("navigation", { name: "Study sets" })
    .getByRole("button")
    .first()
    .click();
  await expect(
    page.getByText("Example study set", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit notes", exact: true }).click();
  await page.getByLabel("Study set title").fill("My edited break-even lesson");
  await page.getByRole("button", { name: "Save changes" }).click();
  const edited = (await store()).sets.find(
    (s: { title: string }) => s.title === "My edited break-even lesson",
  );
  expect(edited).toBeTruthy();
  await page.reload();
  expect((await store()).sets).toHaveLength(521);
  expect(
    (await store()).sets.find((s: { id: string }) => s.id === edited.id),
  ).toEqual(edited);
  await page
    .getByLabel("Search study sets")
    .fill("My edited break-even lesson");
  await page
    .getByRole("navigation", { name: "Study sets" })
    .getByRole("button")
    .click();
  await page
    .getByRole("button", { name: "Delete study set", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete study set", exact: true })
    .click();
  await page.reload();
  const final = await store();
  expect(final.seedVersion).toBe(1);
  expect(final.sets).toHaveLength(520);
  expect(final.sets.some((s: { id: string }) => s.id === edited.id)).toBe(
    false,
  );
  expect(new Set(final.sets.map((s: { id: string }) => s.id)).size).toBe(520);
  expect(final.sets[0]).toEqual({
    ...saved,
    folderId: null,
    tags: [],
    cardSchedule: {},
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
