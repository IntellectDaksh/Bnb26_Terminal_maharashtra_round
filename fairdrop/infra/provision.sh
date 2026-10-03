#!/usr/bin/env bash
# Run from your admin machine with doctl authenticated. Verify slugs: doctl compute size list
set -euo pipefail
: "${SSH_KEY_ID:?}" "${ADMIN_IP:?}"
R=blr1; CIDR=10.20.0.0/24
doctl vpc create --name fairdrop-vpc --region $R --ip-range $CIDR
VPC=$(doctl vpc list --format ID,Name --no-header | awk '$2=="fairdrop-vpc"{print $1}')
mk(){ doctl compute droplet create "$1" --region $R --size "$2" --image ubuntu-24-04-x64 --vpc-uuid "$VPC" \
      --ssh-keys "$SSH_KEY_ID" --tag-names "$3" --user-data-file infra/cloudinit.yaml --wait; }
mk fairdrop-target  s-4vcpu-8gb fairdrop-target
mk fairdrop-loadgen c-16        fairdrop-loadgen      # larger droplet = traffic generator
# Target: SSH from admin only; 443 only from loadgen (isolated test env). Redis 6379 only from loadgen (metrics).
doctl compute firewall create --name fd-target --tag-names fairdrop-target \
  --inbound-rules "protocol:tcp,ports:22,address:$ADMIN_IP/32 protocol:tcp,ports:443,tag:fairdrop-loadgen protocol:tcp,ports:6379,tag:fairdrop-loadgen" \
  --outbound-rules "protocol:tcp,ports:all,address:0.0.0.0/0 protocol:udp,ports:53,address:0.0.0.0/0"
# Loadgen: no public inbound except admin SSH. Outbound limited to the VPC (+DNS/80/443 for setup;
# tighten to VPC-only after setup_loadgen.sh so the generator can never hit external hosts).
doctl compute firewall create --name fd-loadgen --tag-names fairdrop-loadgen \
  --inbound-rules "protocol:tcp,ports:22,address:$ADMIN_IP/32" \
  --outbound-rules "protocol:tcp,ports:all,address:$CIDR protocol:udp,ports:53,address:0.0.0.0/0 protocol:tcp,ports:80,address:0.0.0.0/0 protocol:tcp,ports:443,address:0.0.0.0/0"
doctl compute droplet list --format Name,PrivateIPv4,PublicIPv4
