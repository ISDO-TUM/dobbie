import pandas as pd
import pm4py
import numpy as np

def analyze_governance_performance():
    print("\n--- Governance Performance (Bottleneck) Analysis ---")
    
    # 1. Load & Preprocess (Same as before)
    log_path = '../data/process_mining/governance_log.csv'
    try:
        log = pd.read_csv(log_path)
    except FileNotFoundError:
        print("❌ Log not found.")
        return

    log['time:timestamp'] = pd.to_datetime(log['time:timestamp'])
    
    # Deterministic sort to ensure accurate duration calc
    log = log.sort_values(by=['case:concept:name', 'time:timestamp', 'concept:name'])

    # Fix Upgrades (Merge into parent proposal)
    executions = log[log['concept:name'] == 'ProposalExecuted']
    for index, row in log[log['case:concept:name'] == 'SYSTEM_UPGRADE'].iterrows():
        match = executions[executions['time:timestamp'] == row['time:timestamp']]
        if not match.empty:
            log.at[index, 'case:concept:name'] = match.iloc[0]['case:concept:name']
            log.at[index, 'time:timestamp'] -= pd.Timedelta(milliseconds=1)
    
    log = log.sort_values(by=['case:concept:name', 'time:timestamp'])
    
    # 2. Convert to Event Log
    formatted_log = pm4py.format_dataframe(log, case_id='case:concept:name', activity_key='concept:name', timestamp_key='time:timestamp')
    event_log = pm4py.convert_to_event_log(formatted_log)

    # 3. Calculate Case Durations
    # How long does a whole proposal take?
    all_durations = []
    for trace in event_log:
        start = trace[0]['time:timestamp']
        end = trace[-1]['time:timestamp']
        duration_hours = (end - start).total_seconds() / 3600
        all_durations.append(duration_hours)

    avg_duration = np.mean(all_durations)
    max_duration = np.max(all_durations)
    
    print(f"📊 Total Proposals: {len(all_durations)}")
    print(f"⏱️  Average Duration: {avg_duration:.2f} hours")
    print(f"🐢 Longest Proposal: {max_duration:.2f} hours")

    # 4. Bottleneck Detection (Transition Times)
    # This maps "Activity A -> Activity B" and calculates average time between them.
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
            print(f"{source} -> {target}: {mean_hours:.2f} hours")

    # 5. Visual Output (Optional)
    # Saves a heatmap of where time is spent
    pm4py.save_vis_performance_dfg(performance_dfg[0], start_activities, end_activities, 'output/governance_performance.png')
    print("\n✅ Saved bottleneck map to 'governance_performance.png'")

if __name__ == "__main__":
    analyze_governance_performance()