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
            
            # Subtract 1 millisecond so Upgrade appears before Execute
            gov_log.at[index, 'time:timestamp'] -= pd.Timedelta(milliseconds=1)
            
    # Re-sort after the timestamp tweak to ensure Upgrade -> Execute order is preserved
    gov_log = gov_log.sort_values(by=['case:concept:name', 'time:timestamp'])

    # Load Identity Log
    id_log = pd.read_csv(identity_path)
    id_log['time:timestamp'] = pd.to_datetime(id_log['time:timestamp'])
    
    return gov_log, id_log

def verify_governance(log):
    print("\n--- Verifying Governance Process ---")
    
    # Define the model
    
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
            ProcessTree(label=None),          # Stalled/Active
            ProcessTree(label="ProposalCanceled"), # Explicit Cancel
            execution_phase                   # Success
        ])
    ])

    # Verify
    log = log.dropna(subset=['case:concept:name']) 
    formatted_log = pm4py.format_dataframe(log, case_id='case:concept:name', activity_key='concept:name', timestamp_key='time:timestamp')
    event_log = pm4py.convert_to_event_log(formatted_log)
    
    net, im, fm = pm4py.convert_to_petri_net(final_tree)
    
    try:
        fitness = pm4py.fitness_token_based_replay(event_log, net, im, fm)
        score = fitness['log_fitness']
        print(f"Conformance Fitness: {score * 100:.2f}%")
        
    except Exception as e:
        print(f"Verification failed: {e}")

def verify_identity(log):
    print("\n--- Verifying Identity Process ---")
    
    root_tree = ProcessTree(operator=Operator.SEQUENCE, children=[
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

    formatted_log = pm4py.format_dataframe(log, case_id='case:concept:name', activity_key='concept:name', timestamp_key='time:timestamp')
    event_log = pm4py.convert_to_event_log(formatted_log)
    
    net, im, fm = pm4py.convert_to_petri_net(root_tree)
    fitness = pm4py.fitness_token_based_replay(event_log, net, im, fm)
    print(f"Identity Fitness: {fitness['log_fitness'] * 100:.2f}%")

if __name__ == "__main__":
    # Ensure these paths point to your actual data folder
    GOV_CSV = '../data/process_mining/governance_log.csv'
    ID_CSV = '../data/process_mining/identity_log.csv'
    
    try:
        gov_data, id_data = preprocess_logs(GOV_CSV, ID_CSV)
        verify_governance(gov_data)
        verify_identity(id_data)
    except FileNotFoundError:
        print("❌ CSV files not found. Check your path!")