import sys

import pytest

from scripts import check_live_ocr, check_real_ocr


def test_live_checker_requires_explicit_permission_before_doing_work(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["check_live_ocr"])
    monkeypatch.setattr(check_live_ocr, "fixtures", lambda *args: pytest.fail("Must stop first"))
    monkeypatch.setattr(
        check_live_ocr, "run_check", lambda *args: pytest.fail("No API calls allowed")
    )
    with pytest.raises(SystemExit) as result:
        check_live_ocr.main()
    assert result.value.code == 2


def test_real_photo_checker_requires_explicit_action(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["check_real_ocr"])
    monkeypatch.setattr(check_real_ocr, "original_file", lambda *a: pytest.fail("No download"))
    monkeypatch.setattr(check_real_ocr, "evaluate", lambda *a: pytest.fail("No API"))
    with pytest.raises(SystemExit) as result:
        check_real_ocr.main()
    assert result.value.code == 2


def test_real_photo_scoring_ignores_punctuation_but_keeps_source_words():
    sample = {"anchors": ["the image", "August 9, 2019"]}
    checks = check_real_ocr.anchor_checks(sample, {"text": "The image. August 9, 2018"})
    assert checks[0]["matched"] is True
    assert checks[1]["matched"] is False
