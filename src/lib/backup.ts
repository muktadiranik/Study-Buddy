import { z } from "zod";
import { librarySchema, type Library } from "./models";
import { SEED_VERSION } from "./seeds";

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const backupSchema = z.object({
  format: z.literal("ai-study-buddy-backup"),
  backupVersion: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  library: librarySchema,
});
export type RestoreMode = "merge" | "replace";

export function serializeBackup(
  library: Library,
  now = new Date().toISOString(),
): string {
  return JSON.stringify(
    backupSchema.parse({
      format: "ai-study-buddy-backup",
      backupVersion: 1,
      exportedAt: now,
      library,
    }),
    null,
    2,
  );
}

export function parseBackup(text: string): Library {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Choose a backup smaller than 20 MB.");
  try {
    return backupSchema.parse(JSON.parse(text.replace(/^\uFEFF/, ""))).library;
  } catch {
    throw new Error(
      "This is not a supported Study Buddy backup, or it contains invalid data. Nothing has been changed.",
    );
  }
}

export function prepareRestore(
  current: Library,
  incoming: Library,
  mode: RestoreMode,
  newId: () => string = () => crypto.randomUUID(),
): { library: Library; added: number; skipped: number } {
  const valid = librarySchema.parse(incoming);
  if (mode === "replace")
    return {
      library: {
        ...valid,
        seedVersion: Math.max(valid.seedVersion, SEED_VERSION),
      },
      added: valid.sets.length,
      skipped: 0,
    };
  const folders = [...current.folders];
  const folderMap = new Map<string, string>();
  for (const folder of valid.folders) {
    const sameName = folders.find(
      (existing) => existing.name.toLowerCase() === folder.name.toLowerCase(),
    );
    if (sameName) {
      folderMap.set(folder.id, sameName.id);
      continue;
    }
    const id = folders.some((existing) => existing.id === folder.id)
      ? newId()
      : folder.id;
    folders.push({ ...folder, id });
    folderMap.set(folder.id, id);
  }
  const ids = new Set(current.sets.map((set) => set.id));
  const additions = valid.sets
    .filter((set) => !ids.has(set.id))
    .map((set) => ({
      ...set,
      folderId: set.folderId ? folderMap.get(set.folderId)! : null,
    }));
  const library = librarySchema.parse({
    version: 1,
    seedVersion: Math.max(current.seedVersion, valid.seedVersion, SEED_VERSION),
    folders,
    sets: [...current.sets, ...additions],
  });
  return {
    library,
    added: additions.length,
    skipped: valid.sets.length - additions.length,
  };
}
