FROM python:3.13-slim

# Variáveis de build
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependências do sistema (libpq-dev para psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cache de dependências Python
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copia o resto do código
COPY . .

# Cria diretório de uploads
RUN mkdir -p uploads/avatars

# Render injeta a variável PORT — usa 8000 como fallback local
ENV PORT=8000
EXPOSE 8000

# Roda migrations + uvicorn
# Render usa esse comando final, mas o startCommand do dashboard pode sobrepor
CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT}