"""Locust scenarios: legit, speed bots, flood bots, duplicate-session bots, multi-account bots.
Env: RUN=fair|fifo  WORKERS=<processes>  SIM_KEY=<hmac key>  SSL_CERT_FILE=<ca.pem>"""
import collections, hmac, hashlib, json, os, random, secrets, time
import gevent
from locust import FastHttpUser, constant, events, task
from locust.exception import StopUser

RUN, W, KEY = os.getenv("RUN", "fair"), int(os.getenv("WORKERS", "1")), os.getenv("SIM_KEY", "").encode()
POLL_MAX = int(os.getenv("POLL_MAX", "100"))
POOL, T0, LOG = None, time.time(), None

@events.test_start.add_listener
def _start(environment, **kw):
    global T0; T0 = time.time()

@events.request.add_listener
def _log(name=None, response_time=0, response=None, context=None, **kw):
    global LOG
    if LOG is None:
        os.makedirs(f"results/{RUN}", exist_ok=True)
        LOG = open(f"results/{RUN}/req-{os.getpid()}.jsonl", "a", buffering=1)
    c = context or {}
    LOG.write(json.dumps({"t": time.time(), "role": c.get("role"), "id": c.get("id"), "n": name,
                          "s": getattr(response, "status_code", 0), "ms": round(response_time, 1)}) + "\n")

def _load(env):
    global POOL
    if POOL is not None: return
    idx = max(0, getattr(env.runner, "worker_index", 0) or 0)
    p, cl = collections.defaultdict(list), collections.defaultdict(list)
    for line in open("data/identities.jsonl"):
        i = json.loads(line)
        (cl[i["cluster"]] if i["role"] == "multi" else p[i["role"]]).append(i)
    p["multi"] = list(cl.values())
    p["legit"].sort(key=lambda i: i["arrival"])
    POOL = {k: collections.deque(v[idx::W]) for k, v in p.items()}

def take(env, role):
    _load(env); q = POOL.get(role); return q.popleft() if q else None

def tstoken():
    n = secrets.token_hex(8)
    return f"sim.{n}.{hmac.new(KEY, n.encode(), hashlib.sha256).hexdigest()}"

def js(r):
    try: return json.loads(r.text)
    except Exception: return {}

class Base(FastHttpUser):
    abstract = True
    wait_time = constant(0)
    insecure = False

    def call(self, i, name, method, path, tok=None, **kw):
        h = {"X-Sim-Client-IP": i["ip"]}
        if tok: h["Authorization"] = "Bearer " + tok
        with self.client.request(method, path, name=name, headers=h, catch_response=True,
                                 context={"role": i["role"], "id": i["id"]}, **kw) as r:
            r.failure("5xx") if (r.status_code >= 500 or r.status_code == 0) else r.success()
            return r

    def register(self, i, solved):
        r = self.call(i, "register", "POST", "/api/register", json={
            "email": i["email"], "device_fp": i["device_fp"], "turnstile_token": tstoken() if solved else ""})
        return js(r).get("session") if r.status_code in (200, 201) else None

    def attempt(self, i, tok, polls, lo, hi, polite):
        for _ in range(polls):
            gevent.sleep(random.uniform(lo, hi))
            r = self.call(i, "status", "GET", "/api/queue/status", tok)
            if r.status_code == 429 and polite:
                gevent.sleep(float(r.headers.get("Retry-After", 5))); continue
            d = js(r)
            if d.get("state") == "admitted":
                rv = self.call(i, "reserve", "POST", "/api/reserve", tok, json={"admission_token": d.get("admission_token", "")})
                if rv.status_code == 200:
                    self.call(i, "confirm", "POST", "/api/confirm", tok, json={"reservation_id": js(rv).get("reservation_id", "")})
                return
            if d.get("state") in ("sold_out", "closed", "rejected"): return

class Legit(Base):
    weight = 85
    @task
    def execute(self):
        i = take(self.environment, "legit")
        if not i: raise StopUser()
        gevent.sleep(max(0, T0 + i["arrival"] - time.time()))
        tok = None
        for _ in range(3):                      # a real user retries when told to wait
            tok = self.register(i, True)
            if tok: break
            gevent.sleep(random.uniform(3, 8))
        if tok: self.attempt(i, tok, POLL_MAX, 4, 8, True)

class Speed(Base):
    weight = 3
    @task
    def execute(self):
        i = take(self.environment, "speed")
        if not i: raise StopUser()
        tok = self.register(i, False)            # cannot pass the challenge
        for _ in range(40):
            self.call(i, "reserve", "POST", "/api/reserve", tok, json={"admission_token": "forged"})
            gevent.sleep(0.02)

class Flood(Base):
    weight = 1
    @task
    def execute(self):
        i = take(self.environment, "flood")
        if not i: raise StopUser()
        for _ in range(300):
            self.call(i, "status", "GET", "/api/queue/status")
            if random.random() < .2: self.register(i, False)

class Dup(Base):
    weight = 1
    @task
    def execute(self):
        i = take(self.environment, "dup")
        if not i: raise StopUser()
        def one():
            t = self.register(i, True)           # solver-farm assumption: tokens are valid
            if t: self.attempt(i, t, 40, .5, 1.5, False)
        gevent.joinall([gevent.spawn(one) for _ in range(5)])

class Multi(Base):
    weight = 10
    @task
    def execute(self):
        cl = take(self.environment, "multi")
        if not cl: raise StopUser()
        def one(i):
            t = self.register(i, True)
            if t: self.attempt(i, t, 40, .5, 1.5, False)
        gevent.joinall([gevent.spawn(one, i) for i in cl])
