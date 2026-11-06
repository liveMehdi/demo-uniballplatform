import { useAppConfig } from "./useAppConfig";

export function useEmailAvailability() {
  return useAppConfig((config) => config.emailEnabled);
}
