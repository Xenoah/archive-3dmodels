export const ROOT = process.cwd();
export const CONTENT_MODELS_DIR = "content/models";
export const INBOX_DIR = "_inbox";
export const REPORTS_DIR = "reports";
export const GENERATED_DATA_FILE = "src/data/models.generated.json";
export const PUBLIC_DIR = "public";

export const CATEGORIES = new Set([
  "character",
  "tool",
  "jig",
  "vrchat",
  "gadget",
  "fixture",
  "accessory",
  "other"
]);

export const STATUSES = new Set(["draft", "public", "hidden"]);
export const SOURCE_EXTENSIONS = new Set([".stl", ".step", ".stp", ".3mf", ".obj", ".txt", ".md", ".pdf"]);
export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
export const PREVIEW_EXTENSIONS = new Set([".glb"]);
export const ALLOWED_EXTENSIONS = new Set([
  ...SOURCE_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...PREVIEW_EXTENSIONS
]);
export const FORBIDDEN_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".svg",
  ".exe",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".php",
  ".asp",
  ".zip",
  ".7z",
  ".rar"
]);

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const WARN_FILE_BYTES = 50 * 1024 * 1024;
export const SLUG_RE = /^[a-z0-9_-]+$/;

export const KNOWN_FRONTMATTER_KEYS = new Set([
  "title",
  "summary",
  "category",
  "tags",
  "license",
  "version",
  "status",
  "unit",
  "commercial_use",
  "redistribution",
  "modification",
  "credit_required",
  "author",
  "created",
  "updated",
  "scale",
  "material",
  "printer",
  "nozzle",
  "layer_height",
  "support",
  "difficulty",
  "aliases"
]);
