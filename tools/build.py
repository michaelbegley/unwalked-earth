import json, math, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree
from scipy import ndimage as ndi

D = 'source/'
W, H = 4096, 2048
R_EARTH = 6371.0

def load(n):
    return json.load(open(D + n + '.geojson'))['features']

def polys(feats):
    for f in feats:
        g = f['geometry']
        if not g: continue
        if g['type'] == 'Polygon': yield f, g['coordinates']
        elif g['type'] == 'MultiPolygon':
            for p in g['coordinates']: yield f, p

def lines(feats):
    for f in feats:
        g = f['geometry']
        if not g: continue
        if g['type'] == 'LineString': yield g['coordinates']
        elif g['type'] == 'MultiLineString':
            for l in g['coordinates']: yield l

def to_px(ring):
    return [((x + 180) / 360 * W, (90 - y) / 180 * H) for x, y, *_ in ring]

def raster(feats, base=None):
    im = Image.new('L', (W, H), 0) if base is None else base
    d = ImageDraw.Draw(im)
    for f, p in polys(feats):
        d.polygon(to_px(p[0]), fill=1)
        for hole in p[1:]:
            d.polygon(to_px(hole), fill=0)
    return im

def densify(ls, step=0.04):
    out = []
    for l in ls:
        a = np.asarray([c[:2] for c in l], float)
        if len(a) < 2:
            out.append(a); continue
        seg = np.diff(a, axis=0)
        n = np.maximum(1, np.ceil(np.abs(seg).max(axis=1) / step)).astype(int)
        for i in range(len(seg)):
            t = np.arange(n[i])[:, None] / n[i]
            out.append(a[i] + t * seg[i])
        out.append(a[-1:])
    return np.vstack(out)

def xyz(lon, lat):
    lo, la = np.radians(lon), np.radians(lat)
    return np.c_[np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)]

print('rasterizing'); sys.stdout.flush()
land_f = load('ne_10m_land') + load('ne_10m_minor_islands')
shelf_f = load('ne_10m_antarctic_ice_shelves_polys')
land = np.array(raster(land_f)) > 0
shelf = np.array(raster(shelf_f)) > 0
lakes = np.array(raster([f for f in load('ne_10m_lakes') if (f['properties'].get('scalerank') or 9) <= 3])) > 0
ice = (np.array(raster(load('ne_10m_glaciated_areas'))) > 0) | shelf
land = (land | shelf) & ~lakes
ice &= land

lat = 90 - (np.arange(H) + 0.5) * 180 / H
lon = -180 + (np.arange(W) + 0.5) * 360 / W
LON, LAT = np.meshgrid(lon, lat)
idx = np.where(land)
P = xyz(LON[idx], LAT[idx])
print('land cells', len(P)); sys.stdout.flush()

def dist(points_lonlat):
    t = cKDTree(xyz(points_lonlat[:, 0], points_lonlat[:, 1]))
    d, i = t.query(P, workers=-1)
    return 2 * R_EARTH * np.arcsin(np.clip(d / 2, 0, 1)), i

# sources
roads = densify(list(lines(load('ne_10m_roads'))) + list(lines(load('ne_10m_railroads'))))
print('road pts', len(roads))
import csv
cities = []
names = []
for r in csv.DictReader(open('source/cities.tsv'), delimiter='\t', quoting=csv.QUOTE_NONE):
    cities.append((float(r['lon']), float(r['lat']))); names.append((r['name'], r['country'], int(r['pop'] or 0)))
for f in load('ne_10m_populated_places_simple'):
    x, y = f['geometry']['coordinates'][:2]
    cities.append((x, y)); names.append((f['properties']['name'], f['properties'].get('iso_a2') or '', int(f['properties'].get('pop_max') or 0)))
for n in ('ne_10m_airports', 'ne_10m_ports'):
    for f in load(n):
        x, y = f['geometry']['coordinates'][:2]
        cities.append((x, y)); names.append((f['properties'].get('name') or n, '', 0))
# places confirmed by the 11 Nov 2026 fact check that the source lists miss
for nm, cc, x, y in [('Plateau Station (closed 1969)', 'AQ', 40.5, -79.25), ('Moomba', 'AU', 140.203, -28.108), ('Byrd Station (closed 2005)', 'AQ', -119.5656, -80.0147), ('Veladero mine', 'AR', -69.895, -29.4092), ('EastGRIP camp', 'GL', -35.9829, 75.6332)]:
    cities.append((x, y)); names.append((nm, cc, 0))
towns = np.array(cities)
print('town pts', len(towns))
rivers = densify(list(lines(load('ne_10m_rivers_lake_centerlines'))) + list(lines(load('ne_10m_rivers_north_america'))) + list(lines(load('ne_10m_rivers_europe'))))
coast_l = []
for f, p in polys(land_f):
    coast_l.append(p[0])
# Antarctic coast = the seaward edge of land+shelf; take it from the raster instead
coast_all = densify(coast_l)
north = coast_all[coast_all[:, 1] > -60]
edge = land & ~ndi.binary_erosion(land)
e = np.where(edge & (LAT < -60))
coast = np.vstack([north, np.c_[LON[e], LAT[e]]])
print('river pts', len(rivers), 'coast pts', len(coast)); sys.stdout.flush()

d_road, _ = dist(roads)
d_town, i_town = dist(towns)
d_river, _ = dist(rivers)
d_coast, _ = dist(coast)
print('distances done'); sys.stdout.flush()

# rasters sampled to grid
def samp(name, mode):
    return np.asarray(Image.open(D + name).convert(mode).resize((W, H), Image.BILINEAR), float)
elev = samp('earth-topology.png', 'L') * 25.0            # ~metres
night = samp('earth-night.jpg', 'RGB')
bm = samp('earth-blue-marble.jpg', 'RGB')
rug = ndi.generic_filter(elev[::2, ::2], np.std, size=5)
rug = np.asarray(Image.fromarray(rug.astype('float32')).resize((W, H), Image.BILINEAR))
lights = np.clip(night[..., 0] - 40, 0, None)
lights = ndi.maximum_filter(lights, size=5)
barren = (bm[..., 0] > 150) & (bm[..., 0] - bm[..., 2] > 40) & (np.abs(LAT) < 52)

la = LAT[idx]; el = elev[idx]; ic = ice[idx]; ba = barren[idx] & ~ic; rg = rug[idx]; li = lights[idx]
ant = la < -60

# ---- access distance: how far from the nearest way in ----
coast_eff = np.where(ant, 2.0 * d_coast + 40, 1.3 * d_coast + 15)
river_eff = 1.3 * d_river + 15
river_eff = np.where(ic, 1e9, river_eff)        # a river line under an ice sheet is not a way in
access = np.minimum.reduce([d_road, d_town, coast_eff, river_eff])
which = np.argmin(np.stack([d_road, d_town, coast_eff, river_eff]), axis=0)

# ---- ceiling: how hard is it for people to have lived on / crossed this ground ----
ceil = np.full(len(la), 0.55)                    # forest, steppe, tundra: people ranged widely
ceil = np.where(ba, 0.75, ceil)                  # sand and rock desert
ceil = np.maximum(ceil, np.clip(0.55 + (el - 3500) / 1500 * 0.25, 0.55, 0.85))  # thin air
ceil = ceil + np.clip(rg / 600, 0, 1) * 0.10     # broken, steep ground
ceil = np.where(ic, 1.0, ceil)                   # permanent ice
ceil = np.where(ant, 1.0, ceil)                  # Antarctica: no people before the 1800s
ceil = np.clip(ceil, 0, 1)
L = np.where(ic | ant, 80.0, 120.0)
reach = 1 - np.exp(-(access / L) ** 1.2)
score = 100 * reach * ceil
score *= np.exp(-li / 15.0)                      # visible lights at night = people
score = np.clip(score, 0, 100)

S = np.zeros((H, W), np.float32); S[idx] = score
A = np.zeros((H, W), np.float32); A[idx] = access
np.savez_compressed('out/grid_base.npz', S=S, A=A, land=land, ice=ice, elev=elev.astype('float32'),
                    d_road=d_road.astype('float32'), d_town=d_town.astype('float32'), d_river=d_river.astype('float32'),
                    d_coast=d_coast.astype('float32'), i_town=i_town, which=which.astype('uint8'), iy=idx[0], ix=idx[1])
json.dump(names, open('out/townnames_base.json', 'w'))

# quick report
area = np.cos(np.radians(la))
for thr in (25, 50, 75, 90):
    print(f'score>={thr}: {100*area[score>=thr].sum()/area.sum():.1f}% of land;  excl. Antarctica {100*area[(score>=thr)&~ant].sum()/area[~ant].sum():.1f}%')
def at(n, lt, ln):
    y = int((90 - lt) / 180 * H); x = int((ln + 180) / 360 * W)
    print(f'{n:22s} score {S[y,x]:5.1f} access {A[y,x]:6.0f} km land={land[y,x]} ice={ice[y,x]}')
for n, lt, ln in [('nebraska', 41.3, -99), ('antarctic plateau', -80, 80), ('greenland', 72, -40), ('amazon', -5, -65), ('javari', -6, -72),
                  ('sahara tenere', 20, 12), ('rub al khali', 20, 51), ('siberia', 68, 105), ('nunavut', 65, -100), ('changtang', 35, 86),
                  ('gibson desert', -24, 126), ('taklamakan', 39, 83), ('patagonia icefield', -49.5, -73.5), ('ellesmere', 80, -78),
                  ('new guinea', -4.5, 141), ('congo', 0, 22), ('gangkhar puensum', 28.05, 90.45), ('south pole', -89.9, 0), ('alaska brooks', 68, -155), ('kamchatka', 57, 160)]:
    at(n, lt, ln)
