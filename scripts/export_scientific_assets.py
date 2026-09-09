"""Export public numerical assets without altering the frozen Python baseline.

Run with ../gpd_inverse/.venv/bin/python scripts/export_scientific_assets.py.
"""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np

PROJECT = Path(__file__).resolve().parents[1]
IP = PROJECT.parent
sys.path.insert(0, str(IP / "gpd_inverse"))
from gpd_inverse.mellin_tikhonov_v1 import build_operators, load_approved_method
from gpd_inverse.pion_six_moment import (
    MILLER_2026_PION, MILLER_2026_KAON_U, MILLER_2026_KAON_S, source_beta_curve,
)

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n")

def main():
    load_approved_method()
    ops = build_operators(12)
    presets, covariances, fixtures = [], [], []
    names = ["Pion · up", "Kaon · up", "Kaon · strange"]
    colors = ["#126c83", "#13836f", "#995076"]
    for seed, data in enumerate((MILLER_2026_PION, MILLER_2026_KAON_U, MILLER_2026_KAON_S)):
        directory = IP / f"gpd_inverse/output/pdf_reference_results/Mellin_Tikhonov_v1/reference_1_{data.key}"
        saved = np.load(directory / "reconstruction.npz")
        record = json.loads((directory / "verification.json").read_text())
        for path, expected in record["actual_implementation"]["code_revision_or_hashes"].items():
            if hashlib.sha256(Path(path).read_bytes()).hexdigest() != expected:
                raise ValueError(f"Saved Python result no longer matches source: {path}")
        rng = np.random.Generator(np.random.MT19937(seed))
        draws = rng.standard_normal((500, 6))
        np.testing.assert_allclose(
            data.moments[:, None] + data.errors[:, None] * draws.T,
            saved["input_samples"][1:], rtol=1e-13, atol=1e-14)
        extended = np.column_stack((draws, rng.standard_normal((500, 6))))
        # Linear propagation of this sample covariance is equivalent to solving
        # all 500 Gaussian replicas, including their finite-sample fluctuations.
        covariances.append(np.cov(extended, rowvar=False, ddof=1).tolist())
        presets.append({
            "id": data.key, "name": names[seed], "color": colors[seed], "seed": seed,
            "moments": data.moments.tolist(), "errors": data.errors.tolist(),
            "errorComponents": data.uncertainty_components.tolist(),
            "referenceCurve": source_beta_curve(ops.nodes, data.beta_alpha, data.beta_beta).tolist(),
            "savedCurve": saved["central"].tolist(),
            "alpha": float(saved["alpha"]), "beta": [data.beta_alpha, data.beta_beta],
        })
        fixtures.append({
            "id": data.key, "alpha": float(saved["alpha"]),
            "central": saved["central"].tolist(), "sigma": saved["sample_std"].tolist(),
            "closure": saved["closure_curve"].tolist(),
            "innerLower": saved["inner_lower"].tolist(), "outerLower": saved["outer_lower"].tolist(),
            "moments": record["actual_implementation"]["back_projected_moments"],
        })
    write(PROJECT / "lib/presets.json", presets)
    write(PROJECT / "lib/operators.json", {
        "nodes": ops.nodes.tolist(), "kernel": ops.kernel.tolist(),
        "penalty": ops.penalty[np.ix_(ops.free, ops.free)].tolist(),
        "sampleCovariances": covariances,
        "metadata": {
            "method": "Mellin_Tikhonov_v1", "nodeCount": 101, "replicas": 500,
            "approvedConfigSHA256": hashlib.sha256(
                (IP / "Mellin_Tikhonov_v1/approved_method.json").read_bytes()).hexdigest(),
            "source": "Miller et al., arXiv:2606.28102v1, Tables 5 and 6",
            "sourceURL": "https://arxiv.org/abs/2606.28102",
            "scale": "MSbar, mu = 2 GeV", "ddof": 1,
            "note": "Preset bands match the 500 fixed-alpha Python replicas. Custom inputs are exploratory.",
        },
    })
    write(PROJECT / "tests/python-reference.json", fixtures)
    print("Exported exact operators, presets, replica covariance and Python fixtures.")

if __name__ == "__main__":
    main()
