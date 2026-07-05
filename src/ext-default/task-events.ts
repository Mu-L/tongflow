import { EventEmitter } from "node:events";
import type { TaskEvent } from "@/lib/task/emitter";

/**
 * Default task event backend: in-process EventEmitter + AbortController
 * map. Fits the single-process open-source/desktop build; a cloud shell
 * substitutes a cross-instance backend (e.g. a Durable Object event log)
 * via `src/ext/task-events.ts`.
 */

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

// Running task -> AbortController mapping, used to cancel running tasks.
const runningTasks = new Map<string, AbortController>();

/** Publish task events (called by handlers) */
export function emitTaskEvent(taskId: string, event: TaskEvent) {
    emitter.emit(`task:${taskId}`, event);
}

/**
 * Subscribe to task events (called by SSE endpoints).
 * Returns an unsubscribe function.
 */
export function onTaskEvent(
    taskId: string,
    callback: (event: TaskEvent) => void,
): () => void {
    const channel = `task:${taskId}`;
    emitter.on(channel, callback);
    return () => {
        emitter.off(channel, callback);
    };
}

/** Register a running task */
export function registerTask(taskId: string): AbortController {
    const controller = new AbortController();
    runningTasks.set(taskId, controller);
    return controller;
}

/** Cancel task */
export function abortTask(taskId: string): boolean {
    const controller = runningTasks.get(taskId);
    if (controller) {
        controller.abort();
        runningTasks.delete(taskId);
        return true;
    }
    return false;
}

/** Remove completed tasks */
export function removeTask(taskId: string) {
    runningTasks.delete(taskId);
}

/** Check whether a task is running */
export function isTaskRunning(taskId: string): boolean {
    return runningTasks.has(taskId);
}

/**
 * Number of currently running tasks (all scopes) — used e.g. by a cloud
 * shell's idle self-exit guard.
 */
export function runningTaskCount(): number {
    return runningTasks.size;
}

/**
 * Convenience function for sending task notifications (replaces the Python notifyTask)
 */
export function notifyTask(
    taskId: string,
    status: string,
    data?: Record<string, unknown>,
    nodeId?: string | null,
) {
    emitTaskEvent(taskId, { id: taskId, status, nodeId, data });
}
