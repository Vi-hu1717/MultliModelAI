from fastapi import FastAPI, UploadFile, File, HTTPException
from http import HTTPStatus
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import uuid
from typing import List

from sqlmodel import Session, select
from api.config import settings
from api.schemas import JobDescription, MatchResponse, MatchRequest, MatchAllRequest, ManualCandidateRequest, NotesUpdate
from api.models import Candidate
from api.database import init_db, get_session, engine
from extraction.processor import ResumeProcessor
from scoring.scoring_engine import ScoringEngine
from embeddings.tfidf_engine import TFIDFEngine
from graph.graph_manager import GraphManager

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines at module level
processor = ResumeProcessor("data/skills_taxonomy.json")
tfidf_engine = TFIDFEngine()
graph_manager = GraphManager() 
scoring_engine = ScoringEngine(tfidf_engine, graph_manager)

@app.on_event("startup")
def on_startup():
    init_db()
    # Populate TF-IDF index from DB
    with Session(engine) as session:
        candidates = session.exec(select(Candidate)).all()
        if candidates:
            texts = []
            for c in candidates:
                text = c.raw_text or ""
                for p in (c.projects or []):
                    text += f" {p.get('title', '')} {p.get('description', '')}"
                if c.github_profile:
                    text += f" {c.github_profile.get('bio', '')} {c.github_profile.get('top_languages', '')}"
                texts.append(text)
                
            tfidf_engine.build_index(
                texts, 
                [{"id": c.id} for c in candidates]
            )

@app.post("/upload_resume")
async def upload_resume(file: UploadFile = File(...)):
    temp_path = f"data/raw/{file.filename}"
    os.makedirs("data/raw", exist_ok=True)
    
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        results = processor.process_multimodal_file(temp_path)
        ingested_candidates = []
        
        with Session(engine) as session:
            for res in results:
                raw = res.get("raw_text") or ""
                processed = res.get("processed_text") or raw  # fallback to raw
                db_candidate = Candidate(
                    candidate_name=res.get("candidate_name", file.filename),
                    filename=res.get("filename", file.filename),
                    raw_text=raw,
                    processed_text=processed,
                    skills=res.get("extracted_skills", []),
                    years_experience=scoring_engine.extract_years_experience(raw),
                    projects=res.get("projects", []),
                    github_profile=res.get("github_profile", {})
                )
                session.add(db_candidate)
                session.commit()
                session.refresh(db_candidate)
                tfidf_engine.add_to_index(raw or processed, {"id": db_candidate.id})
                ingested_candidates.append({"id": db_candidate.id, "name": db_candidate.candidate_name})
        
        return ingested_candidates

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    
    finally:
        # Clean up temp file
        try:
            os.remove(temp_path)
        except:
            pass


@app.post("/match_all")
async def match_all(request: MatchAllRequest):
    with Session(engine) as session:
        candidates = session.exec(select(Candidate)).all()
        results = []
        for cand in candidates:
            # Map DB model to dict for scoring
            cand_data = cand.model_dump()
            score_data = scoring_engine.calculate_fit_score(cand_data, request.model_dump())
            
            results.append({
                "candidate_id": str(cand.id),
                "candidate_name": cand.candidate_name,
                "fit_score": score_data["fit_score"],
                "breakdown": score_data["breakdown"],
                "matched_skills": score_data["matched_skills"],
                "missing_skills": score_data["missing_skills"],
                "recommendations": score_data["recommendations"],
                "recruiter_notes": cand.recruiter_notes
            })
            
        return sorted(results, key=lambda x: x["fit_score"], reverse=True)

@app.post("/add_candidate_manual")
async def add_candidate_manual(request: ManualCandidateRequest):
    try:
        github_data = {}
        if request.github_url:
            github_data = {"url": request.github_url, "bio": "Manual ingestion profile", "top_languages": "Python, JavaScript"}

        combined_skills = [s.strip() for s in request.skills_csv.split(",") if s.strip()]
        
        with Session(engine) as session:
            db_candidate = Candidate(
                candidate_name=request.name,
                filename="manual_ingestion",
                raw_text=request.bio,
                skills=combined_skills,
                years_experience=request.experience,
                projects=request.projects,
                github_profile=github_data
            )
            session.add(db_candidate)
            session.commit()
            session.refresh(db_candidate)
            
            # Update TF-IDF
            multimodal_text = f"{request.bio} {' '.join(combined_skills)}"
            tfidf_engine.add_to_index(multimodal_text, {"id": db_candidate.id})
            
            return {"status": "success", "id": db_candidate.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/candidates")
async def list_candidates():
    with Session(engine) as session:
        candidates = session.exec(select(Candidate)).all()
        return [{"id": c.id, "name": c.candidate_name} for c in candidates]

@app.patch("/candidates/{candidate_id}/notes")
async def update_candidate_notes(candidate_id: str, request: NotesUpdate):
    with Session(engine) as session:
        candidate = session.get(Candidate, candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        candidate.recruiter_notes = request.notes
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        return {"id": candidate.id, "notes": candidate.recruiter_notes}

@app.delete("/candidates/clear")
async def clear_all_candidates():
    try:
        with Session(engine) as session:
            session.exec(Candidate.__table__.delete())
            session.commit()
        tfidf_engine.clear_index()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=9000)
