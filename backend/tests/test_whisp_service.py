"""
Comprehensive Automated Tests for FAO Open Foris WHISP Environmental Screening Service.

Tests:
1. Valid service response (mocked live HTTP 200).
2. Invalid/malformed geometry rejection.
3. Authentication failure (missing or invalid API key).
4. Rate limiting (HTTP 429 backoff).
5. Timeout handling (bounded timeout without hanging).
6. Malformed response handling.
7. Cached snapshot fallback.
8. Simulation deterministic mode.
"""
import pytest
import json
import httpx
from unittest.mock import patch, MagicMock

from backend.environmental.whisp_client import WhispScreeningService
from backend.schemas.api_models import DeforestationRisk, ProvenanceType
from backend.geo.synthetic_benchmarks import generate_synthetic_benchmark_suite


@pytest.fixture
def base_geom():
    benchmarks = generate_synthetic_benchmark_suite()
    return benchmarks["base_plot"]


@pytest.mark.asyncio
async def test_whisp_valid_service_response(base_geom):
    """
    Simulates a valid HTTP 200 response from FAO WHISP /submit/geojson.
    """
    mock_response_data = {
        "code": "analysis_completed",
        "message": "Analysis processed successfully",
        "data": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": base_geom,
                    "properties": {
                        "plot_id": "PLOT-TEST-01",
                        "risk_category": "Low Risk",
                        "indicators": {
                            "ind_01_mapped_forest": False,
                            "ind_02_commodity_map": True,
                            "ind_03_disturbance_before_2020": False,
                            "ind_04_recent_disturbance": False
                        }
                    }
                }
            ]
        },
        "whisp_processing_metadata": {
            "datasets_used": ["JRC/GFC2020/V4", "GLAD/dist alerts"],
            "resolution_meters": 10
        }
    }

    service = WhispScreeningService(api_key="mock_valid_key", mode="LIVE")

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_response_data
        mock_post.return_value = mock_resp

        result = await service.screen_plot_geometry("PLOT-TEST-01", base_geom)

        assert result.provenance == ProvenanceType.EXTERNAL_VERIFIED
        assert result.deforestation_risk == DeforestationRisk.LOW_RISK
        assert result.assessment_status == "COMPLETED"
        assert result.indicators.commodity_detected is True
        assert result.indicators.post_cutoff_disturbances == 0
        assert "JRC/GFC2020/V4" in result.datasets_used
        assert result.source_digest.startswith("sha256:")


@pytest.mark.asyncio
async def test_whisp_invalid_geometry():
    """
    Rejects missing or invalid geometry before dispatch, emitting UNRESOLVED_UNCERTAINTY.
    """
    service = WhispScreeningService(api_key="mock_valid_key", mode="LIVE")

    result = await service.screen_plot_geometry("PLOT-BAD", {})
    assert result.provenance == ProvenanceType.UNRESOLVED_UNCERTAINTY
    assert result.deforestation_risk == DeforestationRisk.UNAVAILABLE
    assert "Invalid or missing" in result.uncertainty_reasons[0]


@pytest.mark.asyncio
async def test_whisp_authentication_failure(base_geom):
    """
    Tests handling when API key is missing or invalid.
    """
    # 1. Missing API key
    service_no_key = WhispScreeningService(api_key="", mode="LIVE")
    res_no_key = await service_no_key.screen_plot_geometry("PLOT-01", base_geom)
    assert res_no_key.provenance == ProvenanceType.UNRESOLVED_UNCERTAINTY
    assert "Missing WHISP_API_KEY" in res_no_key.uncertainty_reasons[0]

    # 2. HTTP 401 Unauthorized from server
    service_bad_key = WhispScreeningService(api_key="invalid_token", mode="LIVE")
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.json.return_value = {"code": "auth_invalid_api_key", "message": "Invalid API key"}
        mock_post.return_value = mock_resp

        res_bad_key = await service_bad_key.screen_plot_geometry("PLOT-02", base_geom)
        assert res_bad_key.provenance == ProvenanceType.UNRESOLVED_UNCERTAINTY
        assert "authentication failure" in res_bad_key.uncertainty_reasons[0].lower()


@pytest.mark.asyncio
async def test_whisp_rate_limiting(base_geom):
    """
    Tests HTTP 429 rate limit response and bounded backoff.
    """
    service = WhispScreeningService(api_key="mock_key", mode="LIVE", max_retries=1)

    with patch("httpx.AsyncClient.post") as mock_post, patch("asyncio.sleep") as mock_sleep:
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_resp.text = "Too Many Requests"
        mock_post.return_value = mock_resp

        res = await service.screen_plot_geometry("PLOT-RATE", base_geom)
        assert res.provenance == ProvenanceType.UNRESOLVED_UNCERTAINTY
        assert "Rate Limit Exceeded" in res.uncertainty_reasons[0]


@pytest.mark.asyncio
async def test_whisp_timeout_handling(base_geom):
    """
    Tests handling of network timeout without infinite hang.
    """
    service = WhispScreeningService(api_key="mock_key", mode="LIVE", max_retries=1, timeout_seconds=1.0)

    with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Read timed out")), patch("asyncio.sleep"):
        res = await service.screen_plot_geometry("PLOT-TIMEOUT", base_geom)
        assert res.provenance == ProvenanceType.UNRESOLVED_UNCERTAINTY
        assert "timeout" in res.uncertainty_reasons[0].lower()


@pytest.mark.asyncio
async def test_whisp_malformed_response(base_geom):
    """
    Tests handling when server returns HTTP 500 or malformed HTML/JSON.
    """
    service = WhispScreeningService(api_key="mock_key", mode="LIVE", max_retries=1)

    with patch("httpx.AsyncClient.post") as mock_post, patch("asyncio.sleep"):
        mock_resp = MagicMock()
        mock_resp.status_code = 502
        mock_resp.text = "<html>502 Bad Gateway</html>"
        mock_post.return_value = mock_resp

        res = await service.screen_plot_geometry("PLOT-MALFORMED", base_geom)
        assert res.provenance == ProvenanceType.UNRESOLVED_UNCERTAINTY
        assert "server error" in res.uncertainty_reasons[0].lower() or "502" in res.uncertainty_reasons[0]


@pytest.mark.asyncio
async def test_whisp_cached_snapshot_fallback(base_geom):
    """
    Tests offline SNAPSHOT mode using documented benchmark reference.
    """
    service = WhispScreeningService(mode="SNAPSHOT")

    # Documented reference plot
    res_pinned = await service.screen_plot_geometry("PLOT-REF-BASE", base_geom)
    assert res_pinned.provenance == ProvenanceType.CACHED_SNAPSHOT
    assert res_pinned.is_cached_snapshot is True
    assert res_pinned.deforestation_risk == DeforestationRisk.LOW_RISK
    assert len(res_pinned.datasets_used) >= 3

    # Unknown plot in snapshot mode generates deterministic cached snapshot
    res_other = await service.screen_plot_geometry("PLOT-UNKNOWN", base_geom)
    assert res_other.provenance == ProvenanceType.CACHED_SNAPSHOT
    assert res_other.is_cached_snapshot is True


@pytest.mark.asyncio
async def test_whisp_simulation_mode(base_geom):
    """
    Tests SIMULATION mode explicitly marking data as SIMULATED.
    """
    service = WhispScreeningService(mode="SIMULATION")
    res = await service.screen_plot_geometry("PLOT-SIM", base_geom)
    assert res.provenance == ProvenanceType.SIMULATED
    assert res.is_cached_snapshot is False
    assert "SIMULATED" in res.warnings[0]
