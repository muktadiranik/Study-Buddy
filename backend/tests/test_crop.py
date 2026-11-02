import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend import main
from backend.crop import crop_page, validate_corners
from backend.ocr import LocalOcr
from backend.pdf_import import PdfImportError
from backend.tests.ocr_fixtures import phone_photo


@pytest.mark.parametrize(
    "points",
    [
        [],
        [[0, 0]] * 4,
        [[0, 0], [100, 100], [100, 0], [0, 100]],
        [[0, 0], [True, 0], [100, 100], [0, 100]],
        [[0, 0], [float("nan"), 0], [100, 100], [0, 100]],
        [[0, 0], [10**400, 0], [100, 100], [0, 100]],
        [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]],
    ],
)
def test_invalid_or_crossed_corners_are_rejected(points):
    with pytest.raises(PdfImportError, match="corners"):
        validate_corners(points)


def test_real_local_recognition_after_explicit_page_rectification():
    corners = [
        [230 / 1800 * 100, 190 / 1300 * 100],
        [1620 / 1800 * 100, 100 / 1300 * 100],
        [1570 / 1800 * 100, 1040 / 1300 * 100],
        [150 / 1800 * 100, 1150 / 1300 * 100],
    ]
    corrected = crop_page(phone_photo(), corners)
    text, _ = LocalOcr().read(corrected)
    assert "Photosynthesis converts light into chemical energy" in text
    assert "Calvin cycle" in text


def test_crop_output_respects_image_budget():
    result = crop_page(
        Image.new("RGB", (4000, 3000), "white"), [[0, 0], [100, 0], [100, 100], [0, 100]]
    )
    assert max(result.size) <= 3600
    assert result.width * result.height <= 8_000_000


def test_bad_crop_is_rejected_before_starting_a_worker(monkeypatch):
    monkeypatch.setattr(main, "import_in_worker", lambda *a, **kw: pytest.fail("Must not start"))
    response = TestClient(main.app).post("/api/import/image?corners=invalid", content=b"x")
    assert response.status_code == 422


def test_corner_selection_reaches_image_worker(monkeypatch):
    corners = [[5, 5], [95, 5], [95, 95], [5, 95]]
    received = []

    def fake(*args, **kwargs):
        received.append(kwargs)
        return {"text": "selected page"}

    monkeypatch.setattr(main, "import_in_worker", fake)
    response = TestClient(main.app).post(
        "/api/import/image", params={"corners": json.dumps(corners)}, content=b"x"
    )
    assert response.status_code == 200
    assert received[0]["corners"] == corners
