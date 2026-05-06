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
      if (process.env.NODE_ENV === "development") {
        console.error(`[trpc] ${path}: ${error.message}`);
      }
    },
  });

export { handler as GET, handler as POST };
