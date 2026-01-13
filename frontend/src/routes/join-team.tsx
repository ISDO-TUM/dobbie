import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Shield,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  Eye,
  Users,
} from "lucide-react";
import { isAddress } from "ethers";
import useWeb3Connection from "../hooks/useWeb3Connection";
import { useCheckStakeholder } from "../hooks/useCheckStakeholder";
import { useJoinTeamMutation } from "../queries/teams";

export const Route = createFileRoute("/join-team")({
  component: JoinTeam,
});

// Validation Schema
const joinTeamSchema = z.object({
  governorAddress: z
    .string()
    .min(1, "Governor address is required")
    .refine((addr) => isAddress(addr), "Invalid Ethereum address"),
  registryAddress: z
    .string()
    .min(1, "Registry address is required")
    .refine((addr) => isAddress(addr), "Invalid Ethereum address"),
  deploymentBlock: z.coerce.number().min(0).optional(),
});

type JoinTeamForm = z.infer<typeof joinTeamSchema>;

interface VerificationResult {
  isStakeholder: boolean;
  teamName: string;
}

function JoinTeam() {
  const navigate = useNavigate();
  const { account: connectedWallet } = useWeb3Connection();
  const isConnected = !!connectedWallet;

  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm({
    resolver: zodResolver(joinTeamSchema),
    defaultValues: {
      governorAddress: "",
      registryAddress: "",
      deploymentBlock: undefined,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = form;

  const joinTeamMutation = useJoinTeamMutation();
  const { checkStakeholder } = useCheckStakeholder();

  const handleVerify = async (data: JoinTeamForm) => {
    if (!connectedWallet) {
      alert("Please connect your wallet first");
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const result = await checkStakeholder(
        data.governorAddress,
        connectedWallet,
      );

      setVerificationResult(result);
    } catch (error) {
      console.error("Verification failed:", error);
      alert("Failed to verify membership. Please check the addresses.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleJoinTeam = async () => {
    const data = getValues();
    if (!verificationResult) return;

    try {
      await joinTeamMutation.mutateAsync({
        name: verificationResult.teamName,
        governorAddress: data.governorAddress,
        registryAddress: data.registryAddress,
        isImport: true,
        deploymentBlock: data.deploymentBlock as number | undefined,
      });

      navigate({ to: "/" });
    } catch (error) {
      console.error("Failed to join team:", error);
      alert("Failed to join team. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#040710] via-[#0a0f1e] to-[#040710] p-6 lg:p-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <Shield className="w-10 h-10 text-purple-400" />
            <h1 className="text-4xl lg:text-5xl font-bold bg-linear-to-r from-purple-400 via-blue-400 to-pink-400 bg-clip-text text-transparent">
              Join Existing Team
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Connect to an existing governance system
          </p>
        </motion.div>

        {/* Wallet Connection Warning */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-yellow-600/10 border border-yellow-600/30 rounded-xl p-6 mb-6"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-yellow-300 font-semibold mb-1">
                  Wallet Not Connected
                </h3>
                <p className="text-gray-300 text-sm">
                  Please connect your wallet to verify your stakeholder status.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-linear-to-br from-gray-900/90 via-gray-900/60 to-gray-950 border border-gray-800 rounded-xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Team Contracts</h2>
          </div>

          <form onSubmit={handleSubmit(handleVerify)} className="space-y-6">
            {/* Governor Address */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Governor Contract Address{" "}
                <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                {...register("governorAddress")}
                placeholder="0x..."
                className={`w-full px-4 py-3 bg-gray-900/50 border ${
                  errors.governorAddress ? "border-red-500" : "border-gray-700"
                } rounded-lg text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors`}
                disabled={isVerifying || verificationResult !== null}
              />
              {errors.governorAddress && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.governorAddress.message}
                </p>
              )}
            </div>

            {/* Registry Address */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Registry Contract Address{" "}
                <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                {...register("registryAddress")}
                placeholder="0x..."
                className={`w-full px-4 py-3 bg-gray-900/50 border ${
                  errors.registryAddress ? "border-red-500" : "border-gray-700"
                } rounded-lg text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors`}
                disabled={isVerifying || verificationResult !== null}
              />
              {errors.registryAddress && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.registryAddress.message}
                </p>
              )}
            </div>

            {/* Deployment Block (Optional) */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Deployment Block <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                {...register("deploymentBlock")}
                placeholder="0"
                className={`w-full px-4 py-3 bg-gray-900/50 border ${
                  errors.deploymentBlock ? "border-red-500" : "border-gray-700"
                } rounded-lg text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors`}
                disabled={isVerifying || verificationResult !== null}
              />
              <p className="text-xs text-gray-500 mt-1">
                The block number where the contracts were deployed. Helps with indexing speed.
              </p>
              {errors.deploymentBlock && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.deploymentBlock.message}
                </p>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <p className="font-semibold text-blue-300 mb-1">
                    Stakeholder Verification
                  </p>
                  <p>
                    We'll check if your connected wallet (
                    <code className="text-purple-400 font-mono text-xs">
                      {connectedWallet
                        ? `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`
                        : "Not connected"}
                    </code>
                    ) is a stakeholder in this team.
                  </p>
                </div>
              </div>
            </div>

            {/* Verify Button */}
            {!verificationResult && (
              <button
                type="submit"
                disabled={isVerifying || !isConnected}
                className="w-full px-6 py-4 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-3"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying On-Chain...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Verify Contracts
                  </>
                )}
              </button>
            )}
          </form>

          {/* Verification Result */}
          {verificationResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              {verificationResult.isStakeholder ? (
                // --- STAKEHOLDER UI ---
                <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-green-500/20 rounded-full">
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-green-300 mb-1">
                        Access Granted
                      </h3>
                      <p className="text-gray-300 text-sm">
                        You are a registered stakeholder of{" "}
                        <strong>{verificationResult.teamName}</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setVerificationResult(null)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Try Different Team
                    </button>
                    <button
                      onClick={handleJoinTeam}
                      disabled={joinTeamMutation.isPending}
                      className="flex-1 px-6 py-3 bg-linear-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      {joinTeamMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Join Team
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                // --- VIEW ONLY UI ---
                <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-xl p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-yellow-500/20 rounded-full">
                      <XCircle className="w-8 h-8 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-yellow-300 mb-1">
                        View Only Access
                      </h3>
                      <p className="text-gray-300 text-sm">
                        You are not a stakeholder of{" "}
                        <strong>{verificationResult.teamName}</strong> yet.
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-300">
                        <p className="font-semibold text-blue-300 mb-1">
                          Observer Mode
                        </p>
                        <p>
                          You can import this team to watch proposals and
                          deployments, but you cannot vote or execute actions.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setVerificationResult(null)}
                      className="px-4 py-2 bg-gray-800 rounded-lg text-white text-sm"
                    >
                      Retry
                    </button>
                    <button
                      onClick={handleJoinTeam}
                      className="flex-1 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2"
                    >
                      <Eye className="w-5 h-5" /> Import as Observer
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-center text-sm text-gray-500"
        >
          Need to create a new team?{" "}
          <button
            onClick={() => navigate({ to: "/create-team" })}
            className="text-blue-400 hover:text-blue-300 font-semibold"
          >
            Create Team
          </button>
        </motion.div>
      </div>
    </div>
  );
}
