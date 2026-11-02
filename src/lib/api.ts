import { generationSchema, type StudySet } from "./models";

export async function generateStudyMaterials(set: StudySet) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 70_000);
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        title: set.title,
        subject: set.subject,
        notes: set.notes,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : "Generation failed. Please try again.",
      );
    return generationSchema.parse({
      id: crypto.randomUUID(),
      notes: set.notes,
      createdAt: new Date().toISOString(),
      materials: data.materials,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error(
        "Generation timed out. Your notes are safe. Try again with a shorter section.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Could not connect to the Python server. Start the backend and try again.",
      );
    if (error instanceof Error && error.name === "ZodError")
      throw new Error(
        "The server returned invalid study materials. Nothing was saved. Please try again.",
      );
    if (error instanceof SyntaxError)
      throw new Error(
        "The Python server did not return a valid response. Check that it is running on port 8000.",
      );
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
