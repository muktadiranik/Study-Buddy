from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

from backend import main, ocr
from backend.ocr import extract_image_text
from backend.pdf_import import PdfImportError, PdfImportResult, extract_pdf_text, import_in_worker
from backend.tests.ocr_fixtures import image_bytes, note_image, scanned_pdf
from backend.tests.pdf_fixtures import LECTURE_PAGES, make_pdf

client = TestClient(main.app)


@pytest.mark.parametrize("format,exif", [("PNG", False), ("JPEG", True), ("WEBP", False)])
def test_real_english_ocr_and_camera_orientation(format, exif):
    result = extract_image_text(image_bytes(format, exif=exif))
    assert result["source_type"] == "image"
    assert result["ocr_pages"] == [1]
    assert "Photosynthesis converts light into chemical energy" in result["text"]
    assert "Calvin cycle" in result["text"]
    assert result["text"].startswith("[Image OCR]")
    assert any("Check every line" in warning for warning in result["warnings"])


def test_real_mixed_pdf_uses_ocr_only_for_scanned_page():
    result = extract_pdf_text(scanned_pdf(mixed=True))
    assert result["ocr_pages"] == [2]
    assert result["imported_pages"] == [1, 2]
    assert "[PDF page 1]\n" in result["text"]
    assert "[PDF page 2] (OCR)" in result["text"]
    assert "Calvin cycle" in result["text"]


def test_real_manual_rotation_reads_sideways_english_notes():
    output = BytesIO()
    note_image().rotate(90, expand=True).save(output, format="PNG")
    result = extract_image_text(output.getvalue(), rotation=90)
    assert "Photosynthesis converts light into chemical energy" in result["text"]


def test_force_ocr_reads_a_native_page_and_text_only_does_not_read_a_scan():
    result = extract_pdf_text(make_pdf(LECTURE_PAGES), 1, 1, "always")
    assert result["ocr_pages"] == [1]
    assert "Photosynthesis" in result["text"]
    with pytest.raises(PdfImportError, match="No readable text"):
        extract_pdf_text(scanned_pdf(), ocr="off")


def test_native_pdf_does_not_start_ocr(monkeypatch):
    def unexpected():
        pytest.fail("Native PDF should not start OCR")

    monkeypatch.setattr(ocr, "LocalOcr", unexpected)
    assert extract_pdf_text(make_pdf(LECTURE_PAGES))["ocr_pages"] == []


def test_ocr_page_limit_is_checked_before_starting_engine(monkeypatch):
    monkeypatch.setattr(ocr, "LocalOcr", lambda: pytest.fail("Should reject before OCR"))
    with pytest.raises(PdfImportError, match="5 scanned pages"):
        extract_pdf_text(make_pdf([None] * 6))


@pytest.mark.parametrize(
    "data,message",
    [
        (b"", "empty"),
        (b"not an image", "could not be read"),
        (b"x" * (10 * 1024 * 1024 + 1), "10 MB"),
    ],
)
def test_invalid_images_are_rejected(data, message):
    with pytest.raises(PdfImportError, match=message):
        extract_image_text(data)


def test_image_formats_animation_and_decoded_size_limits():
    image = Image.new("RGB", (100, 100), "white")
    output = BytesIO()
    image.save(output, format="BMP")
    with pytest.raises(PdfImportError, match="PNG, JPEG, or WebP"):
        extract_image_text(output.getvalue())
    output = BytesIO()
    image.save(output, format="PNG", save_all=True, append_images=[Image.new("RGB", (100, 100))])
    with pytest.raises(PdfImportError, match="single still image"):
        extract_image_text(output.getvalue())
    output = BytesIO()
    Image.new("1", (5000, 4001)).save(output, format="PNG")
    with pytest.raises(PdfImportError, match="20 megapixels"):
        extract_image_text(output.getvalue())


def test_rotation_and_low_confidence_are_explicit(monkeypatch):
    seen = []

    class FakeOcr:
        def read(self, image):
            seen.append(image.size)
            return "Uncertain English text", 0.6

    monkeypatch.setattr(ocr, "LocalOcr", FakeOcr)
    result = extract_image_text(image_bytes(), rotation=90)
    assert seen == [(800, 1500)]
    assert any("low recognition confidence" in w for w in result["warnings"])
    with pytest.raises(PdfImportError, match="rotation"):
        extract_image_text(image_bytes(), rotation=45)


def test_real_image_worker_and_http_endpoint_need_no_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    data = image_bytes()
    result = import_in_worker(data, "image")
    response = client.post("/api/import/image", content=data)
    assert response.status_code == 200
    assert response.json() == result


@pytest.mark.parametrize(
    "url",
    ["/api/import/pdf?ocr=bad", "/api/import/image?rotation=45", "/api/import/image?rotation=NaN"],
)
def test_endpoint_rejects_invalid_modes(url):
    assert client.post(url, content=b"invalid").status_code == 422


def test_image_endpoint_enforces_origin_and_size():
    assert (
        client.post(
            "/api/import/image", content=b"x", headers={"Origin": "https://other.test"}
        ).status_code
        == 403
    )
    assert (
        client.post("/api/import/image", content=b"x" * (10 * 1024 * 1024 + 1)).status_code == 413
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"ocr_pages": [2]},
        {"ocr_pages": [1, 1]},
        {"empty_pages": [1]},
        {"source_type": "image", "page_count": 2},
        {"imported_pages": []},
    ],
)
def test_server_rejects_inconsistent_ocr_provenance(changes):
    result = dict(
        text="A source paragraph",
        page_count=1,
        start_page=1,
        end_page=1,
        imported_pages=[1],
        empty_pages=[],
        warnings=[],
        ocr_pages=[1],
    )
    with pytest.raises(ValidationError):
        PdfImportResult.model_validate({**result, **changes})
