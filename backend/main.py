"""
SilvaPass Backend Application Entrypoint
FastAPI REST Service with structured logging, CORS, and health endpoints.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("silvapass.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SilvaPass backend starting up (env: %s)", settings.ENVIRONMENT)
    logger.info("Database URL: %s", settings.DATABASE_URL)
    logger.info("WHISP screening mode: %s", settings.WHISP_MODE)
    logger.info("Extraction mode: %s", settings.EXTRACTION_MODE)
    try:
        from backend.api.v1_router import db_manager
        plots = db_manager.get_all_plots()
        if len(plots) == 0:
            logger.info("Empty database detected. Initializing demo dataset for cloud showcase...")
            from scripts.seed_demo_scenario import seed_demo_environment
            seed_demo_environment(db_path=db_manager.db_path, reset=False)
            logger.info("Demo dataset seeded successfully.")
    except Exception as e:
        logger.warning("Auto-seed check encountered non-fatal error: %s", e)
    yield
    logger.info("SilvaPass backend shutting down")


app = FastAPI(
    title="SilvaPass Backend API",
    description="Evidence-backed plot-identity and shipment-integrity protocol",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
cors_origins = settings.get_cors_origins()
allow_all = "*" in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else cors_origins,
    allow_origin_regex=r"^https://.*(vercel\.app|netlify\.app)$" if not allow_all else None,
    allow_credentials=not allow_all,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
)

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Sanitizes validation errors so internal implementation details are not exposed."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "message": "Invalid request parameters or payload format.",
            "details": exc.errors()
        }
    )

@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    """Catches unhandled exceptions and logs them securely without leaking tracebacks to users."""
    logger.error("Unhandled exception processing request to %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing your request. Please contact system administrator."
        }
    )


from backend.api.v1_router import router as v1_router

# Mount API Routers
app.include_router(v1_router)


@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Health check endpoint for container / process monitoring."""
    return {
        "status": "healthy",
        "service": "silvapass-backend",
        "environment": settings.ENVIRONMENT,
        "whisp_mode": settings.WHISP_MODE,
        "extraction_mode": settings.EXTRACTION_MODE
    }


@app.get("/api/v1/ping", status_code=status.HTTP_200_OK)
async def connectivity_ping():
    """Minimal frontend/backend connectivity verification endpoint."""
    return {
        "message": "pong",
        "protocol": "SilvaPass",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import os
    import uvicorn
    host = os.environ.get("HOST") or settings.BACKEND_HOST
    port = settings.effective_port
    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        reload=(settings.ENVIRONMENT == "development")
    )
