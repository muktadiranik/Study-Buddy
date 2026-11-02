import copy

import pytest
from pydantic import ValidationError

from backend.models import GenerateRequest, StudyMaterials, note_paragraphs, validate_materials


def test_valid_materials(materials):
    assert len(validate_materials(materials, 1).quiz) == 2


@pytest.mark.parametrize(
    "change",
    [
        lambda m: m["quiz"][0].update(correct_index=4),
        lambda m: m["quiz"][0].update(correct_index=True),
        lambda m: m["quiz"][0].update(options=["A", "a", "B", "C"]),
        lambda m: m["quiz"][0].update(options=["A", "B", "C"]),
        lambda m: m["quiz"][0].update(sources=[2]),
        lambda m: m["quiz"][0].update(sources=[]),
        lambda m: m["quiz"][0].update(sources=[1, 1]),
        lambda m: m["quiz"][0].update(question=" "),
        lambda m: m.update(status="insufficient"),
        lambda m: m.update(flashcards=[]),
        lambda m: m.update(quiz=m["quiz"] * 3),
        lambda m: m.update(unexpected="extra data"),
        lambda m: m.update(quiz=[m["quiz"][0], m["quiz"][0]]),
    ],
)
def test_rejects_invalid_ai_response(materials, change):
    invalid = copy.deepcopy(materials)
    change(invalid)
    with pytest.raises(ValueError):
        validate_materials(invalid, 1)


def test_insufficient_notes_are_explicit_and_empty():
    result = StudyMaterials(
        status="insufficient",
        message="Add a few factual paragraphs.",
        summary=[],
        concepts=[],
        definitions=[],
        flashcards=[],
        quiz=[],
    )
    assert result.status == "insufficient"


@pytest.mark.parametrize("notes", ["", "   ", "a" * 20001])
def test_empty_and_excessive_input(notes):
    with pytest.raises(ValidationError):
        GenerateRequest(title="Test", subject="Biology", notes=notes)


def test_numbering_matches_browser():
    assert note_paragraphs("  First.\r\n\r\n Second.\n \nThird.  ") == [
        "First.",
        "Second.",
        "Third.",
    ]
