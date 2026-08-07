/**
 * Guards the JavaScript asset manifest: every file under Assets/js must be
 * declared as an [Asset] attribute on IncludeJavaScript, and every declared
 * asset must exist on disk. A file without a declaration ships as an embedded
 * resource but is never delivered to the client, so the control it defines
 * silently stays dead; an orphaned declaration breaks the include at runtime.
 *
 * The declaration order matters as well: the assets are delivered as plain
 * scripts, so a control class whose base class lives in another file only
 * evaluates once that file ran. A base declared too late fails the page with
 * "Class extends value undefined", which the ordering test below rules out.
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
const order = [...fs.readFileSync(includeCs, "utf8").matchAll(/\[Asset\("\/assets\/js\/([^"]+)"\)\]/g)].map((m) => m[1]);
const declared = new Set(order);

test("every JavaScript asset on disk is declared in IncludeJavaScript", () => {
    const missing = [...onDisk].filter((f) => !declared.has(f));
    assert.deepEqual(missing, [], `undeclared assets (never delivered to the client):\n${missing.join("\n")}`);
});

test("every declared JavaScript asset exists on disk", () => {
    const orphaned = [...declared].filter((f) => !onDisk.has(f));
    assert.deepEqual(orphaned, [], `declared assets missing on disk:\n${orphaned.join("\n")}`);
});

test("a control is declared after the WebApp base class it extends", () => {
    // where each webexpress.webapp class is defined, and which webapp class each
    // file extends; both are read from the shipped sources rather than from a
    // hand kept list, so a new derivation is covered without touching this test
    const definedIn = new Map();
    const extendsOf = new Map();

    for (const file of order.filter((f) => onDisk.has(f))) {
        const code = fs.readFileSync(path.join(assetsJs, file), "utf8");

        for (const match of code.matchAll(/webexpress\.webapp\.(\w+)\s*=\s*class\b/g)) {
            if (!definedIn.has(match[1])) {
                definedIn.set(match[1], file);
            }
        }
        for (const match of code.matchAll(/=\s*class\s+extends\s+webexpress\.webapp\.(\w+)/g)) {
            (extendsOf.get(file) || extendsOf.set(file, new Set()).get(file)).add(match[1]);
        }
    }

    const violations = [];
    for (const [file, bases] of extendsOf) {
        for (const base of bases) {
            const baseFile = definedIn.get(base);
            if (baseFile && baseFile !== file && order.indexOf(baseFile) > order.indexOf(file)) {
                violations.push(`${file} extends webexpress.webapp.${base}, defined later in ${baseFile}`);
            }
        }
    }

    assert.deepEqual(violations, [], `base classes declared after their derived control:\n${violations.join("\n")}`);
});
