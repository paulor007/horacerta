"""
Testes de disponibilidade — slots, dia inválido, passado, conflito parcial.
"""

from datetime import date, timedelta
from tests.helpers import auth_header


def _next_weekday(weekday: int = 1) -> str:
    today = date.today()
    days_ahead = weekday - today.isoweekday()
    if days_ahead <= 0:
        days_ahead += 7
    return (today + timedelta(days=days_ahead)).isoformat()


class TestAvailability:
    """GET /api/v1/appointments/available"""

    def test_returns_slots(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        target_date = _next_weekday(1)

        response = client.get(
            f"/api/v1/appointments/available?professional_id={professional.id}&date={target_date}&service_id={service.id}",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["professional_id"] == professional.id
        assert data["professional_name"] == "Profissional Teste"
        assert data["date"] == target_date
        assert len(data["slots"]) > 0

    def test_slots_have_correct_structure(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        target_date = _next_weekday(2)

        response = client.get(
            f"/api/v1/appointments/available?professional_id={professional.id}&date={target_date}&service_id={service.id}",
            headers=headers,
        )

        data = response.json()
        for slot in data["slots"]:
            assert "time" in slot
            assert "available" in slot
            assert isinstance(slot["available"], bool)

    def test_all_slots_available_when_no_appointments(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        target_date = _next_weekday(3)

        response = client.get(
            f"/api/v1/appointments/available?professional_id={professional.id}&date={target_date}&service_id={service.id}",
            headers=headers,
        )

        data = response.json()
        available = [s for s in data["slots"] if s["available"]]
        assert len(available) == len(data["slots"])

    def test_slot_occupied_after_booking(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        target_date = _next_weekday(4)

        # Agendar 10:00
        client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": target_date,
            "start_time": "10:00:00",
        }, headers=headers)

        # Checar disponibilidade
        response = client.get(
            f"/api/v1/appointments/available?professional_id={professional.id}&date={target_date}&service_id={service.id}",
            headers=headers,
        )

        data = response.json()
        slot_10 = next((s for s in data["slots"] if s["time"] == "10:00:00"), None)
        assert slot_10 is not None
        assert slot_10["available"] is False

    def test_sunday_returns_empty(self, client, client_user, professional, service):
        """Profissional work_days=1,2,3,4,5,6 — domingo retorna vazio."""
        headers = auth_header(client, "cliente@test.com", "cliente123")

        today = date.today()
        days_ahead = 7 - today.isoweekday()
        if days_ahead <= 0:
            days_ahead += 7
        sunday = (today + timedelta(days=days_ahead)).isoformat()

        response = client.get(
            f"/api/v1/appointments/available?professional_id={professional.id}&date={sunday}&service_id={service.id}",
            headers=headers,
        )

        assert response.status_code == 200
        assert len(response.json()["slots"]) == 0

    def test_invalid_date_format(self, client, client_user):
        headers = auth_header(client, "cliente@test.com", "cliente123")

        response = client.get(
            "/api/v1/appointments/available?professional_id=1&date=13-04-2026&service_id=1",
            headers=headers,
        )

        assert response.status_code == 400
        assert "inválida" in response.json()["detail"].lower()

    def test_invalid_professional(self, client, client_user, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")

        response = client.get(
            f"/api/v1/appointments/available?professional_id=9999&date={_next_weekday(1)}&service_id={service.id}",
            headers=headers,
        )

        assert response.status_code == 404

    def test_slots_respect_work_hours(self, client, client_user, professional, service):
        """Slots devem estar entre 09:00 e 18:00 (work hours do fixture)."""
        headers = auth_header(client, "cliente@test.com", "cliente123")
        target_date = _next_weekday(5)

        response = client.get(
            f"/api/v1/appointments/available?professional_id={professional.id}&date={target_date}&service_id={service.id}",
            headers=headers,
        )

        data = response.json()
        for slot in data["slots"]:
            time_str = slot["time"][:5]  # "09:00:00" → "09:00"
            assert time_str >= "09:00"
            assert time_str < "18:00"

    def test_cancelled_slot_becomes_available(self, client, client_user, professional, service):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        target_date = _next_weekday(6)

        # Agendar
        res = client.post("/api/v1/appointments", json={
            "professional_id": professional.id,
            "service_id": service.id,
            "date": target_date,
            "start_time": "14:00:00",
        }, headers=headers)
        apt_id = res.json()["id"]

        # Cancelar
        client.delete(f"/api/v1/appointments/{apt_id}", headers=headers)

        # Checar — slot deve voltar a ser disponível
        response = client.get(
            f"/api/v1/appointments/available?professional_id={professional.id}&date={target_date}&service_id={service.id}",
            headers=headers,
        )

        data = response.json()
        slot_14 = next((s for s in data["slots"] if s["time"] == "14:00:00"), None)
        assert slot_14 is not None
        assert slot_14["available"] is True