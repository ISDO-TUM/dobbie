import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import type {
  Proposal,
  Stakeholder,
  Bot,
  GovernanceParams,
  ProxyInfo,
  UpgradeHistoryItem,
  ContractAddresses,
  Contracts,
  Project,
} from "../types";
import { statusMap } from "../lib/constants";

interface UseGovernanceDataProps {
  provider: ethers.BrowserProvider | null;
  contracts: Contracts;
  contractAddresses: ContractAddresses;
  isInitializing: boolean;
  selectedProject: Project | null;
  deploymentBlock: bigint;
}

const CACHE_KEY_PREFIX = "governance_proposals_cache_";
const INDEXER_API = import.meta.env.VITE_INDEXER_API || "http://localhost:3001";

interface RawProposal {
  id: string;
  proposer: string;
  targets: string[];
  values: string[];
  calldatas: string[];
  description: string;
  voteStart: string;
  voteEnd: string;
  blockNumber: number;
  ipfsCID: string | null;
  projectId?: string;
  targetAddress?: string;
}

export interface DeploymentProposal {
  proposalId: bigint;
  projectId: string;
  implementationAddress: string;
  confirmationCount: bigint;
  status: "Pending" | "Confirmed" | "Aborted" | "Unknown";
  rejectionCount: bigint;
  registrationTimestamp: bigint;
}

interface CachedData {
  lastScannedBlock: number;
  proposals: RawProposal[];
  timestamp: number;
}

type ProposalVotesStruct = {
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
};

type ListenerFilter = {
  address: string;
  topics: (string | string[] | null)[];
};

const EIP1967_BEACON_SLOT =
  "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

const BeaconABI = [
  "function implementation() view returns (address)",
  "event Upgraded(address indexed implementation)",
];

export function useGovernanceData({
  provider,
  contracts,
  contractAddresses,
  isInitializing,
  selectedProject,
  deploymentBlock,
}: UseGovernanceDataProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [governanceParams, setGovernanceParams] = useState<GovernanceParams>({
    votingDelay: 0,
    votingPeriod: 0,
    quorum: 0,
    minDelay: 0,
  });
  const [proxyInfo, setProxyInfo] = useState<ProxyInfo>({
    address: "",
    beacon: "",
    implementation: "",
  });
  const [upgradeHistory, setUpgradeHistory] = useState<UpgradeHistoryItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [currentBlockNum, setCurrentBlockNum] = useState<number>(0);

  const cacheKey = `${CACHE_KEY_PREFIX}${contractAddresses.devOpsGovernor}`;

  // ============================================================================
  // TIER 1: LocalStorage Cache
  // ============================================================================
  const loadFromCache = useCallback((): CachedData | null => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached) as CachedData;
        console.log(
          `📦 [Tier 1] Loaded ${data.proposals.length} proposals from cache`,
        );
        return data;
      }
    } catch (err) {
      console.warn("[Tier 1] Failed to load cache:", err);
    }
    return null;
  }, [cacheKey]);

  const saveToCache = useCallback(
    (data: CachedData) => {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (err) {
        console.error("[Tier 1] Failed to save cache:", err);
      }
    },
    [cacheKey],
  );

  // ============================================================================
  // TIER 2: Indexer API
  // ============================================================================
  const fetchFromIndexer = useCallback(async (): Promise<
    RawProposal[] | null
  > => {
    try {
      console.log("🌐 [Tier 2] Fetching from indexer API...");
      const response = await fetch(`${INDEXER_API}/api/proposals`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Indexer returned ${response.status}`);
      }

      const { proposals: indexedProposals } = (await response.json()) as {
        proposals: RawProposal[];
      };
      console.log(
        `✅ [Tier 2] Success: ${indexedProposals.length} proposals found.`,
      );

      return indexedProposals;
    } catch (err) {
      console.warn("[Tier 2] Indexer unavailable:", err);
      return null;
    }
  }, []);

  // ============================================================================
  // TIER 3: Direct Blockchain Scan (Helper)
  // ============================================================================
  const scanBlockchainRange = useCallback(
    async (fromBlock: number, toBlock: number): Promise<RawProposal[]> => {
      if (!provider || !contracts.governor) return [];
      console.log(`⛓️ [Tier 3] Scanning blocks ${fromBlock} to ${toBlock}...`);

      const proposalCreatedIface = new ethers.Interface([
        "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
      ]);

      const proposalPackageIface = new ethers.Interface([
        "event ProposalPackageCreated(uint256 indexed proposalId, bytes32 indexed projectId, string ipfsCID, address targetAddress)",
      ]);

      let newProposals: RawProposal[] = [];
      const packageInfoMap = new Map<
        string,
        { cid: string; projectId: string; targetAddress: string }
      >();
      const governorAddress = await contracts.governor.getAddress();

      try {
        // 1. Fetch Package Events
        const packageLogs = await provider.getLogs({
          address: governorAddress,
          topics: [
            ethers.id("ProposalPackageCreated(uint256,bytes32,string,address)"),
          ],
          fromBlock,
          toBlock,
        });

        packageLogs.forEach((log) => {
          try {
            const parsed = proposalPackageIface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            if (parsed?.args.proposalId) {
              packageInfoMap.set(parsed.args.proposalId.toString(), {
                cid: parsed.args.ipfsCID,
                projectId: parsed.args.projectId,
                targetAddress: parsed.args.targetAddress,
              });
            }
          } catch (e) {
            console.error("Error parsing package log:", e);
          }
        });

        // 2. Fetch Proposal Events
        const proposalLogs = await provider.getLogs({
          address: governorAddress,
          topics: [
            ethers.id(
              "ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)",
            ),
          ],
          fromBlock,
          toBlock,
        });

        newProposals = proposalLogs
          .map((log) => {
            try {
              const parsed = proposalCreatedIface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              });
              if (!parsed?.args) return null;

              const id = parsed.args.proposalId.toString();
              const pkg = packageInfoMap.get(id);

              // Access 'values' by index since parsed.args.values conflicts with Result.values()
              const valuesArray = parsed.args[3];

              return {
                id,
                proposer: parsed.args.proposer,
                targets: parsed.args.targets,
                values: valuesArray.map((v: bigint) => v.toString()),
                calldatas: parsed.args.calldatas,
                description: parsed.args.description,
                voteStart: parsed.args.voteStart.toString(),
                voteEnd: parsed.args.voteEnd.toString(),
                blockNumber: log.blockNumber,
                ipfsCID: pkg?.cid || null,
                projectId: pkg?.projectId,
                targetAddress: pkg?.targetAddress,
              } as RawProposal;
            } catch (e) {
              console.error("Error parsing proposal log", e);
              return null;
            }
          })
          .filter((p): p is RawProposal => p !== null);
      } catch (error) {
        console.error("[Tier 3] Scan failed:", error);
      }

      console.log(`✅ [Tier 3] Found ${newProposals.length} items in range.`);
      return newProposals;
    },
    [provider, contracts.governor],
  );

  // ============================================================================
  // Main Fetch Strategy: Hybrid / Sovereign
  // ============================================================================
  const fetchProposals = useCallback(async (): Promise<RawProposal[]> => {
    if (!provider || !contracts.governor) return [];

    let currentBlockNumber: number;
    try {
      currentBlockNumber = await provider.getBlockNumber();
    } catch (err) {
      console.error("Failed to get current block number:", err);
      return [];
    }

    // 1. Load Local State (Tier 1)
    const cached = loadFromCache();
    const lastScanned = cached
      ? cached.lastScannedBlock
      : Number(deploymentBlock) - 1;
    const knownProposals = cached ? cached.proposals : [];

    // 2. Run Tier 2 (Indexer) & Tier 3 (Blockchain) in Parallel
    console.log(
      `🚀 Starting Hybrid Scan (Last Block: ${lastScanned}, Current: ${currentBlockNumber})`,
    );

    const [indexerResult, blockchainResult] = await Promise.allSettled([
      fetchFromIndexer(),
      // Only scan new blocks from blockchain to keep it fast
      scanBlockchainRange(lastScanned + 1, currentBlockNumber),
    ]);

    const indexerProposals =
      indexerResult.status === "fulfilled" ? indexerResult.value : null;
    const newOnChainProposals =
      blockchainResult.status === "fulfilled" ? blockchainResult.value : [];

    // 3. Merge Blockchain Data (Frontend Truth)
    // Combine cached proposals + newly found on-chain proposals
    const allOnChainProposalsMap = new Map<string, RawProposal>();
    knownProposals.forEach((p) => allOnChainProposalsMap.set(p.id, p));
    newOnChainProposals?.forEach((p) => allOnChainProposalsMap.set(p.id, p));

    const frontendProposals = Array.from(allOnChainProposalsMap.values());

    // 4. Audit & Merge Backend Data
    // We use the frontend scan as the "base" truth, but we check if backend has more.
    const finalProposalsMap = new Map<string, RawProposal>();

    // Add Frontend data first
    frontendProposals.forEach((p) => finalProposalsMap.set(p.id, p));

    if (indexerProposals) {
      const frontendIds = new Set(frontendProposals.map((p) => p.id));
      const backendIds = new Set(indexerProposals.map((p) => p.id));

      // Check for discrepancies
      frontendProposals.forEach((p) => {
        if (!backendIds.has(p.id)) {
          console.warn(
            `⚠️ Sovereign Alert: Frontend found Proposal ${p.id} but Backend missed it!`,
          );
        }
      });

      indexerProposals.forEach((p) => {
        if (!frontendIds.has(p.id)) {
          console.info(
            `ℹ️ Backend found older Proposal ${p.id} (Frontend missed/cache cold). Merging it.`,
          );
          finalProposalsMap.set(p.id, p);
        }
      });
    }

    const finalProposals = Array.from(finalProposalsMap.values());

    // 5. Update Cache
    if (
      (newOnChainProposals && newOnChainProposals.length > 0) ||
      (indexerProposals && !cached)
    ) {
      saveToCache({
        lastScannedBlock: currentBlockNumber,
        proposals: finalProposals,
        timestamp: Date.now(),
      });
    }

    return finalProposals;
  }, [
    provider,
    contracts.governor,
    loadFromCache,
    saveToCache,
    fetchFromIndexer,
    scanBlockchainRange,
    deploymentBlock,
  ]);

  // ============================================================================
  // Main Data Fetching Logic
  // ============================================================================
  const fetchAllData = useCallback(async () => {
    if (
      isInitializing ||
      !contracts.governor ||
      !contracts.registry ||
      !provider
    ) {
      console.log("fetchAllData skipped: Core dependencies not ready.");
      setIsLoading(false);
      return;
    }

    console.log("Fetching all governance data...");
    setIsLoading(true);

    let currentProxyAddress: string | null = null;
    let currentBeaconAddress: string | null = null;
    if (
      selectedProject?.proxyAddress &&
      ethers.isAddress(selectedProject.proxyAddress) &&
      selectedProject?.beaconAddress &&
      ethers.isAddress(selectedProject.beaconAddress)
    ) {
      currentProxyAddress = selectedProject.proxyAddress;
      currentBeaconAddress = selectedProject.beaconAddress;
    } else {
      console.log(
        "   No project selected or invalid proxy address. Clearing proxy info.",
      );
      setProxyInfo({ address: "", beacon: "", implementation: "" });
      setUpgradeHistory([]);
    }

    try {
      const blockNumToUse = await provider.getBlockNumber();
      setCurrentBlockNum(blockNumToUse);
      console.log(`   Using block number: ${blockNumToUse} for fetches`);

      const results = await Promise.allSettled([
        // Governance Params
        Promise.resolve().then(async () => {
          console.log("   Fetching governance params...");
          try {
            const [delay, period, quorumNum, timelockAddress] =
              await Promise.all([
                contracts.governor!.votingDelay(),
                contracts.governor!.votingPeriod(),
                contracts.governor!.quorum(
                  blockNumToUse > 0 ? blockNumToUse - 1 : 0,
                ),
                contracts.governor!.timelock(),
              ]);

            // Fetch minDelay from timelock contract
            let minDelayValue = 0;
            if (timelockAddress && provider) {
              try {
                const timelockAbi = [
                  "function getMinDelay() view returns (uint256)",
                ];
                const timelockContract = new ethers.Contract(
                  timelockAddress,
                  timelockAbi,
                  provider,
                );
                minDelayValue = Number(await timelockContract.getMinDelay());
              } catch (timelockErr) {
                console.error(
                  "   Failed to fetch timelock minDelay:",
                  timelockErr,
                );
              }
            }

            console.log("   Governance params fetched.");
            return {
              votingDelay: Number(delay),
              votingPeriod: Number(period),
              quorum: Number(quorumNum),
              minDelay: minDelayValue,
            };
          } catch (err) {
            console.error("   Failed to fetch governance params:", err);
            return {
              votingDelay: 0,
              votingPeriod: 0,
              confirmationPeriod: 0,
              quorum: 0,
              minDelay: 0,
            };
          }
        }),

        // Stakeholders
        Promise.resolve().then(async () => {
          console.log("   Fetching stakeholder events...");
          try {
            const addedFilter = contracts.governor!.filters.StakeholderAdded();
            const removedFilter =
              contracts.governor!.filters.StakeholderRemoved();

            // Also fetch IdentitySet events to get usernames
            const identitySetIface = new ethers.Interface([
              "event IdentitySet(address indexed account, string key, string value)",
            ]);
            const governorAddress = await contracts.governor!.getAddress();

            const [addedEvents, removedEvents, identityLogs] =
              await Promise.all([
                contracts.governor!.queryFilter(
                  addedFilter,
                  Number(deploymentBlock),
                  "latest",
                ),
                contracts.governor!.queryFilter(
                  removedFilter,
                  Number(deploymentBlock),
                  "latest",
                ),
                provider!.getLogs({
                  address: governorAddress,
                  topics: [ethers.id("IdentitySet(address,string,string)")],
                  fromBlock: Number(deploymentBlock),
                  toBlock: "latest",
                }),
              ]);
            console.log(
              `   Found ${addedEvents.length} added, ${removedEvents.length} removed stakeholder events, ${identityLogs.length} identity events.`,
            );

            // Build identity map from IdentitySet events (latest github username per address)
            const identityMap = new Map<
              string,
              { github: string; blockNumber: number }
            >();
            identityLogs.forEach((log) => {
              try {
                const parsed = identitySetIface.parseLog({
                  topics: log.topics as string[],
                  data: log.data,
                });
                if (parsed) {
                  const address = (
                    parsed.args.account as string
                  )?.toLowerCase();
                  const key = parsed.args.key as string;
                  const value = parsed.args.value as string;

                  // Only track "github" key for now
                  if (address && key === "github" && log.blockNumber) {
                    const existing = identityMap.get(address);
                    if (!existing || log.blockNumber > existing.blockNumber) {
                      identityMap.set(address, {
                        github: value,
                        blockNumber: log.blockNumber,
                      });
                    }
                  }
                }
              } catch (e) {
                console.error("Error parsing IdentitySet log:", e);
              }
            });

            // Track added stakeholders by address
            const addedMap = new Map<string, { blockNumber: number }>();
            addedEvents.forEach((e) => {
              const eventLog = e as ethers.EventLog;
              const address = (eventLog.args?.account as string)?.toLowerCase();
              if (address && eventLog.blockNumber !== undefined) {
                if (
                  !addedMap.has(address) ||
                  eventLog.blockNumber > addedMap.get(address)!.blockNumber
                ) {
                  addedMap.set(address, {
                    blockNumber: eventLog.blockNumber,
                  });
                }
              }
            });

            const removedMap = new Map<string, { blockNumber: number }>();
            removedEvents.forEach((e) => {
              const eventLog = e as ethers.EventLog;
              const address = (eventLog.args?.account as string)?.toLowerCase();
              if (address && eventLog.blockNumber !== undefined) {
                if (
                  !removedMap.has(address) ||
                  eventLog.blockNumber > removedMap.get(address)!.blockNumber
                ) {
                  removedMap.set(address, {
                    blockNumber: eventLog.blockNumber,
                  });
                }
              }
            });

            const currentStakeholders: Stakeholder[] = [];
            for (const [address, addedInfo] of addedMap.entries()) {
              const removedInfo = removedMap.get(address);
              if (
                !removedInfo ||
                (removedInfo && addedInfo.blockNumber > removedInfo.blockNumber)
              ) {
                // Get github from identity events, fallback to empty string
                const identity = identityMap.get(address);
                currentStakeholders.push({
                  address: ethers.getAddress(address),
                  github: identity?.github || "",
                });
              }
            }
            console.log(
              `   Reconciled to ${currentStakeholders.length} stakeholders.`,
            );
            return currentStakeholders;
          } catch (err) {
            console.error("   Failed to fetch/reconcile stakeholders:", err);
            return [];
          }
        }),

        // Bots
        Promise.resolve().then(async () => {
          console.log("   Fetching bot events...");
          try {
            const botAddedFilter = contracts.governor!.filters.BotAdded();
            const botRemovedFilter = contracts.governor!.filters.BotRemoved();
            const [botAddedEvents, botRemovedEvents] = await Promise.all([
              contracts.governor!.queryFilter(
                botAddedFilter,
                Number(deploymentBlock),
                "latest",
              ),
              contracts.governor!.queryFilter(
                botRemovedFilter,
                Number(deploymentBlock),
                "latest",
              ),
            ]);
            console.log(
              `   Found ${botAddedEvents.length} added, ${botRemovedEvents.length} removed bot events.`,
            );

            const addedBotsMap = new Map<string, { blockNumber: number }>();
            botAddedEvents.forEach((e) => {
              const eventLog = e as ethers.EventLog;
              const address = (
                eventLog.args?.botAddress as string
              )?.toLowerCase();
              if (address && e.blockNumber !== undefined) {
                if (
                  !addedBotsMap.has(address) ||
                  e.blockNumber > addedBotsMap.get(address)!.blockNumber
                ) {
                  addedBotsMap.set(address, { blockNumber: e.blockNumber });
                }
              }
            });

            const removedBotsMap = new Map<string, { blockNumber: number }>();
            botRemovedEvents.forEach((e) => {
              const eventLog = e as ethers.EventLog;
              const address = (
                eventLog.args?.botAddress as string
              )?.toLowerCase();
              if (address && e.blockNumber !== undefined) {
                if (
                  !removedBotsMap.has(address) ||
                  e.blockNumber > removedBotsMap.get(address)!.blockNumber
                ) {
                  removedBotsMap.set(address, { blockNumber: e.blockNumber });
                }
              }
            });

            const currentBots: Bot[] = [];
            for (const [address, addedInfo] of addedBotsMap.entries()) {
              const removedInfo = removedBotsMap.get(address);
              if (
                !removedInfo ||
                (removedInfo && addedInfo.blockNumber > removedInfo.blockNumber)
              ) {
                currentBots.push({ address: ethers.getAddress(address) });
              }
            }
            console.log(`   Reconciled to ${currentBots.length} bots.`);
            return currentBots;
          } catch (err) {
            console.error("   Failed to fetch/reconcile bots:", err);
            return [];
          }
        }),

        // Proposals (The new Hybrid Fetcher)
        fetchProposals(),

        // Beacon Address (Read Beacon Slot from Proxy for verification)
        currentProxyAddress
          ? provider!.getStorage(currentProxyAddress, EIP1967_BEACON_SLOT)
          : Promise.resolve(null),

        currentBeaconAddress && provider
          ? new ethers.Contract(
              currentBeaconAddress,
              BeaconABI,
              provider,
            ).implementation()
          : Promise.resolve(null),

        currentBeaconAddress && provider
          ? Promise.resolve().then(async () => {
              console.log(
                `   Fetching upgrade history for beacon: ${currentBeaconAddress}`,
              );
              try {
                // Use a minimal ABI containing only the Upgraded event
                const beaconContract = new ethers.Contract( // <-- CHANGED
                  currentBeaconAddress!,
                  BeaconABI, // <-- CHANGED
                  provider,
                );
                const filter = beaconContract.filters.Upgraded(); // Standard proxy event
                // Start scan from Registry deployment block (proxy deployed after/with registry)
                const events = await beaconContract.queryFilter(
                  filter,
                  Number(deploymentBlock),
                  "latest",
                );
                console.log(
                  `   Found ${events.length} Upgraded events for this beacon.`,
                );
                return events
                  .map((event, idx) => {
                    const eventLog = event as ethers.EventLog;
                    const implementationAddress =
                      eventLog.args && eventLog.args.implementation
                        ? (eventLog.args.implementation as string)
                        : "Unknown";
                    return {
                      version: `v1.${idx + 1}`, // Start from v1.1
                      address: implementationAddress,
                      date: new Date(), // Placeholder
                      blockNumber: event.blockNumber,
                    };
                  })
                  .reverse();
              } catch (err) {
                console.error("   Failed to fetch upgrade history:", err);
                return [];
              }
            })
          : Promise.resolve([]),
      ]);

      // Process results
      const [
        governanceParamsResult,
        stakeholdersResult,
        botsResult,
        proposalsResult,
        beaconSlotRes,
        implFromBeaconRes,
        historyRes,
      ] = results;

      // Governance Params
      if (governanceParamsResult.status === "fulfilled") {
        setGovernanceParams(governanceParamsResult.value);
      } else {
        console.error(
          "Error processing governance params:",
          governanceParamsResult.reason,
        );
      }

      // Stakeholders
      if (stakeholdersResult.status === "fulfilled") {
        setStakeholders(stakeholdersResult.value);
      } else {
        console.error(
          "Error processing stakeholders:",
          stakeholdersResult.reason,
        );
        setStakeholders([]);
      }

      // Bots
      if (botsResult.status === "fulfilled") {
        setBots(botsResult.value);
      } else {
        console.error("Error processing bots:", botsResult.reason);
        setBots([]);
      }

      // Proposals (with enrichment)
      let finalProposals: Proposal[] = [];
      if (proposalsResult.status === "fulfilled") {
        const rawProposals = proposalsResult.value;
        const enrichedPromises = rawProposals.map(
          async (p: RawProposal): Promise<Proposal | null> => {
            let state = 0;
            let votes: ProposalVotesStruct = {
              forVotes: 0n,
              againstVotes: 0n,
              abstainVotes: 0n,
            };

            try {
              if (contracts.governor) {
                const [stateResult, votesResult] = await Promise.all([
                  contracts.governor.state(BigInt(p.id)),
                  contracts.governor.proposalVotes(
                    BigInt(p.id),
                  ) as Promise<ProposalVotesStruct>,
                ]);
                state = Number(stateResult);
                votes = votesResult;
              }
            } catch (err) {
              console.error(
                `   Failed to fetch state/votes for proposal ${p.id}:`,
                err,
              );
            }

            if (
              !p.id ||
              !p.proposer ||
              p.description === undefined ||
              p.voteEnd === undefined
            ) {
              console.warn(
                "   Skipping enrichment for invalid raw proposal data:",
                p,
              );
              return null;
            }

            return {
              id: BigInt(p.id),
              ipfsCID: p.ipfsCID || undefined,
              targetAddress: p.targetAddress || undefined,
              description: p.description,
              proposer: p.proposer,
              status: statusMap[state] || "Unknown",
              votes: {
                for: BigInt(votes.forVotes ?? 0n),
                against: BigInt(votes.againstVotes ?? 0n),
                abstain: BigInt(votes.abstainVotes ?? 0n),
              },
              deadline: Number(p.voteEnd),
              targets: p.targets || [],
              values: (p.values || []).map((v: string) => BigInt(v)),
              calldatas: p.calldatas || [],
              projectId: p.projectId,
            };
          },
        );

        const enrichedResults = await Promise.allSettled(enrichedPromises);
        finalProposals = enrichedResults
          .filter(
            (result) => result.status === "fulfilled" && result.value !== null,
          )
          .map((result) => (result as PromiseFulfilledResult<Proposal>).value)
          .reverse();
        console.log(
          `   Enriched ${finalProposals.length} proposals successfully.`,
        );
      } else {
        console.error("Error fetching raw proposals:", proposalsResult.reason);
      }
      setProposals(finalProposals);

      // Proxy Info & History
      if (currentProxyAddress && currentBeaconAddress) {
        let beaconAddress = "Error";
        let implAddress = "Error";

        if (
          beaconSlotRes.status === "fulfilled" &&
          beaconSlotRes.value &&
          beaconSlotRes.value !== "0x"
        ) {
          try {
            const parsedBeaconAddress = ethers.getAddress(
              `0x${(beaconSlotRes.value as string).slice(-40)}`,
            );
            // Verify it matches what we were given from the project list
            if (
              parsedBeaconAddress.toLowerCase() !==
              currentBeaconAddress.toLowerCase()
            ) {
              console.warn(
                `Beacon address mismatch! SelectedProject: ${currentBeaconAddress}, Slot: ${parsedBeaconAddress}`,
              );
              beaconAddress = currentBeaconAddress; // Trust the registry mapping
            } else {
              beaconAddress = parsedBeaconAddress;
            }
          } catch (e) {
            console.error(
              "Error parsing beacon address from slot:",
              e,
              beaconSlotRes.value,
            );
            beaconAddress = currentBeaconAddress;
          }
        } else if (beaconSlotRes.status === "rejected") {
          console.error(
            "Error fetching proxy beacon slot:",
            beaconSlotRes.reason,
          );
          beaconAddress = currentBeaconAddress;
        } else {
          beaconAddress = currentBeaconAddress;
        }

        if (
          implFromBeaconRes.status === "fulfilled" &&
          implFromBeaconRes.value &&
          ethers.isAddress(implFromBeaconRes.value as string)
        ) {
          implAddress = implFromBeaconRes.value as string;
        } else if (implFromBeaconRes.status === "rejected") {
          console.error(
            "Error fetching implementation from beacon:",
            implFromBeaconRes.reason,
          );
        }

        console.log(
          `   Proxy Info Result: Beacon=${beaconAddress}, Impl=${implAddress}`,
        );
        setProxyInfo({
          address: currentProxyAddress,
          beacon: beaconAddress,
          implementation: implAddress,
        });

        // Process History
        if (historyRes.status === "fulfilled") {
          setUpgradeHistory(historyRes.value);
        } else if (historyRes.status === "rejected") {
          console.error("Error fetching upgrade history:", historyRes.reason);
          setUpgradeHistory([]);
        } else {
          setUpgradeHistory([]);
        }
      } else {
        // Ensure state is cleared if no project was selected
        setProxyInfo({ address: "", beacon: "", implementation: "" });
        setUpgradeHistory([]);
      }
    } catch (error) {
      console.error("Critical error during fetchAllData:", error);
    } finally {
      setIsLoading(false);
      console.log("Finished fetching all governance data.");
    }
  }, [
    isInitializing,
    contracts.governor,
    contracts.registry,
    provider,
    selectedProject,
    fetchProposals,
    deploymentBlock,
  ]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Trigger fetchAllData when dependencies change
  useEffect(() => {
    console.log("🔍 Dependency check:", {
      isInitializing,
      hasGovernor: !!contracts.governor,
      hasRegistry: !!contracts.registry,
      hasProvider: !!provider,
      selectedProject: selectedProject?.name || "none",
    });

    if (
      !isInitializing &&
      contracts.governor &&
      contracts.registry &&
      provider
    ) {
      console.log("✅ Dependencies ready, triggering fetchAllData.");
      fetchAllData();
    } else {
      console.log("⏸️ Fetch skipped, waiting for dependencies...");
      setProposals([]);
      setStakeholders([]);
      setBots([]);
      setUpgradeHistory([]);
      setGovernanceParams({
        votingDelay: 0,
        votingPeriod: 0,
        quorum: 0,
        minDelay: 0,
      });
      setProxyInfo({ address: "", beacon: "", implementation: "" });
      setIsLoading(!isInitializing);
    }
  }, [
    isInitializing,
    contracts.governor,
    contracts.registry,
    provider,
    selectedProject,
    fetchAllData,
  ]);

  // Stakeholder & Identity Event Listeners
  useEffect(() => {
    let finalAddedFilter: ListenerFilter | null = null;
    let finalRemovedFilter: ListenerFilter | null = null;
    let finalIdentityFilter: ListenerFilter | null = null;

    const handleStakeholderChange = (log: ethers.Log) => {
      console.log(
        `Stakeholder event detected (Block: ${log.blockNumber}), refreshing data...`,
      );
      fetchAllData();
    };

    const handleIdentityChange = (log: ethers.Log) => {
      console.log(
        `Identity event detected (Block: ${log.blockNumber}), refreshing data...`,
      );
      fetchAllData();
    };

    const setupListeners = async () => {
      if (!contracts.governor || !provider) {
        console.log(
          "Listener setup skipped: Provider or governor contract not ready.",
        );
        return;
      }
      console.log("Setting up stakeholder and identity event listeners...");

      try {
        const addedFilterPromise = contracts.governor.filters
          .StakeholderAdded()
          .getTopicFilter();
        const removedFilterPromise = contracts.governor.filters
          .StakeholderRemoved()
          .getTopicFilter();

        const [addedTopics, removedTopics] = await Promise.all([
          addedFilterPromise,
          removedFilterPromise,
        ]);

        const governorAddress = await contracts.governor.getAddress();
        finalAddedFilter = { address: governorAddress, topics: addedTopics };
        finalRemovedFilter = {
          address: governorAddress,
          topics: removedTopics,
        };

        // Add IdentitySet event filter
        const identityTopic = ethers.id("IdentitySet(address,string,string)");
        finalIdentityFilter = {
          address: governorAddress,
          topics: [identityTopic],
        };

        if (finalAddedFilter) {
          provider.on(finalAddedFilter, handleStakeholderChange);
        }
        if (finalRemovedFilter) {
          provider.on(finalRemovedFilter, handleStakeholderChange);
        }
        if (finalIdentityFilter) {
          provider.on(finalIdentityFilter, handleIdentityChange);
        }

        console.log("Stakeholder and identity event listeners attached.");
      } catch (error) {
        console.error("Error resolving filters or attaching listeners:", error);
      }
    };

    setupListeners();

    return () => {
      console.log("Cleaning up stakeholder and identity event listeners...");
      if (!provider) {
        console.warn("Cleanup skipped: Provider not available.");
        return;
      }
      try {
        if (finalAddedFilter) {
          provider.off(finalAddedFilter, handleStakeholderChange);
        }
        if (finalRemovedFilter) {
          provider.off(finalRemovedFilter, handleStakeholderChange);
        }
        if (finalIdentityFilter) {
          provider.off(finalIdentityFilter, handleIdentityChange);
        }
        console.log("Stakeholder and identity event listeners detached.");
      } catch (error) {
        console.error("Error detaching listeners:", error);
      }
    };
  }, [contracts.governor, provider, fetchAllData]);

  // Block Listener
  useEffect(() => {
    if (!provider) return;

    let isMounted = true;

    const onBlock = (blockNumber: number) => {
      if (isMounted) {
        console.log("New block detected:", blockNumber);
        setCurrentBlockNum(blockNumber);
      }
    };

    provider.on("block", onBlock);

    provider.getBlockNumber().then((num) => {
      if (isMounted) setCurrentBlockNum(num);
    });

    return () => {
      isMounted = false;
      provider.off("block", onBlock);
    };
  }, [provider]);

  return {
    proposals,
    stakeholders,
    bots,
    governanceParams,
    proxyInfo,
    upgradeHistory,
    isLoading,
    refreshData: fetchAllData,
    currentBlock: currentBlockNum > 0 ? currentBlockNum : null,
  };
}
