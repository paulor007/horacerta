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

# Tarefas agendadas (Celery Beat)
celery_app.conf.beat_schedule = {
    # Verificar lembretes a cada 30 minutos
    "check-reminders-every-30-min": {
        "task": "tasks.reminders.send_pending_reminders",
        "schedule": crontab(minute="*/30"),
    },

    # Marcar no-shows diariamente às 22h
    "mark-no-shows-daily": {
        "task": "tasks.reminders.mark_noshows",
        "schedule": crontab(hour=22, minute=0),
    },
}

# Autodiscover tasks
celery_app.autodiscover_tasks(["tasks"])