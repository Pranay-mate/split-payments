import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createTrpcContext } from "@/server/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTrpcContext,
    onError({ error, path }) {
      // Always log in prod too — Vercel was showing bare 500s with no
      // error context, making prod debugging impossible. The full
      // Postgres / tRPC error reason gets surfaced here while the
      // HTTP response stays sanitized either way.
      console.error(`[trpc] ${path}:`, error.message);
      if (error.cause) {
        console.error(`[trpc] ${path} cause:`, error.cause);
      }
    },
  });

export { handler as GET, handler as POST };
