import { useQuery } from "@tanstack/react-query";
import { checkResponse } from "../../lib/apiError";

export function useEmailAvailability() {
  return useQuery({
    queryKey: ["email-availability"],
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch("/api/config", { credentials: "include" });
      await checkResponse(response, "Could not load app settings.");
      const data = await response.json();
      if (typeof data?.emailEnabled !== "boolean") {
        throw new Error("Could not load app settings.");
      }
      return data.emailEnabled as boolean;
    },
  });
}
