import numpy as np
from PIL import Image, ImageDraw

from backend.ocr import LocalOcr
from backend.photo import flatten, prepare_photo, tilt_angle
from backend.tests.ocr_fixtures import note_image, phone_photo


def test_real_recognition_survives_phone_perspective_shadow_and_jpeg():
    image = phone_photo()
    prepared, changes = prepare_photo(image)
    assert any("perspective" in change for change in changes)
    assert any("lighting" in change for change in changes)
    text, _ = LocalOcr().read(prepared)
    assert "Photosynthesis converts light into chemical energy" in text
    assert "Chlorophyll absorbs light in chloroplasts" in text
    assert "Calvin cycle" in text
    assert max(prepared.size) <= 2400


def test_deskew_moves_tilted_text_toward_horizontal_without_clipping():
    image = note_image().rotate(7, expand=True, fillcolor="white")
    before = tilt_angle(np.array(image.convert("L")))
    prepared, changes = prepare_photo(image)
    after = tilt_angle(np.array(prepared.convert("L")))
    assert abs(before) >= 5
    assert abs(after) <= 1
    assert "straightened tilted text" in changes
    assert prepared.width >= 1500 and prepared.height >= 800


def test_preparation_keeps_faint_pen_strokes_and_has_an_off_switch():
    image = Image.new("RGB", (1000, 800), (225, 225, 225))
    ImageDraw.Draw(image).line([(100, 300), (850, 300)], fill=(160, 160, 160), width=1)
    prepared, _ = prepare_photo(image)
    assert np.count_nonzero(np.array(prepared.convert("L")) < 220) >= 700
    unchanged, notes = prepare_photo(image, enhance=False)
    assert np.array_equal(np.array(image), np.array(unchanged))
    assert notes == []


def test_blank_pages_are_not_rotated_and_small_soft_photos_warn():
    blank = Image.new("RGB", (300, 400), "white")
    prepared, warnings = prepare_photo(blank)
    assert prepared.size == blank.size
    assert any("small image" in warning for warning in warnings)
    assert any("soft or low-detail" in warning for warning in warnings)


def test_vision_preparation_keeps_resolution_and_coloured_ink_within_budget():
    image = Image.new("RGB", (3000, 2200), "white")
    ImageDraw.Draw(image).text((150, 150), "Blue pen", fill=(20, 50, 140))
    prepared, _ = prepare_photo(image, max_side=3600, max_pixels=8_000_000, preserve_color=True)
    assert prepared.width > 2400
    assert max(prepared.size) <= 3600
    assert prepared.width * prepared.height <= 8_000_000
    pixels = np.array(prepared)
    assert np.any(pixels[:, :, 2].astype(int) - pixels[:, :, 0].astype(int) > 40)
    local, _ = prepare_photo(image)
    assert max(local.size) <= 2400


def test_large_vision_photos_are_capped_by_pixels_as_well_as_side_length():
    image = Image.new("RGB", (3600, 3600), "white")
    prepared = flatten(image, max_side=3600, max_pixels=8_000_000)
    assert prepared.width * prepared.height <= 8_000_000
