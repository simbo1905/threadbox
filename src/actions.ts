/**
 * Registry of named tool aliases for DSL use.
 * These become ctx.tools.* calls in generated code.
 */
import { alias } from "agent-dsl";

export const runShell = alias<
  (cmd: string, args?: string[]) => import("rxjs").Observable<Buffer>
>("runShell");

export const callApi = alias<
  (name: string, payload?: unknown) => import("rxjs").Observable<any>
>("callApi");
