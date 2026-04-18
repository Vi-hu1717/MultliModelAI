import torch
from sentence_transformers import SentenceTransformer, util
from typing import List, Union

class TransformerEngine:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """Initializes the Sentence Transformer model for deep semantic embeddings."""
        print(f"DEBUG: Initializing Transformer Engine with {model_name}...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = SentenceTransformer(model_name).to(self.device)
        print("DEBUG: Transformer Engine is ready.")

    def compute_similarity(self, text1: str, text2: str) -> float:
        """Computes the cosine similarity between two text blocks using embeddings."""
        if not text1 or not text2:
            return 0.0
            
        embeddings = self.model.encode([text1, text2], convert_to_tensor=True)
        cosine_score = util.cos_sim(embeddings[0], embeddings[1])
        return float(cosine_score.item())

    def compute_bulk_similarity(self, source_text: str, target_texts: List[str]) -> List[float]:
        """Computes similarity between one source text and a list of target texts."""
        if not source_text or not target_texts:
            return [0.0] * len(target_texts)
            
        source_embedding = self.model.encode(source_text, convert_to_tensor=True)
        target_embeddings = self.model.encode(target_texts, convert_to_tensor=True)
        
        cosine_scores = util.cos_sim(source_embedding, target_embeddings)
        return cosine_scores[0].tolist()
