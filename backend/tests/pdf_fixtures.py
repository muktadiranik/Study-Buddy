"""Small synthetic PDFs for extraction tests; they contain no student or provider data."""

from io import BytesIO
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import (
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)

LECTURE_PAGES = [
    "Photosynthesis\n\nPhotosynthesis converts light energy into chemical energy in glucose.\n"
    "It takes place in chloroplasts. Chlorophyll absorbs light.",
    "The Calvin cycle\n\nThe Calvin cycle takes place in the stroma.\n"
    "It uses ATP and NADPH to help make sugars from carbon dioxide.",
]


def make_pdf(
    pages: list[str | None],
    password: str | None = None,
    image_only: bool = False,
    compressed: bool = False,
) -> bytes:
    writer = PdfWriter()
    for text in pages:
        page = writer.add_blank_page(width=612, height=792)
        if image_only:
            image = DecodedStreamObject()
            image.update(
                {
                    NameObject("/Type"): NameObject("/XObject"),
                    NameObject("/Subtype"): NameObject("/Image"),
                    NameObject("/Width"): NumberObject(1),
                    NameObject("/Height"): NumberObject(1),
                    NameObject("/ColorSpace"): NameObject("/DeviceGray"),
                    NameObject("/BitsPerComponent"): NumberObject(8),
                }
            )
            image.set_data(b"\x88")
            page[NameObject("/Resources")] = DictionaryObject(
                {
                    NameObject("/XObject"): DictionaryObject(
                        {NameObject("/Im0"): writer._add_object(image)}
                    ),
                }
            )
            content = b"q 200 0 0 200 48 500 cm /Im0 Do Q"
        elif text is not None:
            font = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/Font"),
                    NameObject("/Subtype"): NameObject("/Type1"),
                    NameObject("/BaseFont"): NameObject("/Helvetica"),
                }
            )
            page[NameObject("/Resources")] = DictionaryObject(
                {
                    NameObject("/Font"): DictionaryObject(
                        {NameObject("/F1"): writer._add_object(font)}
                    ),
                }
            )
            commands = ["BT /F1 12 Tf 48 744 Td 16 TL"]
            for line in text.split("\n"):
                escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
                commands.append(f"({escaped}) Tj T*")
            commands.append("ET")
            content = "\n".join(commands).encode("latin-1")
        else:
            continue
        stream = DecodedStreamObject()
        stream.set_data(content)
        page[NameObject("/Contents")] = writer._add_object(stream)
        if compressed:
            page.compress_content_streams()
    if password:
        writer.encrypt(password)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


if __name__ == "__main__":
    directory = Path(".qa/pdfs")
    directory.mkdir(parents=True, exist_ok=True)
    fixtures = {
        "Biology lecture.pdf": make_pdf(LECTURE_PAGES),
        "scanned.pdf": make_pdf([None], image_only=True),
        "locked.pdf": make_pdf(LECTURE_PAGES, password="classroom-password"),
        "long.pdf": make_pdf([("A detailed classroom example about plants and light. " * 460)]),
        "many-pages.pdf": make_pdf(["Lesson notes about photosynthesis and chlorophyll."] * 21),
    }
    for name, contents in fixtures.items():
        (directory / name).write_bytes(contents)
    print(f"Created {len(fixtures)} synthetic PDF fixtures in {directory}.")
