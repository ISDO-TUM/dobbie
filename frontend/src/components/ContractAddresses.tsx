import { truncateAddress } from "../lib/utils";
import { CopyButton } from "./ui/CopyButton";

interface ContractAddressesProps {
  governorAddress: string;
  registryAddress: string;
}

export const ContractAddresses: React.FC<ContractAddressesProps> = ({
  governorAddress,
  registryAddress,
}) => {
  return (
    <div className="bg-linear-to-br from-gray-900/80 via-gray-900/50 to-gray-950 border border-gray-800 rounded-lg overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-gray-800/50 bg-linear-to-r from-gray-900/50 to-transparent">
        <h3 className="text-sm font-bold text-gray-100 tracking-wide">
          Core Contracts
        </h3>
      </div>

      <div className="p-6 space-y-4">
        <div className="group">
          <p className="text-xs font-semibold text-gray-500 mb-2">Governor</p>
          <div className="flex items-center justify-between bg-gray-800/20 rounded border border-gray-700/50 px-3 py-2 group-hover:border-gray-600/50 transition-colors">
            <code className="text-xs font-mono text-gray-300">
              {truncateAddress(governorAddress)}
            </code>
            <CopyButton textToCopy={governorAddress} size="xs" />
          </div>
        </div>

        <div className="group">
          <p className="text-xs font-semibold text-gray-500 mb-2">Registry</p>
          <div className="flex items-center justify-between bg-gray-800/20 rounded border border-gray-700/50 px-3 py-2 group-hover:border-gray-600/50 transition-colors">
            <code className="text-xs font-mono text-gray-300">
              {truncateAddress(registryAddress)}
            </code>
            <CopyButton textToCopy={registryAddress} size="xs" />
          </div>
        </div>
      </div>
    </div>
  );
};
