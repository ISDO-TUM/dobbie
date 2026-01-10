import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { Header } from "../components/Header";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-linear-to-b from-[#040710] via-[#0a0f1e] to-[#040710]">
      <Header />
      <Outlet />
      <TanStackRouterDevtools />
    </div>
  );
}
