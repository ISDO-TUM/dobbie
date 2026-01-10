import React from "react";
import type { ProposalStateName } from "../../lib/constants";

interface StatusBadgeProps {
  status: ProposalStateName;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusStyle = () => {
    switch (status) {
      case "Pending":
        return "bg-gray-700/50 text-gray-300 border-gray-600/50";
      case "Active":
        return "bg-blue-600/20 text-blue-300 border-blue-600/50";
      case "Succeeded":
        return "bg-green-600/20 text-green-300 border-green-600/50";
      case "Queued":
        return "bg-yellow-600/20 text-yellow-300 border-yellow-600/50";
      case "Executed":
        return "bg-green-700/20 text-green-300 border-green-700/50";
      case "Defeated":
        return "bg-red-600/20 text-red-300 border-red-600/50";
      case "Canceled":
      case "Expired":
        return "bg-gray-700/30 text-gray-400 border-gray-600/50";
      default:
        return "bg-gray-700/50 text-gray-300 border-gray-600/50";
    }
  };

  return (
    <span
      className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusStyle()}`}
    >
      {status}
    </span>
  );
};
