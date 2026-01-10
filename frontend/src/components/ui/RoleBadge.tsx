interface RoleColors {
  [key: string]: string;
}

const roleColors: RoleColors = {
  Stakeholder: "bg-gray-700/30 text-gray-300 border-gray-600/30",
  Proposer: "bg-blue-600/20 text-blue-300 border-blue-600/30",
  Deployer: "bg-indigo-600/20 text-indigo-300 border-indigo-600/30",
};

interface RoleBadgeProps {
  role: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => (
  <span
    className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
      roleColors[role] || "bg-gray-700/30 text-gray-300 border-gray-600/30"
    }`}
  >
    {role}
  </span>
);
