import { useEffect, useState } from "react";
import type { Contracts, Proposal, Bot } from "../types";
import { formatDuration, truncateAddress } from "../lib/utils";
import { AVERAGE_BLOCK_TIME_SECONDS } from "../lib/constants";
import type { ProposalStateName } from "../lib/constants";
import { ethers } from "ethers";
import { StatusBadge } from "./ui/StatusBadge";
import { CopyButton } from "./ui/CopyButton";
import { VoteProgressBar } from "./ui/VoteProgressBar";
import { PackagePreviewModal } from "./PackagePreviewModal";
import {
  Bot as BotIcon,
  User,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Hash,
  ShieldCheck,
} from "lucide-react";
import { parseProposalDescription, generateTags } from "../lib/proposalParser";
import { ProposalTags } from "./ui/ProposalTags";

interface ProposalCardProps {
  proposal: Proposal;
  contracts: Contracts;
  account: string | null;
  onVoteSuccess: () => void;
  currentBlock: number | null;
  bots: Bot[];
  isVerified?: boolean;
  onVerify?: () => void;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  contracts,
  account,
  onVoteSuccess,
  currentBlock,
  bots,
  isVerified = false,
  onVerify,
}) => {
  const [hasVotedStatus, setHasVotedStatus] = useState<boolean>(false);
  const [isCheckingVote, setIsCheckingVote] = useState<boolean>(true);
  const [isQueuing, setIsQueuing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [showPackageModal, setShowPackageModal] = useState<boolean>(false);

  // Parse proposal
  const parsed = parseProposalDescription(
    proposal.description,
    proposal.ipfsCID,
  );
  const tags = generateTags(parsed);
  const isPackageProposal =
    parsed.type === "development" && parsed.action === "package";

  // Identify Proposer
  const isBotProposer = bots.some(
    (b) => b.address.toLowerCase() === proposal.proposer.toLowerCase(),
  );

  // Calculate Time Remaining
  const calculatedBlocksLeft =
    proposal.status === "Active" &&
    currentBlock !== null &&
    proposal.deadline > 0
      ? Math.max(0, proposal.deadline - currentBlock)
      : 0;

  const calculatedTimeStr =
    proposal.status === "Active" &&
    currentBlock !== null &&
    proposal.deadline > 0
      ? calculatedBlocksLeft <= 0
        ? "Ending soon"
        : `~${formatDuration(
            calculatedBlocksLeft * AVERAGE_BLOCK_TIME_SECONDS,
          )}`
      : "";

  // Check if user has already voted
  useEffect(() => {
    const checkStatus = async () => {
      if (!account || !contracts.governor) {
        setHasVotedStatus(false);
        setIsCheckingVote(false);
        return;
      }

      setIsCheckingVote(true);
      try {
        const voted = await contracts.governor.hasVoted(proposal.id, account);
        setHasVotedStatus(voted);
      } catch (error) {
        console.error("Failed to check status:", error);
      } finally {
        setIsCheckingVote(false);
      }
    };

    checkStatus();
  }, [contracts.governor, account, proposal.id]);

  const getErrorMessage = (error: unknown): string => {
    if (error == null) return "Unknown error";
    if (typeof error === "object") {
      const e = error as { reason?: unknown; message?: unknown };
      if (typeof e.reason === "string") return e.reason;
      if (typeof e.message === "string") return e.message;
    }
    return String(error);
  };

  const handleVote = async (proposalId: bigint, support: number) => {
    if (!contracts.governor || !account) return;
    try {
      const tx = await contracts.governor.castVote(proposalId, support);
      alert(`Vote sent: ${tx.hash}`);
      await tx.wait();
      onVoteSuccess();
    } catch (error: unknown) {
      console.error("Voting failed:", error);
      const message = getErrorMessage(error);
      alert(`Voting failed: ${message}`);
    }
  };

  const handleQueue = async () => {
    if (!contracts.governor || !account) {
      alert("Wallet not connected.");
      return;
    }

    setIsQueuing(true);
    try {
      if (!window.ethereum) throw new Error("No wallet found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const governorWithSigner = contracts.governor.connect(
        signer,
      ) as ethers.Contract;

      const descriptionHash = ethers.keccak256(
        ethers.toUtf8Bytes(proposal.description),
      );

      const tx = await governorWithSigner.queue(
        proposal.targets,
        proposal.values,
        proposal.calldatas,
        descriptionHash,
      );

      alert(`Queue transaction sent: ${tx.hash}. Waiting for confirmation...`);
      await tx.wait();
      alert("Proposal queued successfully!");
      onVoteSuccess();
    } catch (error: unknown) {
      console.error("Queueing failed:", error);
      const message = getErrorMessage(error);
      alert(`Queueing failed: ${message}`);
    } finally {
      setIsQueuing(false);
    }
  };

  const handleExecute = async () => {
    if (!contracts.governor || !account) {
      alert("Wallet not connected.");
      return;
    }

    setIsExecuting(true);
    try {
      if (!window.ethereum) throw new Error("No wallet found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const governorWithSigner = contracts.governor.connect(
        signer,
      ) as ethers.Contract;

      const descriptionHash = ethers.keccak256(
        ethers.toUtf8Bytes(proposal.description),
      );

      const tx = await governorWithSigner.execute(
        proposal.targets,
        proposal.values,
        proposal.calldatas,
        descriptionHash,
      );

      alert(
        `Execute transaction sent: ${tx.hash}. Waiting for confirmation...`,
      );
      await tx.wait();
      alert("Proposal executed successfully!");
      onVoteSuccess();
    } catch (error: unknown) {
      console.error("Execution failed:", error);
      const message = getErrorMessage(error);
      alert(`Execution failed: ${message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Helper to shorten CID for display
  const formatCID = (cid: string) => {
    if (!cid || cid.length < 20) return cid;
    return `${cid.slice(0, 10)}...${cid.slice(-8)}`;
  };

  const proposalIdStr = proposal.id.toString();

  return (
    <>
      <div className="relative bg-linear-to-br from-gray-900/90 via-gray-900/60 to-gray-950 border border-gray-800 rounded-xl p-5 xl:p-6 flex flex-col h-full shadow-2xl hover:border-gray-700 transition-colors">
        {/* Header: Status + Metadata */}
        <div className="flex items-start justify-between mb-6 gap-3">
          <div className="shrink-0">
            <StatusBadge status={proposal.status as ProposalStateName} />
          </div>

          {/* Metadata List */}
          <div className="flex-1 flex flex-col items-end gap-1.5 text-right">
            {/* Proposal ID */}
            <div
              className="flex items-center gap-1.5 text-[10px] text-gray-500"
              title={`Proposal ID: ${proposalIdStr}`}
            >
              <Hash className="w-2.5 h-2.5" />
              <span className="font-mono">
                {truncateAddress(proposalIdStr)}
              </span>
              <CopyButton textToCopy={proposalIdStr} size="xs" />
            </div>

            {/* Proposer */}
            <div
              className="flex items-center gap-1.5 text-[10px] text-gray-500"
              title={`Proposer: ${proposal.proposer}`}
            >
              {isBotProposer ? (
                <BotIcon className="w-2.5 h-2.5" />
              ) : (
                <User className="w-2.5 h-2.5" />
              )}
              <span className="font-mono">
                {truncateAddress(proposal.proposer)}
              </span>
              <CopyButton textToCopy={proposal.proposer} size="xs" />
            </div>
          </div>
        </div>

        {/* Tags Section */}
        <div className="mb-6">
          <ProposalTags tags={tags} />
        </div>

        {/* Voting Progress */}
        <div className="mb-6">
          <VoteProgressBar
            votes={{
              for: BigInt(proposal.votes.for.toString()),
              against: BigInt(proposal.votes.against.toString()),
              abstain: BigInt(proposal.votes.abstain.toString()),
            }}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-400" />
              <span className="font-semibold text-green-400">
                {proposal.votes.for.toString()}
              </span>
            </span>
            <span className="font-semibold text-gray-300">
              {proposal.votes.abstain.toString()}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-400" />
              <span className="font-semibold text-red-400">
                {proposal.votes.against.toString()}
              </span>
            </span>
          </div>
        </div>

        {/* Package-Specific Section */}
        {isPackageProposal && (
          <div className="mb-6 p-3 bg-blue-900/10 border border-blue-500/30 rounded-lg space-y-2">
            {/* IPFS CID */}
            {proposal.ipfsCID && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide">
                    IPFS CID
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 bg-gray-900/50 px-2.5 py-1.5 rounded border border-gray-700/50"
                  title={proposal.ipfsCID}
                >
                  <code className="text-[10px] font-mono text-white flex-1 truncate">
                    {formatCID(proposal.ipfsCID)}
                  </code>
                  <CopyButton textToCopy={proposal.ipfsCID} size="xs" />
                </div>
              </div>
            )}

            {/* Target Address */}
            {proposal.targetAddress && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide">
                    Target Address
                  </span>
                  <span className="text-[9px] bg-blue-600/30 text-blue-200 px-1.5 py-0.5 rounded border border-blue-500/40">
                    CREATE2
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 bg-gray-900/50 px-2.5 py-1.5 rounded border border-gray-700/50"
                  title={proposal.targetAddress}
                >
                  <code className="text-[10px] font-mono text-white flex-1 truncate">
                    {truncateAddress(proposal.targetAddress)}
                  </code>
                  <CopyButton textToCopy={proposal.targetAddress} size="xs" />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setShowPackageModal(true)}
                className="flex-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 rounded text-blue-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Details</span>
              </button>

              {proposal.status === "Active" && !hasVotedStatus && onVerify && (
                <button
                  onClick={onVerify}
                  className={`flex-1 px-3 py-1.5 border rounded text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    isVerified
                      ? "bg-green-600/20 hover:bg-green-600/30 border-green-600/50 hover:border-green-500 text-green-300"
                      : "bg-yellow-600/20 hover:bg-yellow-600/30 border-yellow-600/50 hover:border-yellow-500 text-yellow-300"
                  }`}
                >
                  {isVerified ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Verified</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify & Vote</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer: Actions + Timing */}
        <div className="border-t border-gray-800/50 pt-4 flex items-center justify-between">
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Active Voting */}
            {proposal.status === "Active" &&
              !hasVotedStatus &&
              !isCheckingVote && (
                <>
                  {/* Case 1: Standard Governance Proposal (No Code) - Always Show Buttons */}
                  {!isPackageProposal && (
                    <>
                      <button
                        onClick={() => handleVote(proposal.id, 1)}
                        className="px-4 py-2 text-xs font-semibold text-green-300 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 hover:border-green-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!account || isQueuing || isExecuting}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleVote(proposal.id, 0)}
                        className="px-4 py-2 text-xs font-semibold text-red-300 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 hover:border-red-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!account || isQueuing || isExecuting}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleVote(proposal.id, 2)}
                        className="px-4 py-2 text-xs font-semibold text-gray-300 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/50 hover:border-gray-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!account || isQueuing || isExecuting}
                      >
                        Abstain
                      </button>
                    </>
                  )}

                  {/* Case 2: Package Proposal - ONLY Show Buttons if Verified */}
                  {isPackageProposal && isVerified && (
                    <>
                      <button
                        onClick={() => handleVote(proposal.id, 1)}
                        className="px-4 py-2 text-xs font-semibold text-green-300 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 hover:border-green-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!account || isQueuing || isExecuting}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleVote(proposal.id, 0)}
                        className="px-4 py-2 text-xs font-semibold text-red-300 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 hover:border-red-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!account || isQueuing || isExecuting}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleVote(proposal.id, 2)}
                        className="px-4 py-2 text-xs font-semibold text-gray-300 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/50 hover:border-gray-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!account || isQueuing || isExecuting}
                      >
                        Abstain
                      </button>
                    </>
                  )}

                  {/* Case 3: Package Proposal - NOT Verified - Show Message */}
                  {isPackageProposal && !isVerified && (
                    <span className="text-xs text-yellow-500 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Verification required to vote
                    </span>
                  )}
                </>
              )}

            {/* Voted Status */}
            {proposal.status === "Active" && hasVotedStatus && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>You voted</span>
              </div>
            )}

            {/* Checking Status */}
            {proposal.status === "Active" && isCheckingVote && (
              <div className="text-xs text-gray-500 animate-pulse">
                Checking...
              </div>
            )}

            {/* Queue Button */}
            {proposal.status === "Succeeded" && (
              <button
                onClick={handleQueue}
                className="px-4 py-2 text-xs font-semibold text-yellow-300 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/50 hover:border-yellow-500 rounded-lg transition-all disabled:opacity-50"
                disabled={isQueuing || !account}
              >
                {isQueuing ? "Queuing..." : "Queue"}
              </button>
            )}

            {/* Execute Button */}
            {proposal.status === "Queued" && (
              <button
                onClick={handleExecute}
                className="px-4 py-2 text-xs font-semibold text-green-300 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 hover:border-green-500 rounded-lg transition-all disabled:opacity-50"
                disabled={isExecuting || !account}
              >
                {isExecuting ? "Executing..." : "Execute"}
              </button>
            )}

            {/* Final States */}
            {(proposal.status === "Executed" ||
              proposal.status === "Defeated" ||
              proposal.status === "Expired" ||
              proposal.status === "Canceled") && (
              <span className="text-xs text-gray-500">{proposal.status}</span>
            )}
          </div>

          {/* Timing Info */}
          <div className="flex flex-col items-end">
            {proposal.status === "Active" && calculatedBlocksLeft > 0 && (
              <>
                <div className="flex items-center gap-1 text-xs text-blue-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-semibold">
                    {calculatedBlocksLeft} blocks
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 mt-0.5">
                  {calculatedTimeStr}
                </span>
              </>
            )}

            {(proposal.status === "Executed" ||
              proposal.status === "Defeated" ||
              proposal.status === "Expired" ||
              proposal.status === "Canceled") && (
              <span className="text-xs text-gray-500">{proposal.status}</span>
            )}
          </div>
        </div>
      </div>

      {/* Package Preview Modal */}
      {proposal.ipfsCID && (
        <PackagePreviewModal
          isOpen={showPackageModal}
          onClose={() => setShowPackageModal(false)}
          ipfsCID={proposal.ipfsCID}
          proposalId={proposal.id.toString()}
        />
      )}
    </>
  );
};
