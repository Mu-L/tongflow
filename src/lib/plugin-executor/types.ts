import type { NodeSlot, SlotInput, SlotOutput } from "tongflow";

export type PluginExecRequest<S extends NodeSlot = NodeSlot> = {
    pluginId: string;
    nodeSlot: S;
    /** Selected model for router-style plugins; omitted = plugin default. */
    model?: string;
    /** Advanced parameters (plugin's `TONGFLOW_SLOT_PARAMS` keys); omitted =
     * plugin defaults. Delivered inside the prompt as the reserved `_params`
     * key, which `@node_slot` pops into `current_params()`. */
    params?: Record<string, unknown>;
    /** Strong typed input object (ABI compile-time + Phase 2.4 ajv at boundaries). */
    input: SlotInput<S>;
    /** Task id for streaming notifyTask */
    taskId: string;
    /** Abort signal (cancellation) */
    signal: AbortSignal;
};

export type PluginExecResult<S extends NodeSlot = NodeSlot> = SlotOutput<S> & {
    success: boolean;
    file_key?: string;
    error?: string;
};
