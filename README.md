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

- **Analysis**: Python scripts for performance and safety checks.

## Key Features

- **Atomic Governance**: Bundle multiple contract upgrades and config changes into a single, atomic proposal.
- **Proposal Verification**: Automated pipelines verify that the proposed code matches the on-chain artifacts.
- **Bot Integration**: Assign roles to bots (Proposer, Propagator) to automate routine maintenance while keeping governance secure.
