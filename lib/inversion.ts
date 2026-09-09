/**
 * Browser implementation of the approved direct-moment equations.
 * The scientific assets come from the frozen Python finite-element operators.
 * No fitting to reference curves, positivity clipping, or fallback alpha.
 *
 * Algebraically equivalent reduced system:
 * U = S^-1 K^T; G = K U; c = U (G + alpha I)^-1 g.
 * S is positive definite after elimination of the two endpoint coefficients.
 */
import assets from "./operators.json" with { type: "json" };

export type Input = { moments: number[]; errors: number[]; includeM0: boolean; seed: number };
type Matrix = number[][];
type System = { rows: number[]; k: Matrix; u: Matrix; gram: Matrix };
export type Fit = {
  alpha: number; central: number[]; moments: number[]; residuals: number[];
  R: number; mapping: Matrix; stationarity: number;
};
export type Result = Fit & {
  x: number[]; delta: number; ratio: number; normalization: number;
  sigma: number[]; closure: number[]; closureWidth: number[];
  innerLower: number[]; innerUpper: number[]; outerLower: number[]; outerUpper: number[];
};
export const metadata = assets.metadata;
export const norm = (v: number[]) => Math.hypot(...v);
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const zeros = (n: number, m: number): Matrix => Array.from({ length: n }, () => Array(m).fill(0));

export function cholesky(a: Matrix): Matrix {
  const n = a.length, l = zeros(n, n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let sum = a[i][j];
    for (let k = 0; k < j; k++) sum -= l[i][k] * l[j][k];
    if (i === j) {
      if (!(sum > 0) || !Number.isFinite(sum))
        throw new Error("The numerical system cannot be resolved at this precision. No substitute result was used.");
      l[i][j] = Math.sqrt(sum);
    } else l[i][j] = sum / l[j][j];
  }
  return l;
}
function solveFactor(l: Matrix, b: number[]): number[] {
  const n = b.length, y = Array(n).fill(0), x = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) sum -= l[i][k] * y[k];
    y[i] = sum / l[i][i];
  }
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let k = i + 1; k < n; k++) sum -= l[k][i] * x[k];
    x[i] = sum / l[i][i];
  }
  return x;
}
let fullU: Matrix | null = null;
const systems = new Map<string, System>();
function system(count: number, includeM0: boolean): System {
  const key = `${count}:${includeM0}`;
  const cached = systems.get(key);
  if (cached) return cached;
  if (!fullU) {
    const l = cholesky(assets.penalty);
    const columns = assets.kernel.map(row => solveFactor(l, row.slice(1, -1)));
    fullU = Array.from({ length: 99 }, (_, j) => columns.map(col => col[j]));
  }
  const rows = Array.from({ length: count + Number(includeM0) }, (_, i) => i + (includeM0 ? 0 : 1));
  const k = rows.map(r => assets.kernel[r].slice(1, -1));
  const u = fullU.map(row => rows.map(r => row[r]));
  const gram = rows.map((_, i) => rows.map((__, j) => dot(k[i], u.map(row => row[j]))));
  // Remove only round-off asymmetry; do not change any eigenvalue or add jitter.
  for (let i = 0; i < rows.length; i++) for (let j = 0; j < i; j++)
    gram[i][j] = gram[j][i] = (gram[i][j] + gram[j][i]) / 2;
  const result = { rows, k, u, gram };
  systems.set(key, result);
  return result;
}
export function validateInput(input: Input) {
  if (!Number.isInteger(input.moments.length) || input.moments.length < 1 || input.moments.length > 12)
    throw new Error("Enter between 1 and 12 consecutive moments, M₁ through Mₙ.");
  if (input.errors.length !== input.moments.length || input.moments.some(x => !Number.isFinite(x)))
    throw new Error("Each moment needs a finite numerical value.");
  if (input.errors.some(x => !Number.isFinite(x) || x <= 0))
    throw new Error("Enter a positive error for every measured moment. M₀ is the only zero-error input supported here.");
  if (typeof input.includeM0 !== "boolean" || ![0, 1, 2].includes(input.seed))
    throw new Error("Invalid normalization or sampling configuration.");
}
export function fitAtAlpha(input: Input, alpha: number): Fit {
  validateInput(input);
  if (!(alpha > 0) || !Number.isFinite(alpha)) throw new Error("Alpha must be finite and positive.");
  const sys = system(input.moments.length, input.includeM0);
  const g = input.includeM0 ? [1, ...input.moments] : [...input.moments];
  const l = cholesky(sys.gram.map((row, i) => row.map((v, j) => v + (i === j ? alpha : 0))));
  const z = solveFactor(l, g);
  const interior = sys.u.map(row => dot(row, z));
  const central = [0, ...interior, 0];
  const moments = sys.k.map(row => dot(row, interior));
  const residuals = moments.map((v, i) => v - g[i]);
  // U A^-1 = (A^-1 U^T)^T because A is symmetric.
  const mapping = [Array(g.length).fill(0), ...sys.u.map(row => solveFactor(l, row)), Array(g.length).fill(0)];
  const rhs = interior.map((_, j) => dot(sys.k.map(row => row[j]), g));
  const gradient = interior.map((_, j) =>
    dot(sys.k.map(row => row[j]), residuals) + alpha * dot(assets.penalty[j], interior));
  return { alpha, central, moments, residuals, R: norm(residuals), mapping,
    stationarity: norm(gradient) / Math.max(norm(rhs), 1e-30) };
}
export function selectAlpha(input: Input): Fit {
  validateInput(input);
  const delta = norm(input.errors);
  let lo = Math.log(1e-12), hi = Math.log(1e4);
  const bottom = fitAtAlpha(input, Math.exp(lo));
  const top = fitAtAlpha(input, Math.exp(hi));
  if (!(bottom.R < delta && top.R > delta)) {
    throw new Error(`No discrepancy crossing in α ∈ [10⁻¹², 10⁴]. R(low) = ${bottom.R.toPrecision(4)}, δ = ${delta.toPrecision(4)}, R(high) = ${top.R.toPrecision(4)}. Check the input errors and conventions. No fallback curve is shown.`);
  }
  let selected = bottom;
  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2;
    selected = fitAtAlpha(input, Math.exp(mid));
    if (Math.abs(selected.R / delta - 1) < 1e-11) break;
    if (selected.R < delta) lo = mid; else hi = mid;
  }
  if (Math.abs(selected.R / delta - 1) > 1e-6 || selected.stationarity > 1e-9)
    throw new Error("The numerical verification tolerance was not met. No uncertified curve is shown.");
  return selected;
}
export function reconstruct(input: Input): Result {
  const fit = selectAlpha(input);
  const count = input.moments.length, offset = Number(input.includeM0);
  const sampleCov = assets.sampleCovariances[input.seed];
  const sigma = fit.mapping.map(row => {
    const b = input.errors.map((s, j) => row[j + offset] * s);
    let variance = 0;
    for (let i = 0; i < count; i++) for (let j = 0; j < count; j++)
      variance += b[i] * sampleCov[i][j] * b[j];
    if (variance < -1e-15) throw new Error("Invalid propagated variance.");
    return Math.sqrt(Math.max(0, variance));
  });
  const moments = Array.from({ length: count }, (_, power) => {
    let integral = 0;
    for (let j = 0; j < 100; j++) {
      const x0 = assets.nodes[j], x1 = assets.nodes[j + 1];
      integral += (x1 - x0) / 2 * (fit.central[j] * x0 ** power + fit.central[j + 1] * x1 ** power);
    }
    return integral;
  });
  const closure = fitAtAlpha({ ...input, moments }, fit.alpha).central;
  const closureWidth = fit.central.map((v, i) => Math.abs(v - closure[i]));
  const innerLower = fit.central.map((v, i) => v - sigma[i]);
  const innerUpper = fit.central.map((v, i) => v + sigma[i]);
  return {
    ...fit, x: [...assets.nodes], delta: norm(input.errors), ratio: fit.R / norm(input.errors),
    normalization: dot(assets.kernel[0], fit.central),
    sigma, closure, closureWidth, innerLower, innerUpper,
    outerLower: innerLower.map((v, i) => v - closureWidth[i]),
    outerUpper: innerUpper.map((v, i) => v + closureWidth[i]),
  };
}
