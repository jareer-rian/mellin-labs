# Mellin Lab

This is a web port, not a modification of the approved research pipeline.
Parent AGENTS.md remains in force. Do not edit the frozen method or saved results.

- Default: M0=1 as a unit-weight residual row, not an equality; W=I;
  101 linear-hat nodes; fixed zero endpoint coefficients; H1 mass+stiffness;
  no positivity; discrepancy selection R=delta, relative tolerance 1e-6.
- Custom inputs, omitted M0 and counts other than the six-moment presets are
  explicitly exploratory, as requested for this web interface. They must never
  be silently labeled as approved lattice results.
- User-authorized Mellin_Lab_exploration_v2 controls may vary alpha and the mass
  and stiffness coefficients independently. Keep these separate from the frozen
  baseline: alpha_star always refers to the M+S discrepancy root for current inputs.
  Reset restores alpha=alpha_star and both coefficients=1. Never call a manual
  curve discrepancy-selected or approved. No fallback roots, clipping, or rescaling.
- Reference curves are overlays only, never used by the inverse.
- Run `npm test` and `npm run typecheck` after numerical/interface changes.
- The reduced system in lib/inversion.ts is algebraically equivalent to the
  Python normal equations. The tests compare central curves and both uncertainty
  bands with saved Python outputs at <1e-9 absolute tolerance.
- Replica sample covariances reproduce the same 500-draw sample standard
  deviations through the linear sensitivity matrix; they are not an inferred
  lattice covariance matrix.
- Build hosted Sites with `npm run build`; build static GitHub Pages assets with
  `npm run build:pages`. Never publish the parent research workspace.
