from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: SecretStr
    database_ssl: bool = True
    database_ssl_ca_file: str | None = None
    database_pool_size: int = Field(default=5, ge=1, le=50)
    supabase_url: str
    supabase_publishable_key: SecretStr | None = None
    auth_audience: str = "authenticated"
    cors_origins: list[str] = ["http://localhost:3000"]
    security_verification_url: str | None = None
    security_verification_secret: SecretStr | None = None
    security_allow_development: bool = False
    turnstile_secret_key: SecretStr | None = None
    turnstile_expected_hostname: str | None = None
    worker_interval_seconds: float = Field(default=5, ge=0.1, le=60)
    redis_url: SecretStr | None = None
    abuse_protection_enabled: bool = False
    abuse_key_secret: SecretStr | None = None
    abuse_namespace: str = "fairdrop"
    registration_rate: float = Field(default=0.05, gt=0)
    registration_burst: int = Field(default=3, ge=1)
    polling_rate: float = Field(default=0.5, gt=0)
    polling_burst: int = Field(default=5, ge=1)
    confirm_rate: float = Field(default=0.5, gt=0)
    confirm_burst: int = Field(default=3, ge=1)
    abuse_violation_threshold: int = Field(default=30, ge=1)
    abuse_cooldown_seconds: int = Field(default=60, ge=1)
    device_account_cap: int = Field(default=6, ge=1)
    device_network_account_cap: int = Field(default=2, ge=1)
    abuse_identity_window_seconds: int = Field(default=86400, ge=1)

    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, value: str) -> str:
        if not value.startswith(("http://", "https://")):
            raise ValueError("SUPABASE_URL must be an HTTP(S) URL")
        return value.rstrip("/")

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use postgresql+asyncpg://")
        return value

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        if self.abuse_protection_enabled and (
            not self.redis_url
            or not self.abuse_key_secret
            or len(self.abuse_key_secret.get_secret_value()) < 32
        ):
            raise ValueError(
                "Abuse protection requires Redis and a secret of at least 32 characters"
            )
        if self.security_verification_url and not self.security_verification_secret:
            raise ValueError("External security verification requires a server secret")
        if self.environment == "production":
            if not self.abuse_protection_enabled:
                raise ValueError("Production requires abuse protection")
            if self.security_allow_development:
                raise ValueError("Development security bypass is forbidden in production")
            if not self.database_ssl:
                raise ValueError("Production database connections require TLS")
            if not self.supabase_url.startswith("https://"):
                raise ValueError("Production Supabase connections require HTTPS")
            if not self.turnstile_secret_key and (
                not self.security_verification_url
                or not self.security_verification_url.startswith("https://")
            ):
                raise ValueError("Production requires an HTTPS security verification endpoint")
        return self

    @property
    def auth_issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"


@lru_cache
def load_settings() -> Settings:
    return Settings()
