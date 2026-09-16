MELLIN LABS
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
  - Each new input vector starts at alpha_star selected by R=delta for M+S.
  - Exploration v2: vary alpha/alpha_star on a log slider with a configurable
    half-window of 0.5 to 4 decades. Independent mass and stiffness coefficients
    span 0.001 to 1000; either may also be switched off (not both).
    alpha_star is NOT retuned after these controls change. Reset restores the
    baseline. Moment input edits also reset tuning. Modified curves are labeled
    exploratory; discrepancy success is reported only when actually satisfied.
    No positivity threshold, clipping or normalization rescaling is used.
  - Pin a curve; toggle both uncertainty envelopes and the paper comparison.
  - Export a plot, .dat/CSV values, or a JSON calculation record.
  - Download standalone Python, MATLAB or Mathematica code with current inputs,
    controls, analytic operators and replica sample covariance embedded.
    All languages recompute alpha_star and the curve; no central curve is hardcoded.
    Python executes against browser central curves and both bands (<1e-9) and an
    independent augmented least-squares check. MATLAB and Mathematica are supplied
    as runtime-untested ports. Requires NumPy for Python; Matplotlib is optional.
  - Copy a URL fragment containing the current settings. No input is sent to
    a calculation server. Sharing access is governed by the hosting platform.

Method
  f=xq_v on 101 nodes, with zero endpoint coefficients, unit residual weights,
  consistent H1 mass+stiffness penalty, and R=delta to relative tolerance 1e-6.
  The browser solves the algebraically equivalent reduced system
    P=beta_M M+beta_S S; U=P^-1 K^T; G=KU; c=U(G+alpha I)^-1 g.
  Here S denotes stiffness only. The frozen method uses S for the combined
  mass+stiffness penalty. Baseline beta_M=beta_S=1 uses the unchanged frozen matrix.
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
  This project is a web application, not a PDF or a single HTML file to double-click.
  In Terminal:
    cd /Users/raj/Dropbox_Local/2026/IP/mellin-lab
    npm run dev -- --host 127.0.0.1
  Keep Terminal running and open http://localhost:3000/ in Safari, Chrome or Firefox.
  Use the Local URL printed by the server if port 3000 is already occupied.
  Press Control-C in that Terminal to stop the local server.
  The local folder name is retained so existing paths continue to work.
  Public branding and download names are Mellin Labs / mellin-labs.
  Renaming the page does not rename a public host domain.

Developer commands
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
  tests/source.test.ts: exported Python reproduction and independent QR checks.
    Set MELLIN_TEST_PYTHON to a NumPy Python if the parent virtualenv is absent.
  lib/source-downloads.ts: self-contained source templates and data embedding.

GitHub Pages
  Suggested repository name: mellin-labs.
  npm run build:pages produces a standalone static site in dist-pages/.
  The .github/workflows/pages.yml workflow checks the project and publishes
  automatically whenever the main branch is updated (and can also be run
  manually). In the repository's Settings → Pages, choose GitHub Actions as
  the source the first time. The resulting address is normally
  https://<your-github-name>.github.io/mellin-labs/.
  Do not upload the parent research directory; upload only THIS directory.
  No GitHub repository has been created automatically.

Privacy / scope
  No analytics, external data API, paid API, or persistent input database.
  Only public source moments and scientific assets are included.
  No website implementation or test certifies that finite moments uniquely
  determine a physical PDF.
