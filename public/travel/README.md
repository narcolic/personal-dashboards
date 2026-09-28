# Globe geography

`land.geojson` is Natural Earth's 1:110m Admin 0 countries dataset with feature
properties removed. Coordinates are unchanged. Downloaded 2026-09-28 from:
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson

Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/
The client draws this data into a texture wrapped around the 3D Earth. This avoids
raised polygon surfaces intersecting the sphere near the poles. The app retains a
visible credit. This low-resolution layer is intended for a globe,
not street-level navigation or authoritative borders. There are no imagery or tile API keys.

## Urban-area highlights

`urban/*.json` contains Natural Earth's public-domain 1:10m urban-area polygons,
from revision `693f11422f4e08d2da4566b854dda53eb7c39fb3` of
https://github.com/nvkelso/natural-earth-vector/blob/693f11422f4e08d2da4566b854dda53eb7c39fb3/geojson/ne_10m_urban_areas.geojson

These are approximate built-up footprints derived from 2002–2003 MODIS satellite
data, not current municipal boundaries. Adjacent cities can share one footprint;
smaller settlements and recent development may have no coverage. See
https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-urban-area/

Rebuild with `node scripts/build-urban-areas.mjs`. The script removes unused
properties, rounds coordinates to four decimal places, and indexes whole polygons
into 10-degree cells. Only cells containing saved locations load in the browser;
React Query shares and caches those requests. Empty cells contain `[]`.

The client highlights polygons containing a saved coordinate, excluding holes.
It does not guess the nearest city. A flat location dot remains when no polygon
matches or an asset cannot load. Overview dots help find small areas when zoomed
out. Fine cap tessellation and minimal elevation keep the highlights close to
the sphere without intersecting it. The country layer remains a texture.
