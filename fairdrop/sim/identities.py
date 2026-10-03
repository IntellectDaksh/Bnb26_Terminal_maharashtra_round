"""Generate 50,000 synthetic identities (.test domain, CGNAT IPs). Usage: python sim/identities.py [seed]"""
import hashlib, ipaddress, json, random, sys
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 1337
WINDOW = 300  # registration window (s) used for legit arrival times
rnd = random.Random(SEED)
BASE = int(ipaddress.IPv4Address("100.64.0.0"))
rows = []
def ip(n): return str(ipaddress.IPv4Address(BASE + n))
def fp(s): return hashlib.sha256(f"{SEED}:{s}".encode()).hexdigest()[:32]
for n in range(42_500):   # legit: unique ip/device, arrivals spread with an opening spike
    a = rnd.expovariate(1 / 40) if rnd.random() < .5 else rnd.uniform(0, WINDOW)
    rows.append(dict(role="legit", cluster=None, ip=ip(n), device_fp=fp(n), arrival=round(min(a, WINDOW), 2)))
for c in range(500):      # multi-account: 500 attackers x 10 accounts sharing ip+device
    for _ in range(10):
        rows.append(dict(role="multi", cluster=c, ip=ip(45_000 + c), device_fp=fp(f"c{c}"), arrival=round(rnd.uniform(0, 5), 2)))
n = 0
for role, cnt in (("speed", 1_500), ("flood", 500), ("dup", 500)):
    for _ in range(cnt):
        rows.append(dict(role=role, cluster=None, ip=ip(46_000 + n), device_fp=fp(f"b{n}"), arrival=0.0)); n += 1
assert len(rows) == 50_000
rnd.shuffle(rows)   # ids carry no role information
with open("data/identities.jsonl", "w") as f:
    for k, r in enumerate(rows):
        r["id"] = f"u{k:06d}"; r["email"] = f"{r['id']}@sim.fairdrop.test"
        f.write(json.dumps(r) + "\n")
print("wrote data/identities.jsonl", len(rows))
