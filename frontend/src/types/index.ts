import { ethers } from "ethers";

export interface ContractAddresses {
  devOpsGovernor: string;
  deploymentRegistry: string;
}

export interface Stakeholder {
  address: string;
  github: string;
}

export interface Bot {
  address: string;
  isProposer: boolean;
  isPropagator: boolean;
}

export interface Proposal {
  id: bigint;
  proposer: string;
  targets: string[];
  values: bigint[];
  calldatas: string[];
  description: string;
  status: string;
  votes: {
    for: bigint;
    against: bigint;
    abstain: bigint;
  };
  deadline: number;
  ipfsCID?: string;
  projectId?: string;
  targetAddress?: string;
}

export interface GovernanceParams {
  votingDelay: number;
  votingPeriod: number;
  quorum: number;
  minDelay: number;
}

export interface ProxyInfo {
  address: string;
  beacon: string;
  implementation: string;
}

export interface UpgradeHistoryItem {
  version: string;
  address: string;
  date: Date;
  blockNumber: number;
}

export interface FormField {
  name: string;
  label: string;
  placeholder: string;
  type?: string; // "text" | "number" | "select" | "checkbox-group"
  optional?: boolean;
  multiSelect?: boolean;
  options?: { value: string; label: string }[]; // For select/checkbox fields
}

export interface ProposalAction {
  title: string;
  fields: FormField[];
}

export interface Contracts {
  governor?: ethers.Contract | null;
  timelock?: ethers.Contract | null;
  registry?: ethers.Contract | null;
  projectFactory?: ethers.Contract | null;
}

export interface ModalContentType {
  title: string;
  form: React.ReactNode | null;
}

export type EventFilter = ethers.EventFilter;

export type UserRole =
  | "admin"
  | "stakeholder"
  | "proposer"
  | "deployer"
  | "none";

export interface Project {
  id: string; // The projectId (bytes32 hash)
  name: string; // The human-readable name
  proxyAddress: string; // The address of the project's proxy
  beaconAddress: string;
}

export interface Team {
  id: number;
  name: string;
  governorAddress: string;
  registryAddress: string;
  deploymentBlock?: number;
  githubLink?: string;
  archivedAt?: string | null;
}
