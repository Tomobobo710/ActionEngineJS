class ForestPOIGenerator extends BasePOIGenerator {
    findForestLocations(count) {
        return this.findLocations(
            count,
            (normalY, avgHeight) => normalY > 0.7 && avgHeight > 20 && avgHeight < 200,
            225 // minDistanceSquared
        );
    }
}