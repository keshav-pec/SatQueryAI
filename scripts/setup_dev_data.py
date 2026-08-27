"""
Data preparation script for SatQuery AI.

Downloads BigEarthNet metadata from HuggingFace, samples N patches,
and generates VQA training data with corresponding image references.

Usage:
    python scripts/setup_dev_data.py --num_samples 200
    python scripts/setup_dev_data.py --num_samples 5 --dry_run
"""

import os
import sys
import json
import argparse
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datasets import load_dataset
from scripts.generate_vqa_from_labels import generate_vqa_pairs

# BigEarthNet-v2 uses a 19-class nomenclature
# These map from the original CLC codes to readable names
BEN_19_CLASS_MAP = {
    0: "Urban fabric",
    1: "Industrial or commercial units",
    2: "Arable land",
    3: "Permanent crops",
    4: "Pastures",
    5: "Complex cultivation patterns",
    6: "Land principally occupied by agriculture",
    7: "Agro-forestry areas",
    8: "Broad-leaved forest",
    9: "Coniferous forest",
    10: "Mixed forest",
    11: "Natural grassland and sparsely vegetated areas",
    12: "Moors, heathland and sclerophyllous vegetation",
    13: "Transitional woodland, shrub",
    14: "Beaches, dunes, sands",
    15: "Inland wetlands",
    16: "Coastal wetlands",
    17: "Inland waters",
    18: "Marine waters",
}


def setup_data(num_samples: int = 200, dry_run: bool = False, seed: int = 42):
    """
    Main data preparation pipeline.
    
    1. Loads BigEarthNet metadata from HuggingFace
    2. Samples N patches from the train split
    3. Generates VQA pairs using template-based generation
    4. Saves to data/processed/ben_train.json
    """
    random.seed(seed)
    
    output_dir = os.path.join("data", "processed")
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"{'='*50}")
    print(f"  SatQuery AI — Data Preparation")
    print(f"  Target: {num_samples} samples")
    print(f"  Dry run: {dry_run}")
    print(f"{'='*50}\n")
    
    # ── Step 1: Load BigEarthNet from HuggingFace ──
    print("Step 1: Loading BigEarthNet metadata from HuggingFace...")
    
    try:
        ds = load_dataset(
            "BIFOLD-BigEarthNetv2-0/BigEarthNet",
            split="train",
            streaming=True,
        )
    except Exception as e:
        print(f"Error loading dataset: {e}")
        print("\nFalling back to creating synthetic training data...")
        _create_fallback_data(num_samples, output_dir, dry_run)
        return
    
    # ── Step 2: Sample patches and extract metadata ──
    print(f"Step 2: Sampling {num_samples} patches...")
    
    # Collect patches with their labels
    # Since we're streaming, we take more than needed and randomly sample
    buffer_size = num_samples * 3  # Over-sample to allow filtering
    patches = []
    
    for i, item in enumerate(ds):
        if i >= buffer_size:
            break
            
        # Extract patch ID and labels
        patch_id = item.get("patch_id", item.get("s2_name", item.get("name", f"patch_{i:06d}")))
        
        # Labels can come in different formats depending on the HF dataset version
        labels_raw = item.get("labels", item.get("new_labels", item.get("label", [])))
        
        # Convert numeric labels to strings if needed
        if labels_raw and isinstance(labels_raw[0], int):
            labels = [BEN_19_CLASS_MAP.get(l, f"Class_{l}") for l in labels_raw]
        elif labels_raw and isinstance(labels_raw[0], str):
            labels = list(labels_raw)
        else:
            continue  # Skip patches with no labels
        
        if not labels:
            continue
        
        # Extract S1 name if available  
        s1_name = item.get("s1_name", f"{patch_id}_S1")
        
        patches.append({
            "patch_id": patch_id,
            "s1_name": s1_name,
            "labels": labels,
        })
        
        if (i + 1) % 500 == 0:
            print(f"  Scanned {i+1} patches, collected {len(patches)}...")
    
    if not patches:
        print("Warning: Could not extract any patches with labels. Using fallback.")
        _create_fallback_data(num_samples, output_dir, dry_run)
        return
    
    # Random sample to the target count
    if len(patches) > num_samples:
        patches = random.sample(patches, num_samples)
    
    print(f"  Selected {len(patches)} patches.\n")
    
    # ── Step 3: Generate VQA pairs ──
    print("Step 3: Generating VQA training pairs...")
    
    all_qa_pairs = []
    for patch in patches:
        qa_pairs = generate_vqa_pairs(
            patch_id=patch["patch_id"],
            labels=patch["labels"],
            max_pairs=3,
        )
        all_qa_pairs.extend(qa_pairs)
    
    print(f"  Generated {len(all_qa_pairs)} QA pairs from {len(patches)} patches.\n")
    
    if dry_run:
        print("DRY RUN — Showing first 5 QA pairs:\n")
        for qa in all_qa_pairs[:5]:
            print(f"  Patch: {qa['patch_id']}")
            print(f"  Q: {qa['query']}")
            print(f"  A: {qa['answer']}")
            print()
        print("No files written.")
        return
    
    # ── Step 4: Save ──
    output_path = os.path.join(output_dir, "ben_train.json")
    with open(output_path, "w") as f:
        json.dump(all_qa_pairs, f, indent=2)
    
    print(f"Saved {len(all_qa_pairs)} QA pairs to {output_path}")
    
    # Also save a metadata summary
    summary = {
        "num_patches": len(patches),
        "num_qa_pairs": len(all_qa_pairs),
        "unique_labels": sorted(set(l for p in patches for l in p["labels"])),
        "seed": seed,
    }
    summary_path = os.path.join(output_dir, "ben_train_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"Saved metadata summary to {summary_path}")
    print("\nDone!")


def _create_fallback_data(num_samples: int, output_dir: str, dry_run: bool):
    """
    Create synthetic VQA training data when BigEarthNet is not accessible.
    Uses the 19-class label set with random combinations.
    """
    import numpy as np
    import rasterio
    from rasterio.transform import from_origin
    
    print("\nCreating synthetic training data with realistic labels...\n")
    
    labels_list = list(BEN_19_CLASS_MAP.values())
    all_qa_pairs = []
    
    s1_dir = os.path.join("data", "raw", "Sentinel-1")
    s2_dir = os.path.join("data", "raw", "Sentinel-2")
    os.makedirs(s1_dir, exist_ok=True)
    os.makedirs(s2_dir, exist_ok=True)
    
    for i in range(num_samples):
        patch_id = f"synth_patch_{i:04d}"
        
        # Random 1-4 labels per patch
        num_labels = random.randint(1, 4)
        patch_labels = random.sample(labels_list, num_labels)
        
        qa_pairs = generate_vqa_pairs(patch_id, patch_labels, max_pairs=3)
        all_qa_pairs.extend(qa_pairs)
        
        # Create corresponding synthetic GeoTIFFs (only if not dry run)
        if not dry_run:
            _create_synth_geotiff(
                os.path.join(s1_dir, f"{patch_id}_S1.tif"),
                num_bands=2, max_val=10,
            )
            _create_synth_geotiff(
                os.path.join(s2_dir, f"{patch_id}_S2.tif"),
                num_bands=4, max_val=4000,
            )
    
    if dry_run:
        print(f"Would generate {len(all_qa_pairs)} QA pairs and {num_samples} image pairs.\n")
        for qa in all_qa_pairs[:5]:
            print(f"  Patch: {qa['patch_id']}")
            print(f"  Q: {qa['query']}")
            print(f"  A: {qa['answer']}")
            print()
        return
    
    output_path = os.path.join(output_dir, "ben_train.json")
    with open(output_path, "w") as f:
        json.dump(all_qa_pairs, f, indent=2)
    
    print(f"Saved {len(all_qa_pairs)} synthetic QA pairs to {output_path}")
    print(f"Created {num_samples} synthetic S1+S2 image pairs.\n")


def _create_synth_geotiff(filepath: str, num_bands: int, max_val: int):
    """Generate a synthetic GeoTIFF for testing."""
    import numpy as np
    import rasterio
    from rasterio.transform import from_origin
    
    if os.path.exists(filepath):
        return
        
    data = np.random.randint(0, max_val, size=(num_bands, 120, 120)).astype(np.float32)
    transform = from_origin(10.0, 50.0, 10, 10)
    
    with rasterio.open(
        filepath, "w", driver="GTiff", height=120, width=120,
        count=num_bands, dtype=str(data.dtype),
        crs="+proj=latlong", transform=transform,
    ) as dst:
        for b in range(num_bands):
            dst.write(data[b], b + 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare BigEarthNet training data")
    parser.add_argument("--num_samples", type=int, default=200, help="Number of patches to sample")
    parser.add_argument("--dry_run", action="store_true", help="Preview without writing files")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()
    
    setup_data(num_samples=args.num_samples, dry_run=args.dry_run, seed=args.seed)