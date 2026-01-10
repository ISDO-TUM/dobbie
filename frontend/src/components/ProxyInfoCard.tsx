import type { ProxyInfo, UpgradeHistoryItem } from "../types";
import { truncateAddress } from "../lib/utils";
import { Package } from "lucide-react";
import { CopyButton } from "./ui/CopyButton";

interface ProxyInfoCardProps {
  proxyInfo: ProxyInfo;
  upgradeHistory: UpgradeHistoryItem[];
  isLoading?: boolean;
  onProposePackage: () => void;
  canInteract?: boolean;
}

export const ProxyInfoCard: React.FC<ProxyInfoCardProps> = ({
  proxyInfo,
  upgradeHistory,
  isLoading,
  onProposePackage,
  canInteract = false,
}) => {
  return (
    <div className="bg-linear-to-br from-gray-900/80 via-gray-900/50 to-gray-950 border border-gray-800 rounded-lg overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-gray-800/50 bg-linear-to-r from-gray-900/50 to-transparent flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-100 tracking-wide">
          Proxy Information
        </h3>
        <div className="flex items-center space-x-2">
          {onProposePackage && (
            <button
              onClick={onProposePackage}
              disabled={!canInteract}
              className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-blue-400 hover:text-blue-300"
              title={canInteract ? "Propose package deployment" : "Connect wallet as stakeholder to propose packages"}
            >
              <Package className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-gray-800/30 rounded w-24 animate-pulse"></div>
                <div className="h-4 bg-gray-800/30 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <dl className="space-y-4 mb-6">
              <div>
                <dt className="text-xs font-semibold text-gray-500 mb-2">
                  Proxy Address
                </dt>
                <div className="flex items-center justify-between bg-gray-800/20 rounded border border-gray-700/30 px-3 py-2">
                  <dd className="text-xs font-mono text-gray-300 truncate flex-1">
                    {proxyInfo.address
                      ? truncateAddress(proxyInfo.address)
                      : "Not set"}
                  </dd>
                  {proxyInfo.address && (
                    <CopyButton textToCopy={proxyInfo.address} size="xs" />
                  )}
                </div>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 mb-2">
                  Beacon
                </dt>
                <div className="flex items-center justify-between bg-gray-800/20 rounded border border-gray-700/30 px-3 py-2">
                  <dd className="text-xs font-mono text-gray-300 truncate flex-1">
                    {proxyInfo.beacon !== "Error"
                      ? truncateAddress(proxyInfo.beacon)
                      : "Error loading"}
                  </dd>
                  {proxyInfo.beacon !== "Error" && (
                    <CopyButton textToCopy={proxyInfo.beacon} size="xs" />
                  )}
                </div>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 mb-2">
                  Current Implementation
                </dt>
                <div className="flex items-center justify-between bg-gray-800/20 rounded border border-gray-700/30 px-3 py-2">
                  <dd className="text-xs font-mono text-gray-300 truncate flex-1">
                    {proxyInfo.implementation !== "Error"
                      ? truncateAddress(proxyInfo.implementation)
                      : "Error loading"}
                  </dd>
                  {proxyInfo.implementation !== "Error" && (
                    <CopyButton
                      textToCopy={proxyInfo.implementation}
                      size="xs"
                    />
                  )}
                </div>
              </div>
            </dl>

            {/* Upgrade History */}
            {upgradeHistory.length > 0 && (
              <div className="pt-4 border-t border-gray-700/30">
                <h4 className="text-xs font-bold text-gray-200 mb-4">
                  Upgrade History
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {upgradeHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-800/20 hover:bg-gray-800/40 rounded-lg border border-gray-700/30 hover:border-gray-600/50 px-3 py-3 text-xs transition-all flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-gray-300">
                            {item.version}
                          </span>
                          <span className="text-gray-500 text-[10px]">
                            Block {item.blockNumber}
                          </span>
                        </div>
                        <div className="font-mono text-gray-300 text-[11px] break-all">
                          {truncateAddress(item.address)}
                        </div>
                      </div>
                      <CopyButton textToCopy={item.address} size="xs" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
