import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { CONTENT_MODELS_DIR } from "./lib/constants.mjs";

const chrome = findChrome();
const force = process.argv.includes("--force");
if (!chrome) {
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
    const result = spawnSync(
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
      { stdio: "ignore" }
    );
    if (result.status === 0 && existsSync(target.cover)) {
      console.log(`[INFO] captured cover: ${target.cover}`);
    } else {
      console.warn(`[WARN] cover capture failed: ${target.slug}`);
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
