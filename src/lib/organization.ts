import type { Folder, StudySet } from "./models";
import { dueCardIndices } from "./repetition";

export function normalizeTags(value: string): string[] {
  const tags = [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (tags.length > 10 || tags.some((tag) => tag.length > 24))
    throw new Error("Use up to 10 tags, with at most 24 characters each.");
  return tags;
}

export function validateFolderName(
  name: string,
  folders: Folder[],
  exceptId?: string,
): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 50)
    throw new Error("Folder names need 1–50 characters.");
  if (
    folders.some(
      (folder) =>
        folder.id !== exceptId &&
        folder.name.toLowerCase() === trimmed.toLowerCase(),
    )
  )
    throw new Error("A folder with that name already exists.");
  return trimmed;
}

export function filterStudySets(
  sets: StudySet[],
  folders: Folder[],
  filters: {
    search: string;
    folder: string;
    tag: string;
    dueOnly: boolean;
    now: number;
  },
): StudySet[] {
  const query = filters.search.trim().toLowerCase();
  const folderNames = new Map(
    folders.map((folder) => [folder.id, folder.name]),
  );
  return sets.filter((set) => {
    const matchesFolder =
      filters.folder === "all" ||
      (filters.folder === "unfiled"
        ? set.folderId === null
        : set.folderId === filters.folder);
    const searchable = [
      set.title,
      set.subject,
      ...set.tags,
      folderNames.get(set.folderId ?? "") ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return (
      matchesFolder &&
      (!filters.tag || set.tags.includes(filters.tag)) &&
      searchable.includes(query) &&
      (!filters.dueOnly || dueCardIndices(set, filters.now).length > 0)
    );
  });
}
