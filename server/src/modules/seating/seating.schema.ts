import { z } from "zod";


export const createTableGroupSchema = z.object({
  guestId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
});

export const joinTableGroupSchema = z.object({
  guestId: z.string().uuid(),
  inviteCode: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-f0-9]{24}$/, "Invalid invite code."),
});

export const createEventTableSchema = z.object({
  name: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(2147483647),
});

export const assignGuestTableSchema = z.object({
  tableId: z.uuid().nullable(),
});

export const seatingPublicationSchema = z.object({
  published: z.boolean(),
});
export const guestIdSchema = z.string().uuid();