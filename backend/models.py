"""The contract between the AI, Python server, and frontend."""

import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_NOTES = 20_000
Text = Annotated[str, Field(min_length=1, max_length=2000)]
Sources = Annotated[
    list[Annotated[int, Field(strict=True, ge=1)]], Field(min_length=1, max_length=20)
]


def note_paragraphs(notes: str) -> list[str]:
    """Blank lines separate paragraphs; the browser uses the same rule."""
    return [part.strip() for part in re.split(r"\n\s*\n", notes.strip()) if part.strip()]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class GenerateRequest(Contract):
    title: str = Field(min_length=1, max_length=100)
    subject: str = Field(min_length=1, max_length=60)
    notes: str = Field(min_length=1, max_length=MAX_NOTES)


class CitedText(Contract):
    text: Text
    sources: Sources


class Definition(Contract):
    term: Annotated[str, Field(min_length=1, max_length=150)]
    meaning: Text
    sources: Sources


class Flashcard(Contract):
    question: Text
    answer: Text
    sources: Sources


class QuizQuestion(Contract):
    question: Text
    options: Annotated[
        list[Annotated[str, Field(min_length=1, max_length=500)]], Field(min_length=4, max_length=4)
    ]
    correct_index: Annotated[int, Field(strict=True, ge=0, le=3)]
    explanation: Text
    simpler_example: Text
    sources: Sources

    @model_validator(mode="after")
    def distinct_options(self):
        if len({option.casefold() for option in self.options}) != 4:
            raise ValueError("Quiz options must be distinct.")
        return self


class StudyMaterials(Contract):
    status: Literal["ready", "insufficient"]
    message: Annotated[str, Field(min_length=1, max_length=600)]
    summary: Annotated[list[CitedText], Field(max_length=6)]
    concepts: Annotated[list[CitedText], Field(max_length=8)]
    definitions: Annotated[list[Definition], Field(max_length=8)]
    flashcards: Annotated[list[Flashcard], Field(max_length=10)]
    quiz: Annotated[list[QuizQuestion], Field(max_length=5)]

    @model_validator(mode="after")
    def consistent_status(self):
        content = self.summary + self.concepts + self.definitions + self.flashcards + self.quiz
        if self.status == "insufficient" and content:
            raise ValueError("Insufficient notes must not produce invented study materials.")
        if self.status == "ready" and not (self.summary and self.flashcards and self.quiz):
            raise ValueError("Ready materials need a summary, flashcards, and a quiz.")
        for items in (self.flashcards, self.quiz):
            questions = [item.question.casefold() for item in items]
            if len(set(questions)) != len(questions):
                raise ValueError("Duplicate questions are not useful practice.")
        return self


def validate_materials(value: object, paragraph_count: int) -> StudyMaterials:
    """Validate both the response shape and its references to the actual notes."""
    result = StudyMaterials.model_validate(value)
    for item in (
        result.summary + result.concepts + result.definitions + result.flashcards + result.quiz
    ):
        if any(source > paragraph_count for source in item.sources):
            raise ValueError("AI returned a reference to a paragraph that does not exist.")
        if len(set(item.sources)) != len(item.sources):
            raise ValueError("AI returned duplicate source references.")
    return result
