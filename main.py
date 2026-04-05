"""HoraCerta — API de Agendamento Inteligente."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth.router import router as auth_router
from api.routes.professionals import router as professionals_router
from api.routes.services import router as services_router
from api.routes.users import router as users_router

app = FastAPI(
    title="HoraCerta",
    description="Agendamento Inteligente para Profissionais de Serviço",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas
app.include_router(auth_router)
app.include_router(professionals_router)
app.include_router(services_router)
app.include_router(users_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "HoraCerta"}


@app.get("/")
def root():
    return {
        "app": "HoraCerta",
        "version": "0.1.0",
        "docs": "/docs",
    }