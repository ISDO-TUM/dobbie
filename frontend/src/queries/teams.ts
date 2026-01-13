import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Team } from "../types";
import { type InterfaceAbi } from "ethers";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export interface PrepareTeamInput {
  token: string;
  name: string;
  members: string[];
}

export interface PrepareTeamResponse {
  repoUrl: string;
  owner: string;
  repoName: string;
  invites: unknown[];
}

export interface RegisterTeamInput {
  name: string;
  governorAddress: string;
  registryAddress: string;
  repoUrl?: string;
  deploymentBlock?: number;
  isImport?: boolean;
}

interface ContractArtifact {
  abi: InterfaceAbi;
  bytecode: string;
  name: string;
}

export interface ArtifactsResponse {
  timelock: ContractArtifact;
  governor: ContractArtifact;
  registry: ContractArtifact;
  factory: ContractArtifact;
}

// --- Queries (GET Requests) ---

/**
 * Fetches the contract artifacts (ABI + Bytecode) from the backend.
 * Used by the frontend to deploy the correct version of contracts.
 */
export const artifactsQueryOptions = queryOptions({
  queryKey: ["artifacts"],
  queryFn: async () => {
    const res = await fetch(`${API_URL}/teams/artifacts`);
    if (!res.ok) throw new Error("Failed to fetch artifacts");
    return res.json();
  },
  staleTime: 0,
});

/**
 * Fetches a specific team by ID (used in the Dashboard).
 */
export const teamQueryOptions = (teamId: string) => {
  return queryOptions({
    queryKey: ["teams", teamId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/teams/${teamId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch team data");
      }
      return res.json() as Promise<Team>;
    },
  });
};

/**
 * Fetches all teams (used in the Welcome/Home screen).
 * @param includeArchived - If true, includes archived teams
 */
export const allTeamsQueryOptions = (includeArchived = false) =>
  queryOptions({
    queryKey: ["teams", { includeArchived }],
    queryFn: async () => {
      const url = includeArchived
        ? `${API_URL}/teams?includeArchived=true`
        : `${API_URL}/teams`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch teams list");
      }
      return res.json() as Promise<Team[]>;
    },
  });

// --- Mutations (POST Requests) ---

export const usePrepareTeamMutation = () => {
  return useMutation({
    mutationFn: async (data: PrepareTeamInput) => {
      const res = await fetch(`${API_URL}/teams/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Failed to prepare GitHub infrastructure",
        );
      }

      return res.json() as Promise<PrepareTeamResponse>;
    },
  });
};

export const useRegisterTeamMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RegisterTeamInput) => {
      const res = await fetch(`${API_URL}/teams/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to register team");
      }

      return res.json() as Promise<Team>;
    },
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });

      if (newTeam && newTeam.id) {
        queryClient.setQueryData(["teams", String(newTeam.id)], newTeam);
      }
    },
  });
};

export function useJoinTeamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      governorAddress: string;
      registryAddress: string;
      isImport: boolean;
    }) => {
      const response = await fetch(`${API_URL}/teams/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to import team");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

// --- Archive/Unarchive/Delete Mutations ---

export function useArchiveTeamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: number) => {
      const response = await fetch(`${API_URL}/teams/${teamId}/archive`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to archive team");
      }

      return response.json() as Promise<Team>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUnarchiveTeamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: number) => {
      const response = await fetch(`${API_URL}/teams/${teamId}/unarchive`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to unarchive team");
      }

      return response.json() as Promise<Team>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeleteTeamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: number) => {
      const response = await fetch(`${API_URL}/teams/${teamId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete team");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
