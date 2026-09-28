import { geoEquirectangular, geoPath } from "d3-geo";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { FeatureCollection } from "geojson";

// Draw the map on a flat canvas, then wrap it around the 3D sphere. Keeping
// land on the sphere surface avoids polar polygon meshes intersecting it.
export function createLandTexture(land: FeatureCollection): CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");

  context.fillStyle = "#081e2d";
  context.fillRect(0, 0, width, height);

  const projection = geoEquirectangular()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2]);
  const path = geoPath(projection, context);
  context.fillStyle = "#285464";
  context.strokeStyle = "#52808a";
  context.lineWidth = 0.7;
  for (const feature of land.features) {
    context.beginPath();
    path(feature);
    context.fill();
    context.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
