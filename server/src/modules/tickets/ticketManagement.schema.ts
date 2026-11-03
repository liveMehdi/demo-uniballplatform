import { z } from "zod";

export const updateTicketTypeSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime(),
    pricePence: z.number().int().min(0).max(2147483647),
    capacity: z.number().int().min(1).max(2147483647),
    salesStart: z.string().datetime(),
    salesEnd: z.string().datetime(),
  })
  .refine((input) => new Date(input.salesEnd) > new Date(input.salesStart), {
    message: "Sales must end after they start.",
    path: ["salesEnd"],
  });

export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;
