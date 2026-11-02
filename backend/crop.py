"""A student-selected quadrilateral isolates one photographed page before OCR."""

import math

from backend.pdf_import import PdfImportError


def validate_corners(value) -> list[list[float]]:
    message = "Place four corners around one page, clockwise from its top-left, without crossing."
    if not isinstance(value, list) or len(value) != 4:
        raise PdfImportError(message)
    for point in value:
        if (
            not isinstance(point, list)
            or len(point) != 2
            or any(
                type(n) not in {int, float} or not 0 <= n <= 100 or not math.isfinite(n)
                for n in point
            )
        ):
            raise PdfImportError(message)
    cross = []
    for i in range(4):
        a, b, c = value[i], value[(i + 1) % 4], value[(i + 2) % 4]
        cross.append((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]))
    area = (
        sum(
            value[i][0] * value[(i + 1) % 4][1] - value[(i + 1) % 4][0] * value[i][1]
            for i in range(4)
        )
        / 2
    )
    if min(cross) <= 0 or area < 50:
        raise PdfImportError(message + " Select at least 0.5% of the photo.")
    return value


def crop_page(image, corners):
    import cv2
    import numpy as np
    from PIL import Image

    points = np.float32(validate_corners(corners)) / 100
    points *= [image.width - 1, image.height - 1]
    tl, tr, br, bl = points
    width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
    height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
    scale = min(1, 3600 / max(width, height), (8_000_000 / (width * height)) ** 0.5)
    width, height = max(1, int(width * scale)), max(1, int(height * scale))
    target = np.float32([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]])
    # Composite transparency before transforming so white paper remains white.
    rgba = image.convert("RGBA")
    backing = Image.new("RGBA", rgba.size, "white")
    backing.alpha_composite(rgba)
    matrix = cv2.getPerspectiveTransform(points, target)
    pixels = cv2.warpPerspective(
        np.array(backing.convert("RGB")), matrix, (width, height), borderValue=(255, 255, 255)
    )
    return Image.fromarray(pixels)
