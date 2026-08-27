"""
Standalone metrics module for evaluating VQA model predictions
against ground truth answers.

Supports:
  - Exact Match Accuracy
  - BLEU-1 through BLEU-4
  - ROUGE-L (F1)
  - Per-type accuracy breakdown
"""

import json
import os
from collections import defaultdict

import nltk
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction
from rouge_score import rouge_scorer


def _ensure_nltk_data():
    """Download required NLTK tokenizer if not present."""
    try:
        nltk.data.find("tokenizers/punkt_tab")
    except LookupError:
        import ssl
        try:
            _create_unverified_https_context = ssl._create_unverified_context
        except AttributeError:
            pass
        else:
            ssl._create_default_https_context = _create_unverified_https_context
        nltk.download("punkt_tab", quiet=True)


def exact_match(prediction: str, ground_truth: str) -> bool:
    """Case-insensitive exact match after stripping whitespace."""
    return prediction.strip().lower() == ground_truth.strip().lower()


def compute_bleu(prediction: str, ground_truth: str) -> dict:
    """
    Compute BLEU-1 through BLEU-4 for a single prediction/reference pair.
    Uses smoothing to handle short sequences.
    """
    _ensure_nltk_data()
    ref_tokens = nltk.word_tokenize(ground_truth.lower())
    pred_tokens = nltk.word_tokenize(prediction.lower())

    smoother = SmoothingFunction().method1

    scores = {}
    for n in range(1, 5):
        weights = tuple([1.0 / n] * n + [0.0] * (4 - n))
        try:
            scores[f"bleu_{n}"] = sentence_bleu(
                [ref_tokens], pred_tokens, weights=weights, smoothing_function=smoother
            )
        except (ValueError, ZeroDivisionError):
            scores[f"bleu_{n}"] = 0.0

    return scores


def compute_rouge_l(prediction: str, ground_truth: str) -> float:
    """Compute ROUGE-L F1 score."""
    scorer = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=True)
    result = scorer.score(ground_truth, prediction)
    return result["rougeL"].fmeasure


def evaluate_predictions(
    predictions: list[dict],
    output_path: str | None = None,
) -> dict:
    """
    Evaluate a list of prediction dicts against ground truth.

    Each dict in `predictions` must have:
      - "prediction": str
      - "ground_truth": str
      - "question_type" (optional): str — for per-type breakdown

    Returns a summary dict with all metrics.
    """
    if not predictions:
        return {"error": "No predictions to evaluate"}

    n = len(predictions)
    em_correct = 0
    bleu_accum = defaultdict(float)
    rouge_accum = 0.0
    type_counts = defaultdict(lambda: {"total": 0, "correct": 0})

    for item in predictions:
        pred = item["prediction"]
        gt = item["ground_truth"]
        qtype = item.get("question_type", "unknown")

        # Exact match
        is_correct = exact_match(pred, gt)
        em_correct += int(is_correct)
        type_counts[qtype]["total"] += 1
        type_counts[qtype]["correct"] += int(is_correct)

        # BLEU
        bleu = compute_bleu(pred, gt)
        for k, v in bleu.items():
            bleu_accum[k] += v

        # ROUGE-L
        rouge_accum += compute_rouge_l(pred, gt)

    # Aggregate
    results = {
        "num_samples": n,
        "exact_match_accuracy": round(em_correct / n, 4),
        "bleu_1": round(bleu_accum["bleu_1"] / n, 4),
        "bleu_2": round(bleu_accum["bleu_2"] / n, 4),
        "bleu_3": round(bleu_accum["bleu_3"] / n, 4),
        "bleu_4": round(bleu_accum["bleu_4"] / n, 4),
        "rouge_l_f1": round(rouge_accum / n, 4),
        "per_type_accuracy": {
            qtype: round(data["correct"] / data["total"], 4) if data["total"] > 0 else 0.0
            for qtype, data in sorted(type_counts.items())
        },
    }

    # Save if requested
    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)
        print(f"Results saved to {output_path}")

    return results


def print_report(results: dict):
    """Pretty-print an evaluation report."""
    print("\n" + "=" * 50)
    print("  EVALUATION REPORT")
    print("=" * 50)
    print(f"  Samples evaluated:   {results['num_samples']}")
    print(f"  Exact Match Acc:     {results['exact_match_accuracy']:.2%}")
    print(f"  BLEU-1:              {results['bleu_1']:.4f}")
    print(f"  BLEU-2:              {results['bleu_2']:.4f}")
    print(f"  BLEU-3:              {results['bleu_3']:.4f}")
    print(f"  BLEU-4:              {results['bleu_4']:.4f}")
    print(f"  ROUGE-L (F1):        {results['rouge_l_f1']:.4f}")

    if results.get("per_type_accuracy"):
        print("\n  Per-Type Accuracy:")
        for qtype, acc in results["per_type_accuracy"].items():
            print(f"    {qtype:30s} {acc:.2%}")
    print("=" * 50 + "\n")


# ── Quick self-test ──
if __name__ == "__main__":
    test_preds = [
        {
            "prediction": "Urban fabric and inland waters",
            "ground_truth": "The image shows urban fabric and inland waters.",
            "question_type": "description",
        },
        {
            "prediction": "Yes",
            "ground_truth": "Yes, urban fabric is present in this image.",
            "question_type": "presence",
        },
        {
            "prediction": "No, there is no forest.",
            "ground_truth": "No, there is no coniferous forest in this scene.",
            "question_type": "absence",
        },
    ]
    results = evaluate_predictions(test_preds)
    print_report(results)
