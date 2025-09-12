/**
 * Example DSL pipeline: parallel fetch → risk assessment → log.
 * Demonstrates seq/par composition with retry policy.
 * Transpiles to .tmp/risk_pipe.gen.ts
 */
import { program, seq, inParallel, andThen, join, onFailureRetry, recover,
         useTool, log } from "agent-dsl";
import { runShell, callApi } from "../src/actions";

export default program("RISK_PIPE", () =>
  seq(
    inParallel(
      runShell("./call-mainframe.sh"),
      callApi("download-documents"),
      callApi("fetch-risk-seed")
    ),
    andThen(([logs, docs, seed]) => callApi("riskAssessment", { docs, seed })),
    log("risk-assessed")
  )
).with(
  onFailureRetry({ max: 3, backoffMs: 500 }),
  recover(e => useTool({ kind: "log", level: "error", e }))
);
