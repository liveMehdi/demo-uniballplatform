import { z } from "zod";

const eventBranding = {
  bannerUrl: z
    .string()
    .trim()
    .max(2048)
    .url()
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    }, "Use an HTTPS image URL without embedded credentials.")
    .nullable()
    .optional(),
  headingColor: z
    .enum(["#b3b3fc", "#a8d0ff", "#ffb3ba", "#ffe6a3", "#b5e6be"])
    .nullable()
    .optional(),
};

export const createEventSchema = z.object({
  ...eventBranding,
  cateringDeadline: z.string().datetime().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  venue: z.string().trim().min(1).max(300),
  startsAt: z
    .string()
    .datetime()
    .refine(
      (value) => new Date(value).getTime() > Date.now(),
      "The event must start in the future.",
    ),
  societyId: z.string().trim().min(1),
  capacity: z.number().int().min(1).max(2147483647),
});

export const updateEventCapacitySchema = z.object({
  capacity: z.number().int().min(1).max(2147483647),
});

export const createMealOptionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
});

export const updateMealOptionSchema = createMealOptionSchema.extend({
  isAvailable: z.boolean(),
});
export type UpdateMealOptionInput = z.infer<typeof updateMealOptionSchema>;

export const updateEventDetailsSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  ...eventBranding,
  cateringDeadline: z.string().datetime().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable(),
  venue: z.string().trim().min(1).max(300),
  startsAt: z.string().datetime(),
});

export const setEventSalesSchema = z.object({
  salesClosed: z.boolean(),
});

export type UpdateEventDetailsInput = z.infer<typeof updateEventDetailsSchema>;

export type CreateMealOptionInput = z.infer<typeof createMealOptionSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
