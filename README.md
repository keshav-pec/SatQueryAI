# SatQuery AI 🛰️

SatQuery AI is a multi-modal, agentic remote sensing assistant designed to analyze satellite imagery (Sentinel-1 SAR and Sentinel-2 Optical) using state-of-the-art Vision-Language Models (VLMs). 

Built specifically for the ISRO Smart India Hackathon, it features an institutional-grade web interface, dynamic AI tool routing via LangGraph, and a highly optimized deep learning training pipeline.

## Features
- **Agentic Routing**: Automatically detects the type of imagery uploaded (Single Optical, SAR+Optical pair, or Bi-Temporal Change Detection) and routes it to the correct specialized AI tool.
- **VLM Intelligence**: Powered by Qwen2-VL-2B (Fine-tuned using PEFT/LoRA).
- **Institutional UI**: A highly responsive, formal React/Next.js dashboard built with TailwindCSS.
- **Full-Scale Evaluation**: Built-in VQA metrics suite supporting Exact Match, BLEU (1-4), and ROUGE-L.

---

## 💻 Local Setup (For GPU-Enabled Laptops)

This project has been heavily optimized for local training on Nvidia GPUs (CUDA) or Apple Silicon (MPS). 

### 1. Backend & AI Setup

Create a Python virtual environment and install the dependencies:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Frontend UI Setup

Navigate to the `ui` folder and install the Node modules:
```bash
cd ui
npm install
```

---

## 🚀 Running the Application

To run the full stack, you need to start both the FastAPI backend and the Next.js frontend.

**Start the AI Backend:**
```bash
source venv/bin/activate
uvicorn src.api.main:app --reload --port 8050
```

**Start the User Interface:**
```bash
cd ui
npm run dev -- -p 3030
```
Open [http://localhost:3030](http://localhost:3030) in your browser. You can use the GeoTIFFs inside the `data/test_samples/` folder to test the UI immediately.

---

## 🧠 Fine-Tuning the Model (Data & Training Pipeline)

If you have a GPU-enabled laptop, you can generate the BigEarthNet dataset and train the LoRA weights locally!

### Generate the Dataset
Run the data setup script. It will generate QA pairs and multi-band synthetic GeoTIFFs if the live HuggingFace stream is unavailable.
```bash
python scripts/setup_dev_data.py --num_samples 5000
```

### Start the Training Loop
The training script automatically detects `cuda` or `mps` and applies LoRA adapters to the 2B parameter Qwen2-VL model. It uses gradient accumulation and cosine annealing learning rates.
```bash
python scripts/train_lora.py --epochs 3 --batch_size 4 --accumulation_steps 4
```
*(Checkpoints will automatically save to `data/processed/lora_weights`)*

### Evaluate the Model
Run the benchmarking suite on your trained model to get VQA scores.
```bash
python scripts/evaluate.py --benchmark vrsbench --max_samples 100
```

---
## Project Structure
- `src/api/` - FastAPI backend servers.
- `src/agent/` - LangGraph orchestrator and AI tools.
- `src/models/` - VLM model loading and adapter injections.
- `src/data_prep/` - GeoTIFF tensor normalizers.
- `scripts/` - Utilities for dataset downloading, training, and metrics evaluation.
- `ui/` - The Next.js React frontend dashboard.
