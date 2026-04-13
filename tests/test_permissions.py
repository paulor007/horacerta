"""
Testes de permissão — client vs professional vs admin.

Verifica que cada role só acessa o que deve.
"""

from tests.helpers import auth_header


class TestClientPermissions:
    """Cliente só acessa suas próprias rotas."""

    def test_client_can_list_professionals(self, client, client_user):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        response = client.get("/api/v1/professionals", headers=headers)
        assert response.status_code == 200

    def test_client_can_list_services(self, client, client_user):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        response = client.get("/api/v1/services", headers=headers)
        assert response.status_code == 200

    def test_client_cannot_create_service(self, client, client_user):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        response = client.post("/api/v1/services", json={
            "name": "Hack", "duration_min": 30, "price": 10,
        }, headers=headers)
        assert response.status_code == 403

    def test_client_cannot_create_professional(self, client, client_user):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        response = client.post("/api/v1/professionals", json={
            "user_id": 999, "specialty": "Hack",
        }, headers=headers)
        assert response.status_code == 403

    def test_client_cannot_list_users(self, client, client_user):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        response = client.get("/api/v1/users", headers=headers)
        assert response.status_code == 403

    def test_client_cannot_access_dashboard(self, client, client_user):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        response = client.get("/api/v1/reports/dashboard", headers=headers)
        assert response.status_code == 403

    def test_client_cannot_see_today_agenda(self, client, client_user):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        response = client.get("/api/v1/appointments/today", headers=headers)
        assert response.status_code == 403


class TestProfessionalPermissions:
    """Profissional acessa agenda mas não admin."""

    def test_professional_can_see_today(self, client, professional_user, professional):
        headers = auth_header(client, "prof@test.com", "prof123")
        response = client.get("/api/v1/appointments/today", headers=headers)
        assert response.status_code == 200

    def test_professional_cannot_create_service(self, client, professional_user):
        headers = auth_header(client, "prof@test.com", "prof123")
        response = client.post("/api/v1/services", json={
            "name": "Hack", "duration_min": 30, "price": 10,
        }, headers=headers)
        assert response.status_code == 403

    def test_professional_cannot_list_users(self, client, professional_user):
        headers = auth_header(client, "prof@test.com", "prof123")
        response = client.get("/api/v1/users", headers=headers)
        assert response.status_code == 403

    def test_professional_cannot_access_dashboard(self, client, professional_user):
        headers = auth_header(client, "prof@test.com", "prof123")
        response = client.get("/api/v1/reports/dashboard", headers=headers)
        assert response.status_code == 403

    def test_professional_can_list_professionals(self, client, professional_user):
        headers = auth_header(client, "prof@test.com", "prof123")
        response = client.get("/api/v1/professionals", headers=headers)
        assert response.status_code == 200


class TestAdminPermissions:
    """Admin acessa tudo."""

    def test_admin_can_list_users(self, client, admin_user):
        headers = auth_header(client, "admin@test.com", "admin123")
        response = client.get("/api/v1/users", headers=headers)
        assert response.status_code == 200

    def test_admin_can_create_service(self, client, admin_user):
        headers = auth_header(client, "admin@test.com", "admin123")
        response = client.post("/api/v1/services", json={
            "name": "Novo Serviço", "duration_min": 30, "price": 50,
        }, headers=headers)
        assert response.status_code == 201

    def test_admin_can_create_professional(self, client, admin_user, professional_user):
        headers = auth_header(client, "admin@test.com", "admin123")
        response = client.post("/api/v1/professionals", json={
            "user_id": professional_user.id,
            "specialty": "Barba",
            "work_start": "09:00:00",
            "work_end": "18:00:00",
            "work_days": "1,2,3,4,5",
        }, headers=headers)
        assert response.status_code == 201

    def test_admin_can_access_dashboard(self, client, admin_user):
        headers = auth_header(client, "admin@test.com", "admin123")
        response = client.get("/api/v1/reports/dashboard", headers=headers)
        assert response.status_code == 200

    def test_admin_can_see_today_agenda(self, client, admin_user):
        headers = auth_header(client, "admin@test.com", "admin123")
        response = client.get("/api/v1/appointments/today", headers=headers)
        assert response.status_code == 200

    def test_admin_can_toggle_user(self, client, admin_user, client_user):
        headers = auth_header(client, "admin@test.com", "admin123")
        response = client.put(f"/api/v1/users/{client_user.id}/toggle-active", headers=headers)
        assert response.status_code == 200


class TestUnauthenticated:
    """Sem token = 401 em tudo."""

    def test_professionals_requires_auth(self, client):
        assert client.get("/api/v1/professionals").status_code == 401

    def test_services_requires_auth(self, client):
        assert client.get("/api/v1/services").status_code == 401

    def test_appointments_requires_auth(self, client):
        assert client.post("/api/v1/appointments", json={}).status_code == 401

    def test_my_appointments_requires_auth(self, client):
        assert client.get("/api/v1/appointments/my").status_code == 401

    def test_dashboard_requires_auth(self, client):
        assert client.get("/api/v1/reports/dashboard").status_code == 401

    def test_users_requires_auth(self, client):
        assert client.get("/api/v1/users").status_code == 401