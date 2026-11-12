"""When people first reached each part of the world, for the time slider.

Reads data/world.png (for the land), writes data/time.png and data/time.json.
Each land cell gets a year-before-present, blended from the nearest dated places on
the same landmass. Dates are the earliest known site or settlement in
https://en.wikipedia.org/wiki/List_of_first_human_settlements (midpoints of ranges),
plus first landings in Antarctica and the first crossing of the Greenland ice sheet (1888).
Africa is counted as walked from the start of the slider.
"""
import json, numpy as np
from PIL import Image
from scipy import ndimage as ndi

NOW = 2026
def ce(y): return NOW - y
ANCHORS = [  # lat, lon, years ago, place
    # Africa: home from the start
    (31.9, -8.9, 300000, "Jebel Irhoud"), (5.4, 35.9, 300000, "Omo Kibish"), (-34.1, 24.4, 300000, "Klasies River"),
    (13.6, 33.6, 300000, "Singa"), (0.1, 29.6, 300000, "Katanda"), (32.9, 22.05, 300000, "Haua Fteah"),
    (26.1, 32.6, 300000, "Taramasa Hill"), (12, -8, 300000, "West Africa"), (-15, 25, 300000, "Southern Africa"),
    (20, 10, 300000, "Sahara"), (-2, 15, 300000, "Congo basin"), (8, 45, 300000, "Horn of Africa"),
    # West and South Asia
    (32.7, 34.97, 186000, "Misliya Cave"), (25.1, 55.8, 125000, "Jebel Faya"), (17.3, 54.0, 100000, "Aybut"),
    (22, 78, 80000, "Central India"), (6.6, 80.2, 68000, "Sri Lanka"),
    # East and Southeast Asia
    (25.5, 111.5, 80000, "Fuyan Cave"), (-0.3, 100.6, 68000, "Lida Ajer"), (17.7, 121.8, 67000, "Callao Cave"),
    (36.8, 138.2, 47000, "Lake Nojiri"), (20.2, 103.4, 46000, "Tam Pa Ling"), (-8.4, 127.3, 42000, "Jerimalai"),
    (3.8, 113.8, 40000, "Niah Cave"), (-4, 138, 40000, "New Guinea"), (22.4, 114.3, 39000, "Wong Tei Tung"),
    (31, 92, 38000, "Tibet"), (26.2, 127.7, 32000, "Okinawa"), (23.7, 121, 25000, "Taiwan"), (-5.2, 154.6, 28000, "Kilu Cave"),
    # Europe and northern Asia
    (42.9, 25.4, 45000, "Bacho Kiro"), (40.2, 18.0, 44500, "Grotta del Cavallo"), (50.5, -3.5, 42500, "Kents Cavern"),
    (48.4, 9.8, 42500, "Geissenkloesterle"), (55.7, 21.4, 42000, "Snaukstai"), (45.0, 21.8, 40000, "Pestera cu Oase"),
    (66.6, 62.4, 37500, "Mamontovaya Kurya"), (52.9, -9.0, 12500, "Gwendoline Cave"),
    (34.6, 32.9, 12500, "Aetokremnos"), (62.8, 6.9, 11000, "Aukra"), (58.4, 24.7, 11000, "Pulli"), (55.97, -3.3, 10500, "Cramond"),
    (35.8, 14.5, 7250, "Ghar Dalam"), (62, -6.8, 1500, "Faroe Islands"), (64.1, -21.9, 1076, "Reykjavik"),
    (79.7, 11.0, ce(1619), "Smeerenburg"), (72.4, 52.7, ce(1870), "Malye Karmakuly"), (71.0, -8.3, ce(1921), "Jan Mayen"),
    (76.2, 152.7, 8300, "Zhokhov Island"), (71.0, -179.6, 3400, "Wrangel Island"), (79.3, 101.6, ce(1974), "Severnaya Zemlya"),
    (55.2, 166.0, ce(1825), "Commander Islands"),
    # Australia
    (-12.5, 132.9, 57500, "Madjedbebe"), (-42.7, 147.3, 41000, "Jordan River Levee"),
    # Americas
    (67.1, -140.5, 32500, "Bluefish Caves"), (32.8, -106.3, 22000, "Lake Otero"), (-41.5, -73.2, 16500, "Monte Verde"),
    (-13.0, -74.4, 14000, "Pikimachay"), (34.0, -120.1, 13000, "Arlington Springs"), (4.9, -74.0, 12500, "El Abra"),
    (51.8, -128.2, 12000, "Triquet Island"), (-47.9, -67.9, 11000, "Piedra Museo"), 
    (18.2, -66.5, 6000, "Angostura"), (24.0, -74.5, 1100, "San Salvador"), (19.3, -81.3, ce(1658), "Cayman Islands"),
    (72.7, -78.0, 4000, "Pond Inlet"), (32.3, -64.8, ce(1609), "Bermuda"),
    # Greenland: coast, then the ice
    (69.2, -51.1, 4000, "Saqqaq"), (82.0, -30.0, 4000, "North Greenland"), (70.5, -22.0, 4000, "East Greenland"),
    (61.0, -45.5, 4000, "South Greenland"),
    # Pacific
    (15.2, 145.8, 3500, "Unai Bapot"), (-21.2, -175.2, 3180, "Tongatapu"), (-18.1, 177.3, 3000, "Bourewa"), (-17.7, 168.3, 3000, "Teouma"),
    (-13.8, -172.0, 3000, "Mulifanua"), (18.9, -155.7, 1700, "Ka Lae"), (1.9, -157.4, 1600, "Line Islands"), (-16.7, -151.0, 1140, "Huahine"),
    (-27.1, -109.3, 1000, "Anakena"), (-41.5, 174.0, 700, "Wairau Bar"), (-29.0, 167.9, 700, "Norfolk Island"), (-50.5, 166.3, 700, "Enderby Island"),
    (-29.3, -177.9, 600, "Kermadec Islands"), (-44.0, -176.5, ce(1500), "Chatham Islands"), (10.3, -109.2, ce(1725), "Clipperton"),
    (-33.6, -78.8, ce(1750), "Juan Fernandez"), (-1.3, -90.4, ce(1805), "Floreana"), (27.1, 142.2, ce(1830), "Bonin Islands"),
    (-31.5, 159.1, ce(1834), "Lord Howe Island"), (-52.5, 169.1, ce(1896), "Campbell Island"), (-54.5, 158.9, ce(1948), "Macquarie Island"),
    (18.8, -111.0, ce(1957), "Socorro"),
    # Indian Ocean
    (-19, 47, 1500, "Madagascar"), (-11.7, 43.3, 1450, "Comoros"), (-20.4, 57.7, ce(1638), "Vieux Grand Port"), (-21.1, 55.5, ce(1642), "Reunion"),
    (-19.7, 63.4, ce(1691), "Rodrigues"), (-4.6, 55.5, ce(1770), "Seychelles"), (-12.1, 96.9, ce(1826), "Cocos Islands"),
    (-38.7, 77.5, ce(1843), "Ile Saint-Paul"), (-37.8, 77.6, ce(1871), "Ile Amsterdam"), (-10.4, 105.7, ce(1888), "Christmas Island"),
    (-49.3, 69.5, ce(1927), "Kerguelen"), (-46.9, 37.8, ce(1947), "Prince Edward Islands"), (-46.4, 51.9, ce(1963), "Crozet Islands"),
    # Atlantic
    (28.3, -16.5, 3000, "Canary Islands"), (32.7, -17.0, ce(1420), "Madeira"), (37.0, -25.1, ce(1439), "Santa Maria"),
    (14.9, -23.6, ce(1462), "Cidade Velha"), (0.3, 6.6, ce(1485), "Sao Tome"), (-15.9, -5.7, ce(1516), "Saint Helena"),
    (-51.5, -58.1, ce(1764), "Port Louis"), (-37.1, -12.3, ce(1810), "Tristan da Cunha"), (-7.9, -14.4, ce(1815), "Ascension"),
    (-60.7, -44.7, ce(1903), "South Orkney"), (-54.3, -36.5, ce(1904), "Grytviken"),
    # Antarctica: first landings and first visits inland
    (-64.2, -61.0, ce(1821), "Antarctic Peninsula"), (-62.5, -59.7, ce(1821), "South Shetland Islands"), (-71.3, 170.2, ce(1895), "Cape Adare"),
    (-77.8, 166.7, ce(1902), "Ross Island"), (-89.9, 0.0, ce(1911), "South Pole"), (-66.9, 142.7, ce(1912), "Cape Denison"),
    (-78.5, 106.8, ce(1957), "Vostok"), (-82.1, 55.0, ce(1958), "Pole of Inaccessibility"), (-80.0, -119.5, ce(1957), "Byrd"),
    (-70.7, -8.3, ce(1902), "Dronning Maud Land coast"), (-67.6, 62.9, ce(1930), "Mac. Robertson Land"),
]
W, H = 2048, 1024
SCALE, LOW = 40, 64  # code = 40 * log10(years ago)

def main():
    world = np.asarray(Image.open("data/world.png"))
    land_full = world[..., 0] > 0
    fy, fx = land_full.shape[0] // H, land_full.shape[1] // W
    land = land_full.reshape(H, fy, W, fx).mean((1, 3)) >= 0.3
    # landmasses, joined across the date line
    lab, n = ndi.label(land, structure=np.ones((3, 3)))
    for y in range(H):
        a, b = lab[y, 0], lab[y, -1]
        if a and b and a != b: lab[lab == b] = a
    lat = 90 - (np.arange(H) + 0.5) * 180 / H; lon = -180 + (np.arange(W) + 0.5) * 360 / W
    def xyz(la, lo):
        la, lo = np.radians(la), np.radians(lo); return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)
    A = np.array([(a[0], a[1]) for a in ANCHORS]); AV = np.log10([a[2] for a in ANCHORS]); AX = xyz(A[:, 0], A[:, 1])
    # which landmass each dated place sits on (nearest land cell within about 150 km)
    ys, xs = np.nonzero(land); LX = xyz(lat[ys], lon[xs])
    from scipy.spatial import cKDTree
    tree = cKDTree(LX); d, i = tree.query(AX); acomp = np.where(d < 0.025, lab[ys[i], xs[i]], 0)
    comp = lab[ys, xs]; out = np.zeros(len(ys))
    for c in np.unique(comp):
        m = comp == c; idx = np.nonzero(acomp == c)[0]
        if len(idx) == 0: idx = np.arange(len(ANCHORS))  # islands with no date: nearest dated place anywhere
        k = min(4 if len(idx) < len(ANCHORS) else 1, len(idx))
        dd, ii = cKDTree(AX[idx]).query(LX[m], k=k)
        if k == 1: out[m] = AV[idx][ii]
        else:
            wgt = 1 / np.maximum(dd, 1e-4) ** 3; out[m] = (AV[idx][ii] * wgt).sum(1) / wgt.sum(1)
    code = np.zeros((H, W), np.float32); code[ys, xs] = out * SCALE
    # the Greenland ice sheet was first crossed in 1888; the coast was lived on long before
    ice = ((world[..., 2] & 4) > 0).reshape(H, fy, W, fx).mean((1, 3)) >= 0.5
    green = ice & (lat[:, None] > 59) & (lon[None, :] > -75) & (lon[None, :] < -10)
    code[green] = np.log10(ce(1888)) * SCALE
    # fill the sea with the nearest land value so coast pixels blend cleanly, then soften
    near = ndi.distance_transform_edt(~land, return_distances=False, return_indices=True)
    full = code[near[0], near[1]]
    soft = ndi.gaussian_filter(full, 1.2, mode=("nearest", "wrap"))
    img = np.clip(np.round(soft), LOW, 255).astype(np.uint8)
    Image.fromarray(img).save("data/time.png", optimize=True)
    # share of land still unwalked at each slider step
    S = (world[..., 0].astype(np.float32) - 1) / 2.54
    big = np.repeat(np.repeat(soft, fy, 0), fx, 1)
    flat = 90 - (np.arange(land_full.shape[0]) + 0.5) * 180 / land_full.shape[0]
    area = np.repeat(np.cos(np.radians(flat))[:, None], land_full.shape[1], 1)[land_full]; s = S[land_full]; a = big[land_full]
    TOP = SCALE * np.log10(200000); steps = 100
    share = []
    for p in range(steps):
        t = TOP - p * (TOP - LOW) / (steps - 1)
        share.append(round(float(100 * area[(a < t) | (s >= 50)].sum() / area.sum()), 1))
    json.dump({"w": W, "h": H, "scale": SCALE, "low": LOW, "top": round(float(TOP), 3), "steps": steps, "share": share}, open("data/time.json", "w"), separators=(",", ":"))
    print("share at start, middle, end:", share[0], share[50], share[-1])
    return soft, land

if __name__ == "__main__":
    soft, land = main()
    for name, la, lo in [("Omaha", 41.26, -95.94), ("London", 51.5, -0.1), ("Sydney", -33.9, 151.2), ("Auckland", -36.8, 174.8), ("Nuuk", 64.2, -51.7),
                         ("Greenland ice", 72, -40), ("South Pole", -89.5, 0), ("Nairobi", -1.3, 36.8), ("Yakutsk", 62, 129.7), ("Honolulu", 21.3, -157.8),
                         ("Manaus", -3.1, -60), ("Anchorage", 61.2, -149.9), ("Delhi", 28.6, 77.2), ("Cairo", 30, 31.2), ("Reykjavik", 64.1, -21.9), ("Antananarivo", -18.9, 47.5)]:
        y = int((90 - la) / 180 * H); x = int((lo + 180) / 360 * W); print(f"{name}: about {10 ** (soft[y, x] / SCALE):,.0f} years ago")
