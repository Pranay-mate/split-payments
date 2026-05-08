import { router } from "../trpc";
import { authRouter } from "./auth";
import { groupsRouter } from "./groups";
import { expensesRouter } from "./expenses";
import { profilesRouter } from "./profiles";
import { settlementsRouter } from "./settlements";
import { commentsRouter } from "./comments";
import { eventsRouter } from "./eventsRouter";

export const appRouter = router({
  auth: authRouter,
  groups: groupsRouter,
  expenses: expensesRouter,
  profiles: profilesRouter,
  settlements: settlementsRouter,
  comments: commentsRouter,
  events: eventsRouter,
});

export type AppRouter = typeof appRouter;
