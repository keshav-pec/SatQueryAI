"""
Main evaluation script for SatQuery AI.

Runs the fine-tuned Qwen2-VL model against public benchmarks
(VRSBench, RSVQA, CDVQA) and computes VQA metrics.

Usage:
    python scripts/evaluate.py --benchmark vrsbench --max_samples 50
    python scripts/evaluate.py --benchmark rsvqa --variant LR --max_samples 100
    python scripts/evaluate.py --benchmark cdvqa --max_samples 50
    python scripts/evaluate.py --benchmark all --max_samples 50
"""

import os
import sys
import argparse
import json
import time

import torch
import numpy as np
from PIL import Image
from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
from peft import PeftModel
from tqdm import tqdm

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.benchmark_loaders.vrsbench_loader import load_vrsbench
from scripts.benchmark_loaders.rsvqa_loader import load_rsvqa
from scripts.benchmark_loaders.cdvqa_loader import load_cdvqa
from scripts.metrics import evaluate_predictions, print_report


def load_model(lora_path: str = "data/processed/lora_weights"):
    """Load the fine-tuned Qwen2-VL model with LoRA weights."""
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Loading model on {device}...")

    base_model_id = "Qwen/Qwen2-VL-2B-Instruct"
    processor = AutoProcessor.from_pretrained(base_model_id)

    base_model = Qwen2VLForConditionalGeneration.from_pretrained(
        base_model_id,
        torch_dtype=torch.bfloat16 if device != "cpu" else torch.float32,
        device_map=device,
    )

    # Load LoRA weights if they exist
    if os.path.exists(lora_path):
        print(f"Loading LoRA weights from {lora_path}...")
        model = PeftModel.from_pretrained(base_model, lora_path)
    else:
        print(f"Warning: No LoRA weights found at {lora_path}, using base model.")
        model = base_model

    model.eval()
    print("Model loaded.\n")
    return model, processor, device


def load_image_for_inference(image_path: str) -> np.ndarray | None:
    """
    Load an image for Qwen2-VL inference.
    Handles both standard images (JPEG/PNG) and GeoTIFFs.
    """
    if not os.path.exists(image_path):
        return None

    ext = os.path.splitext(image_path)[1].lower()

    # Standard image formats — load directly with PIL
    if ext in (".jpg", ".jpeg", ".png", ".bmp", ".webp"):
        img = Image.open(image_path).convert("RGB")
        return np.array(img)

    # GeoTIFF — use rasterio
    if ext in (".tif", ".tiff"):
        try:
            import rasterio
            with rasterio.open(image_path) as src:
                bands = src.read()
                # Take first 3 bands for RGB
                if bands.shape[0] >= 3:
                    rgb = np.stack([bands[2], bands[1], bands[0]], axis=0)  # BGR -> RGB
                else:
                    rgb = np.stack([bands[0]] * 3, axis=0)

                # Normalize to 0-255
                rgb = rgb.astype(np.float32)
                p2, p98 = np.percentile(rgb, [2, 98])
                if p98 > p2:
                    rgb = np.clip((rgb - p2) / (p98 - p2) * 255, 0, 255)
                else:
                    rgb = np.clip(rgb / (rgb.max() + 1e-6) * 255, 0, 255)

                return rgb.transpose(1, 2, 0).astype(np.uint8)  # (H, W, C)
        except Exception as e:
            print(f"  Warning: Failed to load GeoTIFF {image_path}: {e}")
            return None

    return None


def run_inference(
    model,
    processor,
    device: str,
    image_paths: list[str],
    question: str,
    max_new_tokens: int = 64,
) -> str:
    """Run VQA inference on one or more images with a question."""
    # Load images
    images = []
    for path in image_paths:
        img = load_image_for_inference(path)
        if img is not None:
            images.append(img)

    if not images:
        return "[ERROR: Could not load images]"

    # Build the prompt
    content = [{"type": "image"} for _ in images]
    content.append({"type": "text", "text": question})

    messages = [{"role": "user", "content": content}]
    text_input = processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )

    inputs = processor(
        text=[text_input],
        images=images,
        return_tensors="pt",
        padding=True,
    ).to(device)

    with torch.no_grad():
        generated_ids = model.generate(**inputs, max_new_tokens=max_new_tokens)

    # Trim prompt tokens from output
    generated_ids_trimmed = [
        out_ids[len(in_ids):]
        for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]

    response = processor.batch_decode(
        generated_ids_trimmed,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    )[0]

    return response.strip()


def evaluate_benchmark(
    benchmark: str,
    model,
    processor,
    device: str,
    max_samples: int | None = None,
    variant: str = "LR",
) -> dict:
    """Load a benchmark dataset, run inference, and compute metrics."""
    # Load the dataset
    if benchmark == "vrsbench":
        samples = load_vrsbench(split="test", max_samples=max_samples)
    elif benchmark == "rsvqa":
        samples = load_rsvqa(split="test", variant=variant, max_samples=max_samples)
    elif benchmark == "cdvqa":
        samples = load_cdvqa(split="test", max_samples=max_samples)
    else:
        print(f"Unknown benchmark: {benchmark}")
        return {}

    if not samples:
        print(f"No samples loaded for {benchmark}. Skipping.\n")
        return {}

    # Run inference
    print(f"\nRunning inference on {len(samples)} samples...")
    predictions = []
    skipped = 0

    for i, sample in enumerate(tqdm(samples, desc=f"Evaluating {benchmark}")):
        try:
            pred = run_inference(
                model, processor, device,
                image_paths=sample["image_paths"],
                question=sample["question"],
            )

            predictions.append({
                "question": sample["question"],
                "prediction": pred,
                "ground_truth": sample["answer"],
                "question_type": sample.get("question_type", "unknown"),
            })
        except Exception as e:
            skipped += 1
            if skipped <= 3:
                print(f"  Warning: Skipping sample {i}: {e}")

    if skipped > 0:
        print(f"  Skipped {skipped} samples due to errors.")

    if not predictions:
        print("No valid predictions. Cannot compute metrics.")
        return {}

    # Compute metrics
    output_dir = "data/processed/eval_results"
    output_path = os.path.join(output_dir, f"{benchmark}_results.json")

    results = evaluate_predictions(predictions, output_path=output_path)
    results["benchmark"] = benchmark
    results["skipped"] = skipped

    # Also save the raw predictions for inspection
    preds_path = os.path.join(output_dir, f"{benchmark}_predictions.json")
    os.makedirs(output_dir, exist_ok=True)
    with open(preds_path, "w") as f:
        json.dump(predictions, f, indent=2)
    print(f"Raw predictions saved to {preds_path}")

    return results


def main():
    parser = argparse.ArgumentParser(description="Evaluate SatQuery AI on VQA benchmarks")
    parser.add_argument(
        "--benchmark",
        type=str,
        required=True,
        choices=["vrsbench", "rsvqa", "cdvqa", "all"],
        help="Which benchmark to evaluate on.",
    )
    parser.add_argument(
        "--max_samples",
        type=int,
        default=50,
        help="Maximum number of samples to evaluate (default: 50).",
    )
    parser.add_argument(
        "--variant",
        type=str,
        default="LR",
        choices=["LR", "HR"],
        help="RSVQA variant: LR (Low Resolution) or HR (High Resolution).",
    )
    parser.add_argument(
        "--lora_path",
        type=str,
        default="data/processed/lora_weights",
        help="Path to trained LoRA weights.",
    )
    args = parser.parse_args()

    # Load model once
    model, processor, device = load_model(args.lora_path)

    benchmarks = (
        ["vrsbench", "rsvqa", "cdvqa"] if args.benchmark == "all" else [args.benchmark]
    )

    all_results = {}
    for bm in benchmarks:
        print(f"\n{'='*50}")
        print(f"  BENCHMARK: {bm.upper()}")
        print(f"{'='*50}\n")

        start = time.time()
        results = evaluate_benchmark(
            benchmark=bm,
            model=model,
            processor=processor,
            device=device,
            max_samples=args.max_samples,
            variant=args.variant,
        )
        elapsed = time.time() - start

        if results:
            results["elapsed_seconds"] = round(elapsed, 1)
            print_report(results)
            all_results[bm] = results

    # Save combined results
    if len(all_results) > 1:
        combined_path = "data/processed/eval_results/combined_results.json"
        os.makedirs(os.path.dirname(combined_path), exist_ok=True)
        with open(combined_path, "w") as f:
            json.dump(all_results, f, indent=2)
        print(f"\nCombined results saved to {combined_path}")


if __name__ == "__main__":
    main()
