"""
RSVQA loader — loads VQA data from the RSVQA-LR or RSVQA-HR datasets.

Expected local directory layout (download from https://rsvqa.sylvainlobry.com/):
    data_dir/
        images/
            *.tif or *.png
        LR_split_test_questions.json  (or HR_split_test_questions.json)
        LR_split_test_answers.json    (or HR_split_test_answers.json)

Alternative flat JSON format:
    data_dir/
        images/
        test.json  ->  [{image_id, question, answer, type}, ...]
"""

import os
import json
import glob


def load_rsvqa(
    data_dir: str = "data/raw/RSVQA",
    split: str = "test",
    variant: str = "LR",
    max_samples: int | None = None,
) -> list[dict]:
    """
    Load RSVQA samples from a local directory.

    Args:
        data_dir: Root directory containing RSVQA data.
        split: Which split to load (train/val/test).
        variant: "LR" (Low Resolution) or "HR" (High Resolution).
        max_samples: Maximum number of samples to load.

    Returns a list of dicts:
        [{image_paths: [str], question: str, answer: str, question_type: str}, ...]
    """
    print(f"Loading RSVQA-{variant} ({split} split) from {data_dir}...")

    image_dir = os.path.join(data_dir, "images")

    # Try standard RSVQA JSON format first
    q_path = os.path.join(data_dir, f"{variant}_split_{split}_questions.json")
    a_path = os.path.join(data_dir, f"{variant}_split_{split}_answers.json")

    if os.path.exists(q_path) and os.path.exists(a_path):
        return _load_split_format(q_path, a_path, image_dir, max_samples)

    # Try flat JSON format
    flat_path = os.path.join(data_dir, f"{split}.json")
    if os.path.exists(flat_path):
        return _load_flat_format(flat_path, image_dir, max_samples)

    print(f"Warning: No RSVQA data found at {data_dir}")
    print(f"  Tried: {q_path}")
    print(f"  Tried: {flat_path}")
    print("  Download from: https://rsvqa.sylvainlobry.com/")
    return []


def _load_split_format(
    questions_path: str,
    answers_path: str,
    image_dir: str,
    max_samples: int | None,
) -> list[dict]:
    """Load RSVQA's split question/answer JSON files."""
    with open(questions_path, "r") as f:
        questions_data = json.load(f)
    with open(answers_path, "r") as f:
        answers_data = json.load(f)

    # Build answer lookup by question_id
    answer_lookup = {}
    for ans in answers_data.get("answers", answers_data if isinstance(answers_data, list) else []):
        qid = ans.get("question_id", ans.get("id"))
        answer_lookup[qid] = ans.get("answer", "")

    questions = questions_data.get("questions", questions_data if isinstance(questions_data, list) else [])
    
    samples = []
    for q in questions[:max_samples]:
        qid = q.get("question_id", q.get("id"))
        image_id = q.get("image_id", q.get("img_id", ""))
        question_text = q.get("question", "")
        answer_text = answer_lookup.get(qid, "")
        question_type = q.get("type", q.get("question_type", "unknown"))

        # Find the image file
        image_path = _find_image(image_dir, str(image_id))

        if question_text and answer_text:
            samples.append({
                "image_paths": [image_path],
                "question": question_text,
                "answer": answer_text,
                "question_type": question_type,
            })

    print(f"Loaded {len(samples)} RSVQA samples.")
    return samples


def _load_flat_format(
    json_path: str,
    image_dir: str,
    max_samples: int | None,
) -> list[dict]:
    """Load from a flat JSON array of {image_id, question, answer, type}."""
    with open(json_path, "r") as f:
        raw = json.load(f)

    samples = []
    items = raw if isinstance(raw, list) else raw.get("data", [])
    
    for item in items[:max_samples]:
        image_id = item.get("image_id", item.get("image", ""))
        image_path = _find_image(image_dir, str(image_id))

        samples.append({
            "image_paths": [image_path],
            "question": item.get("question", ""),
            "answer": item.get("answer", ""),
            "question_type": item.get("type", item.get("question_type", "unknown")),
        })

    print(f"Loaded {len(samples)} RSVQA samples.")
    return samples


def _find_image(image_dir: str, image_id: str) -> str:
    """Try to locate an image file by ID with various extensions."""
    for ext in [".tif", ".tiff", ".png", ".jpg", ".jpeg"]:
        path = os.path.join(image_dir, f"{image_id}{ext}")
        if os.path.exists(path):
            return path
    # Fallback: return the path with .tif extension
    return os.path.join(image_dir, f"{image_id}.tif")
