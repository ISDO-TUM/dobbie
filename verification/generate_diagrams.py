import argparse
import pandas as pd
import pm4py
import os


def generate_per_scenario_diagrams(log_path, output_dir, prefix="scenario"):
    print("\n--- Per-Scenario Trace Diagrams ---")

    try:
        log = pd.read_csv(log_path)
    except FileNotFoundError:
        print(f"Log not found: {log_path}")
        return

    log['time:timestamp'] = pd.to_datetime(log['time:timestamp'], errors='coerce')
    log = log.dropna(subset=['case:concept:name', 'concept:name', 'time:timestamp'])
    log = log.sort_values(by=['case:concept:name', 'time:timestamp', 'concept:name'])

    # Fix upgrades (same preprocessing as verify_process.py)
    executions = log[log['concept:name'] == 'ProposalExecuted']
    for index, row in log[log['case:concept:name'] == 'SYSTEM_UPGRADE'].iterrows():
        match = executions[executions['time:timestamp'] == row['time:timestamp']]
        if not match.empty:
            log.at[index, 'case:concept:name'] = match.iloc[0]['case:concept:name']
            log.at[index, 'time:timestamp'] -= pd.Timedelta(milliseconds=1)

    log = log.sort_values(by=['case:concept:name', 'time:timestamp'])

    cases = log['case:concept:name'].unique()
    print(f"  Found {len(cases)} traces")

    for i, case_id in enumerate(cases, 1):
        case_log = log[log['case:concept:name'] == case_id].copy()
        trace_activities = " -> ".join(case_log['concept:name'].tolist())
        print(f"  [{i}] {case_id[:20]}... : {trace_activities}")

        formatted = pm4py.format_dataframe(
            case_log,
            case_id='case:concept:name',
            activity_key='concept:name',
            timestamp_key='time:timestamp'
        )
        event_log = pm4py.convert_to_event_log(formatted)

        try:
            dfg, sa, ea = pm4py.discover_dfg(event_log)
            out_path = os.path.join(output_dir, f"{prefix}_{i}_trace.png")
            pm4py.save_vis_dfg(dfg, sa, ea, out_path)
            print(f"      Saved: {out_path}")
            
            if out_path.endswith('.png'):
                pm4py.save_vis_dfg(dfg, sa, ea, out_path[:-4] + '.svg')
                pm4py.save_vis_dfg(dfg, sa, ea, out_path[:-4] + '.pdf')
        except Exception as e:
            print(f"      Could not save diagram: {e}")


def generate_frequency_dfg(log_path, output_path):
    print("\n--- Frequency DFG (All Traces Combined) ---")

    try:
        log = pd.read_csv(log_path)
    except FileNotFoundError:
        print(f"Log not found: {log_path}")
        return

    log['time:timestamp'] = pd.to_datetime(log['time:timestamp'], errors='coerce')
    log = log.dropna(subset=['case:concept:name', 'concept:name', 'time:timestamp'])
    log = log.sort_values(by=['case:concept:name', 'time:timestamp', 'concept:name'])

    # Fix upgrades
    executions = log[log['concept:name'] == 'ProposalExecuted']
    for index, row in log[log['case:concept:name'] == 'SYSTEM_UPGRADE'].iterrows():
        match = executions[executions['time:timestamp'] == row['time:timestamp']]
        if not match.empty:
            log.at[index, 'case:concept:name'] = match.iloc[0]['case:concept:name']
            log.at[index, 'time:timestamp'] -= pd.Timedelta(milliseconds=1)

    log = log.sort_values(by=['case:concept:name', 'time:timestamp'])

    formatted = pm4py.format_dataframe(
        log,
        case_id='case:concept:name',
        activity_key='concept:name',
        timestamp_key='time:timestamp'
    )
    event_log = pm4py.convert_to_event_log(formatted)

    try:
        dfg, sa, ea = pm4py.discover_dfg(event_log)
        pm4py.save_vis_dfg(dfg, sa, ea, output_path)
        print(f"  Saved frequency DFG to '{output_path}'")
        if output_path.endswith('.png'):
            pm4py.save_vis_dfg(dfg, sa, ea, output_path[:-4] + '.svg')
            pm4py.save_vis_dfg(dfg, sa, ea, output_path[:-4] + '.pdf')
        print(f"  Total traces: {len(event_log)}")

        # Print edge frequencies
        sorted_edges = sorted(dfg.items(), key=lambda x: x[1], reverse=True)
        for edge, freq in sorted_edges:
            print(f"    {edge[0]} -> {edge[1]}: {int(freq)}x")
    except Exception as e:
        print(f"  Could not save frequency DFG: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate per-scenario and frequency DFG diagrams")
    parser.add_argument("--gov-csv", default="../data/process_mining/governance_log.csv",
                        help="Path to governance log CSV")
    parser.add_argument("--output-dir", default="output",
                        help="Directory for output diagrams")
    parser.add_argument("--prefix", default="scenario",
                        help="Prefix for per-scenario diagram filenames")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    generate_per_scenario_diagrams(args.gov_csv, args.output_dir, args.prefix)
    generate_frequency_dfg(args.gov_csv, os.path.join(args.output_dir, f"{args.prefix}_frequency_dfg.png"))
