"""Engine e SessionLocal do SQLAlchemy."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from core.config import settings

engine = create_engine(settings.DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    """Base para os modelos do SQLAlchemy."""
    pass

def get_db():
    """Dependency injection: fornece sessão do banco."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()