"""Run from the project root: python -m uvicorn backend.main:app --reload"""

import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from openai import APIConnectionError, APIStatusError, APITimeoutError, RateLimitError
from pydantic import ValidationError

from backend.ai import generate_materials
from backend.crop import validate_corners
from backend.models import GenerateRequest
from backend.pdf_import import MAX_PDF_BYTES, PdfImportError, import_in_worker, import_pdf_in_worker

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
app = FastAPI(title="AI Study Buddy", version="1.0.0")


def ai_configured() -> bool:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    return bool(key and key != "your_openai_api_key_here")


def error(message: str, status: int) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


@app.get("/api/status")
async def status():
    return {"ai_enabled": ai_configured(), "max_notes_characters": 20_000}


@app.post("/api/generate")
async def generate(request: Request):
    # Reject cross-origin browser requests; Vite proxies /api in development.
    origin = request.headers.get("origin")
    if origin and origin not in {
        f"http://{request.headers.get('host')}",
        f"https://{request.headers.get('host')}",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    }:
        return error("Open the app on its local address to generate materials.", 403)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 100_000:
            return error("These notes are too large. Use at most 20,000 characters per set.", 413)
    try:
        data = GenerateRequest.model_validate(json.loads(body))
    except (ValidationError, ValueError, UnicodeDecodeError):
        return error(
            "Add a title, subject, and notes. Titles can have 100 characters, subjects 60, "
            "and notes 20,000. Empty or invalid input cannot be used.",
            422,
        )
    if not ai_configured():
        return error(
            "AI generation is not enabled. Add OPENAI_API_KEY and OPENAI_MODEL to the "
            "project's .env file, then restart the Python server. Your notes still work.",
            503,
        )
    try:
        # Includes time waiting for capacity; never leave a request hanging indefinitely.
        result, cached = await asyncio.wait_for(generate_materials(data), timeout=65)
        return {"materials": result, "cached": cached}
    except (TimeoutError, APITimeoutError):
        return error("Generation took too long. Try again, or use a shorter section of notes.", 504)
    except RateLimitError:
        return error(
            "The AI service is busy or your API quota was reached. Check usage and retry later.",
            429,
        )
    except APIConnectionError:
        return error(
            "Could not reach OpenAI. Check the Python server's internet connection and retry.", 502
        )
    except APIStatusError as exc:
        if exc.status_code in (401, 403):
            return error(
                "OpenAI rejected access. Check the server's API key and model permissions.", 502
            )
        return error(
            "OpenAI could not generate materials. Check your model setting or retry later.", 502
        )
    except (ValidationError, ValueError):
        return error(
            "The AI returned incomplete or invalid study materials. Nothing was saved. Try again.",
            502,
        )
    except Exception:
        # Do not return provider exceptions: they may contain private input or server details.
        return error("Generation failed unexpectedly. Your notes are safe; please try again.", 500)


@app.post("/api/import/pdf")
@app.post("/api/import/image")
async def import_pdf(request: Request):
    """Local by default; cloud transcription requires explicit consent on this request."""
    is_image = request.url.path.endswith("/image")
    kind = "image" if is_image else "PDF"
    origin = request.headers.get("origin")
    if origin and origin not in {
        f"http://{request.headers.get('host')}",
        f"https://{request.headers.get('host')}",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    }:
        return error(f"Open the app on its local address to import a {kind}.", 403)
    engine = request.query_params.get("engine", "local")
    if engine not in {"local", "vision"}:
        return error("Choose local OCR or handwriting vision.", 422)
    enhance_value = request.query_params.get("enhance", "true")
    if enhance_value not in {"true", "false"}:
        return error("Choose whether to improve the photo before recognition.", 422)
    enhance = enhance_value == "true"
    corners = None
    if "corners" in request.query_params:
        try:
            raw_corners = request.query_params["corners"]
            if not is_image or len(raw_corners) > 500:
                raise ValueError()
            corners = validate_corners(json.loads(raw_corners))
        except (ValueError, PdfImportError):
            return error(
                "Choose four valid corners around one photographed page without crossing.", 422
            )
    if engine == "vision":
        if request.query_params.get("cloud_consent") != "true":
            return error(
                "Allow sending the selected images to OpenAI before using handwriting vision.", 422
            )
        if not ai_configured():
            return error(
                "Handwriting vision needs OPENAI_API_KEY on the Python server. "
                "Add it to .env and restart, or choose local OCR.",
                503,
            )
    ocr = request.query_params.get("ocr", "auto")
    if ocr not in {"auto", "always", "off"}:
        return error("Choose automatic OCR, always OCR, or text only.", 422)
    try:
        rotation = int(request.query_params.get("rotation", "0"))
        if rotation not in {0, 90, 180, 270}:
            raise ValueError()
    except ValueError:
        return error("Choose an image rotation of 0, 90, 180, or 270 degrees.", 422)
    try:
        start = int(request.query_params.get("start_page", "1"))
        end_value = request.query_params.get("end_page")
        end = int(end_value) if end_value else None
        if start < 1 or (end is not None and end < start):
            raise ValueError()
    except ValueError:
        return error("Choose valid page numbers, starting at 1, with the end after the start.", 422)
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_PDF_BYTES:
            return error(f"This {kind} is larger than 10 MB. Upload a smaller file.", 413)
        body.extend(chunk)
    try:
        job = (
            asyncio.to_thread(
                import_in_worker,
                bytes(body),
                "image",
                rotation=rotation,
                engine=engine,
                enhance=enhance,
                **({"corners": corners} if corners is not None else {}),
            )
            if is_image
            else asyncio.to_thread(
                import_pdf_in_worker, bytes(body), start, end, ocr, engine, enhance
            )
        )
        return await asyncio.wait_for(job, timeout=95)
    except PdfImportError as exc:
        return error(str(exc), exc.status)
    except TimeoutError:
        return error("Text extraction took too long. Try fewer pages or a smaller file.", 504)
    except Exception:
        return error(
            "Import failed. Check that the Python server and OCR dependencies are installed, "
            "then retry.",
            500,
        )


# After `npm run build`, Python can serve the entire app at http://127.0.0.1:8000.
if (ROOT / "dist").is_dir():
    app.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="frontend")
