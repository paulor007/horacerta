"""HoraCerta — API de Agendamento Inteligente."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from api.auth.router import router as auth_router
from api.routes.professionals import router as professionals_router
from api.routes.services import router as services_router
from api.routes.users import router as users_router
from api.routes.appointments import router as appointments_router
from api.routes.reports import router as reports_router
from api.routes.public import router as public_router
from api.routes.reviews import router as reviews_router
from api.routes.waitlist_routes import router as waitlist_router
from api.routes.recurring_routes import router as recurring_router
from api.routes.settings_route import router as system_router
from api.routes.snapshots_route import router as snapshots_router
from api.routes.professional_stats import router as professional_stats_router
from api.routes.admin_setup import router as admin_setup_router
from websocket.routes import router as ws_router

# ── Logging ──
logging.basicConfig(
    level=logging.INFO if settings.IS_PRODUCTION else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
logger.info(
    "Starting HoraCerta in %s mode",
    "PRODUCTION" if settings.IS_PRODUCTION else "DEVELOPMENT",
)

app = FastAPI(
    title="HoraCerta",
    description="Agendamento Inteligente para Profissionais de Serviço",
    version="0.8.0",
    redirect_slashes=False,
    # Em produção desabilita docs públicos (pra não expor schema)
    docs_url=None if settings.IS_PRODUCTION else "/docs",
    redoc_url=None if settings.IS_PRODUCTION else "/redoc",
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
app.include_router(auth_router)
app.include_router(professionals_router)
app.include_router(services_router)
app.include_router(users_router)
app.include_router(appointments_router)
app.include_router(reports_router)
app.include_router(public_router)
app.include_router(reviews_router)
app.include_router(waitlist_router)
app.include_router(recurring_router)
app.include_router(system_router)
app.include_router(snapshots_router)
app.include_router(professional_stats_router)
app.include_router(admin_setup_router)
app.include_router(ws_router)


@app.get("/health")
def health():
    """Endpoint usado pelo Railway para healthcheck."""
    from websocket.manager import ws_manager
    return {
        "status": "ok",
        "service": "HoraCerta",
        "environment": settings.ENVIRONMENT,
        "websocket_connections": ws_manager.total_connections,
    }


@app.get("/")
def root():
    return {
        "app": "HoraCerta",
        "version": "0.8.0",
        "docs": "/docs" if not settings.IS_PRODUCTION else "disabled in production",
    }