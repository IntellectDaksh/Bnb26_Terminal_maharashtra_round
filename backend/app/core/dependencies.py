from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User, require_admin
from app.core.errors import AppError

bearer = HTTPBearer(auto_error=False)


async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessions() as db:
        yield db


async def get_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if credentials is None:
        raise AppError(401, "authentication_required", "Sign in to continue.")
    return await request.app.state.tokens.verify_access_token(credentials.credentials)


async def get_admin(request: Request, user: Annotated[User, Depends(get_user)]) -> User:
    # Separate session so authorization reads do not open the service's transaction.
    async with request.app.state.sessions() as db:
        return await require_admin(user, db)


DB = Annotated[AsyncSession, Depends(get_db_session)]
AuthenticatedUser = Annotated[User, Depends(get_user)]
AdminUser = Annotated[User, Depends(get_admin)]
