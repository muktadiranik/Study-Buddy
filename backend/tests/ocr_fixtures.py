"""Synthetic printed English notes for real, offline OCR integration checks."""

from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter

from backend.tests.pdf_fixtures import LECTURE_PAGES, make_pdf


def note_image() -> Image.Image:
    image = Image.new("RGB", (1500, 800), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=38)
    for index, line in enumerate(
        [
            "Biology study notes",
            "Photosynthesis converts light into chemical energy.",
            "Chlorophyll absorbs light in chloroplasts.",
            "The Calvin cycle takes place in the stroma.",
            "It uses ATP and NADPH to help make sugars.",
        ]
    ):
        draw.text((60, 80 + index * 100), line, fill="black", font=font)
    return image


def image_bytes(format: str = "PNG", *, exif: bool = False) -> bytes:
    image = note_image()
    output = BytesIO()
    options = {}
    if exif:
        image = image.rotate(90, expand=True)
        metadata = Image.Exif()
        metadata[274] = 6  # Camera orientation: rotate clockwise to display upright.
        options["exif"] = metadata
    image.save(output, format=format, **options)
    return output.getvalue()


def scanned_pdf(mixed: bool = False) -> bytes:
    output = BytesIO()
    note_image().save(output, format="PDF", resolution=144)
    if not mixed:
        return output.getvalue()
    writer = PdfWriter()
    writer.append(PdfReader(BytesIO(make_pdf([LECTURE_PAGES[0]]))))
    writer.append(PdfReader(BytesIO(output.getvalue())))
    result = BytesIO()
    writer.write(result)
    return result.getvalue()


def phone_photo() -> Image.Image:
    """Synthetic camera effects, not a real phone photo or a handwriting benchmark."""
    page = np.array(note_image())
    corners = np.float32([[0, 0], [1499, 0], [1499, 799], [0, 799]])
    photographed = np.float32([[230, 190], [1620, 100], [1570, 1040], [150, 1150]])
    transform = cv2.getPerspectiveTransform(corners, photographed)
    scene = cv2.warpPerspective(page, transform, (1800, 1300), borderValue=(65, 70, 70))
    x = np.linspace(0, 1, 1800)[None, :]
    y = np.linspace(0, 1, 1300)[:, None]
    lighting = 0.38 + 0.62 * x + 0.07 * np.sin(y * 6)
    scene = np.clip(scene * lighting[:, :, None], 0, 255).astype(np.uint8)
    return Image.fromarray(cv2.GaussianBlur(scene, (3, 3), 0.5))


if __name__ == "__main__":
    directory = Path(".qa/ocr")
    directory.mkdir(parents=True, exist_ok=True)
    for name, contents in {
        "English study notes.png": image_bytes(),
        "English study notes.jpg": image_bytes("JPEG", exif=True),
        "English study notes.webp": image_bytes("WEBP"),
        "Scanned biology.pdf": scanned_pdf(),
        "Mixed biology.pdf": scanned_pdf(mixed=True),
        "Phone photo.jpg": b"",
    }.items():
        if name == "Phone photo.jpg":
            phone_photo().save(directory / name, quality=80)
        else:
            (directory / name).write_bytes(contents)
    print("Created synthetic English OCR fixtures.")
