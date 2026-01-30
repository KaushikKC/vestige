#!/usr/bin/env bash
# Fix Cargo.lock for Solana's Cargo 1.75: use lockfile v3 and constant_time_eq 0.3.1 (no edition2024)
set -e
cd "$(dirname "$0")/.."
LOCK=Cargo.lock
if [[ ! -f "$LOCK" ]]; then echo "No Cargo.lock"; exit 1; fi
# Downgrade lockfile version 4 -> 3
sed -i.bak 's/^version = 4$/version = 3/' "$LOCK"
# Pin constant_time_eq to 0.3.1: replace version on next line after name, then replace its unique checksum
sed -i.bak '/name = "constant_time_eq"/{n;s|version = "0.4.2"|version = "0.3.1"|;}' "$LOCK"
sed -i.bak 's|checksum = "3d52eff69cd5e647efe296129160853a42795992097e8af39800e1060caeea9b"|checksum = "7c74b8349d32d297c9134b8c88677813a227df8f779daa29bfc29c183fe3dca6"|' "$LOCK"
rm -f "${LOCK}.bak"
echo "Cargo.lock fixed for Solana Cargo 1.75"
