/**
 * Builds the fixture that pins the server to the client: sequenced histories with their final
 * documents, schema verdicts for valid and hostile documents, and the outcome of applying
 * well-formed and malformed steps. The JavaScript test regenerates it and compares it with the
 * checked-in file; the C# test UnitTestCollaborativeFixture replays it against the server's
 * apply and schemas. Changing either side without the other fails one of the two.
 */
import { loadRuntime, random, scenario } from "./collaborative.sim.mjs";

/**
 * Builds the fixture deterministically.
 * @returns {object} The fixture.
 */
export function buildFixture() {
    const rt = loadRuntime();
    const { Ot, Model } = rt;
    const valid = tokens => { try { Model.check(Model.fromTokens(tokens)); return true; } catch { return false; } };
    const fixture = { version: 1, histories: [], verdicts: [], applies: [] };

    // histories as the sequencer recorded them
    for (const seed of [11, 12, 13, 14, 15, 16]) {
        const run = scenario({ seed, clients: 3, rounds: 160, faults: { reorder: 0, duplicate: 0 } });
        const doc = run.server.docs.get("scope/field");
        fixture.histories.push({ kind: "richtext", initial: doc.initialState, operations: doc.history.map(op => op.steps), final: Ot.compact(doc.tokens) });
    }

    // documents along the histories, valid by construction, and mutations of them
    const rnd = random(4711);
    const hostile = [
        ["src", "javascript:alert(1)"], ["src", " https://x"], ["src", "//evil"], ["href", "data:text/html,x"],
        ["colspan", 0], ["colspan", 2.5], ["colspan", "2"], ["colspan", 101], ["weight", 0], ["weight", 2.5], ["weight", 13],
        ["indent", 1.5], ["indent", 13], ["align", "inline"], ["align", "middle"], ["dir", "auto"], ["background", "url(x)"],
        ["background", ""], ["background", "rgb(1, 2,3)"], ["background", "﻿red"], ["start", 0], ["width", "100"],
        ["width", "100px"], ["width", "0px"], ["width", "12.5%"], ["alt", 5], ["alt", null], ["kind", "script"],
        ["name", 123], ["name", "a b"], ["name", "box\n"], ["scope", "row\n"], ["inline", "true"], ["container", true], ["data", { "on": "x" }], ["data", { "Key": 5 }],
        ["data", { "__proto__": "x" }], ["widths", [10]], ["widths", [30, 2000]], ["widths", "100"], ["scope", ""], ["extra", 1]
    ];
    const hostileMarks = [
        { bold: "yes" }, { bold: true, superscript: true, subscript: true }, { color: "expression(x)" }, { color: " red" },
        { color: "#ABCDEF" }, { color: "RGB(1, 2, 3)" }, { font: "Arial; x:y" }, { font: "Times New Roman" }, { size: "12" }, { size: "1.5em" },
        { link: { href: "javascript:x", target: "" } }, { link: { href: "https://x", target: "_top" } }, { link: { href: "mailto:a@b", target: "_blank" } },
        { link: "https://x" }, { comment: { id: "<x>" } }, { comment: { id: "c1", text: " pad " } }, { comment: { id: "c1", text: "" } },
        { comment: { id: "c1" } }, { comment: { id: "c1", text: "note", extra: 1 } }, { unknown: true }, { code: false }, { color: "red\n" }, { comment: { id: "c1\n" } }, { size: "12px\n" }
    ];
    const states = fixture.histories.flatMap(h => {
        let tokens = Ot.expand(h.initial);
        const out = [tokens];
        for (const steps of h.operations) { tokens = Ot.apply(tokens, steps).tokens; out.push(tokens); }
        return out.filter((_, i) => i % 5 === 0);
    });
    for (const tokens of states) {
        fixture.verdicts.push({ kind: "richtext", state: Ot.compact(tokens), valid: valid(tokens) });
        for (let i = 0; i < 6; i++) {
            const copy = tokens.map(t => ({ ...t }));
            const pick = rnd();
            const nodes = copy.map((t, p) => t.t === "o" || t.t === "l" ? p : -1).filter(p => p >= 0);
            const chars = copy.map((t, p) => t.t === "c" ? p : -1).filter(p => p >= 0);
            if (pick < 0.4 && nodes.length) {
                const p = nodes[Math.floor(rnd() * nodes.length)];
                const [key, value] = hostile[Math.floor(rnd() * hostile.length)];
                copy[p] = { ...copy[p], a: { ...copy[p].a, [key === "href" ? "src" : key]: value } };
            } else if (pick < 0.65 && chars.length) {
                const p = chars[Math.floor(rnd() * chars.length)];
                copy[p] = { ...copy[p], m: hostileMarks[Math.floor(rnd() * hostileMarks.length)] };
            } else if (pick < 0.75 && nodes.length) {
                const p = nodes[Math.floor(rnd() * nodes.length)];
                copy[p] = { ...copy[p], id: [copy[nodes[0]].id, "x" + p, copy[p].id + "\n"][Math.floor(rnd() * 3)] };
            } else if (pick < 0.9) {
                // structure out of place: a token moved, dropped or duplicated
                const p = Math.floor(rnd() * copy.length), q = Math.floor(rnd() * (copy.length + 1));
                const [token] = copy.splice(p, 1);
                if (rnd() < 0.7) copy.splice(Math.min(q, copy.length), 0, token);
            } else {
                const inserts = [
                    [{ t: "o", n: "li", id: "n90001", a: {} }, { t: "o", n: "p", id: "n90002", a: {} }, { t: "e", n: "p", id: "n90002" }, { t: "e", n: "li", id: "n90001" }],
                    [{ t: "c", v: "x", m: {} }],
                    [{ t: "o", n: "div", id: "n90003", a: {} }, { t: "e", n: "div", id: "n90003" }],
                    [{ t: "l", n: "hr", id: "n90004", a: {} }],
                    [{ t: "o", n: "image", id: "n90005", a: { src: "/x.png", alt: "" } }, { t: "e", n: "image", id: "n90005" }]
                ];
                copy.splice(Math.floor(rnd() * (copy.length + 1)), 0, ...inserts[Math.floor(rnd() * inserts.length)]);
            }
            fixture.verdicts.push({ kind: "richtext", state: Ot.compact(copy), valid: valid(copy) });
        }
    }

    // plain text and graphs, judged by the schemas without a model of their own
    const { OtSchema } = rt;
    const texts = [
        [{ t: "s", v: "status = open", m: {} }], [{ t: "s", v: "a\nb", m: {} }], [{ t: "s", v: "a\rb", m: {} }], [{ t: "s", v: "x", m: { bold: true } }],
        [{ t: "l", n: "image", id: "i", a: {} }], [{ t: "s", v: "x".repeat(100001), m: {} }], []
    ];
    for (const slice of texts) fixture.verdicts.push({ kind: "text", state: Ot.compact(Ot.expand(slice)), valid: OtSchema.checkText(Ot.expand(slice)) });
    const node = (id, a = {}) => ({ t: "l", n: "node", id, a });
    const edge = (id, from, to, a = {}) => ({ t: "l", n: "edge", id, a: { from, to, ...a } });
    const graphs = [
        [node("a", { x: 1, y: 2.5, label: "A", hasPosition: true }), node("b"), edge("e", "a", "b", { waypoints: [{ x: 1, y: 2 }], label: "go" })],
        [node("a"), edge("e", "a", "missing")], [node("a"), node("a")], [node("a"), edge("a", "a", "a")], [node("a"), edge("e", "a", "a"), edge("e", "a", "a")],
        [node("")], [node("a\nb")], [node("a\u0001")], [node("x".repeat(200))], [node("x".repeat(201))],
        [node("a", { "bad key": 1 })], [node("a", { __proto__x: 1 })], [node("a", { _ok: 1 })], [node("a", { "9lives": 1 })], [node("a", { k: "x".repeat(10001) })],
        [node("a", { k: [[[[1]]]] })], [node("a", { k: [[[1]]] })], [node("a", { k: { a: { b: { c: 1 } } } })], [node("a", { k: null, f: false })],
        [{ t: "o", n: "node", id: "a", a: {} }, { t: "e", n: "node", id: "a" }], [{ t: "c", v: "x", m: {} }], [edge("e", "a", "b")], [node("a", { from: 5 })]
    ];
    for (const tokens of graphs) {
        const expanded = Ot.expand(JSON.parse(JSON.stringify(tokens)));
        fixture.verdicts.push({ kind: "graph", state: Ot.compact(expanded), valid: OtSchema.checkGraph(expanded) });
    }

    // applying steps, including malformed ones that both sides must refuse
    const base = Ot.expand([{ t: "o", n: "p", id: "n1", a: {} }, { t: "s", v: "abc", m: { superscript: true } }, { t: "l", n: "image", id: "n2", a: { src: "/a.png", alt: "" } }, { t: "e", n: "p", id: "n1" }]);
    const cases = [
        [{ type: "replace", from: 1, to: 3, slice: [{ t: "s", v: "XY", m: { bold: true } }] }],
        [{ type: "replace", from: 0, to: 6, slice: [] }],
        [{ type: "replace", from: 2, to: 7, slice: [] }],
        [{ type: "replace", from: 3, to: 2, slice: [] }],
        [{ type: "replace", from: 1.5, to: 2, slice: [] }],
        [{ type: "replace", from: "1", to: 2, slice: [] }],
        [{ type: "replace", from: 1, to: 1 }],
        [{ type: "replace", from: 1, to: 1, slice: null }],
        [{ type: "replace", from: 1, to: 1, slice: [{ t: "s", v: "" }] }],
        [{ type: "replace", from: 1, to: 1, slice: [{ t: "c", v: "ab" }] }],
        [{ type: "replace", from: 1, to: 1, slice: [{ t: "s", v: "a", m: null }] }],
        [{ type: "replace", from: 1, to: 1, slice: [{ t: "o", n: "p", id: "n9", a: null }] }],
        [{ type: "replace", from: 1, to: 1, slice: [{ t: "o", n: "", id: "n9" }] }],
        [{ type: "replace", from: 1, to: 1, slice: [{ t: "e", n: "p", id: 5 }] }],
        [{ type: "replace", from: 1, to: 1, slice: [{ t: "q" }] }],
        [{ type: "addMark", from: 1, to: 4, name: "subscript", value: true }],
        [{ type: "addMark", from: 0, to: 6, name: "color", value: "red" }],
        [{ type: "addMark", from: 1, to: 2, name: "bold", value: false }],
        [{ type: "addMark", from: 1, to: 2, name: "bold" }],
        [{ type: "addMark", from: 1, to: 2, name: "", value: true }],
        [{ type: "removeMark", from: 1, to: 4, name: "superscript" }],
        [{ type: "removeMark", from: 4, to: 9, name: "bold" }],
        [{ type: "setAttr", pos: 4, id: "n2", key: "alt", value: "x" }],
        [{ type: "setAttr", pos: 4, key: "width", value: null }],
        [{ type: "setAttr", pos: 0, id: "n9", key: "align", value: "left" }],
        [{ type: "setAttr", pos: 0, id: 1, key: "align", value: "left" }],
        [{ type: "setAttr", pos: 5, id: "n1", key: "align", value: "left" }],
        [{ type: "setAttr", pos: 1, key: "align", value: "left" }],
        [{ type: "setAttr", pos: 6, key: "align", value: "left" }],
        [{ type: "setAttr", pos: 0, key: "", value: "left" }],
        [{ type: "explode" }],
        [null],
        [{ type: "replace", from: 4, to: 4, slice: [{ t: "s", v: "z", m: {} }] }, { type: "addMark", from: 4, to: 5, name: "italic", value: true }, { type: "setAttr", pos: 0, key: "align", value: "center" }]
    ];
    for (const steps of cases) {
        let result = null;
        try { result = Ot.compact(Ot.apply(base, steps).tokens); } catch { result = null; }
        fixture.applies.push({ tokens: Ot.compact(base), steps, result });
    }
    return JSON.parse(JSON.stringify(fixture));
}
