import json
import subprocess
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend import main, pdf_import
from backend.pdf_import import (
    MAX_PDF_BYTES,
    PdfImportError,
    extract_pdf_text,
    import_pdf_in_worker,
)
from backend.tests.pdf_fixtures import LECTURE_PAGES, make_pdf

client = TestClient(main.app)


def test_real_pdf_text_and_page_order_are_preserved():
    result = extract_pdf_text(make_pdf(LECTURE_PAGES))
    assert result["page_count"] == 2
    assert result["imported_pages"] == [1, 2]
    assert result["empty_pages"] == []
    assert "Photosynthesis converts light" in result["text"]
    assert result["text"].index("[PDF page 1]") < result["text"].index("[PDF page 2]")


def test_extracts_only_selected_pages():
    result = extract_pdf_text(make_pdf(LECTURE_PAGES), 2, 2)
    assert result["start_page"] == result["end_page"] == 2
    assert "[PDF page 1]" not in result["text"]
    assert "[PDF page 2]" in result["text"]
    assert "The Calvin cycle" in result["text"]


def test_partial_empty_pages_are_reported():
    result = extract_pdf_text(make_pdf([LECTURE_PAGES[0], None]))
    assert result["empty_pages"] == [2]
    assert any("skipped" in warning for warning in result["warnings"])


@pytest.mark.parametrize(
    "data, message",
    [
        (b"", "empty"),
        (b"Not a PDF", "not a valid PDF"),
        (b"%PDF-1.7\nbroken", "damaged or unsupported"),
        (make_pdf([]), "no pages"),
        (make_pdf([None]), "No readable text"),
        (make_pdf([None], image_only=True), "OCR"),
        (make_pdf(LECTURE_PAGES, password="password"), "password-protected"),
    ],
)
def test_invalid_empty_scanned_and_locked_files(data, message):
    with pytest.raises(PdfImportError, match=message):
        extract_pdf_text(data)


@pytest.mark.parametrize("start,end", [(0, None), (-1, 1), (2, 1), (3, None), (1, 3)])
def test_invalid_ranges_are_rejected(start, end):
    with pytest.raises(PdfImportError):
        extract_pdf_text(make_pdf(LECTURE_PAGES), start, end)


def test_limits_upload_document_pages_selected_pages_and_text():
    with pytest.raises(PdfImportError, match="10 MB"):
        extract_pdf_text(b"%PDF-1.7\n" + b"x" * MAX_PDF_BYTES)
    with pytest.raises(PdfImportError, match="200 pages"):
        extract_pdf_text(make_pdf([None] * 201))
    pages = make_pdf(["A short lesson."] * 21)
    with pytest.raises(PdfImportError, match="20 pages"):
        extract_pdf_text(pages)
    assert len(extract_pdf_text(pages, 1, 20)["imported_pages"]) == 20
    with pytest.raises(PdfImportError, match="too much text"):
        extract_pdf_text(make_pdf(["A" * 100_001]))


def test_a_long_preview_is_returned_without_silently_truncating_notes():
    text = "A lesson about photosynthesis. " * 900
    result = extract_pdf_text(make_pdf([text]))
    assert len(result["text"]) > 20_000
    assert text.strip() in result["text"]


def test_compressed_content_limit_is_enforced():
    data = make_pdf(["X" * (pdf_import.MAX_STREAM_BYTES + 1)], compressed=True)
    with pytest.raises(PdfImportError, match="too complex"):
        extract_pdf_text(data)


def test_real_worker_and_http_endpoint_work_without_an_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    data = make_pdf(LECTURE_PAGES)
    result = import_pdf_in_worker(data, 1, 2)
    response = client.post(
        "/api/import/pdf?start_page=1&end_page=2",
        content=data,
        headers={"Content-Type": "application/pdf"},
    )
    assert response.status_code == 200
    assert response.json() == result
    assert "[PDF page 2]" in response.json()["text"]


@pytest.mark.parametrize(
    "query", ["start_page=no", "start_page=0", "end_page=-1", "start_page=2&end_page=1"]
)
def test_endpoint_rejects_invalid_page_parameters(query):
    response = client.post(f"/api/import/pdf?{query}", content=make_pdf(LECTURE_PAGES))
    assert response.status_code == 422
    assert "valid page numbers" in response.json()["error"]


def test_endpoint_rejects_cross_origin_and_large_uploads():
    assert (
        client.post(
            "/api/import/pdf",
            content=make_pdf(LECTURE_PAGES),
            headers={"Origin": "https://untrusted.test"},
        ).status_code
        == 403
    )
    response = client.post("/api/import/pdf", content=b"x" * (MAX_PDF_BYTES + 1))
    assert response.status_code == 413
    assert "10 MB" in response.json()["error"]


def test_worker_timeout_is_helpful(monkeypatch):
    def timed_out(*args, **kwargs):
        raise subprocess.TimeoutExpired("pdf-worker", 20)

    monkeypatch.setattr(pdf_import.subprocess, "run", timed_out)
    with pytest.raises(PdfImportError, match="too long") as error:
        import_pdf_in_worker(make_pdf(LECTURE_PAGES), 1, None)
    assert error.value.status == 504


def test_busy_worker_rejects_more_work(monkeypatch):
    monkeypatch.setattr(pdf_import, "_workers", SimpleNamespace(acquire=lambda **kw: False))
    with pytest.raises(PdfImportError, match="busy") as error:
        import_pdf_in_worker(b"", 1, None)
    assert error.value.status == 503


def test_worker_errors_are_redacted_and_returned(monkeypatch):
    for payload in [b"not-json", json.dumps({"error": "An invalid PDF.", "status": 422}).encode()]:
        monkeypatch.setattr(
            pdf_import.subprocess,
            "run",
            lambda *a, **kw: SimpleNamespace(returncode=0, stdout=payload),
        )
        response = client.post("/api/import/pdf", content=make_pdf(LECTURE_PAGES))
        assert response.status_code in (422, 500)
        assert "Traceback" not in response.text
