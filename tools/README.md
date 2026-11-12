# Rebuilding the data

These scripts turn the source datasets into the files in `data/`. Run them from this folder, in order.

Put the downloads in `tools/source/`:

- Natural Earth 1:10m GeoJSON layers (land, minor islands, roads, railroads, rivers, lakes, glaciated areas, Antarctic ice shelves, populated places, airports, ports, countries, geography regions)
- `cities.tsv`: name, country, pop, lon, lat for towns of 1,000 or more (GeoNames)
- `2015_accessibility_to_cities_v1.0.tif` from the Malaria Atlas Project
- `airports.csv` from OurAirports
- `comnap.csv` from the COMNAP facilities repo
- `wikidata.csv`: mines and archaeological sites with coordinates
- `earth-topology.png`, `earth-night.jpg`, `earth-blue-marble.jpg`

Then:

```
mkdir -p out
python build.py                 # base grid, about 10 minutes
python traveltime.py source/2015_accessibility_to_cities_v1.0.tif
python wikidata.py
python score.py                 # final scores
python export.py                # data/world.png and data/meta.json
python names.py                 # data/names.png and data/names.json
python stats.py                 # adds the country ranking to meta.json
```

Needs numpy, scipy, Pillow, shapely and rasterio.

The paths were tidied after the last full run, so expect to fix one or two if you rebuild from scratch.
