import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.config import settings


@pytest.mark.asyncio
async def test_health_check_returns_healthy():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "silvapass-backend"
        assert data["environment"] == settings.ENVIRONMENT


@pytest.mark.asyncio
async def test_ping_connectivity():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/ping")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "pong"
        assert data["protocol"] == "SilvaPass"


def test_settings_validation():
    assert settings.BACKEND_PORT == 8000
    assert "http://localhost:5173" in settings.get_cors_origins()
    assert settings.WHISP_MODE in ["LIVE", "SNAPSHOT", "SIMULATION"]
