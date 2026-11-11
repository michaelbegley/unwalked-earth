# Unwalked Earth

An interactive globe that guesses where no person has ever stood. Each ~10 km patch of land gets a score from 0 (walked) to 100 (unwalked).

**Live:** https://michaelbegley.github.io/unwalked-earth/

## How the score works

- **Way in.** Distance to the nearest road, railway, town of 1,000+ people, airport, port or research station. Coasts and rivers count as slower ways in.
- **Ground.** Ice sheets and Antarctica can reach 100. Sand desert tops out near 75, very high ground near 85, everything else near 55.
- **Lights.** Any glow at night pulls the score down.

It is a model. Nobody keeps a record of real footsteps. The road layer skips desert tracks, so central Australia and the Sahara score too high. Oceans are not scored.

## Rebuild

`build/build.py` makes the score grid, `build/export.py` makes the texture and stats, and both get inlined into `build/template.html` to produce `index.html`.

## Data

Natural Earth 1:10m vectors, GeoNames towns (npm `all-the-cities`), and the elevation, night-lights and land-colour textures from the three-globe examples.

Version 1, 11 Nov 2026.
