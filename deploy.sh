#!/usr/bin/env bash
# Run on the server as root: pull, build, restart.
set -euo pipefail
cd /opt/catalogue
git pull --ff-only
npm ci
npm run build
systemctl restart catalogue
systemctl --no-pager status catalogue | head -5
