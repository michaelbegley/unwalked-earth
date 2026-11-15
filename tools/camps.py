"""Known camps on the Greenland ice sheet that the build had no record of.

Each one counts as a way in, the same way a station does: the distance to it replaces the
distance to the nearest way in wherever it is shorter, and the score can only go down.
Rewrites data/world.png and the totals in data/meta.json, and saves the grid again.

    python tools/camps.py path/to/grid.npz
"""
import json, sys
import numpy as np
from PIL import Image

CAMPS = [  # lat, lon, name, years, source
    (78.07, -38.48, "North Ice", "1952 to 1954", "https://en.wikipedia.org/wiki/North_Ice"),
    (77.45, -51.06, "NEEM", "2007 to 2012", "https://neem.dk/about_neem/"),
    (65.18, -43.83, "Dye 3", "1960 to 1991", "https://en.wikipedia.org/wiki/Dye_3"),
    (71.18, -39.93, "Eismitte", "1930 to 1931", "https://en.wikipedia.org/wiki/Eismitte"),
    (77.17, -61.13, "Camp Century", "1959 to 1967", "https://en.wikipedia.org/wiki/Camp_Century"),
]

def main(grid_path):
    g = dict(np.load(grid_path)); S = g["S"].astype(np.float64); A = g["A"].astype(np.float64); land = g["land"]; H, W = S.shape
    world = np.asarray(Image.open("data/world.png")).copy()
    assert np.abs(np.where(land, np.clip(np.round(S * 2.54) + 1, 1, 255), 0) - world[..., 0]).max() <= 1, "grid and world.png differ"
    lat = np.radians(90 - (np.arange(H) + 0.5) * 180 / H)[:, None]; lon = np.radians(-180 + (np.arange(W) + 0.5) * 360 / W)[None, :]
    d = np.full((H, W), 1e9)
    for la, lo, *_ in CAMPS:
        la, lo = np.radians(la), np.radians(lo)
        h = np.sin((lat - la) / 2) ** 2 + np.cos(lat) * np.cos(la) * np.sin((lon - lo) / 2) ** 2
        d = np.minimum(d, 2 * 6371 * np.arcsin(np.sqrt(h)))
    L = 80.0; reach = lambda a: 1 - np.exp(-(a / L) ** 1.2)
    m = land & (d < A)
    r0 = reach(A[m]); fac = np.where(r0 > 1e-3, np.clip(S[m] / (100 * np.maximum(r0, 1e-9)), 0, 1), 0)
    S1 = np.minimum(S[m], np.where(r0 > 1e-3, fac * 100 * reach(d[m]), S[m]))
    w = np.cos(lat) * np.ones((1, W))
    before = (w * (land & (S >= 50))).sum()
    S[m] = S1; A[m] = d[m]
    print("cells changed", int(m.sum()), "| orange area change %.2f%%" % (100 * ((w * (land & (S >= 50))).sum() / before - 1)))
    which = np.zeros((H, W), np.uint8); which[g["iy"], g["ix"]] = g["which"]; which[m] = 1
    g["which"] = which[g["iy"], g["ix"]]; g["S"] = S.astype(np.float32); g["A"] = A.astype(np.float32)
    np.savez_compressed(grid_path, **g)
    world[..., 0] = np.where(land, np.clip(np.round(S * 2.54) + 1, 1, 255), 0)
    world[..., 1] = np.clip(np.round(np.sqrt(A) * 8), 0, 255)
    world[..., 2] = (world[..., 2] & ~np.uint8(3)) | which
    Image.fromarray(world).save("data/world.png", optimize=True)
    a = w[land]; s = S[land]; la = np.degrees(lat * np.ones((1, W)))[land]
    meta = json.load(open("data/meta.json"))
    meta["cum"] = [round(100 * a[s >= t].sum() / a.sum(), 2) for t in range(101)]
    meta["cumx"] = [round(100 * a[(s >= t) & (la > -60)].sum() / a[la > -60].sum(), 2) for t in range(101)]
    json.dump(meta, open("data/meta.json", "w"), separators=(",", ":"))
    print("50+ of land: %.2f%%, without Antarctica %.2f%%" % (meta["cum"][50], meta["cumx"][50]))

if __name__ == "__main__":
    main(sys.argv[1])
