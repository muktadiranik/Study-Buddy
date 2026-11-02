import { useEffect, useRef, useState } from "react";
import { FileText, LoaderCircle, Upload } from "lucide-react";
import { MAX_NOTES } from "../lib/models";
import { PageCrop } from "./PageCrop";
import {
  MAX_PDF_BYTES,
  MAX_PDF_PREVIEW,
  extractPdf,
  extractImage,
  type OcrMode,
  type PdfResult,
  fullPhoto,
  type Corners,
} from "../lib/pdf";

export function PdfImport({
  onApply,
  onPendingChange,
  hasNotes,
  disabled,
}: {
  onApply: (text: string, filename: string) => void;
  onPendingChange: (pending: boolean) => void;
  hasNotes: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"PDF" | "image">("PDF");
  const [ocr, setOcr] = useState<OcrMode>("auto");
  const [rotation, setRotation] = useState(0);
  const [engine, setEngine] = useState<"local" | "vision">("local");
  const [enhance, setEnhance] = useState(true);
  const [cloudConsent, setCloudConsent] = useState(false);
  const [cropEnabled, setCropEnabled] = useState(false);
  const [corners, setCorners] = useState<Corners>(fullPhoto);
  const [file, setFile] = useState<File | null>(null);
  const [start, setStart] = useState("1"),
    [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PdfResult | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  function cancel() {
    active.current?.abort();
    active.current = null;
    setLoading(false);
    onPendingChange(false);
  }
  function close() {
    cancel();
    setOpen(false);
    setPreview(null);
    setFile(null);
    setText("");
    setError("");
    setStart("1");
    setEnd("");
    setRotation(0);
    setOcr("auto");
    setEngine("local");
    setEnhance(true);
    setCloudConsent(false);
    setCropEnabled(false);
    setCorners(fullPhoto);
  }
  function discardPreview() {
    setPreview(null);
    onPendingChange(false);
    setError("");
  }
  function changeRange(value: string, which: "start" | "end") {
    if (which === "start") setStart(value);
    else setEnd(value);
    discardPreview();
  }
  async function read(selected: File | null = file) {
    if (!selected) return;
    setError("");
    if (engine === "vision" && !cloudConsent) {
      setError(
        "Allow sending the selected images to OpenAI before using handwriting vision.",
      );
      return;
    }
    if (
      !(kind === "PDF" ? /\.pdf$/i : /\.(png|jpe?g|webp)$/i).test(selected.name)
    ) {
      setError(
        kind === "PDF"
          ? "Choose a .pdf file. Use Import .txt for plain text files."
          : "Choose a PNG, JPEG, or WebP image.",
      );
      return;
    }
    if (!selected.size) {
      setError(`This ${kind} is empty. Choose a file containing study notes.`);
      return;
    }
    if (selected.size > MAX_PDF_BYTES) {
      setError(`This ${kind} is larger than 10 MB. Upload a smaller file.`);
      return;
    }
    const from = Number(start),
      to = end.trim() ? Number(end) : null;
    if (
      !Number.isInteger(from) ||
      from < 1 ||
      from > 200 ||
      (to !== null && (!Number.isInteger(to) || to < from || to > 200))
    ) {
      setError(
        "Choose valid page numbers between 1 and 200, with the end after the start.",
      );
      return;
    }
    if (to !== null && to - from + 1 > 20) {
      setError("Import up to 20 pages at a time. Choose a smaller page range.");
      return;
    }
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setPreview(null);
    onPendingChange(true);
    try {
      const result =
        kind === "PDF"
          ? await extractPdf(selected, from, to, controller.signal, ocr, {
              engine,
              enhance,
              cloudConsent,
            })
          : await extractImage(
              selected,
              rotation,
              controller.signal,
              {
                engine,
                enhance,
                cloudConsent,
              },
              cropEnabled ? corners : undefined,
            );
      if (active.current !== controller) return;
      setPreview(result);
      setText(result.text);
    } catch (error) {
      if (active.current !== controller) return;
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Could not read the file. Try another file.",
        );
      onPendingChange(false);
    } finally {
      if (active.current === controller) {
        setLoading(false);
        active.current = null;
      }
    }
  }

  return (
    <section className="pdf-import">
      <div className="pdf-import-heading">
        <button
          className="button secondary compact"
          type="button"
          disabled={disabled}
          aria-expanded={open && kind === "PDF"}
          onClick={() => {
            if (open && kind === "PDF") close();
            else {
              close();
              setKind("PDF");
              setOpen(true);
            }
          }}
        >
          <FileText size={16} />
          {open && kind === "PDF" ? "Close PDF import" : "Import PDF"}
        </button>
        <button
          className="button secondary compact"
          type="button"
          disabled={disabled}
          aria-expanded={open && kind === "image"}
          onClick={() => {
            if (open && kind === "image") close();
            else {
              close();
              setKind("image");
              setOpen(true);
            }
          }}
        >
          <Upload size={16} />
          {open && kind === "image" ? "Close image import" : "Import image"}
        </button>
        <span className="small muted">
          Upload lecture notes or study materials.
        </span>
      </div>
      {open && (
        <div className="pdf-import-box">
          <p className="small muted">
            {kind === "PDF"
              ? "PDFs up to 10 MB and 200 pages. Extract up to 20 pages, including up to 5 scanned pages with OCR, per import."
              : "PNG, JPEG, or WebP, up to 10 MB and 20 megapixels. Use a clear, well-lit photo of upright English notes."}{" "}
            {engine === "local"
              ? "Local OCR runs on this app’s Python server. Files are not sent to OpenAI. Clear printed English works best."
              : "Handwriting vision sends the selected image or PDF page images to OpenAI. It requires a server API key and may incur API charges."}{" "}
            Always check the preview for missing or misread words.
          </p>
          <div className="pdf-upload-row">
            <label className="import-button">
              <Upload size={15} />
              Choose {kind}
              <input
                key={kind}
                type="file"
                accept={
                  kind === "PDF"
                    ? ".pdf,application/pdf"
                    : ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                }
                aria-label={`Choose ${kind}`}
                disabled={loading || disabled}
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  e.target.value = "";
                  if (selected) {
                    setFile(selected);
                    setCropEnabled(false);
                    setCorners(fullPhoto);
                    setPreview(null);
                    onPendingChange(false);
                    if (engine === "vision") setCloudConsent(false);
                    else void read(selected);
                  }
                }}
              />
            </label>
            {file && <span className="small pdf-filename">{file.name}</span>}
          </div>
          <div className="ocr-settings">
            <label className="ocr-engine-label">
              Recognition method
              <select
                aria-label="Recognition method"
                value={engine}
                disabled={loading || (kind === "PDF" && ocr === "off")}
                onChange={(e) => {
                  setEngine(e.target.value as "local" | "vision");
                  setCloudConsent(false);
                  discardPreview();
                }}
              >
                <option value="local">Local OCR — printed notes</option>
                <option value="vision">Handwriting vision — OpenAI</option>
              </select>
            </label>
            <label className="ocr-check">
              <input
                type="checkbox"
                checked={enhance}
                disabled={loading}
                onChange={(e) => {
                  setEnhance(e.target.checked);
                  discardPreview();
                }}
              />
              Improve phone photo: straighten the page and reduce shadows
            </label>
            <p className="small muted">
              Use a close, focused photo with the whole page visible. If
              preparation removes useful detail, turn it off and read again. Use
              the rotation control for sideways pages.
            </p>
            {engine === "vision" && (
              <label className="ocr-check notice">
                <input
                  type="checkbox"
                  checked={cloudConsent}
                  disabled={loading || !file}
                  onChange={(e) => {
                    setCloudConsent(e.target.checked);
                    discardPreview();
                  }}
                />
                Allow sending this file’s selected page images to OpenAI for
                transcription. API charges may apply. Unreadable words should
                appear as [unclear].
              </label>
            )}
          </div>
          {kind === "image" && file && (
            <>
              <label className="ocr-check">
                <input
                  type="checkbox"
                  checked={cropEnabled}
                  disabled={loading}
                  onChange={(e) => {
                    setCropEnabled(e.target.checked);
                    setRotation(0);
                    discardPreview();
                  }}
                />
                Select one page to crop and straighten
              </label>
              {cropEnabled && (
                <PageCrop
                  file={file}
                  points={corners}
                  disabled={loading}
                  onChange={(points) => {
                    setCorners(points);
                    discardPreview();
                  }}
                />
              )}
            </>
          )}
          <div
            className="pdf-range"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
                e.preventDefault();
                if (!loading && file && !preview) void read();
              }
            }}
          >
            {kind === "PDF" ? (
              <>
                <label>
                  Start page
                  <input
                    aria-label="PDF start page"
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    value={start}
                    disabled={loading}
                    onChange={(e) => changeRange(e.target.value, "start")}
                  />
                </label>
                <label>
                  End page (optional)
                  <input
                    aria-label="PDF end page"
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    value={end}
                    placeholder="Last page"
                    disabled={loading}
                    onChange={(e) => changeRange(e.target.value, "end")}
                  />
                </label>
              </>
            ) : (
              <label>
                Rotate image clockwise
                <select
                  aria-label="Rotate image clockwise"
                  value={rotation}
                  disabled={loading || cropEnabled}
                  onChange={(e) => {
                    setRotation(Number(e.target.value));
                    discardPreview();
                  }}
                >
                  <option value={0}>No extra rotation</option>
                  <option value={90}>90° clockwise</option>
                  <option value={180}>180°</option>
                  <option value={270}>270° clockwise</option>
                </select>
              </label>
            )}
            {kind === "PDF" && (
              <label>
                Text recognition
                <select
                  aria-label="Text recognition"
                  value={ocr}
                  disabled={loading}
                  onChange={(e) => {
                    setOcr(e.target.value as OcrMode);
                    if (e.target.value === "off") {
                      setEngine("local");
                      setCloudConsent(false);
                    }
                    discardPreview();
                  }}
                >
                  <option value="auto">Automatic: text, then OCR</option>
                  <option value="always">Always OCR (up to 5 pages)</option>
                  <option value="off">Text only (no OCR)</option>
                </select>
              </label>
            )}
            <button
              className="button secondary"
              type="button"
              disabled={
                !file ||
                loading ||
                !!preview ||
                (engine === "vision" && !cloudConsent)
              }
              onClick={() => void read()}
            >
              {loading ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <FileText size={15} />
              )}
              {loading
                ? "Extracting…"
                : kind === "PDF"
                  ? "Extract pages"
                  : "Read image"}
            </button>
          </div>
          {loading && (
            <div className="pdf-loading" role="status">
              <LoaderCircle className="spin" size={17} />
              <span>
                {engine === "vision"
                  ? "Transcribing with OpenAI."
                  : "Reading text locally."}{" "}
                OCR can take up to 90 seconds. Your current notes are unchanged.
              </span>
              <button type="button" className="text-button" onClick={cancel}>
                Cancel extraction
              </button>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {preview && (
            <div className="pdf-preview">
              <h3>{kind === "PDF" ? "PDF" : "Image"} text preview</h3>
              <p className="small muted">
                {kind === "PDF"
                  ? `Pages ${preview.start_page}–${preview.end_page} of ${preview.page_count} · ${preview.imported_pages.length} pages with text. `
                  : `Image recognized with ${preview.ocr_engine === "vision" ? "OpenAI handwriting vision" : "local OCR"}. `}
                {kind === "PDF" &&
                  !!preview.ocr_pages?.length &&
                  `OCR used on pages ${preview.ocr_pages.join(", ")}. `}
                Check the reading order, spelling, formulas, and any tables
                before using these notes.
              </p>
              {preview.warnings.map((warning, i) => (
                <p className="notice" key={i}>
                  {warning}
                </p>
              ))}
              <label htmlFor="pdf-preview-text">
                Extracted {kind} text (editable)
              </label>
              <textarea
                id="pdf-preview-text"
                rows={8}
                maxLength={MAX_PDF_PREVIEW}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <p
                className={`small ${text.length > MAX_NOTES ? "pdf-over-limit" : "muted"}`}
              >
                {text.length.toLocaleString()} / 20,000 note characters.{" "}
                {text.length > MAX_NOTES
                  ? "Shorten the preview or extract fewer pages before importing."
                  : "Page labels will stay in your notes for source checking."}
              </p>
              {hasNotes && (
                <p className="small muted">
                  Applying this preview replaces the notes in this editor.
                  Discarding it keeps your current notes.
                </p>
              )}
              <div className="button-row">
                <button
                  className="button primary"
                  type="button"
                  disabled={!text.trim() || text.length > MAX_NOTES}
                  onClick={() => {
                    onApply(text.trim(), file!.name);
                    close();
                  }}
                >
                  {hasNotes
                    ? `Replace notes with ${kind} text`
                    : "Use extracted text"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={close}
                >
                  Discard {kind} preview
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
