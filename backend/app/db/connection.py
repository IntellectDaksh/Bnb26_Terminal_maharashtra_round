import ssl

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from app.core.config import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    tls = ssl.create_default_context() if settings.database_ssl else False
    if tls and settings.database_ssl_ca_file:
        tls.load_verify_locations(cafile=settings.database_ssl_ca_file)
    return create_async_engine(
        settings.database_url.get_secret_value(),
        pool_pre_ping=True,
        pool_size=settings.database_pool_size,
        max_overflow=0,
        connect_args={
            "ssl": tls,
            "server_settings": {
                "timezone": "UTC",
                "statement_timeout": "30000",
                "lock_timeout": "10000",
                "application_name": "fairdrop",
            },
        },
    )


def session_factory(engine: AsyncEngine) -> async_sessionmaker:
    return async_sessionmaker(engine, expire_on_commit=False)
