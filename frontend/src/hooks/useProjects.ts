import { useState, useEffect, useCallback } from "react";
import { EventLog, Log, Contract } from "ethers";

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
    // 1. Safety Check: If contract isn't ready, we can't fetch
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

      // 2. Use the injected contract instance directly
      const filter = registryContract.filters.ProjectRegistered();
      const logs: (Log | EventLog)[] = await registryContract.queryFilter(
        filter,
        startBlock,
        "latest",
      );

      console.log(`Found ${logs.length} ProjectRegistered events.`);

      const projectPromises = logs.map(async (log): Promise<Project | null> => {
        const eventLog = log as EventLog;
        const { projectId, projectName, proxyAddress } = eventLog.args;

        if (!projectId || !projectName || !proxyAddress) {
          console.warn("Incomplete event data found in log:", log);
          return null;
        }

        let beaconAddress = "0x0";
        try {
          // Call the contract directly
          beaconAddress = await registryContract.projectBeacons(projectId);
        } catch (e) {
          console.error(
            `Failed to fetch beacon for project ${projectName} (ID: ${projectId}):`,
            e,
          );
        }

        return {
          id: projectId as string,
          name: projectName as string,
          proxyAddress: proxyAddress as string,
          beaconAddress: beaconAddress,
        };
      });

      const settledProjects = await Promise.allSettled(projectPromises);

      const discoveredProjects: Project[] = settledProjects
        .filter(
          (result) => result.status === "fulfilled" && result.value !== null,
        )
        .map((result) => (result as PromiseFulfilledResult<Project>).value);

      setProjects(discoveredProjects);

      // Logic to handle selection persistence
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
        `Failed to fetch projects: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [registryContract, deploymentBlock]);

  // 3. React to changes in the contract instance (e.g., wallet connection)
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
