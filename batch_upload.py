import os
import requests
import sys

# Simplified 24-hour batch processor
# Focuses on .txt files for maximum reliability
API_URL = "http://localhost:8000/upload_resume"
RESUMES_DIR = "resumes"

def run_minimal_batch():
    if not os.path.exists(RESUMES_DIR):
        print(f"Creating {RESUMES_DIR} directory. Please add .txt resumes there.")
        os.makedirs(RESUMES_DIR)
        return

    files = [f for f in os.listdir(RESUMES_DIR) if f.endswith(".txt") or f.endswith(".docx") or f.endswith(".pdf") or f.endswith(".json")]
    
    if not files:
        print("No resumes found. Please add .txt, .docx, .pdf or .json files to the 'resumes' folder.")
        return

    print(f"Batch processing {len(files)} resumes...")
    
    for filename in files:
        file_path = os.path.join(RESUMES_DIR, filename)
        try:
            with open(file_path, "rb") as f:
                # Map extension to MIME type
                mime = "text/plain"
                if filename.endswith(".pdf"): mime = "application/pdf"
                elif filename.endswith(".docx"): mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                elif filename.endswith(".json"): mime = "application/json"
                
                response = requests.post(
                    API_URL, 
                    files={"file": (filename, f, mime)}
                )
            
            if response.status_code == 200:
                print(f"Indexed: {filename}")
            else:
                print(f"Failed: {filename} ({response.status_code})")
        except Exception as e:
            print(f"Error: {filename} -> {e}")

if __name__ == "__main__":
    run_minimal_batch()
