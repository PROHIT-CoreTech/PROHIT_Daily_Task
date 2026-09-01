import useSWR from "swr";
import { fetcher, api } from "@/lib/api-client";
import type { ListItem } from "@/types/api";

export function useLists(workspaceId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{ lists: ListItem[] }>(
    workspaceId ? `/api/v1/workspaces/${workspaceId}/lists` : null,
    fetcher
  );

  async function createList(name: string, color: string) {
    await api.post(`/api/v1/workspaces/${workspaceId}/lists`, { name, color });
    await mutate();
  }

  return { lists: data?.lists ?? [], error, isLoading, mutate, createList };
}
