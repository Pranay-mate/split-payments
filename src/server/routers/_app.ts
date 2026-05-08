import { router } from "../trpc";
import { authRouter } from "./auth";
import { groupsRouter } from "./groups";
import { expensesRouter } from "./expenses";
import { profilesRouter } from "./profiles";
import { settlementsRouter } from "./settlements";
import { commentsRouter } from "./comments";
import { eventsRouter } from "./eventsRouter";
import { claimRouter } from "./claim";

export const appRouter = router({
  auth: authRouter,
  groups: groupsRouter,
  expenses: expensesRouter,
  profiles: profilesRouter,
  settlements: settlementsRouter,
  comments: commentsRouter,
  events: eventsRouter,
  claim: claimRouter,
});

export type AppRouter = typeof appRouter;
