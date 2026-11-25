#!/usr/bin/env bash
# Megalodon · todas las pruebas: compilación al día, motor y e2e con axe.
set -euo pipefail
cd "$(dirname "$0")"
node scripts/build.mjs --check
node --test tests/engine.test.mjs
node tests/e2e.mjs
