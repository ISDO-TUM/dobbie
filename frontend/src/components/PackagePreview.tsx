import { useEffect, useState } from "react";
import {
  FileText,
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
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Hash,
  Clock,
  User,
  Box,
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
  testReport?: {
    passed?: number;
    failed?: number;
    total?: number;
    coverage?: number;
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

interface ABIItem {
  type: string;
  name?: string;
  inputs?: Array<{ name: string; type: string }>;
  outputs?: Array<{ name: string; type: string }>;
  stateMutability?: string;
}

// Group files by directory for tree view
function groupFilesByDirectory(
  files: Array<{ path: string; size: number; type: string }>,
) {
  const groups: Record<
    string,
    Array<{ path: string; size: number; type: string; fileName: string }>
  > = {};

  files.forEach((file) => {
    const parts = file.path.split("/");
    const dir = parts.length > 1 ? parts[0] : "root";
    const fileName = parts[parts.length - 1];

    if (!groups[dir]) {
      groups[dir] = [];
    }
    groups[dir].push({ ...file, fileName });
  });

  // Sort directories: contracts first, then test, scripts, others
  const priority = ["contracts", "test", "scripts", "src", "lib"];
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    const aIdx = priority.indexOf(a);
    const bIdx = priority.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  return { groups, sortedKeys };
}

// Format ABI function signature
function formatABISignature(item: ABIItem): string {
  if (!item.name) return item.type;

  const inputs =
    item.inputs?.map((i) => `${i.type} ${i.name}`).join(", ") || "";
  const outputs = item.outputs?.map((o) => o.type).join(", ") || "";

  let sig = `${item.name}(${inputs})`;
  if (outputs) sig += ` → ${outputs}`;
  if (item.stateMutability && item.stateMutability !== "nonpayable") {
    sig += ` [${item.stateMutability}]`;
  }
  return sig;
}

// Collapsible ABI Explorer component
const ABIExplorer: React.FC<{ abi: ABIItem[] }> = ({ abi }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const functions = abi.filter((item) => item.type === "function");
  const events = abi.filter((item) => item.type === "event");

  if (functions.length === 0 && events.length === 0) {
    return <span className="text-xs text-gray-500">No ABI methods</span>;
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span>
          {functions.length} function{functions.length !== 1 ? "s" : ""}
          {events.length > 0 &&
            `, ${events.length} event${events.length !== 1 ? "s" : ""}`}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-700">
          {functions.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 font-semibold mb-1">
                Functions
              </div>
              <div className="space-y-1">
                {functions.map((fn, idx) => (
                  <div
                    key={idx}
                    className="text-xs font-mono text-gray-300 bg-gray-900/50 px-2 py-1 rounded"
                  >
                    {formatABISignature(fn)}
                  </div>
                ))}
              </div>
            </div>
          )}
          {events.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 font-semibold mb-1">
                Events
              </div>
              <div className="space-y-1">
                {events.map((ev, idx) => (
                  <div
                    key={idx}
                    className="text-xs font-mono text-yellow-300 bg-gray-900/50 px-2 py-1 rounded"
                  >
                    {formatABISignature(ev)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Directory folder component for file tree
const DirectoryFolder: React.FC<{
  name: string;
  files: Array<{ path: string; size: number; type: string; fileName: string }>;
}> = ({ name, files }) => {
  const [isExpanded, setIsExpanded] = useState(name === "contracts");
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-yellow-400" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-400" />
          )}
          <span className="text-sm font-medium text-white">{name}/</span>
          <span className="text-xs text-gray-500">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {(totalSize / 1024).toFixed(1)} KB
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="divide-y divide-gray-700/50">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-2 pl-9 hover:bg-gray-900/30 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileCode className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-300 font-mono truncate">
                  {file.fileName}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-xs text-gray-500 uppercase">
                  {file.type}
                </span>
                <span className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const PackagePreview: React.FC<PackagePreviewProps> = ({ ipfsCID }) => {
  const [manifest, setManifest] = useState<PackageManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "summary" | "contracts" | "source" | "security"
  >("summary");

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

  const totalFileSize = manifest.files.reduce((sum, f) => sum + f.size, 0);
  const { groups: fileGroups, sortedKeys: sortedDirs } = groupFilesByDirectory(
    manifest.files,
  );

  const tabs = [
    { id: "summary" as const, label: "Summary", icon: FileText },
    { id: "contracts" as const, label: "Contracts", icon: Code },
    { id: "source" as const, label: "Source Code", icon: Package },
    { id: "security" as const, label: "Security", icon: Shield },
  ];

  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden">
      {/* Quick Stats Bar */}
      <div className="bg-gray-900/50 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-blue-400">
              <Box className="w-3.5 h-3.5" />
              <span className="font-semibold">
                {manifest.contracts.length} contract
                {manifest.contracts.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400">
              <FileCode className="w-3.5 h-3.5" />
              <span>
                {manifest.files.length} file
                {manifest.files.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400">
              <Package className="w-3.5 h-3.5" />
              <span>{(totalFileSize / 1024).toFixed(1)} KB</span>
            </div>
          </div>
          <div
            className={`text-xs font-bold capitalize px-2 py-1 rounded border ${impactColor}`}
          >
            {manifest.governance.impactLevel} Impact
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-fit px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-gray-800 text-purple-400 border-b-2 border-purple-400"
                : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 min-h-[400px]">
        {/* Summary Tab */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            {/* Git Info */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-blue-400" />
                <span>Git Information</span>
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-500">Commit</span>
                  <div className="text-sm text-white font-mono mt-1">
                    {manifest.git.commit.slice(0, 8)}
                  </div>
                </div>
                {manifest.git.branch && (
                  <div>
                    <span className="text-xs text-gray-500">Branch</span>
                    <div className="text-sm text-white mt-1">
                      {manifest.git.branch}
                    </div>
                  </div>
                )}
                {manifest.git.author && (
                  <div>
                    <span className="text-xs text-gray-500">Author</span>
                    <div className="text-sm text-white mt-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-400" />
                      {manifest.git.author}
                    </div>
                  </div>
                )}
                {manifest.metadata.createdAt && (
                  <div>
                    <span className="text-xs text-gray-500">Created</span>
                    <div className="text-sm text-white mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {new Date(
                        manifest.metadata.createdAt,
                      ).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
              {manifest.git.commitMessage && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <span className="text-xs text-gray-500 block mb-1">
                    Commit Message
                  </span>
                  <p className="text-sm text-gray-300 italic">
                    "{manifest.git.commitMessage}"
                  </p>
                </div>
              )}
              {manifest.git.diffStat && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-400">
                      {manifest.git.diffStat.filesChanged} files changed
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

            {/* Governance Info */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span>Governance</span>
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-500">Proposal Type</span>
                  <div className="text-sm text-white font-medium capitalize mt-1">
                    {manifest.governance.proposalType}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Impact Level</span>
                  <div
                    className={`text-sm font-bold capitalize mt-1 inline-block px-2 py-0.5 rounded ${impactColor}`}
                  >
                    {manifest.governance.impactLevel}
                  </div>
                </div>
              </div>
            </div>

            {/* Deployment Info */}
            {(manifest.deployment.network ||
              manifest.deployment.estimatedGas ||
              (manifest.deployment.requiredRoles &&
                manifest.deployment.requiredRoles.length > 0)) && (
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>Deployment</span>
                </h4>
                <div className="space-y-2">
                  {manifest.deployment.network && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Network</span>
                      <span className="text-sm text-white capitalize">
                        {manifest.deployment.network}
                      </span>
                    </div>
                  )}
                  {manifest.deployment.estimatedGas && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Est. Gas</span>
                      <span className="text-sm text-white">
                        {manifest.deployment.estimatedGas}
                      </span>
                    </div>
                  )}
                  {manifest.deployment.requiredRoles &&
                    manifest.deployment.requiredRoles.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">
                          Required Roles
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {manifest.deployment.requiredRoles.map(
                            (role, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded"
                              >
                                {role}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contracts Tab */}
        {activeTab === "contracts" && (
          <div className="space-y-3">
            {manifest.contracts.length > 0 ? (
              <>
                <div className="text-xs text-gray-400 mb-3">
                  {manifest.contracts.length} compiled contract
                  {manifest.contracts.length !== 1 ? "s" : ""}
                </div>
                {manifest.contracts.map((contract, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-900/50 border border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Code className="w-5 h-5 text-blue-400" />
                        <span className="text-base font-semibold text-white">
                          {contract.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                          {(contract.bytecodeSize / 1024).toFixed(2)} KB
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono mb-2">
                      {contract.path}
                    </div>
                    <ABIExplorer abi={contract.abi} />
                  </div>
                ))}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Code className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No contracts found in this package</p>
              </div>
            )}
          </div>
        )}

        {/* Source Code Tab */}
        {activeTab === "source" && (
          <div className="space-y-3">
            {manifest.files.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-400">
                    {manifest.files.length} file
                    {manifest.files.length !== 1 ? "s" : ""} •{" "}
                    {(totalFileSize / 1024).toFixed(1)} KB total
                  </div>
                </div>
                <div className="space-y-2">
                  {sortedDirs.map((dir) => (
                    <DirectoryFolder
                      key={dir}
                      name={dir}
                      files={fileGroups[dir]}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Package className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No files listed in this package</p>
              </div>
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
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">SHA256</span>
                  </div>
                  <code className="text-xs text-white font-mono break-all bg-gray-800 px-2 py-1 rounded block">
                    {manifest.integrity.checksums.sha256}
                  </code>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">MD5</span>
                  </div>
                  <code className="text-xs text-white font-mono break-all bg-gray-800 px-2 py-1 rounded block">
                    {manifest.integrity.checksums.md5}
                  </code>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-xs text-gray-500">Package Size</span>
                  <span className="text-sm text-white font-semibold">
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
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {manifest.security.dependencies.map((dep, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-gray-800/50 px-3 py-2 rounded"
                    >
                      <span className="text-gray-300 font-mono">
                        {dep.name}
                      </span>
                      <div className="flex items-center space-x-3">
                        <span className="text-gray-500">{dep.version}</span>
                        <span className="text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">
                          {dep.license}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-2">
                  No dependencies listed
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer with Links */}
      <div className="border-t border-gray-700 px-4 py-3 flex items-center justify-between bg-gray-800/50">
        <a
          href={`https://ipfs.io/ipfs/${ipfsCID}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1.5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>View Manifest</span>
        </a>
        <div className="flex items-center gap-3">
          {manifest.integrity.packageCID && (
            <a
              href={`https://ipfs.io/ipfs/${manifest.integrity.packageCID}?download=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Package</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
