"""
SilvaPass Backend Configuration Module
Validated with Pydantic Settings.
"""
from typing import List, Union
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = Field(default="development", description="Application environment")
    LOG_LEVEL: str = Field(default="INFO", description="Logging verbosity")

    BACKEND_HOST: str = Field(default="127.0.0.1", description="Host interface to bind")
    BACKEND_PORT: int = Field(default=8000, description="Port to listen on")
    PORT: Union[int, None] = Field(default=None, description="Cloud provider port (Render/Railway)")
    ALLOWED_ORIGINS: Union[str, List[str]] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        description="CORS allowed origins"
    )

    @property
    def effective_port(self) -> int:
        import os
        port_env = os.environ.get("PORT")
        if port_env:
            try:
                return int(port_env)
            except ValueError:
                pass
        return self.PORT or self.BACKEND_PORT

    DATABASE_URL: str = Field(default="sqlite:///./silvapass.db", description="Database connection URI")

    # Blockchain configuration
    EVM_RPC_URL: str = Field(default="http://127.0.0.1:8545", description="JSON-RPC endpoint")
    CHAIN_ID: int = Field(default=31337, description="Target network chain ID")
    REGISTRAR_PRIVATE_KEY: str = Field(
        default="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        description="Local testing private key"
    )
    SILVAPASS_REGISTRY_ADDRESS: str = Field(default="", description="Deployed contract address")

    # Environmental screening (FAO WHISP)
    WHISP_MODE: str = Field(default="SNAPSHOT", description="Screening mode: LIVE, SNAPSHOT, SIMULATION")
    WHISP_API_URL: str = Field(default="https://whisp.openforis.org/api", description="FAO WHISP API root")
    WHISP_API_KEY: str = Field(default="", description="WHISP API Key")

    # Document Extraction
    EXTRACTION_MODE: str = Field(default="MOCK", description="Extraction mode: MOCK or LIVE")
    LLM_PROVIDER: str = Field(default="openai", description="LLM provider: openai")
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key")
    LLM_API_KEY: str = Field(default="", description="LLM provider API key (fallback)")
    LLM_MODEL: str = Field(default="gpt-4o-mini", description="LLM model identifier")

    def get_llm_api_key(self) -> str:
        import os
        return (
            os.environ.get("OPENAI_API_KEY")
            or self.OPENAI_API_KEY
            or os.environ.get("LLM_API_KEY")
            or self.LLM_API_KEY
            or ""
        ).strip()

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_cors_origins(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, str):
            return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        return self.ALLOWED_ORIGINS


settings = Settings()
