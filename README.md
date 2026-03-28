This repository serves as a replication package for the paper _An Architecture for Decentralised Deployment
and Operation of Blockchain Applications_. 
- To verify the evaluation, see [Reproducing the Evaluation](#reproducing-the-evaluation).
- `data/appendix_petri_net.pdf` includes our online appendix of the in the paper (correctness benchmark) mentioned petri net.

# Dobbie

Dobbie is a platform that bridges the gap between DevOps automation and decentralized governance. It allows teams to manage their infrastructure and deployments through on-chain proposals, ensuring security, transparency, and atomic updates.

## Table of Contents

- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Bootstrap Your Project](#bootstrap-your-project)
- [Reproducing the Evaluation](#reproducing-the-evaluation)
  - [Prerequisites](#prerequisites-1)
  - [Steps](#steps)
  - [Gas Cost Analysis](#gas-cost-analysis)
  - [Expected Output](#expected-output-correctness-benchmark)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
  - [Frontend](#frontend-frontend)
  - [Backend](#backend-backend)
  - [Smart Contracts](#smart-contracts-contracts)
  - [Verification](#verification-verification)


## Quick Start

Get the entire system running in minutes with Docker.

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- [Git](https://git-scm.com/)

### Installation

1.  **Clone the repository**

    ```bash
    git clone REDACTED
    cd dobbie
    ```

2.  **Start the application**

    ```bash
    docker compose up -d --build
    ```

    This will start the Frontend, Backend, and a local Blockchain node.
    - **Frontend**: http://localhost:5173
    - **Backend API**: http://localhost:3000

## Bootstrap Your Project

Want to make your own project compatible with the Dobbie governance system? usage our starter template:

👉 **[Dobbie Project Template]** (Link REDACTED)

This template includes the necessary structure and configuration to integrate with Dobbie's verification and proposal system.

## Reproducing the Evaluation

The correctness benchmark from the paper (conformant scenarios C1--C3, adversarial scenarios N1--N7, synthetic violations V1--V5) can be fully reproduced with a single script. The repository additionally includes identity scenarios (S5--S7) and identity violation traces (V6--V7), which are not discussed in the paper but are verified as part of the pipeline.

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+) and [pnpm](https://pnpm.io/)
- Python 3 with `pm4py`, `pandas`, and `matplotlib`
- [Graphviz](https://graphviz.org/) (`brew install graphviz` on macOS)

### Steps

1.  **Install contract dependencies**

    ```bash
    cd contracts
    pnpm install
    ```

2.  **Install Python dependencies**

    ```bash
    pip install pm4py pandas matplotlib
    ```

3.  **Run the full verification pipeline**

    ```bash
    cd verification
    bash verify_all.sh
    ```

    This script executes the following steps:

    | Step | Description | Output |
    |------|-------------|--------|
    | 1 | Simulate all scenarios (C1--C3, N1--N7, S5--S7) on a local Hardhat blockchain | `data/process_mining/simulated_*.csv` |
    | 2 | Verify conformance (TBR + alignment fitness) and run synthetic violations (V1--V7) | Console output |
    | 3 | Generate performance-annotated DFG | `verification/output/simulated_performance.pdf` |
    | 4 | (Optional) Verify real Sepolia testnet data if CSVs are present | `verification/output/governance_performance.pdf` |

4.  **(Optional) Generate per-scenario trace diagrams**

    ```bash
    cd verification
    python3 generate_diagrams.py \
      --gov-csv ../data/process_mining/simulated_governance_log.csv \
      --output-dir output \
      --prefix simulated
    ```

    This generates individual DFG diagrams for each trace and a combined frequency DFG, useful for visual inspection and debugging.

### Gas Cost Analysis

The gas cost benchmark measures the on-chain cost of each governance lifecycle step (role setup, proposal, voting, queuing, execution). Gas consumption is deterministic, so results are reproducible across environments. USD costs are computed using a 30-day average ETH price fetched from CoinGecko (no API key required).

```bash
cd contracts
npx hardhat run scripts/analysis/analyze-gas.ts
```

This will:

1. Fetch the 30-day average ETH price from CoinGecko (falls back to CoinMarketCap spot price if `COINMARKETCAP_API_KEY` is set in `.env`)
2. Deploy the governance contracts on a local Hardhat blockchain
3. Execute a full governance lifecycle (propose, vote, queue, execute)
4. Output a table with gas used, ETH cost, and USD cost per step

#### Expected Output

| Governance Step        | Gas     | Cost (ETH) | Cost (USD) |
|------------------------|---------|------------|------------|
| Setup: Grant Role      | 51,311  | 0.00103    | ~$2        |
| Propose Package        | 115,306 | 0.00231    | ~$5        |
| Cast Vote (first)      | 75,463  | 0.00151    | ~$3        |
| Cast Vote (subsequent) | 58,363  | 0.00117    | ~$2        |
| Queue Proposal         | 132,671 | 0.00265    | ~$6        |
| Execute Proposal       | 74,352  | 0.00149    | ~$3        |
| **Total Lifecycle**    | **507,466** | **0.01015** | **~$21** |

> Gas values are deterministic; USD values will vary with ETH price at time of execution.

### Expected Output (Correctness Benchmark)

- **Conformant scenarios (C1--C3)**: 100.00% TBR fitness, 99.99% alignment fitness (PASS)
- **Identity scenarios (S5--S7)**: 100.00% TBR fitness, 99.99% alignment fitness (PASS)
- **Adversarial scenarios (N1--N7)**: All seven result in reverted transactions; N2 and N7 detected as deviations (fitness 0.83)
- **Synthetic violations (V1--V7)**: All seven detected (fitness 0.67--0.86)

## Key Features

- **Atomic Governance**: Bundle multiple contract upgrades and config changes into a single, atomic proposal.
- **Proposal Verification**: Automated pipelines verify that the proposed code matches the on-chain artifacts.
- **Bot Integration**: Assign roles to bots (Proposer, Propagator) to automate routine maintenance while keeping governance secure.

## Tech Stack

The project is a monorepo managed with **pnpm workspaces**.

### Frontend (`/frontend`)

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4 (with framer-motion)
- **State**: @tanstack/react-query
- **Routing**: @tanstack/react-router
- **Web3**: ethers.js

### Backend (`/backend`)

- **Framework**: NestJS
- **Database**: SQLite (`sovereign_db.sqlite`) with TypeORM
- **Blockchain**: viem, ethers
- **Storage**: IPFS (kubo-rpc-client)
- **Integrations**: GitHub (octokit)

### Smart Contracts (`/contracts`)

- **Framework**: Hardhat
- **Deployment**: Hardhat Ignition
- **Base**: OpenZeppelin Contracts
- **Testing**: viem, chai, tsx

### Verification (`/verification`)

- **Analysis**: Python scripts for process mining conformance checking and performance analysis.
- **Dependencies**: Python 3, pm4py, pandas, matplotlib
- **Tooling**: Graphviz (for DFG diagram generation)
