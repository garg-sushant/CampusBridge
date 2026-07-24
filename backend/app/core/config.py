import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/campus_governance"
    SECRET_KEY: str = "9a15f02c6114b30bccebe7d4ad22a00c7db5204ef971cdfb1c557fa678d45391"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    UPLOAD_DIR: str = "uploads"
    
    # xAI Grok LLM Integration Configurations
    GROK_API_KEY: str = ""
    CHATGROK_API_KEY: str = ""
    GROK_API_URL: str = "https://api.x.ai/v1"
    GROK_MODEL: str = "grok-beta"

    # Realtime Gmail / SMTP Email Dispatcher Configurations
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "CampusBridge Governance Portal"


    @property
    def sync_database_url(self) -> str:
        """Ensure postgres:// scheme is converted to postgresql:// for SQLAlchemy compatibility."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql://", 1)
        return url

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

