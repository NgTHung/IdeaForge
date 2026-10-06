import { z } from "zod";

export const boardIdSchema = z.uuid();
export const roomSchema = z.string().regex(/^ideaforge:[0-9a-f-]{36}$/)
  .refine((room) => boardIdSchema.safeParse(room.slice("ideaforge:".length)).success);
