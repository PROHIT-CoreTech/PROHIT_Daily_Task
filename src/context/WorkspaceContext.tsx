"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { MeResponse, MeWorkspace } from "@/types/api";

const ACTIVE_WORKSPACE_KEY = "prohit:activeWorkspaceId";

type WorkspaceContextValue = {
  me: MeResponse | undefined;
  isLoading: boolean;
  activeWorkspace: MeWorkspace | undefined;
  setActiveWorkspaceId: (id: string) => void;
  refresh: () => Promise<MeResponse | undefined>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading, mutate } = useSWR<MeResponse>("/api/v1/me", fetcher);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!me) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_WORKSPACE_KEY) : null;
    const validStored = stored && me.workspaces.some((w) => w.id === stored) ? stored : undefined;
    setActiveWorkspaceIdState(validStored ?? me.user.defaultWorkspaceId ?? me.workspaces[0]?.id);
  }, [me]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  }, []);

  const activeWorkspace = useMemo(
    () => me?.workspaces.find((w) => w.id === activeWorkspaceId),
    [me, activeWorkspaceId]
  );

  const refresh = useCallback(async () => mutate(), [mutate]);

  return (
    <WorkspaceContext.Provider value={{ me, isLoading, activeWorkspace, setActiveWorkspaceId, refresh }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
