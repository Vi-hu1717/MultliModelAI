from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import List, Optional, Dict, Any
import uuid

class Candidate(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    filename: str
    candidate_name: str
    skills: List[str] = Field(default=[], sa_column=Column(JSON))
    raw_text: str = Field(default="")
    processed_text: str = Field(default="")
    years_experience: int = 0
    
    # Multimodal additions
    projects: List[Dict[str, str]] = Field(default=[], sa_column=Column(JSON))
    github_profile: Optional[Dict[str, Any]] = Field(default={}, sa_column=Column(JSON))
    recruiter_notes: Optional[str] = Field(default="")
