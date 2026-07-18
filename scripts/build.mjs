import { promises as fs } from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const urls = {
  readme: "https://raw.githubusercontent.com/MetaJam/MetaJam/main/README.md",
  news: "https://raw.githubusercontent.com/MetaJam/MetaJam/refs/heads/main/NEWS.md",
  citation: "https://raw.githubusercontent.com/MetaJam/MetaJam/refs/heads/main/CITATION.cff"
};

function assertInsideRoot(target) {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside project root: ${resolved}`);
  }
  return resolved;
}

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Request failed for ${url}: ${response.statusCode}`));
          response.resume();
          return;
        }
        response.setEncoding("utf8");
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => resolve(body));
      })
      .on("error", reject);
  });
}

async function readLocalOrRemote(filename, url) {
  const localPath = path.join(root, filename);
  if (await fileExists(localPath)) {
    return fs.readFile(localPath, "utf8");
  }
  return fetchText(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderInline(markdown) {
  const links = [];
  let safe = escapeHtml(markdown).replace(/\[([^\]]+)]\(([^)]+)\)/g, (match, label, href) => {
    const id = links.length;
    links.push({ label, href });
    return `@@LINK${id}@@`;
  });
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  links.forEach((link, index) => {
    const href = escapeHtml(link.href);
    const label = escapeHtml(link.label);
    safe = safe.replace(`@@LINK${index}@@`, `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`);
  });
  return safe;
}

function renderMarkdown(lines) {
  const html = [];
  let list = [];
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length) {
      html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      html.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      list = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return html.join("");
}

function parseNews(markdown) {
  const releases = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      if (current) releases.push(current);
      current = {
        title: heading[2].trim(),
        level: heading[1].length,
        lines: []
      };
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (current) releases.push(current);

  return releases.map((release) => ({
    title: release.title,
    slug: slugify(release.title),
    html: renderMarkdown(release.lines)
  }));
}

function parseHeadings(markdown) {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.match(/^(#{1,6})\s+(.+?)\s*#*$/))
    .filter(Boolean)
    .map((match) => ({
      level: match[1].length,
      title: match[2].trim(),
      slug: slugify(match[2].trim())
    }));
}

function initialsFor(givenNames) {
  return givenNames
    .split(/\s+/)
    .filter(Boolean)
    .map((name) =>
      name
        .split(".")
        .filter(Boolean)
        .map((part) => `${part[0].toUpperCase()}.`)
        .join(" ")
    )
    .join(" ");
}

function formatAuthor(author) {
  return `${author.familyNames}, ${initialsFor(author.givenNames)}`;
}

function formatAuthorList(authors) {
  if (!authors.length) return "";
  if (authors.length === 1) return formatAuthor(authors[0]);
  if (authors.length === 2) return `${formatAuthor(authors[0])} & ${formatAuthor(authors[1])}`;
  return `${authors.slice(0, -1).map(formatAuthor).join(", ")}, & ${formatAuthor(authors.at(-1))}`;
}

function cffValue(line) {
  return line
    .replace(/^[^:]+:\s*/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function parseCitation(cff) {
  const lines = cff.replace(/\r\n/g, "\n").split("\n");
  const citation = {
    title: "",
    doi: "",
    dateReleased: "",
    repositoryCode: "",
    license: "",
    authors: []
  };
  let currentAuthor = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("title:")) citation.title = cffValue(line);
    if (line.startsWith("doi:")) citation.doi = cffValue(line);
    if (line.startsWith("date-released:")) citation.dateReleased = cffValue(line);
    if (line.startsWith("repository-code:")) citation.repositoryCode = cffValue(line);
    if (line.startsWith("license:")) citation.license = cffValue(line);

    if (line.startsWith("- given-names:")) {
      currentAuthor = { givenNames: cffValue(line), familyNames: "" };
      citation.authors.push(currentAuthor);
      continue;
    }
    if (currentAuthor && line.startsWith("family-names:")) {
      currentAuthor.familyNames = cffValue(line);
    }
  }

  const year = citation.dateReleased ? citation.dateReleased.slice(0, 4) : "n.d.";
  const doiUrl = citation.doi ? `https://doi.org/${citation.doi}` : "";
  const authorText = formatAuthorList(citation.authors);
  citation.formatted = `${authorText} (${year}). ${citation.title} [Computer software]. Zenodo. ${doiUrl}`.trim();
  citation.download = "./assets/generated/CITATION.cff";
  return citation;
}

async function listScreenshots() {
  const source = path.join(root, "screenshots");
  if (!(await fileExists(source))) return [];

  const entries = await fs.readdir(source, { withFileTypes: true });
  const images = entries
    .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp|gif|avif)$/i.test(entry.name))
    .map((entry) => {
      const name = entry.name;
      const label = path.basename(name, path.extname(name)).replace(/[-_]+/g, " ");
      return {
        src: `./screenshots/${encodeURIComponent(name)}`,
        alt: `MetaJam screenshot: ${label}`,
        title: label.replace(/\b\w/g, (char) => char.toUpperCase())
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return images;
}

async function copyIfExists(source, target) {
  if (await fileExists(source)) {
    await fs.cp(source, target, { recursive: true });
  }
}

async function build() {
  assertInsideRoot(dist);
  await fs.rm(dist, { recursive: true, force: true });

  await fs.mkdir(path.join(dist, "assets", "generated"), { recursive: true });
  await fs.mkdir(path.join(dist, "screenshots"), { recursive: true });

  const [readme, news, citationCff] = await Promise.all([
    readLocalOrRemote("README.md", urls.readme),
    fetchText(urls.news),
    fetchText(urls.citation)
  ]);

  const releases = parseNews(news);
  const headings = parseHeadings(readme);
  const citation = parseCitation(citationCff);
  const screenshots = await listScreenshots();

  await Promise.all([
    fs.copyFile(path.join(root, "src", "index.html"), path.join(dist, "index.html")),
    fs.copyFile(path.join(root, "src", "404.html"), path.join(dist, "404.html")),
    fs.copyFile(path.join(root, "src", "styles.css"), path.join(dist, "styles.css")),
    fs.copyFile(path.join(root, "src", "app.js"), path.join(dist, "app.js")),
    copyIfExists(path.join(root, "src", "docs"), path.join(dist, "docs")),
    copyIfExists(path.join(root, "assets"), path.join(dist, "assets")),
    copyIfExists(path.join(root, "screenshots"), path.join(dist, "screenshots")),
    fs.writeFile(path.join(dist, "assets", "generated", "releases.json"), JSON.stringify(releases, null, 2)),
    fs.writeFile(path.join(dist, "assets", "generated", "screenshots.json"), JSON.stringify(screenshots, null, 2)),
    fs.writeFile(path.join(dist, "assets", "generated", "readme-headings.json"), JSON.stringify(headings, null, 2)),
    fs.writeFile(path.join(dist, "assets", "generated", "citation.json"), JSON.stringify(citation, null, 2)),
    fs.writeFile(path.join(dist, "assets", "generated", "CITATION.cff"), citationCff)
  ]);

  console.log(`Built MetaJam docs with ${releases.length} release card(s), ${screenshots.length} screenshot(s), and ${headings.length} README heading(s).`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
