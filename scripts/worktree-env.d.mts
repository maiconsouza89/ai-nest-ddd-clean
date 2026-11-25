// Tipos de scripts/worktree-env.mjs, para os unitários em TypeScript.
export declare const GENERATED_MARKER: string;

export declare function slotTag(slot: number): string;
export declare function slotDatabase(slot: number): string;
export declare function parseWorktreeList(porcelain: string): string[];
export declare function slotFromEnv(env: Record<string, string | undefined>): number | undefined;
export declare function pickSlot(options: {
  current: number | undefined;
  reserved: { has(slot: number): boolean };
  isPortFree: (port: number) => Promise<boolean>;
}): Promise<{ slot: number; fresh: boolean } | undefined>;
export declare function normalizeProjectName(name: string): string;
export declare function composeProjectName(
  mainEnv: Record<string, string>,
  mainDir: string,
): string;
export declare function withEnvironmentAttribute(
  attributes: string | undefined,
  slot: number,
): string;
export declare function worktreeValues(
  baseEnv: Record<string, string>,
  slot: number,
  projectName: string,
): Record<string, string>;
export declare function renderEnv(baseContent: string, values: Record<string, string>): string;
export declare function filterEnvLocal(
  content: string,
  keys: string[],
): { content: string; removed: string[] };
