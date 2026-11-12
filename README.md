# <img src="icon.svg" alt="" height="24"> Unwalked Earth

A globe that guesses where nobody has ever stood.

https://unwalked.earth/

Plain land has been walked. Orange land probably hasn't. Tap anywhere to see the score for that spot, why it got it, and whether anything is on record nearby.

## How a place gets its score

Every patch of land about 10 km across gets a number from 0 to 100.

- **Distance.** How far it is from the nearest road, track, railway, town, airstrip, research station, mine, archaeological site, river or coast.
- **Ground.** Ice can reach 100. Open desert and very high country stop near 75. Forest, grassland and tundra stop near 55, because people have lived on or crossed that ground for thousands of years.
- **Lights.** Any glow at night pulls the score down.

When you tap a spot the page also checks four public sources for anything recorded within 10 km: photos on Wikimedia Commons, wildlife records on GBIF, sightings on iNaturalist and articles on Wikipedia.

## Where it's wrong

It's a guess from distance. Nobody keeps a record of everywhere people have stood. The map only knows the camps, mines and expedition routes that are in its data, and some are missing. The oceans aren't scored.

## Layout

```
index.html      the page
css/style.css   styles
js/app.js       the globe and the card
data/           score texture, place-name lookup, stats
tools/          scripts that build data/ from the sources
v1/             the first version, kept for comparison
```

No build step and no dependencies. Open `index.html` from any static server.

## Data

- [Natural Earth](https://www.naturalearthdata.com/): land, roads, railways, rivers, ice
- [Malaria Atlas Project](https://malariaatlas.org/project-resources/accessibility-to-healthcare/): travel time to cities (Weiss et al. 2018)
- [OurAirports](https://ourairports.com/data/): airports and airstrips, open and closed
- [COMNAP](https://github.com/PolarGeospatialCenter/comnap-antarctic-facilities): Antarctic facilities
- [Leihy and others, 2020](https://doi.org/10.26180/5c32bf1b041ea): recorded visits in Antarctica, 1819 to 2018 (CC BY-NC 4.0)
- [Wikidata](https://www.wikidata.org/): mines and archaeological sites
- [GeoNames](https://www.geonames.org/): towns of 1,000 or more
- NASA night lights

Pictures on tap are Sentinel-2 cloudless by [EOX](https://s2maps.eu/) and NASA Blue Marble.
