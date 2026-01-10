import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, QueryClient } from "@tanstack/react-query";
import { teamQueryOptions } from "../queries/teams";

import { useCallback, useEffect, useState } from "react";
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
import type { FormField, ModalContentType } from "../types";

// -- LIB ---
import { ProposeActionForm } from "../components/ProposeActionForm";
import { useTeamContracts } from "../hooks/useTeamContracts";

const beaconInterface = new ethers.Interface([
  "function upgradeTo(address newImplementation)",
]);

// Define the file route, which corresponds to the path /$teamId/dashboard
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
  // --- TANSTACK ROUTER HOOKS ---
  const params = Route.useParams();
  const { data: team } = useSuspenseQuery(teamQueryOptions(params.teamId));
  const deploymentBlock = BigInt(team.deploymentBlock ?? 0);

  const contractAddresses = {
    devOpsGovernor: team.governorAddress,
    deploymentRegistry: team.registryAddress,
  };

  // --- MAIN APPLICATION ---
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
    data: Record<string, string>,
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

        case "Add Bot":
          calldata = governorInterface.encodeFunctionData("addBot", [
            data.address,
          ]);
          description = `Add bot ${data.address}${nonceStr}`;
          break;

        case "Remove Bot":
          calldata = governorInterface.encodeFunctionData("removeBot", [
            data.address,
          ]);
          description = `Remove bot ${data.address}${nonceStr}`;
          break;

        case "Propose Package":
          if (!selectedProject) {
            alert("Please select a project first");
            return;
          }

          target = selectedProject.beaconAddress;
          calldata = beaconInterface.encodeFunctionData("upgradeTo", [
            data.targetAddress,
          ]);
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

        default:
          console.error(`Unknown proposal action: ${actionTitle}`);
          alert(`Error: Unknown proposal action.`);
          return;
      }

      if (actionTitle !== "Propose Package") {
        console.log("Submitting standard proposal...");
        tx = await contracts.governor.propose(
          [target],
          [value],
          [calldata],
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

  const openRemoveBotModal = (address: string) => {
    const fields: FormField[] = [
      {
        name: "address",
        label: "Bot Address",
        placeholder: "0x...",
        type: "text",
      },
    ];

    setModalContent({
      title: "Remove Bot",
      form: (
        <ProposeActionForm
          actionTitle="Remove Bot"
          fields={fields}
          onSubmit={(data) =>
            createProposal({ ...data, address }, "Remove Bot")
          }
          onClose={() => setModalOpen(false)}
        />
      ),
    });
    setModalOpen(true);
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
        label: "Target Address",
        placeholder: "0x...",
        type: "text",
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
          />
        </main>

        <aside className="w-full xl:w-[420px] 2xl:w-[480px] border-t xl:border-t-0 xl:border-l border-gray-800 p-6 xl:p-8 space-y-6 xl:space-y-8 shrink-0 overflow-y-auto">
          {/* GLOBAL: Governance Parameters */}
          <GovernanceParametersCard
            governanceParams={governanceParams}
            isLoading={isLoadingGovernance}
            onChangeVotingDelay={openChangeVotingDelayModal}
            onChangeVotingPeriod={openChangeVotingPeriodModal}
            onChangeMinDelay={openChangeMinDelayModal}
          />

          {/* GLOBAL: Core Contracts */}
          <ContractAddresses
            governorAddress={contractAddresses.devOpsGovernor}
            registryAddress={contractAddresses.deploymentRegistry}
          />

          {/* GLOBAL: Team & Roles */}
          <TeamList
            stakeholders={stakeholders}
            isLoading={isLoadingGovernance}
            currentUserAddress={account ?? undefined}
            onAddStakeholder={openAddStakeholderModal}
            onRemoveStakeholder={openRemoveStakeholderModal}
            onEditIdentity={openEditIdentityModal}
          />

          {/* GLOBAL: Bot Addresses */}
          <BotList
            bots={bots}
            isLoading={isLoadingGovernance}
            onAddBot={openAddBotModal}
            onRemoveBot={openRemoveBotModal}
          />

          <ProjectSelector
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            isLoading={isLoadingProjects}
            error={projectsError}
            hideRefreshButton={true}
            onCreateProject={openCreateProjectModal}
          />

          {selectedProject && (
            <ProxyInfoCard
              proxyInfo={displayProxyInfo}
              upgradeHistory={displayUpgradeHistory}
              isLoading={isLoadingGovernance}
              onProposePackage={openProposePackageModal}
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
