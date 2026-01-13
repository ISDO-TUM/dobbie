import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, QueryClient } from "@tanstack/react-query";
import { teamQueryOptions } from "../queries/teams";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

// -- HOOKS ---
import useWeb3Connection from "../hooks/useWeb3Connection";
import { useGovernanceData } from "../hooks/useGovernanceData";
import { useProjects } from "../hooks/useProjects";

// -- COMPONENTS ---
import { ProposalDashboard } from "../components/ProposalDashboard";
import { ContractAddresses } from "../components/ContractAddresses";
import { TeamList } from "../components/TeamList";
import { BotList } from "../components/BotList";
import { ProxyInfoCard } from "../components/ProxyInfoCard";
import { Modal } from "../components/Modal";
import { ProjectSelector } from "../components/ProjectSelector";
import { GovernanceParametersCard } from "../components/GovernanceParametersCard";

// -- TYPES ---
import type { Bot, FormField, ModalContentType } from "../types";

// -- LIB ---
import { ProposeActionForm } from "../components/ProposeActionForm";
import { useTeamContracts } from "../hooks/useTeamContracts";

export const Route = createFileRoute("/$teamId_/dashboard")({
  loader: async ({ context, params }) => {
    const queryClient = (context as { queryClient: QueryClient }).queryClient;
    await queryClient.ensureQueryData(teamQueryOptions(params.teamId));
    return {};
  },

  component: TeamDashboard,

  errorComponent: ({ error }) => {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return (
      <div className="p-10 text-center bg-red-50 text-red-700 border border-red-200 rounded-lg">
        <h2 className="text-xl font-bold">Error Loading Team Dashboard</h2>
        <p className="mt-2">{message}</p>
      </div>
    );
  },
});

function TeamDashboard() {
  const params = Route.useParams();
  const { data: team } = useSuspenseQuery(teamQueryOptions(params.teamId));
  const deploymentBlock = BigInt(team.deploymentBlock ?? 0);

  const contractAddresses = {
    devOpsGovernor: team.governorAddress,
    deploymentRegistry: team.registryAddress,
  };

  const { provider, account, isInitializing } = useWeb3Connection();

  const contracts = useTeamContracts({
    governorAddress: team.governorAddress,
    registryAddress: team.registryAddress,
  });

  const {
    projects,
    selectedProject,
    setSelectedProject,
    isLoading: isLoadingProjects,
    error: projectsError,
    refreshProjects,
  } = useProjects(contracts.registry, deploymentBlock);

  const {
    proposals,
    stakeholders,
    bots,
    governanceParams,
    proxyInfo,
    upgradeHistory,
    isLoading: isLoadingGovernance,
    refreshData: refreshGovernanceData,
    currentBlock,
  } = useGovernanceData({
    provider,
    contracts,
    contractAddresses,
    isInitializing,
    selectedProject,
    deploymentBlock,
  });

  // Check if current user is a stakeholder (can interact with governance)
  const isStakeholder = useMemo(() => {
    if (!account) return false;
    return stakeholders.some(
      (s) => s.address.toLowerCase() === account.toLowerCase(),
    );
  }, [account, stakeholders]);

  // Combine refresh functions
  const handleRefresh = useCallback(() => {
    console.log("Refreshing all data...");
    refreshProjects();
    refreshGovernanceData();
  }, [refreshProjects, refreshGovernanceData]);

  // --- UI STATE ---
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<ModalContentType>({
    title: "",
    form: null,
  });

  const displayProxyInfo = selectedProject
    ? proxyInfo
    : { address: "", beacon: "", implementation: "" };
  const displayUpgradeHistory = selectedProject ? upgradeHistory : [];

  // --- PROPOSAL CREATION HELPER ---
  const createProposal = async (
    data: Record<string, string | string[] | Bot>,
    actionTitle: string,
  ) => {
    if (!contracts.governor || !contracts.registry || !account) {
      alert("Please connect your wallet first.");
      return;
    }

    const governorInterface = contracts.governor.interface;
    const registryInterface = contracts.registry.interface;

    try {
      let tx;
      let calldata: string = "";
      let description: string = "";
      let target: string = contractAddresses.devOpsGovernor;
      const targets: string[] = [];
      const values: bigint[] = [];
      const calldatas: string[] = [];
      const value = 0n;
      const nonce = Date.now();
      const nonceStr = `\n\n# salt: ${nonce}`;

      switch (actionTitle) {
        case "Create Project":
          target = contractAddresses.deploymentRegistry;
          calldata = registryInterface.encodeFunctionData(
            "registerNewProject",
            [data.projectName],
          );
          description = `Register new project: "${data.projectName}"${nonceStr}`;
          break;

        case "Change Voting Delay":
          calldata = governorInterface.encodeFunctionData("setVotingDelay", [
            data.newVotingDelay,
          ]);
          description = `Change voting delay to ${data.newVotingDelay} blocks${nonceStr}`;
          break;

        case "Change Voting Period":
          calldata = governorInterface.encodeFunctionData("setVotingPeriod", [
            data.newVotingPeriod,
          ]);
          description = `Change voting period to ${data.newVotingPeriod} blocks${nonceStr}`;
          break;

        case "Change Min Delay": {
          // Timelock's updateDelay must be called by the timelock itself
          // So we target the timelock contract
          const timelockAddress = await contracts.governor.timelock();
          target = timelockAddress;
          const timelockInterface = new ethers.Interface([
            "function updateDelay(uint256 newDelay)",
          ]);
          calldata = timelockInterface.encodeFunctionData("updateDelay", [
            data.newMinDelay,
          ]);
          description = `Change timelock min delay to ${data.newMinDelay} seconds${nonceStr}`;
          break;
        }

        case "Add Stakeholder":
          calldata = governorInterface.encodeFunctionData("addStakeholder", [
            data.address,
          ]);
          description = `Add stakeholder ${data.address}${nonceStr}`;
          break;

        case "Remove Stakeholder":
          calldata = governorInterface.encodeFunctionData("removeStakeholder", [
            data.address,
          ]);
          description = `Remove stakeholder ${data.address}${nonceStr}`;
          break;

        case "Add Bot": {
          const roles = Array.isArray(data.role) ? data.role : [data.role];
          const rolesToAdd: { hash: string; name: string }[] = [];

          if (roles.includes("proposer")) {
            rolesToAdd.push({
              hash: ethers.keccak256(ethers.toUtf8Bytes("PROPOSER_ROLE")),
              name: "Proposer",
            });
          }
          if (roles.includes("propagator")) {
            rolesToAdd.push({
              hash: ethers.keccak256(ethers.toUtf8Bytes("PROPAGATOR_ROLE")),
              name: "Propagator",
            });
          }

          if (rolesToAdd.length === 0) {
            alert("Please select at least one role");
            return; // Don't proceed
          }

          rolesToAdd.forEach((r) => {
            targets.push(contractAddresses.devOpsGovernor);
            values.push(0n);
            calldatas.push(
              governorInterface.encodeFunctionData("addBot", [
                data.address,
                r.hash,
              ]),
            );
          });

          const rolesStr = rolesToAdd.map((r) => r.name).join(" & ");
          description = `Add ${rolesStr} bot ${data.address}${nonceStr}`;
          break;
        }

        case "Remove Bot": {
          const bot = data.bot as Bot;
          const rolesToRemove: { hash: string; name: string }[] = [];

          if (bot.isProposer) {
            rolesToRemove.push({
              hash: ethers.keccak256(ethers.toUtf8Bytes("PROPOSER_ROLE")),
              name: "Proposer",
            });
          }
          if (bot.isPropagator) {
            rolesToRemove.push({
              hash: ethers.keccak256(ethers.toUtf8Bytes("PROPAGATOR_ROLE")),
              name: "Propagator",
            });
          }

          rolesToRemove.forEach((role) => {
            targets.push(contractAddresses.devOpsGovernor);
            values.push(0n);
            calldatas.push(
              governorInterface.encodeFunctionData("removeBot", [
                bot.address,
                role.hash,
              ]),
            );
          });

          const rolesStr = rolesToRemove.map((r) => r.name).join(" & ");
          description = `Remove ${rolesStr} role(s) from bot ${bot.address}${nonceStr}`;
          break;
        }

        case "Propose Package": {
          if (!selectedProject) {
            alert("Please select a project first");
            return;
          }

          const API_URL =
            import.meta.env.VITE_API_URL || "/api";

          alert(
            "Generating proposal calldata from IPFS package... This may take a moment.",
          );

          // Parse constructor arguments if provided
          let constructorArgs: string[] | undefined;
          if (
            typeof data.constructorArgs === "string" &&
            data.constructorArgs.trim()
          ) {
            try {
              constructorArgs = JSON.parse(data.constructorArgs);
              if (!Array.isArray(constructorArgs)) {
                throw new Error("Constructor args must be a JSON array");
              }
            } catch (e) {
              throw new Error(
                `Invalid constructor args format. Must be a JSON array like ["0x123...", "value"]. Error: ${e}`,
              );
            }
          }

          const calldataResponse = await fetch(
            `${API_URL}/proposals/generate-calldata`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ipfsCID: data.ipfsCID,
                projectId: selectedProject.id,
                registryAddress: contractAddresses.deploymentRegistry,
                constructorArgs,
              }),
            },
          );

          if (!calldataResponse.ok) {
            const errorData = await calldataResponse.json().catch(() => ({}));
            throw new Error(
              errorData.message || "Failed to generate calldata from package",
            );
          }

          const calldataResult = await calldataResponse.json();

          // Verify the expected address matches what the user provided
          if (
            calldataResult.expectedAddress.toLowerCase() !==
            (data.targetAddress as string).toLowerCase()
          ) {
            throw new Error(
              `Address mismatch! Expected: ${calldataResult.expectedAddress}, Provided: ${data.targetAddress}. ` +
                `Make sure the target address is computed from the correct IPFS package.`,
            );
          }

          target = calldataResult.target; // Registry address
          calldata = calldataResult.calldata;
          description = `Upgrade ${selectedProject.name} to implementation ${data.targetAddress}${nonceStr}`;

          tx = await contracts.governor.proposePackage(
            [target],
            [value],
            [calldata],
            description,
            selectedProject.id,
            data.ipfsCID,
            data.targetAddress,
          );
          break;
        }

        default:
          console.error(`Unknown proposal action: ${actionTitle}`);
          alert(`Error: Unknown proposal action.`);
          return;
      }

      if (actionTitle !== "Propose Package") {
        console.log("Submitting standard proposal...");
        const finalTargets = targets.length > 0 ? targets : [target];
        const finalValues = values.length > 0 ? values : [value];
        const finalCalldatas = calldatas.length > 0 ? calldatas : [calldata];

        tx = await contracts.governor.propose(
          finalTargets,
          finalValues,
          finalCalldatas,
          description,
        );
      }

      alert(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
      await tx.wait();
      alert("Proposal created successfully!");
      handleRefresh();
      setModalOpen(false);
    } catch (error) {
      console.error("Failed to create proposal:", error);
      const message = getErrorMessage(error);
      alert(`Failed to create proposal: ${message}`);
    }
  };

  const getErrorMessage = (error: unknown): string => {
    if (error == null) return "Unknown error";
    if (typeof error === "object") {
      const e = error as {
        reason?: unknown;
        message?: unknown;
        data?: { message?: string };
      };
      if (typeof e.reason === "string" && e.reason) return e.reason;
      if (typeof e.message === "string" && e.message) return e.message;
      if (e.data && typeof e.data.message === "string" && e.data.message)
        return e.data.message;
    }
    return String(error);
  };

  // --- MODAL HANDLERS ---
  const openCreateProjectModal = () => {
    const fields: FormField[] = [
      {
        name: "projectName",
        label: "Project Name",
        placeholder: "e.g., MyProject",
        type: "text",
      },
    ];

    setModalContent({
      title: "Create New Project",
      form: (
        <ProposeActionForm
          actionTitle="Create Project"
          fields={fields}
          onSubmit={(data) => createProposal(data, "Create Project")}
          onClose={() => setModalOpen(false)}
        />
      ),
    });
    setModalOpen(true);
  };

  const openAddStakeholderModal = () => {
    const fields: FormField[] = [
      {
        name: "address",
        label: "Address",
        placeholder: "0x...",
        type: "text",
      },
      {
        name: "github",
        label: "GitHub Username",
        placeholder: "username",
        type: "text",
      },
    ];

    setModalContent({
      title: "Add Stakeholder",
      form: (
        <ProposeActionForm
          actionTitle="Add Stakeholder"
          fields={fields}
          onSubmit={(data) => createProposal(data, "Add Stakeholder")}
          onClose={() => setModalOpen(false)}
        />
      ),
    });
    setModalOpen(true);
  };

  const openRemoveStakeholderModal = (address: string) => {
    createProposal({ address }, "Remove Stakeholder");
  };

  const openAddBotModal = () => {
    const fields: FormField[] = [
      {
        name: "address",
        label: "Bot Address",
        placeholder: "0x...",
        type: "text",
      },
      {
        name: "role",
        label: "Bot Roles",
        placeholder: "",
        type: "checkbox-group",
        multiSelect: true,
        options: [
          { value: "proposer", label: "Proposer (can submit package proposals)" },
          { value: "propagator", label: "Propagator (can queue and execute)" },
        ],
      },
    ];

    setModalContent({
      title: "Add Bot",
      form: (
        <ProposeActionForm
          actionTitle="Add Bot"
          fields={fields}
          onSubmit={(data) => createProposal(data, "Add Bot")}
          onClose={() => setModalOpen(false)}
        />
      ),
    });
    setModalOpen(true);
  };

  const handleRemoveBot = (bot: Bot) => {
    if (window.confirm(`Remove all roles from bot ${bot.address}?`)) {
      createProposal({ bot }, "Remove Bot");
    }
  };

  const openProposePackageModal = () => {
    if (!selectedProject) {
      alert("Please select a project first");
      return;
    }

    const fields: FormField[] = [
      {
        name: "ipfsCID",
        label: "Package IPFS CID",
        placeholder: "Qm...",
        type: "text",
      },
      {
        name: "targetAddress",
        label: "Expected Implementation Address",
        placeholder: "0x... (computed CREATE2 address)",
        type: "text",
      },
      {
        name: "constructorArgs",
        label: "Constructor Arguments (JSON array, optional)",
        placeholder: '["0xProductAddress", "0xOtherArg"]',
        type: "text",
        optional: true,
      },
    ];

    setModalContent({
      title: `Propose Package for ${selectedProject.name}`,
      form: (
        <ProposeActionForm
          actionTitle="Propose Package"
          fields={fields}
          onSubmit={(data) => createProposal(data, "Propose Package")}
          onClose={() => setModalOpen(false)}
        />
      ),
    });
    setModalOpen(true);
  };

  const openChangeVotingDelayModal = () => {
    const fields: FormField[] = [
      {
        name: "newVotingDelay",
        label: "New Voting Delay (Blocks)",
        placeholder: "e.g., 1",
        type: "number",
      },
    ];

    setModalContent({
      title: "Change Voting Delay",
      form: (
        <ProposeActionForm
          actionTitle="Change Voting Delay"
          fields={fields}
          onSubmit={(data) => createProposal(data, "Change Voting Delay")}
          onClose={() => setModalOpen(false)}
        />
      ),
    });
    setModalOpen(true);
  };

  const openChangeVotingPeriodModal = () => {
    const fields: FormField[] = [
      {
        name: "newVotingPeriod",
        label: "New Voting Period (Blocks)",
        placeholder: "e.g., 5760",
        type: "number",
      },
    ];

    setModalContent({
      title: "Change Voting Period",
      form: (
        <ProposeActionForm
          actionTitle="Change Voting Period"
          fields={fields}
          onSubmit={(data) => createProposal(data, "Change Voting Period")}
          onClose={() => setModalOpen(false)}
        />
      ),
    });
    setModalOpen(true);
  };

  const openChangeMinDelayModal = () => {
    const fields: FormField[] = [
      {
        name: "newMinDelay",
        label: "New Min Delay (Seconds)",
        placeholder: "e.g., 7200 (2 hours)",
        type: "number",
      },
    ];

    setModalContent({
      title: "Change Timelock Min Delay",
      form: (
        <ProposeActionForm
          actionTitle="Change Min Delay"
          fields={fields}
          onSubmit={(data) => createProposal(data, "Change Min Delay")}
          onClose={() => setModalOpen(false)}
        />
      ),
    });
    setModalOpen(true);
  };

  const openEditIdentityModal = () => {
    const fields: FormField[] = [
      {
        name: "username",
        label: "GitHub Username",
        placeholder: "your-github-username",
        type: "text",
      },
    ];

    setModalContent({
      title: "Edit Your Identity",
      form: (
        <ProposeActionForm
          actionTitle="Update Identity"
          fields={fields}
          onSubmit={async (data) => {
            if (!contracts.governor || !account) {
              alert("Please connect your wallet first.");
              return;
            }

            try {
              const tx = await contracts.governor.setIdentity(
                "github",
                data.username,
              );
              alert(
                `Transaction sent: ${tx.hash}. Waiting for confirmation...`,
              );
              await tx.wait();
              alert("Identity updated successfully!");
              handleRefresh();
              setModalOpen(false);
            } catch (error) {
              console.error("Failed to update identity:", error);
              const message = getErrorMessage(error);
              alert(`Failed to update identity: ${message}`);
            }
          }}
          onClose={() => setModalOpen(false)}
        />
      ),
    });
    setModalOpen(true);
  };

  useEffect(() => {
    console.log("Selected project changed in App:", selectedProject);
  }, [selectedProject]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 font-sans">
      <div className="flex flex-col xl:flex-row">
        <main className="flex-1 min-w-0">
          <ProposalDashboard
            proposals={proposals}
            isLoading={isLoadingGovernance}
            contracts={contracts}
            account={account}
            onVoteSuccess={handleRefresh}
            currentBlock={currentBlock}
            bots={bots}
            onRefresh={handleRefresh}
            canInteract={isStakeholder}
          />
        </main>

        <aside className="w-full xl:w-[420px] 2xl:w-[480px] border-t xl:border-t-0 xl:border-l border-gray-800 p-6 xl:p-8 space-y-6 xl:space-y-8 shrink-0 overflow-y-auto">
          {/* Governance Parameters */}
          <GovernanceParametersCard
            governanceParams={governanceParams}
            isLoading={isLoadingGovernance}
            onChangeVotingDelay={openChangeVotingDelayModal}
            onChangeVotingPeriod={openChangeVotingPeriodModal}
            onChangeMinDelay={openChangeMinDelayModal}
            canInteract={isStakeholder}
          />

          {/* Core Contracts */}
          <ContractAddresses
            governorAddress={contractAddresses.devOpsGovernor}
            registryAddress={contractAddresses.deploymentRegistry}
          />

          {/* Team & Roles */}
          <TeamList
            stakeholders={stakeholders}
            isLoading={isLoadingGovernance}
            currentUserAddress={account ?? undefined}
            onAddStakeholder={openAddStakeholderModal}
            onRemoveStakeholder={openRemoveStakeholderModal}
            onEditIdentity={openEditIdentityModal}
            canInteract={isStakeholder}
          />

          {/* Bot Addresses */}
          <BotList
            bots={bots}
            isLoading={isLoadingGovernance}
            onAddBot={openAddBotModal}
            onRemoveBot={handleRemoveBot}
            canInteract={isStakeholder}
          />

          <ProjectSelector
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            isLoading={isLoadingProjects}
            error={projectsError}
            hideRefreshButton={true}
            onCreateProject={openCreateProjectModal}
            canInteract={isStakeholder}
          />

          {selectedProject && (
            <ProxyInfoCard
              proxyInfo={displayProxyInfo}
              upgradeHistory={displayUpgradeHistory}
              isLoading={isLoadingGovernance}
              onProposePackage={openProposePackageModal}
              canInteract={isStakeholder}
            />
          )}
        </aside>
      </div>

      {/* Modal */}
      <Modal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalContent.title}
      >
        {modalContent.form}
      </Modal>
    </div>
  );
}
