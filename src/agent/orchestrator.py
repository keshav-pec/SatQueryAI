from typing import List, Dict, Any
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

# Import the tools we built
from src.agent.tools_registry import RemoteSensingTools

# 1. Define the "State" (The clipboard that gets passed around the office)
class AgentState(TypedDict):
    query: str
    image_paths: List[str]
    selected_tool: str
    result: str
    execution_trace: List[Dict[str, Any]] # The required "auditable summary"

class SatQueryAgent:
    def __init__(self):
        print("🕴️ Initializing the Agent Orchestrator...")
        self.tools = RemoteSensingTools()
        
        # Build the LangGraph workflow
        workflow = StateGraph(AgentState)
        
        # Add our nodes (the steps in the flowchart)
        workflow.add_node("router", self.route_task)
        workflow.add_node("executor", self.execute_tool)
        
        # Define the flow: Start -> Router -> Executor -> End
        workflow.add_edge(START, "router")
        workflow.add_edge("router", "executor")
        workflow.add_edge("executor", END)
        
        self.app = workflow.compile()

    # NODE 1: The Router (The Manager)
    def route_task(self, state: AgentState):
        """
        Analyzes the inputs to determine which AI tool to use.
        In a full production app, this could be an LLM call. For speed and reliability 
        on satellite data types, deterministic routing based on file metadata is highly effective.
        """
        trace = state.get("execution_trace", [])
        images = state["image_paths"]
        
        selected_tool = "unknown"
        
        # Logic 1: If there is exactly one image, it's a single-image task
        if len(images) == 1:
            selected_tool = "single_image_vqa"
            trace.append({
                "step": "Routing", 
                "action": "Selected single_image_vqa because exactly 1 image was provided."
            })
            
        # Logic 2: If there are two images, we check if they are Optical + SAR
        elif len(images) == 2:
            if "S1" in images[0] and "S2" in images[1]:
                selected_tool = "cross_modal_vqa"
                trace.append({
                    "step": "Routing", 
                    "action": "Selected cross_modal_vqa because S1 (SAR) and S2 (Optical) pair detected."
                })
            else:
                selected_tool = "change_vqa"
                trace.append({
                    "step": "Routing", 
                    "action": "Selected change_vqa because a bi-temporal pair was detected."
                })
                
        return {"selected_tool": selected_tool, "execution_trace": trace}

    # NODE 2: The Executor (The Worker)
    # NODE 2: The Executor (The Worker)
    def execute_tool(self, state: AgentState):
        """
        Runs the actual AI Vision-Language Model based on the router's decision.
        """
        tool = state["selected_tool"]
        trace = state.get("execution_trace", [])
        
        if tool == "single_image_vqa":
            answer = self.tools.single_image_vqa(
                image_path=state["image_paths"][0], 
                query=state["query"]
            )
            trace.append({
                "step": "Execution", 
                "tool_used": "Single-Image VQA (Qwen2-VL-LoRA)",
                "status": "Success"
            })
            return {"result": answer, "execution_trace": trace}
            
        elif tool == "cross_modal_vqa":
            paths = state["image_paths"]
            s1_path, s2_path = paths[0], paths[1]
            
            answer = self.tools.cross_modal_vqa(
                s1_path=s1_path, 
                s2_path=s2_path, 
                query=state["query"]
            )
            trace.append({
                "step": "Execution", 
                "tool_used": "Cross-Modal VQA (SAR + Optical)",
                "status": "Success"
            })
            return {"result": answer, "execution_trace": trace}
            
        elif tool == "change_vqa":
            # If the router selected change_vqa, we assume both are optical images
            paths = state["image_paths"]
            t1_path, t2_path = paths[0], paths[1]
            
            answer = self.tools.bi_temporal_change_vqa(
                t1_path=t1_path, 
                t2_path=t2_path, 
                query=state["query"]
            )
            trace.append({
                "step": "Execution", 
                "tool_used": "Bi-Temporal Change VQA",
                "status": "Success"
            })
            return {"result": answer, "execution_trace": trace}
            
        else:
            error_msg = f"Tool '{tool}' is not yet fully implemented."
            trace.append({"step": "Execution", "error": error_msg})
            return {"result": error_msg, "execution_trace": trace}

    def run(self, query: str, image_paths: List[str]):
        """
        The main function to trigger the agent.
        """
        initial_state = {
            "query": query,
            "image_paths": image_paths,
            "selected_tool": "",
            "result": "",
            "execution_trace": [{"step": "Initialization", "message": f"Received query: '{query}'"}]
        }
        
        # Run the graph
        final_state = self.app.invoke(initial_state)
        return final_state

# ==========================================
# SMOKE TEST
# ==========================================
if __name__ == "__main__":
    print("="*50)
    print("🧠 TESTING THE AGENT ORCHESTRATOR")
    print("="*50)
    
    agent = SatQueryAgent()
    
    # Simulate a user uploading 1 image and asking a question
    print("\n📩 User submits a query and 1 image...")
    final_output = agent.run(
        query="Are there any buildings in this image?",
        image_paths=["data/raw/Sentinel-2/test_patch_01_S2.tif"]
    )
    
    print("\n✅ Final Result from AI:")
    print(final_output["result"])
    
    print("\n📋 Auditable Execution Trace (For ISRO evaluation):")
    for log in final_output["execution_trace"]:
        print(f" - {log}")