"""
Testes de autenticação — register, login, token inválido, /me.
"""

from tests.helpers import get_token, auth_header


class TestRegister:
    """POST /auth/register"""

    def test_register_success(self, client):
        response = client.post("/auth/register", json={
            "name": "Novo Usuário",
            "email": "novo@test.com",
            "password": "senha123",
            "role": "client",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Novo Usuário"
        assert data["email"] == "novo@test.com"
        assert data["role"] == "client"
        assert data["is_active"] is True
        assert "id" in data

    def test_register_duplicate_email(self, client):
        payload = {
            "name": "User 1",
            "email": "duplicado@test.com",
            "password": "senha123",
            "role": "client",
        }
        client.post("/auth/register", json=payload)
        response = client.post("/auth/register", json=payload)
        assert response.status_code == 400
        assert "já registrado" in response.json()["detail"]

    def test_register_invalid_email(self, client):
        response = client.post("/auth/register", json={
            "name": "User",
            "email": "email-invalido",
            "password": "senha123",
        })
        assert response.status_code == 422

    def test_register_empty_name(self, client):
        response = client.post("/auth/register", json={
            "name": "",
            "email": "vazio@test.com",
            "password": "senha123",
        })
        assert response.status_code == 422

    def test_register_short_password(self, client):
        response = client.post("/auth/register", json={
            "name": "User",
            "email": "curta@test.com",
            "password": "123",
        })
        assert response.status_code == 422

    def test_register_default_role_is_client(self, client):
        response = client.post("/auth/register", json={
            "name": "Sem Role",
            "email": "semrole@test.com",
            "password": "senha123",
        })
        assert response.status_code == 201
        assert response.json()["role"] == "client"


class TestLogin:
    """POST /auth/token"""

    def test_login_success(self, client, client_user):
        response = client.post(
            "/auth/token",
            data={"username": "cliente@test.com", "password": "cliente123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["name"] == "Cliente Teste"
        assert data["role"] == "client"

    def test_login_wrong_password(self, client, client_user):
        response = client.post(
            "/auth/token",
            data={"username": "cliente@test.com", "password": "errada"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        response = client.post(
            "/auth/token",
            data={"username": "naoexiste@test.com", "password": "qualquer"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert response.status_code == 401

    def test_login_returns_valid_token(self, client, client_user):
        token = get_token(client, "cliente@test.com", "cliente123")
        assert len(token) > 20


class TestMe:
    """GET /auth/me"""

    def test_me_authenticated(self, client, client_user):
        headers = auth_header(client, "cliente@test.com", "cliente123")
        response = client.get("/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "cliente@test.com"
        assert data["name"] == "Cliente Teste"

    def test_me_no_token(self, client):
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_me_invalid_token(self, client):
        response = client.get("/auth/me", headers={"Authorization": "Bearer token_invalido"})
        assert response.status_code == 401

    def test_me_admin(self, client, admin_user):
        headers = auth_header(client, "admin@test.com", "admin123")
        response = client.get("/auth/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["role"] == "admin"