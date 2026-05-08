/**
 * Server-side tRPC caller. Use from React Server Components / Route Handlers
 * to invoke the same router server-to-server (no HTTP round-trip).
 *
 * Use in pages to prefetch data and pass it as initialData to the client
 * components, eliminating an extra round-trip after hydration.
 */

import { appRouter } from "./routers/_app";
import { createTrpcContext } from "./context";

export async function getServerCaller() {
  const ctx = await createTrpcContext();
  return appRouter.createCaller(ctx);
}
