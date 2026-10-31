/**
 * Guards the i18n keys of the relation feature against the two bundles that
 * answer them.
 *
 * A missing key fails nothing at runtime: the framework answers the key itself,
 * so the surface quietly shows `webexpress.webapp:relation.type.causes.inverse`
 * where a caption belongs. Nothing catches that but an eye on the screen - or
 * this test, which reads the shipped sources and the shipped bundles and
 * compares them.
 *
 * The two sides are separate bundles for a reason: the server translates the
 * registry labels and its rejection codes out of `Internationalization/*`, the
 * client translates its captions out of `Assets/js/i18n/*`. A key therefore has
 * to be in the bundle of the side that asks for it.
 *
 * The check is scoped to the `relation.` prefix. The rest of the bundles carries
 * gaps that predate this feature, and widening the guard would report them here
 * rather than where they belong.
 */

import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, "..", "..", "WebExpress.WebApp");

const PREFIX = "relation.";
const QUALIFIED = /"webexpress\.webapp:([a-zA-Z0-9._]+)"/g;

// the dialog pages qualify their key at runtime, so the key alone is in the source
const BARE = /_(?:text|caption)\(modal,\s*"([a-zA-Z0-9._]+)"/g;

/**
 * Collects the files below a directory that carry one of the extensions.
 * @param {string} directory - The directory to walk.
 * @param {Array<string>} extensions - The file extensions to collect.
 * @param {Array<string>} [acc] - The accumulator.
 * @returns {Array<string>} The absolute file paths.
 */
function walk(directory, extensions, acc = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            if (entry.name !== "bin" && entry.name !== "obj" && entry.name !== "i18n") {
                walk(full, extensions, acc);
            }
        } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
            acc.push(full);
        }
    }

    return acc;
}

/**
 * Returns the relation keys the sources ask for, with the file each came from.
 * @param {Array<string>} files - The files to read.
 * @param {Array<RegExp>} patterns - The patterns that find a key.
 * @returns {Map<string, string>} The key and the file asking for it.
 */
function asked(files, patterns) {
    const keys = new Map();

    for (const file of files) {
        const code = fs.readFileSync(file, "utf8");

        for (const pattern of patterns) {
            for (const match of code.matchAll(new RegExp(pattern.source, "g"))) {
                if (match[1].startsWith(PREFIX)) {
                    keys.set(match[1], path.basename(file));
                }
            }
        }
    }

    return keys;
}

/**
 * Returns the relation keys a bundle defines.
 * @param {string} file - The bundle file.
 * @param {RegExp} pattern - The pattern that finds a definition.
 * @returns {Set<string>} The keys.
 */
function defined(file, pattern) {
    const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");

    return new Set([...text.matchAll(pattern)].map((match) => match[1]).filter((key) => key.startsWith(PREFIX)));
}

const serverBundles = ["de", "en"].map((name) => ({
    name: `Internationalization/${name}`,
    keys: defined(path.join(project, "Internationalization", name), /^([a-zA-Z0-9._]+)=/gm)
}));

const clientBundles = ["de.js", "en.js"].map((name) => ({
    name: `i18n/${name}`,
    keys: defined(path.join(project, "Assets", "js", "i18n", name), /"([a-zA-Z0-9._]+)"\s*:/g)
}));

test("every relation key the server asks for is in the server bundles", () => {
    const keys = asked(walk(project, [".cs"]), [QUALIFIED]);

    assert.ok(keys.size > 0, "the sources ask for relation keys at all");

    for (const bundle of serverBundles) {
        const missing = [...keys].filter(([key]) => !bundle.keys.has(key));

        assert.deepEqual(missing, [], `${bundle.name} does not answer:\n${missing.map(([k, f]) => `${k} (${f})`).join("\n")}`);
    }
});

test("every relation key the client asks for is in the client bundles", () => {
    const keys = asked(walk(path.join(project, "Assets", "js"), [".js"]), [QUALIFIED, BARE]);

    assert.ok(keys.size > 0, "the sources ask for relation keys at all");

    for (const bundle of clientBundles) {
        const missing = [...keys].filter(([key]) => !bundle.keys.has(key));

        assert.deepEqual(missing, [], `${bundle.name} does not answer:\n${missing.map(([k, f]) => `${k} (${f})`).join("\n")}`);
    }
});

test("the relation keys read in both languages", () => {
    for (const [de, en] of [serverBundles, clientBundles]) {
        const onlyDe = [...de.keys].filter((key) => !en.keys.has(key)).sort();
        const onlyEn = [...en.keys].filter((key) => !de.keys.has(key)).sort();

        assert.deepEqual(onlyDe, [], `only in ${de.name}`);
        assert.deepEqual(onlyEn, [], `only in ${en.name}`);
    }
});

test("the rejection codes of the endpoints are translated on both sides", () => {
    // a refused write answers a code the client translates for its notification
    // and the server translates for its own message, so the code has to be a key
    // of both bundles
    const validation = fs.readFileSync(
        path.join(project, "WebRelation", "RelationValidationResult.cs"), "utf8");
    const codes = [...validation.matchAll(/public const string \w+ = "([a-zA-Z0-9._]+)"/g)]
        .map((match) => match[1])
        .filter((code) => code.startsWith(PREFIX));

    assert.ok(codes.length > 0, "the validation declares codes");

    for (const bundle of [...serverBundles, ...clientBundles]) {
        const missing = codes.filter((code) => !bundle.keys.has(code));

        assert.deepEqual(missing, [], `${bundle.name} does not answer: ${missing.join(", ")}`);
    }
});
