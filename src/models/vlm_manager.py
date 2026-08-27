import torch
# We replaced AutoModelForVision2Seq with Qwen2VLForConditionalGeneration
from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
from peft import LoraConfig, get_peft_model

class SatQueryVLM:
    def __init__(self, model_id="Qwen/Qwen2-VL-2B-Instruct", device=None):
        """
        Initializes the base Vision-Language Model.
        For Mac users, 'mps' (Metal Performance Shaders) utilizes the Apple Silicon GPU.
        """
        # Auto-detect CUDA (Nvidia), MPS (Apple Silicon), fallback to CPU
        if device is None:
            if torch.cuda.is_available():
                self.device = "cuda"
            elif torch.backends.mps.is_available():
                self.device = "mps"
            else:
                self.device = "cpu"
        else:
            self.device = device
            
        print(f"⚙️  Loading base model on: {self.device}...")
        
        # Load the processor (handles text tokenization and image resizing)
        self.processor = AutoProcessor.from_pretrained(model_id)
        
        # Load the base model using the specific Qwen2-VL class
        # (Using bfloat16 saves memory if supported by your hardware)
        self.model = Qwen2VLForConditionalGeneration.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16 if self.device != "cpu" else torch.float32,
            device_map=self.device
        )
        print("✅ Base model loaded.")

    def apply_lora(self, r=16, alpha=32):
        """
        Injects LoRA adapters into the model for memory-efficient fine-tuning.
        """
        print("🛠️  Applying LoRA adapters...")
        
        # Configure which parts of the brain get the "sticky notes"
        config = LoraConfig(
            r=r, 
            lora_alpha=alpha,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj"], # Text attention layers
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM"
        )
        
        # Wrap the base model with PEFT
        self.model = get_peft_model(self.model, config)
        
        # CRITICAL FOR REMOTE SENSING: Unfreeze the visual projector
        unfrozen_params = 0
        for name, param in self.model.named_parameters():
            if "visual_projector" in name or "merger" in name:
                param.requires_grad = True
                unfrozen_params += param.numel()
                
        print(f"✅ LoRA applied. Unfrozen projector parameters: {unfrozen_params:,}")
        self.model.print_trainable_parameters()
        return self.model

# ==========================================
# SMOKE TEST
# ==========================================
if __name__ == "__main__":
    print("Testing the SatQuery VLM Manager...\n")
    print("⚠️  NOTE: The first time you run this, it will download a ~4GB base model from Hugging Face.")
    
    # We use a smaller 2B parameter model for local development testing
    vlm_system = SatQueryVLM(model_id="Qwen/Qwen2-VL-2B-Instruct")
    
    # Apply LoRA adapters
    lora_model = vlm_system.apply_lora(r=16, alpha=32)
    
    print("\n🎉 Model Architecture is fully configured and ready for the training loop!")