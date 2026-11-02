import json

from backend.models import GenerateRequest, note_paragraphs
from scripts.seed_library import OUTPUT, build_records, lessons


def test_committed_seed_data_matches_reproducible_generator():
    saved = json.loads(OUTPUT.read_text(encoding="utf-8"))
    assert saved["seedVersion"] == 1
    assert saved["records"] == build_records()
    assert len(saved["records"]) == 520
    assert len({r["title"] for r in saved["records"]}) == 520
    for record in saved["records"]:
        GenerateRequest(**{k: record[k] for k in ("title", "subject", "notes")})
        assert len(note_paragraphs(record["notes"])) == 4


def test_worked_answers_are_consistent_across_all_example_variants():
    for i in range(1, 21):
        by_topic = {r["topic"]: r["notes"] for r in lessons(i)}
        assert len(by_topic) == 26
        x = 2 + i
        assert f"x = {x}." in by_topic["linear-equations"]
        assert f"hypotenuse of {5 * i} cm" in by_topic["pythagoras"]
        assert f"median is {i + 8}." in by_topic["median"]
        assert f"{16 + i:08b}" in by_topic["binary-numbers"]
        index = (i - 1) % 8
        assert f"makes {index + 1} equality comparisons" in by_topic["linear-search"]
        assert f"= {(20 + i) * 1024:,} bytes" in by_topic["binary-storage-units"]
        units = 40 + 5 * i
        price = 20 + i
        # Revenue and costs must balance at the supplied break-even quantity.
        assert f"Revenue is {units * price};" in by_topic["break-even-analysis"]
        assert f"= {units * price}, so they match" in by_topic["break-even-analysis"]
