"""Unit tests for the FireCal science core. Run: .venv/Scripts/python -m pytest tests -q"""
import struct
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from calibrate import Hierarchy, fit_levels, metrics, weights  # noqa: E402
from export import NM, TERRA_ONLY_LAST, bh_fdr, harmonize, mann_kendall_sen, write_tile  # noqa: E402
from config import SWITCH_MONTH, FIRST_MONTH  # noqa: E402
from nrt import poisson_upper  # noqa: E402

NX = 1440


def test_shrinkage_limits():
    """Huge alpha -> parent factor; zero alpha -> raw local ratio."""
    ids = np.array([100 * NX + 100, 100 * NX + 101, 300 * NX + 900])
    H = Hierarchy(ids, np.array([7, 7, 1]), np.array([4, 4, 5]))
    Mc = np.zeros((3, 26, 12)); Vc = np.zeros((3, 26, 12))
    Mc[:, 13, :] = [[10], [10], [5]]
    Vc[:, 13, :] = [[40], [20], [25]]
    SM, SV = H.sums(Mc), H.sums(Vc)
    w = weights([2013])
    k0, k1, k2, k3 = fit_levels(SM, SV, w, 1e9, H)
    assert np.allclose(k0, 85 / 25)
    assert np.allclose(k3, k0[None])            # everything collapses to the global ratio
    k0, k1, k2, k3 = fit_levels(SM, SV, w, 1e-9, H)
    unit_of = H.i3
    assert np.allclose(k3[unit_of[0]], 60 / 20)  # cells 0,1 share a 2.5° block and stratum
    assert np.allclose(k3[unit_of[2]], 25 / 5)


def test_harmonize_rules():
    M = np.full((1, NM), 10, np.float32)
    V = np.full((1, NM), 30, np.uint16)
    k = np.full((1, 12), 2.0, np.float32)
    r = np.full((1, 12), 1.5, np.float32)
    H = harmonize(M, V, k, r)[0]
    assert np.all(H[:FIRST_MONTH] == 0)
    assert np.allclose(H[FIRST_MONTH:TERRA_ONLY_LAST + 1], 10 * 1.5 * 2)     # Terra-only: r·k
    assert np.allclose(H[TERRA_ONLY_LAST + 1:SWITCH_MONTH], 10 * 2)          # Terra+Aqua: k
    assert np.allclose(H[SWITCH_MONTH:], 30)                                  # VIIRS as-is


def test_mann_kendall_sen():
    t = np.arange(25, dtype=np.float64)
    A = np.stack([3 * t + 5, -2 * t, np.ones(25)])
    slope, p = mann_kendall_sen(A)
    assert np.allclose(slope, [3, -2, 0])
    assert p[0] < 1e-6 and p[1] < 1e-6 and p[2] == pytest.approx(1.0)


def test_bh_fdr():
    p = np.array([0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205, 0.212, 0.216])
    assert bh_fdr(p, 0.05).tolist() == [True, True] + [False] * 8


def test_poisson_upper():
    assert poisson_upper(0, 3) == 1.0
    assert poisson_upper(1, 2.0) == pytest.approx(1 - np.exp(-2))
    assert poisson_upper(100, 100) == pytest.approx(0.5, abs=0.05)


def test_metrics_bias():
    m = metrics(np.array([10, 20, 30]), np.array([11, 22, 33]))
    assert m["bias_pct"] == pytest.approx(10)
    assert m["mae"] == pytest.approx(2)


def test_tile_roundtrip(tmp_path):
    """Binary tile written by export.write_tile decodes to the same values (layout used by app/src/lib/data.ts)."""
    ids = np.array([5, 9, 12], np.int64)
    M = np.zeros((3, NM), np.uint16); V = np.zeros((3, NM), np.uint16)
    M[0, 20] = 3; V[0, 200] = 7; M[2, 150] = 1; V[2, 150] = 4
    k = np.arange(4 * 12, dtype=np.float32).reshape(4, 12)
    country = np.array([1, 2, 3], np.int16)
    path = tmp_path / "t.bin"
    cells = np.array([0, 2])
    write_tile(path, cells, np.array([0, 1]), np.array([1, 3]), k, k + 100, k + 200, k + 300, ids, country, M, V)
    b = path.read_bytes()
    assert b[:4] == b"FCT2"
    nU, nC, nnz = struct.unpack_from("<III", b, 4)
    assert (nU, nC, nnz) == (2, 2, 3)
    o = 16
    units = np.frombuffer(b, "<f4", nU * 48, o); o += nU * 48 * 4
    assert np.allclose(units[:12], k[1]) and np.allclose(units[48 + 36:48 + 48], k[3] + 300)
    cid = np.frombuffer(b, "<u4", nC, o); o += nC * 4
    unit = np.frombuffer(b, "<u4", nC, o); o += nC * 4
    ctry = np.frombuffer(b, "<i4", nC, o); o += nC * 4
    offs = np.frombuffer(b, "<u4", nC + 1, o); o += (nC + 1) * 4
    months = np.frombuffer(b, "<u2", nnz, o); o += nnz * 2
    mv = np.frombuffer(b, "<u2", nnz, o); o += nnz * 2
    vv = np.frombuffer(b, "<u2", nnz, o); o += nnz * 2
    assert o == len(b)
    assert cid.tolist() == [5, 12] and unit.tolist() == [0, 1] and ctry.tolist() == [1, 3]
    assert offs.tolist() == [0, 2, 3]
    assert months.tolist() == [20, 200, 150] and mv.tolist() == [3, 0, 1] and vv.tolist() == [0, 7, 4]
