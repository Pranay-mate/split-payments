import { randomBytes } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  anomalyMutes,
  expenseComments,
  expenseItems,
  expenseSplits,
  expenses,
  financialGoals,
  financialProfiles,
  groupMembers,
  groups,
  personalEntries,
  personalHoldings,
  personalNetWorthSnapshots,
  personalRecurrences,
  profiles,
  scoreSnapshots,
  settlements,
} from "@/lib/db/schema";
import { decryptAmount, decryptValue } from "@/lib/encryption";
import { isAdmin } from "@/server/admin-auth";
import {
  looksLikeEmailPrefix,
  profileAvatarDefault,
  profileDisplayDefault,
} from "@/lib/profile-defaults";

export const profilesRouter = router({
  /** Get profiles for an array of user IDs. Used to render member names. */
  byIds: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(profiles)
        .where(inArray(profiles.id, input.ids));
      return rows;
    }),

  /** Get the current user's profile. Creates one if missing. Also
   *  auto-upgrades a stale email-prefix display name / missing avatar
   *  to OAuth metadata when available, so existing users get the
   *  Google name + avatar populated on their next visit. */
  me: protectedProcedure.query(async ({ ctx }) => {
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, ctx.user.id))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      const wantedName = profileDisplayDefault(ctx.user);
      const wantedAvatar = profileAvatarDefault(ctx.user);

      // Only overwrite displayName if it still looks like the
      // email-prefix auto-fallback AND we have a better (OAuth) name.
      // Don't clobber names users have manually edited.
      const shouldUpgradeName =
        ctx.user.fullName !== null &&
        looksLikeEmailPrefix(row.displayName, ctx.user.email) &&
        wantedName !== row.displayName;
      // Avatar: fill in only if missing — user might have uploaded one.
      const shouldUpgradeAvatar =
        wantedAvatar !== null && row.avatarUrl === null;

      if (shouldUpgradeName || shouldUpgradeAvatar) {
        const [updated] = await db
          .update(profiles)
          .set({
            ...(shouldUpgradeName && { displayName: wantedName }),
            ...(shouldUpgradeAvatar && { avatarUrl: wantedAvatar }),
            updatedAt: new Date(),
          })
          .where(eq(profiles.id, ctx.user.id))
          .returning();
        return { ...updated, isAdmin: isAdmin(ctx.user.id) };
      }
      return { ...row, isAdmin: isAdmin(ctx.user.id) };
    }

    const [created] = await db
      .insert(profiles)
      .values({
        id: ctx.user.id,
        displayName: profileDisplayDefault(ctx.user),
        avatarUrl: profileAvatarDefault(ctx.user),
      })
      .returning();
    return { ...created, isAdmin: isAdmin(ctx.user.id) };
  }),

  /** Update the current user's profile. All fields optional — only the
   *  ones the form actually changes are sent. */
  update: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(60).optional(),
        avatarUrl: z.string().url().or(z.literal("")).optional(),
        /** YYYY-MM-DD or empty string to clear. */
        dob: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "DOB must be YYYY-MM-DD")
          .or(z.literal(""))
          .optional(),
        theme: z.enum(["system", "light", "dark"]).optional(),
        /** IANA tz id like "Asia/Kolkata". We don't validate against
         *  the full IANA list here — the UI only exposes a curated set. */
        timezone: z.string().min(1).max(64).optional(),
        /** 3-letter ISO 4217 currency code. */
        defaultCurrency: z
          .string()
          .length(3)
          .regex(/^[A-Z]{3}$/, "3-letter ISO 4217 currency")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(profiles)
        .set({
          ...(input.displayName !== undefined && {
            displayName: input.displayName,
          }),
          ...(input.avatarUrl !== undefined && {
            avatarUrl: input.avatarUrl || null,
          }),
          ...(input.dob !== undefined && { dob: input.dob || null }),
          ...(input.theme !== undefined && { theme: input.theme }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
          ...(input.defaultCurrency !== undefined && {
            defaultCurrency: input.defaultCurrency,
          }),
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, ctx.user.id))
        .returning();
      return updated;
    }),

  /**
   * Wealth-share helpers (Phase 2.5 v5.2). Token = 32 bytes hex (64 chars,
   * effectively unguessable). Generating issues a new token; revoking
   * sets it to NULL. show_amounts is a separate sub-toggle: even when
   * sharing is on, amounts stay hidden by default.
   */
  enableWealthShare: protectedProcedure.mutation(async ({ ctx }) => {
    const token = randomBytes(32).toString("hex");
    await db
      .update(profiles)
      .set({ wealthShareToken: token, updatedAt: new Date() })
      .where(eq(profiles.id, ctx.user.id));
    return { token };
  }),

  disableWealthShare: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(profiles)
      .set({ wealthShareToken: null, updatedAt: new Date() })
      .where(eq(profiles.id, ctx.user.id));
    return { ok: true };
  }),

  setWealthShareShowAmounts: protectedProcedure
    .input(z.object({ show: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(profiles)
        .set({
          wealthShareShowAmounts: input.show,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, ctx.user.id));
      return { ok: true };
    }),

  /** Re-issue a fresh token; old links break instantly. */
  rotateWealthShareToken: protectedProcedure.mutation(async ({ ctx }) => {
    const token = randomBytes(32).toString("hex");
    await db
      .update(profiles)
      .set({ wealthShareToken: token, updatedAt: new Date() })
      .where(eq(profiles.id, ctx.user.id));
    return { token };
  }),

  /**
   * "Download everything" export — server-side decryption of every row
   * that belongs to the caller, then a JSON payload the client turns
   * into a downloadable file. Surfaced via the profile editor.
   *
   * Privacy note: this is the user's own data, returned over their
   * authed tRPC session. The file produced is plaintext — the UI
   * shows a "store this securely" reminder.
   */
  exportAll: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const dec = (s: string | null): number | null =>
      s === null ? null : decryptAmount(s);

    // --- Profile ---
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    // --- Groups the user is in (plus every related row) ---
    const memberRows = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));
    const groupIds = memberRows.map((m) => m.groupId);

    const myGroups = groupIds.length
      ? await db
          .select()
          .from(groups)
          .where(inArray(groups.id, groupIds))
      : [];
    const myMembers = groupIds.length
      ? await db
          .select()
          .from(groupMembers)
          .where(inArray(groupMembers.groupId, groupIds))
      : [];
    const myExpenses = groupIds.length
      ? await db
          .select()
          .from(expenses)
          .where(inArray(expenses.groupId, groupIds))
          .orderBy(asc(expenses.occurredAt))
      : [];
    const expenseIds = myExpenses.map((e) => e.id);
    const mySplits = expenseIds.length
      ? await db
          .select()
          .from(expenseSplits)
          .where(inArray(expenseSplits.expenseId, expenseIds))
      : [];
    const myItems = expenseIds.length
      ? await db
          .select()
          .from(expenseItems)
          .where(inArray(expenseItems.expenseId, expenseIds))
      : [];
    const myComments = expenseIds.length
      ? await db
          .select()
          .from(expenseComments)
          .where(inArray(expenseComments.expenseId, expenseIds))
      : [];
    const mySettlements = groupIds.length
      ? await db
          .select()
          .from(settlements)
          .where(inArray(settlements.groupId, groupIds))
      : [];

    // --- Personal-side data (decrypted) ---
    const entries = await db
      .select()
      .from(personalEntries)
      .where(eq(personalEntries.userId, userId))
      .orderBy(asc(personalEntries.occurredAt));
    const [finProfile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    const goals = await db
      .select()
      .from(financialGoals)
      .where(eq(financialGoals.userId, userId));
    const holdings = await db
      .select()
      .from(personalHoldings)
      .where(eq(personalHoldings.userId, userId));
    const recurrences = await db
      .select()
      .from(personalRecurrences)
      .where(eq(personalRecurrences.userId, userId));
    const snapshots = await db
      .select()
      .from(scoreSnapshots)
      .where(eq(scoreSnapshots.userId, userId))
      .orderBy(asc(scoreSnapshots.snapshottedAt));
    const netWorthSnaps = await db
      .select()
      .from(personalNetWorthSnapshots)
      .where(eq(personalNetWorthSnapshots.userId, userId))
      .orderBy(asc(personalNetWorthSnapshots.snapshotDate));
    const mutes = await db
      .select()
      .from(anomalyMutes)
      .where(eq(anomalyMutes.userId, userId));

    return {
      meta: {
        exportedAt: new Date().toISOString(),
        userId,
        appVersion: "easysplits",
        notice:
          "This file contains your decrypted financial data. Store it securely; anyone with access to it can read your numbers.",
      },
      profile: profile
        ? {
            id: profile.id,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            dob: profile.dob,
            theme: profile.theme,
            timezone: profile.timezone,
            defaultCurrency: profile.defaultCurrency,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
          }
        : null,
      groups: myGroups.map((g) => ({
        id: g.id,
        name: g.name,
        primaryCurrency: g.primaryCurrency,
        createdAt: g.createdAt,
        archivedAt: g.archivedAt,
      })),
      members: myMembers,
      expenses: myExpenses.map((e) => ({
        id: e.id,
        groupId: e.groupId,
        description: e.description,
        amount: Number(e.amount),
        currency: e.currency,
        convertedAmount: Number(e.convertedAmount),
        payerId: e.payerId,
        splitMode: e.splitMode,
        category: e.category,
        occurredAt: e.occurredAt,
      })),
      splits: mySplits.map((s) => ({
        expenseId: s.expenseId,
        userId: s.userId,
        amount: Number(s.amount),
      })),
      items: myItems,
      comments: myComments,
      settlements: mySettlements.map((s) => ({
        id: s.id,
        groupId: s.groupId,
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        amount: Number(s.amount),
        note: s.note,
        occurredAt: s.occurredAt,
      })),
      personal: {
        entries: entries.map((r) => ({
          id: r.id,
          type: r.type,
          amount: decryptAmount(r.amount),
          currency: r.currency,
          category: r.category,
          description: decryptValue(r.description),
          occurredAt: r.occurredAt,
          deletedAt: r.deletedAt,
        })),
        financialProfile: finProfile
          ? {
              age: finProfile.age,
              retirementAge: finProfile.retirementAge,
              isFreelancer: finProfile.isFreelancer,
              hasDependents: finProfile.hasDependents,
              hasCcCarryover: finProfile.hasCcCarryover,
              monthlyIncome: dec(finProfile.monthlyIncome),
              monthlyExpenses: dec(finProfile.monthlyExpenses),
              liquidSavings: dec(finProfile.liquidSavings),
              termCoverAmount: dec(finProfile.termCoverAmount),
              healthCoverAmount: dec(finProfile.healthCoverAmount),
              totalEmi: dec(finProfile.totalEmi),
              investmentBalance: dec(finProfile.investmentBalance),
              monthlyInvestment: dec(finProfile.monthlyInvestment),
              completedAt: finProfile.completedAt,
            }
          : null,
        goals,
        holdings: holdings.map((h) => ({
          id: h.id,
          name: h.name,
          type: h.type,
          units: decryptAmount(h.units),
          avgCost: decryptAmount(h.avgCost),
          currentValue: decryptAmount(h.currentValue),
          asOf: h.asOf,
          notes: h.notes ? decryptValue(h.notes) : null,
          archivedAt: h.archivedAt,
        })),
        recurrences: recurrences.map((r) => ({
          id: r.id,
          type: r.type,
          amount: decryptAmount(r.amount),
          description: decryptValue(r.description),
          category: r.category,
          currency: r.currency,
          scheduleDay: r.scheduleDay,
          nextDueAt: r.nextDueAt,
          lastFiredAt: r.lastFiredAt,
          pausedAt: r.pausedAt,
        })),
        scoreSnapshots: snapshots,
        netWorthSnapshots: netWorthSnaps.map((s) => ({
          snapshotDate: s.snapshotDate,
          totalValue: decryptAmount(s.totalValue),
          liquidSavings: decryptAmount(s.liquidSavings),
          holdingsValue: decryptAmount(s.holdingsValue),
        })),
        anomalyMutes: mutes,
      },
    };
  }),
});
