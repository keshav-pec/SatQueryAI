# SatQuery AI 🛰️

**An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries**

> Developed for the Smart India Hackathon 2026

---

## Problem Statement

Remote-sensing imagery is widely used for agricultural monitoring, disaster management, urban planning, forest monitoring, water-resource assessment, infrastructure mapping, and environmental analysis. However, most existing remote-sensing AI solutions are developed as isolated applications for a single predefined task, such as land-cover classification, object detection, visual question answering, or change detection.

These systems often require users to understand satellite-data characteristics, GIS workflows, model selection, and task-specific parameters. Consequently, non-expert users may find it difficult to obtain meaningful information from satellite imagery through simple natural-language queries.

SatQuery AI addresses this by providing an **agentic, query-driven framework** that automatically selects and executes suitable remote-sensing specialist models, validates inputs, combines outputs, and returns **evidence-grounded responses**.

---

## Objectives

SatQuery AI is a software-based agentic vision-language assistant for analysing single and paired remote-sensing images through natural-language queries. Single-image understanding is a mandatory baseline, while the principal focus is joint reasoning over paired cross-modal and multitemporal imagery.

### Defined Input Scope

| Input Type | Description |
|-----------|-------------|
| **Single Image** | One optical/multispectral or SAR image for captioning, VQA, and text-guided region grounding |
| **Cross-Modal Pair** | Co-registered optical/multispectral and SAR images for joint information extraction |
| **Bi-Temporal Pair** | Two spatially corresponding images from different times for change detection and change-based VQA |
| **Supported Formats** | GeoTIFF (.tif), TIFF (.tiff). PNG and JPEG accepted for prescribed public benchmark datasets |

---

## Features & Mandatory Functional Scope

| Capability | Description | Status |
|-----------|-------------|--------|
| **Remote-Sensing Adaptation** | Vision-language model fine-tuned using BigEarthNet.txt with LoRA for domain adaptation | ✅ |
| **Single-Image VQA** | Visual question answering on optical or SAR satellite imagery | ✅ |
| **Single-Image Captioning** | Automated scene description and land-cover captioning | ✅ |
| **Bi-Temporal Change Analysis** | Change description and change-based VQA from bi-temporal image pairs | ✅ |
| **Cross-Modal Pair Analysis** | Joint information extraction from co-registered optical–SAR image pairs | ✅ |
| **Agentic Orchestration** | Automatic task classification, model selection, execution sequencing, and output integration via LangGraph | ✅ |
| **Interactive GUI** | Web application with image upload, natural-language query, results display, and execution trace | ✅ |
| **Execution Summaries** | Auditable execution trace with selected task, model/tool names, and key parameters | ✅ |

### Representative Queries Supported

- *"Describe the land-cover and major objects visible in this image."*
- *"What is the primary land cover shown in this image?"*
- *"What changed between these two dates, and where did the change occur?"*
- *"Use the optical and SAR images together to identify built-up and water-covered regions."*
- *"Has the built-up area increased, decreased, or remained unchanged?"*

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        SatQuery AI                             │
├────────────────┬───────────────────────────────────────────────┤
│   Frontend     │   Next.js 16 · TypeScript · Framer Motion    │
│   (Vercel)     │   Interactive analysis dashboard              │
├────────────────┼───────────────────────────────────────────────┤
│   API Layer    │   FastAPI · REST · CORS · File Upload         │
├────────────────┼───────────────────────────────────────────────┤
│   Agentic      │   LangGraph StateGraph                       │
│   Controller   │   Router → Executor → Response               │
│                │   Task classification · Model selection       │
│                │   Input validation · Execution trace          │
├────────────────┼───────────────────────────────────────────────┤
│   Specialist   │   Single-Image VQA (Qwen2-VL + LoRA)        │
│   Tools        │   Single-Image Captioning (Qwen2-VL + LoRA) │
│                │   Cross-Modal VQA (Optical + SAR)            │
│                │   Bi-Temporal Change VQA                      │
├────────────────┼───────────────────────────────────────────────┤
│   Data Layer   │   Rasterio GeoTIFF processing                │
│                │   Sentinel-2 RGB · Sentinel-1 VV/VH          │
│                │   Normalization and tensor conversion          │
└────────────────┴───────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **Vision-Language Model** | Qwen2-VL-2B-Instruct |
| **Fine-Tuning** | LoRA (PEFT) — domain adaptation on BigEarthNet.txt |
| **Agent Framework** | LangGraph (StateGraph) |
| **Backend** | Python · FastAPI · PyTorch · Transformers |
| **GeoTIFF Processing** | Rasterio · NumPy |
| **Frontend** | Next.js 16 · TypeScript · React 19 |
| **Animations** | Framer Motion |
| **Evaluation Metrics** | BLEU-1→4 · ROUGE-L · Exact Match |
| **Benchmarks** | VRSBench · RSVQA · CDVQA |

---

## Datasets

| Dataset | Purpose | Reference |
|---------|---------|-----------|
| **BigEarthNet.txt** | Primary dataset for remote-sensing adaptation using co-registered Sentinel-1 SAR, Sentinel-2 multispectral imagery, and diverse text annotations | [arxiv.org/abs/2603.29630](https://arxiv.org/abs/2603.29630) |
| **VRSBench** | Evaluation benchmark for single-image captioning, grounding, and VQA | Public benchmark |
| **RSVQA** | Evaluation benchmark for single-image visual question answering | Public benchmark |
| **CDVQA** | Evaluation benchmark for multi-temporal change-based VQA | Public benchmark |

---

## 💻 Local Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- ~4GB disk space (for base VLM model download)
- GPU recommended (CUDA or Apple MPS) but CPU works

### 1. Backend & AI Setup

```bash
# Clone the repository
git clone https://github.com/your-username/SatQueryAI.git
cd SatQueryAI

# Create Python environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

---

## 🚀 Running the Application

Start both the FastAPI backend and the Next.js frontend:

**Terminal 1 — AI Backend:**
```bash
source venv/bin/activate
uvicorn src.api.main:app --reload --port 8050
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.  
Use the sample GeoTIFFs in `test_samples/` to test the application.

---

## 🧠 Training Pipeline (BigEarthNet.txt Domain Adaptation)

### Generate Training Data

```bash
python scripts/setup_bigearthnet_data.py --num_samples 500
```

This downloads remote-sensing imagery, converts it to Sentinel-compatible GeoTIFF format (BGR, 0-4000 reflectance), and generates VQA training pairs.

### Fine-Tune with LoRA

```bash
python scripts/train_lora.py --epochs 3 --batch_size 4 --accumulation_steps 4
```

Features:
- Automatic Mixed Precision (AMP) training
- Cosine annealing learning rate scheduler
- Gradient accumulation for effective larger batch sizes
- Automatic checkpointing to `data/processed/lora_weights/`

### Evaluate on Benchmarks

```bash
# Individual benchmarks
python scripts/evaluate.py --benchmark vrsbench --max_samples 100
python scripts/evaluate.py --benchmark rsvqa --variant LR --max_samples 100
python scripts/evaluate.py --benchmark cdvqa --max_samples 50

# All benchmarks
python scripts/evaluate.py --benchmark all --max_samples 100
```

Metrics computed: Exact Match Accuracy, BLEU-1 through BLEU-4, ROUGE-L (F1), per-type accuracy breakdown.

---

## 📁 Project Structure

```
SatQueryAI/
├── src/
│   ├── api/
│   │   └── main.py              # FastAPI server with /analyze endpoint
│   ├── agent/
│   │   ├── orchestrator.py      # LangGraph agentic controller
│   │   └── tools_registry.py    # Specialist AI tools (VQA, Captioning, Change, Cross-Modal)
│   ├── models/
│   │   └── vlm_manager.py       # Qwen2-VL base model + LoRA adapter injection
│   └── data_prep/
│       ├── dataset.py           # PyTorch Dataset for S1+S2+text triplets
│       └── geotiff_loader.py    # Rasterio GeoTIFF → normalized tensor
├── scripts/
│   ├── setup_bigearthnet_data.py  # BigEarthNet.txt data preparation
│   ├── setup_dev_data.py          # Development data generation
│   ├── train_lora.py              # LoRA fine-tuning pipeline
│   ├── evaluate.py                # Benchmark evaluation runner
│   ├── metrics.py                 # VQA metrics (BLEU, ROUGE-L, EM)
│   └── benchmark_loaders/         # VRSBench, RSVQA, CDVQA dataset loaders
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx           # Landing page
│       │   ├── analysis/page.tsx  # Analysis dashboard
│       │   ├── about/page.tsx     # About & architecture
│       │   └── api-docs/page.tsx  # API documentation
│       └── components/
│           ├── Navbar.tsx
│           └── Footer.tsx
├── data/
│   ├── raw/                       # Sentinel-1 & Sentinel-2 GeoTIFFs
│   ├── processed/                 # Training JSON & LoRA weights
│   └── test_samples/              # Sample imagery for testing
├── test_samples/                  # Quick-test GeoTIFFs
├── requirements.txt
└── README.md
```

---

## Evaluation Criteria

Final evaluation uses prescribed public benchmark test subsets and an ISRO/SAC evaluation dataset. Scores are normalised before combining different metrics.

| Benchmark | Task | Metrics |
|-----------|------|---------|
| VRSBench | Single-image captioning, grounding, VQA | BLEU, ROUGE-L, EM |
| RSVQA | Single-image visual question answering | Exact Match Accuracy |
| CDVQA | Multi-temporal change-based VQA | Exact Match Accuracy, BLEU |
| ISRO/SAC | Cartosat-2S + RISAT image pairs | Task-specific (undisclosed) |

---

## Deployment

- **Frontend**: Deployed to [Vercel](https://vercel.com) (static + SSR)
- **Backend**: Local FastAPI server with GPU inference

For Vercel deployment:
```bash
cd frontend
npx vercel --prod
```

Set the environment variable `NEXT_PUBLIC_API_URL` in the Vercel dashboard to point to your backend server.

---

## License

This project was developed for the Smart India Hackathon under the Indian Space Research Organisation (ISRO) problem statement.

---

*Built with ❤️ for advancing remote-sensing intelligence through natural-language interaction.*
