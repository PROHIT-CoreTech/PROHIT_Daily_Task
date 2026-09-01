"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Play, Pause, Square } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useFocusSessions } from "@/hooks/useFocusSessions";
import { TopNav } from "@/components/layout/TopNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { TimerRing } from "@/components/deepwork/TimerRing";
import { UpgradeGate } from "@/components/billing/UpgradeGate";
import { NOMENCLATURE } from "@/lib/constants";
import type { TaskItem } from "@/types/api";

const DURATION_PRESETS = [25, 45, 60];

function DeepWorkContent() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const { sessionsToday, startSession, endSession } = useFocusSessions(workspaceId);

  const { data: tasksData } = useSWR<{ tasks: TaskItem[] }>(
    workspaceId ? `/api/v1/workspaces/${workspaceId}/tasks?status=todo&limit=50` : null,
    fetcher
  );

  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const [taskId, setTaskId] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(plannedMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset the ring when the user changes duration before starting.
  useEffect(() => {
    if (!sessionId) setSecondsRemaining(plannedMinutes * 60);
  }, [plannedMinutes, sessionId]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setSecondsRemaining((s) => s - 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  useEffect(() => {
    if (secondsRemaining <= 0 && sessionId) {
      setIsRunning(false);
      endSession(sessionId, true);
      setSessionId(null);
    }
  }, [secondsRemaining, sessionId, endSession]);

  async function onStart() {
    if (!sessionId) {
      const id = await startSession(plannedMinutes, taskId || undefined);
      setSessionId(id);
    }
    setIsRunning(true);
  }

  function onPause() {
    setIsRunning(false);
  }

  async function onStop() {
    setIsRunning(false);
    if (sessionId) await endSession(sessionId, false);
    setSessionId(null);
    setSecondsRemaining(plannedMinutes * 60);
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav title={NOMENCLATURE.focusTimer} />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-6">
        <Card className="p-8 flex flex-col items-center gap-6 w-full max-w-md">
          <TimerRing secondsRemaining={Math.max(0, secondsRemaining)} totalSeconds={plannedMinutes * 60} />

          {!sessionId && (
            <div className="flex items-center gap-2">
              {DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  onClick={() => setPlannedMinutes(m)}
                  className={`rounded-lg px-3 py-1.5 text-sm border ${
                    plannedMinutes === m ? "border-accent bg-accent/10 text-accent" : "border-border text-muted"
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
          )}

          {!sessionId && tasksData && tasksData.tasks.length > 0 && (
            <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="w-full">
              <option value="">No linked task</option>
              {tasksData.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          )}

          <div className="flex items-center gap-3">
            {!isRunning ? (
              <Button onClick={onStart} className="px-6">
                <Play size={16} /> {sessionId ? "Resume" : "Start"}
              </Button>
            ) : (
              <Button onClick={onPause} variant="secondary" className="px-6">
                <Pause size={16} /> Pause
              </Button>
            )}
            {sessionId && (
              <Button onClick={onStop} variant="ghost">
                <Square size={14} /> Stop
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-4 w-full max-w-md flex items-center justify-between">
          <span className="text-sm text-muted">Sessions today</span>
          <span className="text-xl font-semibold text-accent">{sessionsToday}</span>
        </Card>
      </div>
    </div>
  );
}

export default function DeepWorkPage() {
  return (
    <UpgradeGate feature="deep_work" title={NOMENCLATURE.focusTimer}>
      <DeepWorkContent />
    </UpgradeGate>
  );
}
