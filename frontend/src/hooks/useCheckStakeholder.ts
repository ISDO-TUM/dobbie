import { ethers } from "ethers";
import useWeb3Connection from "./useWeb3Connection";

// The standard AccessControl ABI for checking roles
const ACCESS_CONTROL_ABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function name() view returns (string)", // Optional: to fetch team name
];

export function useCheckStakeholder() {
  const { provider } = useWeb3Connection();

  const checkStakeholder = async (
    governorAddress: string,
    walletAddress: string,
  ): Promise<{ isStakeholder: boolean; teamName: string }> => {
    if (!provider) throw new Error("Provider not available");

    try {
      const contract = new ethers.Contract(
        governorAddress,
        ACCESS_CONTROL_ABI,
        provider,
      );

      // 1. Calculate the Hash for "STAKEHOLDER_ROLE"
      // This must match the constant in your Solidity contract
      const STAKEHOLDER_ROLE = ethers.keccak256(
        ethers.toUtf8Bytes("STAKEHOLDER_ROLE"),
      );

      // 2. Call the contract
      // We use Promise.all to fetch name and role status in parallel
      const [isStakeholder, name] = await Promise.all([
        contract.hasRole(STAKEHOLDER_ROLE, walletAddress),
        contract.name().catch(() => "Unknown Team"), // Fallback if name() fails
      ]);

      return { isStakeholder, teamName: name };
    } catch (error) {
      console.error("Failed to check stakeholder status:", error);
      throw new Error("Invalid Governor Address or Contract Error");
    }
  };

  return { checkStakeholder };
}
