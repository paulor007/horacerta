"""
Rate limiter simples para endpoints públicos.

Limita por IP:
- /public/book: 5 agendamentos por hora por IP
- /public/*: 60 requests por minuto por IP

Usa dict em memória (em produção, trocar por Redis).
"""

import time
import logging
from collections import defaultdict
from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

# Armazena: { ip: [(timestamp1), (timestamp2), ...] }
_requests: dict[str, list[float]] = defaultdict(list)
_bookings: dict[str, list[float]] = defaultdict(list)


def _cleanup(store: dict[str, list[float]], window: int):
    """Remove entradas mais antigas que a janela."""
    now = time.time()
    for ip in list(store.keys()):
        store[ip] = [t for t in store[ip] if now - t < window]
        if not store[ip]:
            del store[ip]


def check_rate_limit(request: Request, max_requests: int = 60, window: int = 60):
    """
    Rate limit geral — 60 requests por minuto por IP.
    Usar como dependência nos endpoints públicos.
    """
    ip = request.client.host if request.client else "unknown"
    now = time.time()

    _cleanup(_requests, window)
    _requests[ip].append(now)

    if len(_requests[ip]) > max_requests:
        logger.warning("Rate limit atingido: %s (%d req/%ds)", ip, len(_requests[ip]), window)
        raise HTTPException(
            status_code=429,
            detail="Muitas requisições. Tente novamente em alguns minutos.",
        )


def check_booking_rate_limit(request: Request, max_bookings: int = 5, window: int = 3600):
    """
    Rate limit de booking — 5 agendamentos por hora por IP.
    Evita spam de agendamentos falsos.
    """
    ip = request.client.host if request.client else "unknown"
    now = time.time()

    _cleanup(_bookings, window)
    _bookings[ip].append(now)

    if len(_bookings[ip]) > max_bookings:
        logger.warning("Booking rate limit: %s (%d bookings/%ds)", ip, len(_bookings[ip]), window)
        raise HTTPException(
            status_code=429,
            detail="Limite de agendamentos atingido. Tente novamente em 1 hora.",
        )