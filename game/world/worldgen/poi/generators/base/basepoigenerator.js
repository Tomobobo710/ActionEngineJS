class BasePOIGenerator {
    constructor(terrain, physicsWorld) {
        this.terrain = terrain;
        this.physicsWorld = physicsWorld;
    }

    findLocations(count, criteria, minDistanceSquared) {
        const candidates = this.terrain.triangles.filter((triangle) => {
            const avgHeight = (triangle.vertices[0].y + triangle.vertices[1].y + triangle.vertices[2].y) / 3;

            const normalY = Math.abs(triangle.normal.y);
            return criteria(normalY, avgHeight);
        });

        const selected = [];

        while (selected.length < count && candidates.length > 0) {
            const index = Math.floor(Math.random() * candidates.length);
            const candidate = candidates[index];

            const centerX = (candidate.vertices[0].x + candidate.vertices[1].x + candidate.vertices[2].x) / 3;
            const centerZ = (candidate.vertices[0].z + candidate.vertices[1].z + candidate.vertices[2].z) / 3;

            let tooClose = false;
            for (const existing of selected) {
                const existingX = (existing.vertices[0].x + existing.vertices[1].x + existing.vertices[2].x) / 3;
                const existingZ = (existing.vertices[0].z + existing.vertices[1].z + existing.vertices[2].z) / 3;

                const dx = centerX - existingX;
                const dz = centerZ - existingZ;
                if (dx * dx + dz * dz < minDistanceSquared) {
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose) {
                selected.push(candidates.splice(index, 1)[0]);
            } else {
                candidates.splice(index, 1);
            }
        }

        return selected;
    }
}