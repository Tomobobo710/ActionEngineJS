class DungeonPOIGenerator extends BasePOIGenerator {
    findDungeonLocations(count) {
        return this.findLocations(
            count,
            (normalY, avgHeight) => normalY > 0.5 && (avgHeight < 40 || avgHeight > 350),
            625 // minDistanceSquared
        );
    }
}