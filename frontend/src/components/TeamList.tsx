import type { Stakeholder } from "../types";
import { truncateAddress } from "../lib/utils";
import { Pencil, Plus, X } from "lucide-react";
import { CopyButton } from "./ui/CopyButton";

interface TeamListProps {
  stakeholders: Stakeholder[];
  isLoading?: boolean;
  currentUserAddress?: string;
  onAddStakeholder: () => void;
  onRemoveStakeholder: (address: string) => void;
  onEditIdentity?: () => void;
}

export const TeamList: React.FC<TeamListProps> = ({
  stakeholders,
  isLoading,
  currentUserAddress,
  onAddStakeholder,
  onRemoveStakeholder,
  onEditIdentity,
}) => {
  const isCurrentUser = (address: string) =>
    currentUserAddress?.toLowerCase() === address.toLowerCase();

  // Sort stakeholders so current user is always at the top
  const sortedStakeholders = [...stakeholders].sort((a, b) => {
    const aIsCurrentUser = isCurrentUser(a.address);
    const bIsCurrentUser = isCurrentUser(b.address);
    if (aIsCurrentUser && !bIsCurrentUser) return -1;
    if (!aIsCurrentUser && bIsCurrentUser) return 1;
    return 0;
  });

  const handleRemove = (address: string, github: string) => {
    if (window.confirm(`Remove stakeholder @${github} (${address})?`)) {
      onRemoveStakeholder(address);
    }
  };

  return (
    <div className="bg-linear-to-br from-gray-900/80 via-gray-900/50 to-gray-950 border border-gray-800 rounded-lg overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-gray-800/50 bg-linear-to-r from-gray-900/50 to-transparent flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-100 tracking-wide">
          Stakeholders
        </h3>
        <button
          onClick={onAddStakeholder}
          disabled={isLoading}
          className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 transition-all disabled:opacity-50 text-blue-400 hover:text-blue-300"
          title="Add stakeholder"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-gray-800/30 rounded-lg animate-pulse border border-gray-700/30"
              ></div>
            ))}
          </div>
        ) : stakeholders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">No stakeholders added yet</p>
            <p className="text-xs text-gray-600 mt-1">
              Click the + button to add one
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedStakeholders.map((stakeholder) => {
              const isSelf = isCurrentUser(stakeholder.address);
              return (
                <li
                  key={stakeholder.address}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 text-xs border transition-all ${
                    isSelf
                      ? "bg-blue-900/20 hover:bg-blue-900/30 border-blue-700/30 hover:border-blue-600/50"
                      : "bg-gray-800/20 hover:bg-gray-800/40 border-gray-700/30 hover:border-gray-600/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="font-mono text-gray-300 truncate text-xs"
                        title={stakeholder.address}
                      >
                        {truncateAddress(stakeholder.address)}
                      </div>
                      {isSelf && (
                        <span className="text-xs bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      @{stakeholder.github}
                    </div>
                  </div>
                  <div className="ml-2 flex items-center gap-2">
                    <CopyButton textToCopy={stakeholder.address} size="xs" />
                    {isSelf && onEditIdentity && (
                      <button
                        onClick={onEditIdentity}
                        className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 transition-all text-blue-400 hover:text-blue-300"
                        title="Edit your username"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {!isSelf && (
                      <button
                        onClick={() =>
                          handleRemove(stakeholder.address, stakeholder.github)
                        }
                        className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 hover:border-red-500 transition-all text-red-400 hover:text-red-300"
                        title="Remove stakeholder"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
