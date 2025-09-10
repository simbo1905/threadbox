// Minimal authoring surface for the agent DSL (types + tagged descriptors)

export type Stream<T> = unknown;

export type Step<I = any, O = any> = { __step: [I, O] } & object;

export type RetryPolicy = { __policy: "retry"; cfg: { max: number; backoffMs?: number } };
export type RecoverPolicy = { __policy: "recover"; handler: (e: unknown) => unknown };
export type Policy = RetryPolicy | RecoverPolicy;

export type Program = {
  name: string;
  build: () => unknown;
  policies: Policy[];
};

// Descriptor tags
type Loc = { file: string; line: number; col: number };

type SeqDesc = { __op: "seq"; steps: unknown[]; loc?: Loc };
type ParDesc = { __op: "par"; steps: unknown[]; loc?: Loc };
type JoinDesc = { __op: "join"; steps: unknown[]; loc?: Loc };
type AndThenDesc = { __op: "andThen"; f: (...a: any[]) => unknown; loc?: Loc };
type AliasCallDesc = { __op: "aliasCall"; name: string; args: any[]; loc?: Loc };
type UseToolDesc = { __op: "useTool"; spec: { kind: string } & Record<string, unknown>; loc?: Loc };
type LogDesc = { __op: "log"; label?: string; loc?: Loc };

export type Descriptor =
  | SeqDesc
  | ParDesc
  | JoinDesc
  | AndThenDesc
  | AliasCallDesc
  | UseToolDesc
  | LogDesc
  | object; // allow opaque nodes

export function program(name: string, build: () => unknown): { with: (...p: Policy[]) => Program } {
  return {
    with: (...p: Policy[]): Program => ({ name, build, policies: p }),
  };
}

function captureLoc(): Loc | undefined {
  const err = new Error();
  const stack = String(err.stack || "").split(/\n+/).slice(1);
  for (const line of stack) {
    // formats: at file:line:col or at func (file:line:col)
    const m = line.match(/\(?(.+?):(\d+):(\d+)\)?/);
    if (!m) continue;
    const file = m[1]!;
    if (file.includes("agent-dsl/index") || file.includes("node:internal")) continue;
    const lineNo = Number(m[2]!);
    const colNo = Number(m[3]!);
    return { file, line: lineNo, col: colNo };
  }
  return undefined;
}

export function seq(...steps: unknown[]): unknown {
  return { __op: "seq", steps, loc: captureLoc() } as SeqDesc;
}

export function inParallel(...steps: unknown[]): unknown {
  return { __op: "par", steps, loc: captureLoc() } as ParDesc;
}

export function join(...steps: unknown[]): unknown {
  return { __op: "join", steps, loc: captureLoc() } as JoinDesc;
}

export function andThen(f: (...a: any[]) => unknown): unknown {
  return { __op: "andThen", f, loc: captureLoc() } as AndThenDesc;
}

export function onFailureRetry(cfg: { max: number; backoffMs?: number }): Policy {
  return { __policy: "retry", cfg } as RetryPolicy;
}

export function recover(handler: (e: unknown) => unknown): Policy {
  return { __policy: "recover", handler } as RecoverPolicy;
}

export function alias<F extends (...a: any[]) => any>(name: string): (...a: Parameters<F>) => unknown {
  return (...args: Parameters<F>): unknown => ({ __op: "aliasCall", name, args, loc: captureLoc() } as AliasCallDesc);
}

export function useTool(spec: { kind: string } & Record<string, unknown>): unknown {
  return { __op: "useTool", spec, loc: captureLoc() } as UseToolDesc;
}

export function log(label?: string): unknown {
  return { __op: "log", label, loc: captureLoc() } as LogDesc;
}
