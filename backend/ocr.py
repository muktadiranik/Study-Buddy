"""Bounded OCR routing: local recognition by default, optional vision transcription."""

import math
import sys
import warnings
from contextlib import redirect_stdout
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from backend.pdf_import import MAX_PDF_BYTES, PdfImportError, PdfImportResult
from backend.photo import prepare_photo

MAX_IMAGE_PIXELS = 20_000_000
MAX_OCR_PAGES = 5
MAX_OCR_SIDE = 2400
ROTATIONS = {0, 90, 180, 270}


class LocalOcr:
    """One engine per short-lived worker; reuse it for selected PDF pages."""

    def __init__(self):
        import rapidocr
        from rapidocr import RapidOCR

        # Explicit bundled paths prevent model downloads during an import.
        models = Path(rapidocr.__file__).parent / "models"
        paths = {
            "Det.model_path": models / "PP-OCRv6_det_small.onnx",
            "Cls.model_path": models / "ch_ppocr_mobile_v2.0_cls_mobile.onnx",
            "Rec.model_path": models / "PP-OCRv6_rec_small.onnx",
        }
        if not all(path.is_file() for path in paths.values()):
            raise PdfImportError("OCR models are missing. Reinstall the Python requirements.", 503)
        with redirect_stdout(sys.stderr):
            self.engine = RapidOCR(
                params={
                    **{key: str(path) for key, path in paths.items()},
                    "Global.log_level": "error",
                    "EngineConfig.onnxruntime.intra_op_num_threads": 2,
                    "EngineConfig.onnxruntime.inter_op_num_threads": 1,
                }
            )

    def read(self, image: Image.Image) -> tuple[str, float | None]:
        image.thumbnail((MAX_OCR_SIDE, MAX_OCR_SIDE))
        # White backing preserves transparent screenshots; autocontrast helps photos.
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, "white")
        background.alpha_composite(rgba)
        prepared = ImageOps.autocontrast(background.convert("L")).convert("RGB")
        with redirect_stdout(sys.stderr):
            result = self.engine(prepared)
        lines = result.txts if result.txts is not None else []
        scores = result.scores if result.scores is not None else []
        accepted = [
            (str(t).strip(), float(s))
            for t, s in zip(lines, scores, strict=True)
            if str(t).strip() and math.isfinite(float(s))
        ]
        text = "\n".join(t for t, _ in accepted)
        # A single uncertain line deserves a warning, even if the other lines are clear.
        confidence = min(s for _, s in accepted) if accepted else None
        return text, confidence


def ocr_warnings(low_confidence: bool = False) -> list[str]:
    result = [
        "OCR was used. Check every line against the original, especially names, numbers, "
        "formulas, and reading order. Clear printed English works best; "
        "handwriting may be inaccurate."
    ]
    if low_confidence:
        result.append(
            "Some text has low recognition confidence. "
            "Correct it before saving or generating study materials."
        )
    return result


def recognize_images(
    images: dict[int, Image.Image], engine: str = "local", enhance: bool = True
) -> tuple[dict[int, str], list[str]]:
    if engine not in {"local", "vision"}:
        raise PdfImportError("Choose local OCR or handwriting vision.")
    prepared = {}
    page_notes = {}
    try:
        preparation = {}
        if engine == "vision":
            from backend.vision_ocr import vision_settings

            _, detail = vision_settings()
            preparation = {"preserve_color": True}
            if detail == "original":
                # Below GPT-5.4's 10,000-patch original-detail budget, even
                # after rounding at patch boundaries. Local OCR stays at 2400px.
                preparation.update(max_side=3600, max_pixels=8_000_000)
        for number, image in images.items():
            prepared[number], page_notes[number] = prepare_photo(image, enhance, **preparation)
        if engine == "vision":
            from backend.vision_ocr import read_handwriting

            texts, warnings = read_handwriting(prepared)
        else:
            reader = LocalOcr()
            texts, low_confidence = {}, False
            for number, image in prepared.items():
                texts[number], confidence = reader.read(image)
                low_confidence |= confidence is not None and confidence < 0.85
            warnings = ocr_warnings(low_confidence)
        # A truly blank page has no detail by definition. Do not call it a soft
        # photo and tell the student to retake it when reporting skipped pages.
        adjustments = {
            note for number, notes in page_notes.items() if texts[number].strip() for note in notes
        }
        if adjustments:
            warnings.append("Photo preparation: " + "; ".join(sorted(adjustments)) + ".")
        return texts, warnings
    finally:
        for image in prepared.values():
            image.close()


def extract_image_text(
    data: bytes,
    rotation: int = 0,
    engine: str = "local",
    enhance: bool = True,
    corners: list[list[float]] | None = None,
) -> dict:
    if not data:
        raise PdfImportError("This image is empty. Choose a photo or scan of your notes.")
    if len(data) > MAX_PDF_BYTES:
        raise PdfImportError("This image is larger than 10 MB. Upload a smaller image.", 413)
    if rotation not in ROTATIONS:
        raise PdfImportError("Choose an image rotation of 0, 90, 180, or 270 degrees.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                if source.format not in {"PNG", "JPEG", "WEBP"}:
                    raise PdfImportError(
                        "Choose a PNG, JPEG, or WebP image. Other image types are not supported."
                    )
                if source.width * source.height > MAX_IMAGE_PIXELS:
                    raise PdfImportError(
                        "This image exceeds 20 megapixels. Resize it before importing.", 413
                    )
                if getattr(source, "n_frames", 1) != 1:
                    raise PdfImportError(
                        "Choose a single still image, rather than an animated or multi-frame file."
                    )
                image = ImageOps.exif_transpose(source).convert("RGBA")
        if corners is not None:
            from backend.crop import crop_page

            cropped = crop_page(image, corners)
            image.close()
            image = cropped
        if rotation:
            image = image.rotate(-rotation, expand=True)
        try:
            texts, recognition_warnings = recognize_images({1: image}, engine, enhance)
            text = texts[1]
            if corners is not None:
                recognition_warnings.append(
                    "Only the selected page area was transcribed. "
                    "Check the corners and source for clipped text."
                )
        finally:
            image.close()
        if not text.strip():
            raise PdfImportError(
                "No readable text was found. "
                "Try a sharper, well-lit image with upright English text."
            )
        return PdfImportResult(
            text="[Image OCR]\n" + text,
            source_type="image",
            page_count=1,
            start_page=1,
            end_page=1,
            imported_pages=[1],
            empty_pages=[],
            ocr_pages=[1],
            warnings=recognition_warnings,
            ocr_engine=engine,
        ).model_dump()
    except PdfImportError:
        raise
    except (Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
        raise PdfImportError(
            "This image is too large to decode safely. Resize it before importing.", 413
        ) from exc
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise PdfImportError(
            "This image could not be read. Try exporting a new PNG or JPEG."
        ) from exc


def render_page(document, number: int) -> Image.Image:
    """PDFium handles stay inside the worker process, never shared across threads."""
    page = document[number - 1]
    try:
        width, height = page.get_size()
        if not all(math.isfinite(v) and v > 0 for v in (width, height)):
            raise PdfImportError("This PDF page has invalid dimensions. Export a new PDF.")
        scale = min(2.5, MAX_OCR_SIDE / max(width, height))
        bitmap = page.render(scale=scale)
        try:
            return bitmap.to_pil().copy()
        finally:
            bitmap.close()
    finally:
        page.close()
