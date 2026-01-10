import { X } from "lucide-react";
import type { FieldErrors } from "react-hook-form";

interface Stakeholder {
  walletAddress: string;
}

interface StakeholderRowProps {
  index: number;
  stakeholder: Stakeholder;
  isAdmin: boolean;
  onUpdate: (index: number, value: string) => void;
  onRemove: () => void;
  errors?: FieldErrors<Stakeholder>;
}

export function StakeholderRow({
  index,
  stakeholder,
  isAdmin,
  onUpdate,
  onRemove,
  errors,
}: StakeholderRowProps) {
  if (isAdmin) {
    return null; // Admin row is handled separately in Step 1
  }

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">
            Wallet Address
          </label>
          <input
            type="text"
            value={stakeholder.walletAddress}
            onChange={(e) => onUpdate(index, e.target.value)}
            placeholder="0x..."
            className={`w-full px-3 py-2 bg-gray-900/70 border ${
              errors?.walletAddress ? "border-red-500" : "border-gray-700"
            } rounded text-white text-sm placeholder-gray-500 font-mono focus:outline-none focus:border-blue-500`}
          />
          {errors?.walletAddress && (
            <p className="text-red-400 text-xs mt-1">
              {errors.walletAddress.message}
            </p>
          )}
        </div>

        {/* Remove Button */}
        <button
          type="button"
          onClick={onRemove}
          className="mt-6 p-2 text-red-400 hover:text-red-300 hover:bg-red-600/10 rounded transition-colors"
          title="Remove stakeholder"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
