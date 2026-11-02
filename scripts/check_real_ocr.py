"""Opt-in OCR evaluation on attributed, real handwritten notebook photographs."""

import argparse
import hashlib
import json
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen

from fastapi.testclient import TestClient

from backend.main import app
from backend.vision_ocr import vision_settings

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "tests/fixtures/real-ocr-samples.json"
DIRECTORY = ROOT / ".qa/real-handwriting"


def normalize(text: str) -> str:
    """Ignore punctuation/case/spacing, while keeping the actual written letters/digits."""
    return re.sub(r"[^a-z0-9]", "", text.casefold())


def anchor_checks(sample: dict, result: dict) -> list[dict]:
    text = normalize(result.get("text", ""))
    return [
        {"anchor": anchor, "matched": normalize(anchor) in text} for anchor in sample["anchors"]
    ]


def original_file(sample: dict, download: bool) -> Path:
    path = DIRECTORY / f"{sample.get('original_id', sample['id'])}-original.jpg"
    if not path.exists() and download:
        request = Request(sample["download"], headers={"User-Agent": "AIStudyBuddy-OCR-QA/1.0"})
        with urlopen(request, timeout=30) as response:
            data = response.read(10 * 1024 * 1024 + 1)
        if len(data) > 10 * 1024 * 1024:
            raise ValueError("The source image exceeds the app's 10 MB import limit.")
        if hashlib.sha256(data).hexdigest() != sample["sha256"]:
            raise ValueError("Source changed; manually review it before updating the reference.")
        path.write_bytes(data)
    if not path.exists():
        raise ValueError("Download the attributed originals first with --download.")
    if hashlib.sha256(path.read_bytes()).hexdigest() != sample["sha256"]:
        raise ValueError("Original image checksum mismatch. Keep the source photograph unchanged.")
    return path


def evaluate(sample: dict, label: str, call_api: bool) -> dict:
    destination = DIRECTORY / f"{sample['id']}-{label}.json"
    if call_api:
        model, detail = vision_settings()
        started = time.monotonic()
        params = {"engine": "vision", "cloud_consent": "true", "enhance": "true"}
        if sample.get("corners"):
            params["corners"] = json.dumps(sample["corners"])
        with TestClient(app) as client:
            response = client.post(
                "/api/import/image",
                params=params,
                content=original_file(sample, False).read_bytes(),
                headers={"Content-Type": "image/jpeg"},
            )
        report = {
            "status": response.status_code,
            "elapsed": round(time.monotonic() - started, 2),
            "settings": {"model": model, "detail": detail, "enhance": True},
            "source": sample["source"],
            "author": sample["author"],
            "license": sample["license"],
            "license_url": sample["license_url"],
            "original_sha256": sample["sha256"],
            "result": response.json(),
        }
    else:
        if not destination.exists():
            raise ValueError(f"No cached {label} report exists for {sample['id']}.")
        report = json.loads(destination.read_text(encoding="utf-8"))
    checks = anchor_checks(sample, report["result"])
    report["anchor_checks"] = checks
    report["measurement_scope"] = sample["anchor_review"]
    if call_api:
        destination.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return {
        "sample": sample["id"],
        "stage": label,
        "http_status": report["status"],
        "elapsed_seconds": report["elapsed"],
        "matched_anchors": sum(check["matched"] for check in checks),
        "checked_anchors": len(checks),
        "missing_anchors": [check["anchor"] for check in checks if not check["matched"]],
        "source": sample["source"],
        "corners": sample.get("corners"),
        "scope": (
            "Selected manually read phrases only; not full-page WER or an overall accuracy score"
        ),
    }


def main():
    samples = json.loads(MANIFEST.read_text(encoding="utf-8"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--download", action="store_true", help="Fetch licensed originals; no API calls"
    )
    parser.add_argument(
        "--allow-api", action="store_true", help="Allow one billable call per sample"
    )
    parser.add_argument(
        "--score-only", action="store_true", help="Score cached output without API calls"
    )
    parser.add_argument("--label", choices=["baseline", "after"], default="after")
    parser.add_argument("--sample", choices=[s["id"] for s in samples])
    parser.add_argument(
        "--focus-regions",
        action="store_true",
        help="Test selected real page corners separately; one call per region",
    )
    args = parser.parse_args()
    if not (args.download or args.allow_api or args.score_only):
        parser.error(
            "Choose --download, --score-only, or explicitly allow paid checks with --allow-api."
        )
    if args.score_only and args.allow_api:
        parser.error("--score-only cannot be combined with --allow-api.")
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    selected = [s for s in samples if not args.sample or s["id"] == args.sample]
    try:
        for sample in selected:
            original_file(sample, args.download)
        if args.download and not (args.score_only or args.allow_api):
            print("Verified licensed original photos and checksums; no OpenAI calls made.")
            return 0
        if args.focus_regions:
            regions = []
            for sample in selected:
                for region in sample["regions"]:
                    focused = {
                        **sample,
                        "id": f"{sample['id']}-{region['name']}",
                        "original_id": sample["id"],
                        "corners": region["corners"],
                        "anchors": [sample["anchors"][i] for i in region["anchor_indices"]],
                    }
                    regions.append(focused)
            selected = regions
        results = [evaluate(s, args.label, args.allow_api) for s in selected]
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    for result in results:
        print(json.dumps(result), flush=True)
    (DIRECTORY / f"{args.label}-summary.json").write_text(
        json.dumps(results, indent=2), encoding="utf-8"
    )
    return (
        0
        if all(
            r["http_status"] == 200 and r["matched_anchors"] == r["checked_anchors"]
            for r in results
        )
        else 1
    )


if __name__ == "__main__":
    raise SystemExit(main())
