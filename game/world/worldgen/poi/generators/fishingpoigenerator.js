class FishingPOIGenerator extends BasePOIGenerator {
    findFishingLocations(count) {
        return this.findLocations(
            count,
            (normalY, avgHeight) => normalY > 0.7 && avgHeight >= -2 && avgHeight <= 2,
            100 // minDistanceSquared
        );
    }
}