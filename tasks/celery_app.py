"""Configuração do Celery com Redis como broker."""

from celery import Celery
from celery.schedules import crontab
from core.config import settings

celery_app = Celery(
    "horacerta",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    # Lembretes a cada 30 minutos
    "check-reminders-every-30-min": {
        "task": "tasks.reminders.send_pending_reminders",
        "schedule": crontab(minute="*/30"),
    },

    # No-shows às 22h diariamente
    "mark-no-shows-daily": {
        "task": "tasks.reminders.mark_noshows",
        "schedule": crontab(hour=22, minute=0),
    },

    # Fechar mês anterior no dia 1 às 2h (gerar snapshot)
    "close-monthly-snapshot": {
        "task": "tasks.reminders.close_monthly_snapshot",
        "schedule": crontab(day_of_month=1, hour=2, minute=0),
    },

    # Limpeza automática às 3h diariamente (só roda se habilitado)
    "auto-cleanup-daily": {
        "task": "tasks.reminders.auto_cleanup",
        "schedule": crontab(hour=3, minute=0),
    },
}

celery_app.autodiscover_tasks(["tasks"])