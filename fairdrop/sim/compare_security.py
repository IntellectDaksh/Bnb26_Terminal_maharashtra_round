"""Run matched baseline/protected workloads and preserve every underlying report."""

import argparse
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

LOCAL = Path(__file__).resolve().parents[1]


def measurements(directory):
    report = json.loads((directory / "metrics.json").read_text())
    human = report["roles"]["legit"]
    bots = [v for role, v in report["roles"].items() if role != "legit"]
    tickets = report["database_checks"]["tickets_by_role"]
    total = report["database_checks"]["confirmed_tickets"]
    return {
        "valid_challenge_bots_registered": sum(
            report["roles"][role]["registration_identities_accepted"]
            for role in ("dup", "flood", "multi")
        ),
        "bot_registration_pct": round(
            100
            * sum(b["registration_identities_accepted"] for b in bots)
            / sum(b["registration_identities_attempted"] for b in bots),
            2,
        ),
        "multi_registration_pct": report["roles"]["multi"]["registration_accept_pct"],
        "attacker_tickets": sum(v for role, v in tickets.items() if role != "legit"),
        "attacker_ticket_share_pct": round(
            100 * sum(v for role, v in tickets.items() if role != "legit") / total, 2
        ),
        "human_success_pct": human["registration_accept_pct"],
        "human_p95_ms": human["p95_ms"],
        "human_registration_p95_ms": human.get("registration_p95_ms"),
        "errors": sum(
            v["server_or_transport_errors"] for v in report["roles"].values()
        ),
        "flood_block_pct": report["roles"]["flood"]["request_block_pct"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--redis-url", required=True)
    args = parser.parse_args()
    output = (
        LOCAL / "results" / f"comparison-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
    )
    output.mkdir()
    runs = []
    for concurrency, seconds in [(25, 0), (50, 0), (100, 0), (50, 30)]:
        for protected in [False, True]:
            label = (
                f"c{concurrency}-s{seconds}-{'protected' if protected else 'baseline'}"
            )
            print(f"Running {label}", flush=True)
            before = set(LOCAL.glob("results/local-*/metrics.json"))
            command = [
                sys.executable,
                str(LOCAL / "sim/local_benchmark.py"),
                "--concurrency",
                str(concurrency),
                "--sustained-seconds",
                str(seconds),
            ]
            if protected:
                command += ["--redis-url", args.redis_url]
            with (output / f"{label}.log").open("w", encoding="utf-8") as log:
                subprocess.run(
                    command, stdout=log, stderr=subprocess.STDOUT, check=True
                )
            created = set(LOCAL.glob("results/local-*/metrics.json")) - before
            if len(created) != 1:
                raise RuntimeError("Expected exactly one new benchmark report")
            directory = created.pop().parent
            row = {
                "label": label,
                "concurrency": concurrency,
                "sustained_seconds": seconds,
                "protected": protected,
                "report": directory.name,
                **measurements(directory),
            }
            runs.append(row)
            print(json.dumps(row), flush=True)
            (output / "metrics.json").write_text(
                json.dumps(runs, indent=2), encoding="utf-8"
            )
    original = LOCAL / "results/local-20261003T213733Z"
    lines = [
        "# Redis abuse protection: before and after",
        "",
        (
            "The original saved baseline is unchanged. Matched reruns use the same identities, seed, "
            "1,000 humans, 200-ticket capacity, one API worker and five database connections. "
            "All clients share localhost; humans have distinct device IDs. Redis is real; "
            "Siteverify decisions remain simulated."
        ),
        "",
        "| Workload | Guard | Bot registration % | Multi-account registration % | Attacker tickets / 200 | Attacker share % | Human success % | Human p95 ms | Human registration p95 ms | Errors |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    if original.exists():
        runs.insert(
            0,
            {
                "label": "original baseline",
                "protected": False,
                "report": original.name,
                **measurements(original),
            },
        )
    for r in runs:
        lines.append(
            f"| [{r['label']}](../{r['report']}/report.md) | {'on' if r['protected'] else 'off'} | "
            f"{r['bot_registration_pct']} | {r['multi_registration_pct']} | {r['attacker_tickets']} | "
            f"{r['attacker_ticket_share_pct']} | {r['human_success_pct']} | {r['human_p95_ms']} | "
            f"{r['human_registration_p95_ms'] or 'not recorded'} | {r['errors']} |"
        )
    lines += [
        "",
        (
            "Flood and duplicate accounts with distinct devices can still register. The guard limits "
            "their request volume and reduces accounts from repeated devices; it does not classify "
            "every solved-challenge bot as an attacker."
        ),
        "",
        (
            "Ticket draws are randomized. A single draw is descriptive, not proof of a statistically "
            "stable ticket-share improvement. Bot registration includes duplicate, flood, multi-account, "
            "forged-challenge and unauthenticated identities; multi-account success is shown separately."
        ),
        "",
        (
            "The sustained case polls each flood account every 50 ms for 30 seconds. Its request "
            "count varies because this is a closed-loop client. Latencies exclude client semaphore "
            "waiting; API, PostgreSQL and generator share one Windows host, with Redis in WSL."
        ),
        "",
        (
            "Remaining limits: browser device IDs can be cleared or forged; attackers rotating both "
            "device and account can evade these controls. Shared-device households may hit the cap. "
            "Unauthenticated floods and broad attacks on public catalog endpoints still need edge "
            "traffic controls. Real widget completion and production capacity are not measured."
        ),
        "",
        (
            "A separate [live Siteverify smoke check](../turnstile-live-smoke.json) used "
            "[Cloudflare's official test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). "
            "It checked real HTTPS success/failure/spent-token responses and backend rejection behavior. "
            "The dummy success lacks the required register action, so production widget acceptance "
            "remains unverified."
        ),
    ]
    (output / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Comparison: {output / 'report.md'}", flush=True)


if __name__ == "__main__":
    main()
