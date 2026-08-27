"""
Converts BigEarthNet multi-label land cover annotations into
natural language VQA (Visual Question Answering) pairs.

Each patch produces 2-3 QA pairs using template-based generation
to create training data for the Qwen2-VL LoRA fine-tuning pipeline.
"""

import random

# ── Canonical BigEarthNet-v2 label set (19-class nomenclature) ──
# Reference: https://bigearth.net
BEN_LABELS = [
    "Urban fabric",
    "Industrial or commercial units",
    "Arable land",
    "Permanent crops",
    "Pastures",
    "Complex cultivation patterns",
    "Land principally occupied by agriculture",
    "Agro-forestry areas",
    "Broad-leaved forest",
    "Coniferous forest",
    "Mixed forest",
    "Natural grassland and sparsely vegetated areas",
    "Moors, heathland and sclerophyllous vegetation",
    "Transitional woodland, shrub",
    "Beaches, dunes, sands",
    "Inland wetlands",
    "Coastal wetlands",
    "Inland waters",
    "Marine waters",
]


def _join_labels(labels: list[str]) -> str:
    """Join labels into a human-readable phrase."""
    if len(labels) == 1:
        return labels[0].lower()
    return ", ".join(l.lower() for l in labels[:-1]) + f", and {labels[-1].lower()}"


def generate_vqa_pairs(patch_id: str, labels: list[str], max_pairs: int = 3) -> list[dict]:
    """
    Generate VQA pairs from a list of land-cover labels for a single patch.
    
    Returns a list of dicts: [{patch_id, query, answer}, ...]
    """
    if not labels:
        return []

    pairs = []
    label_str = _join_labels(labels)

    # ── Template 1: Scene description (always included) ──
    description_templates = [
        ("Describe the land cover in this satellite image.",
         f"The image shows {label_str}."),
        ("What types of land cover are visible in this scene?",
         f"The visible land cover types include {label_str}."),
        ("Summarize the terrain shown in this remote sensing image.",
         f"This area contains {label_str}."),
    ]
    q, a = random.choice(description_templates)
    pairs.append({"patch_id": patch_id, "query": q, "answer": a})

    # ── Template 2: Presence question (for a label that IS present) ──
    present_label = random.choice(labels)
    presence_templates = [
        (f"Is there {present_label.lower()} in this image?",
         f"Yes, {present_label.lower()} is present in this image."),
        (f"Can you identify {present_label.lower()} in this scene?",
         f"Yes, {present_label.lower()} can be identified in the scene."),
    ]
    q, a = random.choice(presence_templates)
    pairs.append({"patch_id": patch_id, "query": q, "answer": a})

    # ── Template 3: Absence question (for a label that is NOT present) ──
    absent_candidates = [l for l in BEN_LABELS if l not in labels]
    if absent_candidates and len(pairs) < max_pairs:
        absent_label = random.choice(absent_candidates)
        absence_templates = [
            (f"Is there {absent_label.lower()} in this image?",
             f"No, {absent_label.lower()} is not visible in this image."),
            (f"Does this scene contain {absent_label.lower()}?",
             f"No, there is no {absent_label.lower()} in this scene."),
        ]
        q, a = random.choice(absence_templates)
        pairs.append({"patch_id": patch_id, "query": q, "answer": a})

    # ── Template 4: Counting (optional extra) ──
    if len(labels) > 1 and len(pairs) < max_pairs:
        q = "How many different land cover types are present?"
        a = f"There are {len(labels)} different land cover types visible."
        pairs.append({"patch_id": patch_id, "query": q, "answer": a})

    return pairs[:max_pairs]


# ── Quick self-test ──
if __name__ == "__main__":
    sample_labels = ["Urban fabric", "Inland waters", "Broad-leaved forest"]
    qa_pairs = generate_vqa_pairs("test_patch_01", sample_labels)
    for p in qa_pairs:
        print(f"Q: {p['query']}")
        print(f"A: {p['answer']}")
        print()
