import os
import json
import re
import spacy
from typing import List, Dict, Any

class ResumeProcessor:
    def __init__(self, taxonomy_path: str):
        with open(taxonomy_path, 'r') as f:
            self.taxonomy = json.load(f)
        
        # Flatten taxonomy
        self.all_skills = set()
        for category, skills in self.taxonomy.items():
            for skill in skills:
                self.all_skills.add(skill.lower())
                
        # Load spaCy NLP model for Semantic Analysis
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            print("WARNING: 'en_core_web_sm' not found. Ensure you run: python -m spacy download en_core_web_sm")
            self.nlp = None

    def clean_text(self, text: str) -> str:
        text = text.lower()
        text = re.sub(r'[^a-zA-Z0-9\s.,]', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def extract_skills_spacy(self, text: str) -> List[str]:
        """Extracts skills using spaCy NLP + Taxonomy."""
        if not self.nlp:
            # Fallback to simple matching if spaCy is missing
            clean = self.clean_text(text)
            found = [s for s in self.all_skills if r'\b' + s + r'\b' in clean]
            return list(set(found))
            
        doc = self.nlp(text)
        found_skills = set()
        
        # 1. Direct Entity Matching & Noun Chunks
        for chunk in doc.noun_chunks:
            chunk_text = chunk.text.lower()
            # If a noun chunk explicitly matches a known skill (e.g., 'machine learning')
            if chunk_text in self.all_skills:
                found_skills.add(chunk_text)
                
        # 2. Token level matching (unigrams)
        for token in doc:
            if not token.is_stop and not token.is_punct:
                word = token.text.lower()
                if word in self.all_skills:
                    found_skills.add(word)
                    
        return list(found_skills)

    def extract_text(self, file_path: str) -> str:
        if file_path.endswith('.txt'):
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        elif file_path.endswith('.docx'):
            import docx
            try:
                doc = docx.Document(file_path)
                return " ".join([paragraph.text for paragraph in doc.paragraphs])
            except Exception as e:
                print(f"Error reading docx {file_path}: {e}")
                return ""
        elif file_path.endswith('.pdf'):
            import fitz # PyMuPDF
            try:
                doc = fitz.open(file_path)
                text = ""
                for page in doc:
                    text += page.get_text()
                return text
            except Exception as e:
                print(f"Error reading pdf {file_path}: {e}")
                return ""
        return ""

    def process_csv(self, file_path: str) -> List[Dict[str, Any]]:
        """Parses a CSV dataset and extracts multiple candidates using heuristics."""
        import csv
        results = []
        filename = os.path.basename(file_path)
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames or []
                
                # Heuristic: Find the resume text column
                text_col = ""
                for col in ["resume_str", "resume_text", "text", "cleaned_text", "bio", "resume"]:
                    if col in [f.lower() for f in fieldnames]:
                        text_col = next(f for f in fieldnames if f.lower() == col)
                        break
                
                if not text_col:
                    # Fallback to the largest text column
                    text_col = fieldnames[0] # Default
                
                # Heuristic: Find the name/id column
                name_col = ""
                for col in ["name", "candidate_name", "id", "id_number"]:
                    if col in [f.lower() for f in fieldnames]:
                        name_col = next(f for f in fieldnames if f.lower() == col)
                        break
                
                for row_idx, row in enumerate(reader):
                    raw_text = row.get(text_col, "")
                    if not raw_text or len(raw_text) < 50: continue # Skip empty/short rows
                    
                    name = row.get(name_col, f"Candidate_{row_idx + 1}")
                    clean_text = self.clean_text(raw_text)
                    skills = self.extract_skills_spacy(raw_text)
                    
                    results.append({
                        "filename": f"{filename}_row_{row_idx}",
                        "candidate_name": name,
                        "raw_text": raw_text,
                        "processed_text": clean_text,
                        "extracted_skills": skills,
                        "projects": [],
                        "github_profile": {}
                    })
        except Exception as e:
            print(f"Error processing CSV {file_path}: {e}")
            
        return results

    def process_multimodal_file(self, file_path: str) -> List[Dict[str, Any]]:
        """Processes either a raw text resume, a CSV, or a multimodal JSON dataset. Always returns a LIST."""
        filename = os.path.basename(file_path)
        
        # Scenario 1: CSV Bulk Dataset
        if file_path.endswith('.csv'):
            return self.process_csv(file_path)

        # Scenario 2: Multimodal JSON Dataset
        if file_path.endswith('.json'):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Check if it's a single candidate or a Kaggle/Croissant metadata
            if "distribution" in data:
                # This is a metadata file, not a candidate. Skip or treat as meta.
                return []

            raw_text = data.get("resume_text", " ".join(data.get("skills", [])))
            clean_text = self.clean_text(raw_text)
            spacy_skills = self.extract_skills_spacy(raw_text)
            combined_skills = list(set(spacy_skills + data.get("skills", [])))
            
            return [{
                "filename": filename,
                "candidate_name": data.get("name", filename.replace(".json", "")),
                "raw_text": raw_text,
                "processed_text": clean_text,
                "extracted_skills": combined_skills,
                "projects": data.get("projects", []),
                "github_profile": data.get("github_profile", {})
            }]
            
        # Scenario 3: Legacy .txt / .docx / .pdf Resume Processing
        raw_text = self.extract_text(file_path)
        clean_text = self.clean_text(raw_text)
        skills = self.extract_skills_spacy(raw_text)
        
        return [{
            "filename": filename,
            "candidate_name": filename.replace(".txt", "").replace(".docx", "").replace(".pdf", ""),
            "raw_text": raw_text,
            "processed_text": clean_text,
            "extracted_skills": skills,
            "projects": [], # Empty for pure files
            "github_profile": {}
        }]
