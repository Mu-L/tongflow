/**
 * Default task dispatch: run the task in-process (the local runner spawns
 * Python plugin bridges / the SDK engine). The dynamic import keeps the
 * node-only dependency chain (child_process etc.) out of bundles for
 * shells that substitute a remote dispatcher via `src/ext/task-dispatch.ts`.
 */
export async function dispatchTask(taskId: string): Promise<void> {
    const { dispatchTask: dispatchLocally } = await import("@/lib/task/runner");
    return dispatchLocally(taskId);
}
