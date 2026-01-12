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
  const { signer, provider } = useWeb3Connection();
  const { data: artifacts } = useSuspenseQuery(artifactsQueryOptions);

  const contracts = useMemo(() => {
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
