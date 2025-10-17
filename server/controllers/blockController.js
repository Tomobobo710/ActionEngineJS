const db = require('../config/database');

class BlockController {
    // Get all blocks
    static getAllBlocks(req, res) {
        const sql = 'SELECT * FROM blocks ORDER BY created_at DESC';

        db.all(sql, [], (err, rows) => {
            if (err) {
                // console.error('Error fetching blocks:', err);
                return res.status(500).json({ error: err.message });
            }

            const blocks = rows.map(row => ({
                id: row.id,
                position: {
                    x: row.position_x,
                    y: row.position_y,
                    z: row.position_z
                },
                type: row.type,
                text: row.text,
                blockSize: row.blockSize, // Include blockSize
                created_at: row.created_at,
                updated_at: row.updated_at
            }));

            res.json({ blocks, count: blocks.length });
        });
    }

    // Get single block
    static getBlock(req, res) {
        const sql = 'SELECT * FROM blocks WHERE id = ?';

        db.get(sql, [req.params.id], (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(404).json({ error: 'Block not found' });
            }

            const block = {
                id: row.id,
                position: {
                    x: row.position_x,
                    y: row.position_y,
                    z: row.position_z
                },
                type: row.type,
                text: row.text,
                created_at: row.created_at,
                updated_at: row.updated_at
            };

            res.json(block);
        });
    }

    // Create new block
    static createBlock(req, res) {
        const { id, position, type, text, blockSize } = req.body; // Add blockSize

        if (!id || !position) {
            return res.status(400).json({ error: 'Missing required fields: id, position' });
        }

        const sql = `
            INSERT INTO blocks (id, position_x, position_y, position_z, type, text, blockSize)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
            id,
            position.x,
            position.y,
            position.z,
            type || 'cube',
            text || '',
            blockSize || 5.0 // Use provided blockSize or default
        ], function(err) {
            if (err) {
                // console.error('Error creating block:', err);
                return res.status(500).json({ error: err.message });
            }

            res.status(201).json({
                id,
                position,
                type: type || 'cube',
                text: text || '',
                blockSize: blockSize || 5.0, // Include blockSize in response
                message: 'Block created successfully'
            });
        });
    }

    // Update block
    static updateBlock(req, res) {
        const { position, type, text, blockSize } = req.body; // Add blockSize
        const { id } = req.params;

        const sql = `
            UPDATE blocks
            SET position_x = COALESCE(?, position_x),
                position_y = COALESCE(?, position_y),
                position_z = COALESCE(?, position_z),
                type = COALESCE(?, type),
                text = COALESCE(?, text),
                blockSize = COALESCE(?, blockSize), -- Update blockSize
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        db.run(sql, [
            position?.x,
            position?.y,
            position?.z,
            type,
            text,
            blockSize, // Pass blockSize
            id
        ], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Block not found' });
            }

            res.json({ message: 'Block updated successfully', changes: this.changes });
        });
    }

    // Delete block
    static deleteBlock(req, res) {
        const sql = 'DELETE FROM blocks WHERE id = ?';

        db.run(sql, [req.params.id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Block not found' });
            }

            res.json({ message: 'Block deleted successfully', id: req.params.id });
        });
    }

    // Bulk save blocks (replaces all blocks)
    static bulkSaveBlocks(req, res) {
        const { blocks } = req.body;

        if (!Array.isArray(blocks)) {
            return res.status(400).json({ error: 'Blocks must be an array' });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Clear existing blocks
            db.run('DELETE FROM blocks', (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                if (blocks.length === 0) {
                    db.run('COMMIT');
                    return res.json({
                        message: 'All blocks cleared',
                        count: 0
                    });
                }

                // Insert all blocks
                const stmt = db.prepare(`
                    INSERT INTO blocks (id, position_x, position_y, position_z, type, text, blockSize)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                let insertCount = 0;
                let hasError = false;

                blocks.forEach((block, index) => {
                    stmt.run(
                        block.id,
                        block.position.x,
                        block.position.y,
                        block.position.z,
                        block.type || 'cube',
                        block.text || '',
                        block.blockSize || 5.0, // Include blockSize
                        (err) => {
                            if (err && !hasError) {
                                hasError = true;
                                stmt.finalize();
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: err.message });
                            }

                            insertCount++;

                            if (insertCount === blocks.length && !hasError) {
                                stmt.finalize((err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: err.message });
                                    }

                                    db.run('COMMIT');
                                    res.json({
                                        message: 'Blocks saved successfully',
                                        count: blocks.length
                                    });
                                });
                            }
                        }
                    );
                });
            });
        });
    }

    // Save camera state
    static saveCameraState(req, res) {
        const { position, rotation } = req.body;

        if (!position || !rotation) {
            return res.status(400).json({ error: 'Missing position or rotation' });
        }

        const sql = `
            UPDATE camera_state
            SET position_x = ?, position_y = ?, position_z = ?,
                rotation_x = ?, rotation_y = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `;

        db.run(sql, [
            position.x || 0,
            position.y || 0,
            position.z || 0,
            rotation.x || 0,
            rotation.y || 0
        ], (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({ message: 'Camera state saved' });
        });
    }

    // Get camera state
    static getCameraState(req, res) {
        const sql = 'SELECT * FROM camera_state WHERE id = 1';

        db.get(sql, [], (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!row) {
                return res.json({
                    position: { x: 5, y: 1.8, z: 5 },
                    rotation: { x: 0, y: 0 }
                });
            }

            res.json({
                position: {
                    x: row.position_x,
                    y: row.position_y,
                    z: row.position_z
                },
                rotation: {
                    x: row.rotation_x,
                    y: row.rotation_y
                }
            });
        });
    }

    // Get statistics
    static getStatistics(req, res) {
        // console.log('BlockController.getStatistics: Fetching statistics...');
        db.get('SELECT COUNT(*) as total FROM blocks', [], (err, row) => {
            if (err) {
                // console.error('BlockController.getStatistics: Error fetching statistics:', err);
                return res.status(500).json({ error: err.message });
            }

            // console.log(`BlockController.getStatistics: Total blocks: ${row.total}`);
            res.json({
                totalBlocks: row.total,
                timestamp: new Date().toISOString()
            });
        });
    }
}

module.exports = BlockController;