# Unwalked Earth

An interactive globe that guesses where no person has ever stood. Each ~10 km patch of land gets a score from 0 (walked) to 100 (unwalked).

**Live:** https://michaelbegley.github.io/unwalked-earth/

## How the score works

- **Way in.** Distance to the nearest road, railway, town of 1,000+ people, airport, port or research station. Coasts and rivers count as slower ways in.
- **Ground.** Ice sheets and Antarctica can reach 100. Sand desert tops out near 75, very high ground near 85, everything else near 55.
- **Lights.** Any glow at night pulls the score down.

It is a model. Nobody keeps a record of real footsteps. A fact check found stations, mines and camps near several top spots that the data lacked; those were added, and more are certainly missing. Oceans are not scored.

## Rebuild

`build/build.py` makes the base score grid, `build/tt.py` shrinks the travel-time map to the same grid, `build/score2.py` folds in travel time and the Antarctic facilities list, `build/export.py` makes the texture and stats, and both get inlined into `build/template.html` to produce `index.html`.

## Data

Natural Earth 1:10m vectors, the Malaria Atlas Project travel-time-to-cities map (Weiss et al. 2018), the COMNAP Antarctic facilities list, GeoNames towns (npm `all-the-cities`), and the elevation, night-lights and land-colour textures from the three-globe examples.

Version 2.0, 11 Nov 2026.
