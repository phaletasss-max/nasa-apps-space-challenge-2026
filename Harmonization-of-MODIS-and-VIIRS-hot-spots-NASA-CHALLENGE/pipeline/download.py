"""
Download all FIRMS yearly global archives, the 7-day NRT files and reference layers.

No API key required. Resumable: files already complete (size matches the server)
are skipped. Usage:
    python pipeline/download.py            # everything
    python pipeline/download.py --nrt      # only refresh the 7-day NRT files
"""
import argparse
import concurrent.futures as cf
import sys
import time
import urllib.request

from config import FIRMS, FIRMS_NRT, FIRMS_YEARLY, NRT, REF, REFERENCE, SENSORS

UA = {"User-Agent": "FireCal/2.0 (NASA Space Apps 2026)"}


def remote_size(url):
    req = urllib.request.Request(url, method="HEAD", headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return int(r.headers.get("Content-Length", 0))


def fetch(url, dest, force=False):
    dest.parent.mkdir(parents=True, exist_ok=True)
    size = remote_size(url)
    if not force and dest.exists() and dest.stat().st_size == size:
        return f"skip {dest.name}"
    part = dest.with_suffix(dest.suffix + ".part")
    have = part.stat().st_size if part.exists() else 0
    headers = dict(UA)
    if have and have < size:
        headers["Range"] = f"bytes={have}-"
    else:
        have = 0
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as r, part.open("ab" if have else "wb") as fh:
                while chunk := r.read(1 << 20):
                    fh.write(chunk)
            break
        except Exception:  # network hiccup: resume from what we have
            if attempt == 4:
                raise
            time.sleep(5 * (attempt + 1))
            have = part.stat().st_size if part.exists() else 0
            headers = dict(UA, Range=f"bytes={have}-")
    if part.stat().st_size != size:
        raise IOError(f"size mismatch for {dest.name}: {part.stat().st_size} != {size}")
    part.replace(dest)
    return f"ok   {dest.name} ({size / 1e6:.0f} MB)"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--nrt", action="store_true", help="only refresh NRT 7-day files")
    args = ap.parse_args()

    jobs = [(url, NRT / f"{sensor}_global_7d.csv", True) for sensor, url in FIRMS_NRT.items()]
    if not args.nrt:
        jobs += [(url, REF / name, False) for name, url in REFERENCE.items()]
        for sensor, (y0, y1) in SENSORS.items():
            jobs += [(FIRMS_YEARLY.format(sensor=sensor, year=y), FIRMS / sensor / f"{y}.zip", False)
                     for y in range(y1, y0 - 1, -1)]  # newest first

    failed = 0
    with cf.ThreadPoolExecutor(max_workers=3) as pool:
        futs = {pool.submit(fetch, *job): job for job in jobs}
        for fut in cf.as_completed(futs):
            try:
                print(fut.result(), flush=True)
            except Exception as exc:
                failed += 1
                print(f"FAIL {futs[fut][1].name}: {exc}", flush=True)
    print("DONE" if not failed else f"DONE with {failed} failures", flush=True)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
