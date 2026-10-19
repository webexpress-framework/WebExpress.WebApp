/**
 * Targeted conflict scenarios of shared rich text editing. Two clients make concurrent edits
 * against the same version - both are in transit before either is confirmed - and the test
 * checks that both converge on a schema-valid document and that the documented conflict rule
 * of each case decided the outcome (see WebExpress.WebApp/docs/collaboration.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRuntime, Server, HeadlessEditor } from "./collaborative.sim.mjs";

/**
 * Builds a shared document with two connected clients.
 * @param {Function} build - Returns the top-level blocks, given the model.
 * @returns {object} The scenario.
 */
function scenario(build) {
    const rt = loadRuntime();
    const { Model, Ot } = rt;
    const server = new Server(rt);
    const up = [];
    const initial = Model.validate({ version: 1, doc: Model.node("doc", build(Model)) });
    const clients = ["c0", "c1"].map((name, i) => {
        const editor = new HeadlessEditor(rt, initial);
        const session = new rt.Session({ document: "scope/field", token: "t", client: name, secret: "s" + i, target: editor, send: m => up.push(JSON.parse(JSON.stringify(m))), onConflict: () => assert.fail("no conflict expected") });
        return { name, editor, session };
    });
    const flush = () => {
        for (let i = 0; i < 100 && (up.length || server.outbox.length); i++) {
            for (const m of up.splice(0)) server.receive(m);
            for (const { client, message } of server.outbox.splice(0)) clients.find(c => c.name === client).session.receive(message);
        }
    };
    clients.forEach(c => c.session.connect());
    flush();
    const [a, b] = clients;
    /** Performs an action on a client and hands its steps to the session. */
    const act = (client, action) => client.session.local(client.editor.act(action));
    /** Finds the caret position of an offset in the n-th text block. */
    const at = (client, block, offset = 0) => Model.entries(client.editor.state.doc).filter(e => Model.TEXT_BLOCKS.has(e.node.type))[block].start + offset;
    /** Finds the id of the n-th node of a type. */
    const id = (client, type, n = 0) => Model.entries(client.editor.state.doc).filter(e => e.node.type === type)[n].node.id;
    /** Asserts convergence on a valid document and returns the shared blocks. */
    const converged = () => {
        flush();
        const doc = server.docs.get("scope/field");
        assert.equal(server.valid(doc.tokens), true, "the shared document is schema-valid");
        for (const c of clients) {
            assert.equal(c.session.pending, false);
            assert.equal(Ot.stable(c.editor.getCollaborationTokens()), Ot.stable(Ot.compact(doc.tokens)), c.name + " shows the shared document");
        }
        return JSON.parse(JSON.stringify(a.editor.blocks()));
    };
    const text = (value, marks = {}) => ({ type: "text", text: value, marks });
    return { rt, Model, a, b, act, at, id, converged, text };
}

const p = (M, value) => M.node("p", value ? [{ type: "text", text: value, marks: {} }] : []);

test("insertions at the same position are ordered by the fixed client order", () => {
    const s = scenario(M => [p(M, "ab")]);
    s.act(s.a, { type: "insertText", text: "X", selection: { anchor: 1, focus: 1 } });
    s.act(s.b, { type: "insertText", text: "Y", selection: { anchor: 1, focus: 1 } });
    assert.deepEqual(s.converged(), ["aXYb"]);
});

test("text typed into a range another user deletes survives at the deletion point", () => {
    const s = scenario(M => [p(M, "alpha"), p(M, "beta")]);
    s.act(s.a, { type: "delete", selection: { anchor: s.at(s.a, 0, 2), focus: s.at(s.a, 1, 2) } });
    s.act(s.b, { type: "insertText", text: "NEW", selection: { anchor: s.at(s.b, 1, 1), focus: s.at(s.b, 1, 1) } });
    const blocks = s.converged();
    assert.equal(blocks.length, 1, "the paragraphs were merged");
    assert.ok(blocks[0].includes("NEW"));
});

test("formatting does not extend to text another user types inside the range", () => {
    const s = scenario(M => [p(M, "alpha")]);
    s.act(s.a, { type: "format", mark: "bold", selection: { anchor: 0, focus: 5 } });
    s.act(s.b, { type: "insertText", text: "Z", selection: { anchor: 2, focus: 2 } });
    s.converged();
    const runs = s.Model.leaves(s.a.editor.state.doc).filter(n => n.type === "text").map(n => [n.text, !!n.marks.bold]);
    assert.deepEqual(JSON.parse(JSON.stringify(runs)), [["al", true], ["Z", false], ["pha", true]]);
});

test("indenting a list item keeps the text another user types into it", () => {
    const s = scenario(M => [M.node("ul", [M.node("li", [p(M, "one")]), M.node("li", [p(M, "two")])])]);
    s.act(s.a, { type: "list", command: "indent", selection: { anchor: s.at(s.a, 1, 1), focus: s.at(s.a, 1, 1) } });
    s.act(s.b, { type: "insertText", text: "!", selection: { anchor: s.at(s.b, 1, 3), focus: s.at(s.b, 1, 3) } });
    assert.deepEqual(s.converged(), ["one", "two!"]);
    const nested = s.Model.entries(s.a.editor.state.doc).filter(e => e.node.type === "ul");
    assert.equal(nested.length, 2, "the item now lives in a nested list");
});

test("opposite list moves of the same item converge on a valid nesting", () => {
    const s = scenario(M => [M.node("ul", [M.node("li", [p(M, "one")]), M.node("li", [p(M, "two"), M.node("ul", [M.node("li", [p(M, "three")])])])])]);
    s.act(s.a, { type: "list", command: "outdent", selection: { anchor: s.at(s.a, 2, 0), focus: s.at(s.a, 2, 0) } });
    s.act(s.b, { type: "list", command: "indent", selection: { anchor: s.at(s.b, 1, 0), focus: s.at(s.b, 1, 0) } });
    assert.deepEqual(s.converged(), ["one", "two", "three"]);
});

test("a row inserted next to a cell another user types in keeps both", () => {
    const s = scenario(M => [M.node("table", [M.node("tbody", [M.node("tr", [M.node("td", [p(M, "a")]), M.node("td", [p(M, "b")])])])])]);
    s.act(s.a, { type: "table", command: "insertRowBelow", ids: [s.id(s.a, "td", 0)] });
    s.act(s.b, { type: "insertText", text: "+", selection: { anchor: s.at(s.b, 1, 1), focus: s.at(s.b, 1, 1) } });
    s.converged();
    assert.equal(s.Model.entries(s.a.editor.state.doc).filter(e => e.node.type === "tr").length, 2);
    assert.ok(s.a.editor.blocks().includes("b+"));
});

test("text typed into a table another user deletes is wrapped into a paragraph", () => {
    const s = scenario(M => [p(M, "before"), M.node("table", [M.node("tbody", [M.node("tr", [M.node("td", [p(M, "cell")])])])])]);
    s.act(s.a, { type: "table", command: "deleteTable", ids: [s.id(s.a, "td", 0)] });
    s.act(s.b, { type: "insertText", text: "kept", selection: { anchor: s.at(s.b, 1, 4), focus: s.at(s.b, 1, 4) } });
    const blocks = s.converged();
    assert.equal(s.Model.entries(s.a.editor.state.doc).some(e => e.node.type === "table"), false);
    assert.ok(blocks.some(b => b.includes("kept")), "nobody meant to delete the new text");
});

test("a background set on a cell of a column another user deletes is dropped", () => {
    const s = scenario(M => [M.node("table", [M.node("tbody", [M.node("tr", [M.node("td", [p(M, "a")]), M.node("td", [p(M, "b")])])])])]);
    s.act(s.a, { type: "table", command: "deleteColumn", ids: [s.id(s.a, "td", 1)] });
    s.act(s.b, { type: "table", command: "background", color: "#ff0000", ids: [s.id(s.b, "td", 1)] });
    assert.deepEqual(s.converged(), ["a"]);
});

test("resizing an image another user removes leaves it removed", () => {
    const s = scenario(M => [M.node("p", [{ type: "text", text: "x", marks: {} }, M.node("image", [], { src: "/a.png", alt: "" })])]);
    s.act(s.a, { type: "updateNode", id: s.id(s.a, "image"), attrs: { width: "50px" } });
    s.act(s.b, { type: "removeNode", id: s.id(s.b, "image") });
    assert.deepEqual(s.converged(), ["x"]);
});

test("text typed into a content container another user removes survives in the region", () => {
    const s = scenario(M => [p(M, "top"), M.node("addon", [p(M, "inside")], { name: "box", data: {}, container: true })]);
    s.act(s.a, { type: "removeNode", id: s.id(s.a, "addon") });
    s.act(s.b, { type: "insertText", text: "!", selection: { anchor: s.at(s.b, 1, 6), focus: s.at(s.b, 1, 6) } });
    const blocks = s.converged();
    assert.equal(s.Model.entries(s.a.editor.state.doc).some(e => e.node.type === "addon"), false);
    assert.ok(blocks.includes("!"), "the typed text was kept and given a paragraph");
});

test("a comment anchor shrinks with text another user deletes inside it", () => {
    const s = scenario(M => [p(M, "alpha beta gamma")]);
    s.act(s.a, { type: "comment", anchor: "c1", selection: { anchor: 6, focus: 10 } });
    s.act(s.b, { type: "delete", selection: { anchor: 7, focus: 9 } });
    s.converged();
    const anchored = s.Model.leaves(s.a.editor.state.doc).filter(n => n.type === "text" && n.marks.comment?.id === "c1").map(n => n.text).join("");
    assert.equal(anchored, "ba");
});

test("concurrent paragraph splits at the same place both take effect", () => {
    const s = scenario(M => [p(M, "abcd")]);
    s.act(s.a, { type: "split", selection: { anchor: 2, focus: 2 } });
    s.act(s.b, { type: "split", selection: { anchor: 2, focus: 2 } });
    const blocks = s.converged();
    assert.equal(blocks.join(""), "abcd");
    assert.ok(blocks.length >= 2);
});

test("undo removes only the own text even after the other user wrote next to it", () => {
    const s = scenario(M => [p(M, "ab")]);
    s.act(s.a, { type: "insertText", text: "X", selection: { anchor: 1, focus: 1 } });
    s.act(s.b, { type: "insertText", text: "Y", selection: { anchor: 2, focus: 2 } });
    s.converged();
    s.a.session.local(s.a.editor.undo());
    assert.deepEqual(s.converged(), ["abY"]);
});

for (const first of ["a", "b"]) {
    test(`undo after both users typed the same characters at one place removes exactly the own ones (${first} first)`, () => {
        const s = scenario(M => [p(M, "Type")]);
        const [x, y] = first === "a" ? [s.a, s.b] : [s.b, s.a];
        // the client sending second is rejected and rebases; when it also wins the tie, its text
        // lands in front of identical characters, which a diff would misread
        s.act(x, { type: "insertText", text: x === s.a ? "<A>" : "<B>", selection: { anchor: 0, focus: 0 } });
        s.act(y, { type: "insertText", text: y === s.a ? "<A>" : "<B>", selection: { anchor: 0, focus: 0 } });
        const merged = s.converged()[0];
        s.b.session.local(s.b.editor.undo());
        assert.deepEqual(s.converged(), [merged.replace("<B>", "")]);
        s.a.session.local(s.a.editor.undo());
        assert.deepEqual(s.converged(), ["Type"]);
    });
}
