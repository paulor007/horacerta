"""
Testes de agendamento — criar, conflito, cancelar, reagendar, completar, no-show.
"""

from datetime import date, timedelta
from tests.helpers import auth_header


def _next_weekday(weekday: int = 1) -> str:
    """Retorna a próxima data que cai no weekday (1=seg, 6=sáb). Formato YYYY-MM-DD."""
    today = date.today()
    days_ahead = weekday - today.isoweekday()
    if days_ahead <= 0:
        days_ahead += 7
    target = today + timedelta(days=days_ahead)
    return target.isoformat()


class TestCreateAppointment:
    """POST /api/v1/appointments"""

    def test_create_success(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        target_date = _next_weekday(1)  # próxima segunda

        response = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": target_date,
            "start_time": "10:00:00",
        }, headers=headers)

        assert response.status_code == 201
        data = response.json()
        assert data["professional_id"] == professional.id
        assert data["service_id"] == service.id
        assert data["date"] == target_date
        assert data["start_time"] == "10:00:00"
        assert data["status"] == "scheduled"
        assert data["client_name"] == "Cliente Teste"
        assert data["professional_name"] == "Profissional Teste"
        assert data["service_name"] == "Corte"

    def test_create_conflict(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        target_date = _next_weekday(2)  # próxima terça

        # Primeiro agendamento
        client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": target_date,
            "start_time": "14:00:00",
        }, headers=headers)

        # Mesmo horário — deve dar conflito
        response = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": target_date,
            "start_time": "14:00:00",
        }, headers=headers)

        assert response.status_code == 409
        assert "ocupado" in response.json()["detail"].lower()

    def test_create_outside_work_hours(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        target_date = _next_weekday(3)

        response = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": target_date,
            "start_time": "07:00:00",  # antes do work_start (09:00)
        }, headers=headers)

        assert response.status_code == 400
        assert "expediente" in response.json()["detail"].lower()

    def test_create_on_day_off(self, client, client_user, professional, service):
        """Profissional work_days=1,2,3,4,5,6 — domingo (7) não trabalha."""
        headers = auth_header(client, "cliente@test.com", "cliente123")
        # Achar próximo domingo
        today = date.today()
        days_ahead = 7 - today.isoweekday()
        if days_ahead <= 0:
            days_ahead += 7
        sunday = (today + timedelta(days=days_ahead)).isoformat()

        response = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": sunday,
            "start_time": "10:00:00",
        }, headers=headers)

        assert response.status_code == 400
        assert "não trabalha" in response.json()["detail"].lower()

    def test_create_in_the_past(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        yesterday = (date.today() - timedelta(days=1)).isoformat()

        response = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": yesterday,
            "start_time": "10:00:00",
        }, headers=headers)

        assert response.status_code == 400
        assert "passado" in response.json()["detail"].lower()

    def test_create_invalid_professional(self, client, client_user, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")

        response = client.post("/api/v1/appointments", json={
            "professional_id": 9999,
            "service_id": service.id,
            "date": _next_weekday(1),
            "start_time": "10:00:00",
        }, headers=headers)

        assert response.status_code == 404

    def test_create_invalid_service(self, client, client_user, professional):
        headers = auth_header(client, "cliente@test.com", "cliente123")

        response = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": 9999,
            "date": _next_weekday(1),
            "start_time": "10:00:00",
        }, headers=headers)

        assert response.status_code == 404

    def test_service_exceeds_work_end(self, client, client_user, professional, service):
        """Serviço de 30min começando 17:45 ultrapassa 18:00."""
        headers = auth_header(client, "cliente@test.com", "cliente123")

        response = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": _next_weekday(4),
            "start_time": "17:45:00",
        }, headers=headers)

        assert response.status_code == 400
        assert "ultrapassa" in response.json()["detail"].lower()


class TestCancelAppointment:
    """DELETE /api/v1/appointments/{id}"""

    def test_cancel_own_appointment(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        target_date = _next_weekday(5)

        # Criar
        res = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": target_date,
            "start_time": "10:00:00",
        }, headers=headers)
        apt_id = res.json()["id"]

        # Cancelar
        response = client.delete(f"/api/v1/appointments/{apt_id}", headers=headers)
        assert response.status_code == 200
        assert response.json()["message"] == "Agendamento cancelado"

    def test_cancel_nonexistent(self, client, client_user):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        response = client.delete("/api/v1/appointments/99999", headers=headers)
        assert response.status_code == 404

    def test_admin_can_cancel_any(self, client, client_user, admin_user, professional, service):
        # Cliente cria
        client_headers = auth_header(client, "cliente@test.com", "cliente123")
        res = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": _next_weekday(1),
            "start_time": "11:00:00",
        }, headers=client_headers)
        apt_id = res.json()["id"]

        # Admin cancela
        admin_headers = auth_header(client, "admin@test.com", "admin123")
        response = client.delete(f"/api/v1/appointments/{apt_id}", headers=admin_headers)
        assert response.status_code == 200


class TestRescheduleAppointment:
    """PUT /api/v1/appointments/{id}"""

    def test_reschedule_success(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")

        # Criar
        res = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": _next_weekday(1),
            "start_time": "10:00:00",
        }, headers=headers)
        apt_id = res.json()["id"]

        # Reagendar
        new_date = _next_weekday(2)
        response = client.put(f"/api/v1/appointments/{apt_id}", json={
            "date": new_date,
            "start_time": "15:00:00",
        }, headers=headers)

        assert response.status_code == 200
        assert response.json()["date"] == new_date
        assert response.json()["start_time"] == "15:00:00"


class TestCompleteAndNoShow:
    """PUT /api/v1/appointments/{id}/complete e /no-show"""

    def test_admin_can_complete(self, client, client_user, admin_user, professional, service):
        # Cliente cria
        client_headers = auth_header(client, "cliente@test.com", "cliente123")
        res = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": _next_weekday(3),
            "start_time": "10:00:00",
        }, headers=client_headers)
        apt_id = res.json()["id"]

        # Admin completa
        admin_headers = auth_header(client, "admin@test.com", "admin123")
        response = client.put(f"/api/v1/appointments/{apt_id}/complete", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "completed"

    def test_admin_can_noshow(self, client, client_user, admin_user, professional, service):
        client_headers = auth_header(client, "cliente@test.com", "cliente123")
        res = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": _next_weekday(4),
            "start_time": "10:00:00",
        }, headers=client_headers)
        apt_id = res.json()["id"]

        admin_headers = auth_header(client, "admin@test.com", "admin123")
        response = client.put(f"/api/v1/appointments/{apt_id}/no-show", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "no_show"

    def test_client_cannot_complete(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        res = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": _next_weekday(5),
            "start_time": "10:00:00",
        }, headers=headers)
        apt_id = res.json()["id"]

        response = client.put(f"/api/v1/appointments/{apt_id}/complete", headers=headers)
        assert response.status_code == 403

    def test_cannot_complete_cancelled(self, client, client_user, admin_user, professional, service):
        client_headers = auth_header(client, "cliente@test.com", "cliente123")
        res = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": _next_weekday(1),
            "start_time": "16:00:00",
        }, headers=client_headers)
        apt_id = res.json()["id"]

        # Cancelar primeiro
        client.delete(f"/api/v1/appointments/{apt_id}", headers=client_headers)

        # Tentar completar
        admin_headers = auth_header(client, "admin@test.com", "admin123")
        response = client.put(f"/api/v1/appointments/{apt_id}/complete", headers=admin_headers)
        assert response.status_code == 400


class TestMyAppointments:
    """GET /api/v1/appointments/my"""

    def test_list_own(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")

        # Criar 2 agendamentos
        for hour in ["10:00:00", "11:00:00"]:
            client.post("/api/v1/appointments", json={
                "professional_id": professional.id,
                "service_id": service.id,
                "date": _next_weekday(2),
                "start_time": hour,
            }, headers=headers)

        response = client.get("/api/v1/appointments/my", headers=headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_list_with_status_filter(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")

        client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": _next_weekday(3),
            "start_time": "10:00:00",
        }, headers=headers)

        response = client.get("/api/v1/appointments/my?status=scheduled", headers=headers)
        assert response.status_code == 200
        assert all(a["status"] == "scheduled" for a in response.json())