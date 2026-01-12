import type { Bot } from "../types";
import { truncateAddress } from "../lib/utils";
import { Plus, X } from "lucide-react";
import { CopyButton } from "./ui/CopyButton";

interface BotListProps {
  bots: Bot[];
  isLoading?: boolean;
  onAddBot: () => void;
  onRemoveBot: (bot: Bot) => void;
  canInteract?: boolean;
}

export const BotList: React.FC<BotListProps> = ({
  bots,
  isLoading,
  onAddBot,
  onRemoveBot,
  canInteract = false,
}) => {
  return (
    <div className="bg-linear-to-br from-gray-900/80 via-gray-900/50 to-gray-950 border border-gray-800 rounded-lg overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-gray-800/50 bg-linear-to-r from-gray-900/50 to-transparent flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-100 tracking-wide">Bots</h3>
        <button
          onClick={onAddBot}
          disabled={isLoading || !canInteract}
          className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-blue-400 hover:text-blue-300"
          title={
            canInteract
              ? "Add bot"
              : "Connect wallet as stakeholder to add bots"
          }
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-10 bg-gray-800/30 rounded-lg animate-pulse border border-gray-700/30"
              ></div>
            ))}
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">No bots added yet</p>
            <p className="text-xs text-gray-600 mt-1">
              Click the + button to add one
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {bots.map((bot) => (
              <li
                key={bot.address}
                className="flex items-center justify-between bg-gray-800/20 hover:bg-gray-800/40 rounded-lg px-4 py-3 text-xs border border-gray-700/30 hover:border-gray-600/50 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="font-mono text-gray-300 truncate">
                    {truncateAddress(bot.address)}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-col">
                    {bot.isProposer && (
                      <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 text-[10px] font-semibold rounded border border-blue-600/30 w-full text-center">
                        Proposer
                      </span>
                    )}
                    {bot.isPropagator && (
                      <span className="px-2 py-0.5 bg-purple-600/20 text-purple-300 text-[10px] font-semibold rounded border border-purple-600/30 w-full text-center">
                        Propagator
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-2 flex items-center gap-2 shrink-0">
                  <CopyButton textToCopy={bot.address} size="xs" />
                  {canInteract && (
                    <button
                      onClick={() => onRemoveBot(bot)}
                      className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 hover:border-red-500 transition-all text-red-400 hover:text-red-300"
                      title="Remove Bot"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
