# Fair Drop – SecOps/Sim (Dev 1)
Scope: Turnstile + Redis rate limiting, abuse middleware, DO infra (target + loadgen, private VPC),
50k synthetic identities, bot scenarios, FIFO baseline, metrics -> Dev 2 dashboard.
Stack: Python, FastAPI, Redis, Locust, DigitalOcean. Contract: README.md. Metrics schema: results/<run>/metrics.json.
Rules: test ONLY our own app inside the VPC. ENV=test shortcuts must stay inert in prod.
Token rules: read only files named in the task; output diffs or changed files only; no web research;
no restating the context; end every task by appending <=10 lines to HANDOFF.md (done / open / next).
