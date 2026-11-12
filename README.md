# Unwalked Earth

A globe that guesses where nobody has ever stood. Orange land has probably never been walked.

**Live:** https://michaelbegley.github.io/unwalked-earth/

Tap anywhere to see that spot's score, how far it is from the nearest way in, and links to look it up.

## How the score works

Every patch of land about 10 km across gets a score from 0 to 100.

- **Way in.** Distance to the nearest road, track, railway, town of 1,000+ people, airstrip, research station, river or coast.
- **Ground.** Ice can reach 100. Sand desert tops out near 75, very high ground near 85, everything else near 55.
- **Lights.** Any glow at night pulls the score down.

## Where it is wrong

It is a guess made from distance. Nobody keeps a record of real footsteps. It only knows about camps, mines and expedition routes that are in its data, and a fact check found several that were not. Oceans are not scored.

## Rebuild

1. `build/build.py` makes the base grid from Natural Earth and GeoNames.
2. `build/tt.py` shrinks the travel-time GeoTIFF to the same grid.
3. `build/score2.py` folds in travel time, Antarctic facilities and airstrips.
4. `build/export.py` writes the score texture and stats. `build/names.py` writes the place-name lookup.
5. `build/assemble.py` inlines everything into `build/template.html` to produce `index.html`.

## Data

Natural Earth 1:10m vectors, the Malaria Atlas Project travel-time-to-cities map (Weiss et al. 2018), OurAirports, the COMNAP Antarctic facilities list, GeoNames towns (npm `all-the-cities`), and night-lights and elevation textures from the three-globe examples.
