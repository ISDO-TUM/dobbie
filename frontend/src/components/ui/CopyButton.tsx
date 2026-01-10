import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  textToCopy: string;
  size?: "xs" | "sm" | "md";
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  textToCopy,
  size = "sm",
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const sizeClasses = {
    xs: "p-1",
    sm: "p-2",
    md: "p-2.5",
  };

  const iconSizes = {
    xs: "w-3 h-3",
    sm: "w-5 h-5",
    md: "w-6 h-6",
  };

  return (
    <button
      onClick={handleCopy}
      className={`rounded hover:bg-gray-700/50 transition-colors shrink-0 ${sizeClasses[size]}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className={`${iconSizes[size]} text-green-400`} />
      ) : (
        <Copy
          className={`${iconSizes[size]} text-gray-500 hover:text-gray-300`}
        />
      )}
    </button>
  );
};
