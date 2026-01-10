import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { teamQueryOptions } from "../queries/teams";

export const Route = createFileRoute("/$teamId_/settings")({
  component: TeamSettings,
  // Reuse the same loader to ensure team data is cached/available
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(teamQueryOptions(params.teamId));
  },
});

function TeamSettings() {
  const params = Route.useParams();
  const { data: team } = useSuspenseQuery(teamQueryOptions(params.teamId));

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Team Settings</h1>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-400">
            {team.name} Configuration
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Governor Address
              </label>
              <code className="bg-gray-950 px-3 py-2 rounded border border-gray-800 block font-mono text-sm">
                {team.governorAddress}
              </code>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Registry Address
              </label>
              <code className="bg-gray-950 px-3 py-2 rounded border border-gray-800 block font-mono text-sm">
                {team.registryAddress}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
