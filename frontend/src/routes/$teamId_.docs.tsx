import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, QueryClient } from "@tanstack/react-query";
import { teamQueryOptions } from "../queries/teams";
import { useTeamContracts } from "../hooks/useTeamContracts";
import { useProjects } from "../hooks/useProjects";
import {
  Book,
  Github,
  GitlabIcon,
  Copy,
  Check,
  Shield,
  Key,
  Server,
  AlertTriangle,
  ExternalLink,
  Users,
  Plus,
  ChevronDown,
  GitBranch,
  Lock,
  CheckSquare,
  Square,
} from "lucide-react";
import { useState } from "react";
import { useGovernanceData } from "../hooks/useGovernanceData";
import useWeb3Connection from "../hooks/useWeb3Connection";
import { CopyButton } from "../components/ui/CopyButton";
import { truncateAddress } from "../lib/utils";

export const Route = createFileRoute("/$teamId_/docs")({
  loader: async ({ context, params }) => {
    const queryClient = (context as { queryClient: QueryClient }).queryClient;
    await queryClient.ensureQueryData(teamQueryOptions(params.teamId));
    return {};
  },
  component: TeamDocs,
});

function TeamDocs() {
  const params = Route.useParams();
  const { data: team } = useSuspenseQuery(teamQueryOptions(params.teamId));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-300">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-600/30">
              <Book className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                Integration Documentation
              </h1>
              <p className="text-gray-400 mt-1">
                Configure your CI/CD pipeline to work with Dobby governance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6">
            <Link
              to="/$teamId/dashboard"
              params={{ teamId: params.teamId }}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Team Contract Addresses */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-400" />
            Your Contract Addresses
          </h2>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
            <CopyableField
              label="Governor Address"
              value={team.governorAddress}
              description="The main governance contract that manages proposals and voting"
            />
            <CopyableField
              label="Registry Address"
              value={team.registryAddress}
              description="The deployment registry that tracks your projects"
            />
            {team.deploymentBlock && (
              <CopyableField
                label="Deployment Block"
                value={String(team.deploymentBlock)}
                description="The block number when the contracts were deployed (used for event scanning)"
              />
            )}
          </div>
        </section>

        {/* Provider Tabs */}
        <ProviderDocs team={team} />

        {/* Common Troubleshooting */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Common Issues
          </h2>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <h4 className="font-semibold text-white mb-1">
                Bot transactions failing
              </h4>
              <p className="text-sm text-gray-400">
                Ensure your bot wallet has sufficient ETH for gas fees and that
                the bot address has been added to your governance contract with
                the correct role (PROPOSER_ROLE or PROPAGATOR_ROLE).
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">
                Secrets not being read
              </h4>
              <p className="text-sm text-gray-400">
                GitHub Actions secrets are case-sensitive. Double-check that
                your secret names match exactly what's referenced in your
                workflow files.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">
                RPC connection errors
              </h4>
              <p className="text-sm text-gray-400">
                Verify your RPC_URL is correct and the endpoint is accessible.
                Consider using a dedicated RPC provider like Alchemy or Infura
                for production.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Sub-components ---

interface Team {
  id: number;
  name: string;
  governorAddress: string;
  registryAddress: string;
  deploymentBlock?: number;
}

function ProviderDocs({ team }: { team: Team }) {
  const [activeProvider, setActiveProvider] = useState<"github" | "gitlab">(
    "github",
  );

  return (
    <section>
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Key className="w-5 h-5 text-green-400" />
        CI/CD Provider Configuration
      </h2>

      {/* Provider Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveProvider("github")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            activeProvider === "github"
              ? "bg-gray-800 text-white border border-gray-700"
              : "text-gray-500 hover:text-gray-300 hover:bg-gray-900/50"
          }`}
        >
          <Github className="w-4 h-4" />
          GitHub Actions
        </button>
      </div>

      {activeProvider === "github" ? (
        <GitHubDocs team={team} />
      ) : (
        <GitLabDocs />
      )}
    </section>
  );
}

function GitHubDocs({ team }: { team: Team }) {
  const contracts = useTeamContracts({
    governorAddress: team.governorAddress,
    registryAddress: team.registryAddress,
  });

  const { projects } = useProjects(
    contracts?.registry ?? null,
    BigInt(team.deploymentBlock ?? 0),
  );

  const { provider, isInitializing } = useWeb3Connection();
  const { bots } = useGovernanceData({
    provider,
    contracts,
    contractAddresses: {
      devOpsGovernor: team.governorAddress,
      deploymentRegistry: team.registryAddress,
    },
    isInitializing,
    selectedProject: null,
    deploymentBlock: BigInt(team.deploymentBlock ?? 0),
  });

  const proposerBots = bots.filter((b) => b.isProposer);
  const propagatorBots = bots.filter((b) => b.isPropagator);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-8">
      {/* Step 1: Template Repository */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-sm">
            1
          </div>
          <h3 className="text-lg font-semibold text-white">
            Fork the Dobby Template Repository
          </h3>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          We provide a ready-to-use template repository with all the necessary
          GitHub Actions workflows, DevOps scripts, Docker configuration, and
          dependencies pre-configured. Simply fork or copy the repo and start
          using it with the Dobby platform.
        </p>

        <a
          href="https://github.com/kirillinoz/dobby-template"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-xl p-4 transition-all group"
        >
          <div className="p-3 bg-gray-900 rounded-lg group-hover:bg-gray-800 transition-colors">
            <Github className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">
                kirillinoz/dobby-template
              </span>
              <ExternalLink className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-gray-500 text-sm">
              Fork this repository to get started quickly
            </p>
          </div>
        </a>

        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-semibold text-white">
            What's included in the template:
          </h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <span>
                <strong className="text-gray-300">
                  GitHub Actions Workflows
                </strong>{" "}
                — Pre-configured CI/CD pipelines for proposing and monitoring
                deployments
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <span>
                <strong className="text-gray-300">DevOps Scripts</strong> —
                Ready-to-use scripts for packaging, uploading to IPFS, and
                interacting with governance
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <span>
                <strong className="text-gray-300">Docker Configuration</strong>{" "}
                — Dockerfile and compose setup for consistent build environments
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <span>
                <strong className="text-gray-300">Counter Contract</strong> — A
                simple example contract to test the full governance workflow
                end-to-end
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <span>
                <strong className="text-gray-300">All Dependencies</strong> —
                Package configuration with all required libraries pre-installed
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Step 2: Repository Secrets */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-sm">
            2
          </div>
          <h3 className="text-lg font-semibold text-white">
            Configure Repository Secrets
          </h3>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Navigate to your GitHub repository → <strong>Settings</strong> →{" "}
          <strong>Secrets and variables</strong> → <strong>Actions</strong> and
          add the following secrets:
        </p>

        {/* How to Share Banner */}
        <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
             <Users className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
             <div>
                <p className="text-blue-300 font-semibold mb-1">
                   How to Share Bot Keys Between Stakeholders
                </p>
                <p className="text-gray-400 text-sm">
                   <strong>1.</strong> One stakeholder creates a dedicated bot
                   wallet (e.g., using MetaMask) and exports the private key.
                   <br />
                   <strong>2.</strong> Share the private key securely with all
                   other stakeholders using a password manager like 1Password,
                   Bitwarden, or LastPass. Never share via email, Slack, or
                   other unencrypted channels.
                   <br />
                   <strong>3.</strong> Each stakeholder with admin access to
                   their fork adds this secret to their repository.
                   <br />
                   <strong>4.</strong> Fund the bot wallet with some
                   ETH of appropriate network for gas fees.
                </p>
             </div>
          </div>
        </div>

        {/* Security Warning */}
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-300 font-semibold mb-1">
                Important: Stakeholder Removal Security
              </p>
              <p className="text-gray-400 text-sm">
                When a stakeholder is removed from the team via governance vote,
                all remaining stakeholders must immediately rotate the{" "}
                <code className="text-red-300 bg-red-900/30 px-1 rounded">
                  PROPAGATOR_KEY
                </code>{" "}
                and{" "}
                <code className="text-red-300 bg-red-900/30 px-1 rounded">
                  PROPOSER_KEY
                </code>{" "}
                secrets. Create new bot wallets, update the secrets in all
                stakeholder repositories, and register the new bot addresses in
                governance. Secrets marked with{" "}
                <span className="text-red-400">🔄</span> below must be changed.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* PROPAGATOR_KEY */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <code className="text-green-400 font-mono font-semibold">
                  PROPAGATOR_KEY
                </code>
                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full">
                  Required
                </span>
                <span
                  className="text-red-400"
                  title="Must be rotated when a stakeholder is removed"
                >
                  🔄
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-3">
              Private key, used for monitor workflow to propagate proposals, this
              means it will queue and execute any proposals that have succeeded
              (this means also executing version updates, so needs to have
              enough funds to deploy contracts)
            </p>
          
            {/* Bot Helper UI */}
            <div className="mt-3 bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden">
               <div className="px-3 py-2 bg-gray-800/30 border-b border-gray-700/30">
                  <span className="text-xs font-semibold text-gray-300">Available Propagator Bots</span>
               </div>
               {propagatorBots.length > 0 ? (
                  <ul className="divide-y divide-gray-700/30">
                     {propagatorBots.map(bot => (
                        <li key={bot.address} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-800/30">
                           <div className="flex items-center gap-2">
                              <span className="font-mono text-gray-400">{truncateAddress(bot.address)}</span>
                           </div>
                           <CopyButton textToCopy={bot.address} size="sm" />
                        </li>
                     ))}
                  </ul>
               ) : (
                  <div className="px-3 py-2 text-xs text-gray-500 italic">
                     No bots with PROPAGATOR_ROLE found. Add one in the Dashboard.
                  </div>
               )}
            </div>
          </div>

          {/* PROPOSER_KEY */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <code className="text-green-400 font-mono font-semibold">
                  PROPOSER_KEY
                </code>
                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full">
                  Required
                </span>
                <span
                  className="text-red-400"
                  title="Must be rotated when a stakeholder is removed"
                >
                  🔄
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-3">
              Private key, used by propose workflow to create package proposals
              on chain when pr is opened, because only creates proposals not as
              much funds are necessary like for propagator bot
            </p>

            {/* Bot Helper UI */}
            <div className="mt-3 bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden">
               <div className="px-3 py-2 bg-gray-800/30 border-b border-gray-700/30">
                  <span className="text-xs font-semibold text-gray-300">Available Proposer Bots</span>
               </div>
               {proposerBots.length > 0 ? (
                  <ul className="divide-y divide-gray-700/30">
                     {proposerBots.map(bot => (
                        <li key={bot.address} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-800/30">
                           <div className="flex items-center gap-2">
                              <span className="font-mono text-gray-400">{truncateAddress(bot.address)}</span>
                           </div>
                           <CopyButton textToCopy={bot.address} size="sm" />
                        </li>
                     ))}
                  </ul>
               ) : (
                  <div className="px-3 py-2 text-xs text-gray-500 italic">
                     No bots with PROPOSER_ROLE found. Add one in the Dashboard.
                  </div>
               )}
            </div>
          </div>

          {/* DEPLOY_NETWORK */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <code className="text-green-400 font-mono font-semibold">
                  DEPLOY_NETWORK
                </code>
                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full">
                  Required
                </span>
              </div>
              <CopyButton textToCopy="sepolia" size="sm" />
            </div>
            <p className="text-gray-400 text-sm mb-2">
              which EVM network you want to use for deployment, aka value could
              be "sepolia" / some different one, currently used for package
              information (manifest) but later also for deployment
            </p>
             <div className="mt-2 text-xs text-gray-500 bg-gray-900/30 px-2 py-1.5 rounded font-mono">
               sepolia
            </div>
          </div>

          {/* DEPLOYMENT_BLOCK */}
          <SecretField
            name="DEPLOYMENT_BLOCK"
            value={
              team.deploymentBlock
                ? String(team.deploymentBlock)
                : "Not available"
            }
            description="Block number when contracts were deployed. Used for efficient event scanning."
            required
            copyable={!!team.deploymentBlock}
          />

          {/* DEPLOYMENT_REGISTRY_ADDRESS */}
          <SecretField
            name="DEPLOYMENT_REGISTRY_ADDRESS"
            value={team.registryAddress}
            description="Your team's DeploymentRegistry contract address"
            required
            copyable
          />

          {/* GOVERNOR_ADDRESS */}
          <SecretField
            name="GOVERNOR_ADDRESS"
            value={team.governorAddress}
            description="Your team's DevOpsGovernor contract address"
            required
            copyable
          />

          {/* PINATA_JWT */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <code className="text-green-400 font-mono font-semibold">
                  PINATA_JWT
                </code>
                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full">
                  Required
                </span>
              </div>
              <a
                href="https://app.pinata.cloud/developers/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                Get API Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-gray-400 text-sm mb-2">
              JWT token from Pinata for uploading deployment packages to IPFS.
            </p>
            <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-3 mt-2">
              <p className="text-purple-300 text-xs">
                <strong>How to get:</strong> Sign up at{" "}
                <a
                  href="https://pinata.cloud"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  pinata.cloud
                </a>
                , go to API Keys, create a new key with "pinFileToIPFS"
                permission, and copy the JWT.
              </p>
            </div>
          </div>

          {/* PROJECT_ID */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <code className="text-green-400 font-mono font-semibold">
                  PROJECT_ID
                </code>
                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full">
                  Required
                </span>
              </div>
              {selectedProjectId && <CopyButton textToCopy={selectedProjectId} size="sm" />}
            </div>
            <p className="text-gray-400 text-sm mb-3">
              The bytes32 project identifier from the DeploymentRegistry.
            </p>

            {/* Project Selector */}
            {projects && projects.length > 0 ? (
              <div className="space-y-3">
                <div className="relative">
                  <button
                    onClick={() =>
                      setIsProjectDropdownOpen(!isProjectDropdownOpen)
                    }
                    className="w-full flex items-center justify-between bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm hover:border-gray-600 transition-colors"
                  >
                    <span
                      className={
                        selectedProject ? "text-white" : "text-gray-500"
                      }
                    >
                      {selectedProject
                        ? selectedProject.name
                        : "Select a project..."}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${isProjectDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isProjectDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setIsProjectDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
                            project.id === selectedProjectId
                              ? "bg-gray-800 text-white"
                              : "text-gray-300"
                          }`}
                        >
                          {project.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedProjectId && (
                  <code className="block text-xs font-mono text-gray-500 bg-gray-900/50 px-3 py-2 rounded overflow-x-auto">
                    {selectedProjectId}
                  </code>
                )}
              </div>
            ) : (
              <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-yellow-300 text-sm font-medium mb-1">
                      No projects found
                    </p>
                    <p className="text-gray-400 text-xs mb-2">
                      Create a project in the Dashboard first to get its ID.
                    </p>
                    <Link
                      to="/$teamId/dashboard"
                      params={{ teamId: String(team.id) }}
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <Plus className="w-3 h-3" />
                      Go to Dashboard to create a project
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEPOLIA_RPC_URL */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <code className="text-green-400 font-mono font-semibold">
                  SEPOLIA_RPC_URL
                </code>
                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full">
                  Required
                </span>
              </div>
              <a
                href="https://dashboard.alchemy.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                Get from Alchemy <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-gray-400 text-sm mb-2">
              Ethereum Sepolia testnet RPC endpoint for blockchain interactions.
            </p>
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 mt-2">
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="text-blue-300 font-medium mb-1">
                    Sharing Between Stakeholders
                  </p>
                  <p className="text-gray-400 text-xs">
                    <strong>Option 1:</strong> One stakeholder creates an
                    Alchemy app and shares the RPC URL with others via password
                    manager.
                    <br />
                    <strong>Option 2:</strong> Each stakeholder creates their
                    own Alchemy account (free tier: 300M compute units/month)
                    and uses their own URL.
                    <br />
                    <strong>Recommended:</strong> Use a shared team Alchemy
                    account for consistency and easier debugging.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-3 mt-2">
              <p className="text-purple-300 text-xs">
                <strong>How to get:</strong> Sign up at{" "}
                <a
                  href="https://alchemy.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  alchemy.com
                </a>
                , create a new app on Ethereum Sepolia, and copy the HTTPS URL
                from the app dashboard.
              </p>
            </div>
          </div>



        </div>
      </div>

      {/* Step 3: Bot Setup */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-sm">
            3
          </div>
          <h3 className="text-lg font-semibold text-white">
            Register the Bots in Governance
          </h3>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          The wallet addresses corresponding to your <code className="text-blue-300">PROPAGATOR_KEY</code> and <code className="text-blue-300">PROPOSER_KEY</code> must be registered
          in the governance contract. The bot should receive at least one or both roles needed to operate:
        </p>

        <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-purple-400 mt-0.5" />
            <div>
              <p className="text-white font-medium">PROPOSER_ROLE</p>
              <p className="text-gray-400 text-sm">
                Allows the bot to submit new deployment proposals from CI/CD
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-green-400 mt-0.5" />
            <div>
              <p className="text-white font-medium">PROPAGATOR_ROLE</p>
              <p className="text-gray-400 text-sm">
                Allows the bot to execute approved proposals and queue them in
                the timelock
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 mt-4">
          <p className="text-blue-300 text-sm">
            <strong>To add the bot:</strong> Go to the{" "}
            <Link
              to="/$teamId/dashboard"
              params={{ teamId: String(team.id) }}
              className="underline hover:text-blue-200"
            >
              Dashboard
            </Link>
            , scroll to the "Bots" section, click the "+" button, and enter the
            wallet address of your CI bot using the checkboxes to select roles.
          </p>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 mt-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-gray-400 text-sm">
              <strong className="text-yellow-300">Remember:</strong> If a
              stakeholder is removed, create a new bot wallet and register it
              here after updating the PROPAGATOR_KEY and PROPOSER_KEY secrets.
            </p>
          </div>
        </div>
      </div>

      {/* Step 4: Branch Protection */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-sm">
            4
          </div>
          <h3 className="text-lg font-semibold text-white">
            Configure Branch Protection Rules
          </h3>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Protect your main branch to ensure all changes go through the
          governance process. Navigate to your repository →{" "}
          <strong>Settings</strong> → <strong>Rules</strong> →{" "}
          <strong>Rulesets</strong> → <strong>New ruleset</strong> and configure
          the following:
        </p>

        {/* Target Branch */}
        <div className="bg-gray-800/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="w-4 h-4 text-purple-400" />
            <span className="text-white font-medium">Target Branch</span>
          </div>
          <p className="text-gray-400 text-sm">
            Add{" "}
            <code className="bg-gray-900 px-1.5 py-0.5 rounded text-blue-300">
              main
            </code>{" "}
            as the target branch for these protection rules.
          </p>
        </div>

        {/* Rules */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-yellow-400" />
            Required Rules
          </h4>

          {/* Restrict deletions */}
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <CheckSquare className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium text-sm">
                  Restrict deletions
                </p>
                <p className="text-gray-500 text-xs">
                  Only allow users with bypass permission to delete the main
                  branch. Prevents accidental or malicious deletion of your
                  protected branch.
                </p>
              </div>
            </div>
          </div>

          {/* Require pull request */}
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <CheckSquare className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium text-sm">
                  Require a pull request before merging
                </p>
                <p className="text-gray-500 text-xs">
                  All changes must be submitted via pull request. This ensures
                  every deployment goes through the CI/CD pipeline and
                  governance process.
                </p>
              </div>
            </div>
          </div>

          {/* Require status checks */}
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <CheckSquare className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium text-sm">
                  Require status checks to pass
                </p>
                <p className="text-gray-500 text-xs mb-2">
                  Ensure all CI checks pass before merging. Add these required
                  status checks:
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600">•</span>
                    <code className="bg-gray-900/50 px-1.5 py-0.5 rounded text-blue-300">
                      1. Validate & Create Package
                    </code>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600">•</span>
                    <code className="bg-gray-900/50 px-1.5 py-0.5 rounded text-blue-300">
                      2. Propose On-Chain
                    </code>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600">•</span>
                    <code className="bg-gray-900/50 px-1.5 py-0.5 rounded text-blue-300">
                      3. Comment on PR
                    </code>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600">•</span>
                    <code className="bg-gray-900/50 px-1.5 py-0.5 rounded text-blue-300">
                      On-Chain Vote
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Block force pushes */}
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <CheckSquare className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium text-sm">
                  Block force pushes
                </p>
                <p className="text-gray-500 text-xs">
                  Prevent force pushes that could rewrite history and bypass the
                  governance audit trail.
                </p>
              </div>
            </div>
          </div>

          {/* Optional rules */}
          <h4 className="text-sm font-semibold text-gray-400 flex items-center gap-2 mt-4">
            Optional Rules
          </h4>

          <div className="bg-gray-800/20 rounded-lg p-3 opacity-75">
            <div className="flex items-start gap-2">
              <Square className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-400 font-medium text-sm">
                  Require signed commits
                </p>
                <p className="text-gray-600 text-xs">
                  For additional security, require GPG-signed commits to verify
                  author identity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 5: You're Ready */}
      <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-green-600/20 rounded-full flex items-center justify-center text-green-400 font-bold text-sm">
            ✓
          </div>
          <h3 className="text-lg font-semibold text-white">You're All Set!</h3>
        </div>
        <p className="text-gray-400 text-sm">
          Create a pull request to your forked repository to trigger your first
          governance proposal. The CI/CD pipeline will package your code, upload
          it to IPFS, and submit a proposal for stakeholder approval. Once all
          stakeholders vote and the proposal passes, the PR can be merged.
        </p>
      </div>
    </div>
  );
}

function GitLabDocs() {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
      <GitlabIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-400 mb-2">
        GitLab CI Support Coming Soon
      </h3>
      <p className="text-gray-500 text-sm max-w-md mx-auto">
        We're working on documentation and tooling for GitLab CI/CD integration.
        The contract's flexible identity system already supports GitLab
        usernames via the <code className="text-blue-400">setIdentity</code>{" "}
        function.
      </p>
    </div>
  );
}

function CopyableField({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-gray-800 px-4 py-2 rounded-lg text-blue-300 font-mono text-sm overflow-x-auto">
          {value}
        </code>
        <button
          onClick={handleCopy}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>
      {description && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
}



function SecretField({
  name,
  value,
  description,
  sensitive,
  required,
  copyable = false,
}: {
  name: string;
  value: string;
  description: string;
  sensitive?: boolean;
  required?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!sensitive && copyable) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-gray-800/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <code className="text-green-400 font-mono font-semibold">{name}</code>
          {required && (
            <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full">
              Required
            </span>
          )}
        </div>
        {!sensitive && copyable && (
          <button
            onClick={handleCopy}
            className="p-1.5 bg-gray-700/50 hover:bg-gray-700 rounded transition-colors"
            title="Copy value"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3 text-gray-400" />
            )}
          </button>
        )}
      </div>
      <p className="text-gray-400 text-sm mb-2">{description}</p>
      <code
        className={`block text-xs font-mono ${sensitive ? "text-yellow-400/70 italic" : "text-gray-500"} ${copyable ? "bg-gray-900/50 px-3 py-2 rounded overflow-x-auto" : ""}`}
      >
        {sensitive ? "••••••••••••••••" : value}
      </code>
    </div>
  );
}
