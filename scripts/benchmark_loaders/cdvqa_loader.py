"""
CDVQA (Change Detection VQA) loader.

Expected local directory layout:
    data_dir/
        images/
            before/
                *.png
            after/
                *.png
        test.json  ->  [{image_id, question, answer}, ...]

The loader expects bi-temporal image pairs (before/after) for change detection.
"""

import os
import json


def load_cdvqa(
    data_dir: str = "data/raw/CDVQA",
    split: str = "test",
    max_samples: int | None = None,
) -> list[dict]:
    """
    Load CDVQA samples from a local directory.

    Returns a list of dicts:
        [{image_paths: [before_path, after_path], question: str, answer: str, question_type: str}, ...]
    """
    print(f"Loading CDVQA ({split} split) from {data_dir}...")

    json_path = os.path.join(data_dir, f"{split}.json")
    
    if not os.path.exists(json_path):
        # Try alternative naming
        alt_path = os.path.join(data_dir, f"CDVQA_{split}.json")
        if os.path.exists(alt_path):
            json_path = alt_path
        else:
            print(f"Warning: No CDVQA data found.")
            print(f"  Tried: {json_path}")
            print(f"  Tried: {alt_path}")
            print("  Please download CDVQA and place it in data/raw/CDVQA/")
            print("  Expected structure:")
            print("    data/raw/CDVQA/images/before/*.png")
            print("    data/raw/CDVQA/images/after/*.png")
            print(f"    data/raw/CDVQA/{split}.json")
            return []

    with open(json_path, "r") as f:
        raw = json.load(f)

    items = raw if isinstance(raw, list) else raw.get("data", raw.get("annotations", []))

    before_dir = os.path.join(data_dir, "images", "before")
    after_dir = os.path.join(data_dir, "images", "after")

    # Fallback: some CDVQA layouts use A/ and B/ instead of before/after
    if not os.path.exists(before_dir):
        before_dir = os.path.join(data_dir, "images", "A")
        after_dir = os.path.join(data_dir, "images", "B")

    samples = []
    for item in items[:max_samples]:
        image_id = str(item.get("image_id", item.get("image", "")))

        # Resolve image paths
        before_path = _find_image(before_dir, image_id)
        after_path = _find_image(after_dir, image_id)

        question = item.get("question", "")
        answer = item.get("answer", "")
        question_type = item.get("type", item.get("question_type", "change_detection"))

        if question and answer:
            samples.append({
                "image_paths": [before_path, after_path],
                "question": question,
                "answer": answer,
                "question_type": question_type,
            })

    print(f"Loaded {len(samples)} CDVQA samples.")
    return samples


def _find_image(directory: str, image_id: str) -> str:
    """Try to locate an image file by ID with various extensions."""
    for ext in [".png", ".jpg", ".jpeg", ".tif", ".tiff"]:
        path = os.path.join(directory, f"{image_id}{ext}")
        if os.path.exists(path):
            return path
    return os.path.join(directory, f"{image_id}.png")
