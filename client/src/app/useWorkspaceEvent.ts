import { useOutletContext } from "react-router";
import type { EventDetails } from "../features/events/api";

export function useWorkspaceEvent() {
  return useOutletContext<EventDetails>();
}
