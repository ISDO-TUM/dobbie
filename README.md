# Dobbie

**Sovereign DevOps Governance**

Dobbie is a platform that bridges the gap between DevOps automation and decentralized governance. It allows teams to manage their infrastructure and deployments through on-chain proposals, ensuring security, transparency, and atomic updates.

## Quick Start

Get the entire system running in minutes with Docker.

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- [Git](https://git-scm.com/)

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/kirillinoz/dobbie.git
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

👉 **[Dobbie Project Template](https://github.com/kirillinoz/dobbie-template)**

This template includes the necessary structure and configuration to integrate with Dobbie's verification and proposal system.

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

## Reproducing the Evaluation

The correctness benchmark from the paper (conformant scenarios S1--S7, adversarial scenarios SN1--SN7, synthetic violations V1--V7) can be fully reproduced with a single script.

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
    | 1 | Simulate all scenarios (S1--S7, SN1--SN7) on a local Hardhat blockchain | `data/process_mining/simulated_*.csv` |
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

### Expected Output

- **Conformant scenarios**: 100.00% TBR fitness, 99.99% alignment fitness (PASS)
- **Adversarial scenarios**: All seven result in reverted transactions; SN2 and SN7 detected as deviations (fitness 0.80, 0.83)
- **Synthetic violations**: All seven detected (fitness 0.67--0.86)

## Key Features

- **Atomic Governance**: Bundle multiple contract upgrades and config changes into a single, atomic proposal.
- **Proposal Verification**: Automated pipelines verify that the proposed code matches the on-chain artifacts.
- **Bot Integration**: Assign roles to bots (Proposer, Propagator) to automate routine maintenance while keeping governance secure.
