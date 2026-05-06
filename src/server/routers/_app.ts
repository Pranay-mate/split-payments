import { router } from "../trpc";
import { authRouter } from "./auth";
import { groupsRouter } from "./groups";

export const appRouter = router({
  auth: authRouter,
  groups: groupsRouter,
});

export type AppRouter = typeof appRouter;
