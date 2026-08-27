"""
LoRA fine-tuning script for SatQuery AI.

Trains the Qwen2-VL vision-language model on BigEarthNet VQA data
using LoRA (Low-Rank Adaptation) for memory-efficient fine-tuning.

Usage:
    python scripts/train_lora.py --epochs 2 --batch_size 1 --lr 2e-5
    python scripts/train_lora.py --epochs 1 --batch_size 2 --num_samples 100
"""

import os
import sys
import time
import argparse
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
from torch.utils.data import DataLoader, random_split
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
import numpy as np

from src.data_prep.dataset import SatQueryDataset
from src.models.vlm_manager import SatQueryVLM


def custom_collate_fn(batch, processor):
    """
    Takes a batch of raw data and formats it for the Qwen2-VL model.
    """
    texts = []
    images = []

    for item in batch:
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image"},
                    {"type": "text", "text": item["query"]},
                ],
            },
            {
                "role": "assistant",
                "content": [{"type": "text", "text": item["answer"]}],
            },
        ]

        text = processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=False
        )
        texts.append(text)

        # Convert (C, H, W) tensor to (H, W, C) numpy uint8 for the processor
        s2_img = item["s2_image"].permute(1, 2, 0).numpy() * 255
        images.append(s2_img.astype(np.uint8))

    batch_inputs = processor(
        text=texts, images=images, return_tensors="pt", padding=True
    )

    return batch_inputs


def train(args):
    print("=" * 50)
    print("  SatQuery AI — LoRA Fine-Tuning")
    print("=" * 50)
    print(f"  Epochs:        {args.epochs}")
    print(f"  Batch size:    {args.batch_size}")
    print(f"  Learning rate: {args.lr}")
    print(f"  Accum steps:   {args.accumulation_steps}")
    print(f"  Data:          {args.data_path}")
    print("=" * 50 + "\n")

    # ── 1. Load Model ──
    print("Loading model...")
    vlm_system = SatQueryVLM(model_id="Qwen/Qwen2-VL-2B-Instruct")
    model = vlm_system.apply_lora(r=16, alpha=32)
    processor = vlm_system.processor
    device = vlm_system.device

    # ── 2. Load Data ──
    print("Loading dataset...")
    dataset = SatQueryDataset(
        json_path=args.data_path,
        s1_dir=args.s1_dir,
        s2_dir=args.s2_dir,
    )

    # Train/Val split (90/10)
    total = len(dataset)
    val_size = max(1, int(total * 0.1))
    train_size = total - val_size

    train_dataset, val_dataset = random_split(
        dataset, [train_size, val_size],
        generator=torch.Generator().manual_seed(42),
    )

    print(f"  Train: {train_size} samples, Val: {val_size} samples\n")

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=lambda b: custom_collate_fn(b, processor),
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        collate_fn=lambda b: custom_collate_fn(b, processor),
    )

    # ── 3. Optimizer & Scheduler ──
    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    total_steps = len(train_loader) * args.epochs // args.accumulation_steps
    scheduler = CosineAnnealingLR(optimizer, T_max=max(1, total_steps), eta_min=args.lr * 0.1)

    # ── 4. Training Loop ──
    model.train()
    best_val_loss = float("inf")
    training_log = []

    checkpoint_dir = os.path.join("data", "processed", "lora_checkpoints")
    os.makedirs(checkpoint_dir, exist_ok=True)

    print(f"Starting training on {device} for {args.epochs} epochs...\n")
    global_step = 0
    start_time = time.time()

    for epoch in range(args.epochs):
        epoch_loss = 0.0
        epoch_steps = 0
        optimizer.zero_grad()

        for step, batch in enumerate(train_loader):
            batch = {k: v.to(device) for k, v in batch.items()}

            # Forward pass
            outputs = model(
                input_ids=batch["input_ids"],
                attention_mask=batch["attention_mask"],
                pixel_values=batch.get("pixel_values"),
                image_grid_thw=batch.get("image_grid_thw"),
                mm_token_type_ids=batch.get("mm_token_type_ids"),
                labels=batch["input_ids"],
            )

            loss = outputs.loss / args.accumulation_steps
            loss.backward()

            epoch_loss += outputs.loss.item()
            epoch_steps += 1
            global_step += 1

            # Gradient accumulation step
            if (step + 1) % args.accumulation_steps == 0 or (step + 1) == len(train_loader):
                # Gradient clipping to prevent explosion
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()

            # Progress logging
            elapsed = time.time() - start_time
            steps_per_sec = global_step / elapsed if elapsed > 0 else 0
            remaining_steps = (len(train_loader) * args.epochs) - global_step
            eta = remaining_steps / steps_per_sec if steps_per_sec > 0 else 0

            if (step + 1) % max(1, len(train_loader) // 10) == 0 or (step + 1) == len(train_loader):
                print(
                    f"  Epoch {epoch+1}/{args.epochs} | "
                    f"Step {step+1}/{len(train_loader)} | "
                    f"Loss: {outputs.loss.item():.4f} | "
                    f"LR: {scheduler.get_last_lr()[0]:.2e} | "
                    f"ETA: {eta/60:.1f}m"
                )

            # Checkpoint every N steps
            if args.checkpoint_steps > 0 and global_step % args.checkpoint_steps == 0:
                ckpt_path = os.path.join(checkpoint_dir, f"step_{global_step}")
                model.save_pretrained(ckpt_path)
                print(f"  Checkpoint saved to {ckpt_path}")

        avg_train_loss = epoch_loss / max(1, epoch_steps)

        # ── Validation ──
        model.eval()
        val_loss = 0.0
        val_steps = 0

        with torch.no_grad():
            for batch in val_loader:
                batch = {k: v.to(device) for k, v in batch.items()}
                outputs = model(
                    input_ids=batch["input_ids"],
                    attention_mask=batch["attention_mask"],
                    pixel_values=batch.get("pixel_values"),
                    image_grid_thw=batch.get("image_grid_thw"),
                    mm_token_type_ids=batch.get("mm_token_type_ids"),
                    labels=batch["input_ids"],
                )
                val_loss += outputs.loss.item()
                val_steps += 1

        avg_val_loss = val_loss / max(1, val_steps)
        model.train()

        log_entry = {
            "epoch": epoch + 1,
            "train_loss": round(avg_train_loss, 4),
            "val_loss": round(avg_val_loss, 4),
            "lr": scheduler.get_last_lr()[0],
        }
        training_log.append(log_entry)

        print(f"\n  Epoch {epoch+1} Summary:")
        print(f"    Train Loss: {avg_train_loss:.4f}")
        print(f"    Val Loss:   {avg_val_loss:.4f}")

        # Save best model
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_path = os.path.join("data", "processed", "lora_weights")
            model.save_pretrained(best_path)
            processor.save_pretrained(best_path)
            print(f"    New best model saved to {best_path}")

        print()

    # ── 5. Save training log ──
    total_time = time.time() - start_time
    log_path = os.path.join("data", "processed", "training_log.json")
    log_data = {
        "config": vars(args),
        "total_time_seconds": round(total_time, 1),
        "best_val_loss": round(best_val_loss, 4),
        "epochs": training_log,
    }
    with open(log_path, "w") as f:
        json.dump(log_data, f, indent=2)

    print(f"Training complete in {total_time/60:.1f} minutes.")
    print(f"Best validation loss: {best_val_loss:.4f}")
    print(f"Training log saved to {log_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune Qwen2-VL with LoRA")
    parser.add_argument("--epochs", type=int, default=2, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=1, help="Batch size")
    parser.add_argument("--lr", type=float, default=2e-5, help="Learning rate")
    parser.add_argument("--accumulation_steps", type=int, default=4, help="Gradient accumulation steps")
    parser.add_argument("--checkpoint_steps", type=int, default=0, help="Save checkpoint every N steps (0 = off)")
    parser.add_argument("--data_path", type=str, default="data/processed/ben_train.json",
                        help="Path to training JSON data")
    parser.add_argument("--s1_dir", type=str, default="data/raw/Sentinel-1",
                        help="Sentinel-1 image directory")
    parser.add_argument("--s2_dir", type=str, default="data/raw/Sentinel-2",
                        help="Sentinel-2 image directory")
    args = parser.parse_args()

    train(args)