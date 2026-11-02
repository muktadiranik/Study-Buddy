import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import materials from "../tests/fixtures/materials.json" with { type: "json" };

const DAY = 86_400_000;
async function start(page: Page) {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { ai_enabled: false } }),
  );
  await page.route("**/api/generate", (route) => route.abort());
  await page.addInitScript((fixture) => {
    if (localStorage.getItem("ai-study-buddy:v1")) return;
    const now = "2026-11-02T06:00:00.000Z";
    const notes =
      "Photosynthesis converts light energy into chemical energy stored in glucose.";
    localStorage.setItem(
      "ai-study-buddy:v1",
      JSON.stringify({
        version: 1,
        seedVersion: 1,
        sets: [
          {
            id: "personal-biology",
            title: "Working Biology",
            subject: "Biology",
            notes,
            createdAt: now,
            updatedAt: now,
            generation: { id: "g", notes, createdAt: now, materials: fixture },
            cardReviews: {},
            attempts: [],
            quizDraft: null,
          },
        ],
      }),
    );
  }, materials);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Working Biology" }),
  ).toBeVisible();
}

async function readStore(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("ai-study-buddy:v1")!),
  );
}
async function chooseBackup(page: Page, contents: string) {
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "library.json",
    mimeType: "application/json",
    buffer: Buffer.from(contents),
  });
}

test("folders, tags, schedules and backup downloads survive merge and confirmed replacement", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Folders", exact: true }).click();
  await page.getByLabel("New folder name").fill("Biology final");
  await page
    .getByRole("button", { name: "Create folder", exact: true })
    .click();
  await page
    .getByLabel("Folder to manage")
    .selectOption({ label: "Biology final (0)" });
  await page.getByLabel("Rename folder", { exact: true }).fill("Bio final");
  await page.getByRole("button", { name: "Save folder name" }).click();
  await page.getByLabel("New folder name").fill("Physics");
  await page
    .getByRole("button", { name: "Create folder", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Edit notes", exact: true }).click();
  await page
    .getByLabel("Folder", { exact: true })
    .selectOption({ label: "Bio final" });
  await page.getByLabel("Tags", { exact: true }).fill("Exam, chapter-1, exam");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByLabel("Filter by folder")
    .selectOption({ label: "Bio final" });
  await page.getByLabel("Filter by tag", { exact: true }).selectOption("exam");
  await page.getByLabel("Search study sets").fill("chapter-1");
  await expect(
    page.getByRole("navigation", { name: "Study sets" }).getByRole("button"),
  ).toHaveCount(1);
  await page.getByLabel("Search study sets").fill("no-match");
  await expect(page.getByText("No matching sets.")).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByLabel("Due cards only").check();
  await expect(
    page.getByRole("navigation", { name: "Study sets" }).getByRole("button"),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "Flashcards" }).click();
  await page.getByRole("button", { name: "Study due cards (2)" }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "Review again", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Backup / restore", exact: true })
    .click();
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const download = await downloadEvent;
  const contents = await readFile((await download.path())!, "utf8");
  const backup = JSON.parse(contents);
  expect(backup.library.sets[0].tags).toEqual(["exam", "chapter-1"]);
  expect(backup.library.sets[0].cardSchedule["0"].intervalDays).toBe(1);
  expect(backup.library.sets[0].cardSchedule["1"].intervalDays).toBe(0);
  expect(contents).not.toContain("OPENAI_API_KEY");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Edit notes", exact: true }).click();
  await page.getByLabel("Study set title").fill("Changed after backup");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", { name: "Backup / restore", exact: true })
    .click();
  await chooseBackup(page, contents);
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Changed after backup" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Backup / restore", exact: true })
    .click();
  await chooseBackup(page, contents);
  await page.getByLabel("Replace: use only the library in this backup").check();
  await expect(
    page.getByRole("button", { name: "Restore backup", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel(
      "I understand this replaces all study sets and progress currently on this device.",
    )
    .check();
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Working Biology" }),
  ).toBeVisible();
  expect((await readStore(page)).sets[0]).toEqual(backup.library.sets[0]);
  expect((await readStore(page)).folders).toEqual(backup.library.folders);
  await page.getByRole("button", { name: "Folders", exact: true }).click();
  await page
    .getByLabel("Folder to manage")
    .selectOption({ label: "Bio final (1)" });
  await page
    .getByRole("button", { name: "Remove folder", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm remove folder" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  expect((await readStore(page)).sets[0].folderId).toBeNull();
  expect((await readStore(page)).sets[0].cardSchedule).toEqual(
    backup.library.sets[0].cardSchedule,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("due reviews advance with time and invalid or unsavable restores leave the library untouched", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-02T06:00:00Z") });
  await start(page);
  await page.getByRole("tab", { name: "Flashcards" }).click();
  await page.getByRole("button", { name: "Study due cards (2)" }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await page.getByRole("button", { name: "Got it", exact: true }).click();
  }
  await page.reload();
  await page.getByRole("tab", { name: "Flashcards" }).click();
  await expect(
    page.getByRole("button", { name: "Study due cards (0)" }),
  ).toBeDisabled();
  await page.clock.fastForward(DAY);
  await page.getByRole("button", { name: "Study due cards (2)" }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "Review again", exact: true }).click();
  expect((await readStore(page)).sets[0].cardSchedule["0"].intervalDays).toBe(
    3,
  );
  await page
    .getByRole("button", { name: "Back to flashcards", exact: true })
    .click();
  await page.clock.fastForward(600_001);
  await expect(
    page.getByRole("button", { name: "Study due cards (1)" }),
  ).toBeEnabled();
  const before = await readStore(page);
  await page
    .getByRole("button", { name: "Backup / restore", exact: true })
    .click();
  await chooseBackup(page, '{"backupVersion":999}');
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Nothing has been changed",
  );
  expect(await readStore(page)).toEqual(before);
  const valid = JSON.stringify({
    format: "ai-study-buddy-backup",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    library: { version: 1, seedVersion: 1, sets: [], folders: [] },
  });
  await chooseBackup(page, valid);
  await page.getByLabel("Replace: use only the library in this backup").check();
  await page
    .getByLabel(
      "I understand this replaces all study sets and progress currently on this device.",
    )
    .check();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Nothing has been restored",
  );
  expect(await readStore(page)).toEqual(before);
});
