/**
 * RxJS abstraction layer - wraps operators for generated code.
 * R.par() = forkJoin, R.flatMap() = mergeMap/concatMap based on mode.
 * dummyCtx used when operators don't need real context.
 */
import {
  Observable,
  defer,
  forkJoin,
  zip as rxZip,
  map as rxMap,
  mergeMap,
  concatMap,
  tap as rxTap,
  catchError,
  of,
  retry as rxRetry,
  timer,
} from "rxjs";

export interface Runtime {
  par<T>(thunks: Array<() => Observable<T>>): Observable<T[]>;
  zip<T extends any[]>(...s: { [K in keyof T]: Observable<T[K]> }): Observable<T>;
  map<I, O>(s: Observable<I>, f: (i: I, ctx: Ctx) => O): Observable<O>;
  flatMap<I, O>(
    s: Observable<I>,
    f: (i: I, ctx: Ctx) => Observable<O>,
    mode?: "merge" | "concat"
  ): Observable<O>;
  tap<T>(s: Observable<T>, f: (t: T) => void): Observable<T>;
  retry<T>(s: Observable<T>, cfg: { max: number; backoffMs?: number }): Observable<T>;
  onError<T>(s: Observable<T>, h: (e: unknown, ctx: Ctx) => Observable<T>): Observable<T>;
}

export interface Tools {
  runShell(cmd: string, args?: string[]): Observable<Buffer>;
  callApi(name: string, payload?: unknown): Observable<any>;
  log(input: { level?: string; [k: string]: unknown }): Observable<void>;
}

export interface Ctx {
  tools: Tools;
  log(x: unknown): void;
}

export const RxRuntime: Runtime = {
  par<T>(thunks: Array<() => Observable<T>>): Observable<T[]> {
    const sources = thunks.map((t) => defer(t));
    return forkJoin(sources);
  },
  zip<T extends any[]>(...s: { [K in keyof T]: Observable<T[K]> }): Observable<T> {
    return (rxZip as any)(...(s as any)) as Observable<T>;
  },
  map<I, O>(s: Observable<I>, f: (i: I, ctx: Ctx) => O): Observable<O> {
    return s.pipe(rxMap((i) => f(i, dummyCtx)));
  },
  flatMap<I, O>(
    s: Observable<I>,
    f: (i: I, ctx: Ctx) => Observable<O>,
    mode: "merge" | "concat" = "merge"
  ): Observable<O> {
    return s.pipe(mode === "concat" ? concatMap((i) => f(i, dummyCtx)) : mergeMap((i) => f(i, dummyCtx)));
  },
  tap<T>(s: Observable<T>, f: (t: T) => void): Observable<T> {
    return s.pipe(rxTap((t) => f(t)));
  },
  retry<T>(s: Observable<T>, cfg: { max: number; backoffMs?: number }): Observable<T> {
    const count = Math.max(0, cfg.max);
    return s.pipe(
      rxRetry({
        count,
        delay: cfg.backoffMs ? () => timer(cfg.backoffMs!) : undefined,
      })
    );
  },
  onError<T>(s: Observable<T>, h: (e: unknown, ctx: Ctx) => Observable<T>): Observable<T> {
    return s.pipe(catchError((e) => h(e, dummyCtx)));
  },
};

// Minimal ctx placeholder used in runtime operators that require a ctx argument
// but where call-sites provide lambdas that ignore ctx. The generated code uses
// explicit ctx where needed (e.g., alias/useTool/log).
const dummyCtx: Ctx = {
  tools: {
    runShell: () => of(Buffer.from("")),
    callApi: () => of(undefined),
    log: () => of(void 0),
  },
  log: () => {},
};
