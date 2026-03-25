import argparse
import pandas as pd
import pm4py
import numpy as np

def analyze_governance_performance(log_path, output_path):
    print("\n--- Governance Performance (Bottleneck) Analysis ---")

    # Load & Preprocess
    try:
        log = pd.read_csv(log_path)
    except FileNotFoundError:
        print(f"Log not found: {log_path}")
        return

    log['time:timestamp'] = pd.to_datetime(log['time:timestamp'])

    # Deterministic sort to ensure accurate duration calc
    log = log.sort_values(by=['case:concept:name', 'time:timestamp', 'concept:name'])

    # Fix upgrades
    executions = log[log['concept:name'] == 'ProposalExecuted']
    for index, row in log[log['case:concept:name'] == 'SYSTEM_UPGRADE'].iterrows():
        match = executions[executions['time:timestamp'] == row['time:timestamp']]
        if not match.empty:
            log.at[index, 'case:concept:name'] = match.iloc[0]['case:concept:name']
            log.at[index, 'time:timestamp'] -= pd.Timedelta(milliseconds=1)

    log = log.sort_values(by=['case:concept:name', 'time:timestamp'])

    # Filter out adversarial traces (ADV_ prefix) — keep only conformant scenarios
    log = log[~log['case:concept:name'].astype(str).str.startswith('ADV_')]

    # Convert to Event Log
    formatted_log = pm4py.format_dataframe(log, case_id='case:concept:name', activity_key='concept:name', timestamp_key='time:timestamp')
    event_log = pm4py.convert_to_event_log(formatted_log)

    # Calculate Case Durations
    all_durations = []
    for trace in event_log:
        start = trace[0]['time:timestamp']
        end = trace[-1]['time:timestamp']
        duration_hours = (end - start).total_seconds() / 3600
        all_durations.append(duration_hours)

    if not all_durations:
        print("No traces found.")
        return

    avg_duration = np.mean(all_durations)
    max_duration = np.max(all_durations)

    print(f"  Total Proposals: {len(all_durations)}")
    print(f"  Average Duration: {avg_duration:.2f} hours")
    print(f"  Longest Proposal: {max_duration:.2f} hours")

    # Bottleneck Detection (Transition Times)
    print("\n--- Transition Bottlenecks (Avg Time) ---")

    # PM4Py's DFG (Directly Follows Graph) performance metric
    dfg, start_activities, end_activities = pm4py.discover_dfg(event_log)
    performance_dfg = pm4py.discover_performance_dfg(event_log)

    # Print the edges that take the most time
    sorted_edges = sorted(performance_dfg[0].items(), key=lambda x: x[1]['mean'], reverse=True)

    for edge, stats in sorted_edges:
        source, target = edge
        mean_hours = stats['mean'] / 3600
        if mean_hours > 0.01: # Filter out instant events
            print(f"  {source} -> {target}: {mean_hours:.2f} hours")

    # Visual Output
    try:
        pm4py.save_vis_performance_dfg(performance_dfg[0], start_activities, end_activities, output_path)
        print(f"\n  Saved bottleneck map to '{output_path}'")
        
        if output_path.endswith('.png'):
            svg_path = output_path[:-4] + '.svg'
            pdf_path = output_path[:-4] + '.pdf'
            pm4py.save_vis_performance_dfg(performance_dfg[0], start_activities, end_activities, svg_path)
            pm4py.save_vis_performance_dfg(performance_dfg[0], start_activities, end_activities, pdf_path)
            print(f"  Saved bottleneck map to '{svg_path}'")
            print(f"  Saved bottleneck map to '{pdf_path}'")

    except Exception:
        print(f"\n  Could not save bottleneck map (install graphviz: brew install graphviz)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze governance workflow performance and bottlenecks")
    parser.add_argument("--gov-csv", default="../data/process_mining/governance_log.csv",
                        help="Path to governance log CSV")
    parser.add_argument("--output", default="output/governance_performance.png",
                        help="Path for the output bottleneck diagram")
    args = parser.parse_args()

    analyze_governance_performance(args.gov_csv, args.output)
