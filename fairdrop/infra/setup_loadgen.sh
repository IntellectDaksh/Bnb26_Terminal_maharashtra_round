#!/usr/bin/env bash
# Run as root on fairdrop-loadgen.
set -euo pipefail
mkdir -p /opt/sim /etc/fairdrop
python3 -m venv /opt/sim/venv && /opt/sim/venv/bin/pip install -q locust redis
cat >>/etc/security/limits.conf <<EOF
* soft nofile 200000
* hard nofile 200000
EOF
cat >/etc/sysctl.d/99-loadgen.conf <<EOF
net.ipv4.ip_local_port_range=1024 65535
net.core.somaxconn=4096
net.ipv4.tcp_tw_reuse=1
fs.file-max=500000
EOF
sysctl --system >/dev/null
echo "Place repo in /opt/sim, run: python sim/identities.py ; set -a; . /etc/fairdrop/loadgen.env; set +a; bash sim/run_sim.sh fair; bash sim/run_sim.sh fifo; python sim/analyze.py --report fair fifo"
