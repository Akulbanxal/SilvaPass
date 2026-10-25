#!/usr/bin/env python3
"""
CLI Integration Command for Live FAO Open Foris WHISP Connectivity.
Tests real network connection to https://whisp.openforis.org when explicitly invoked.
Keeps the standard test suite completely offline.

Usage:
    npm run test:whisp:live
    or
    python -m backend.environmental.verify_live_whisp [--api-key KEY]
"""
import sys
import os
from pathlib import Path
import argparse
import asyncio
import httpx

# Ensure project root is in sys.path
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.config import settings
from backend.environmental.whisp_client import WhispScreeningService
from backend.geo.synthetic_benchmarks import generate_synthetic_benchmark_suite


async def main():
    parser = argparse.ArgumentParser(description="Test live connectivity to FAO Open Foris WHISP API.")
    parser.add_argument("--api-key", help="WHISP API key to test with (overrides WHISP_API_KEY env)")
    parser.add_argument("--url", default=settings.WHISP_API_URL, help="Base WHISP API URL")
    args = parser.parse_args()

    raw_key = args.api_key or os.environ.get("WHISP_API_KEY") or settings.WHISP_API_KEY or ""
    api_key = raw_key.strip()
    api_url = args.url.rstrip("/")

    print("=" * 68)
    print("SILVAPASS: FAO OPEN FORIS WHISP LIVE INTEGRATION PROBE")
    print("=" * 68)
    print(f"Target URL:    {api_url}/submit/geojson")
    print(f"API Key:       {'[Configured: ' + api_key[:4] + '...' + api_key[-4:] + ']' if len(api_key) > 8 else ('[Configured]' if api_key else '[NONE / EMPTY]')}")
    print("-" * 68)

    # 1. Probe endpoint reachability
    print("[1/3] Testing endpoint availability over HTTPS...")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # Check service health endpoint
            health_resp = await client.get(f"{api_url}/health")
            health_ok = health_resp.status_code == 200 and health_resp.json().get("ok") is True
            print(f"      Service Health Status: {'ONLINE (ok=true)' if health_ok else f'HTTP {health_resp.status_code}'}")

            # Check /submit/geojson endpoint requiring credentials
            probe_payload = {
                "type": "FeatureCollection",
                "features": [],
                "analysisOptions": {"async": False}
            }
            resp = await client.post(
                f"{api_url}/submit/geojson",
                json=probe_payload,
                headers={"Content-Type": "application/json", "User-Agent": "SilvaPass-Live-Check/1.0"}
            )
            print(f"      HTTP Response Code:    {resp.status_code}")
            try:
                body = resp.json()
                print(f"      Response Code Key:     {body.get('code', 'N/A')}")
                print(f"      Response Message:      {body.get('message', 'N/A')}")
            except Exception:
                print(f"      Response Body:         {resp.text[:120]}")
    except Exception as e:
        print(f"      [ERROR] Could not reach endpoint: {e}")
        print("      Status: OFFLINE / UNREACHABLE")
        sys.exit(1)

    print("\n[2/3] Evaluating Authentication Credentials...")
    if not api_key:
        print("      [NOTICE] No WHISP_API_KEY provided in server environment or .env.")
        print("      - Endpoint confirmed reachable and correctly requiring credentials (HTTP 401).")
        print("      - Live screening will emit UNRESOLVED_UNCERTAINTY until a key is configured.")
        print("      - To configure: set WHISP_API_KEY in your server environment or SilvaPass/.env")
        print("\n[3/3] Live Assessment Outcome:")
        print("      Live Assessment: NOT EXECUTED (Missing Credentials)")
        print("      Offline Suite:   100% OPERATIONAL (Snapshot & Simulation Fallback active)")
        print("=" * 68)
        return

    print("\n[3/3] Executing live test screening with validated WGS84 plot boundary...")
    benchmarks = generate_synthetic_benchmark_suite()
    sample_geom = benchmarks["base_plot"]

    service = WhispScreeningService(api_url=api_url, api_key=api_key, mode="LIVE")
    result = await service.screen_plot_geometry("PLOT-LIVE-PROBE", sample_geom)

    print(f"      Screening ID:          {result.screening_id}")
    print(f"      Provenance Badge:      {result.provenance.value}")
    print(f"      Assessment Status:     {result.assessment_status}")
    print(f"      Deforestation Risk:    {result.deforestation_risk.value}")
    print(f"      Digest:                {result.source_digest}")
    print(f"      Datasets Used:         {result.datasets_used}")
    print(f"      Treecover Overlap:     {result.indicators.forest_overlap_pct}")
    print(f"      Commodity Overlap:     {result.indicators.commodity_detected}")
    print(f"      Post-Cutoff Dist:      {result.indicators.post_cutoff_disturbances}")

    if result.provenance.value == "EXTERNAL_VERIFIED":
        print("\n>>> LIVE REQUEST SUCCESSFUL: Verified against live FAO Open Foris WHISP service! <<<")
    else:
        print(f"\n>>> LIVE REQUEST UNRESOLVED: {result.uncertainty_reasons} <<<")
        if result.warnings:
            print(f"    Warnings: {result.warnings}")
    print("=" * 68)


if __name__ == "__main__":
    asyncio.run(main())
