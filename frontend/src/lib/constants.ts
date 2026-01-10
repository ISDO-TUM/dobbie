import { ethers } from "ethers";

export const AVERAGE_BLOCK_TIME_SECONDS = 12;

export const NULL_ADDRESS = ethers.ZeroAddress;

export const PROPOSAL_STATE = {
  0: "Pending",
  1: "Active",
  2: "Canceled",
  3: "Defeated",
  4: "Succeeded",
  5: "Queued",
  6: "Expired",
  7: "Executed",
} as const;

export type ProposalStateNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ProposalStateName = (typeof PROPOSAL_STATE)[ProposalStateNumber];

export const statusMap = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed",
] as const;

export const ROLES = {
  STAKEHOLDER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("STAKEHOLDER_ROLE")),
  PROPOSER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("PROPOSER_ROLE")),
  DEPLOYER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("DEPLOYER_ROLE")),
  DEFAULT_ADMIN_ROLE: ethers.ZeroHash,
};
