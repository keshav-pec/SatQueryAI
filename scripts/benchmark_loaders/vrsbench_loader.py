"""
VRSBench loader — loads VQA data from the xiang709/VRSBench HuggingFace dataset.

VRSBench uses standard RGB JPEG images (from the DIOR dataset), not GeoTIFFs.
The loader streams from HuggingFace and saves images locally on first use.
"""

import os
import json
from datasets import load_dataset


def load_vrsbench(
    split: str = "test",
    max_samples: int | None = None,
    cache_dir: str = "data/raw/VRSBench",
) -> list[dict]:
    """
    Load VRSBench VQA samples.

    Returns a list of dicts:
        [{image_paths: [str], question: str, answer: str, question_type: str}, ...]
    """
    print(f"Loading VRSBench ({split} split)...")
    os.makedirs(cache_dir, exist_ok=True)
    image_dir = os.path.join(cache_dir, "images")
    os.makedirs(image_dir, exist_ok=True)

    try:
        ds = load_dataset("xiang709/VRSBench", split=split, cache_dir=cache_dir, streaming=True)
    except Exception as e:
        print(f"Warning: Could not load VRSBench from HuggingFace: {e}")
        print("Falling back to local directory...")
        return _load_local_vrsbench(cache_dir, split, max_samples)

    samples = []
    for i, item in enumerate(ds):
        if max_samples and i >= max_samples:
            break

        # Save image locally if it's a PIL image
        image = item.get("image")
        image_id = item.get("image_id", f"vrsbench_{i:06d}")
        image_path = os.path.join(image_dir, f"{image_id}.jpg")

        if image is not None and not os.path.exists(image_path):
            image.save(image_path)

        question = item.get("question", "")
        answer = item.get("answer", "")

        if question and answer:
            samples.append({
                "image_paths": [image_path],
                "question": question,
                "answer": answer,
                "question_type": item.get("question_type", "unknown"),
            })

    print(f"Loaded {len(samples)} VRSBench samples.")
    return samples


def _load_local_vrsbench(
    data_dir: str,
    split: str,
    max_samples: int | None,
) -> list[dict]:
    """Fallback: load from a locally downloaded VRSBench directory."""
    json_path = os.path.join(data_dir, f"{split}_qa.json")
    image_dir = os.path.join(data_dir, "images")

    if not os.path.exists(json_path):
        print(f"No local VRSBench data found at {json_path}")
        return []

    with open(json_path, "r") as f:
        raw = json.load(f)

    samples = []
    for item in raw[:max_samples]:
        img_name = item.get("image_id", item.get("image", ""))
        image_path = os.path.join(image_dir, img_name)
        if not image_path.endswith((".jpg", ".jpeg", ".png")):
            image_path += ".jpg"

        samples.append({
            "image_paths": [image_path],
            "question": item.get("question", ""),
            "answer": item.get("answer", ""),
            "question_type": item.get("question_type", "unknown"),
        })

    print(f"Loaded {len(samples)} local VRSBench samples.")
    return samples
