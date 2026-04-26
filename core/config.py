"""Configurações centralizadas do HoraCerta."""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Banco ──
    DATABASE_URL: str = "postgresql://horacerta:horacerta123@localhost:5433/horacerta"

    # ── JWT ──
    SECRET_KEY: str = "horacerta-dev-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── Redis / Celery ──
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Email ──
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""
    EMAIL_PASSWORD: str = ""

    # ── WhatsApp (Evolution API) ──
    EVOLUTION_API_URL: str = ""
    EVOLUTION_API_KEY: str = ""
    EVOLUTION_INSTANCE: str = ""

    # ── Empresa demo ──
    EMPRESA_NOME: str = "Barbearia Horizonte"

    # ── CORS (produção) ──
    # Em dev: "*" é OK
    # Em prod: coloque a URL exata do seu frontend, ex:
    # "https://horacerta.vercel.app,https://horacerta-paulor007.vercel.app"
    CORS_ORIGINS: str = "*"

    # ── Frontend URL (links em emails/WhatsApp) ──
    # Em dev: "http://localhost:5173"
    # Em prod: "https://horacerta.vercel.app"
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Ambiente ──
    # "development" ou "production"
    ENVIRONMENT: str = "development"

    # ── Diretórios ──
    BASE_DIR: Path = Path(__file__).parent.parent

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def IS_PRODUCTION(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        """Converte CORS_ORIGINS string em lista."""
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()

# ── Compatibilidade Railway: aceita postgres:// e converte para postgresql:// ──
if settings.DATABASE_URL.startswith("postgres://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace(
        "postgres://", "postgresql://", 1
    )