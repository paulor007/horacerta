"""
Seed — Popula o banco com dados demo da Barbearia Horizonte.
 
Roda: python data/seed.py
Idempotente: pode rodar múltiplas vezes.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import random
from datetime import date, time, timedelta

from core.database import SessionLocal, engine, Base
from core.security import hash_password
from models import User
from models.professional import Professional
from models.service import Service
from models.appointment import Appointment
from models.notification import Notification

random.seed(42)

NOMES = [
    "Lucas Oliveira", "Maria Silva", "Pedro Santos", "Ana Costa", "João Pereira",
    "Camila Souza", "Rafael Lima", "Juliana Almeida", "Bruno Ferreira", "Larissa Ribeiro",
    "Mateus Carvalho", "Fernanda Gomes", "Gabriel Martins", "Isabela Rocha", "Thiago Nascimento",
    "Amanda Barbosa", "Felipe Cardoso", "Letícia Pinto", "Gustavo Correia", "Beatriz Melo",
    "Daniel Araújo", "Carolina Moreira", "Vinícius Dias", "Natália Castro", "Eduardo Monteiro",
    "Mariana Cunha", "André Teixeira", "Patrícia Nunes", "Ricardo Vieira", "Bruna Cavalcanti",
    "Leonardo Lopes", "Aline Campos", "Marcos Freitas", "Vanessa Ramos", "Diego Azevedo",
    "Renata Duarte", "Alexandre Moura", "Priscila Borges", "Henrique Fonseca", "Tatiana Siqueira",
    "Rodrigo Mendes", "Elaine Machado", "Caio Rezende", "Daniela Pacheco", "Marcelo Brito",
    "Simone Pires", "Paulo Henrique", "Cristina Dantas", "Fábio Sampaio", "Sandra Queiroz",
]

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Limpar (ordem importar por FK)
        db.query(Notification).delete()
        db.query(Appointment).delete()
        db.query(Professional).delete()
        db.query(Service).delete()
        db.query(User).delete()
        db.commit()

        # ── ADMIN ──
        admin = User(
            name="Paulo Lavarini",
            email="paulo.lavarini@barbearia.com",
            phone="(61) 99999-0001",
            hashed_password=hash_password("admin123"),
            role="admin",
        )
        db.add(admin)
        db.flush()
        print(f"Admin criado: {admin.email}")

        # ── PROFISSIONAIS ──
        prof_data = [
            {"name": "João Silva", "email": "joao@barbearia.com", "phone": "(31) 99999-1001",
             "specialty": "Corte clássico", "bio": "Especialista em cortes masculinos tradicionais",
             "work_start": time(9, 0), "work_end": time(18, 0), "work_days": "1,2,3,4,5,6"},
            {"name": "Carlos Santos", "email": "carlos@barbearia.com", "phone": "(31) 99999-1002",
             "specialty": "Barba premium", "bio": "O mestre da barba perfeita",
             "work_start": time(10, 0), "work_end": time(19, 0), "work_days": "1,2,3,4,5"},
            {"name": "Ana Costa", "email": "ana@barbearia.com", "phone": "(31) 99999-1003",
             "specialty": "Platinado e coloração", "bio": "Referência em coloração masculina",
             "work_start": time(9, 0), "work_end": time(17, 0), "work_days": "2,3,4,5,6"},
            {"name": "Pedro Mendes", "email": "pedro@barbearia.com", "phone": "(31) 99999-1004",
             "specialty": "Corte + Barba", "bio": "Combo perfeito: corte e barba em um atendimento",
             "work_start": time(8, 0), "work_end": time(17, 0), "work_days": "1,2,3,4,5,6"},
        ]

        professionals = []
        for pd in prof_data:
            user = User(
                name=pd["name"], email=pd["email"], phone=pd["phone"],
                hashed_password=hash_password("senha123"), role="professional",
            )
            db.add(user)
            db.flush()

            prof = Professional(
                user_id=user.id, specialty=pd["specialty"], bio=pd["bio"],
                work_start=pd["work_start"], work_end=pd["work_end"], work_days=pd["work_days"],
            )
            db.add(prof)
            db.flush()
            professionals.append(prof)

        print(f"  {len(professionals)} profissionais criados")

        # ── SERVIÇOS ──
        services_data = [
            {"name": "Corte", "duration_min": 30, "price": 45.00,
             "description": "Corte masculino clássico ou moderno"},
            {"name": "Barba", "duration_min": 20, "price": 30.00,
             "description": "Barba feita com navalha e toalha quente"},
            {"name": "Corte + Barba", "duration_min": 50, "price": 65.00,
             "description": "Combo completo: corte e barba"},
            {"name": "Platinado", "duration_min": 90, "price": 120.00,
             "description": "Descoloração e platinado completo"},
        ]

        services = []
        for sd in services_data:
            svc = Service(**sd)
            db.add(svc)
            db.flush()
            services.append(svc)
 
        print(f"  {len(services)} serviços criados")

        # ── CLIENTES (50) ──
        clients = []
        for nome in NOMES:
            email_name = nome.lower().replace(" ", ".")
            for ch in "áàãâéêíóôõúç":
                repl = {"á": "a", "à": "a", "ã": "a", "â": "a", "é": "e",
                        "ê": "e", "í": "i", "ó": "o", "ô": "o", "õ": "o",
                        "ú": "u", "ç": "c"}.get(ch, ch)
                email_name = email_name.replace(ch, repl)
 
            client = User(
                name=nome,
                email=f"{email_name}@email.com",
                phone=f"(61) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
                hashed_password=hash_password("cliente123"),
                role="client",
            )
            db.add(client)
            db.flush()
            clients.append(client)

        # Conta demo
        demo = User(
            name="Visitante Demo",
            email="demo@horacerta.com",
            phone="(61) 99999-0000",
            hashed_password=hash_password("demo123"),
            role="client",
        )
        db.add(demo)
        db.flush()
        clients.append(demo)
 
        print(f"  {len(clients)} clientes criados")

        # ── AGENDAMENTOS (200+) ──
        statuses_past = ["completed", "completed", "completed", "completed",
                         "cancelled", "no_show"]
        appointments = []
        today = date.today()

        for _ in range(250):
            prof = random.choice(professionals)
            svc = random.choice(services)
            client = random.choice(clients)
 
            dias_offset = random.randint(-90, 14)
            apt_date = today + timedelta(days=dias_offset)
 
            weekday = apt_date.isoweekday()
            if str(weekday) not in prof.work_days.split(","):
                continue
 
            start_hour = random.randint(prof.work_start.hour, prof.work_end.hour - 1)
            start_minute = random.choice([0, 30])
            start = time(start_hour, start_minute)
 
            end_minutes = start_hour * 60 + start_minute + svc.duration_min
            end_hour = end_minutes // 60
            end_min = end_minutes % 60
            if end_hour >= 24 or end_hour > prof.work_end.hour:
                continue
            end = time(end_hour, end_min)
 
            if apt_date < today:
                status = random.choice(statuses_past)
            else:
                status = "scheduled"
 
            apt = Appointment(
                client_id=client.id,
                professional_id=prof.id,
                service_id=svc.id,
                date=apt_date,
                start_time=start,
                end_time=end,
                status=status,
            )
            appointments.append(apt)
 
        db.add_all(appointments)
        db.commit()
        print(f"  {len(appointments)} agendamentos criados")
 
        print("\n  Banco criado com sucesso!")
        print("  Admin: paulo.lavarini@barbearia.com / admin123")
        print("  Profissionais: joao/carlos/ana/pedro@barbearia.com / senha123")
        print("  Demo (cliente): demo@horacerta.com / demo123")
 
    except Exception as e:
        db.rollback()
        print(f"  Erro: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()