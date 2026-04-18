from sqlmodel import create_engine, SQLModel, Session
from .config import settings

# For development/testing where Postgres might not be available, 
# we can swap this for a local sqlite engine if needed.
# engine = create_engine("sqlite:///./test.db") 

# engine = create_engine(settings.DATABASE_URL, echo=True)
engine = create_engine("sqlite:///./resume.db", echo=True, connect_args={"check_same_thread": False})

def init_db():
    from .models import Candidate  # Ensure models are registered
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
