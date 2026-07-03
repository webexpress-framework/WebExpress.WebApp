/**
 * Guards the JavaScript asset manifest: every file under Assets/js must be
 * declared as an [Asset] attribute on IncludeJavaScript, and every declared
 * asset must exist on disk. A file without a declaration ships as an embedded
 * resource but is never delivered to the client, so the control it defines
 * silently stays dead; an orphaned declaration breaks the include at runtime.
 */
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const assetsJs = path.resolve(here, "..", "..", "WebExpress.WebApp", "Assets", "js");
const includeCs = path.resolve(here, "..", "..", "WebExpress.WebApp", "WebInclude", "IncludeJavaScript.cs");

/**
 * Collects the paths of all .js files below a directory, relative to that
 * directory and normalised to forward slashes.
 * @param {string} dir - The directory to walk.
 * @param {string} [prefix] - The accumulated relative prefix.
 * @param {string[]} [acc] - The accumulator.
 * @returns {string[]} The relative file paths.
 */
function walk(dir, prefix = "", acc = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), rel, acc);
        } else if (entry.name.endsWith(".js")) {
            acc.push(rel);
        }
    }
    return acc;
}

const onDisk = new Set(walk(assetsJs));
const declared = new Set(
    [...fs.readFileSync(includeCs, "utf8").matchAll(/\[Asset\("\/assets\/js\/([^"]+)"\)\]/g)].map((m) => m[1])
);

test("every JavaScript asset on disk is declared in IncludeJavaScript", () => {
    const missing = [...onDisk].filter((f) => !declared.has(f));
    assert.deepEqual(missing, [], `undeclared assets (never delivered to the client):\n${missing.join("\n")}`);
});

test("every declared JavaScript asset exists on disk", () => {
    const orphaned = [...declared].filter((f) => !onDisk.has(f));
    assert.deepEqual(orphaned, [], `declared assets missing on disk:\n${orphaned.join("\n")}`);
});
