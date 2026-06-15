function parseScalar(raw) {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value === "[]") return [];
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => parseScalar(item));
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export function parseFrontmatter(input) {
  const text = input.replace(/^\uFEFF/, "");
  const frontmatter = extractFrontmatter(text);
  if (!frontmatter) return { data: {}, body: text };

  const { yaml, body } = frontmatter;
  const data = {};
  const lines = yaml.includes("\n") ? yaml.split("\n") : splitInlineYaml(yaml);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const match = /^([A-Za-z0-9_]+):(?:\s*(.*))?$/.exec(line);
    if (!match) continue;
    const [, key, rawValue = ""] = match;

    if (rawValue.trim() === "") {
      const items = [];
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
        i += 1;
        items.push(parseScalar(lines[i].replace(/^\s+-\s+/, "")));
      }
      data[key] = items;
      continue;
    }

    data[key] = parseScalar(rawValue);
  }

  return { data, body };
}

function extractFrontmatter(text) {
  if (text.startsWith("---\n") || text.startsWith("---\r\n")) {
    const end = text.indexOf("\n---", 4);
    if (end === -1) return null;

    const yaml = text.slice(4, end).replace(/\r\n/g, "\n");
    const restStart = text.indexOf("\n", end + 4);
    const body = restStart === -1 ? "" : text.slice(restStart + 1);
    return { yaml, body };
  }

  const inline = /^---[ \t]+([\s\S]*?)[ \t]+---(?:\r?\n|$)/.exec(text);
  if (!inline) return null;

  return {
    yaml: inline[1].trim(),
    body: text.slice(inline[0].length)
  };
}

function splitInlineYaml(yaml) {
  const keyRanges = [];
  let inQuote = "";
  let escaped = false;

  for (let i = 0; i < yaml.length; i += 1) {
    const char = yaml[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inQuote === '"') {
      escaped = true;
      continue;
    }
    if (inQuote) {
      if (char === inQuote) inQuote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      inQuote = char;
      continue;
    }

    const before = i === 0 || /\s/.test(yaml[i - 1]);
    if (!before) continue;

    const match = /^[A-Za-z0-9_]+:(?=\s|$)/.exec(yaml.slice(i));
    if (match) keyRanges.push({ start: i, keyEnd: i + match[0].length });
  }

  return keyRanges.map((range, index) => {
    const next = keyRanges[index + 1]?.start ?? yaml.length;
    return `${yaml.slice(range.start, range.keyEnd)} ${yaml.slice(range.keyEnd, next).trim()}`.trimEnd();
  });
}

function stringifyScalar(value) {
  if (Array.isArray(value)) return `[${value.map(stringifyScalar).join(", ")}]`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return '""';
  const text = String(value);
  if (/^[a-z0-9_.:/ -]+$/i.test(text)) return JSON.stringify(text);
  return JSON.stringify(text);
}

export function stringifyFrontmatter(data, body) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && value.length > 0) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${stringifyScalar(item)}`);
    } else {
      lines.push(`${key}: ${stringifyScalar(value)}`);
    }
  }
  lines.push("---", "", body.trimStart());
  return lines.join("\n");
}
