// src/lib/contracts.ts

// --- Addresses ---
// These should match your latest deployment output and .env file
export const contractAddresses = {
  devOpsGovernor:
    (import.meta.env.VITE_GOVERNOR_ADDRESS as `0x${string}`) ||
    "0x517EC549899ED5E38B3F5563EF703475814164aE", // Replace with your Governor address
  deploymentRegistry:
    (import.meta.env.VITE_DEPLOYMENT_REGISTRY_ADDRESS as `0x${string}`) ||
    "0x06aAb5b3cb6898E3AC65DfF557E67f82436DD35a", // Replace with your Registry address
  // No static proxy address needed anymore
};

// --- Deployment Blocks (Update these!) ---
// Block number when the CURRENT governor was deployed
export const GOVERNOR_DEPLOYMENT_BLOCK = BigInt(
  import.meta.env.VITE_GOVERNOR_DEPLOYMENT_BLOCK || "9509430"
);
// Block number when the CURRENT registry was deployed
export const REGISTRY_DEPLOYMENT_BLOCK = BigInt(
  import.meta.env.VITE_REGISTRY_DEPLOYMENT_BLOCK || "9509430"
);

// Type helper for contract addresses
export type ContractAddresses = typeof contractAddresses;

console.log("Using Contract Addresses:", contractAddresses);
console.log("Governor Deployment Block:", GOVERNOR_DEPLOYMENT_BLOCK);
console.log("Registry Deployment Block:", REGISTRY_DEPLOYMENT_BLOCK);
