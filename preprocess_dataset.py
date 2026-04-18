import os
import json
from extraction.processor import ResumeProcessor
from data.synthetic_generator import SyntheticResumeGenerator

def preprocess_all(taxonomy_path: str, raw_dir: str, processed_path: str):
    processor = ResumeProcessor(taxonomy_path)
    
    # Ensure directories exist
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(os.path.dirname(processed_path), exist_ok=True)
    
    # Check if raw dir is empty, if so, generate synthetic data
    if not os.listdir(raw_dir):
        print("Raw data directory is empty. Generating synthetic resumes...")
        generator = SyntheticResumeGenerator(taxonomy_path)
        for i in range(10):
            generator.generate_resume(os.path.join(raw_dir, f"resume_{i}.docx"))
    
    processed_data = []
    
    print(f"Processing resumes from {raw_dir}...")
    for filename in os.listdir(raw_dir):
        if filename.endswith(".docx"):
            file_path = os.path.join(raw_dir, filename)
            try:
                result = processor.process_to_json(file_path)
                processed_data.append(result)
                print(f"Processed: {filename}")
            except Exception as e:
                print(f"Error processing {filename}: {e}")
    
    with open(processed_path, 'w') as f:
        json.dump(processed_data, f, indent=2)
    
    print(f"Preprocessing complete. Saved to {processed_path}")

if __name__ == "__main__":
    preprocess_all(
        taxonomy_path="data/skills_taxonomy.json",
        raw_dir="data/raw",
        processed_path="data/processed/processed_resumes.json"
    )
