import { z } from "zod";

export const checkInSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/),
});
