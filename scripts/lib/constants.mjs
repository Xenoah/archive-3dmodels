export const ROOT = process.cwd();
export const CONTENT_MODELS_DIR = "content/models";
export const INBOX_DIR = "_inbox";
export const UPLOADED_DIR = "_uploaded";
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
export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
export const PREVIEW_EXTENSIONS = new Set([".glb"]);
export const STANDALONE_MODEL_EXTENSIONS = new Set([".fbx", ".step", ".stp", ".stl", ".3mf", ".obj", ".glb"]);
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

export const FORBIDDEN_FILENAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".npmrc",
  ".pypirc",
  "id_rsa",
  "id_dsa",
  "credentials.json",
  "service-account.json"
]);

export const SECRET_PATTERNS = [
  { name: "private key", pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "github token", pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { name: "generic api key", pattern: /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{16,}/i },
  { name: "aws access key", pattern: /AKIA[0-9A-Z]{16}/ }
];

export const PERSONAL_INFO_PATTERNS = [
  { name: "email address", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: "phone number", pattern: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/ },
  { name: "possible address", pattern: /(?:東京都|北海道|(?:京都|大阪)府|.{2,3}県).{0,40}(?:市|区|町|村).{0,60}/ }
];

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const WARN_FILE_BYTES = 50 * 1024 * 1024;
export const SLUG_RE = /^[^<>:"/\\|?*\x00-\x1F]+$/u;

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
  "createdAt",
  "uploaded",
  "uploadedAt",
  "updated",
  "updatedAt",
  "scale",
  "material",
  "printer",
  "nozzle",
  "layer_height",
  "support",
  "difficulty",
  "aliases"
]);
