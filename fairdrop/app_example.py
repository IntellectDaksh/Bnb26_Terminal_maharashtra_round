"""Integration reference for backend dev. Admin routes here are stubs; seat logic belongs to the reservation engine."""
import os
import redis.asyncio as redis
from fastapi import Depends, FastAPI, Header, HTTPException
from security.middleware import Guard, guard_registration, issue_session, require_session
from security.ratelimit import Limiter

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
r = app.state.redis = redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
app.add_middleware(Guard, limiter=Limiter(r))

def admin(x_admin_token: str = Header("")):
    if not x_admin_token or x_admin_token != os.environ["ADMIN_TOKEN"]:
        raise HTTPException(403)

@app.post("/api/register")
async def register(g: dict = Depends(guard_registration)):
    # TODO(backend): if not g["existing"], insert user row with encrypt_pii(email)
    return {"session": issue_session(g["uid"]), "existing": g["existing"]}

@app.get("/api/queue/status")
async def status(uid: str = Depends(require_session)):
    return {"state": "waiting"}   # TODO(queue engine): waiting|admitted(+admission_token via issue_admission)|closed|sold_out

@app.post("/admin/close", dependencies=[Depends(admin)])
async def close():
    await r.set("reg:closed", 1); return {"ok": True}

@app.post("/admin/reset", dependencies=[Depends(admin)])
async def reset():
    async for k in r.scan_iter(match="*", count=1000):
        await r.delete(k)
    return {"ok": True}
