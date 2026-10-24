# hw_ts_parametricSequencer

TypeScript library of the Parametric Sequencer backend: scene model, keyframe and animation-state reconciliation, scene JSON schema (zod) and scene loading. The website (`/Users/martin/projects/website`) consumes it as the git dependency `hw-ts-parametric-sequencer`; the Odin backend in `/Users/martin/projects/hw_parametricSequencer` must match its output (equivalence tests live there).

- Public API is `src/index.ts`; consumers import only from the package root. No website path aliases, no Svelte, no DOM.
- `npm run check` type-checks, `npm test` runs vitest in Node, `npm run build` emits `dist/` (also run by `prepare` on git install).
- Pin a change in the website by committing and pushing here, then updating its dependency commit.
