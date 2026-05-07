import { router } from "../trpc";
import { authRouter } from "./auth";
import { groupsRouter } from "./groups";
import { expensesRouter } from "./expenses";
import { profilesRouter } from "./profiles";

export const appRouter = router({
  auth: authRouter,
  groups: groupsRouter,
  expenses: expensesRouter,
  profiles: profilesRouter,
});

export type AppRouter = typeof appRouter;
