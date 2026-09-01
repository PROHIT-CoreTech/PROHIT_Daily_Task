import useSWR from "swr";
import { fetcher, api } from "@/lib/api-client";
import type { CommentItem, TaskItem } from "@/types/api";

export function useTaskDetail(taskId: string | undefined) {
  const { data, mutate } = useSWR<{ task: TaskItem }>(taskId ? `/api/v1/tasks/${taskId}` : null, fetcher);
  const { data: commentsData, mutate: mutateComments } = useSWR<{ comments: CommentItem[] }>(
    taskId ? `/api/v1/tasks/${taskId}/comments` : null,
    fetcher
  );

  async function addSubtask(title: string) {
    if (!taskId) return;
    await api.post(`/api/v1/tasks/${taskId}/subtasks`, { title });
    await mutate();
  }

  async function toggleSubtask(subtaskId: string, done: boolean) {
    if (!taskId) return;
    await api.patch(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, { done });
    await mutate();
  }

  async function addComment(body: string) {
    if (!taskId) return;
    await api.post(`/api/v1/tasks/${taskId}/comments`, { body });
    await mutateComments();
  }

  async function requestAttachmentUpload(filename: string, contentType: string, sizeBytes: number) {
    if (!taskId) return null;
    const result = await api.post<{ uploadUrl: string; publicUrl: string }>(`/api/v1/tasks/${taskId}/attachments`, {
      filename,
      contentType,
      sizeBytes,
    });
    await mutate();
    return result;
  }

  return {
    task: data?.task,
    comments: commentsData?.comments ?? [],
    mutate,
    addSubtask,
    toggleSubtask,
    addComment,
    requestAttachmentUpload,
  };
}
