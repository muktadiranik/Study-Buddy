"""Bounded PDF text extraction. Uploads and extracted notes are never written to disk."""

import json
import re
import subprocess
import sys
import threading
from io import BytesIO
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, model_validator
from pypdf import PdfReader, apply_configuration
from pypdf.errors import LimitReachedError

MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 200
MAX_SELECTED_PAGES = 20
MAX_PREVIEW_CHARACTERS = 100_000
MAX_STREAM_BYTES = 4_000_000
EXTRACTION_TIMEOUT = 20
OCR_TIMEOUT = 90
_workers = threading.BoundedSemaphore(2)


class PdfImportError(Exception):
    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.status = status


class PdfImportResult(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_PREVIEW_CHARACTERS)
    page_count: int = Field(ge=1, le=MAX_PDF_PAGES)
    start_page: int = Field(ge=1, le=MAX_PDF_PAGES)
    end_page: int = Field(ge=1, le=MAX_PDF_PAGES)
    imported_pages: list[int] = Field(min_length=1, max_length=MAX_SELECTED_PAGES)
    empty_pages: list[int] = Field(max_length=MAX_SELECTED_PAGES)
    warnings: list[str] = Field(max_length=10)
    source_type: Literal["pdf", "image"] = "pdf"
    ocr_pages: list[int] = Field(default_factory=list, max_length=5)
    ocr_engine: Literal["local", "vision"] = "local"

    @model_validator(mode="after")
    def valid_pages(self):
        pages = self.imported_pages + self.empty_pages
        expected = list(range(self.start_page, self.end_page + 1))
        if (
            not self.imported_pages
            or self.end_page > self.page_count
            or len(expected) > MAX_SELECTED_PAGES
            or sorted(pages) != expected
            or len(set(self.ocr_pages)) != len(self.ocr_pages)
            or not set(self.ocr_pages).issubset(pages)
        ):
            raise ValueError("Inconsistent import page references")
        if self.source_type == "image" and (
            expected != [1] or self.page_count != 1 or self.ocr_pages != [1]
        ):
            raise ValueError("Inconsistent image references")
        return self


def extract_pdf_text(
    data: bytes,
    start_page: int = 1,
    end_page: int | None = None,
    ocr: str = "auto",
    engine: str = "local",
    enhance: bool = True,
) -> dict:
    """Read source pages in order; keep a PDF page label inside every note paragraph."""
    if not data:
        raise PdfImportError("This PDF is empty. Choose a file containing study notes.")
    if len(data) > MAX_PDF_BYTES:
        raise PdfImportError("This PDF is larger than 10 MB. Upload a smaller PDF.", 413)
    if b"%PDF-" not in data[:1024]:
        raise PdfImportError("This file is not a valid PDF. Choose a .pdf file.")
    if start_page < 1 or (end_page is not None and end_page < start_page):
        raise PdfImportError(
            "Use a page range starting at 1 or later, with the end after the start."
        )
    if ocr not in {"auto", "always", "off"}:
        raise PdfImportError("Choose automatic OCR, always OCR, or text only.")
    document = None
    recognition_warnings = []
    try:
        with apply_configuration(
            maximum_declared_stream_length=MAX_STREAM_BYTES,
            array_based_stream_maximum_output_length=MAX_STREAM_BYTES,
            zlib_maximum_output_length=MAX_STREAM_BYTES,
            lzw_maximum_output_length=MAX_STREAM_BYTES,
            run_length_maximum_output_length=MAX_STREAM_BYTES,
            stream_decoding_work_maximum_length=16_000_000,
            stream_parsing_work_maximum_count=500_000,
            page_tree_maximum_entries=1_000,
            xform_maximum_invocations_per_extraction=1_000,
            jbig2dec_binary=None,
        ):
            reader = PdfReader(
                BytesIO(data), root_object_recovery_limit=1_000, xref_stream_maximum_entries=250_000
            )
            if reader.is_encrypted:
                raise PdfImportError(
                    "This PDF is password-protected. Export an unlocked copy and import that copy."
                )
            count = len(reader.pages)
            if not count:
                raise PdfImportError("This PDF has no pages. Choose another file.")
            if count > MAX_PDF_PAGES:
                raise PdfImportError(
                    "This PDF has more than 200 pages. Split it into smaller files."
                )
            end = count if end_page is None else end_page
            if start_page > count or end > count:
                raise PdfImportError(
                    f"This PDF has {count} pages. Choose a range within pages 1–{count}."
                )
            if end - start_page + 1 > MAX_SELECTED_PAGES:
                raise PdfImportError(
                    f"This PDF has {count} pages. "
                    "Import up to 20 pages at a time using the page range."
                )
            parts: list[str] = []
            imported, empty = [], []
            ocr_pages = []
            content_bytes = 0
            text_units = 0
            native_pages = {}
            for number in range(start_page, end + 1):
                if ocr == "always":
                    # Bypass a damaged or misleading text layer when the user requests OCR.
                    native_pages[number] = ""
                    continue
                page = reader.pages[number - 1]
                contents = page.get_contents()
                content_bytes += len(contents.get_data()) if contents else 0
                if content_bytes > 16_000_000:
                    raise PdfImportError("These pages are too complex. Import fewer pages.", 413)
                raw = (page.extract_text() or "").replace("\r\n", "\n").replace("\r", "\n")
                raw = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", raw)
                native_pages[number] = raw
            if ocr != "off":
                from backend.ocr import MAX_OCR_PAGES, recognize_images, render_page

                ocr_pages = [
                    n for n, raw in native_pages.items() if ocr == "always" or not raw.strip()
                ]
                if len(ocr_pages) > MAX_OCR_PAGES:
                    raise PdfImportError(
                        "OCR supports up to 5 scanned pages per import. "
                        "Choose a smaller page range."
                    )
                if ocr_pages:
                    import pypdfium2 as pdfium

                    document = pdfium.PdfDocument(data)
                    images = {}
                    try:
                        for number in ocr_pages:
                            images[number] = render_page(document, number)
                        texts, recognition_warnings = recognize_images(images, engine, enhance)
                        native_pages.update(texts)
                    finally:
                        for image in images.values():
                            image.close()
            for number, raw in native_pages.items():
                paragraphs = [p.strip() for p in re.split(r"\n\s*\n", raw) if p.strip()]
                if not paragraphs:
                    empty.append(number)
                    continue
                imported.append(number)
                for paragraph in paragraphs:
                    label = f"[PDF page {number}]" + (" (OCR)" if number in ocr_pages else "")
                    part = f"{label}\n{paragraph}"
                    # Match JavaScript's character count, including surrogate pairs.
                    text_units += len(part.encode("utf-16-le")) // 2 + (2 if parts else 0)
                    if text_units > MAX_PREVIEW_CHARACTERS:
                        raise PdfImportError(
                            "These pages contain too much text. Import fewer pages."
                        )
                    parts.append(part)
            if not parts:
                raise PdfImportError(
                    "No readable text was found on these pages. "
                    "Try automatic OCR or a clearer scan with upright English text."
                )
            text = "\n\n".join(parts)
            warnings = recognition_warnings
            if empty:
                warnings.append(
                    "No text was found on pages "
                    + ", ".join(map(str, empty))
                    + ". These pages were skipped; check the original for missing content."
                )
            if sum(char.isalnum() for char in text) < 50:
                warnings.append(
                    "Very little text was extracted. Check for missing text or scanned content."
                )
            return PdfImportResult(
                text=text,
                page_count=count,
                start_page=start_page,
                end_page=end,
                imported_pages=imported,
                empty_pages=empty,
                warnings=warnings,
                ocr_pages=ocr_pages,
                ocr_engine=engine if ocr_pages else "local",
            ).model_dump()
    except PdfImportError:
        raise
    except LimitReachedError as exc:
        raise PdfImportError(
            "This PDF is too complex to import. Try fewer pages or a simpler PDF.", 413
        ) from exc
    except Exception as exc:
        raise PdfImportError(
            "This PDF could not be read. It may be damaged or unsupported. Try exporting a new PDF."
        ) from exc
    finally:
        if document is not None:
            document.close()


def import_pdf_in_worker(
    data: bytes,
    start_page: int,
    end_page: int | None,
    ocr: str = "auto",
    engine: str = "local",
    enhance: bool = True,
) -> dict:
    return import_in_worker(data, "pdf", start_page, end_page, ocr, engine=engine, enhance=enhance)


def import_in_worker(
    data: bytes,
    kind: str,
    start_page: int = 1,
    end_page: int | None = None,
    ocr: str = "auto",
    rotation: int = 0,
    engine: str = "local",
    enhance: bool = True,
    corners: list[list[float]] | None = None,
) -> dict:
    """A short-lived process enforces the time limit, including on Windows reload servers."""
    if not _workers.acquire(blocking=False):
        raise PdfImportError("Import is busy. Wait a moment, then try again.", 503)
    try:
        try:
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "backend.pdf_worker",
                    kind,
                    str(start_page),
                    str(end_page) if end_page is not None else "all",
                    ocr,
                    str(rotation),
                    engine,
                    "true" if enhance else "false",
                    json.dumps(corners) if corners is not None else "none",
                ],
                input=data,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                timeout=EXTRACTION_TIMEOUT if kind == "pdf" and ocr == "off" else OCR_TIMEOUT,
                check=False,
                cwd=Path(__file__).resolve().parent.parent,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except subprocess.TimeoutExpired as exc:
            raise PdfImportError(
                "Text extraction took too long. Try fewer pages or a smaller file.", 504
            ) from exc
        if result.returncode != 0 or len(result.stdout) > 1_000_000:
            raise PdfImportError("The file could not be processed. Try another file.")
        payload = json.loads(result.stdout)
        if "error" in payload:
            raise PdfImportError(payload["error"], payload.get("status", 422))
        return PdfImportResult.model_validate(payload).model_dump()
    finally:
        _workers.release()
