import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getUserPreference, setUserPreference, deleteUserPreference } from "./db";

export const preferencesRouter = router({
  /** Get a user preference by key */
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const value = await getUserPreference(ctx.user.id, input.key);
      return { value };
    }),

  /** Set a user preference */
  set: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await setUserPreference(ctx.user.id, input.key, input.value);
      return { success: true };
    }),

  /** Delete a user preference (reset to default) */
  delete: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteUserPreference(ctx.user.id, input.key);
      return { success: true };
    }),
});
