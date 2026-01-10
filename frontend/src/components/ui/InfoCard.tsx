interface InfoCardProps {
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  title,
  children,
  isLoading,
}) => (
  <div className="bg-linear-to-br from-gray-900/80 via-gray-900/50 to-gray-950 border border-gray-800 rounded-lg overflow-hidden shadow-xl">
    <h3 className="px-6 py-4 text-sm font-bold text-gray-100 border-b border-gray-800/50 bg-linear-to-r from-gray-900/50 to-transparent">
      {title}
    </h3>
    <div className="p-6 space-y-3 text-sm">
      {isLoading ? <p className="text-gray-500">Loading...</p> : children}
    </div>
  </div>
);
