import {
  librarySchema,
  type Folder,
  type Library,
  type StudySet,
} from "./models";
import { sampleSet } from "./sample";
import { mergeSeedStudySets, SEED_VERSION } from "./seeds";

export const STORAGE_KEY = "ai-study-buddy:v1";
export function makeLibrary(sets: StudySet[], folders: Folder[] = []): Library {
  return { version: 1, seedVersion: SEED_VERSION, sets, folders };
}
export type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

export function loadStudySets(storage: Storage): {
  sets: StudySet[];
  folders: Folder[];
  warning: string;
  writable: boolean;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        sets: mergeSeedStudySets([sampleSet()]),
        folders: [],
        warning: "",
        writable: true,
      };
    const parsed = librarySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error("Invalid saved data");
    const sets =
      parsed.data.seedVersion < SEED_VERSION
        ? mergeSeedStudySets(parsed.data.sets)
        : parsed.data.sets;
    return { sets, folders: parsed.data.folders, warning: "", writable: true };
  } catch {
    // Keep the original untouched. Never silently overwrite corrupt or inaccessible data.
    return {
      sets: [sampleSet()],
      folders: [],
      warning:
        "Saved data could not be opened. This session is temporary. Your original saved data has been left untouched. Check browser storage settings or restore a valid backup using Replace.",
      writable: false,
    };
  }
}

export function saveStudySets(
  storage: Storage,
  sets: StudySet[],
  folders: Folder[] = [],
): string | null {
  return saveLibrary(storage, makeLibrary(sets, folders));
}

export function saveLibrary(storage: Storage, library: Library): string | null {
  try {
    const data = librarySchema.parse({
      ...library,
      seedVersion: Math.max(library.seedVersion, SEED_VERSION),
    });
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return null;
  } catch {
    return "Your browser could not save this change. Data may be invalid or storage full or blocked. Keep this tab open and download a backup.";
  }
}
