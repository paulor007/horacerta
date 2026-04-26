FROM python:3.13-slim

WORKDIR /app

# Dependências do sistema (para compilar algumas libs Python)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements (cache de layer)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copia o resto do código
COPY . .

# Cria diretório de uploads (avatars)
RUN mkdir -p uploads/avatars

# Railway passa a porta via $PORT
ENV PORT=8000
EXPOSE 8000

# Healthcheck simples
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/health').read()" || exit 1

# Em produção: roda migrations antes do uvicorn
CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 2