import { z } from "zod";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PREVIEW = 100_000;
const pageNumber = z.number().int().min(1).max(200);
export const pdfResultSchema = z
  .object({
    text: z.string().min(1).max(MAX_PDF_PREVIEW),
    page_count: pageNumber,
    start_page: pageNumber,
    end_page: pageNumber,
    imported_pages: z.array(pageNumber).min(1).max(20),
    empty_pages: z.array(pageNumber).max(20),
    warnings: z.array(z.string().max(1000)).max(10),
    source_type: z.enum(["pdf", "image"]).optional(),
    ocr_pages: z.array(pageNumber).max(5).optional(),
    ocr_engine: z.enum(["local", "vision"]).optional(),
  })
  .superRefine((result, ctx) => {
    const pages = [...result.imported_pages, ...result.empty_pages];
    if (
      result.end_page < result.start_page ||
      result.end_page > result.page_count ||
      result.end_page - result.start_page + 1 > 20 ||
      pages.length !== result.end_page - result.start_page + 1 ||
      new Set(pages).size !== pages.length ||
      pages.some(
        (page) => page < result.start_page || page > result.end_page,
      ) ||
      (result.ocr_pages &&
        (new Set(result.ocr_pages).size !== result.ocr_pages.length ||
          result.ocr_pages.some((page) => !pages.includes(page)))) ||
      (result.source_type === "image" &&
        (result.page_count !== 1 ||
          result.start_page !== 1 ||
          result.end_page !== 1 ||
          result.ocr_pages?.join() !== "1"))
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid PDF page references" });
    }
  });
export type PdfResult = z.infer<typeof pdfResultSchema>;
export type OcrMode = "auto" | "always" | "off";
export type Corners = [number, number][];
export const fullPhoto: Corners = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];
export type RecognitionOptions = {
  engine: "local" | "vision";
  enhance: boolean;
  cloudConsent: boolean;
};
const localOptions: RecognitionOptions = {
  engine: "local",
  enhance: true,
  cloudConsent: false,
};

function recognitionParams(options: RecognitionOptions) {
  if (options.engine === "vision" && !options.cloudConsent)
    throw new Error(
      "Allow sending the selected images to OpenAI before using handwriting vision.",
    );
  return {
    engine: options.engine,
    enhance: String(options.enhance),
    cloud_consent: String(options.cloudConsent),
  };
}

export async function extractPdf(
  file: File,
  start: number,
  end: number | null,
  signal: AbortSignal,
  ocr: OcrMode = "auto",
  options: RecognitionOptions = localOptions,
): Promise<PdfResult> {
  const params = new URLSearchParams({
    start_page: String(start),
    ocr,
    ...recognitionParams(options),
  });
  if (end !== null) params.set("end_page", String(end));
  return extractFile(file, `/api/import/pdf?${params}`, signal, "PDF");
}

export function extractImage(
  file: File,
  rotation: number,
  signal: AbortSignal,
  options: RecognitionOptions = localOptions,
  corners?: number[][],
) {
  const params = new URLSearchParams({
    rotation: String(rotation),
    ...recognitionParams(options),
  });
  if (corners) params.set("corners", JSON.stringify(corners));
  return extractFile(file, `/api/import/image?${params}`, signal, "image");
}

async function extractFile(
  file: File,
  url: string,
  signal: AbortSignal,
  kind: string,
): Promise<PdfResult> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel);
  if (signal.aborted) controller.abort();
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 100_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : "Import is unavailable. Restart the Python server and try again.",
      );
    const parsed = pdfResultSchema.safeParse(data);
    if (!parsed.success)
      throw new Error(
        `The server returned an invalid ${kind} preview. Your notes have not changed.`,
      );
    return parsed.data;
  } catch (error) {
    if (timedOut)
      throw new Error(
        "Text extraction timed out. Try fewer pages or a smaller file.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Could not connect to the Python server. Start it on port 8000 and retry the import.",
      );
    if (error instanceof SyntaxError)
      throw new Error(
        "Import is unavailable. Restart the Python server and try again.",
      );
    throw error;
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
