MELLIN LAB
An interactive PDF inversion workbench

Default examples: Reference 1 pion-up, kaon-up, kaon-strange, from Miller
et al., arXiv:2606.28102v1, Tables 5 and 6. These reproduce the frozen
Mellin_Tikhonov_v1 results and both uncertainty bands.

The parent scientific workspace is untouched. Only this directory is intended
for deployment or a standalone Git repository.

Controls
  - 1 to 12 consecutive moments M1,...,MN and their marginal errors.
  - Include M0=1 as a residual row (default), or explicitly omit it.
    This is NOT an exact normalization constraint.
  - Sliders vary each moment about its entered value, initially +/-3 errors.
  - Alpha always follows the discrepancy condition. There is no manual
    alternative, positivity threshold, clipping or normalization rescaling.
  - Pin a curve; toggle both uncertainty envelopes and the paper comparison.
  - Export a plot, CSV values, or a JSON calculation record.
  - Copy a URL fragment containing the current settings. No input is sent to
    a calculation server. Sharing access is governed by the hosting platform.

Method
  f=xq_v on 101 nodes, with zero endpoint coefficients, unit residual weights,
  consistent H1 mass+stiffness penalty, and R=delta to relative tolerance 1e-6.
  The browser solves the algebraically equivalent reduced system
    U=S^-1 K^T; G=KU; c=U(G+alpha I)^-1 g.
  An independent stationarity check guards the numerical solution.

  Fixed-alpha bands are computed with the sample covariance of the same 500
  Gaussian draws used in the Python presets. Propagating that sample covariance
  through the linear map is equivalent to calculating each of those 500 curves
  and their pointwise sample standard deviation (denominator 499).
  This sample covariance is NOT a published lattice cross-moment covariance.

  The outer half-width adds abs(central - fixed-alpha reinversion), with
  trapezoidal recomputation of the measured moments. It is not a complete
  systematic uncertainty or a bias bound.

  Only unedited presets are identified as Python-verified Reference 1 results.
  Custom inputs and omitted normalization are exploratory; their source,
  physical convention and scale are the user's responsibility.

Local use (Node 24 or newer)
  npm ci
  npm run dev
  npm test
  npm run typecheck
  npm run lint
  npm run build

Numerical provenance
  lib/operators.json: exact exported finite-element operators, sample
    covariances and frozen-method configuration hash.
  lib/inversion.ts: browser solver.
  scripts/export_scientific_assets.py: export from the parent Python project.
  tests/python-reference.json: saved Python reference curves and bands.
  tests/inversion.test.ts: Python agreement and edge-case tests.
  tests/session.test.ts: sliders, missing values and share-state validation.

GitHub Pages
  npm run build:pages produces a standalone static site in dist-pages/.
  The optional .github/workflows/pages.yml is manual-trigger only. It is ready
  for a repository rooted in THIS directory, with Pages configured to deploy
  using GitHub Actions. No GitHub repository has been created automatically.
  Do not upload the parent research directory.

Privacy / scope
  No analytics, external data API, paid API, or persistent input database.
  Only public source moments and scientific assets are included.
  No website implementation or test certifies that finite moments uniquely
  determine a physical PDF.
