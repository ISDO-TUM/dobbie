import {
  Settings,
  Code,
  Lock,
  Package,
  FolderPlus,
  File,
  FileText,
  Hourglass,
  Clock,
  Timer,
  AlarmClock,
  Hash,
  BarChart3,
  Percent,
  Users,
  UserPlus,
  UserX,
  AtSign,
  Wallet,
  Bot,
  Plus,
  X,
  Zap,
} from "lucide-react";
import type { ProposalTag } from "../../lib/proposalParser";
import { CopyButton } from "./CopyButton";

interface ProposalTagsProps {
  tags: ProposalTag[];
}

const iconMap: Record<string, React.ReactNode> = {
  Settings: <Settings className="w-3.5 h-3.5" />,
  Code: <Code className="w-3.5 h-3.5" />,
  Lock: <Lock className="w-3.5 h-3.5" />,
  Package: <Package className="w-3.5 h-3.5" />,
  FolderPlus: <FolderPlus className="w-3.5 h-3.5" />,
  File: <File className="w-3.5 h-3.5" />,
  FileText: <FileText className="w-3.5 h-3.5" />,
  Hourglass: <Hourglass className="w-3.5 h-3.5" />,
  Clock: <Clock className="w-3.5 h-3.5" />,
  Timer: <Timer className="w-3.5 h-3.5" />,
  AlarmClock: <AlarmClock className="w-3.5 h-3.5" />,
  Hash: <Hash className="w-3.5 h-3.5" />,
  BarChart3: <BarChart3 className="w-3.5 h-3.5" />,
  Percent: <Percent className="w-3.5 h-3.5" />,
  Users: <Users className="w-3.5 h-3.5" />,
  UserPlus: <UserPlus className="w-3.5 h-3.5" />,
  UserX: <UserX className="w-3.5 h-3.5" />,
  AtSign: <AtSign className="w-3.5 h-3.5" />,
  Wallet: <Wallet className="w-3.5 h-3.5" />,
  Bot: <Bot className="w-3.5 h-3.5" />,
  Plus: <Plus className="w-3.5 h-3.5" />,
  X: <X className="w-3.5 h-3.5" />,
  Zap: <Zap className="w-3.5 h-3.5" />,
};

export const ProposalTags: React.FC<ProposalTagsProps> = ({ tags }) => {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-nowrap gap-2 items-center overflow-x-auto pb-2 w-full scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
      {tags.map((tag, index) => {
        const icon = tag.icon
          ? iconMap[tag.icon] || <FileText className="w-3.5 h-3.5" />
          : null;

        const commonClasses =
          "flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold whitespace-nowrap transition-colors";
        const colorClass =
          tag.color || "bg-gray-800/30 text-gray-300 border-gray-700/30";

        if (tag.type === "category") {
          return (
            <span key={index} className={`${commonClasses} ${colorClass}`}>
              {icon}
              <span>{tag.label}</span>
            </span>
          );
        }

        if (tag.type === "address") {
          return (
            <span
              key={index}
              className={`${commonClasses} ${colorClass}`}
              title={tag.value}
            >
              {icon}
              <span className="font-mono">{tag.label}</span>
              {tag.value && <CopyButton textToCopy={tag.value} size="xs" />}
            </span>
          );
        }

        // value type - simple display
        return (
          <span
            key={index}
            className={`${commonClasses} ${colorClass}`}
            title={tag.value}
          >
            {icon}
            <span>{tag.label}</span>
          </span>
        );
      })}
    </div>
  );
};
