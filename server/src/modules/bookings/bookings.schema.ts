import { z } from "zod";

export const createBookingSchema = z.object({
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().min(1),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(2)
    .refine(
      (items) =>
        new Set(items.map((item) => item.ticketTypeId)).size === items.length,
      { message: "Each ticket type must appear only once." },
    )
    .refine(
      (items) => items.reduce((total, item) => total + item.quantity, 0) <= 10,
      { message: "You can book at most 10 tickets at once." },
    ),
  requestKey: z.string().uuid(),
});

const optionalGuestText = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => (value === "" ? null : value));

export const updateBookingGuestSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  fullName: z.string().trim().min(1).max(200),
  dietaryRequirements: optionalGuestText,
  accessibilityNeeds: optionalGuestText,
  mealOptionId: z.string().trim().min(1).nullable(),
});

export const eventGuestListQuerySchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED"]).default("CONFIRMED"),
});

export const bookingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
