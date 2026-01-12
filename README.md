### Tech Stack

- Monorepo: Managed with pnpm workspaces.
- Languages: primarily TypeScript across the full stack, with Solidity for smart contracts and Python for verification scripts.
- Containerization: Docker (Dockerfiles present in frontend/backend).
  Frontend (/frontend)
- Framework: React 19
- Build Tool: Vite
- Language: TypeScript
- Styling: Tailwind CSS v4 (with framer-motion for animations)
- Routing: @tanstack/react-router
- State Management: @tanstack/react-query
- Forms: react-hook-form with zod validation
- Web3: ethers
  Backend (/backend)
- Framework: NestJS
- Database: SQLite (sovereign_db.sqlite)
- ORM: TypeORM
- Blockchain Integration: viem, ethers, kubo-rpc-client (IPFS)
- External APIs: octokit (GitHub interactions)
- Testing: Jest
  Smart Contracts (/contracts)
- Framework: Hardhat (using Hardhat Ignition for deployment)
- Library: OpenZeppelin Contracts
- Testing: viem, chai, tsx
- Linting/Formatting: Solhint, Prettier plugin for Solidity
  Verification (/verification)
- Scripting: Python (referenced in root scripts for performance analysis)
