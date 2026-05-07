import { router } from "../trpc";
import { authRouter } from "./auth";
import { groupsRouter } from "./groups";
import { expensesRouter } from "./expenses";
import { profilesRouter } from "./profiles";
import { settlementsRouter } from "./settlements";

export const appRouter = router({
  auth: authRouter,
  groups: groupsRouter,
  expenses: expensesRouter,
  profiles: profilesRouter,
  settlements: settlementsRouter,
});

export type AppRouter = typeof appRouter;
