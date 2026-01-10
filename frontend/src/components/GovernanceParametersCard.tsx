import { type GovernanceParams } from "../types";
import { AVERAGE_BLOCK_TIME_SECONDS } from "../lib/constants";
import { formatDuration } from "../lib/utils";
import { Edit2 } from "lucide-react";

interface GovernanceParametersCardProps {
  governanceParams: GovernanceParams;
  isLoading?: boolean;
  onChangeVotingDelay?: () => void;
  onChangeVotingPeriod?: () => void;
  onChangeConfirmationPeriod?: () => void;
  onChangeMinDelay?: () => void;
}

export const GovernanceParametersCard: React.FC<
  GovernanceParametersCardProps
> = ({
  governanceParams,
  isLoading,
  onChangeVotingDelay,
  onChangeVotingPeriod,
  onChangeMinDelay,
}) => {
  const votingPeriodSeconds =
    governanceParams.votingPeriod * AVERAGE_BLOCK_TIME_SECONDS;
  const votingPeriodEstimate = formatDuration(votingPeriodSeconds);

  const votingDelaySeconds =
    governanceParams.votingDelay * AVERAGE_BLOCK_TIME_SECONDS;
  const votingDelayEstimate = formatDuration(votingDelaySeconds);

  return (
    <div className="bg-linear-to-br from-gray-900/80 via-gray-900/50 to-gray-950 border border-gray-800 rounded-lg overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-gray-800/50 bg-linear-to-r from-gray-900/50 to-transparent">
        <h3 className="text-sm font-bold text-gray-100 tracking-wide">
          Governance Parameters
        </h3>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-4 bg-gray-800/50 rounded w-24 animate-pulse"></div>
                <div className="h-4 bg-gray-800/50 rounded w-32 animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : (
          <dl className="space-y-4">
            {/* Voting Delay Row */}
            <div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-400 font-medium">
                  Voting Delay
                </dt>
                {onChangeVotingDelay && (
                  <button
                    onClick={onChangeVotingDelay}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 transition-all text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    title="Change voting delay"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <dd className="text-sm text-gray-200 font-mono mt-2">
                {governanceParams.votingDelay} blocks
                <span className="text-xs text-gray-500 ml-2">
                  (~{votingDelayEstimate})
                </span>
              </dd>
            </div>

            {/* Voting Period Row */}
            <div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-400 font-medium">
                  Voting Period
                </dt>
                {onChangeVotingPeriod && (
                  <button
                    onClick={onChangeVotingPeriod}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 transition-all text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    title="Change voting period"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <dd className="text-sm text-gray-200 font-mono mt-2">
                {governanceParams.votingPeriod} blocks
                <span className="text-xs text-gray-500 ml-2">
                  (~{votingPeriodEstimate})
                </span>
              </dd>
            </div>

            {/* Timelock Min Delay Row */}
            <div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-400 font-medium">
                  Timelock Min Delay
                </dt>
                {onChangeMinDelay && (
                  <button
                    onClick={onChangeMinDelay}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 transition-all text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    title="Change timelock min delay"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <dd className="text-sm text-gray-200 font-mono mt-2">
                {governanceParams.minDelay} seconds
                <span className="text-xs text-gray-500 ml-2">
                  (~{formatDuration(governanceParams.minDelay)})
                </span>
              </dd>
            </div>

            {/* Quorum Row */}
            <div>
              <dt className="text-sm text-gray-400 font-medium">Quorum</dt>
              <dd className="text-sm text-gray-200 font-mono mt-2">
                {governanceParams.quorum} stakeholders
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
};
