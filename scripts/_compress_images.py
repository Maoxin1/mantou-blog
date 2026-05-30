#!/usr/bin/env python3
"""One-shot in-place image compressor.

Resizes images whose longest side > MAX_EDGE and recompresses JPEG/PNG,
keeping filename + extension so markdown references stay valid.
Only overwrites when the result is actually smaller.
"""
import os
from PIL import Image

MAX_EDGE = 1600
JPEG_Q = 80
SKIP_NAMES = {"mantou.jpg"}
SKIP_PREFIX = ("favicon", "android-chrome", "apple-touch")
ROOTS = ["static/images", "content/posts"]
MIN_BYTES = 120 * 1024  # skip files already under ~120KB

total_before = total_after = 0
changed = 0

for root in ROOTS:
    for dirpath, _, files in os.walk(root):
        for name in files:
            ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
            if ext not in ("jpg", "jpeg", "png"):
                continue
            if name in SKIP_NAMES or name.lower().startswith(SKIP_PREFIX):
                continue
            path = os.path.join(dirpath, name)
            before = os.path.getsize(path)
            if before < MIN_BYTES:
                continue
            try:
                img = Image.open(path)
                img.load()
            except Exception as e:
                print(f"SKIP open-fail {path}: {e}")
                continue
            w, h = img.size
            longest = max(w, h)
            if longest > MAX_EDGE:
                s = MAX_EDGE / longest
                img = img.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)

            tmp = path + ".tmp"
            try:
                if ext in ("jpg", "jpeg"):
                    img.convert("RGB").save(tmp, "JPEG", quality=JPEG_Q, optimize=True, progressive=True)
                else:
                    img.save(tmp, "PNG", optimize=True)
            except Exception as e:
                print(f"SKIP save-fail {path}: {e}")
                if os.path.exists(tmp):
                    os.remove(tmp)
                continue

            after = os.path.getsize(tmp)
            if after < before:
                os.replace(tmp, path)
                total_before += before
                total_after += after
                changed += 1
                print(f"  {path}: {before//1024}KB -> {after//1024}KB")
            else:
                os.remove(tmp)

print(f"\nChanged {changed} images.")
print(f"Compressed bytes: {total_before//1024}KB -> {total_after//1024}KB "
      f"(saved ~{(total_before-total_after)//1024//1024}MB)")
