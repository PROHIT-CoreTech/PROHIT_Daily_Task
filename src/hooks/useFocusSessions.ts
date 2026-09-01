import useSWR from "swr";
import { fetcher, api } from "@/lib/api-client";

type FocusSessionItem = {
  id: string;
  taskId?: string;
  plannedMinutes: number;
  startedAt: string;
  endedAt?: string;
  completed: boolean;
};

type FocusSessionsResponse = { sessionsToday: number; recent: FocusSessionItem[] };

export function useFocusSessions(workspaceId: string | undefined) {
  const { data, mutate } = useSWR<FocusSessionsResponse>(
    workspaceId ? `/api/v1/workspaces/${workspaceId}/focus-sessions` : null,
    fetcher
  );

  async function startSession(plannedMinutes: number, taskId?: string) {
    if (!workspaceId) return null;
    const res = await api.post<{ id: string }>(`/api/v1/workspaces/${workspaceId}/focus-sessions`, {
      plannedMinutes,
      taskId,
    });
    return res.id;
  }

  async function endSession(sessionId: string, completed: boolean) {
    await api.patch(`/api/v1/focus-sessions/${sessionId}`, { completed });
    await mutate();
  }

  return { sessionsToday: data?.sessionsToday ?? 0, recent: data?.recent ?? [], startSession, endSession };
}
