#!/usr/bin/env bash
# On the loadgen: source /etc/fairdrop/loadgen.env first (HOST, ADMIN_TOKEN, SIM_KEY, SIM_REDIS_URL, SSL_CERT_FILE).
# On the target start exactly one app first:  systemctl start fairdrop-fair   |   systemctl start fairdrop-fifo
set -euo pipefail
RUN=${1:?fair|fifo}; N=${WORKERS:-15}
mkdir -p results/$RUN && rm -f results/$RUN/*
H="X-Admin-Token: $ADMIN_TOKEN"
curl -fsS --cacert "$SSL_CERT_FILE" -X POST -H "$H" "$HOST/admin/reset" >/dev/null
( sleep "${WINDOW:-300}"; curl -fsS --cacert "$SSL_CERT_FILE" -X POST -H "$H" "$HOST/admin/close" >/dev/null ) &
RUN=$RUN WORKERS=$N locust -f sim/locustfile.py --headless --processes "$N" -u "${USERS:-3000}" -r "${RATE:-150}" \
  -t "${DURATION:-15m}" --host "$HOST" --csv "results/$RUN/locust" --only-summary
python3 sim/analyze.py "$RUN" --host "$HOST"
