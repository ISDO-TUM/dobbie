import { useState, useEffect, useCallback } from "react";
import { Contract, id, AbiCoder, getAddress, Log } from "ethers";

export interface Project {
  id: string;
  name: string;
  proxyAddress: string;
  beaconAddress: string;
}

export function useProjects(
  registryContract: Contract | null,
  deploymentBlock: bigint,
) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!registryContract) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(
        `Fetching projects from registry: ${registryContract.target}`,
      );

      const startBlock = deploymentBlock > 0n ? Number(deploymentBlock) : 0;
      console.log(
        `Querying ProjectRegistered events from block ${startBlock}...`,
      );

      // Fetch both current (V2) and legacy (V1) ProjectRegistered events
      const newTopic =
        registryContract.interface.getEvent("ProjectRegistered")!.topicHash;
      const legacyTopic = id("ProjectRegistered(bytes32,string,address)");

      // Bypassing strict ABI checks using the raw provider
      let provider = registryContract.runner;
      if (provider && "provider" in provider && provider.provider) {
        provider = provider.provider;
      }

      if (!provider || !("getLogs" in provider)) {
        throw new Error("Contract runner is not a valid provider");
      }

      const logs = await (provider as any).getLogs({
        address: registryContract.target,
        topics: [[newTopic, legacyTopic]],
        fromBlock: startBlock,
        toBlock: "latest",
      });

      console.log(`Found ${logs.length} ProjectRegistered events.`);

      const projectPromises = logs.map(
        async (log: Log): Promise<Project | null> => {
          let projectId, projectName, proxyAddress, beaconAddress;
          let parsed = null;

          // 1. Try parsing with current interface
          try {
            parsed = registryContract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
          } catch (e) {
            console.error("Failed to parse log:", e);
            // Ignore parse errors, will fall back to legacy check
          }

          if (parsed) {
            projectId = parsed.args[0];
            projectName = parsed.args[1];
            proxyAddress = parsed.args[2];
            beaconAddress = parsed.args[3];
          } else if (log.topics.length === 3) {
            // 2. Fallback: Parse Legacy Event (3 topics: signature, projectId, proxyAddress)
            try {
              projectId = log.topics[1]; // Topic 1: projectId

              // Topic 2: proxyAddress (decode from padded hex)
              if (log.topics[2] && log.topics[2].length >= 26) {
                const addressHex = "0x" + log.topics[2].slice(26);
                proxyAddress = getAddress(addressHex);
              }

              // Data: projectName (string)
              const abiCoder = AbiCoder.defaultAbiCoder();
              const decodedData = abiCoder.decode(["string"], log.data);
              projectName = decodedData[0];

              beaconAddress = "0x0";
            } catch (manualError) {
              console.error("Failed manual legacy parse:", manualError);
              return null;
            }
          } else {
            console.warn(
              "Log has unexpected topic count:",
              log.topics.length,
              log,
            );
            return null;
          }

          if (!projectId || !projectName || !proxyAddress) {
            console.warn("Incomplete event data found in log:", { log });
            return null;
          }

          // 3. Fallback: Fetch beacon if missing (Legacy support)
          if (
            !beaconAddress ||
            beaconAddress === "0x0000000000000000000000000000000000000000"
          ) {
            try {
              beaconAddress = await registryContract.projectBeacons(projectId);
            } catch (e) {
              console.error(
                `Failed to fetch beacon for project ${projectName} (ID: ${projectId}):`,
                e,
              );
            }
          }

          return {
            id: projectId as string,
            name: projectName as string,
            proxyAddress: proxyAddress as string,
            beaconAddress: beaconAddress || "0x0",
          };
        },
      );

      const settledProjects = await Promise.allSettled(projectPromises);

      const discoveredProjects: Project[] = settledProjects
        .filter(
          (result) => result.status === "fulfilled" && result.value !== null,
        )
        .map((result) => (result as PromiseFulfilledResult<Project>).value);

      setProjects(discoveredProjects);

      // Persist selection if current selection still exists, else default to first
      if (discoveredProjects.length > 0) {
        setSelectedProject((current) => {
          const currentId = current?.id;
          const stillExists = discoveredProjects.some(
            (p) => p.id === currentId,
          );
          return stillExists ? current : discoveredProjects[0];
        });
      } else {
        setSelectedProject(null);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      setError(
        `Failed to fetch projects: ${error instanceof Error ? error.message : String(error)}`,
      );
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [registryContract, deploymentBlock]);

  useEffect(() => {
    if (registryContract) {
      fetchProjects();
    } else {
      setProjects([]);
      setSelectedProject(null);
      setIsLoading(false); // Not loading, just waiting for connection
    }
  }, [registryContract, fetchProjects]);

  return {
    projects,
    isLoading,
    error,
    selectedProject,
    setSelectedProject,
    refreshProjects: fetchProjects,
  };
}
