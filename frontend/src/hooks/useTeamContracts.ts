import { useMemo } from "react";
import { Contract } from "ethers";
import useWeb3Connection from "./useWeb3Connection";
import { useSuspenseQuery } from "@tanstack/react-query";
import { artifactsQueryOptions } from "../queries/teams";

interface UseTeamContractsProps {
  governorAddress: string;
  registryAddress: string;
}

export function useTeamContracts({
  governorAddress,
  registryAddress,
}: UseTeamContractsProps) {
  // 1. Get the user's signer (to allow writing transactions)
  const { signer, provider } = useWeb3Connection();

  // 2. Fetch the ABIs from the backend (Cached)
  const { data: artifacts } = useSuspenseQuery(artifactsQueryOptions);

  // 3. Instantiate Contracts
  const contracts = useMemo(() => {
    // If we don't have a signer/provider yet, we can't interact fully.
    // However, we could use a read-only provider if needed, but for now let's wait for wallet.
    const runner = signer || provider;

    if (!runner || !governorAddress || !registryAddress || !artifacts) {
      return { governor: null, registry: null };
    }

    try {
      return {
        governor: new Contract(governorAddress, artifacts.governor.abi, runner),
        registry: new Contract(registryAddress, artifacts.registry.abi, runner),
      };
    } catch (e) {
      console.error("Failed to create contract instances:", e);
      return { governor: null, registry: null };
    }
  }, [signer, provider, governorAddress, registryAddress, artifacts]);

  return contracts;
}
