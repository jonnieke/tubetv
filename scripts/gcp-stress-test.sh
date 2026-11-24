#!/usr/bin/env bash
set -euo pipefail

VM_NAME="tubetv-loadtest-$(date +%s)"
ZONE="africa-south1-a"
RAW_K6_URL="https://raw.githubusercontent.com/jonnieke/tubetv/main/scripts/k6-load-test.js"

cleanup() {
  echo ""
  echo ">>> Cleaning up temporary VM ($VM_NAME) so your GCP credits stop billing..."
  gcloud compute instances delete "$VM_NAME" --zone="$ZONE" --quiet >/dev/null 2>&1 || true
  echo ">>> Done! VM deleted."
}
trap cleanup EXIT

echo ">>> 1/4 Enabling Compute Engine API (if needed)..."
gcloud services enable compute.googleapis.com --quiet

echo ">>> 2/4 Creating temporary Spot VM ($VM_NAME) in Johannesburg ($ZONE)..."
gcloud compute instances create "$VM_NAME" \
  --zone="$ZONE" \
  --machine-type=e2-standard-4 \
  --provisioning-model=SPOT \
  --instance-termination-action=DELETE \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --quiet

echo ">>> Waiting 25s for SSH to come online..."
sleep 25

echo ">>> 3/4 Installing k6 and running 2,500-viewer stress test against https://www.tube.co.ke ..."
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --quiet --command="
  set -e
  sudo apt-get update -qq
  sudo apt-get install -y -qq gnupg ca-certificates curl
  curl -fsSL https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
  echo 'deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main' | sudo tee /etc/apt/sources.list.d/k6.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq k6
  curl -fsSL '$RAW_K6_URL' -o k6-load-test.js
  echo '=== STARTING STRESS TEST (200 -> 1,000 -> 2,500 CONCURRENT VIEWERS) ==='
  k6 run k6-load-test.js
"

echo ">>> 4/4 Stress test finished!"
