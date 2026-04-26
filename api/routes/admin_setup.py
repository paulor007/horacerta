"""
Endpoints administrativos para setup inicial e verificação do banco.

⚠️ PROTEGIDOS POR TOKEN (variável de ambiente SETUP_TOKEN).
Use apenas durante o deploy inicial. Após popular o banco, recomenda-se
remover este arquivo ou desabilitar a variável SETUP_TOKEN.
"""

import os
import logging

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from core.database import SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin-setup", tags=["Admin Setup"])


def _verify_token(token: str) -> None:
    """Bloqueia acesso se o token não bater com SETUP_TOKEN do ambiente."""
    expected = os.getenv("SETUP_TOKEN")
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Endpoint desabilitado. Defina SETUP_TOKEN no ambiente.",
        )
    if token != expected:
        raise HTTPException(status_code=403, detail="Token inválido")


@router.get("/db-status")
def db_status(token: str = Query(...)):
    """Retorna contagem de registros nas principais tabelas."""
    _verify_token(token)
    db = SessionLocal()
    try:
        tables = ["users", "professionals", "services", "appointments"]
        result = {}
        for t in tables:
            try:
                count = db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                result[t] = count
            except Exception as e:
                result[t] = f"Erro: {str(e)[:80]}"
        return {"status": "ok", "counts": result}
    finally:
        db.close()


@router.post("/run-seed")
def run_seed(token: str = Query(...)):
    """Roda o data/seed.py — popula admin, profissionais, serviços e agendamentos."""
    _verify_token(token)

    # Verifica se já tem dados (evita rodar duas vezes)
    db = SessionLocal()
    try:
        existing = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        if existing and existing > 0:
            return {
                "status": "skipped",
                "message": f"Banco já populado ({existing} usuários). "
                           "Para recriar, use /reset-db primeiro.",
            }
    finally:
        db.close()

    try:
        from data import seed
        # seed.py roda o populate quando importado, mas para garantir:
        if hasattr(seed, "main"):
            seed.main()
        elif hasattr(seed, "populate"):
            seed.populate()
        # Se o seed.py executa código no nível do módulo, o import já populou

        # Confirma que populou
        db = SessionLocal()
        try:
            count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        finally:
            db.close()

        return {
            "status": "success",
            "message": f"Seed executado. {count} usuários no banco.",
        }
    except Exception as e:
        logger.exception("Erro no seed")
        raise HTTPException(status_code=500, detail=f"Erro no seed: {str(e)}")


@router.post("/reset-db")
def reset_db(token: str = Query(...), confirm: str = Query(...)):
    """⚠️ DESTRUTIVO: apaga todos os dados. Exige confirm=APAGAR."""
    _verify_token(token)
    if confirm != "APAGAR":
        raise HTTPException(
            status_code=400,
            detail="Para confirmar, passe ?confirm=APAGAR",
        )

    db = SessionLocal()
    try:
        # Ordem importa por causa de FKs
        tables = [
            "monthly_snapshots",
            "recurring_appointments",
            "waitlist",
            "reviews",
            "notifications",
            "appointments",
            "services",
            "professionals",
            "users",
            "system_settings",
        ]
        for t in tables:
            try:
                db.execute(text(f"DELETE FROM {t}"))
            except Exception as e:
                logger.warning("Erro apagando %s: %s", t, e)
        db.commit()
        return {"status": "ok", "message": "Banco zerado. Use /run-seed para popular."}
    finally:
        db.close()