import { useState } from "react";

interface CreateProjectFormProps {
  onSubmit: (projectName: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const CreateProjectForm: React.FC<CreateProjectFormProps> = ({
  onSubmit,
  onClose,
  isLoading,
}) => {
  const [projectName, setProjectName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      alert("Project name is required");
      return;
    }
    try {
      await onSubmit(projectName);
      setProjectName("");
      onClose();
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-2">
          Project Name
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="e.g., MyProject"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          disabled={isLoading}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Creating..." : "Create Project"}
        </button>
      </div>
    </form>
  );
};
