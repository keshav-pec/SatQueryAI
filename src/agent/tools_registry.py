import torch
import numpy as np
from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
from peft import PeftModel

# Change this import at the top of tools_registry.py
from src.data_prep.geotiff_loader import load_sentinel2_optical, load_sentinel1_sar

class RemoteSensingTools:
    """
    This class holds all the specialized AI tools.
    We initialize the model once when the class loads so we don't have to 
    reload a 4GB model every time the user asks a question.
    """
    def __init__(self, lora_path="data/processed/lora_weights"):
        if torch.cuda.is_available():
            self.device = "cuda"
        elif torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"
            
        print(f"🤖 Initializing AI Agent Tools on {self.device}...")
        
        # 1. Load the base model
        base_model_id = "Qwen/Qwen2-VL-2B-Instruct"
        self.processor = AutoProcessor.from_pretrained(base_model_id)
        
        base_model = Qwen2VLForConditionalGeneration.from_pretrained(
            base_model_id,
            torch_dtype=torch.bfloat16 if self.device != "cpu" else torch.float32,
            device_map=self.device
        )
        
        # 2. Attach the LoRA "sticky notes" we just trained
        print("🔗 Merging trained LoRA weights with the base model...")
        self.model = PeftModel.from_pretrained(base_model, lora_path)
        
        # 3. Lock the model (Inference mode, NO training)
        self.model.eval()
        print("✅ Tools are loaded and ready.")

    def single_image_vqa(self, image_path, query):
        """
        TOOL 1: Single-Image VQA
        Analyzes a single optical satellite image and answers a user query.
        """
        print(f"🔍 Tool Executing: Single-Image VQA on {image_path}")
        
        # 1. Load the raw satellite image and normalize it
        tensor_img = load_sentinel2_optical(image_path)
        
        # Convert it back to a standard NumPy image array for the Qwen processor
        # .permute swaps (Channels, Height, Width) to (Height, Width, Channels)
        img_array = (tensor_img.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
        
        # 2. Format the prompt (Notice 'add_generation_prompt=True' tells the AI to start answering)
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image"},
                    {"type": "text", "text": query}
                ]
            }
        ]
        text_input = self.processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        
        # 3. Prepare the mathematical inputs
        inputs = self.processor(
            text=[text_input],
            images=[img_array],
            return_tensors="pt",
            padding=True
        ).to(self.device)
        
        # 4. Generate the answer! (torch.no_grad() saves memory by disabling training calculations)
        with torch.no_grad():
            generated_ids = self.model.generate(**inputs, max_new_tokens=50)
            
        # 5. Decode the output (strip away the prompt so we only get the answer)
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        
        response = self.processor.batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0]
        
        return response
    def cross_modal_vqa(self, s1_path, s2_path, query):
        """
        TOOL 2: Cross-Modal VQA
        Analyzes a Sentinel-1 (SAR) and Sentinel-2 (Optical) image pair simultaneously.
        """
        print(f"🔍 Tool Executing: Cross-Modal VQA on SAR and Optical pair.")
        
        # 1. Load and normalize BOTH images
        tensor_s1 = load_sentinel1_sar(s1_path)
        tensor_s2 = load_sentinel2_optical(s2_path)
        
        # Convert to numpy for the processor
        img_s1 = (tensor_s1.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
        img_s2 = (tensor_s2.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
        
        # 2. Format the prompt with TWO image placeholders
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image"}, # Placeholder for S1
                    {"type": "image"}, # Placeholder for S2
                    {"type": "text", "text": f"Using both the SAR and Optical images: {query}"}
                ]
            }
        ]
        text_input = self.processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        
        # 3. Pass both images into the processor simultaneously
        inputs = self.processor(
            text=[text_input],
            images=[img_s1, img_s2], # The processor handles the dual-image stacking
            return_tensors="pt",
            padding=True
        ).to(self.device)
        
        # 4. Generate the combined answer
        with torch.no_grad():
            generated_ids = self.model.generate(**inputs, max_new_tokens=75)
            
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        
        response = self.processor.batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0]
        
        return response
    def bi_temporal_change_vqa(self, t1_path, t2_path, query):
        """
        TOOL 3: Bi-Temporal Change VQA
        Analyzes two optical images of the same location from different dates.
        """
        print(f"🔍 Tool Executing: Bi-Temporal Change VQA on {t1_path} and {t2_path}")
        
        # 1. Load and normalize both temporal images
        tensor_t1 = load_sentinel2_optical(t1_path)
        tensor_t2 = load_sentinel2_optical(t2_path)
        
        # Convert to numpy for the processor
        img_t1 = (tensor_t1.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
        img_t2 = (tensor_t2.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
        
        # 2. Format the prompt to ask about the difference
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image"}, # Placeholder for Time 1
                    {"type": "image"}, # Placeholder for Time 2
                    {"type": "text", "text": f"Compare these two images: {query}"}
                ]
            }
        ]
        text_input = self.processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        
        # 3. Process the images
        inputs = self.processor(
            text=[text_input],
            images=[img_t1, img_t2],
            return_tensors="pt",
            padding=True
        ).to(self.device)
        
        # 4. Generate the change description
        with torch.no_grad():
            generated_ids = self.model.generate(**inputs, max_new_tokens=75)
            
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        
        response = self.processor.batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0]
        
        return response

# ==========================================
# SMOKE TEST
# ==========================================
if __name__ == "__main__":
    print("="*50)
    print("🧪 TESTING THE AGENT TOOLS")
    print("="*50)
    
    # Initialize the tool registry (this loads our trained model)
    tools = RemoteSensingTools()
    
    # Define our test inputs using the mock data we created earlier
    test_image = "data/raw/Sentinel-2/test_patch_01_S2.tif"
    test_query = "What is the primary land cover shown in this image?"
    
    print(f"\nUser asks: '{test_query}'")
    
    # Execute the tool
    answer = tools.single_image_vqa(image_path=test_image, query=test_query)
    
    print(f"\n🤖 AI Agent Answers:\n{answer}")