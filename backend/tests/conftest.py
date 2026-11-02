import json
from pathlib import Path

import pytest


@pytest.fixture
def materials():
    path = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "materials.json"
    return json.loads(path.read_text(encoding="utf-8"))
