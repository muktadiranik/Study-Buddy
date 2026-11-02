"""Conservative photo preparation. Keep thin pen strokes and allow an unmodified retry."""

import cv2
import numpy as np
from PIL import Image, ImageOps

MAX_SIDE = 2400


def flatten(
    image: Image.Image, max_side: int = MAX_SIDE, max_pixels: int | None = None
) -> Image.Image:
    rgba = image.convert("RGBA")
    background = Image.new("RGBA", rgba.size, "white")
    background.alpha_composite(rgba)
    result = background.convert("RGB")
    scale = min(1, max_side / max(result.size))
    if max_pixels:
        scale = min(scale, (max_pixels / (result.width * result.height)) ** 0.5)
    if scale < 1:
        result = result.resize(
            (max(1, int(result.width * scale)), max(1, int(result.height * scale))),
            Image.Resampling.LANCZOS,
        )
    return result


def straighten_page(rgb: np.ndarray) -> tuple[np.ndarray, bool]:
    """Only crop when a large, complete, four-sided sheet is visible."""
    height, width = rgb.shape[:2]
    ratio = min(1, 900 / max(height, width))
    small = cv2.resize(rgb, None, fx=ratio, fy=ratio)
    gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 45, 130)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    area = gray.shape[0] * gray.shape[1]
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        if cv2.contourArea(contour) < area * 0.45:
            continue
        polygon = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(polygon) != 4 or not cv2.isContourConvex(polygon):
            continue
        points = polygon.reshape(4, 2).astype(np.float32)
        # Avoid trimming notes when a page extends outside the photo.
        if (
            points[:, 0].min() < 4
            or points[:, 1].min() < 4
            or points[:, 0].max() > gray.shape[1] - 5
            or points[:, 1].max() > gray.shape[0] - 5
        ):
            continue
        sums = points.sum(axis=1)
        differences = np.diff(points, axis=1).ravel()
        ordered = points[[sums.argmin(), differences.argmin(), sums.argmax(), differences.argmax()]]
        if len(np.unique(ordered, axis=0)) != 4:
            continue
        ordered /= ratio
        tl, tr, br, bl = ordered
        target_width = round(max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl)))
        target_height = round(max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr)))
        if min(target_width, target_height) < min(width, height) * 0.35:
            continue
        destination = np.float32(
            [
                [0, 0],
                [target_width - 1, 0],
                [target_width - 1, target_height - 1],
                [0, target_height - 1],
            ]
        )
        transform = cv2.getPerspectiveTransform(ordered, destination)
        return cv2.warpPerspective(
            rgb, transform, (target_width, target_height), borderValue=(255, 255, 255)
        ), True
    return rgb, False


def tilt_angle(gray: np.ndarray) -> float:
    """Find horizontal text lines; require a clear improvement before rotating."""
    small = cv2.resize(gray, None, fx=min(1, 650 / gray.shape[1]), fy=min(1, 650 / gray.shape[1]))
    _, ink = cv2.threshold(small, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    # Blank pages and dark backgrounds provide no useful line alignment evidence.
    coverage = np.count_nonzero(ink) / ink.size
    if not 0.002 < coverage < 0.3:
        return 0
    ink[:8] = ink[-8:] = 0
    ink[:, :8] = ink[:, -8:] = 0
    height, width = ink.shape

    def score(angle):
        matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1)
        rotated = cv2.warpAffine(ink, matrix, (width, height), flags=cv2.INTER_NEAREST)
        return float(np.var(np.sum(rotated > 0, axis=1)))

    baseline = score(0)
    candidates = [(score(angle), angle) for angle in np.arange(-12, 12.1, 1)]
    best, angle = max(candidates)
    return float(angle) if best > baseline * 1.18 and abs(angle) >= 1 else 0


def prepare_photo(
    image: Image.Image,
    enhance: bool = True,
    *,
    max_side: int = MAX_SIDE,
    max_pixels: int | None = None,
    preserve_color: bool = False,
) -> tuple[Image.Image, list[str]]:
    image = flatten(image, max_side, max_pixels)
    if not enhance:
        return image, []
    notes = []
    rgb, cropped = straighten_page(np.array(image))
    if cropped:
        notes.append("corrected page perspective")
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    # Estimate lighting at a smaller scale. Divide out broad shadows, without
    # thresholding away faint handwriting or erasing thin strokes with denoising.
    sample = cv2.resize(gray, (max(1, gray.shape[1] // 4), max(1, gray.shape[0] // 4)))
    background = cv2.GaussianBlur(cv2.dilate(sample, np.ones((9, 9), np.uint8)), (0, 0), 11)
    background = cv2.resize(background, (gray.shape[1], gray.shape[0]))
    corrected = cv2.divide(gray, np.maximum(background, 1), scale=255)
    if float(np.std(background)) > 8:
        notes.append("reduced uneven lighting")
    angle = tilt_angle(corrected)
    if preserve_color:
        # Keep coloured pen marks as evidence for vision. Grayscale is still
        # appropriate for the local printed-text recognizer.
        color_background = np.repeat(background[:, :, None], 3, axis=2)
        result = Image.fromarray(cv2.divide(rgb, np.maximum(color_background, 1), scale=255))
    else:
        result = Image.fromarray(corrected).convert("RGB")
    if angle:
        result = result.rotate(
            angle, resample=Image.Resampling.BICUBIC, expand=True, fillcolor="white"
        )
        notes.append("straightened tilted text")
    if min(result.size) < 600:
        notes.append("small image: photograph closer to the page for clearer words")
    if cv2.Laplacian(corrected, cv2.CV_64F).var() < 35:
        notes.append("soft or low-detail photo: retake with steady focus if words are missing")
    result = flatten(result, max_side, max_pixels)
    # Per-channel autocontrast can turn single-colour pen marks black and erase
    # their colour evidence. Lighting correction is sufficient for vision.
    return (result if preserve_color else ImageOps.autocontrast(result, cutoff=0)), notes
