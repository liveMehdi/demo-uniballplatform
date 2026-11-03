import { z } from "zod";

export const addOrganiserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
