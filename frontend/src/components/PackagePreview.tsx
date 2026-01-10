import { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle,
  XCircle,
  Package,
  Code,
  FileCode,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  GitBranch,
  Shield,
  Zap,
  Activity,
} from "lucide-react";

interface PackagePreviewProps {
  ipfsCID: string;
}

interface PackageManifest {
  version: string;
  type: string;
  metadata: {
    commitHash?: string;
    createdAt?: string;
    name?: string;
    version?: string;
    description?: string;
    author?: string;
  };
  testReport: {
    passed?: number;
    failed?: number;
    total?: number;
    coverage?: number;
    tests?: Array<{
      name: string;
      status: "passed" | "failed";
      duration?: number;
    }>;
  };
  files: Array<{ path: string; size: number; type: string }>;
  contracts: Array<{
    name: string;
    path: string;
    bytecodeSize: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    abi: any[];
  }>;
  security: {
    dependencies: Array<{
      name: string;
      version: string;
      license: string;
    }>;
  };
  git: {
    repository?: string;
    branch?: string;
    commit: string;
    commitMessage?: string;
    author?: string;
    diffStat?: {
      filesChanged: number;
      insertions: number;
      deletions: number;
    };
  };
  deployment: {
    network?: string;
    estimatedGas?: string;
    requiredRoles?: string[];
  };
  integrity: {
    packageCID: string;
    packageSize: number;
    checksums: {
      sha256: string;
      md5: string;
    };
  };
  governance: {
    proposalType: string;
    impactLevel: string;
  };
}

export const PackagePreview: React.FC<PackagePreviewProps> = ({ ipfsCID }) => {
  const [manifest, setManifest] = useState<PackageManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "tests" | "contracts" | "files" | "security"
  >("overview");

  useEffect(() => {
    const fetchManifest = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log(`Fetching manifest from IPFS: ${ipfsCID}`);
        const manifestUrl = `https://ipfs.io/ipfs/${ipfsCID}`;

        const response = await fetch(manifestUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type");

        if (!contentType?.includes("application/json")) {
          throw new Error("CID does not point to a JSON manifest");
        }

        const data = await response.json();

        if (data.type !== "proposal-package") {
          throw new Error("Invalid manifest type");
        }

        console.log("✅ Manifest loaded successfully:", data);
        setManifest(data);
      } catch (err) {
        console.error("Failed to fetch manifest:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchManifest();
  }, [ipfsCID]);

  if (isLoading) {
    return (
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 flex items-center justify-center space-x-3">
        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
        <span className="text-sm text-gray-400">
          Loading package manifest from IPFS...
        </span>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="bg-gray-800/30 border border-red-900/30 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-400 mb-2">
              {error || "Failed to load manifest"}
            </p>
            <a
              href={`https://ipfs.io/ipfs/${ipfsCID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center space-x-1"
            >
              <span>View on IPFS Gateway</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const impactColors = {
    low: "text-green-400 bg-green-900/20 border-green-700/30",
    medium: "text-yellow-400 bg-yellow-900/20 border-yellow-700/30",
    high: "text-orange-400 bg-orange-900/20 border-orange-700/30",
    critical: "text-red-400 bg-red-900/20 border-red-700/30",
  };

  const impactColor =
    impactColors[
      manifest.governance.impactLevel as keyof typeof impactColors
    ] || impactColors.medium;

  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 min-w-fit px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "overview"
              ? "bg-gray-800 text-purple-400 border-b-2 border-purple-400"
              : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <FileText className="w-4 h-4" />
            <span>Overview</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("tests")}
          className={`flex-1 min-w-fit px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "tests"
              ? "bg-gray-800 text-purple-400 border-b-2 border-purple-400"
              : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>Tests</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("contracts")}
          className={`flex-1 min-w-fit px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "contracts"
              ? "bg-gray-800 text-purple-400 border-b-2 border-purple-400"
              : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <Code className="w-4 h-4" />
            <span>Contracts</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`flex-1 min-w-fit px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "files"
              ? "bg-gray-800 text-purple-400 border-b-2 border-purple-400"
              : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <Package className="w-4 h-4" />
            <span>Files</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`flex-1 min-w-fit px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "security"
              ? "bg-gray-800 text-purple-400 border-b-2 border-purple-400"
              : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>Security</span>
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4 min-h-[400px]">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Governance Info */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span>Governance</span>
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-500">Proposal Type:</span>
                  <div className="text-sm text-white font-medium capitalize mt-1">
                    {manifest.governance.proposalType}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Impact Level:</span>
                  <div
                    className={`text-sm font-bold capitalize mt-1 ${impactColor}`}
                  >
                    {manifest.governance.impactLevel}
                  </div>
                </div>
              </div>
            </div>

            {/* Git Info */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-blue-400" />
                <span>Git Information</span>
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500">Commit:</span>
                  <span className="text-xs text-white font-mono">
                    {manifest.git.commit.slice(0, 8)}
                  </span>
                </div>
                {manifest.git.branch && (
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-gray-500">Branch:</span>
                    <span className="text-xs text-white">
                      {manifest.git.branch}
                    </span>
                  </div>
                )}
                {manifest.git.author && (
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-gray-500">Author:</span>
                    <span className="text-xs text-white">
                      {manifest.git.author}
                    </span>
                  </div>
                )}
                {manifest.git.commitMessage && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <span className="text-xs text-gray-500 block mb-1">
                      Commit Message:
                    </span>
                    <p className="text-xs text-gray-300 italic">
                      "{manifest.git.commitMessage}"
                    </p>
                  </div>
                )}
                {manifest.git.diffStat && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="flex items-center space-x-4 text-xs">
                      <span className="text-gray-400">
                        {manifest.git.diffStat.filesChanged} files
                      </span>
                      <span className="text-green-400">
                        +{manifest.git.diffStat.insertions}
                      </span>
                      <span className="text-red-400">
                        -{manifest.git.diffStat.deletions}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            {manifest.metadata && (
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-semibold text-white mb-3">
                  Metadata
                </h4>
                <div className="space-y-2">
                  {manifest.metadata.createdAt && (
                    <div className="flex justify-between items-start">
                      <span className="text-xs text-gray-500">Created:</span>
                      <span className="text-xs text-gray-300">
                        {new Date(manifest.metadata.createdAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {manifest.metadata.commitHash && (
                    <div className="flex justify-between items-start">
                      <span className="text-xs text-gray-500">
                        Metadata Commit:
                      </span>
                      <span className="text-xs text-white font-mono">
                        {manifest.metadata.commitHash.slice(0, 8)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Deployment */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>Deployment</span>
              </h4>
              <div className="space-y-2">
                {manifest.deployment.network && (
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-gray-500">Network:</span>
                    <span className="text-xs text-white capitalize">
                      {manifest.deployment.network}
                    </span>
                  </div>
                )}
                {manifest.deployment.estimatedGas && (
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-gray-500">Est. Gas:</span>
                    <span className="text-xs text-white">
                      {manifest.deployment.estimatedGas}
                    </span>
                  </div>
                )}
                {manifest.deployment.requiredRoles &&
                  manifest.deployment.requiredRoles.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">
                        Required Roles:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {manifest.deployment.requiredRoles.map((role, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* Tests Tab */}
        {activeTab === "tests" && (
          <div className="space-y-3">
            {manifest.testReport ? (
              <>
                {/* Test Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {manifest.testReport.passed || 0}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Passed</div>
                  </div>
                  <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-400">
                      {manifest.testReport.failed || 0}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Failed</div>
                  </div>
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {manifest.testReport.total || 0}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Total</div>
                  </div>
                </div>

                {/* Coverage */}
                {manifest.testReport.coverage !== undefined && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Code Coverage</span>
                      <span>{manifest.testReport.coverage}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${manifest.testReport.coverage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Individual Tests */}
                {manifest.testReport.tests &&
                  manifest.testReport.tests.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h5 className="text-xs font-semibold text-gray-400">
                        Test Results
                      </h5>
                      {manifest.testReport.tests.map((test, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-gray-900/50 px-3 py-2 rounded"
                        >
                          <div className="flex items-center space-x-2">
                            {test.status === "passed" ? (
                              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                            )}
                            <span className="text-gray-300">{test.name}</span>
                          </div>
                          {test.duration && (
                            <span className="text-gray-500">
                              {test.duration}ms
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No test report available
              </p>
            )}
          </div>
        )}

        {/* Contracts Tab */}
        {activeTab === "contracts" && (
          <div className="space-y-3">
            {manifest.contracts.length > 0 ? (
              <>
                <div className="text-xs text-gray-400 mb-2">
                  {manifest.contracts.length} contract
                  {manifest.contracts.length !== 1 ? "s" : ""}
                </div>
                {manifest.contracts.map((contract, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-900/50 border border-gray-700 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Code className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-semibold text-white">
                          {contract.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {(contract.bytecodeSize / 1024).toFixed(2)} KB
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 font-mono mb-2">
                      {contract.path}
                    </div>
                    <div className="text-xs text-gray-500">
                      {contract.abi.length} ABI method
                      {contract.abi.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No contracts found
              </p>
            )}
          </div>
        )}

        {/* Files Tab */}
        {activeTab === "files" && (
          <div className="space-y-2">
            {manifest.files.length > 0 ? (
              <>
                <div className="text-xs text-gray-400 mb-2">
                  {manifest.files.length} file
                  {manifest.files.length !== 1 ? "s" : ""} (
                  {(
                    manifest.files.reduce((sum, f) => sum + f.size, 0) / 1024
                  ).toFixed(2)}{" "}
                  KB total)
                </div>
                {manifest.files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-gray-900/50 px-3 py-2 rounded hover:bg-gray-900/70 transition-colors"
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <FileCode className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-300 font-mono truncate">
                        {file.path}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 shrink-0 ml-2">
                      <span className="text-gray-500 text-xs uppercase">
                        {file.type}
                      </span>
                      <span className="text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB
                      </span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No files listed
              </p>
            )}
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-4">
            {/* Package Integrity */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span>Package Integrity</span>
              </h4>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-gray-500 block mb-1">
                    SHA256:
                  </span>
                  <span className="text-xs text-white font-mono break-all">
                    {manifest.integrity.checksums.sha256}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">MD5:</span>
                  <span className="text-xs text-white font-mono break-all">
                    {manifest.integrity.checksums.md5}
                  </span>
                </div>
                <div className="flex justify-between items-start pt-2">
                  <span className="text-xs text-gray-500">Package Size:</span>
                  <span className="text-xs text-white">
                    {(manifest.integrity.packageSize / 1024).toFixed(2)} KB
                  </span>
                </div>
              </div>
            </div>

            {/* Dependencies */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-semibold text-white mb-3">
                Dependencies ({manifest.security.dependencies.length})
              </h4>
              {manifest.security.dependencies.length > 0 ? (
                <div className="space-y-2 overflow-y-auto">
                  {manifest.security.dependencies.map((dep, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-gray-900/50 px-3 py-2 rounded"
                    >
                      <span className="text-gray-300 font-mono">
                        {dep.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500">{dep.version}</span>
                        <span className="text-xs text-blue-400">
                          {dep.license}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-2">
                  No dependencies
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-700 px-4 py-3 flex items-center justify-between bg-gray-800/50">
        <a
          href={`https://ipfs.io/ipfs/${ipfsCID}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
        >
          <ExternalLink className="w-3 h-3" />
          <span>View Manifest</span>
        </a>
        {manifest.integrity.packageCID && (
          <a
            href={`https://ipfs.io/ipfs/${manifest.integrity.packageCID}?download=true`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1"
          >
            <Download className="w-3 h-3" />
            <span>Download Package</span>
          </a>
        )}
      </div>
    </div>
  );
};
