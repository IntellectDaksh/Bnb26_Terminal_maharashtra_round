import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.post("/reserve")
def reserve():
    return {"ok": True}

client = TestClient(app)
response = client.post("/reserve", json={"admission_token": "foo"})
print(response.status_code)
