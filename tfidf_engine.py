from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List, Dict

class TFIDFEngine:
    def __init__(self):
        # We initialize the TF-IDF vectorizer. We don't need a heavy deep learning model.
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
        self.corpus_texts = []
        self.metadata = []
        self.tfidf_matrix = None
        self.is_fitted = False

    def build_index(self, texts: List[str], metadata: List[Dict]):
        """Builds a TF-IDF matrix from a list of texts."""
        if not texts:
            return
        self.corpus_texts = texts
        self.metadata = metadata
        try:
            self.tfidf_matrix = self.vectorizer.fit_transform(self.corpus_texts)
            self.is_fitted = True
        except ValueError:
            # Handles "empty vocabulary" edge case with dummy fit
            self.vectorizer.fit(["dummy skill experience token"])
            self.tfidf_matrix = self.vectorizer.transform(self.corpus_texts)
            self.is_fitted = True

    def add_to_index(self, text: str, metadata: Dict):
        """Adds a single item to the corpus and refits. TF-IDF requires refitting or partial fitting."""
        self.corpus_texts.append(text)
        self.metadata.append(metadata)
        try:
            self.tfidf_matrix = self.vectorizer.fit_transform(self.corpus_texts)
            self.is_fitted = True
        except ValueError:
            self.vectorizer.fit(["dummy skill experience token"])
            self.tfidf_matrix = self.vectorizer.transform(self.corpus_texts)
            self.is_fitted = True

    def clear_index(self):
        """Wipes the current index for a fresh start."""
        self.corpus_texts = []
        self.metadata = []
        self.tfidf_matrix = None
        self.is_fitted = False
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)

    def compute_similarity(self, candidate_text: str, job_text: str) -> float:
        """
        Directly computes cosine similarity between a candidate profile (resume + projects)
        and a job description using TF-IDF.
        """
        if not self.is_fitted:
            # Fit on the fly if not fitted
            try:
                self.vectorizer.fit([candidate_text, job_text])
                self.is_fitted = True
            except ValueError:
                self.vectorizer.fit(["dummy skill experience token"])
                self.is_fitted = True
            
        vectors = self.vectorizer.transform([candidate_text, job_text])
        similarity = cosine_similarity(vectors[0:1], vectors[1:2])[0][0]
        return float(similarity)
