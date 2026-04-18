from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class JobDescription(BaseModel):
    title: str
    required_skills: List[str]
    years_experience: int
    description: Optional[str] = ""

class MatchRequest(BaseModel):
    candidate_id: str
    job_title: str
    job_description: str
    required_skills: List[str] = []
    years_experience: int

class MatchAllRequest(BaseModel):
    job_title: str
    job_description: str
    required_skills: List[str] = []
    years_experience: int

class MatchResponse(BaseModel):
    candidate_id: str
    candidate_name: str
    fit_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    breakdown: Dict[str, float]
    recommendations: List[str]
    recruiter_notes: Optional[str] = ""

class NotesUpdate(BaseModel):
    notes: str

class MultimodalResumeMetadata(BaseModel):
    filename: str
    skills: List[str]
    years_experience: int
    projects: List[Dict[str, str]] = []
    github_profile: Optional[Dict[str, Any]] = None
    recruiter_notes: Optional[str] = ""

class ManualCandidateRequest(BaseModel):
    name: str
    experience: int
    bio: str
    skills_csv: str
    github_url: Optional[str] = None
    projects: List[Dict[str, str]] = []