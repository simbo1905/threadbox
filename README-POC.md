Commands (PoC workflow)

1) Author lint/typecheck

    just dsl-check-author examples/risk_pipe.ts

2) Transpile

    just dsl-transpile examples/risk_pipe.ts ./.tmp/risk_pipe.gen.ts

3) Generated lint/typecheck

    just dsl-check-generated ./.tmp/risk_pipe.gen.ts

4) Run unit tests

    just test
