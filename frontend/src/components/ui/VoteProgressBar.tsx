interface Votes {
  for: bigint;
  against: bigint;
  abstain: bigint;
}

interface VoteProgressBarProps {
  votes: Votes;
}

export const VoteProgressBar: React.FC<VoteProgressBarProps> = ({ votes }) => {
  const total = votes.for + votes.against + votes.abstain;
  if (total === 0n)
    return (
      <div className="w-full flex h-2 rounded-full overflow-hidden bg-gray-700/30" />
    );

  const totalNum = Number(total);
  const forPct = totalNum === 0 ? 0 : (Number(votes.for) / totalNum) * 100;
  const againstPct =
    totalNum === 0 ? 0 : (Number(votes.against) / totalNum) * 100;

  return (
    <div className="w-full flex h-2 rounded-full overflow-hidden bg-gray-700/30">
      <div className="bg-green-500/80" style={{ width: `${forPct}%` }}></div>
      <div className="bg-red-500/80" style={{ width: `${againstPct}%` }}></div>
    </div>
  );
};
