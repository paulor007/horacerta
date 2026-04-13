"""HoraCerta — API de Agendamento Inteligente."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth.router import router as auth_router
from api.routes.professionals import router as professionals_router
from api.routes.services import router as services_router
from api.routes.users import router as users_router
from api.routes.appointments import router as appointments_router
from api.routes.reports import router as reports_router
from api.routes.public import router as public_router
from websocket.routes import router as ws_router

app = FastAPI(
    title="HoraCerta",
    description="Agendamento Inteligente para Profissionais de Serviço",
    version="0.3.0",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(professionals_router)
app.include_router(services_router)
app.include_router(users_router)
app.include_router(appointments_router)
app.include_router(reports_router)
app.include_router(public_router)
app.include_router(ws_router)


@app.get("/health")
def health():
    from websocket.manager import ws_manager
    return {
        "status": "ok",
        "service": "HoraCerta",
        "websocket_connections": ws_manager.total_connections,
    }


@app.get("/")
def root():
    return {"app": "HoraCerta", "version": "0.3.0", "docs": "/docs"}