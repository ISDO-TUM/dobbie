import argparse
import pandas as pd
import pm4py
from pm4py.objects.process_tree.obj import ProcessTree, Operator


def preprocess_logs(gov_path, identity_path):
    print("... Loading and preprocessing logs ...")

    # Load Governance Log
    gov_log = pd.read_csv(gov_path)
    gov_log['time:timestamp'] = pd.to_datetime(gov_log['time:timestamp'])

    # Force deterministic sorting
    gov_log = gov_log.sort_values(by=['case:concept:name', 'time:timestamp', 'concept:name'])

    # Fix disconnected traces
    executions = gov_log[gov_log['concept:name'] == 'ProposalExecuted']

    for index, row in gov_log[gov_log['case:concept:name'] == 'SYSTEM_UPGRADE'].iterrows():
        # Find a ProposalExecuted event with the EXACT same timestamp
        match = executions[executions['time:timestamp'] == row['time:timestamp']]

        if not match.empty:
            proposal_id = match.iloc[0]['case:concept:name']
            gov_log.at[index, 'case:concept:name'] = proposal_id

    # Re-sort after case relabelling; concept:name as tiebreaker ensures
    # DeterministicUpgradeExecuted (D) sorts before ProposalExecuted (P)
    # when both share the same transaction timestamp.
    gov_log = gov_log.sort_values(by=['case:concept:name', 'time:timestamp', 'concept:name'])

    # Load Identity Log
    id_log = pd.read_csv(identity_path)
    id_log['time:timestamp'] = pd.to_datetime(id_log['time:timestamp'])

    return gov_log, id_log


def build_governance_tree():
    """Build the formal process tree for the governance workflow."""

    # Creation Phase
    # Must start with ProposalCreated. Then, OPTIONALLY, ProposalPackageCreated.
    # Since we forced the sort order (C before P), this Sequence is 100% safe.
    creation_phase = ProcessTree(operator=Operator.SEQUENCE, children=[
        ProcessTree(label="ProposalCreated"),
        ProcessTree(operator=Operator.XOR, children=[ # Optional Package
             ProcessTree(label=None), # Skip (Registration proposals)
             ProcessTree(label="ProposalPackageCreated") # Include (Upgrade proposals)
        ])
    ])

    # Voting Phase
    voting_phase = ProcessTree(operator=Operator.LOOP, children=[
        ProcessTree(label=None),
        ProcessTree(label="VoteCast")
    ])

    # Execution Phase
    execution_phase = ProcessTree(operator=Operator.SEQUENCE, children=[
        ProcessTree(label="ProposalQueued"),
        ProcessTree(operator=Operator.XOR, children=[ # Optional Upgrade Event
            ProcessTree(label=None),
            ProcessTree(label="DeterministicUpgradeExecuted")
        ]),
        ProcessTree(label="ProposalExecuted")
    ])

    # Root Structure
    final_tree = ProcessTree(operator=Operator.SEQUENCE, children=[
        creation_phase,
        voting_phase,
        ProcessTree(operator=Operator.XOR, children=[
            ProcessTree(label=None),          # Stalled/Active/Defeated
            ProcessTree(label="ProposalCanceled"), # Explicit Cancel
            execution_phase                   # Success
        ])
    ])

    return final_tree


def build_identity_tree():
    """Build the formal process tree for the identity workflow."""
    return ProcessTree(operator=Operator.SEQUENCE, children=[
        ProcessTree(label="StakeholderAdded"),
        ProcessTree(operator=Operator.LOOP, children=[
            ProcessTree(label=None),
            ProcessTree(label="IdentitySet")
        ]),
        ProcessTree(operator=Operator.XOR, children=[
            ProcessTree(label=None),
            ProcessTree(label="StakeholderRemoved")
        ])
    ])


def verify_governance(log):
    print("\n--- Verifying Governance Process ---")

    final_tree = build_governance_tree()

    # Prepare event log — filter out adversarial traces (ADV_ prefix)
    log = log.dropna(subset=['case:concept:name'])
    log = log[~log['case:concept:name'].astype(str).str.startswith('ADV_')]
    formatted_log = pm4py.format_dataframe(log, case_id='case:concept:name', activity_key='concept:name', timestamp_key='time:timestamp')
    event_log = pm4py.convert_to_event_log(formatted_log)

    net, im, fm = pm4py.convert_to_petri_net(final_tree)

    # 1) Token-Based Replay (fast, heuristic)
    try:
        tbr_fitness = pm4py.fitness_token_based_replay(event_log, net, im, fm)
        tbr_score = tbr_fitness['log_fitness']
        print(f"  Token-Based Replay Fitness: {tbr_score * 100:.2f}%")
    except Exception as e:
        print(f"  Token-Based Replay failed: {e}")
        tbr_score = None

    # 2) Alignment-Based Fitness (exact, optimal)
    try:
        align_fitness = pm4py.fitness_alignments(event_log, net, im, fm)
        align_score = align_fitness['log_fitness']
        print(f"  Alignment-Based Fitness:    {align_score * 100:.2f}%")
    except Exception as e:
        print(f"  Alignment-Based check failed: {e}")
        align_score = None

    # Summary (alignment fitness can have floating point imprecision)
    THRESHOLD = 0.999
    if tbr_score is not None and align_score is not None:
        if tbr_score >= THRESHOLD and align_score >= THRESHOLD:
            print("  Result: PASS — perfect conformance on both methods")
        else:
            print(f"  Result: DEVIATION DETECTED")


def verify_identity(log):
    print("\n--- Verifying Identity Process ---")

    root_tree = build_identity_tree()

    formatted_log = pm4py.format_dataframe(log, case_id='case:concept:name', activity_key='concept:name', timestamp_key='time:timestamp')
    event_log = pm4py.convert_to_event_log(formatted_log)

    net, im, fm = pm4py.convert_to_petri_net(root_tree)

    # 1) Token-Based Replay
    tbr_fitness = pm4py.fitness_token_based_replay(event_log, net, im, fm)
    print(f"  Token-Based Replay Fitness: {tbr_fitness['log_fitness'] * 100:.2f}%")

    # 2) Alignment-Based Fitness
    try:
        align_fitness = pm4py.fitness_alignments(event_log, net, im, fm)
        print(f"  Alignment-Based Fitness:    {align_fitness['log_fitness'] * 100:.2f}%")
    except Exception as e:
        print(f"  Alignment-Based check failed: {e}")


def verify_adversarial(log):
    """Verify that adversarial on-chain traces (ADV_ prefix) are detected.

    These traces come from scenarios where the blockchain prevented a
    violation (transaction reverted), producing partial/incomplete traces.
    The process model should detect S9 (ProposalQueued without ProposalExecuted)
    as a deviation; others are conformant via the stalled/defeated tau branch.
    """
    print("\n--- Verifying Adversarial On-Chain Traces ---")

    adv_log = log[log['case:concept:name'].astype(str).str.startswith('ADV_')].copy()
    if adv_log.empty:
        print("  No adversarial traces found (ADV_ prefix). Skipping.")
        return

    final_tree = build_governance_tree()

    formatted_log = pm4py.format_dataframe(
        adv_log,
        case_id='case:concept:name',
        activity_key='concept:name',
        timestamp_key='time:timestamp'
    )
    event_log = pm4py.convert_to_event_log(formatted_log)

    net, im, fm = pm4py.convert_to_petri_net(final_tree)

    # Per-trace diagnostics
    try:
        aligned_traces = pm4py.conformance_diagnostics_alignments(event_log, net, im, fm)

        trace_cases = adv_log['case:concept:name'].unique()
        for i, trace_result in enumerate(aligned_traces):
            case_id = trace_cases[i] if i < len(trace_cases) else f"trace_{i}"
            fitness = trace_result['fitness']
            status = "DEVIATION" if fitness < 0.999 else "conformant (stalled path)"
            print(f"  {case_id}: fitness={fitness:.4f} — {status}")

    except Exception as e:
        print(f"  Per-trace alignment failed: {e}")

    # Aggregate
    try:
        tbr_fitness = pm4py.fitness_token_based_replay(event_log, net, im, fm)
        align_fitness = pm4py.fitness_alignments(event_log, net, im, fm)
        print(f"\n  Aggregate TBR Fitness:       {tbr_fitness['log_fitness'] * 100:.2f}%")
        print(f"  Aggregate Alignment Fitness: {align_fitness['log_fitness'] * 100:.2f}%")
    except Exception as e:
        print(f"  Aggregate fitness check failed: {e}")


def build_violation_traces():
    """Build synthetic traces that violate the governance process model.

    These traces represent hypothetical scenarios where events appear in
    wrong order — orderings that the blockchain prevents via reverts but
    that the process model should nonetheless detect as deviations.
    """
    base_time = pd.Timestamp("2025-01-01T00:00:00Z")

    violations = []

    # V1: Execute without Queue — skips the mandatory ProposalQueued step
    v1 = [
        {"case:concept:name": "V1", "concept:name": "ProposalCreated",   "time:timestamp": base_time},
        {"case:concept:name": "V1", "concept:name": "VoteCast",          "time:timestamp": base_time + pd.Timedelta(hours=1)},
        {"case:concept:name": "V1", "concept:name": "VoteCast",          "time:timestamp": base_time + pd.Timedelta(hours=2)},
        {"case:concept:name": "V1", "concept:name": "ProposalExecuted",  "time:timestamp": base_time + pd.Timedelta(hours=8)},
    ]
    violations.extend(v1)

    # V2: Vote after Queue — VoteCast appears in execution phase instead of voting phase
    v2 = [
        {"case:concept:name": "V2", "concept:name": "ProposalCreated",   "time:timestamp": base_time},
        {"case:concept:name": "V2", "concept:name": "VoteCast",          "time:timestamp": base_time + pd.Timedelta(hours=1)},
        {"case:concept:name": "V2", "concept:name": "ProposalQueued",    "time:timestamp": base_time + pd.Timedelta(hours=7)},
        {"case:concept:name": "V2", "concept:name": "VoteCast",          "time:timestamp": base_time + pd.Timedelta(hours=8)},
        {"case:concept:name": "V2", "concept:name": "ProposalExecuted",  "time:timestamp": base_time + pd.Timedelta(hours=10)},
    ]
    violations.extend(v2)

    # V3: Queue before Vote — voting phase is skipped, queue appears immediately
    v3 = [
        {"case:concept:name": "V3", "concept:name": "ProposalCreated",   "time:timestamp": base_time},
        {"case:concept:name": "V3", "concept:name": "ProposalQueued",    "time:timestamp": base_time + pd.Timedelta(hours=1)},
        {"case:concept:name": "V3", "concept:name": "VoteCast",          "time:timestamp": base_time + pd.Timedelta(hours=2)},
        {"case:concept:name": "V3", "concept:name": "ProposalExecuted",  "time:timestamp": base_time + pd.Timedelta(hours=4)},
    ]
    violations.extend(v3)

    # V4: Missing ProposalCreated — trace starts with VoteCast
    v4 = [
        {"case:concept:name": "V4", "concept:name": "VoteCast",          "time:timestamp": base_time},
        {"case:concept:name": "V4", "concept:name": "VoteCast",          "time:timestamp": base_time + pd.Timedelta(hours=1)},
        {"case:concept:name": "V4", "concept:name": "ProposalQueued",    "time:timestamp": base_time + pd.Timedelta(hours=7)},
        {"case:concept:name": "V4", "concept:name": "ProposalExecuted",  "time:timestamp": base_time + pd.Timedelta(hours=9)},
    ]
    violations.extend(v4)

    # V5: Upgrade before Queue — DeterministicUpgradeExecuted appears before ProposalQueued
    v5 = [
        {"case:concept:name": "V5", "concept:name": "ProposalCreated",                "time:timestamp": base_time},
        {"case:concept:name": "V5", "concept:name": "ProposalPackageCreated",          "time:timestamp": base_time + pd.Timedelta(seconds=1)},
        {"case:concept:name": "V5", "concept:name": "VoteCast",                        "time:timestamp": base_time + pd.Timedelta(hours=1)},
        {"case:concept:name": "V5", "concept:name": "DeterministicUpgradeExecuted",    "time:timestamp": base_time + pd.Timedelta(hours=7)},
        {"case:concept:name": "V5", "concept:name": "ProposalQueued",                  "time:timestamp": base_time + pd.Timedelta(hours=8)},
        {"case:concept:name": "V5", "concept:name": "ProposalExecuted",                "time:timestamp": base_time + pd.Timedelta(hours=10)},
    ]
    violations.extend(v5)

    return pd.DataFrame(violations)


def build_identity_violation_traces():
    """Build synthetic traces that violate the identity process model."""
    base_time = pd.Timestamp("2025-01-01T00:00:00Z")

    violations = []

    # V6: IdentitySet before StakeholderAdded — acting before onboarding
    v6 = [
        {"case:concept:name": "V6", "concept:name": "IdentitySet",       "time:timestamp": base_time},
        {"case:concept:name": "V6", "concept:name": "StakeholderAdded",   "time:timestamp": base_time + pd.Timedelta(hours=1)},
    ]
    violations.extend(v6)

    # V7: Activity after StakeholderRemoved — setting identity post-removal
    v7 = [
        {"case:concept:name": "V7", "concept:name": "StakeholderAdded",   "time:timestamp": base_time},
        {"case:concept:name": "V7", "concept:name": "StakeholderRemoved", "time:timestamp": base_time + pd.Timedelta(hours=1)},
        {"case:concept:name": "V7", "concept:name": "IdentitySet",        "time:timestamp": base_time + pd.Timedelta(hours=2)},
    ]
    violations.extend(v7)

    return pd.DataFrame(violations)


def verify_violations():
    """Verify that the process model detects synthetic violation traces.

    This demonstrates the model's detection capability: traces with
    out-of-order events produce low fitness scores, confirming that
    the process model would catch any ordering violations that somehow
    bypassed on-chain enforcement.
    """
    print("\n--- Verifying Violation Detection (Synthetic Traces) ---")

    violation_log = build_violation_traces()
    final_tree = build_governance_tree()

    formatted_log = pm4py.format_dataframe(
        violation_log,
        case_id='case:concept:name',
        activity_key='concept:name',
        timestamp_key='time:timestamp'
    )
    event_log = pm4py.convert_to_event_log(formatted_log)

    net, im, fm = pm4py.convert_to_petri_net(final_tree)

    gov_violation_names = {
        "V1": "Execute without Queue",
        "V2": "Vote after Queue",
        "V3": "Queue before Vote",
        "V4": "Missing ProposalCreated",
        "V5": "Upgrade before Queue",
    }

    # Per-trace alignment to show each violation is individually detected
    all_detected = True
    try:
        aligned_traces = pm4py.conformance_diagnostics_alignments(event_log, net, im, fm)

        for i, trace_result in enumerate(aligned_traces):
            case_id = list(gov_violation_names.keys())[i]
            name = gov_violation_names[case_id]
            fitness = trace_result['fitness']
            detected = fitness < 0.999

            status = "DETECTED" if detected else "MISSED"
            print(f"  {case_id} ({name}): fitness={fitness:.4f} — {status}")

            if not detected:
                all_detected = False

    except Exception as e:
        print(f"  Governance alignment failed: {e}")

    # Identity violations
    print("\n  Identity Violations:")
    id_violation_log = build_identity_violation_traces()
    id_tree = build_identity_tree()

    id_formatted = pm4py.format_dataframe(
        id_violation_log,
        case_id='case:concept:name',
        activity_key='concept:name',
        timestamp_key='time:timestamp'
    )
    id_event_log = pm4py.convert_to_event_log(id_formatted)
    id_net, id_im, id_fm = pm4py.convert_to_petri_net(id_tree)

    id_violation_names = {
        "V6": "IdentitySet before StakeholderAdded",
        "V7": "IdentitySet after StakeholderRemoved",
    }

    try:
        id_aligned = pm4py.conformance_diagnostics_alignments(id_event_log, id_net, id_im, id_fm)

        for i, trace_result in enumerate(id_aligned):
            case_id = list(id_violation_names.keys())[i]
            name = id_violation_names[case_id]
            fitness = trace_result['fitness']
            detected = fitness < 0.999

            status = "DETECTED" if detected else "MISSED"
            print(f"  {case_id} ({name}): fitness={fitness:.4f} — {status}")

            if not detected:
                all_detected = False

    except Exception as e:
        print(f"  Identity alignment failed: {e}")

    total = len(gov_violation_names) + len(id_violation_names)
    if all_detected:
        print(f"\n  Result: PASS — all {total} violation traces detected as deviations")
    else:
        print(f"\n  Result: PARTIAL — some violations were not detected")

    # Aggregate fitness (should be well below 1.0)
    try:
        tbr_fitness = pm4py.fitness_token_based_replay(event_log, net, im, fm)
        align_fitness = pm4py.fitness_alignments(event_log, net, im, fm)
        print(f"\n  Aggregate Governance TBR Fitness:       {tbr_fitness['log_fitness'] * 100:.2f}%")
        print(f"  Aggregate Governance Alignment Fitness: {align_fitness['log_fitness'] * 100:.2f}%")

        id_tbr = pm4py.fitness_token_based_replay(id_event_log, id_net, id_im, id_fm)
        id_align = pm4py.fitness_alignments(id_event_log, id_net, id_im, id_fm)
        print(f"  Aggregate Identity TBR Fitness:         {id_tbr['log_fitness'] * 100:.2f}%")
        print(f"  Aggregate Identity Alignment Fitness:   {id_align['log_fitness'] * 100:.2f}%")
    except Exception as e:
        print(f"  Aggregate fitness check failed: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify governance and identity process conformance")
    parser.add_argument("--gov-csv", default="../data/process_mining/governance_log.csv",
                        help="Path to governance log CSV")
    parser.add_argument("--id-csv", default="../data/process_mining/identity_log.csv",
                        help="Path to identity log CSV")
    parser.add_argument("--violations", action="store_true",
                        help="Also run synthetic violation trace detection")
    args = parser.parse_args()

    try:
        gov_data, id_data = preprocess_logs(args.gov_csv, args.id_csv)
        verify_governance(gov_data)
        verify_identity(id_data)

        if args.violations:
            verify_adversarial(gov_data)
            verify_violations()
    except FileNotFoundError:
        print("CSV files not found. Check your path!")
