#!/usr/bin/env python3
"""python sim/analyze.py RUN [--host URL]   |   python sim/analyze.py --report fair fifo"""
import argparse, collections, glob, json, os, ssl, time, urllib.request

def pct(a, p):
    a = sorted(a); return round(a[min(len(a) - 1, int(len(a) * p))], 1) if a else None
def jain(x):
    s, q = sum(x), sum(v * v for v in x); return round(s * s / (len(x) * q), 4) if q else 1.0

def analyze(run, host):
    d = f"results/{run}"
    ids = {i["id"]: i for i in map(json.loads, open("data/identities.jsonl"))}
    rows = [json.loads(l) for f in glob.glob(f"{d}/req-*.jsonl") for l in open(f)]
    if host:
        req = urllib.request.Request(host + "/admin/allocations", headers={"X-Admin-Token": os.environ["ADMIN_TOKEN"]})
        ctx = ssl.create_default_context(cafile=os.getenv("SSL_CERT_FILE"))
        open(f"{d}/alloc.json", "wb").write(urllib.request.urlopen(req, context=ctx, timeout=30).read())
    alloc = json.load(open(f"{d}/alloc.json"))
    won = {a.get("id") or a["email"].split("@")[0] for a in alloc}
    leg = [r for r in rows if r["role"] == "legit"]
    att = [r for r in rows if r["role"] != "legit"]
    ts = [r["t"] for r in rows]; dur = (max(ts) - min(ts)) or 1
    ok = lambda r: 200 <= r["s"] < 300
    rejected = sum(1 for r in leg if r["s"] in (403, 429, 0) or r["s"] >= 500)
    tried = {r["id"] for r in leg}
    registered = {r["id"] for r in leg if r["n"] == "register" and r["s"] in (200, 201)}
    seats = collections.Counter(ids[w]["role"] for w in won if w in ids)
    total = len(won)
    cl = collections.Counter(ids[w]["cluster"] for w in won if w in ids and ids[w]["role"] == "multi")
    # fairness: legit win rate per arrival decile (ideal random queue -> flat, Jain ~1)
    L = sorted((ids[i] for i in tried), key=lambda i: i["arrival"]); k = max(1, len(L) // 10)
    dec = [sum(1 for i in L[j * k:(j + 1) * k] if i["id"] in won) / max(1, len(L[j * k:(j + 1) * k])) for j in range(10)]
    lw = seats.get("legit", 0) / max(1, len(tried))
    m = {"run": run, "ts": int(time.time()), "seats_allocated": total,
         "latency_ms_legit": {"p50": pct([r["ms"] for r in leg], .5), "p95": pct([r["ms"] for r in leg], .95), "p99": pct([r["ms"] for r in leg], .99)},
         "throughput_rps": round(len(rows) / dur, 1), "accepted_rps": round(sum(map(ok, rows)) / dur, 1),
         "legit_request_rejection_rate": round(rejected / max(1, len(leg)), 4),
         "legit_unregistered_rate": round(len(tried - registered) / max(1, len(tried)), 4),
         "legit_win_rate": round(lw, 4), "legit_decile_win_rates": [round(x, 4) for x in dec],
         "fairness_jain_deciles": jain(dec), "early_decile_advantage": round(dec[0] / lw, 2) if lw else None,
         "seats_by_role": dict(seats), "attacker_seat_share": round((total - seats.get("legit", 0)) / max(1, total), 4),
         "multi_clusters_with_extra_seats": sum(1 for c in cl.values() if c > 1),
         "multi_extra_seats": sum(c - 1 for c in cl.values() if c > 1),
         "attacker_requests": len(att), "attacker_request_accept_rate": round(sum(map(ok, att)) / max(1, len(att)), 4)}
    json.dump(m, open(f"{d}/metrics.json", "w"), indent=1)
    if os.getenv("SIM_REDIS_URL"):                      # feed Developer 2's dashboard
        import redis
        r = redis.from_url(os.environ["SIM_REDIS_URL"]); s = json.dumps(m)
        r.set(f"metrics:{run}", s); r.set("metrics:latest", s); r.publish("metrics:feed", s)
    print(json.dumps(m, indent=1))

def report(a, b):
    A, B = (json.load(open(f"results/{x}/metrics.json")) for x in (a, b))
    flat = lambda m: {**{k: v for k, v in m.items() if not isinstance(v, (dict, list))},
                      **{f"latency_{k}": v for k, v in m["latency_ms_legit"].items()}}
    FA, FB = flat(A), flat(B)
    out = [f"# Fair Drop simulation report\n\n| metric | {a} | {b} |\n|---|---|---|"]
    out += [f"| {k} | {FA[k]} | {FB.get(k)} |" for k in FA if k not in ("run", "ts")]
    out += [f"\nSeats by role: {a}={A['seats_by_role']} {b}={B['seats_by_role']}",
            f"Legit win rate by arrival decile: {a}={A['legit_decile_win_rates']} {b}={B['legit_decile_win_rates']}"]
    open("results/report.md", "w").write("\n".join(out)); print("\n".join(out))

if __name__ == "__main__":
    p = argparse.ArgumentParser(); p.add_argument("runs", nargs="*"); p.add_argument("--host"); p.add_argument("--report", action="store_true")
    a = p.parse_args()
    report(*a.runs[:2]) if a.report else analyze(a.runs[0], a.host)
