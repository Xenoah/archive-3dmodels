import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { CONTENT_MODELS_DIR } from "./lib/constants.mjs";

let crcTable;

const chrome = findChrome();
const force = process.argv.includes("--force");
const fallbackOnly = process.argv.includes("--fallback-only");
if (!chrome && !fallbackOnly) {
  console.warn("[WARN] cover capture skipped: Chrome or Edge was not found.");
  process.exit(0);
}

const targets = await findCaptureTargets();
if (targets.length === 0) {
  console.log("[INFO] no missing covers to capture.");
  process.exit(0);
}

const server = createServer(handleRequest);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

try {
  for (const target of targets) {
    const url = `http://127.0.0.1:${port}/capture?file=${encodeURIComponent(target.source.replace(/\\/g, "/"))}`;
    const result = fallbackOnly
      ? { status: 1 }
      : spawnSync(
          chrome,
          [
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--window-size=960,720",
            "--virtual-time-budget=5000",
            `--screenshot=${target.cover}`,
            url
          ],
          { stdio: "ignore", timeout: 15000 }
        );
    if (result.status === 0 && existsSync(target.cover)) {
      console.log(`[INFO] captured cover: ${target.cover}`);
    } else {
      try {
        await renderFallbackCover(target.source, target.cover);
        console.log(`[INFO] generated fallback cover: ${target.cover}`);
      } catch (error) {
        console.warn(`[WARN] cover capture failed: ${target.slug}`);
        console.warn(`[WARN] fallback render failed: ${error.message}`);
      }
    }
  }
} finally {
  server.close();
}

async function findCaptureTargets() {
  if (!existsSync(CONTENT_MODELS_DIR)) return [];
  const entries = await readdir(CONTENT_MODELS_DIR, { withFileTypes: true });
  const targets = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const modelDir = path.join(CONTENT_MODELS_DIR, entry.name);
    if (await hasManualImage(modelDir)) continue;
    if (!force && existsSync(path.join(modelDir, "auto-cover.png"))) continue;
    const stl = await firstStl(path.join(modelDir, "source"));
    if (!stl) continue;
    targets.push({
      slug: entry.name,
      source: stl,
      cover: path.join(modelDir, "auto-cover.png")
    });
  }
  return targets;
}

async function hasManualImage(modelDir) {
  if (["cover.jpg", "cover.png", "thumbnail.jpg", "thumbnail.png"].some((name) => existsSync(path.join(modelDir, name)))) {
    return true;
  }
  const photosDir = path.join(modelDir, "photos");
  if (!existsSync(photosDir)) return false;
  const photos = await readdir(photosDir, { withFileTypes: true });
  return photos.some((entry) => entry.isFile() && [".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(entry.name).toLowerCase()));
}

async function firstStl(dir) {
  if (!existsSync(dir)) return null;
  const files = await listFilesRecursive(dir);
  return files
    .filter((file) => path.extname(file).toLowerCase() === ".stl")
    .sort((left, right) => left.localeCompare(right))[0] ?? null;
}

async function listFilesRecursive(dir) {
  const output = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await listFilesRecursive(fullPath)));
    } else {
      output.push(fullPath);
    }
  }
  return output;
}

async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/capture") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(captureHtml(url.searchParams.get("file") ?? ""));
      return;
    }
    const file = path.resolve(process.cwd(), decodeURIComponent(url.pathname.replace(/^\/+/, "")));
    if (!file.startsWith(process.cwd())) throw new Error("outside workspace");
    const ext = path.extname(file).toLowerCase();
    const type = ext === ".js" ? "text/javascript" : ext === ".stl" ? "model/stl" : "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
}

function captureHtml(file) {
  const source = `/${file.split("/").map(encodeURIComponent).join("/")}`;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      html, body { margin: 0; width: 100%; height: 100%; background: #e4e8e3; overflow: hidden; }
      canvas { display: block; width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <canvas></canvas>
    <script type="module">
      import * as THREE from "/node_modules/three/build/three.module.js";
      import { STLLoader } from "/node_modules/three/examples/jsm/loaders/STLLoader.js";
      const canvas = document.querySelector("canvas");
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xe4e8e3);
      const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.01, 100000);
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.25);
      key.position.set(3, 5, 4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xc7f7f0, 0.5);
      fill.position.set(-4, 2, -3);
      scene.add(fill);
      const geometry = await new STLLoader().loadAsync(${JSON.stringify(source)});
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x5aa89f, roughness: 0.48, metalness: 0.08 }));
      scene.add(mesh);
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      mesh.position.sub(center);
      mesh.rotation.set(-0.48, 0.72, 0.08);
      const radius = Math.max(size.x, size.y, size.z, 1);
      const distance = radius * 1.9;
      camera.near = Math.max(distance / 1000, 0.01);
      camera.far = distance * 1000;
      camera.position.set(distance * 0.88, distance * 0.62, distance * 0.96);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    </script>
  </body>
</html>`;
}

async function renderFallbackCover(source, cover) {
  const triangles = parseStl(await readFile(source));
  if (triangles.length === 0) throw new Error("STL has no triangles");

  const width = 960;
  const height = 720;
  const background = [0xe4, 0xe8, 0xe3, 0xff];
  const pixels = Buffer.alloc(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = background[0];
    pixels[offset + 1] = background[1];
    pixels[offset + 2] = background[2];
    pixels[offset + 3] = background[3];
  }

  const bounds = modelBounds(triangles.flat());
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2
  ];
  const transformed = triangles.map((triangle) => triangle.map((vertex) => rotatePoint(subtract(vertex, center))));
  const projectedBounds = modelBounds(transformed.flat());
  const modelWidth = Math.max(projectedBounds.max[0] - projectedBounds.min[0], 1);
  const modelHeight = Math.max(projectedBounds.max[1] - projectedBounds.min[1], 1);
  const scale = Math.min((width * 0.72) / modelWidth, (height * 0.74) / modelHeight);
  const zBuffer = new Float64Array(width * height);
  zBuffer.fill(-Infinity);

  for (const triangle of transformed) {
    const points = triangle.map((vertex) => ({
      x: width / 2 + vertex[0] * scale,
      y: height / 2 - vertex[1] * scale,
      z: vertex[2] * scale
    }));
    const normal = normalize(cross(subtract(triangle[1], triangle[0]), subtract(triangle[2], triangle[0])));
    const light = normalize([0.38, 0.64, 0.66]);
    const shade = 0.34 + Math.abs(dot(normal, light)) * 0.58 + Math.max(0, normal[2]) * 0.14;
    const color = shadeColor([0x5a, 0xa8, 0x9f], Math.min(shade, 1.08));
    rasterizeTriangle(points, color, pixels, zBuffer, width, height);
  }

  await writeFile(cover, encodePng(width, height, pixels));
}

function parseStl(buffer) {
  const binaryTriangles = parseBinaryStl(buffer);
  if (binaryTriangles) return binaryTriangles;
  return parseAsciiStl(buffer.toString("utf8"));
}

function parseBinaryStl(buffer) {
  if (buffer.length < 84) return null;
  const count = buffer.readUInt32LE(80);
  const expectedLength = 84 + count * 50;
  if (count <= 0 || expectedLength > buffer.length) return null;
  const triangles = [];
  let offset = 84;
  for (let index = 0; index < count; index++) {
    offset += 12;
    const triangle = [];
    for (let vertex = 0; vertex < 3; vertex++) {
      triangle.push([
        buffer.readFloatLE(offset),
        buffer.readFloatLE(offset + 4),
        buffer.readFloatLE(offset + 8)
      ]);
      offset += 12;
    }
    triangles.push(triangle);
    offset += 2;
  }
  return triangles;
}

function parseAsciiStl(text) {
  const values = [];
  const pattern = /vertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/gi;
  let match;
  while ((match = pattern.exec(text))) {
    values.push([Number(match[1]), Number(match[2]), Number(match[3])]);
  }
  const triangles = [];
  for (let index = 0; index + 2 < values.length; index += 3) {
    triangles.push([values[index], values[index + 1], values[index + 2]]);
  }
  return triangles;
}

function modelBounds(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return { min, max };
}

function rotatePoint(point) {
  const [x, y, z] = point;
  const yaw = 0.72;
  const pitch = -0.48;
  const roll = 0.08;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  const x1 = x * cy + z * sy;
  const y1 = y;
  const z1 = -x * sy + z * cy;
  const x2 = x1;
  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;
  return [x2 * cr - y2 * sr, x2 * sr + y2 * cr, z2];
}

function rasterizeTriangle(points, color, pixels, zBuffer, width, height) {
  const minX = clamp(Math.floor(Math.min(...points.map((point) => point.x))), 0, width - 1);
  const maxX = clamp(Math.ceil(Math.max(...points.map((point) => point.x))), 0, width - 1);
  const minY = clamp(Math.floor(Math.min(...points.map((point) => point.y))), 0, height - 1);
  const maxY = clamp(Math.ceil(Math.max(...points.map((point) => point.y))), 0, height - 1);
  const [a, b, c] = points;
  const area = edge(a, b, c);
  if (Math.abs(area) < 0.0001) return;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const point = { x: x + 0.5, y: y + 0.5 };
      const w0 = edge(b, c, point) / area;
      const w1 = edge(c, a, point) / area;
      const w2 = edge(a, b, point) / area;
      if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue;
      const z = a.z * w0 + b.z * w1 + c.z * w2;
      const bufferIndex = y * width + x;
      if (z <= zBuffer[bufferIndex]) continue;
      zBuffer[bufferIndex] = z;
      const offset = bufferIndex * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 0xff;
    }
  }
}

function edge(a, b, c) {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}

function subtract(left, right) {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function normalize(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

function shadeColor(color, shade) {
  return color.map((channel) => clamp(Math.round(channel * shade), 0, 255));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function encodePng(width, height, pixels) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    header,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function crc32(buffer) {
  crcTable ??= Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    commandPath("google-chrome"),
    commandPath("chromium"),
    commandPath("chromium-browser"),
    commandPath("msedge")
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function commandPath(command) {
  const result = spawnSync(process.platform === "win32" ? "where" : "which", [command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : "";
}
