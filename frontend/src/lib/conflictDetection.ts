import type { Proposal } from "../types";
import type { ConflictInfo } from "../components/PackagePreview";

interface ManifestMetadata {
  changedFiles?: string[];
}

interface PackageManifest {
  metadata?: ManifestMetadata;
}

// Cache for fetched manifests to avoid repeated IPFS fetches
const manifestCache = new Map<string, PackageManifest | null>();

/**
 * Fetches a package manifest from IPFS.
 * Returns null if fetch fails or manifest is invalid.
 */
export async function fetchManifest(
  ipfsCID: string,
): Promise<PackageManifest | null> {
  // Check cache first
  if (manifestCache.has(ipfsCID)) {
    return manifestCache.get(ipfsCID) ?? null;
  }

  try {
    const response = await fetch(`https://ipfs.io/ipfs/${ipfsCID}`);
    if (!response.ok) {
      manifestCache.set(ipfsCID, null);
      return null;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      manifestCache.set(ipfsCID, null);
      return null;
    }

    const manifest = (await response.json()) as PackageManifest;
    manifestCache.set(ipfsCID, manifest);
    return manifest;
  } catch (error) {
    console.error(`Failed to fetch manifest for ${ipfsCID}:`, error);
    manifestCache.set(ipfsCID, null);
    return null;
  }
}

/**
 * Extracts the file path from a changedFiles entry (removes status prefix like "[modified]").
 */
function extractFilePath(entry: string): string {
  // Format: "[status] path/to/file" - extract just the path
  const match = entry.match(/^\[.+?\]\s+(.+)$/);
  return match ? match[1] : entry;
}

/**
 * Detects conflicting proposals based on shared changed files.
 *
 * @param currentProposalId - The ID of the current proposal being viewed
 * @param currentChangedFiles - The changed files from the current proposal's manifest
 * @param otherProposals - All other proposals to compare against
 * @returns Array of ConflictInfo for proposals with overlapping changed files
 */
export async function detectProposalConflicts(
  currentProposalId: string,
  currentChangedFiles: string[],
  otherProposals: Proposal[],
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = [];

  // Only compare against active/succeeded/queued proposals
  const activeStatuses = ["Active", "Pending", "Succeeded", "Queued"];
  const activeProposals = otherProposals.filter(
    (p) =>
      p.id.toString() !== currentProposalId &&
      activeStatuses.includes(p.status) &&
      p.ipfsCID,
  );

  // Extract just file paths from current proposal
  const currentFilePaths = currentChangedFiles.map(extractFilePath);

  // Fetch manifests and check for conflicts
  await Promise.all(
    activeProposals.map(async (proposal) => {
      if (!proposal.ipfsCID) return;

      const manifest = await fetchManifest(proposal.ipfsCID);
      if (!manifest?.metadata?.changedFiles) return;

      const otherFilePaths =
        manifest.metadata.changedFiles.map(extractFilePath);

      // Find overlapping files
      const conflictingFiles = currentFilePaths.filter((file) =>
        otherFilePaths.includes(file),
      );

      if (conflictingFiles.length > 0) {
        conflicts.push({
          proposalId: proposal.id.toString(),
          ipfsCID: proposal.ipfsCID,
          conflictingFiles,
        });
      }
    }),
  );

  return conflicts;
}

/**
 * Clears the manifest cache (useful for testing or refreshing data).
 */
export function clearManifestCache(): void {
  manifestCache.clear();
}
