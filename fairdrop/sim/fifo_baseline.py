"""Unprotected FIFO baseline. Same API contract as the protected system. Run with ONE uvicorn worker."""
import os, secrets, threading
from fastapi import FastAPI, Header, HTTPException

SEATS = 500
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
lock = threading.Lock(); sess = {}; by_email = {}; seats = {}

def adm(t):
    if not t or t != os.environ["ADMIN_TOKEN"]: raise HTTPException(403)

def who(a):
    e = sess.get((a or "")[7:])
    if not e: raise HTTPException(401)
    return e

@app.post("/api/register")
def register(b: dict):
    e = b["email"].lower()
    with lock:
        ex = e in by_email
        if not ex: by_email[e] = secrets.token_hex(8)
        s = secrets.token_hex(8); sess[s] = e       # no dedupe, no challenge, no limits
    return {"session": s, "existing": ex}

@app.get("/api/queue/status")
def status(authorization: str = Header("")):
    who(authorization); return {"state": "admitted", "admission_token": "fifo"}

@app.post("/api/reserve")
def reserve(b: dict, authorization: str = Header("")):
    e = who(authorization)
    with lock:
        if e in seats: return {"reservation_id": e}
        if len(seats) >= SEATS: raise HTTPException(409, "sold_out")
        seats[e] = len(seats) + 1
    return {"reservation_id": e}

@app.post("/api/confirm")
def confirm(b: dict, authorization: str = Header("")):
    who(authorization); return {"ok": True}

@app.get("/admin/allocations")
def allocations(x_admin_token: str = Header("")):
    adm(x_admin_token); return [{"email": e, "seat": s} for e, s in seats.items()]

@app.post("/admin/close")
def close(x_admin_token: str = Header("")): adm(x_admin_token); return {"ok": True}

@app.post("/admin/reset")
def reset(x_admin_token: str = Header("")):
    adm(x_admin_token)
    with lock: sess.clear(); by_email.clear(); seats.clear()
    return {"ok": True}
