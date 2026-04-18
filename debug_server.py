import sys
import os

# Add the current directory to the path
sys.path.append(os.getcwd())

print("DEBUG: Pre-flight check starting...")
try:
    from embeddings.transformer_engine import TransformerEngine
    print("DEBUG: TransformerEngine import success.")
    
    from api.main import app
    print("DEBUG: FastAPI App import success.")
    
    import uvicorn
    print("DEBUG: Uvicorn import success. Starting server...")
    uvicorn.run(app, host="0.0.0.0", port=8001)
except Exception as e:
    print(f"FATAL ERROR: {e}")
    import traceback
    traceback.print_exc()
