"""The least walked spot in every country and in the states and provinces of the largest countries.

For each area: the land cell with the highest score. Ties go to the cell farthest from a way in.
Reads data/world.png, data/names.png, data/names.json, the build grid (grid.npz, for the distance
to the nearest way in) and Natural Earth's 50m states and provinces file. Writes data/spots.json.

    python tools/spots.py path/to/grid.npz path/to/ne_50m_admin_1_states_provinces.geojson
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw

W, H = 4096, 2048

def main(grid_path, admin_path):
    world = np.asarray(Image.open("data/world.png"))
    score = (world[..., 0].astype(np.float32) - 1) / 2.54
    land = world[..., 0] > 0
    g = np.load(grid_path)
    way = g["A"]                                   # km to the nearest way in
    nt = np.asarray(Image.open("data/names.png").convert("RGBA"))
    names = json.load(open("data/names.json"))
    cidx = nt[..., 0].astype(np.int32) | ((nt[..., 2].astype(np.int32) >> 4) << 8)
    ridx = nt[..., 1].astype(np.int32) | ((nt[..., 2].astype(np.int32) & 15) << 8)
    ny, nx = nt.shape[:2]
    cfull = np.repeat(np.repeat(cidx, H // ny, 0), W // nx, 1)
    rfull = np.repeat(np.repeat(ridx, H // ny, 0), W // nx, 1)
    lat = 90 - (np.arange(H) + 0.5) * 180 / H
    lon = -180 + (np.arange(W) + 0.5) * 360 / W
    area = np.cos(np.radians(lat))[:, None] * (40075 / W) ** 2 * np.ones((1, W))

    def best(mask):
        m = mask & land
        if m.sum() < 4: return None
        s = np.where(m, score, -1)
        top = s.max()
        cand = (s >= top - 0.5) & m                # the top score, give or take half a point
        w = np.where(cand, way, -1)
        y, x = np.unravel_index(np.argmax(w), w.shape)
        return {"lat": round(float(lat[y]), 3), "lon": round(float(lon[x]), 3), "score": int(round(float(score[y, x]))),
                "km": int(round(float(way[y, x]))), "at": names["r"][rfull[y, x]] if rfull[y, x] < len(names["r"]) else "",
                "orange": round(float(100 * area[m & (score >= 50)].sum() / area[m].sum()), 1),
                "land_km2": int(round(float(area[m].sum()), -2))}

    out = {"countries": [], "states": []}
    for i, name in enumerate(names["c"]):
        if not name: continue
        b = best(cfull == i)
        if b and b["land_km2"] >= 1000: out["countries"].append(dict(name=name, **b))
    admin = json.load(open(admin_path))
    keep = {"United States of America": "United States", "Canada": "Canada", "Australia": "Australia", "Brazil": "Brazil",
            "Russia": "Russia", "China": "China", "India": "India"}
    for f in admin["features"]:
        p = f["properties"]
        if p.get("admin") not in keep: continue
        im = Image.new("1", (W, H)); d = ImageDraw.Draw(im)
        geom = f["geometry"]; polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        for poly in polys:
            px = lambda ring: [((lo + 180) / 360 * W, (90 - la) / 180 * H) for lo, la in ring]
            d.polygon(px(poly[0]), fill=1)
            for hole in poly[1:]: d.polygon(px(hole), fill=0)
        b = best(np.asarray(im))
        if b: out["states"].append(dict(name=p["name"], country=keep[p["admin"]], code=p.get("iso_3166_2") or "", **b))
    out["countries"].sort(key=lambda r: r["name"]); out["states"].sort(key=lambda r: (r["country"], r["name"]))
    json.dump(out, open("data/spots.json", "w"), separators=(",", ":"), ensure_ascii=False)
    print(len(out["countries"]), "countries,", len(out["states"]), "states")
    for n in ["Nebraska", "Alaska", "Texas", "Nevada", "Hawaii", "California", "Nunavut", "Western Australia"]:
        print([s for s in out["states"] if s["name"] == n])
    for n in ["United States of America", "United States", "Iceland", "Algeria", "Netherlands", "Greenland", "Antarctica"]:
        print([s for s in out["countries"] if s["name"] == n])

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
