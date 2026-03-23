//actionengine/util/actionzip.js
/**
 * ActionZip - ZIP file encoder without external dependencies
 * Creates valid uncompressed ZIP files from JavaScript
 * 
 * Uses STORE method (no compression) - outputs valid ZIP structure:
 * - Local file headers + data (one per file)
 * - Central directory (file listing)
 * - End of central directory (metadata)
 */
class ActionZip {
    constructor() {
        this.files = []; // Array of {path, content}
        this.textEncoder = new TextEncoder();
    }

    /**
     * Add a file to the ZIP archive
     * @param {string} path - File path including folders (e.g., "meshes/body.js")
     * @param {string|Uint8Array} content - File content
     */
    addFile(path, content) {
        // Convert string content to Uint8Array if needed
        if (typeof content === 'string') {
            content = this.textEncoder.encode(content);
        }
        
        this.files.push({
            path: path,
            content: content // Ensure it's Uint8Array
        });
    }

    /**
     * Generate the ZIP file as a Blob
     * @returns {Blob} Valid ZIP file ready for download
     */
    generate() {
        const buffers = [];
        let offset = 0;
        const fileHeaders = [];

        // Step 1: Write local file headers + data
        for (let i = 0; i < this.files.length; i++) {
            const file = this.files[i];
            const pathBytes = this.textEncoder.encode(file.path);
            const contentBytes = file.content instanceof Uint8Array 
                ? file.content 
                : this.textEncoder.encode(file.content);

            // Local file header (30 bytes) + filename + file data
            const headerSize = 30 + pathBytes.length;
            const localHeader = new ArrayBuffer(headerSize + contentBytes.length);
            const view = new DataView(localHeader);
            const bytes = new Uint8Array(localHeader);

            let pos = 0;

            // Local File Header Signature
            view.setUint32(pos, 0x04034b50, true); // "PK\x03\x04"
            pos += 4;

            // Version needed to extract (2.0 for STORE)
            view.setUint16(pos, 20, true);
            pos += 2;

            // General purpose bit flag (0 = no compression, no encryption)
            view.setUint16(pos, 0, true);
            pos += 2;

            // Compression method (0 = STORE, no compression)
            view.setUint16(pos, 0, true);
            pos += 2;

            // File modification time (MS-DOS format: 0 = midnight Jan 1, 1980)
            view.setUint16(pos, 0, true);
            pos += 2;

            // File modification date (MS-DOS format: 0 = Jan 1, 1980)
            view.setUint16(pos, 0, true);
            pos += 2;

            // CRC-32 (calculate for file content)
            const crc32 = this.calculateCrc32(contentBytes);
            view.setUint32(pos, crc32, true);
            pos += 4;

            // Compressed size (same as uncompressed for STORE)
            view.setUint32(pos, contentBytes.length, true);
            pos += 4;

            // Uncompressed size
            view.setUint32(pos, contentBytes.length, true);
            pos += 4;

            // Filename length
            view.setUint16(pos, pathBytes.length, true);
            pos += 2;

            // Extra field length
            view.setUint16(pos, 0, true);
            pos += 2;

            // Filename
            bytes.set(pathBytes, pos);
            pos += pathBytes.length;

            // File data
            bytes.set(contentBytes, pos);

            fileHeaders.push({
                path: file.path,
                pathBytes: pathBytes,
                contentLength: contentBytes.length,
                crc32: crc32,
                headerOffset: offset
            });

            buffers.push(localHeader);
            offset += localHeader.byteLength;
        }

        // Step 2: Build central directory
        const centralDirStart = offset;
        const centralDirEntries = [];

        for (let i = 0; i < fileHeaders.length; i++) {
            const header = fileHeaders[i];

            // Central Directory File Header (46 bytes) + filename + extra
            const centralEntry = new ArrayBuffer(46 + header.pathBytes.length);
            const view = new DataView(centralEntry);
            const bytes = new Uint8Array(centralEntry);

            let pos = 0;

            // Central directory signature
            view.setUint32(pos, 0x02014b50, true); // "PK\x01\x02"
            pos += 4;

            // Version made by (UNIX, version 3.0)
            view.setUint16(pos, 0x0314, true);
            pos += 2;

            // Version needed to extract
            view.setUint16(pos, 20, true);
            pos += 2;

            // General purpose bit flag
            view.setUint16(pos, 0, true);
            pos += 2;

            // Compression method
            view.setUint16(pos, 0, true);
            pos += 2;

            // File modification time
            view.setUint16(pos, 0, true);
            pos += 2;

            // File modification date
            view.setUint16(pos, 0, true);
            pos += 2;

            // CRC-32
            view.setUint32(pos, header.crc32, true);
            pos += 4;

            // Compressed size
            view.setUint32(pos, header.contentLength, true);
            pos += 4;

            // Uncompressed size
            view.setUint32(pos, header.contentLength, true);
            pos += 4;

            // Filename length
            view.setUint16(pos, header.pathBytes.length, true);
            pos += 2;

            // Extra field length
            view.setUint16(pos, 0, true);
            pos += 2;

            // File comment length
            view.setUint16(pos, 0, true);
            pos += 2;

            // Disk number start
            view.setUint16(pos, 0, true);
            pos += 2;

            // Internal file attributes
            view.setUint16(pos, 0, true);
            pos += 2;

            // External file attributes
            view.setUint32(pos, 0, true);
            pos += 4;

            // Relative offset of local header
            view.setUint32(pos, header.headerOffset, true);
            pos += 4;

            // Filename
            bytes.set(header.pathBytes, pos);
            pos += header.pathBytes.length;

            buffers.push(centralEntry);
            offset += centralEntry.byteLength;
        }

        const centralDirEnd = offset;

        // Step 3: Build end of central directory
        const endCentralDir = new ArrayBuffer(22);
        const view = new DataView(endCentralDir);
        const bytes = new Uint8Array(endCentralDir);

        let pos = 0;

        // End of central directory signature
        view.setUint32(pos, 0x06054b50, true); // "PK\x05\x06"
        pos += 4;

        // This disk number
        view.setUint16(pos, 0, true);
        pos += 2;

        // Disk number with central directory start
        view.setUint16(pos, 0, true);
        pos += 2;

        // Number of central directory records on this disk
        view.setUint16(pos, this.files.length, true);
        pos += 2;

        // Total number of central directory records
        view.setUint16(pos, this.files.length, true);
        pos += 2;

        // Size of central directory
        view.setUint32(pos, centralDirEnd - centralDirStart, true);
        pos += 4;

        // Offset of start of central directory
        view.setUint32(pos, centralDirStart, true);
        pos += 4;

        // ZIP file comment length
        view.setUint16(pos, 0, true);
        pos += 2;

        buffers.push(endCentralDir);

        // Step 4: Concatenate all buffers into single blob
        return new Blob(buffers, { type: "application/zip" });
    }

    /**
     * Download ZIP immediately
     * @param {string} filename - Output filename with .zip extension
     */
    download(filename) {
        const blob = this.generate();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Calculate CRC-32 checksum for data
     * @param {Uint8Array} data
     * @returns {number} CRC-32 value
     */
    calculateCrc32(data) {
        const crcTable = this.getCrcTable();
        let crc = 0xffffffff;

        for (let i = 0; i < data.length; i++) {
            const byte = data[i];
            const tableIndex = (crc ^ byte) & 0xff;
            crc = (crc >>> 8) ^ crcTable[tableIndex];
        }

        return (crc ^ 0xffffffff) >>> 0; // Ensure unsigned 32-bit
    }

    /**
     * Get CRC-32 lookup table (cached for performance)
     */
    static crcTableCache = null;

    getCrcTable() {
        if (ActionZip.crcTableCache) {
            return ActionZip.crcTableCache;
        }

        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                if ((c & 1) === 1) {
                    c = 0xedb88320 ^ (c >>> 1);
                } else {
                    c = c >>> 1;
                }
            }
            table[n] = c >>> 0; // Ensure unsigned
        }

        ActionZip.crcTableCache = table;
        return table;
    }
}
