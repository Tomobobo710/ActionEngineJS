class TownPOIGenerator extends BasePOIGenerator {
    findTownLocations(count) {
        return this.findLocations(
            count,
            (normalY, avgHeight) => normalY > 0.8 && avgHeight > 50 && avgHeight < 300,
            400 // minDistanceSquared
        );
    }
}