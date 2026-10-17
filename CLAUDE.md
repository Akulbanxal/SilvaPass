# SilvaPass Engineering Standards & Operating Guidelines

## Core Principles & Project Mission
SilvaPass is an evidence-backed plot-identity and shipment-integrity protocol developed for the IEEE ClimateChain Global Hackathon 2026.
The essential technical contribution is robust plot identity resolution combined with an enforceable shared claim invariant on-chain.
We value correctness, reproducibility, security, maintainability, and measurable outcomes. No vibe coding, no superficial dashboards, no fabricated capabilities, and no unverified mass code generation.

## Mandatory Engineering Rules
1. **Inspection & Verification**:
   - Inspect the repository and execution environment before making changes.
   - Never assume a file, dependency, API, endpoint, credential, deployment, or test result exists.
   - Run automated tests and static checks to verify all changes.
2. **Honesty & Transparency (No Hallucinations / Fakes)**:
   - Never fabricate environmental observations, benchmark numbers, transaction hashes, registry access, or test results.
   - Never describe an illustrative allowance as a scientifically verified agricultural yield.
   - Never claim that the prototype guarantees EUDR compliance or prevents claims outside the participating system.
   - Do not introduce fake AI. Any demo mode or deterministic fallback must be clearly labeled and identified.
   - When a dependency or external service fails, investigate the actual failure and implement a transparent fallback where appropriate; do not pretend it succeeded.
3. **Data Integrity & Security**:
   - Keep raw land coordinates, invoices, and sensitive documents off-chain. Only hashes, cryptographic commitments, and non-sensitive claim state go on-chain.
   - Validate all external inputs strictly on the backend using explicit schemas (e.g., Zod) and strong typing.
   - Store all credentials and secrets in environment variables (`.env`). Provide `.env.example` with sanitized/placeholder keys. Never commit secrets.
4. **Plot Identity Safeguards**:
   - Detect potentially duplicated plots even when submitted polygon coordinates have jitter, altered vertices, or coordinate transformations.
   - Require human/administrative review before ambiguous geographic matches are treated as identical or merged. Never auto-merge ambiguous plots without explicit safeguards.
5. **Technical Stack & Constraints**:
   - Node.js runtime with `npm` (never `bun`).
   - Do not require Docker.
   - Prefer simple, robust, well-tested components over speculative infrastructure.
   - Avoid unnecessary tokens, NFTs, microservices, complex AI agent frameworks, and extraneous blockchain layers.
   - Do not suppress failing tests or weaken assertions to make a build pass.
   - Do not rewrite unrelated files, run destructive commands, or alter Git history without explicit user permission.
   - Do not advance to later stages automatically without review and approval.

## Standard Development Workflow
For every task:
1. **Inspect** relevant code and documentation.
2. **State** a concise implementation plan.
3. **Define** expected behavior and acceptance criteria.
4. **Make** the smallest coherent implementation.
5. **Run** relevant automated tests and static checks.
6. **Inspect** the diff for unintended changes.
7. **Report** changed files, actual commands executed, actual results, known limitations, and remaining risks.
8. **Stop** and wait for next instruction.
