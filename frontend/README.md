# 🕐 HoraCerta

**Sistema de agendamento inteligente para barbearias e salões de beleza.**

Plataforma completa com booking online, agenda em tempo real, notificações por email e WhatsApp, e dashboard gerencial.

---

## Stack

| Camada       | Tecnologia                                   |
| ------------ | -------------------------------------------- |
| Backend      | Python 3.13 · FastAPI · SQLAlchemy · Alembic |
| Frontend     | React 19 · TypeScript · Vite · Tailwind CSS  |
| Banco        | PostgreSQL 16                                |
| Cache/Fila   | Redis 7 · Celery                             |
| Auth         | JWT (python-jose) · bcrypt                   |
| Tempo Real   | WebSocket nativo (FastAPI)                   |
| Notificações | SMTP (email) · Evolution API (WhatsApp)      |

---

## Funcionalidades

### Cliente

- Fluxo de agendamento em 5 passos (profissional → serviço → data → horário → confirmar)
- Visualização de horários disponíveis em tempo real
- Cancelamento com política de 2h de antecedência
- Histórico de agendamentos com filtros

### Profissional

- Agenda do dia com visualização por timeline
- Marcar atendimento como concluído ou falta (no-show)
- Atualização em tempo real via WebSocket

### Admin

- Dashboard com 6 KPIs (agendamentos, faturamento, ocupação, faltas, cancelamentos)
- Gráficos de faturamento por profissional e ocupação por dia
- CRUD completo de usuários, serviços e profissionais
- Agenda geral com filtro por profissional

### Notificações

- Confirmação de agendamento (email + WhatsApp)
- Lembrete automático 24h antes
- Marcação automática de no-show às 22h

---

## Pré-requisitos

- [Python 3.11+](https://python.org)
- [Node.js 18+](https://nodejs.org)
- [Docker](https://docker.com) (para PostgreSQL e Redis)

---

## Setup Rápido

### 1. Clonar e configurar ambiente

```bash
git clone https://github.com/paulor007/horacerta.git
cd horacerta

# Criar .env a partir do exemplo
cp .env.example .env
```

### 2. Subir banco e Redis

```bash
docker-compose up -d
```

Isso cria:

- PostgreSQL na porta `5433` (user: `horacerta`, pass: `horacerta123`)
- Redis na porta `6379`

### 3. Backend

```bash
# Criar virtualenv
python -m venv venv
source venv/bin/activate   # Linux/Mac
venv\Scripts\activate      # Windows

# Instalar dependências
pip install -r requirements.txt

# Rodar migrations
alembic upgrade head

# Popular banco com dados demo
python data/seed.py

# Iniciar API
uvicorn main:app --reload --port 8000
```

A API estará em `http://localhost:8000` e o Swagger em `http://localhost:8000/docs`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend estará em `http://localhost:5173`.

### 5. Celery (opcional — para notificações em background)

```bash
# Em outro terminal, na raiz do projeto:
celery -A tasks.celery_app worker --loglevel=info

# Para lembretes automáticos:
celery -A tasks.celery_app beat --loglevel=info
```

---

## Contas Demo

| Role         | Email                          | Senha      |
| ------------ | ------------------------------ | ---------- |
| Admin        | `paulo.lavarini@barbearia.com` | `admin123` |
| Profissional | `joao@barbearia.com`           | `senha123` |
| Profissional | `carlos@barbearia.com`         | `senha123` |
| Profissional | `ana@barbearia.com`            | `senha123` |
| Profissional | `pedro@barbearia.com`          | `senha123` |
| Cliente      | `demo@horacerta.com`           | `demo123`  |

---

## Estrutura do Projeto

```
horacerta/
├── main.py                    # Entrypoint FastAPI
├── core/                      # Config, database, segurança
│   ├── config.py
│   ├── database.py
│   └── security.py
├── models/                    # SQLAlchemy models
│   ├── user.py
│   ├── professional.py
│   ├── service.py
│   ├── appointment.py
│   └── notification.py
├── schemas/                   # Pydantic schemas
├── api/
│   ├── deps.py                # Auth dependencies
│   ├── auth/router.py         # Login, register
│   └── routes/
│       ├── appointments.py    # Agendamento (core)
│       ├── professionals.py
│       ├── services.py
│       ├── users.py
│       └── reports.py         # Dashboard KPIs
├── services/
│   ├── availability.py        # Engine de disponibilidade
│   └── notification.py        # Email + WhatsApp
├── tasks/
│   ├── celery_app.py          # Config Celery
│   └── reminders.py           # Tasks de lembrete
├── websocket/
│   ├── manager.py             # Broadcast por profissional
│   └── routes.py              # Endpoint /ws/agenda
├── data/seed.py               # Dados demo
├── docker-compose.yml         # PostgreSQL + Redis
├── requirements.txt
└── frontend/                  # React + Vite + Tailwind
    └── src/
        ├── api/               # Client HTTP + endpoints
        ├── pages/             # BookAppointment, Agenda, Dashboard, Admin
        ├── components/        # Layout, Calendar, UI
        ├── context/           # AuthContext
        └── hooks/             # useWebSocket
```

---

## API — Endpoints Principais

| Método   | Rota                                 | Descrição                    |
| -------- | ------------------------------------ | ---------------------------- |
| `POST`   | `/auth/register`                     | Criar conta                  |
| `POST`   | `/auth/token`                        | Login (JWT)                  |
| `GET`    | `/api/v1/professionals`              | Listar profissionais         |
| `GET`    | `/api/v1/services`                   | Listar serviços              |
| `GET`    | `/api/v1/appointments/available`     | Horários disponíveis         |
| `POST`   | `/api/v1/appointments`               | Agendar                      |
| `DELETE` | `/api/v1/appointments/{id}`          | Cancelar                     |
| `PUT`    | `/api/v1/appointments/{id}`          | Reagendar                    |
| `PUT`    | `/api/v1/appointments/{id}/complete` | Marcar concluído             |
| `GET`    | `/api/v1/appointments/my`            | Meus agendamentos            |
| `GET`    | `/api/v1/appointments/today`         | Agenda do dia                |
| `GET`    | `/api/v1/reports/dashboard`          | KPIs do mês                  |
| `GET`    | `/api/v1/reports/revenue`            | Faturamento por profissional |
| `WS`     | `/ws/agenda`                         | Tempo real                   |

Documentação completa: `http://localhost:8000/docs`

---

## Roadmap

- [ ] Agendamento público sem login (link compartilhável)
- [ ] Avaliação pós-atendimento (1-5 estrelas)
- [ ] Lista de espera inteligente
- [ ] Recorrência programável (a cada X dias/semanas)
- [ ] Multi-estabelecimento (SaaS)
- [ ] PWA (Progressive Web App)
- [ ] Testes automatizados + CI/CD

---

## Autor

**Paulo Lavarini** — Desenvolvedor Python

- [Portfolio](https://paulolavarini-portfolio.netlify.app)
- [LinkedIn](https://www.linkedin.com/in/paulo-lavarini-20abaa38)
- [GitHub](https://github.com/paulor007)

---

## Licença

Este projeto é de uso pessoal/portfolio. Todos os direitos reservados.
