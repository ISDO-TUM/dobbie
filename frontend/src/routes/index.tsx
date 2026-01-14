import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Plus,
  Link as LinkIcon,
  Users,
  ExternalLink,
  Sparkles,
  Shield,
  Book,
  Blocks,
  Archive,
  ArchiveRestore,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { truncateAddress } from "../lib/utils";
import { CopyButton } from "../components/ui/CopyButton";
import {
  allTeamsQueryOptions,
  useArchiveTeamMutation,
  useUnarchiveTeamMutation,
  useDeleteTeamMutation,
} from "../queries/teams";

export const Route = createFileRoute("/")(  {
  component: Home,
  // Pre-fetch data so it's ready when component mounts
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(allTeamsQueryOptions(true)),
});

function Home() {
  const [hoveredCard, setHoveredCard] = useState<"create" | "join" | null>(
    null,
  );
  const [showArchived, setShowArchived] = useState(false);

  // Fetch all teams including archived
  const { data: allTeams } = useSuspenseQuery(allTeamsQueryOptions(true));

  // Mutations
  const archiveMutation = useArchiveTeamMutation();
  const unarchiveMutation = useUnarchiveTeamMutation();
  const deleteMutation = useDeleteTeamMutation();

  // Split teams into active and archived
  const activeTeams = allTeams.filter((team) => !team.archivedAt);
  const archivedTeams = allTeams.filter((team) => team.archivedAt);

  // Determine what to show based on toggle
  const teamsToShow = showArchived ? archivedTeams : activeTeams;
  const showOnboarding = activeTeams.length === 0 && archivedTeams.length === 0;

  const handleArchive = (teamId: number, teamName: string) => {
    if (window.confirm(`Archive team "${teamName}"? You can unarchive it later.`)) {
      archiveMutation.mutate(teamId);
    }
  };

  const handleUnarchive = (teamId: number) => {
    unarchiveMutation.mutate(teamId);
  };

  const handleDelete = (teamId: number, teamName: string) => {
    if (
      window.confirm(
        `⚠️ PERMANENTLY DELETE team "${teamName}"?\n\nThis action cannot be undone. The team data will be removed from your local database.`,
      )
    ) {
      deleteMutation.mutate(teamId);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#040710] via-[#0a0f1e] to-[#040710] p-6 lg:p-12">
      {showOnboarding && (
        <div className="max-w-7xl mx-auto mb-16">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sparkles className="w-8 h-8 text-blue-400" />
              <h1 className="text-5xl lg:text-6xl font-bold bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Welcome to Dobbie
              </h1>
              <Sparkles className="w-8 h-8 text-pink-400" />
            </div>
            <p className="text-gray-400 text-lg lg:text-xl max-w-2xl mx-auto">
              Your sovereign DevOps governance platform. Choose your path.
            </p>
          </motion.div>

          {/* The Choice - Split Cards */}
          <div className="relative h-[500px] lg:h-[600px] flex gap-4">
            {/* Create Team Card */}
            <motion.div
              animate={{
                flex:
                  hoveredCard === "create"
                    ? "0 0 65%"
                    : hoveredCard === "join"
                      ? "0 0 35%"
                      : "0 0 50%",
              }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              onHoverStart={() => setHoveredCard("create")}
              onHoverEnd={() => setHoveredCard(null)}
              className="relative group cursor-pointer"
            >
              <Link to="/create-team" className="block h-full">
                <div className="h-full relative overflow-hidden rounded-2xl border border-gray-800 bg-linear-to-br from-green-900/20 via-blue-900/20 to-gray-900/90 shadow-2xl transition-all">
                  {/* Animated Background */}
                  <motion.div
                    animate={{
                      opacity: hoveredCard === "create" ? 0.3 : 0.1,
                      scale: hoveredCard === "create" ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 bg-linear-to-br from-green-500/20 via-blue-500/20 to-transparent"
                  />

                  {/* Glow Effect */}
                  <motion.div
                    animate={{
                      opacity: hoveredCard === "create" ? 1 : 0,
                    }}
                    className="absolute inset-0 bg-linear-to-t from-green-500/10 via-transparent to-blue-500/10 blur-2xl"
                  />

                  {/* Content */}
                  <div className="relative h-full flex flex-col items-center justify-center p-8 text-center">
                    <motion.div
                      animate={{
                        scale: hoveredCard === "create" ? 1.1 : 1,
                        rotate: hoveredCard === "create" ? 5 : 0,
                      }}
                      transition={{ duration: 0.3 }}
                      className="mb-8 p-6 rounded-full bg-linear-to-br from-green-500/20 to-blue-500/20 border border-green-500/30"
                    >
                      <Plus className="w-20 h-20 lg:w-28 lg:h-28 text-green-400" />
                    </motion.div>

                    <h2 className="text-3xl lg:text-5xl font-bold mb-4 bg-linear-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                      Create Team
                    </h2>

                    <motion.p
                      animate={{
                        opacity: hoveredCard === "create" ? 1 : 0.6,
                      }}
                      className="text-gray-300 text-base lg:text-lg mb-6 max-w-md"
                    >
                      Deploy your own governance system. Build and lead your
                      autonomous development team.
                    </motion.p>

                    <motion.div
                      animate={{
                        opacity: hoveredCard === "create" ? 1 : 0,
                        y: hoveredCard === "create" ? 0 : 20,
                      }}
                      className="flex flex-col gap-2 text-sm text-gray-400"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-400" />
                        <span>Full governance control</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span>Invite stakeholders</span>
                      </div>
                    </motion.div>

                    <motion.button
                      animate={{
                        scale: hoveredCard === "create" ? 1.05 : 1,
                      }}
                      className="mt-8 px-8 py-3 bg-linear-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-semibold rounded-xl border border-green-500/50 shadow-lg shadow-green-500/20 transition-all"
                    >
                      Start Building
                    </motion.button>
                  </div>
                </div>
              </Link>
            </motion.div>

            {/* Join Team Card */}
            <motion.div
              animate={{
                flex:
                  hoveredCard === "join"
                    ? "0 0 65%"
                    : hoveredCard === "create"
                      ? "0 0 35%"
                      : "0 0 50%",
              }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              onHoverStart={() => setHoveredCard("join")}
              onHoverEnd={() => setHoveredCard(null)}
              className="relative group cursor-pointer"
            >
              <Link to="/join-team" className="block h-full">
                <div className="h-full relative overflow-hidden rounded-2xl border border-gray-800 bg-linear-to-br from-purple-900/20 via-indigo-900/20 to-gray-900/90 shadow-2xl transition-all">
                  {/* Animated Background */}
                  <motion.div
                    animate={{
                      opacity: hoveredCard === "join" ? 0.3 : 0.1,
                      scale: hoveredCard === "join" ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 bg-linear-to-br from-purple-500/20 via-indigo-500/20 to-transparent"
                  />

                  {/* Glow Effect */}
                  <motion.div
                    animate={{
                      opacity: hoveredCard === "join" ? 1 : 0,
                    }}
                    className="absolute inset-0 bg-linear-to-t from-purple-500/10 via-transparent to-indigo-500/10 blur-2xl"
                  />

                  {/* Content */}
                  <div className="relative h-full flex flex-col items-center justify-center p-8 text-center">
                    <motion.div
                      animate={{
                        scale: hoveredCard === "join" ? 1.1 : 1,
                        rotate: hoveredCard === "join" ? -5 : 0,
                      }}
                      transition={{ duration: 0.3 }}
                      className="mb-8 p-6 rounded-full bg-linear-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30"
                    >
                      <LinkIcon className="w-20 h-20 lg:w-28 lg:h-28 text-purple-400" />
                    </motion.div>

                    <h2 className="text-3xl lg:text-5xl font-bold mb-4 bg-linear-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                      Join Team
                    </h2>

                    <motion.p
                      animate={{
                        opacity: hoveredCard === "join" ? 1 : 0.6,
                      }}
                      className="text-gray-300 text-base lg:text-lg mb-6 max-w-md"
                    >
                      Connect to an existing team. Contribute to proposals and
                      shape the future together.
                    </motion.p>

                    <motion.div
                      animate={{
                        opacity: hoveredCard === "join" ? 1 : 0,
                        y: hoveredCard === "join" ? 0 : 20,
                      }}
                      className="flex flex-col gap-2 text-sm text-gray-400"
                    >
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-purple-400" />
                        <span>Connect via address</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <span>Participate in governance</span>
                      </div>
                    </motion.div>

                    <motion.button
                      animate={{
                        scale: hoveredCard === "join" ? 1.05 : 1,
                      }}
                      className="mt-8 px-8 py-3 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl border border-purple-500/50 shadow-lg shadow-purple-500/20 transition-all"
                    >
                      Connect Now
                    </motion.button>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      )}

      {/* Your Teams Section */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="max-w-7xl mx-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-white">
            {showArchived ? "Archived Teams" : "Your Teams"}
          </h2>
          <div className="flex items-center gap-4">
            {/* Show Archived Toggle */}
            {(archivedTeams.length > 0 || showArchived) && (
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  showArchived
                    ? "bg-amber-600/20 border-amber-600/50 text-amber-300 hover:bg-amber-600/30"
                    : "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50"
                }`}
              >
                {showArchived ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span className="text-sm font-medium">Hide Archived</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Show Archived ({archivedTeams.length})
                    </span>
                  </>
                )}
              </button>
            )}
            {/* Team Count */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-gray-300 font-semibold">
                {teamsToShow.length}{" "}
                {teamsToShow.length === 1 ? "Team" : "Teams"}
              </span>
            </div>
          </div>
        </div>

        {teamsToShow.length === 0 ? (
          // Empty State
          <div className="relative bg-linear-to-br from-gray-900/90 via-gray-900/60 to-gray-950 border border-gray-800 rounded-xl p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="mb-6 inline-flex p-6 rounded-full bg-gray-800/50 border border-gray-700">
                {showArchived ? (
                  <Archive className="w-16 h-16 text-gray-600" />
                ) : (
                  <Users className="w-16 h-16 text-gray-600" />
                )}
              </div>
              <h3 className="text-2xl font-bold text-gray-400 mb-3">
                {showArchived ? "No Archived Teams" : "No Teams Found"}
              </h3>
              <p className="text-gray-500 mb-6">
                {showArchived
                  ? "You haven't archived any teams yet."
                  : "You haven't joined or created any teams yet. Choose an option above to get started!"}
              </p>
            </div>
          </div>
        ) : (
          // Team Cards Grid
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {teamsToShow.map((team, index) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                {/* Card Container */}
                <div
                  className={`group relative bg-linear-to-br from-gray-900/90 via-gray-900/60 to-gray-950 border rounded-xl p-6 shadow-2xl hover:scale-[1.02] transition-all duration-300 h-full flex flex-col ${
                    team.archivedAt
                      ? "border-amber-800/50 hover:border-amber-700/50"
                      : "border-gray-800 hover:border-gray-700"
                  }`}
                >
                  {/* Archived Badge */}
                  {team.archivedAt && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-amber-600/20 border border-amber-600/30 rounded text-xs text-amber-400">
                      <Archive className="w-3 h-3" />
                      <span>Archived</span>
                    </div>
                  )}

                  {/* Team Name - Truncated with Fade/Ellipsis */}
                  <h3
                    className="text-2xl font-bold text-white mb-4 truncate pr-20"
                    title={team.name} // Show full name on hover
                  >
                    {team.name}
                  </h3>

                  {/* Contract Addresses */}
                  <div className="space-y-3 mb-6 flex-1">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 font-semibold">
                        Governor
                      </div>
                      <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-2 rounded border border-gray-700/50 group-hover:border-gray-600/50 transition-colors">
                        <code className="text-xs font-mono text-gray-300 flex-1 truncate">
                          {truncateAddress(team.governorAddress)}
                        </code>
                        <CopyButton
                          textToCopy={team.governorAddress}
                          size="xs"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 font-semibold">
                        Registry
                      </div>
                      <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-2 rounded border border-gray-700/50 group-hover:border-gray-600/50 transition-colors">
                        <code className="text-xs font-mono text-gray-300 flex-1 truncate">
                          {truncateAddress(team.registryAddress)}
                        </code>
                        <CopyButton
                          textToCopy={team.registryAddress}
                          size="xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Deployment Block Info */}
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 font-semibold">
                      Start Block
                    </div>
                    <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-2 rounded border border-gray-700/50">
                      <Blocks className="w-3.5 h-3.5 text-blue-400" />
                      <code className="text-xs font-mono text-gray-300 flex-1">
                        #
                        {team.deploymentBlock
                          ? team.deploymentBlock.toString()
                          : "0"}
                      </code>
                      <CopyButton
                        textToCopy={team.deploymentBlock?.toString() || "0"}
                        size="xs"
                      />
                    </div>
                  </div>

                  {/* Footer - Action Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-800/50">
                    {team.archivedAt ? (
                      // Archived team actions: Unarchive & Delete
                      <>
                        <button
                          onClick={() => handleUnarchive(team.id)}
                          disabled={unarchiveMutation.isPending}
                          className="p-2.5 text-green-400 hover:text-green-300 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 hover:border-green-500 rounded-lg transition-colors disabled:opacity-50"
                          title="Unarchive team"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(team.id, team.name)}
                          disabled={deleteMutation.isPending}
                          className="p-2.5 text-red-400 hover:text-red-300 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 hover:border-red-500 rounded-lg transition-colors disabled:opacity-50"
                          title="Permanently delete team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex-1" />
                      </>
                    ) : (
                      // Active team actions: Docs, Archive, Dashboard
                      <>
                        <Link
                          to="/$teamId/docs"
                          params={{ teamId: team.id.toString() }}
                          className="p-2.5 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
                          title="Docs"
                        >
                          <Book className="w-4 h-4 text-gray-400"/>
                        </Link>
                        <button
                          onClick={() => handleArchive(team.id, team.name)}
                          disabled={archiveMutation.isPending}
                          className="p-2.5 text-amber-400 hover:text-amber-300 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/50 hover:border-amber-500 rounded-lg transition-colors disabled:opacity-50"
                          title="Archive team"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <Link
                          to="/$teamId/dashboard"
                          params={{ teamId: team.id.toString() }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 text-blue-300 rounded-lg text-xs font-semibold transition-all hover:gap-3"
                        >
                          <span className="text-blue-300">Dashboard</span>
                          <ExternalLink className="w-3.5 h-3.5 text-blue-300" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
