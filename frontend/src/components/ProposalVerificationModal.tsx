import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "./Modal";
import {
  CheckCircle2,
  Circle,
  Play,
  Loader2,
  ShieldCheck,
  FileCode,
  TestTube2,
  Eye,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Info,
  Lock,
  Box,
  Square,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { Contracts } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "/api";

interface ProposalVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalId: string;
  targetAddress: string;
  ipfsCID: string;
  projectId: string;
  contracts: Contracts;
  account: string | null;
  onVoteSuccess: () => void;
  canInteract?: boolean;
}

type StepStatus = "idle" | "loading" | "success" | "error" | "checked";

interface VerificationStep {
  status: StepStatus;
  msg: string;
}

export function ProposalVerificationModal({
  isOpen,
  onClose,
  proposalId,
  targetAddress,
  ipfsCID,
  projectId,
  contracts,
  account,
  onVoteSuccess,
  canInteract = false,
}: ProposalVerificationModalProps) {
  const [steps, setSteps] = useState<{
    math: VerificationStep;
    basic: VerificationStep;
    custom: VerificationStep;
    manual: VerificationStep;
  }>({
    math: { status: "idle", msg: "" },
    basic: { status: "idle", msg: "" },
    custom: { status: "idle", msg: "" },
    manual: { status: "idle", msg: "" },
  });

  const [isVoting, setIsVoting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/proposals/${proposalId}/status`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.record;
    } catch (e) {
      console.error("Failed to fetch verification status", e);
      return null;
    }
  }, [proposalId]);

  const updateStepsFromRecord = useCallback((record: any) => {
    if (!record) return;

    setSteps((prev) => ({
      ...prev,
      math:
        record.integrityStatus === "success"
          ? {
              status: "success",
              msg: record.integrityMessage || "Verified (Cached)",
            }
          : record.integrityStatus === "failure"
            ? {
                status: "error",
                msg: record.integrityMessage || "Verification failed",
              }
            : record.integrityStatus === "pending"
              ? {
                  status: "loading",
                  msg: record.integrityMessage || "Running...",
                }
              : prev.math,
      basic:
        record.basicStatus === "success"
          ? { status: "success", msg: record.basicMessage || "Passed (Cached)" }
          : record.basicStatus === "pending"
            ? { status: "loading", msg: record.basicMessage || "Running..." }
            : record.basicStatus === "failure"
              ? { status: "error", msg: record.basicMessage || "Failed" }
              : prev.basic,
      custom:
        record.customStatus === "success"
          ? {
              status: "success",
              msg: record.customMessage || "Passed (Cached)",
            }
          : record.customStatus === "pending"
            ? { status: "loading", msg: record.customMessage || "Running..." }
            : record.customStatus === "failure"
              ? { status: "error", msg: record.customMessage || "Failed" }
              : prev.custom,
    }));
  }, []);

  // Check for running tests and start polling if needed
  useEffect(() => {
    if (!isOpen) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    setIsInitializing(true);

    const checkAndPoll = async () => {
      const record = await fetchStatus();
      updateStepsFromRecord(record);
      setIsInitializing(false);

      // If any test is pending, start polling
      const isPending =
        record?.basicStatus === "pending" || record?.customStatus === "pending";

      if (isPending && !pollingRef.current) {
        pollingRef.current = setInterval(async () => {
          const updated = await fetchStatus();
          updateStepsFromRecord(updated);

          // Stop polling if no longer pending
          const stillPending =
            updated?.basicStatus === "pending" ||
            updated?.customStatus === "pending";
          if (!stillPending && pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }, 2000); // Poll every 2 seconds
      }
    };

    checkAndPoll();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen, proposalId, fetchStatus, updateStepsFromRecord]);

  const cancelTest = async (type: "basic" | "custom") => {
    try {
      const res = await fetch(`${API_URL}/proposals/${proposalId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const stepKey = type === "basic" ? "basic" : "custom";
        setSteps((s) => ({
          ...s,
          [stepKey]: { status: "error", msg: "Cancelled by user" },
        }));
      }
    } catch (e) {
      console.error("Failed to cancel test", e);
    }
  };

  const runVerificationStep = async (endpoint: string) => {
    const governorAddress = contracts.governor
      ? (contracts.governor as Contracts["governor"])?.target ||
        (contracts.governor as Contracts["governor"])?.address
      : null;

    if (!governorAddress) {
      throw new Error("Governor contract not connected");
    }

    const res = await fetch(`${API_URL}/proposals/${proposalId}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetAddress, ipfsCID, governorAddress, projectId }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Verification request failed");
    }

    const data = await res.json();
    if (!data.result?.success) {
      throw new Error(data.result?.message || "Check failed");
    }
    return data.result.message;
  };

  // 1. Math Check (Integrity) - MANDATORY
  const verifyMath = useMutation({
    mutationFn: () => runVerificationStep("/check/integrity"),
    onMutate: () =>
      setSteps((s) => ({
        ...s,
        math: { status: "loading", msg: "Verifying bytecode hash..." },
      })),
    onSuccess: (msg) => {
      setSteps((s) => ({
        ...s,
        math: { status: "success", msg: msg || "Hash verified ✓" },
      }));
    },
    onError: (error: Error) =>
      setSteps((s) => ({
        ...s,
        math: { status: "error", msg: error.message },
      })),
  });

  // 2. Standard Tests (Package Tests)
  const runStandardTests = useMutation({
    mutationFn: () => runVerificationStep("/check/basic"),
    onMutate: () =>
      setSteps((s) => ({
        ...s,
        basic: {
          status: "loading",
          msg: "Running package tests (pnpm test)...",
        },
      })),
    onSuccess: (msg) => {
      setSteps((s) => ({
        ...s,
        basic: { status: "success", msg: msg || "Standard tests passed ✓" },
      }));
    },
    onError: (error: Error) =>
      setSteps((s) => ({
        ...s,
        basic: { status: "error", msg: error.message },
      })),
  });

  // 3. Custom Tests (Sovereign/Private Tests)
  const runCustomTests = useMutation({
    mutationFn: () => runVerificationStep("/check/custom"),
    onMutate: () =>
      setSteps((s) => ({
        ...s,
        custom: {
          status: "loading",
          msg: "Running sovereign test suite...",
        },
      })),
    onSuccess: (msg) => {
      setSteps((s) => ({
        ...s,
        custom: { status: "success", msg: msg || "Custom tests passed ✓" },
      }));
    },
    onError: (error: Error) =>
      setSteps((s) => ({
        ...s,
        custom: { status: "error", msg: error.message },
      })),
  });

  // Logic to check if Math check passed
  const isMathVerified = steps.math.status === "success";

  // Manual Review Toggle - LOCKED until Math verified
  const toggleManualReview = () => {
    if (!isMathVerified) return;

    const newStatus = steps.manual.status === "checked" ? "idle" : "checked";
    setSteps((s) => ({
      ...s,
      manual: {
        status: newStatus,
        msg: newStatus === "checked" ? "Code reviewed ✓" : "",
      },
    }));
  };

  // Voting requires Math Check + Manual Review
  const canVote = isMathVerified && steps.manual.status === "checked";

  const handleVote = async (support: number) => {
    if (!contracts.governor || !account) {
      alert("Please connect your wallet");
      return;
    }

    if (!canVote) {
      alert("Please complete the mandatory integrity check and code review.");
      return;
    }

    setIsVoting(true);
    try {
      const tx = await contracts.governor.castVote(BigInt(proposalId), support);
      alert(`Vote transaction sent: ${tx.hash}`);
      await tx.wait();
      alert("✅ Vote recorded successfully!");
      onVoteSuccess();
      onClose();
    } catch (error: unknown) {
      console.error("Voting failed:", error);
      const message =
        error && typeof error === "object" && "reason" in error
          ? String((error as any).reason)
          : String(error);
      alert(`Voting failed: ${message}`);
    } finally {
      setIsVoting(false);
    }
  };

  const StatusIcon = ({ status }: { status: StepStatus }) => {
    switch (status) {
      case "loading":
        return (
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-5 h-5 text-blue-400" />
          </motion.div>
        );
      case "success":
      case "checked":
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </motion.div>
        );
      case "error":
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <XCircle className="w-5 h-5 text-red-400" />
          </motion.div>
        );
      default:
        return <Circle className="w-5 h-5 text-gray-600" />;
    }
  };

  const StepButton = ({
    status,
    onRun,
    onCancel,
    isLoading,
    loadingText = "Running...",
    idleText = "Run Check",
  }: {
    status: StepStatus;
    onRun: () => void;
    onCancel?: () => void;
    isLoading: boolean;
    loadingText?: string;
    idleText?: string;
  }) => {
    if (status === "success") {
      return (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="px-4 py-1.5 bg-green-500/10 border border-green-500/30 rounded-md text-xs font-semibold text-green-400"
        >
          Passed
        </motion.div>
      );
    }

    if (status === "error") {
      return (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <div className="px-4 py-1.5 bg-red-500/10 border border-red-500/30 rounded-md text-xs font-semibold text-red-400">
            Failed
          </div>
          <button
            onClick={onRun}
            className="px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700/80 border border-white/10 rounded-md text-xs font-medium text-gray-300 transition-colors"
          >
            Retry
          </button>
        </motion.div>
      );
    }

    if (isLoading && onCancel) {
      return (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <div className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-md text-xs font-semibold text-blue-400 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            {loadingText}
          </div>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/60 border border-red-500/30 hover:border-red-500/50 rounded-md text-xs font-medium text-red-300 transition-colors flex items-center gap-1"
          >
            <Square className="w-3 h-3" />
            Cancel
          </button>
        </motion.div>
      );
    }

    return (
      <button
        onClick={onRun}
        disabled={isLoading}
        className="group px-4 py-1.5 bg-gray-800/80 hover:bg-gray-700/80 disabled:bg-gray-800/50 border border-white/10 hover:border-white/20 disabled:border-white/5 rounded-md text-xs font-medium text-gray-300 disabled:text-gray-500 transition-all disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            {loadingText}
          </>
        ) : (
          <>
            <Play className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            {idleText}
          </>
        )}
      </button>
    );
  };

  return (
    <Modal show={isOpen} onClose={onClose} title="" size="lg">
      {isInitializing ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-sm text-gray-400">
            Loading verification status...
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-1">
                Proposal Verification
              </h2>
              <p className="text-sm text-gray-400">
                Mandatory integrity check required. Package tests and custom
                tests are recommended.
              </p>
            </div>
          </div>

          {/* Advisory Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs text-gray-300">
                <span className="font-semibold text-blue-300">Protocol:</span>{" "}
                You must verify the bytecode hash (Step 1) to unlock the code
                review. Running the standard package tests (Step 2) is highly
                advised.
              </div>
            </div>
          </motion.div>

          {/* Verification Steps */}
          <div className="space-y-2">
            {/* Step 1: Math Check - MANDATORY */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`bg-gray-900/50 border rounded-lg p-4 transition-colors ${
                steps.math.status === "error"
                  ? "border-red-500/30"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <StatusIcon status={steps.math.status} />
                  <FileCode className="w-4 h-4 text-gray-500" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                      Step 1: Math Check
                      <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-full font-mono">
                        MANDATORY
                      </span>
                    </div>
                    <AnimatePresence mode="wait">
                      {steps.math.msg ? (
                        <motion.div
                          key={steps.math.msg}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className={`text-xs mt-0.5 ${
                            steps.math.status === "error"
                              ? "text-red-400"
                              : "text-gray-500"
                          }`}
                        >
                          {steps.math.msg}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="default"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs text-gray-500 mt-0.5"
                        >
                          Verify bytecode hash matches Create2 target
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <StepButton
                  status={steps.math.status}
                  onRun={() => verifyMath.mutate()}
                  isLoading={verifyMath.isPending}
                  loadingText="Verifying..."
                />
              </div>
            </motion.div>

            {/* Step 2: Standard Tests (Optional) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900/50 border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <StatusIcon status={steps.basic.status} />
                  <Box className="w-4 h-4 text-gray-500" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                      Step 2: Standard Tests
                      <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full font-mono">
                        RECOMMENDED
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {steps.basic.msg ||
                        "Run 'pnpm test' included in the package"}
                    </div>
                  </div>
                </div>
                <StepButton
                  status={steps.basic.status}
                  onRun={() => runStandardTests.mutate()}
                  onCancel={() => cancelTest("basic")}
                  isLoading={
                    runStandardTests.isPending ||
                    steps.basic.status === "loading"
                  }
                  loadingText="Running..."
                  idleText="Run Tests"
                />
              </div>
            </motion.div>

            {/* Step 3: Custom Tests (Optional) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-900/50 border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <StatusIcon status={steps.custom.status} />
                  <TestTube2 className="w-4 h-4 text-gray-500" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                      Step 3: Custom Tests
                      <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full font-mono">
                        RECOMMENDED
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {steps.custom.msg || "Run private verification suite"}
                    </div>
                  </div>
                </div>
                <StepButton
                  status={steps.custom.status}
                  onRun={() => runCustomTests.mutate()}
                  onCancel={() => cancelTest("custom")}
                  isLoading={
                    runCustomTests.isPending ||
                    steps.custom.status === "loading"
                  }
                  loadingText="Testing..."
                  idleText="Run Tests"
                />
              </div>
            </motion.div>

            {/* Step 4: Manual Review - LOCKED if Math check incomplete */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`bg-gray-900/50 border rounded-lg p-4 transition-colors ${
                isMathVerified
                  ? "border-white/10 hover:border-white/20"
                  : "border-yellow-500/20 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <StatusIcon status={steps.manual.status} />
                  <Eye className="w-4 h-4 text-gray-500" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                      Step 4: Code Review
                      <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-full font-mono">
                        MANDATORY
                      </span>
                      {!isMathVerified && (
                        <Lock className="w-3 h-3 text-yellow-500 ml-1" />
                      )}
                    </div>
                    <AnimatePresence mode="wait">
                      {!isMathVerified ? (
                        <motion.div
                          key="locked"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs text-yellow-500 mt-0.5 flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3" />
                          Pass Math Check (Step 1) to unlock
                        </motion.div>
                      ) : steps.manual.msg ? (
                        <motion.div
                          key={steps.manual.msg}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-gray-500 mt-0.5"
                        >
                          {steps.manual.msg}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="default"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs text-gray-500 mt-0.5"
                        >
                          I have manually reviewed the code changes
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="relative">
                  <label
                    className={`relative inline-flex items-center ${
                      isMathVerified
                        ? "cursor-pointer"
                        : "cursor-not-allowed opacity-50"
                    }`}
                    title={
                      !isMathVerified
                        ? "Verify integrity first"
                        : "Confirm review"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={steps.manual.status === "checked"}
                      onChange={toggleManualReview}
                      disabled={!isMathVerified}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Voting Section */}
          <AnimatePresence>
            {canVote && (
              <motion.div
                initial={{ opacity: 0, y: 20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: 20, height: 0 }}
                className="border-t border-white/10 pt-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Ready to Vote
                    </h3>
                    <p className="text-xs text-gray-400">
                      Mandatory checks passed. You may now cast your vote.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <motion.button
                    onClick={() => handleVote(1)}
                    disabled={isVoting || !account || !canInteract}
                    whileHover={{ scale: canInteract ? 1.02 : 1 }}
                    whileTap={{ scale: canInteract ? 0.98 : 1 }}
                    className="flex flex-col items-center gap-2 p-4 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 hover:border-green-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    title={
                      !canInteract
                        ? "Connect wallet as stakeholder to vote"
                        : "Approve"
                    }
                  >
                    <ThumbsUp className="w-6 h-6 text-green-400 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-green-300">
                      Approve
                    </span>
                  </motion.button>

                  <motion.button
                    onClick={() => handleVote(0)}
                    disabled={isVoting || !account || !canInteract}
                    whileHover={{ scale: canInteract ? 1.02 : 1 }}
                    whileTap={{ scale: canInteract ? 0.98 : 1 }}
                    className="flex flex-col items-center gap-2 p-4 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 hover:border-red-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    title={
                      !canInteract
                        ? "Connect wallet as stakeholder to vote"
                        : "Reject"
                    }
                  >
                    <ThumbsDown className="w-6 h-6 text-red-400 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-red-300">
                      Reject
                    </span>
                  </motion.button>

                  <motion.button
                    onClick={() => handleVote(2)}
                    disabled={isVoting || !account || !canInteract}
                    whileHover={{ scale: canInteract ? 1.02 : 1 }}
                    whileTap={{ scale: canInteract ? 0.98 : 1 }}
                    className="flex flex-col items-center gap-2 p-4 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/50 hover:border-gray-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    title={
                      !canInteract
                        ? "Connect wallet as stakeholder to vote"
                        : "Abstain"
                    }
                  >
                    <Minus className="w-6 h-6 text-gray-400 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-gray-300">
                      Abstain
                    </span>
                  </motion.button>
                </div>

                {isVoting && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3 flex items-center justify-center gap-2 text-xs text-blue-400"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing your vote...
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Actions */}
          <div className="flex items-center justify-end pt-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
