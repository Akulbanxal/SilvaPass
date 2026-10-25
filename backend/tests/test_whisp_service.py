"""
Comprehensive Automated Tests for FAO Open Foris WHISP Environmental Screening Service.

Tests:
1. Valid service response (mocked live HTTP 200).
2. Invalid/malformed geometry rejection.
3. WGS84 out-of-bounds geometry rejection before dispatch.
4. Authentication failure (missing or invalid API key).
5. Rate limiting (HTTP 429 backoff).
6. Timeout handling (bounded timeout without hanging).
7. Malformed response handling.
8. Cached snapshot fallback.
9. Simulation deterministic mode.
10. Asynchronous job-status workflow success (HTTP 202 -> polling GET /status/{token} -> HTTP 200).
11. Asynchronous job timeout handling (HTTP 408 from status polling).
12. Asynchronous job remote error handling (HTTP 500 from status polling).
13. Official WHISP indicator properties parsing (treecover, commodities, disturbances).
14. Server-side environment variable resolution (WHISP_API_KEY from os.environ).
"""
import os
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
    Simulates a valid synchronous HTTP 200 response from FAO WHISP /submit/geojson.
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

        # Verify call payload format matches GeoJSON FeatureCollection
        call_args = mock_post.call_args
        sent_payload = call_args[1]["json"]
        assert sent_payload["type"] == "FeatureCollection"
        assert len(sent_payload["features"]) == 1
        assert sent_payload["features"][0]["geometry"] == base_geom
        assert call_args[1]["headers"]["X-API-KEY"] == "mock_valid_key"


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
async def test_whisp_wgs84_out_of_bounds_geometry():
    """
    Rejects coordinates outside WGS84 range before dispatching network request.
    """
    service = WhispScreeningService(api_key="mock_valid_key", mode="LIVE")
    invalid_wgs84_geom = {
        "type": "Polygon",
        "coordinates": [
            [
                [210.0, 95.0],  # Out of WGS84 range: lon > 180, lat > 90
                [211.0, 95.0],
                [211.0, 96.0],
                [210.0, 96.0],
                [210.0, 95.0]
            ]
        ]
    }
    result = await service.screen_plot_geometry("PLOT-OUT-OF-BOUNDS", invalid_wgs84_geom)
    assert result.provenance == ProvenanceType.UNRESOLVED_UNCERTAINTY
    assert result.deforestation_risk == DeforestationRisk.UNAVAILABLE
    assert "malformed geometry" in result.uncertainty_reasons[0].lower()


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


@pytest.mark.asyncio
async def test_whisp_async_job_workflow_success(base_geom):
    """
    Simulates the official asynchronous job-status workflow:
    1. POST /submit/geojson returns HTTP 202 with tracking token "tok-abc-123".
    2. First poll GET /status/tok-abc-123 returns HTTP 202 ("analysis_processing").
    3. Second poll GET /status/tok-abc-123 returns HTTP 200 ("analysis_completed") with results.
    """
    service = WhispScreeningService(api_key="mock_valid_key", mode="LIVE", job_timeout_seconds=10.0)

    # 1. Mock submit response: HTTP 202 Queued
    submit_resp = MagicMock()
    submit_resp.status_code = 202
    submit_resp.json.return_value = {
        "code": "analysis_queued",
        "message": "Analysis queued, waiting for available worker...",
        "data": {
            "token": "tok-abc-123",
            "statusUrl": "/api/status/tok-abc-123",
            "featureCount": 1
        }
    }

    # 2. Mock polling response 1: HTTP 202 Processing
    poll_resp_1 = MagicMock()
    poll_resp_1.status_code = 202
    poll_resp_1.json.return_value = {
        "code": "analysis_processing",
        "message": "Analysis in progress...",
        "data": {"token": "tok-abc-123", "percent": 50.0}
    }

    # 3. Mock polling response 2: HTTP 200 Completed
    poll_resp_2 = MagicMock()
    poll_resp_2.status_code = 200
    poll_resp_2.json.return_value = {
        "code": "analysis_completed",
        "message": "Analysis completed successfully",
        "data": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": base_geom,
                    "properties": {
                        "plotId": "PLOT-ASYNC-01",
                        "Area": 12.5,
                        "Country": "BRA",
                        "risk_pcrop": "low",
                        "Ind_01_treecover": "no",
                        "Ind_02_commodities": "yes",
                        "Ind_03_disturbance_before_2020": "no",
                        "Ind_04_disturbance_after_2020": "no",
                        "Forest_FDaP": 0.02,
                        "whisp_processing_metadata": {
                            "whisp_version": "3.0.0a14",
                            "datasets_used": [
                                "JRC/GFC2020/V4",
                                "UMD/GLAD/primary_humid_tropical_forests",
                                "JRC/TMF/v1/undisturbed"
                            ]
                        }
                    }
                }
            ]
        }
    }

    with patch("httpx.AsyncClient.post", return_value=submit_resp) as mock_post, \
         patch("httpx.AsyncClient.get", side_effect=[poll_resp_1, poll_resp_2]) as mock_get, \
         patch("asyncio.sleep", return_value=None):

        result = await service.screen_plot_geometry("PLOT-ASYNC-01", base_geom)

        assert result.provenance == ProvenanceType.EXTERNAL_VERIFIED
        assert result.deforestation_risk == DeforestationRisk.LOW_RISK
        assert result.assessment_status == "COMPLETED"
        assert result.indicators.commodity_detected is True
        assert result.indicators.ind_01_mapped_forest is False
        assert result.indicators.post_cutoff_disturbances == 0
        assert mock_get.call_count == 2
        # Verify status endpoint was polled with token
        called_url = mock_get.call_args[0][0]
        assert "tok-abc-123" in called_url


@pytest.mark.asyncio
async def test_whisp_async_job_server_timeout(base_geom):
    """
    Simulates asynchronous job status polling encountering HTTP 408 server timeout.
    """
    service = WhispScreeningService(api_key="mock_valid_key", mode="LIVE", job_timeout_seconds=5.0)

    submit_resp = MagicMock()
    submit_resp.status_code = 202
    submit_resp.json.return_value = {
        "code": "analysis_queued",
        "data": {"token": "tok-timeout-408"}
    }

    poll_timeout_resp = MagicMock()
    poll_timeout_resp.status_code = 408
    poll_timeout_resp.json.return_value = {
        "code": "analysis_timeout",
        "message": "Analysis timed out after 300 seconds."
    }

    with patch("httpx.AsyncClient.post", return_value=submit_resp), \
         patch("httpx.AsyncClient.get", return_value=poll_timeout_resp), \
         patch("asyncio.sleep", return_value=None):

        result = await service.screen_plot_geometry("PLOT-ASYNC-TIMEOUT", base_geom)
        assert result.provenance == ProvenanceType.UNRESOLVED_UNCERTAINTY
        assert result.deforestation_risk == DeforestationRisk.UNAVAILABLE
        assert "timed out" in result.uncertainty_reasons[0].lower()


@pytest.mark.asyncio
async def test_whisp_async_job_worker_error(base_geom):
    """
    Simulates asynchronous job status polling encountering HTTP 500 remote worker failure.
    """
    service = WhispScreeningService(api_key="mock_valid_key", mode="LIVE", job_timeout_seconds=5.0)

    submit_resp = MagicMock()
    submit_resp.status_code = 202
    submit_resp.json.return_value = {
        "code": "analysis_queued",
        "data": {"token": "tok-error-500"}
    }

    poll_err_resp = MagicMock()
    poll_err_resp.status_code = 500
    poll_err_resp.json.return_value = {
        "code": "analysis_error",
        "message": "Earth Engine worker failed: User memory limit exceeded."
    }

    with patch("httpx.AsyncClient.post", return_value=submit_resp), \
         patch("httpx.AsyncClient.get", return_value=poll_err_resp), \
         patch("asyncio.sleep", return_value=None):

        result = await service.screen_plot_geometry("PLOT-ASYNC-ERR", base_geom)
        assert result.provenance == ProvenanceType.UNRESOLVED_UNCERTAINTY
        assert "500" in result.uncertainty_reasons[0]


@pytest.mark.asyncio
async def test_whisp_official_indicators_parsing(base_geom):
    """
    Verifies that official Open Foris WHISP property formats (string "yes"/"no",
    risk_pcrop="high", and post-2020 disturbance flags) are properly converted.
    """
    service = WhispScreeningService(api_key="mock_valid_key", mode="LIVE")

    high_risk_response = {
        "code": "analysis_completed",
        "data": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": base_geom,
                    "properties": {
                        "plotId": "PLOT-HIGH-01",
                        "risk_pcrop": "high",
                        "Ind_01_treecover": "yes",
                        "Ind_02_commodities": "yes",
                        "Ind_03_disturbance_before_2020": "no",
                        "Ind_04_disturbance_after_2020": "yes",  # Post-cutoff disturbance!
                        "Forest_FDaP": 0.65,
                        "Cocoa_FDaP": 0.80
                    }
                }
            ]
        }
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = high_risk_response
        mock_post.return_value = mock_resp

        result = await service.screen_plot_geometry("PLOT-HIGH-01", base_geom)
        assert result.provenance == ProvenanceType.EXTERNAL_VERIFIED
        assert result.deforestation_risk == DeforestationRisk.HIGH_RISK
        assert result.indicators.ind_01_mapped_forest is True
        assert result.indicators.ind_02_commodity_map is True
        assert result.indicators.ind_04_recent_disturbance is True
        assert result.indicators.post_cutoff_disturbances == 1
        assert result.indicators.forest_overlap_pct == 0.65


def test_whisp_env_variable_resolution():
    """
    Verifies that WhispScreeningService reads the API key strictly from the
    server-side environment variable WHISP_API_KEY.
    """
    with patch.dict(os.environ, {"WHISP_API_KEY": "test_env_key_secret_999"}, clear=False):
        service = WhispScreeningService(api_key=None)
        assert service.api_key == "test_env_key_secret_999"
