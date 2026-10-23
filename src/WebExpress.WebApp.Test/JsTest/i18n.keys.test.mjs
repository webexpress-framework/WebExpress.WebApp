/**
 * Guards the i18n contract of the WebApp JavaScript layer: every translation
 * key referenced in the shipped sources must exist in the corresponding
 * dictionary, and the German and English dictionaries must stay in sync.
 * A key that misses the dictionary silently falls back to the hard-coded
 * English text, so German users never see the translation.
 *
 * Keys ending with a dot (e.g. "statustask.") are dynamic prefixes completed
 * at runtime; for those at least one dictionary entry must share the prefix.
 */
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webappAssetsJs = path.resolve(here, "..", "..", "WebExpress.WebApp", "Assets", "js");
const webuiAssetsJs = path.resolve(here, "..", "..", "..", "..", "WebExpress.WebUI", "src", "WebExpress.WebUI", "Assets", "js");

/**
 * Collects the absolute paths of all .js files below a directory.
 * @param {string} dir - The directory to walk.
 * @param {string[]} [acc] - The accumulator.
 * @returns {string[]} The absolute file paths.
 */
function walk(dir, acc = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(p, acc);
        } else if (entry.name.endsWith(".js")) {
            acc.push(p);
        }
    }
    return acc;
}

/**
 * Extracts the module-qualified i18n keys referenced in the sources.
 * @param {string} assetsDir - The Assets/js directory to scan.
 * @returns {Map<string, string>} Key to the first referencing file.
 */
function collectUsedKeys(assetsDir) {
    const used = new Map();
    for (const file of walk(assetsDir)) {
        if (/[\\/]i18n[\\/]/.test(file)) {
            continue;
        }
        const src = fs.readFileSync(file, "utf8");
        for (const m of src.matchAll(/["'`](webexpress\.web(?:ui|app):[A-Za-z0-9_.-]+)["'`]/g)) {
            if (!used.has(m[1])) {
                used.set(m[1], path.basename(file));
            }
        }
    }
    return used;
}

/**
 * Parses the keys of an i18n dictionary file (one key per line).
 * @param {string} file - The dictionary file.
 * @returns {Set<string>} The declared keys.
 */
function dictionaryKeys(file) {
    const keys = new Set();
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/^\s*["']([^"']+)["']\s*:/gm)) {
        keys.add(m[1]);
    }
    return keys;
}

/**
 * Checks a used key against a dictionary; a trailing-dot key is a dynamic
 * prefix that is satisfied by any entry sharing the prefix.
 * @param {string} bareKey - The key without the module qualifier.
 * @param {Set<string>} dict - The dictionary keys.
 * @returns {boolean} True when the key resolves.
 */
function resolves(bareKey, dict) {
    if (bareKey.endsWith(".")) {
        return [...dict].some((k) => k.startsWith(bareKey));
    }
    return dict.has(bareKey);
}

const used = collectUsedKeys(webappAssetsJs);
const webappEn = dictionaryKeys(path.join(webappAssetsJs, "i18n", "en.js"));
const webappDe = dictionaryKeys(path.join(webappAssetsJs, "i18n", "de.js"));
const webuiEn = dictionaryKeys(path.join(webuiAssetsJs, "i18n", "en.js"));

test("the German and English WebApp dictionaries declare the same keys", () => {
    const onlyDe = [...webappDe].filter((k) => !webappEn.has(k));
    const onlyEn = [...webappEn].filter((k) => !webappDe.has(k));
    assert.deepEqual(onlyDe, [], `keys only in de.js:\n${onlyDe.join("\n")}`);
    assert.deepEqual(onlyEn, [], `keys only in en.js:\n${onlyEn.join("\n")}`);
});

test("every webexpress.webapp key used in the sources exists in the dictionary", () => {
    const missing = [...used.keys()]
        .filter((k) => k.startsWith("webexpress.webapp:"))
        .filter((k) => !resolves(k.split(":")[1], webappEn))
        .map((k) => `${k} (${used.get(k)})`);
    assert.deepEqual(missing, [], `keys without a dictionary entry:\n${missing.join("\n")}`);
});

test("every webexpress.webui key used in the sources exists in the WebUI dictionary", () => {
    const missing = [...used.keys()]
        .filter((k) => k.startsWith("webexpress.webui:"))
        .filter((k) => !resolves(k.split(":")[1], webuiEn))
        .map((k) => `${k} (${used.get(k)})`);
    assert.deepEqual(missing, [], `keys without a dictionary entry:\n${missing.join("\n")}`);
});
