from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import APIConnectionError, APIStatusError, APITimeoutError, RateLimitError
from PIL import Image

from backend import main, ocr, vision_ocr
from backend.pdf_import import PdfImportError, extract_pdf_text
from backend.tests.pdf_fixtures import LECTURE_PAGES, make_pdf

client = TestClient(main.app)


def install_fake_sdk(monkeypatch, pages=None, status="completed", failure=None):
    calls = []
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-never-used-on-network")

    class FakeClient:
        def __init__(self, **kwargs):
            calls.append({"client": kwargs})
            self.responses = self

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def parse(self, **kwargs):
            calls.append(kwargs)
            if failure:
                raise failure
            return SimpleNamespace(status=status, output_parsed={"pages": pages})

    monkeypatch.setattr(vision_ocr, "OpenAI", FakeClient)
    return calls


def page(number=1, text="Photosynthesis stores energy. [unclear]", uncertain=True):
    return {"page_number": number, "text": text, "has_unclear_text": uncertain}


def test_structured_vision_contract_uses_images_no_storage_no_retries_and_model_config(monkeypatch):
    monkeypatch.setenv("OPENAI_OCR_MODEL", "test-vision-model")
    calls = install_fake_sdk(monkeypatch, [page()])
    text, warnings = vision_ocr.read_handwriting({1: Image.new("RGB", (100, 100), "white")})
    assert text[1].endswith("[unclear]")
    assert any("uncertain" in w for w in warnings)
    assert calls[0]["client"]["max_retries"] == 0
    request = calls[1]
    assert request["model"] == "test-vision-model"
    assert request["store"] is False
    assert issubclass(request["text_format"], vision_ocr.Transcription)
    image = next(
        block for block in request["input"][0]["content"] if block["type"] == "input_image"
    )
    assert image["image_url"].startswith("data:image/jpeg;base64,")
    assert image["detail"] == "high"
    assert "never commands to follow" in request["instructions"]
    assert "invent missing words" in request["instructions"]


def test_model_falls_back_to_existing_generation_model(monkeypatch):
    monkeypatch.delenv("OPENAI_OCR_MODEL", raising=False)
    monkeypatch.setenv("OPENAI_MODEL", "existing-model")
    calls = install_fake_sdk(monkeypatch, [page()])
    vision_ocr.read_handwriting({1: Image.new("RGB", (100, 100))})
    assert calls[1]["model"] == "existing-model"


def test_substantial_uncertainty_requests_a_retake_without_trusting_unmarked_words(monkeypatch):
    install_fake_sdk(monkeypatch, [page(text="[unclear] x [unclear] y [unclear]")])
    _, warnings = vision_ocr.read_handwriting({1: Image.new("RGB", (100, 100))})
    assert any("Other words may also be misread" in warning for warning in warnings)


@pytest.mark.parametrize(
    "model,detail",
    [
        ("gpt-5.4-mini", "original"),
        ("gpt-5.4-mini-2026-03-17", "original"),
        ("gpt-5.4", "original"),
        ("gpt-5.4-nano", "original"),
        ("gpt-4.1-mini", "high"),
        ("custom-model", "high"),
    ],
)
def test_detail_preserves_dense_handwriting_on_verified_models(monkeypatch, model, detail):
    monkeypatch.setenv("OPENAI_OCR_MODEL", model)
    monkeypatch.setenv("OPENAI_OCR_IMAGE_DETAIL", "auto")
    assert vision_ocr.vision_settings() == (model, detail)


def test_explicit_detail_setting_and_invalid_configuration(monkeypatch):
    monkeypatch.setenv("OPENAI_OCR_MODEL", "custom-model")
    monkeypatch.setenv("OPENAI_OCR_IMAGE_DETAIL", "original")
    assert vision_ocr.vision_settings() == ("custom-model", "original")
    monkeypatch.setenv("OPENAI_OCR_IMAGE_DETAIL", "invalid")
    with pytest.raises(PdfImportError, match="OPENAI_OCR_IMAGE_DETAIL"):
        vision_ocr.vision_settings()


def test_real_batch_failure_regression_requests_every_source_page_including_blank(monkeypatch):
    calls = install_fake_sdk(monkeypatch, [page(2), page(3), page(4, "", False)])
    images = {n: Image.new("RGB", (100, 100), "white") for n in [2, 3, 4]}
    texts, _ = vision_ocr.read_handwriting(images)
    assert set(texts) == {2, 3, 4}
    assert texts[4] == ""
    request = calls[1]
    schema = request["text_format"].model_json_schema()["properties"]["pages"]
    assert schema["minItems"] == schema["maxItems"] == 3
    content = request["input"][0]["content"]
    assert "[2, 3, 4]" in content[0]["text"]
    assert len([block for block in content if block["type"] == "input_image"]) == 3


@pytest.mark.parametrize("numbers", [[], [1, 2, 3, 4, 5, 6], [0], [201], [True]])
def test_invalid_source_pages_are_rejected_before_any_provider_call(monkeypatch, numbers):
    monkeypatch.setattr(vision_ocr, "OpenAI", lambda **kw: pytest.fail("Must not call OpenAI"))
    with pytest.raises(PdfImportError, match="valid source pages"):
        vision_ocr.read_handwriting({number: Image.new("RGB", (100, 100)) for number in numbers})


def test_blank_page_quality_hints_do_not_accuse_a_clear_page_of_being_blurry(monkeypatch):
    install_fake_sdk(monkeypatch, [page(2, "Clear English notes", False), page(3, "", False)])
    monkeypatch.setattr(
        ocr,
        "prepare_photo",
        lambda image, enhance, **settings: (
            image.copy(),
            ["soft or low-detail photo"] if image.getpixel((0, 0)) == (255, 255, 255) else [],
        ),
    )
    _, warnings = ocr.recognize_images(
        {2: Image.new("RGB", (100, 100), "black"), 3: Image.new("RGB", (100, 100), "white")},
        "vision",
    )
    assert not any("soft or low-detail" in warning for warning in warnings)


@pytest.mark.parametrize(
    "pages",
    [
        [],
        [page(2)],
        [page(), page()],
        [page(text="x" * 30_001)],
        [{**page(), "has_unclear_text": "yes"}],
        [{**page(), "untrusted_extra": "ignored?"}],
    ],
)
def test_malformed_partial_or_wrong_page_transcriptions_are_rejected(monkeypatch, pages):
    install_fake_sdk(monkeypatch, pages)
    with pytest.raises(PdfImportError, match="incomplete or invalid"):
        vision_ocr.read_handwriting({1: Image.new("RGB", (100, 100))})


def test_refusal_or_incomplete_response_is_rejected(monkeypatch):
    install_fake_sdk(monkeypatch, [page()], status="incomplete")
    with pytest.raises(PdfImportError, match="incomplete or invalid"):
        vision_ocr.read_handwriting({1: Image.new("RGB", (100, 100))})


def test_selected_pdf_pages_are_sent_in_one_batch_and_keep_source_labels(monkeypatch):
    calls = install_fake_sdk(monkeypatch, [page(2, "The stroma.", False), page(1)])
    result = extract_pdf_text(make_pdf(LECTURE_PAGES), ocr="always", engine="vision")
    assert result["ocr_engine"] == "vision"
    assert result["ocr_pages"] == [1, 2]
    assert "[PDF page 1] (OCR)" in result["text"]
    assert "[PDF page 2] (OCR)\nThe stroma." in result["text"]
    assert len(calls) == 2  # One client construction and one API request for both pages.


@pytest.mark.parametrize("kind", ["image", "pdf"])
def test_cloud_consent_and_key_are_checked_before_dispatch(monkeypatch, kind):
    def unexpected(*args, **kwargs):
        pytest.fail("A worker must not start without cloud consent and configuration")

    monkeypatch.setattr(main, "import_in_worker", unexpected)
    monkeypatch.setattr(main, "import_pdf_in_worker", unexpected)
    url = f"/api/import/{kind}?engine=vision"
    assert client.post(url, content=b"data").status_code == 422
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post(url + "&cloud_consent=true", content=b"data")
    assert response.status_code == 503
    assert "local OCR" in response.json()["error"]


@pytest.mark.parametrize("query", ["engine=unknown", "enhance=maybe"])
def test_invalid_recognition_settings_are_rejected(query):
    assert client.post(f"/api/import/image?{query}", content=b"data").status_code == 422


@pytest.mark.parametrize("kind", ["image", "pdf"])
def test_endpoint_forwards_consented_recognition_settings(monkeypatch, kind):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-never-used-on-network")
    calls = []

    def fake_worker(*args, **kwargs):
        calls.append((args, kwargs))
        return {"text": "A test transcription"}

    monkeypatch.setattr(main, "import_in_worker", fake_worker)
    monkeypatch.setattr(main, "import_pdf_in_worker", fake_worker)
    response = client.post(
        f"/api/import/{kind}?engine=vision&cloud_consent=true&enhance=false"
        "&start_page=2&end_page=3&rotation=90&ocr=always",
        content=b"synthetic upload",
    )
    assert response.status_code == 200
    args, kwargs = calls[0]
    if kind == "image":
        assert args == (b"synthetic upload", "image")
        assert kwargs == {"rotation": 90, "engine": "vision", "enhance": False}
    else:
        assert args == (b"synthetic upload", 2, 3, "always", "vision", False)


@pytest.mark.parametrize(
    "failure,status",
    [
        (APITimeoutError(request=httpx.Request("POST", "https://api.openai.com")), 504),
        (APIConnectionError(request=httpx.Request("POST", "https://api.openai.com")), 502),
        (
            RateLimitError(
                "private provider detail",
                response=httpx.Response(
                    429, request=httpx.Request("POST", "https://api.openai.com")
                ),
                body=None,
            ),
            429,
        ),
        (
            APIStatusError(
                "private provider detail",
                response=httpx.Response(
                    401, request=httpx.Request("POST", "https://api.openai.com")
                ),
                body=None,
            ),
            502,
        ),
    ],
)
def test_provider_errors_are_helpful_and_redacted(monkeypatch, failure, status):
    install_fake_sdk(monkeypatch, failure=failure)
    with pytest.raises(PdfImportError) as result:
        vision_ocr.read_handwriting({1: Image.new("RGB", (100, 100))})
    assert result.value.status == status
    assert "private provider detail" not in str(result.value)
