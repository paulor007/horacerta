"""
Fixtures globais de teste — PostgreSQL (banco dedicado horacerta_test).

Cada teste roda com banco limpo e isolado.
Usa o mesmo PostgreSQL do docker-compose, só muda o database name.
"""

import pytest
from datetime import time
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from core.config import settings
from core.database import Base, get_db
from core.security import hash_password
from main import app
from models.user import User
from models.professional import Professional
from models.service import Service

# ── Banco de teste (PostgreSQL separado) ──

TEST_DATABASE_URL = settings.DATABASE_URL.rsplit("/", 1)[0] + "/horacerta_test"

engine_test = create_engine(TEST_DATABASE_URL, echo=False)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


def _create_test_database():
    """Cria o banco horacerta_test se não existir."""
    base_url = settings.DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
    temp_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")
    with temp_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = 'horacerta_test'")
        ).fetchone()
        if not exists:
            conn.execute(text("CREATE DATABASE horacerta_test"))
    temp_engine.dispose()


_create_test_database()


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ── Fixtures ──

@pytest.fixture(autouse=True)
def setup_db():
    """Cria tabelas antes de cada teste e limpa depois."""
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


@pytest.fixture
def db():
    """Sessão do banco para uso direto nos testes."""
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """Client HTTP para chamar a API."""
    return TestClient(app)


@pytest.fixture
def admin_user(db) -> User:
    user = User(
        name="Admin Teste",
        email="admin@test.com",
        phone="(11) 99999-0001",
        hashed_password=hash_password("admin123"),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def professional_user(db) -> User:
    user = User(
        name="Profissional Teste",
        email="prof@test.com",
        phone="(11) 99999-0002",
        hashed_password=hash_password("prof123"),
        role="professional",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def client_user(db) -> User:
    user = User(
        name="Cliente Teste",
        email="cliente@test.com",
        phone="(11) 99999-0003",
        hashed_password=hash_password("cliente123"),
        role="client",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def professional(db, professional_user) -> Professional:
    prof = Professional(
        user_id=professional_user.id,
        specialty="Corte clássico",
        bio="Especialista em cortes",
        work_start=time(9, 0),
        work_end=time(18, 0),
        work_days="1,2,3,4,5,6",
    )
    db.add(prof)
    db.commit()
    db.refresh(prof)
    return prof


@pytest.fixture
def service(db) -> Service:
    svc = Service(
        name="Corte",
        duration_min=30,
        price=45.00,
        description="Corte masculino",
    )
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return svc