"""Internal PDF worker: bytes through stdin, bounded JSON through stdout; no files."""

import json
import sys

from backend.ocr import extract_image_text
from backend.pdf_import import MAX_PDF_BYTES, PdfImportError, extract_pdf_text


def main():
    try:
        kind = sys.argv[1]
        start_page = int(sys.argv[2])
        end_page = None if sys.argv[3] == "all" else int(sys.argv[3])
        data = sys.stdin.buffer.read(MAX_PDF_BYTES + 1)
        engine = sys.argv[6]
        enhance = sys.argv[7] == "true"
        corners = None if sys.argv[8] == "none" else json.loads(sys.argv[8])
        if kind == "image":
            result = extract_image_text(data, int(sys.argv[5]), engine, enhance, corners)
        else:
            result = extract_pdf_text(data, start_page, end_page, sys.argv[4], engine, enhance)
    except PdfImportError as exc:
        result = {"error": str(exc), "status": exc.status}
    except Exception:
        result = {
            "error": "The file could not be processed. "
            "Check the OCR dependencies or try another file.",
            "status": 422,
        }
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=True).encode("utf-8"))


if __name__ == "__main__":
    main()
