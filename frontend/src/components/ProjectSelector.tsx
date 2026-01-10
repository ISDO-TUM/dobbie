import type { Project } from "../types";
import { ChevronDown, Plus } from "lucide-react";
import { CopyButton } from "./ui/CopyButton";

interface ProjectSelectorProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  error?: string | null;
  hideRefreshButton?: boolean;
  onCreateProject?: () => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  isLoading,
  onRefresh,
  error,
  hideRefreshButton,
  onCreateProject,
}) => {
  return (
    <div className="bg-linear-to-br from-gray-900/80 via-gray-900/50 to-gray-950 border border-gray-800 rounded-lg overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-gray-800/50 bg-linear-to-r from-gray-900/50 to-transparent flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-100 tracking-wide">
          Projects
        </h3>
        <button
          onClick={onCreateProject}
          disabled={isLoading}
          className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 transition-all disabled:opacity-50 text-blue-400 hover:text-blue-300"
          title="Create new project"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-400">
            Select Project
          </label>
          <div className="flex gap-2 items-center">
            {selectedProject && (
              <CopyButton textToCopy={selectedProject.id} size="xs" />
            )}
            {!hideRefreshButton && onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 disabled:text-gray-600 transition-colors"
              >
                Refresh
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-2 bg-red-900/20 border border-red-700/50 rounded text-xs text-red-400">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="h-10 bg-gray-800/40 rounded-lg animate-pulse border border-gray-700/30"></div>
        ) : projects.length === 0 ? (
          <div className="p-4 text-center border border-gray-700/30 rounded-lg">
            <p className="text-xs text-gray-500">No projects found</p>
          </div>
        ) : (
          <div className="relative">
            <select
              value={selectedProject?.id || ""}
              onChange={(e) => {
                const project = projects.find((p) => p.id === e.target.value);
                if (project) onSelectProject(project);
              }}
              className="w-full px-4 py-2.5 bg-gray-800/40 border border-gray-700/50 hover:border-gray-600/50 focus:border-blue-600 rounded-lg text-sm text-gray-200 appearance-none focus:outline-none transition-colors cursor-pointer"
            >
              <option value="">-- Select a project --</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  );
};
