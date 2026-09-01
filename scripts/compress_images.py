#!/usr/bin/env python3
"""Validate and compress repository images without import-time side effects."""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageOps


MAX_EDGE = 1600
JPEG_Q = 80
SKIP_NAMES = {"mantou.jpg"}
SKIP_PREFIX = ("favicon", "android-chrome", "apple-touch")
ROOTS = (Path("static/images"), Path("content/posts"))
MIN_BYTES = 120 * 1024
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


@dataclass
class CompressionSummary:
    changed: int = 0
    total_before: int = 0
    total_after: int = 0
    errors: list[str] = field(default_factory=list)


def _should_skip(path: Path) -> bool:
    lowered = path.name.lower()
    return path.name in SKIP_NAMES or lowered.startswith(SKIP_PREFIX)


def _compress_image(
    path: Path,
    summary: CompressionSummary,
    *,
    min_bytes: int,
    max_edge: int,
) -> None:
    before = path.stat().st_size
    temporary = path.with_name(f"{path.name}.tmp")

    try:
        with Image.open(path) as source:
            source.load()
            image = ImageOps.exif_transpose(source)

            if before < min_bytes:
                return

            width, height = image.size
            longest = max(width, height)
            resized = longest > max_edge

            if resized:
                scale = max_edge / longest
                image = image.resize(
                    (max(1, int(width * scale)), max(1, int(height * scale))),
                    Image.Resampling.LANCZOS,
                )

            extension = path.suffix.lower()
            if extension in {".jpg", ".jpeg"}:
                image.convert("RGB").save(
                    temporary,
                    "JPEG",
                    quality=JPEG_Q,
                    optimize=True,
                    progressive=True,
                )
            else:
                image.save(temporary, "PNG", optimize=True)

        after = temporary.stat().st_size
        if resized or after < before:
            temporary.replace(path)
            summary.changed += 1
            summary.total_before += before
            summary.total_after += after
            print(f"  {path}: {before // 1024}KB -> {after // 1024}KB")
        else:
            temporary.unlink(missing_ok=True)
    except Exception as error:  # Pillow raises several format-specific exception types.
        temporary.unlink(missing_ok=True)
        summary.errors.append(f"{path}: {error}")


def optimize_roots(
    roots: list[Path] | tuple[Path, ...],
    *,
    min_bytes: int = MIN_BYTES,
    max_edge: int = MAX_EDGE,
) -> CompressionSummary:
    """Validate supported images and compress candidates under explicit roots."""

    summary = CompressionSummary()

    for root in roots:
        if not root.exists():
            summary.errors.append(f"missing image root: {root}")
            continue

        for path in sorted(item for item in root.rglob("*") if item.is_file()):
            if path.suffix.lower() not in SUPPORTED_EXTENSIONS or _should_skip(path):
                continue
            _compress_image(
                path,
                summary,
                min_bytes=min_bytes,
                max_edge=max_edge,
            )

    return summary


def main() -> int:
    summary = optimize_roots(ROOTS)

    print(f"\nChanged {summary.changed} images.")
    print(
        f"Compressed bytes: {summary.total_before // 1024}KB -> "
        f"{summary.total_after // 1024}KB "
        f"(saved ~{(summary.total_before - summary.total_after) // 1024 // 1024}MB)"
    )

    if summary.errors:
        print("\nImage validation failed:")
        for error in summary.errors:
            print(f"- {error}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
