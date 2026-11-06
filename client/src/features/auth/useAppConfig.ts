import { useQuery } from "@tanstack/react-query";
import { checkResponse } from "../../lib/apiError";

type AppConfig = {
  emailEnabled: boolean;
  demoAccount: { email: string; password: string } | null;
};

export function useAppConfig<T = AppConfig>(select?: (config: AppConfig) => T) {
  return useQuery({
    queryKey: ["app-config"],
    staleTime: 60_000,
    select,
    queryFn: async (): Promise<AppConfig> => {
      const response = await fetch("/api/config", { credentials: "include" });
      await checkResponse(response, "Could not load app settings.");
      const data = await response.json();

      if (
        typeof data?.emailEnabled !== "boolean" ||
        (data.demoAccount != null &&
          (typeof data.demoAccount.email !== "string" ||
            typeof data.demoAccount.password !== "string"))
      ) {
        throw new Error("Could not load app settings.");
      }

      return {
        emailEnabled: data.emailEnabled,
        demoAccount: data.demoAccount ?? null,
      };
    },
  });
}
