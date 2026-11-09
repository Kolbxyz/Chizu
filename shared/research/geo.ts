// Spherical geometry helpers for the research tools.
const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in metres. */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial compass bearing from point 1 to point 2, 0 to 360 degrees. */
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = rad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(rad(lat2));
  const x =
    Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(dLng);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Point reached by travelling `distance` metres from a point along a bearing. */
export function destination(
  lat: number,
  lng: number,
  bearing: number,
  distance: number,
): { lat: number; lng: number } {
  const d = distance / EARTH_RADIUS_M;
  const b = rad(bearing);
  const lat1 = rad(lat);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 =
    rad(lng) +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: deg(lat2), lng: ((deg(lng2) + 540) % 360) - 180 };
}

/** Bounding box of a square of half-side `radius` metres: [west, south, east, north]. */
export function bbox(lat: number, lng: number, radius: number): [number, number, number, number] {
  const dLat = deg(radius / EARTH_RADIUS_M);
  const dLng = dLat / Math.max(0.01, Math.cos(rad(lat)));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

/** Smallest angle between two bearings, 0 to 180 degrees. */
export const angleBetween = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

export { EARTH_RADIUS_M };
