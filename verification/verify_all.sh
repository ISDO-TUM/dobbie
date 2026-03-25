#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACTS_DIR="$SCRIPT_DIR/../contracts"
DATA_DIR="$SCRIPT_DIR/../data/process_mining"
OUTPUT_DIR="$SCRIPT_DIR/output"

mkdir -p "$OUTPUT_DIR"

echo "=== Step 1: Simulate Scenarios ==="
cd "$CONTRACTS_DIR"
npx hardhat run scripts/analysis/simulate-scenarios.ts
echo ""

echo "=== Step 2: Verify Simulated Data (Conformance + Violations) ==="
cd "$SCRIPT_DIR"
python3 verify_process.py \
  --gov-csv "$DATA_DIR/simulated_governance_log.csv" \
  --id-csv "$DATA_DIR/simulated_identity_log.csv" \
  --violations
echo ""

echo "=== Step 3: Generate Performance DFG ==="
python3 analyze_performance.py \
  --gov-csv "$DATA_DIR/simulated_governance_log.csv" \
  --output "$OUTPUT_DIR/simulated_performance.png"
echo ""

echo "=== Step 4: Verify Real Sepolia Data (if available) ==="
if [ -f "$DATA_DIR/governance_log.csv" ] && [ -f "$DATA_DIR/identity_log.csv" ]; then
  python3 verify_process.py \
    --gov-csv "$DATA_DIR/governance_log.csv" \
    --id-csv "$DATA_DIR/identity_log.csv"
  echo ""

  python3 analyze_performance.py \
    --gov-csv "$DATA_DIR/governance_log.csv" \
    --output "$OUTPUT_DIR/governance_performance.png"
else
  echo "Skipped: Real Sepolia CSVs not found at $DATA_DIR"
fi

echo ""
echo "=== (Optional) Generate per-scenario trace diagrams ==="
echo "Run manually:  python3 generate_diagrams.py --gov-csv $DATA_DIR/simulated_governance_log.csv --output-dir $OUTPUT_DIR --prefix simulated"

echo ""
echo "=== Verification Complete ==="
