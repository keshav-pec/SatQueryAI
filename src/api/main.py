import os
import shutil
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import our LangGraph Agent
from src.agent.orchestrator import SatQueryAgent

app = FastAPI(title="SatQuery AI Agent API", version="1.0")

# Enable CORS so the React/Next.js frontend can talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the AI Agent (loads the 4GB model into memory)
# We do this globally so it only happens once when the server starts.
print("⏳ Starting FastAPI Server and loading AI models...")
agent = SatQueryAgent()
print("✅ Server Ready.")

# Create a temporary directory to store uploaded files from the frontend
UPLOAD_DIR = os.path.join(os.getcwd(), "data", "temp_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class AgentResponse(BaseModel):
    query: str
    result: str
    execution_trace: List[dict]

@app.get("/")
async def root():
    return {"message": "SatQuery AI Backend is running."}

@app.post("/analyze", response_model=AgentResponse)
async def analyze_satellite_imagery(
    query: str = Form(...),
    file1: UploadFile = File(..., description="Upload the primary image (e.g., Optical or single image)"),
    file2: Optional[UploadFile] = File(None, description="Upload the secondary image (e.g., SAR) if required")
):
    """
    The main endpoint. The frontend sends the text question and the GeoTIFF files here.
    """
    # Consolidate the files into a list for our agent logic
    files = [file1]
    if file2:
        files.append(file2)

    saved_file_paths = []
    
    try:
        # 1. Save the uploaded files to disk so Rasterio can read them
        for file in files:
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_file_paths.append(file_path)
            
        print(f"📥 Received query: '{query}' with files: {[f.filename for f in files]}")
        
        # 2. Pass the data to the LangGraph Agent Orchestrator
        agent_output = agent.run(query=query, image_paths=saved_file_paths)
        
        # 3. Return the AI's answer and the execution trace back to the frontend
        return AgentResponse(
            query=agent_output["query"],
            result=agent_output["result"],
            execution_trace=agent_output["execution_trace"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Cleanup: Delete the uploaded files after analysis to save space
        for path in saved_file_paths:
            if os.path.exists(path):
                os.remove(path)