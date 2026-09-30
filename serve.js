#!/usr/bin/env node
// serve.js — zero-dependency static server for the VR spike.
//
//   node serve.js              → http  on :8080  (use with `adb reverse`, see VR_SPIKE.md)
//   node serve.js --https      → https on :8443  (needs key.pem + cert.pem next to this file)
//
// WebXR only runs in a "secure context": https:// OR http://localhost. On a Quest connected by
// USB, `adb reverse tcp:8080 tcp:8080` makes the headset's http://localhost:8080 a secure context
// that tunnels to this server — the simplest way in, no certificates.
const http = require("http");
const fs = require("fs");
const path = require("path");

const useHttps = process.argv.includes("--https");
const port = useHttps ? 8443 : 8080;
const root = __dirname;

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".glb": "model/gltf-binary",
    ".bin": "application/octet-stream"
};

function handler(req, res) {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/vr.html";
    // contain to root (no path traversal)
    const filePath = path.normalize(path.join(root, urlPath));
    if (!filePath.startsWith(root)) {
        res.writeHead(403);
        return res.end("Forbidden");
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end("Not found: " + urlPath);
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        res.end(data);
    });
}

if (useHttps) {
    const https = require("https");
    let key, cert;
    try {
        key = fs.readFileSync(path.join(root, "key.pem"));
        cert = fs.readFileSync(path.join(root, "cert.pem"));
    } catch (e) {
        console.error("Missing key.pem / cert.pem. Generate them:\n" +
            "  openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 365 -subj \"/CN=$(hostname -I | awk '{print $1}')\"");
        process.exit(1);
    }
    https.createServer({ key, cert }, handler).listen(port, "0.0.0.0", () => {
        console.log(`HTTPS  https://<this-machine-ip>:${port}/vr.html`);
        console.log("(self-signed → accept the browser warning in the Quest headset)");
    });
} else {
    http.createServer(handler).listen(port, "0.0.0.0", () => {
        console.log(`HTTP   http://localhost:${port}/vr.html`);
        console.log("For Quest over USB:  adb reverse tcp:8080 tcp:8080");
        console.log("then open in the Quest browser:  http://localhost:8080/vr.html");
    });
}
