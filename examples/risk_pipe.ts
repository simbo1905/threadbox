import { program, seq, inParallel, andThen, join, onFailureRetry, recover,
         alias, useTool, log } from "agent-dsl";

const runShell = alias<(cmd:string, args?:string[])=>Buffer>("runShell");
const callApi  = alias<(name:string, payload?:unknown)=>Promise<any>>("callApi");

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

