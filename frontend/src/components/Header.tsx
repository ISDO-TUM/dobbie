import {
  Link,
  useParams,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Wallet,
  Plus,
  Users,
  LayoutDashboard,
  Book,
} from "lucide-react";
import { truncateAddress } from "../lib/utils";
import useWeb3Connection from "../hooks/useWeb3Connection";
export const Header: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const routerState = useRouterState();

  const { account, connectWallet } = useWeb3Connection();

  const teamId = (params as any)?.teamId;
  const isInTeamContext = !!teamId;

  const isOnDocsPage = routerState.location.pathname.includes("/docs");

  const teamName = (
    routerState.matches.find((match) => match.routeId.includes("$teamId"))
      ?.context as any
  )?.teamName as string | undefined;

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between p-4 lg:px-6 lg:py-4 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
      {/* Left Side: Logo & Team Info */}
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-xl lg:text-2xl font-bold text-white hover:text-blue-400 transition-colors group"
        >
          <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="text-white font-black text-sm">D</span>
          </div>
          <span className="bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Dobby
          </span>
        </Link>

        {teamName && (
          <>
            <div className="h-6 w-px bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-blue-600/20 border border-blue-600/30 rounded-full">
                <span className="text-blue-300 text-sm font-semibold">
                  {teamName}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Side: Actions & Wallet */}
      <div className="flex items-center gap-3">
        {/* Team Context Actions */}
        {isInTeamContext && (
          <>
            {isOnDocsPage ? (
              // Show Dashboard button when on docs page
              <button
                onClick={() =>
                  navigate({ to: `/$teamId/dashboard`, params: { teamId } })
                }
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-300 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 rounded-lg transition-colors"
                title="Back to Dashboard"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            ) : (
              // Docs Button (gray styling)
              <button
                onClick={() =>
                  navigate({
                    to: `/$teamId/docs`,
                    params: { teamId },
                  })
                }
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 hover:border-gray-600 rounded-lg transition-colors"
                title="Setup & Docs"
              >
                <Book className="w-4 h-4" />
                <span className="hidden sm:inline">Docs</span>
              </button>
            )}

            <div className="h-6 w-px bg-gray-700" />
          </>
        )}

        {/* Global Navigation - Only show on home page */}
        {!isInTeamContext && (
          <>
            <button
              onClick={() => navigate({ to: "/create-team" })}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-green-300 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 hover:border-green-500 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Team
            </button>

            <button
              onClick={() => navigate({ to: "/join-team" })}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-purple-300 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 hover:border-purple-500 rounded-lg transition-colors"
            >
              <Users className="w-4 h-4" />
              Join Team
            </button>

            <div className="h-6 w-px bg-gray-700" />
          </>
        )}

        {/* Wallet Connection - Simplified Status Badge */}
        <div>
          {account ? (
            <div
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-300 bg-blue-600/20 border border-blue-600/50 rounded-lg cursor-default"
              title="Wallet Connected"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline font-mono">
                {truncateAddress(account)}
              </span>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-300 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 hover:border-blue-500 rounded-lg transition-colors"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Connect Wallet</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
