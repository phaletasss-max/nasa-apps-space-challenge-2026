"""Reproduce FireCal end to end: download -> ingest -> strata -> calibrate -> export (+ NRT).

    python pipeline/run_all.py            # ~7 GB download on first run, ~10 min of processing afterwards
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STEPS = ["download.py", "ingest.py", "strata.py", "calibrate.py", "export.py"]

for step in STEPS:
    print(f"\n=== {step} ===", flush=True)
    subprocess.run([sys.executable, str(HERE / step)], cwd=HERE, check=True)
