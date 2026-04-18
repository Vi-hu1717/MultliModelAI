import faiss
import numpy as np
import json
from sentence_transformers import SentenceTransformer
from typing import List, Dict

class VectorStore:
    def __init__(self, model_path: str = 'all-MiniLM-L6-v2'):
        # Load custom model if exists, otherwise use base
        self.model = SentenceTransformer(model_path)
        self.index = None
        self.metadata = []

    def build_index(self, texts: List[str], metadata: List[Dict]):
        """Builds a new FAISS index from a list of texts."""
        embeddings = self.model.encode(texts)
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(np.array(embeddings).astype('float32'))
        self.metadata = metadata

    def add_to_index(self, text: str, metadata: Dict):
        """Adds a single item to the existing index."""
        embedding = self.model.encode([text])
        if self.index is None:
            self.build_index([text], [metadata])
        else:
            self.index.add(np.array(embedding).astype('float32'))
            self.metadata.append(metadata)

    def search(self, query: str, top_k: int = 5):
        """Searches the index safely."""
        if self.index is None or self.index.ntotal == 0:
            return []
            
        query_vector = self.model.encode([query])
        distances, indices = self.index.search(np.array(query_vector).astype('float32'), top_k)
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1:
                results.append({
                    "metadata": self.metadata[idx],
                    "score": float(1 / (1 + dist))  # Convert L2 to similarity score
                })
        return results

    def save_index(self, path: str):
        faiss.write_index(self.index, f"{path}.index")
        with open(f"{path}.meta", 'w') as f:
            json.dump(self.metadata, f)

    def load_index(self, path: str):
        self.index = faiss.read_index(f"{path}.index")
        with open(f"{path}.meta", 'r') as f:
            self.metadata = json.load(f)

if __name__ == "__main__":
    # Example usage
    # store = VectorStore()
    # store.build_index(["Python", "React", "Docker"], [{"id": 1}, {"id": 2}, {"id": 3}])
    # print(store.search("frontend", top_k=1))
    pass
