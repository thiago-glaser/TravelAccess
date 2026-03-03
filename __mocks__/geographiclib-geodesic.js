/**
 * Mock for geographiclib-geodesic.
 * Returns a simple flat-earth approximation good enough for unit tests.
 */
const Geodesic = {
    WGS84: {
        Inverse(lat1, lon1, lat2, lon2) {
            // Approximate: 1 degree lat ≈ 111 320 m, 1 degree lon ≈ 111 320 * cos(lat) m
            const R = 111320;
            const dlat = (lat2 - lat1) * R;
            const dlon = (lon2 - lon1) * R * Math.cos((lat1 * Math.PI) / 180);
            return { s12: Math.sqrt(dlat * dlat + dlon * dlon) };
        }
    }
};

export default { Geodesic };
