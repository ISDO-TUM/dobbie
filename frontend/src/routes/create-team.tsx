import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle2,
  Circle,
  Rocket,
  Plus,
  Sparkles,
  Wallet,
  Shield,
  Bot,
  Clock,
  Trash2,
  Users,
  Book,
  LayoutDashboard,
} from "lucide-react";
import confetti from "canvas-confetti";
import { isAddress } from "ethers";
import useWeb3Connection from "../hooks/useWeb3Connection";
import { useDeployer } from "../hooks/useDeployer";
import {
  useRegisterTeamMutation,
  artifactsQueryOptions,
} from "../queries/teams";
import { useSuspenseQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/create-team")({
  component: CreateTeam,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(artifactsQueryOptions);
  },
});

// --- VALIDATION SCHEMAS ---

const step1Schema = z.object({
  teamName: z.string().min(3, "Team name must be at least 3 characters"),
});

type Step1Form = z.infer<typeof step1Schema>;

interface Step2FormInput {
  stakeholders: { walletAddress: string }[];
  bots: { address: string; role: "proposer" | "executor"; name?: string }[];
  votingDelay: number | string;
  votingPeriod: number | string;
  minDelay: number | string;
}

const step2Schema = z.object({
  stakeholders: z
    .array(
      z.object({
        walletAddress: z
          .string()
          .refine((addr) => isAddress(addr), "Invalid Ethereum address"),
      }),
    )
    .min(1, "At least one stakeholder is required"),
  bots: z.array(
    z.object({
      address: z
        .string()
        .refine((addr) => isAddress(addr), "Invalid Ethereum address"),
      role: z.enum(["proposer", "executor"]),
      name: z.string().optional(),
    }),
  ),

  votingDelay: z.coerce.number().min(0, "Cannot be negative"),
  votingPeriod: z.coerce.number().min(1, "Must be at least 1 block"),
  minDelay: z.coerce.number().min(0, "Cannot be negative"),
});

type Step2FormOutput = z.output<typeof step2Schema>;

interface LogEntry {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "pending";
  timestamp: Date;
}

interface DeploymentResult {
  governorAddress?: string;
  registryAddress?: string;
  timelockAddress?: string;
  deploymentBlock?: number;
  teamId?: number;
}

function CreateTeam() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult>(
    {},
  );

  const { account: connectedWallet } = useWeb3Connection();

  // --- FORM MANAGEMENT ---

  const step1Form = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: { teamName: "" },
  });

  const step2Form = useForm<Step2FormInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(step2Schema) as any,
    defaultValues: {
      stakeholders: [{ walletAddress: connectedWallet ?? "" }],
      bots: [],
      votingDelay: 1,
      votingPeriod: 2160,
      minDelay: 7200, // 2 hours in seconds
    },
    mode: "onChange",
  });

  // Sync wallet address to form if it loads late
  useEffect(() => {
    if (connectedWallet) {
      const current = step2Form.getValues("stakeholders");
      if (current[0]?.walletAddress === "") {
        step2Form.setValue("stakeholders.0.walletAddress", connectedWallet);
      }
    }
  }, [connectedWallet, step2Form]);

  // --- LOGIC ---

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        message,
        type,
        timestamp: new Date(),
      },
    ]);
  };

  const { deployContracts } = useDeployer();
  const { data: artifacts } = useSuspenseQuery(artifactsQueryOptions);
  const registerTeam = useRegisterTeamMutation();

  const handleStep1Submit = () => setCurrentStep(2);
  const handleStep2Submit = () => setCurrentStep(3);

  const handleDeployment = async () => {
    setLogs([]);
    const step1Data = step1Form.getValues();
    const step2Data = step2Form.getValues() as unknown as Step2FormOutput;

    try {
      addLog("🔐 Preparing contract deployment...", "pending");

      const result = await deployContracts(
        {
          factoryArtifact: {
            abi: artifacts.factory.abi,
            bytecode: artifacts.factory.bytecode,
          },
          timelockArtifact: {
            abi: artifacts.timelock.abi,
            bytecode: artifacts.timelock.bytecode,
          },
          governorArtifact: {
            abi: artifacts.governor.abi,
            bytecode: artifacts.governor.bytecode,
          },
          registryArtifact: {
            abi: artifacts.registry.abi,
            bytecode: artifacts.registry.bytecode,
          },
          teamName: step1Data.teamName,
          stakeholders: step2Data.stakeholders.map((s) => s.walletAddress),
          bots: step2Data.bots,
          votingDelay: step2Data.votingDelay,
          votingPeriod: step2Data.votingPeriod,
          minDelay: step2Data.minDelay,
        },
        (msg) => addLog(msg, "pending"),
      );

      addLog("🎉 Contracts deployed & wired successfully!", "success");

      addLog("📡 Registering team in database...", "pending");

      const registeredTeam = await registerTeam.mutateAsync({
        name: step1Data.teamName,
        governorAddress: result.governorAddress,
        registryAddress: result.registryAddress,
        deploymentBlock: result.deploymentBlock,
      });

      // Update deployment result with the new team ID
      setDeploymentResult({ ...result, teamId: registeredTeam.id });

      addLog("✅ Team registered successfully!", "success");

      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ["#3b82f6", "#10b981", "#8b5cf6"],
      });
    } catch (error) {
      console.error(error);
      addLog("❌ Deployment failed. Please try again.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#040710] via-[#0a0f1e] to-[#040710] p-6 lg:p-12">
      <div className="max-w-5xl mx-auto">
        <Header />
        <StepIndicator currentStep={currentStep} />

        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <Step1
              form={step1Form}
              onNext={step1Form.handleSubmit(handleStep1Submit)}
            />
          )}
          {currentStep === 2 && (
            <Step2
              form={step2Form}
              connectedWallet={connectedWallet ?? "Not Connected"}
              onNext={step2Form.handleSubmit(handleStep2Submit)}
              onBack={() => setCurrentStep(1)}
            />
          )}
          {currentStep === 3 && (
            <Step3
              teamName={step1Form.getValues("teamName")}
              config={step2Form.getValues()}
              onDeploy={handleDeployment}
              onBack={() => setCurrentStep(2)}
              logs={logs}
              deploymentResult={deploymentResult}
            />
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-center text-sm text-gray-500"
        >
          Already have team contracts?{" "}
          <button
            onClick={() => navigate({ to: "/join-team" })}
            className="text-purple-400 hover:text-purple-300 font-semibold"
          >
            Join Existing Team
          </button>
        </motion.div>
      </div>
    </div>
  );
}

// --- SUBCOMPONENTS ---

function Header() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-8"
    >
      <div className="flex items-center justify-center gap-3 mb-2">
        <Shield className="w-10 h-10 text-blue-400" />
        <h1 className="text-4xl lg:text-5xl font-bold bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Create Sovereign Team
        </h1>
      </div>
      <p className="text-gray-400 text-lg">
        Deploy your own on-chain governance infrastructure
      </p>
    </motion.div>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { number: 1, label: "Identity" },
    { number: 2, label: "Configuration" },
    { number: 3, label: "Deployment" },
  ];

  return (
    <div className="mb-12">
      <div className="flex items-center justify-center">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                animate={{ scale: currentStep === step.number ? 1.1 : 1 }}
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                  currentStep > step.number
                    ? "bg-green-600 border-green-500"
                    : currentStep === step.number
                      ? "bg-blue-600 border-blue-500"
                      : "bg-gray-800 border-gray-700"
                }`}
              >
                {currentStep > step.number ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : (
                  <span className="text-white font-bold">{step.number}</span>
                )}
              </motion.div>
              <span
                className={`mt-2 text-xs font-semibold ${
                  currentStep >= step.number ? "text-blue-400" : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-24 h-1 mx-4 ${
                  currentStep > step.number ? "bg-green-600" : "bg-gray-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- STEP 1: IDENTITY ---
function Step1({
  form,
  onNext,
}: {
  form: UseFormReturn<Step1Form>;
  onNext: () => void;
}) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="bg-linear-to-br from-gray-900/90 via-gray-900/60 to-gray-950 border border-gray-800 rounded-xl p-8 max-w-2xl mx-auto">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Team Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              {...register("teamName")}
              placeholder="e.g., Core Infrastructure Team"
              autoFocus
              className={`w-full px-4 py-3 bg-gray-900/50 border ${
                errors.teamName ? "border-red-500" : "border-gray-700"
              } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors`}
            />
            {errors.teamName && (
              <p className="text-red-400 text-xs mt-1">
                {errors.teamName.message}
              </p>
            )}
          </div>

          <div className="mt-8">
            <button
              onClick={onNext}
              className="w-full px-6 py-4 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-3"
            >
              <Rocket className="w-5 h-5" />
              Configure Governance
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- STEP 2: CONFIGURATION (Stakeholders + Bots + Settings) ---
function Step2({
  form,
  connectedWallet,
  onNext,
  onBack,
}: {
  form: UseFormReturn<Step2FormInput>;
  connectedWallet: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const stakeholders = watch("stakeholders");
  const bots = watch("bots");

  // Handlers
  const addStakeholder = () =>
    setValue("stakeholders", [...stakeholders, { walletAddress: "" }]);
  const removeStakeholder = (idx: number) =>
    setValue(
      "stakeholders",
      stakeholders.filter((_, i) => i !== idx),
    );
  const updateStakeholder = (idx: number, val: string) => {
    const arr = [...stakeholders];
    arr[idx].walletAddress = val;
    setValue("stakeholders", arr);
  };

  const addBot = () =>
    setValue("bots", [...bots, { address: "", role: "proposer", name: "" }]);
  const removeBot = (idx: number) =>
    setValue(
      "bots",
      bots.filter((_, i) => i !== idx),
    );
  const updateBot = (
    idx: number,
    field: keyof (typeof bots)[0],
    val: string,
  ) => {
    const arr = [...bots];
    // @ts-expect-error - Dynamic field assignment
    arr[idx][field] = val;
    setValue("bots", arr);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="bg-linear-to-br from-gray-900/90 via-gray-900/60 to-gray-950 border border-gray-800 rounded-xl p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">
            Governance Configuration
          </h2>
        </div>

        <div className="space-y-10">
          {/* SECTION 1: STAKEHOLDERS */}
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Voting Stakeholders
              </h3>
              <button
                type="button"
                onClick={addStakeholder}
                className="text-blue-400 text-xs hover:text-blue-300 flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3 h-3" /> Add Member
              </button>
            </div>

            <div className="space-y-3">
              {/* Admin */}
              <div className="bg-green-600/10 border border-green-600/30 rounded-lg p-3 flex items-center justify-between">
                <span className="text-xs font-bold text-green-300 uppercase flex items-center gap-2">
                  <Wallet className="w-3 h-3" /> Admin (You)
                </span>
                <span className="text-xs font-mono text-green-400">
                  {connectedWallet}
                </span>
              </div>

              {/* Members */}
              {stakeholders.slice(1).map((s, i) => (
                <div key={i + 1} className="flex gap-3">
                  <div className="flex-1">
                    <input
                      value={s.walletAddress}
                      onChange={(e) => updateStakeholder(i + 1, e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStakeholder(i + 1)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: BOTS */}
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-400" /> Automation Bots
              </h3>
              <button
                type="button"
                onClick={addBot}
                className="text-purple-400 text-xs hover:text-purple-300 flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3 h-3" /> Add Bot
              </button>
            </div>

            <div className="space-y-3">
              {bots.length === 0 && (
                <p className="text-xs text-gray-500 italic p-2 border border-dashed border-gray-800 rounded">
                  No bots configured. (Optional)
                </p>
              )}
              {bots.map((bot, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={bot.role}
                    onChange={(e) => updateBot(i, "role", e.target.value)}
                    className="px-2 py-2 bg-gray-800 border border-gray-700 rounded text-xs text-white uppercase font-bold focus:border-purple-500 focus:outline-none"
                  >
                    <option value="proposer">Proposer</option>
                    <option value="executor">Executor</option>
                  </select>
                  <input
                    placeholder="Bot Wallet Address"
                    value={bot.address}
                    onChange={(e) => updateBot(i, "address", e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm font-mono focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeBot(i)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: VOTING */}
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-gray-800 pb-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                Voting Parameters
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Voting Delay (Blocks)
                </label>
                <input
                  type="number"
                  {...register("votingDelay")}
                  className={`w-full px-3 py-2 bg-gray-900/50 border ${
                    errors.votingDelay ? "border-red-500" : "border-gray-700"
                  } rounded text-white text-sm focus:border-yellow-500 focus:outline-none`}
                />
                {errors.votingDelay ? (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.votingDelay.message}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Wait time before voting starts.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Voting Period (Blocks)
                </label>
                <input
                  type="number"
                  {...register("votingPeriod")}
                  className={`w-full px-3 py-2 bg-gray-900/50 border ${
                    errors.votingPeriod ? "border-red-500" : "border-gray-700"
                  } rounded text-white text-sm focus:border-yellow-500 focus:outline-none`}
                />
                {errors.votingPeriod ? (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.votingPeriod.message}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Duration of the vote window.
                  </p>
                )}
              </div>
            </div>

            {/* Timelock Min Delay */}
            <div className="mt-4">
              <label className="block text-xs text-gray-400 mb-1">
                Timelock Min Delay (Seconds)
              </label>
              <input
                type="number"
                {...register("minDelay")}
                className={`w-full px-3 py-2 bg-gray-900/50 border ${
                  errors.minDelay ? "border-red-500" : "border-gray-700"
                } rounded text-white text-sm focus:border-yellow-500 focus:outline-none`}
              />
              {errors.minDelay ? (
                <p className="text-red-400 text-xs mt-1">
                  {errors.minDelay.message}
                </p>
              ) : (
                <p className="text-[10px] text-gray-500 mt-1">
                  Time before queued proposals can be executed. Default: 7200s
                  (2 hours).
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-3 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="flex-1 px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all"
          >
            <Rocket className="w-5 h-5" /> Proceed to Deployment
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// --- STEP 3: DEPLOYMENT ---
function Step3({
  teamName,
  config,
  onDeploy,
  onBack,
  logs,
  deploymentResult,
}: {
  teamName: string;
  config: Step2FormInput;
  onDeploy: () => void;
  onBack: () => void;
  logs: LogEntry[];
  deploymentResult: DeploymentResult;
}) {
  const navigate = useNavigate();
  const [hasStarted, setHasStarted] = useState(false);
  const isComplete =
    !!deploymentResult.governorAddress && !!deploymentResult.teamId;

  const handleDeploy = () => {
    setHasStarted(true);
    onDeploy();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {!hasStarted ? (
        // Pre-Launch Summary
        <div className="bg-linear-to-br from-green-900/20 via-blue-900/20 to-gray-900/90 border border-green-600/30 rounded-xl p-8 relative overflow-hidden">
          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <Rocket className="w-8 h-8 text-green-400" />
              <h2 className="text-3xl font-bold text-white">
                Deployment Launchpad
              </h2>
            </div>

            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 mb-6 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Team Name</span>
                <span className="text-white font-semibold">{teamName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Stakeholders</span>
                <span className="text-blue-400 font-semibold">
                  {config.stakeholders.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bots</span>
                <span className="text-purple-400 font-semibold">
                  {config.bots.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Voting Settings</span>
                <span className="text-yellow-400 font-mono">
                  {config.votingDelay} delay / {config.votingPeriod} period
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Timelock Min Delay</span>
                <span className="text-yellow-400 font-mono">
                  {config.minDelay}s (~
                  {Math.floor(Number(config.minDelay) / 3600)}h)
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg"
              >
                Back
              </button>
              <button
                onClick={handleDeploy}
                className="flex-1 px-6 py-4 bg-linear-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-3"
              >
                <Sparkles className="w-5 h-5" /> Launch Sovereign System
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Deployment Log
        <>
          <TerminalLog logs={logs} />
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-linear-to-br from-green-900/20 via-blue-900/20 to-gray-900/90 border border-green-600/50 rounded-xl p-8 text-center mt-6"
            >
              <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-2">
                System Online
              </h2>
              <p className="text-gray-400 mb-6">
                Your governance contracts are deployed and ready to use!
              </p>

              {/* Navigation Options */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto">
                <button
                  onClick={() =>
                    navigate({
                      to: "/$teamId/dashboard",
                      params: { teamId: String(deploymentResult.teamId) },
                    })
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Go to Dashboard
                </button>
                <button
                  onClick={() =>
                    navigate({
                      to: "/$teamId/docs",
                      params: { teamId: String(deploymentResult.teamId) },
                    })
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 text-green-300 font-semibold rounded-lg transition-colors"
                >
                  <Book className="w-5 h-5" />
                  Setup CI/CD Integration
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

function TerminalLog({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl p-6 font-mono text-sm max-h-96 overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
        <Circle className="w-3 h-3 text-red-400 fill-current" />
        <Circle className="w-3 h-3 text-yellow-400 fill-current" />
        <Circle className="w-3 h-3 text-green-400 fill-current" />
        <span className="ml-2 text-gray-500 text-xs">System Log</span>
      </div>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3">
            <span className="text-gray-600 text-xs whitespace-nowrap">
              [{log.timestamp.toLocaleTimeString()}]
            </span>
            <span
              className={`${
                log.type === "success"
                  ? "text-green-400"
                  : log.type === "error"
                    ? "text-red-400"
                    : "text-gray-300"
              }`}
            >
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
