from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "AI ERP"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False  # True → structured JSON logs; False → human-readable

    DATABASE_URL: str = "sqlite:///./erp.db"

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"          # any tool-call capable model
    OLLAMA_TIMEOUT: int = 60               # seconds
    OLLAMA_FALLBACK_TO_RULES: bool = True  # use rule-based parser when Ollama is down


@lru_cache
def get_settings() -> Settings:
    return Settings()
