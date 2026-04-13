"""Helpers de teste — funções de autenticação reutilizáveis."""

from fastapi.testclient import TestClient


def get_token(client_http: TestClient, email: str, password: str) -> str:
    """Faz login e retorna o token JWT."""
    response = client_http.post(
        "/auth/token",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200, f"Login falhou: {response.text}"
    return response.json()["access_token"]


def auth_header(client_http: TestClient, email: str, password: str) -> dict:
    """Retorna headers com Authorization Bearer."""
    token = get_token(client_http, email, password)
    return {"Authorization": f"Bearer {token}"}