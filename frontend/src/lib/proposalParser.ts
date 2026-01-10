// ... existing imports ...

export interface ProposalTag {
  type: "category" | "action" | "target" | "value" | "address" | "ipfs";
  label: string;
  value?: string;
  icon?: string;
  color?: string;
}

export interface ParsedProposal {
  type: "governance" | "development";
  action:
    | "voting-delay"
    | "voting-period"
    | "min-delay"
    | "add-stakeholder"
    | "remove-stakeholder"
    | "add-bot"
    | "remove-bot"
    | "new-project"
    | "package"
    | "custom";
  parameters: Array<{
    key: string;
    value: string;
    displayLabel?: string;
  }>;
  rawDescription: string;
}

export function parseProposalDescription(
  description: string,
  ipfsCID?: string,
): ParsedProposal {
  // 1. Clean salt from description
  const cleanDescription = description.replace(/\s+# salt:.*$/, "");
  const lowerDesc = description.toLowerCase();

  // 2. Define Regex for Package Upgrades
  // Matches "Upgrade <something>" or "for <something>"
  const packageRegex = /upgrade\s+([^\s]+)|for\s+([^\s]+)/i;
  const isPackageText = packageRegex.test(description);

  if (ipfsCID || isPackageText) {
    const projectMatch = description.match(packageRegex);
    let projectName = projectMatch?.[1] || projectMatch?.[2];

    // Optional: Truncate Project ID if it's a raw bytes32 hash (starts with 0x and is long)
    if (
      projectName &&
      projectName.startsWith("0x") &&
      projectName.length > 20
    ) {
      projectName = `${projectName.slice(0, 6)}...${projectName.slice(-4)}`;
    }

    const addressMatch = description.match(/0x[a-fA-F0-9]{40}/);
    const targetAddress = addressMatch?.[0];

    return {
      type: "development",
      action: "package",
      parameters: [
        ...(projectName ? [{ key: "project", value: projectName }] : []),
        // Only include IPFS tag if we actually have the CID
        ...(ipfsCID
          ? [{ key: "ipfs", value: ipfsCID, displayLabel: "IPFS CID" }]
          : []),
        ...(targetAddress
          ? [{ key: "target", value: targetAddress, displayLabel: "Target" }]
          : []),
      ],
      rawDescription: cleanDescription,
    };
  }

  // New Project
  if (lowerDesc.includes("register") && lowerDesc.includes("project")) {
    const nameMatch = description.match(/["']([^"']+)["']/);
    return {
      type: "governance",
      action: "new-project",
      parameters: nameMatch ? [{ key: "name", value: nameMatch[1] }] : [],
      rawDescription: cleanDescription,
    };
  }

  // Voting Delay
  if (lowerDesc.includes("voting delay")) {
    const blocksMatch = description.match(/(\d+)\s*blocks?/i);
    return {
      type: "governance",
      action: "voting-delay",
      parameters: blocksMatch ? [{ key: "blocks", value: blocksMatch[1] }] : [],
      rawDescription: cleanDescription,
    };
  }

  // Voting Period
  if (lowerDesc.includes("voting period")) {
    const blocksMatch = description.match(/(\d+)\s*blocks?/i);
    return {
      type: "governance",
      action: "voting-period",
      parameters: blocksMatch ? [{ key: "blocks", value: blocksMatch[1] }] : [],
      rawDescription: cleanDescription,
    };
  }

  // Timelock Min Delay
  if (lowerDesc.includes("min delay") || lowerDesc.includes("timelock")) {
    const secondsMatch = description.match(/(\d+)\s*seconds?/i);
    return {
      type: "governance",
      action: "min-delay",
      parameters: secondsMatch
        ? [{ key: "seconds", value: secondsMatch[1] }]
        : [],
      rawDescription: cleanDescription,
    };
  }

  // Add Stakeholder
  if (lowerDesc.includes("add stakeholder")) {
    const githubMatch = description.match(/@([a-zA-Z0-9_-]+)/);
    const addressMatch = description.match(/0x[a-fA-F0-9]{40}/);

    return {
      type: "governance",
      action: "add-stakeholder",
      parameters: [
        ...(githubMatch ? [{ key: "github", value: githubMatch[1] }] : []),
        ...(addressMatch ? [{ key: "address", value: addressMatch[0] }] : []),
      ],
      rawDescription: cleanDescription,
    };
  }

  // Remove Stakeholder
  if (lowerDesc.includes("remove stakeholder")) {
    const addressMatch = description.match(/0x[a-fA-F0-9]{40}/);
    return {
      type: "governance",
      action: "remove-stakeholder",
      parameters: addressMatch
        ? [{ key: "address", value: addressMatch[0] }]
        : [],
      rawDescription: cleanDescription,
    };
  }

  // Add Bot
  if (lowerDesc.includes("add bot")) {
    const addressMatch = description.match(/0x[a-fA-F0-9]{40}/);
    return {
      type: "governance",
      action: "add-bot",
      parameters: addressMatch
        ? [{ key: "address", value: addressMatch[0] }]
        : [],
      rawDescription: cleanDescription,
    };
  }

  // Remove Bot
  if (lowerDesc.includes("remove bot")) {
    const addressMatch = description.match(/0x[a-fA-F0-9]{40}/);
    return {
      type: "governance",
      action: "remove-bot",
      parameters: addressMatch
        ? [{ key: "address", value: addressMatch[0] }]
        : [],
      rawDescription: cleanDescription,
    };
  }

  return {
    type: "governance",
    action: "custom",
    parameters: [],
    rawDescription: cleanDescription,
  };
}

export function generateTags(parsed: ParsedProposal): ProposalTag[] {
  const tags: ProposalTag[] = [];

  // Action Badge
  const actionLabels: Record<ParsedProposal["action"], string> = {
    "voting-delay": "Voting Delay",
    "voting-period": "Voting Period",
    "min-delay": "Timelock Delay",
    "add-stakeholder": "Add Stakeholder",
    "remove-stakeholder": "Remove Stakeholder",
    "add-bot": "Add Bot",
    "remove-bot": "Remove Bot",
    "new-project": "New Project",
    package: "Package Upgrade",
    custom: "Custom Proposal",
  };

  const actionIcons: Record<ParsedProposal["action"], string> = {
    "voting-delay": "Hourglass",
    "voting-period": "Clock",
    "min-delay": "Timer",
    "add-stakeholder": "UserPlus",
    "remove-stakeholder": "UserX",
    "add-bot": "Plus",
    "remove-bot": "X",
    "new-project": "FolderPlus",
    package: "Package",
    custom: "FileText",
  };

  tags.push({
    type: "category",
    label: actionLabels[parsed.action] || "Unknown",
    color: "bg-gray-700/30 text-gray-300 border-gray-600/50",
    icon: actionIcons[parsed.action] || "File",
  });

  // Parameter Tags
  parsed.parameters.forEach((param) => {
    if (param.key === "blocks") {
      tags.push({
        type: "value",
        label: `${param.value} Blocks`,
        color: "bg-yellow-600/20 text-yellow-300 border-yellow-600/50",
        icon: "Hash",
      });
    } else if (param.key === "seconds") {
      // Format seconds to a human-readable duration
      const secs = parseInt(param.value, 10);
      const hours = Math.floor(secs / 3600);
      const mins = Math.floor((secs % 3600) / 60);
      const label =
        hours > 0
          ? `${secs}s (~${hours}h${mins > 0 ? ` ${mins}m` : ""})`
          : `${secs}s`;
      tags.push({
        type: "value",
        label,
        color: "bg-orange-600/20 text-orange-300 border-orange-600/50",
        icon: "AlarmClock",
      });
    } else if (param.key === "address") {
      tags.push({
        type: "address",
        value: param.value,
        label: truncateAddress(param.value),
        color: "bg-gray-800/50 text-gray-300 border-gray-700/50",
        icon: "Wallet",
      });
    } else if (param.key === "github") {
      tags.push({
        type: "value",
        label: `@${param.value}`,
        color: "bg-indigo-600/20 text-indigo-300 border-indigo-600/50",
        icon: "AtSign",
      });
    } else if (param.key === "name") {
      tags.push({
        type: "value",
        label: param.value,
        color: "bg-green-600/20 text-green-300 border-green-600/50",
        icon: "FileText",
      });
    }
  });

  return tags;
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
