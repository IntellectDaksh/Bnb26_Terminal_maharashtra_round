# Redis abuse protection: before and after

The original saved baseline is unchanged. Matched reruns use the same identities, seed, 1,000 humans, 200-ticket capacity, one API worker and five database connections. All clients share localhost; humans have distinct device IDs. Redis is real; Siteverify decisions remain simulated.

| Workload | Guard | Bot registration % | Multi-account registration % | Attacker tickets / 200 | Attacker share % | Human success % | Human p95 ms | Human registration p95 ms | Errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [original baseline](../local-20261003T213733Z/report.md) | off | 66.67 | 100.0 | 22 | 11.0 | 100.0 | 991.36 | not recorded | 0 |
| [c25-s0-baseline](../local-20261003T215930Z/report.md) | off | 66.67 | 100.0 | 25 | 12.5 | 100.0 | 367.0 | 423.89 | 0 |
| [c25-s0-protected](../local-20261003T215957Z/report.md) | on | 22.22 | 20.0 | 3 | 1.5 | 100.0 | 423.58 | 376.35 | 0 |
| [c50-s0-baseline](../local-20261003T220027Z/report.md) | off | 66.67 | 100.0 | 24 | 12.0 | 100.0 | 1031.39 | 1162.83 | 0 |
| [c50-s0-protected](../local-20261003T220056Z/report.md) | on | 22.22 | 20.0 | 8 | 4.0 | 100.0 | 883.7 | 975.09 | 0 |
| [c100-s0-baseline](../local-20261003T220128Z/report.md) | off | 66.67 | 100.0 | 19 | 9.5 | 100.0 | 2198.36 | 2273.2 | 0 |
| [c100-s0-protected](../local-20261003T220201Z/report.md) | on | 22.22 | 20.0 | 11 | 5.5 | 100.0 | 2100.61 | 2136.04 | 0 |
| [c50-s30-baseline](../local-20261003T220249Z/report.md) | off | 66.67 | 100.0 | 26 | 13.0 | 100.0 | 912.56 | 1029.97 | 0 |
| [c50-s30-protected](../local-20261003T220335Z/report.md) | on | 22.22 | 20.0 | 8 | 4.0 | 100.0 | 906.01 | 1093.01 | 0 |

Ticket draws are randomized. A single draw is descriptive, not proof of a statistically stable ticket-share improvement. Bot registration includes duplicate, flood, multi-account, forged-challenge and unauthenticated identities; multi-account success is shown separately.

The sustained case polls each flood account every 50 ms for 30 seconds. Its request count varies because this is a closed-loop client. Latencies exclude client semaphore waiting; API, PostgreSQL and generator share one Windows host, with Redis in WSL.

Remaining limits: browser device IDs can be cleared or forged; attackers rotating both device and account can evade these controls. Shared-device households may hit the cap. Unauthenticated floods and broad attacks on public catalog endpoints still need edge traffic controls. Real widget completion and production capacity are not measured.

Valid-authentication, solved-challenge bots registered 120/120 accounts in each baseline and 40/120 in each protected run. The remaining 40 comprise 20 multi-account identities, 10 flood identities and 10 duplicate-retry identities. Bots using distinct device identities can still enter the draw.

The sustained protected run throttled 97.16% of flood requests. All eight matched runs registered 1,000/1,000 humans and had zero server/network errors. At concurrency 25, overall human p95 increased despite improved registration p95; at concurrency 50/100, both burst latency measures improved. In the sustained pair, registration p95 increased from 1,029.97 to 1,093.01 ms. These are finite local observations, not a guarantee of lower latency.

A separate [live Siteverify smoke check](../turnstile-live-smoke.json) used [Cloudflare's official test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). It checked real HTTPS success/failure/spent-token responses and backend rejection behavior. The dummy success lacks the required register action, so successful production widget completion remains unverified.
