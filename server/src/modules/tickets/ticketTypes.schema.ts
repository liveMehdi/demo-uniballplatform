import { z } from "zod";

export const createTicketTypeSchema = z
  .object({
    tier: z.enum(["STANDARD", "VIP"]),
    pricePence: z.number().int().min(0).max(2147483647),
    capacity: z.number().int().min(1).max(2147483647),
    salesStart: z.string().datetime(),
    salesEnd: z.string().datetime(),
  })
  .refine((data) => new Date(data.salesEnd) > new Date(data.salesStart), {
    message: "Sales must end after they start.",
    path: ["salesEnd"],
  });

export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;
