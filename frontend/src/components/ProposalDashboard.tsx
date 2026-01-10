import React, { useState, useMemo } from "react";
import {
  LayoutGrid,
  Settings,
  Archive,
  Activity,
  Package,
  Search,
  RefreshCw,
} from "lucide-react";
import { ProposalCard } from "./ProposalCard";
import { ProposalVerificationModal } from "./ProposalVerificationModal";
import { parseProposalDescription } from "../lib/proposalParser";
import type { Proposal, Contracts, Bot } from "../types";

interface ProposalDashboardProps {
  proposals: Proposal[];
  contracts: Contracts;
  account: string | null;
  onVoteSuccess: () => void;
  currentBlock: number | null;
  bots: Bot[];
  isLoading: boolean;
  onRefresh?: () => void;
  canInteract?: boolean;
}

type TabType = "development" | "governance";
type ViewType = "active" | "history";

export const ProposalDashboard: React.FC<ProposalDashboardProps> = ({
  proposals,
  contracts,
  account,
  onVoteSuccess,
  currentBlock,
  bots,
  isLoading,
  onRefresh,
  canInteract = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("development");
  const [viewType, setViewType] = useState<ViewType>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Verification State Management ---
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [verifyingProposal, setVerifyingProposal] = useState<Proposal | null>(
    null,
  );

  const handleVerificationSuccess = (proposalId: string) => {
    setVerifiedIds((prev) => new Set(prev).add(proposalId));
    setVerifyingProposal(null);
  };

  // Handle refresh with animation
  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      // Keep spinning for at least 500ms for visual feedback
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // 1. Pre-calculate Active Counts for Badges
  const { activeDevCount, activeGovCount } = useMemo(() => {
    let dev = 0;
    let gov = 0;

    proposals.forEach((p) => {
      const isActionable = [
        "Active",
        "Pending",
        "Succeeded",
        "Queued",
      ].includes(p.status);

      if (isActionable) {
        const parsed = parseProposalDescription(p.description, p.ipfsCID);
        if (parsed.type === "development" && parsed.action === "package") {
          dev++;
        } else {
          gov++;
        }
      }
    });

    return { activeDevCount: dev, activeGovCount: gov };
  }, [proposals]);

  // 2. Categorize and Filter Proposals
  const filteredProposals = useMemo(() => {
    const filtered = proposals.filter((p) => {
      const parsed = parseProposalDescription(p.description, p.ipfsCID);
      const isDev =
        parsed.type === "development" && parsed.action === "package";
      const isGov = !isDev;

      if (activeTab === "development" && !isDev) return false;
      if (activeTab === "governance" && !isGov) return false;

      const isActive = ["Active", "Pending", "Succeeded", "Queued"].includes(
        p.status,
      );
      const isHistory = [
        "Executed",
        "Defeated",
        "Expired",
        "Canceled",
      ].includes(p.status);

      if (viewType === "active" && !isActive) return false;
      if (viewType === "history" && !isHistory) return false;

      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        return (
          p.id.toString().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery) ||
          p.proposer.toLowerCase().includes(lowerQuery)
        );
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (viewType === "active") {
        const statusPriority: Record<string, number> = {
          Active: 1,
          Succeeded: 2,
          Queued: 3,
          Pending: 4,
        };

        const aPriority = statusPriority[a.status] || 999;
        const bPriority = statusPriority[b.status] || 999;

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        if (a.status === "Active" && b.status === "Active") {
          if (a.deadline === b.deadline) return Number(b.id - a.id);
          return a.deadline - b.deadline;
        }

        return Number(b.id - a.id);
      } else {
        return Number(b.id - a.id);
      }
    });
  }, [proposals, activeTab, viewType, searchQuery]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Main Category Tabs */}
        <div className="bg-gray-900/50 p-1 rounded-xl border border-gray-800 inline-flex">
          <button
            onClick={() => {
              setActiveTab("development");
              setViewType("active");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "development"
                ? "bg-blue-600/20 text-blue-400 shadow-sm border border-blue-600/30"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Development</span>
            {activeDevCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-blue-500 text-white rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                {activeDevCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("governance");
              setViewType("active");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "governance"
                ? "bg-blue-600/20 text-blue-400 shadow-sm border border-blue-600/30"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Governance</span>
            {activeGovCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-blue-500 text-white rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                {activeGovCount}
              </span>
            )}
          </button>
        </div>

        {/* Right Side: Search + View Toggle + Refresh */}
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search ID, desc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-900 border border-gray-800 text-gray-300 text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 w-64 transition-all"
            />
          </div>

          {/* View Toggle (Active / History) */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-1 flex items-center">
            <button
              onClick={() => setViewType("active")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewType === "active"
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Active
            </button>
            <button
              onClick={() => setViewType("history")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewType === "history"
                  ? "bg-gray-700 text-gray-200 shadow"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="p-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              title="Refresh proposals"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-400 group-hover:text-gray-300 transition-all ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        // Loading Skeletons
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-64 bg-gray-900/40 rounded-xl border border-gray-800/50 animate-pulse p-6 flex flex-col gap-4"
            >
              <div className="flex justify-between">
                <div className="h-6 w-20 bg-gray-800 rounded" />
                <div className="h-4 w-24 bg-gray-800 rounded" />
              </div>
              <div className="h-4 w-full bg-gray-800/50 rounded mt-2" />
              <div className="h-4 w-2/3 bg-gray-800/50 rounded" />
              <div className="mt-auto flex gap-2">
                <div className="h-8 w-20 bg-gray-800 rounded" />
                <div className="h-8 w-20 bg-gray-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProposals.length > 0 ? (
        // Proposal Grid
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id.toString()}
              proposal={proposal}
              contracts={contracts}
              account={account}
              onVoteSuccess={onVoteSuccess}
              currentBlock={currentBlock}
              bots={bots}
              isVerified={verifiedIds.has(proposal.id.toString())}
              onVerify={() => setVerifyingProposal(proposal)}
              canInteract={canInteract}
            />
          ))}
        </div>
      ) : (
        // Empty State
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 border border-gray-800/50 border-dashed rounded-xl bg-gray-900/20">
          <div className="bg-gray-800/50 p-3 rounded-full mb-4">
            <LayoutGrid className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-lg font-medium text-gray-400">
            No {viewType} proposals found
          </p>
          <p className="text-sm text-gray-600">
            {activeTab === "development"
              ? "No package upgrades in this category"
              : "No governance actions in this category"}
          </p>
        </div>
      )}

      {/* --- VERIFICATION MODAL --- */}
      {verifyingProposal && verifyingProposal.ipfsCID && (
        <ProposalVerificationModal
          isOpen={!!verifyingProposal}
          onClose={() => setVerifyingProposal(null)}
          proposalId={verifyingProposal.id.toString()}
          targetAddress={verifyingProposal.targetAddress || ""}
          ipfsCID={verifyingProposal.ipfsCID}
          contracts={contracts}
          account={account}
          onVoteSuccess={() => {
            handleVerificationSuccess(verifyingProposal.id.toString());
            onVoteSuccess();
          }}
          canInteract={canInteract}
        />
      )}
    </div>
  );
};
