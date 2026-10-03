#!/usr/bin/env bash
# Run as root on fairdrop-target:  LOADGEN_PRIV=10.20.0.x bash infra/setup_target.sh
set -euo pipefail
: "${LOADGEN_PRIV:?}"
PRIV=$(curl -s http://169.254.169.254/metadata/v1/interfaces/private/0/ipv4/address)
apt-get install -y redis-server nginx openssl
mkdir -p /etc/fairdrop/tls; cd /etc/fairdrop/tls
openssl req -x509 -newkey rsa:4096 -nodes -days 30 -keyout key.pem -out cert.pem -subj "/CN=fairdrop-test" \
  -addext "subjectAltName=IP:$PRIV,IP:127.0.0.1"
chgrp redis key.pem; chmod 640 key.pem
r(){ openssl rand -hex 32; }
APP_PW=$(r); SIM_PW=$(r)
cat >/etc/fairdrop.env <<EOF
ENV=test
REDIS_URL=rediss://app:$APP_PW@127.0.0.1:6379/0?ssl_ca_certs=/etc/fairdrop/tls/cert.pem
HMAC_KEY=$(r)
ID_PEPPER=$(r)
PII_KEYS=$(openssl rand -base64 32 | tr '+/' '-_')
SIM_KEY=$(r)
SIM_TRUSTED_SOURCE=$LOADGEN_PRIV
TRUSTED_PROXY_HOPS=1
ADMIN_TOKEN=$(r)
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
EOF
chmod 600 /etc/fairdrop.env
# values the loadgen needs (copy to /etc/fairdrop/loadgen.env on the generator via scp, then delete here)
set -a; . /etc/fairdrop.env; set +a
cat >/etc/fairdrop/loadgen.env <<EOF
HOST=https://$PRIV
SSL_CERT_FILE=/etc/fairdrop/tls/cert.pem
ADMIN_TOKEN=$ADMIN_TOKEN
SIM_KEY=$SIM_KEY
SIM_REDIS_URL=rediss://sim:$SIM_PW@$PRIV:6379/0?ssl_ca_certs=/etc/fairdrop/tls/cert.pem
EOF
chmod 600 /etc/fairdrop/loadgen.env
cat >>/etc/redis/redis.conf <<EOF
bind 127.0.0.1 $PRIV
protected-mode yes
port 0
tls-port 6379
tls-cert-file /etc/fairdrop/tls/cert.pem
tls-key-file /etc/fairdrop/tls/key.pem
tls-ca-cert-file /etc/fairdrop/tls/cert.pem
tls-auth-clients no
user default off
user app on >$APP_PW ~* &* +@all -@dangerous
user sim on >$SIM_PW ~metrics:* &metrics:* +set +get +hset +publish
appendonly yes
maxmemory 2gb
maxmemory-policy noeviction
EOF
cat >/etc/nginx/conf.d/fairdrop.conf <<EOF
server {
  listen 443 ssl; server_name _; server_tokens off; client_max_body_size 16k;
  ssl_certificate /etc/fairdrop/tls/cert.pem; ssl_certificate_key /etc/fairdrop/tls/key.pem;
  ssl_protocols TLSv1.3 TLSv1.2;
  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$remote_addr;   # overwrite: client cannot spoof
  }
}
EOF
rm -f /etc/nginx/sites-enabled/default
for n in fair fifo; do
  other=$([ $n = fair ] && echo fifo || echo fair)
  mod=$([ $n = fair ] && echo app_example || echo sim.fifo_baseline)
  cat >/etc/systemd/system/fairdrop-$n.service <<EOF
[Unit]
Description=Fair Drop ($n)
Conflicts=fairdrop-$other.service
After=network.target redis-server.service
[Service]
User=fairdrop
WorkingDirectory=/opt/fairdrop
EnvironmentFile=/etc/fairdrop.env
ExecStart=/opt/fairdrop/venv/bin/uvicorn $mod:app --host 127.0.0.1 --port 8000 --workers $([ $n = fair ] && echo 4 || echo 1)
NoNewPrivileges=yes
ProtectSystem=strict
PrivateTmp=yes
EOF
done
id fairdrop &>/dev/null || useradd -r -s /usr/sbin/nologin fairdrop
mkdir -p /opt/fairdrop && python3 -m venv /opt/fairdrop/venv
echo "Copy repo to /opt/fairdrop, pip install -r requirements.txt in the venv, then: systemctl daemon-reload && systemctl restart redis-server nginx"
echo "Then: scp /etc/fairdrop/loadgen.env /etc/fairdrop/tls/cert.pem to loadgen:/etc/fairdrop/ and shred loadgen.env here."
