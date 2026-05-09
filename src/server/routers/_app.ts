import { router } from "../trpc";
import { authRouter } from "./auth";
import { groupsRouter } from "./groups";
import { expensesRouter } from "./expenses";
import { profilesRouter } from "./profiles";
import { settlementsRouter } from "./settlements";
import { commentsRouter } from "./comments";
import { eventsRouter } from "./eventsRouter";
import { claimRouter } from "./claim";
import { notificationsRouter } from "./notifications";
import { personalRouter } from "./personal";

export const appRouter = router({
  auth: authRouter,
  groups: groupsRouter,
  expenses: expensesRouter,
  profiles: profilesRouter,
  settlements: settlementsRouter,
  comments: commentsRouter,
  events: eventsRouter,
  claim: claimRouter,
  notifications: notificationsRouter,
  personal: personalRouter,
});

export type AppRouter = typeof appRouter;
