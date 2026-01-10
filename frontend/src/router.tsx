import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient();

/**
 * Initializes and configures the TanStack Router with Query integration.
 */
export const router = createRouter({
  routeTree,
  // IMPORTANT: Expose the QueryClient via context for use in file-based loaders
  context: { queryClient },
  defaultPreload: "intent",
  // You might want to define the notFoundRoute here if you need a custom 404
});

// Module augmentation (keep this for TypeScript safety)
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface RouterContext {
    queryClient: QueryClient;
  }
}
