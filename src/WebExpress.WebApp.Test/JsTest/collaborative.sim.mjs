/**
 * A deterministic simulation of shared editing: a sequencer that follows the server contract of
 * CollaborativeDocumentManager (rebase principle, no transformation on the server), headless
 * clients built from the shipped model, transformation core and session, and a network that
 * delays, reorders, duplicates and drops messages and breaks connections.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webui = path.resolve(here, "..", "..", "..", "..", "WebExpress.WebUI", "src", "WebExpress.WebUI", "Assets", "js");
const webapp = path.resolve(here, "..", "..", "WebExpress.WebApp", "Assets", "js");

/**
 * Loads the model, the transformation core and the session into one DOM-free context.
 * @returns {object} The namespaces.
 */
export function loadRuntime() {
    // a fixed clock keeps generated comment ids, and with them every run, reproducible
    const FixedDate = class extends Date { static now() { return 1760000000000; } };
    const sandbox = vm.createContext({ webexpress: { webui: {}, webapp: {} }, Intl, console, Date: FixedDate });
    for (const file of [path.join(webui, "webexpress.webui.ot.js"), path.join(webui, "webexpress.webui.editor.model.js"), path.join(webapp, "webexpress.webapp.collaborative.document.js")]) {
        vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: path.basename(file) });
    }
    return { Ot: sandbox.webexpress.webui.Ot, OtSchema: sandbox.webexpress.webui.OtSchema, Model: sandbox.webexpress.webui.EditorModel, Session: sandbox.webexpress.webapp.CollaborativeDocument, sandbox };
}

/**
 * A deterministic pseudo random generator, so a failing seed reproduces.
 * @param {number} seed - The seed.
 * @returns {Function} A function returning numbers in [0, 1).
 */
export function random(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/**
 * The sequencer. It applies and validates operations but never transforms them; an operation
 * on an outdated base is rejected with the operations its sender missed.
 */
export class Server {
    /**
     * Initializes the sequencer.
     * @param {object} rt - The runtime.
     * @param {object} [options] - The options.
     * @param {number} [options.retain=Infinity] - How many operations stay available for resuming.
     */
    constructor(rt, options = {}) {
        this.rt = rt; this.docs = new Map(); this.retain = options.retain ?? Infinity; this.outbox = [];
    }

    /**
     * Validates a document of the rich text kind the way the server's schema does.
     * @param {Array<object>} tokens - The tokens.
     * @returns {boolean} True if valid.
     */
    valid(tokens) {
        try { this.rt.Model.check(this.rt.Model.fromTokens(tokens)); return true; } catch { return false; }
    }

    /**
     * Queues a message to a client.
     * @param {string} client - The receiving client.
     * @param {object} message - The message.
     */
    reply(client, message) { this.outbox.push({ client, message: JSON.parse(JSON.stringify({ protocol: 1, ...message })) }); }

    /**
     * Queues a reply meant for one session, as the server addresses it.
     * @param {string} client - The receiving client.
     * @param {object} message - The message.
     */
    direct(client, message) { this.reply(client, { ...message, to: client }); }

    /**
     * Handles a message from a client.
     * @param {object} m - The message.
     */
    receive(m) {
        const { Ot } = this.rt, P = "webexpress.webapp.collaborative.ot.";
        let doc = this.docs.get(m.document);
        if (doc && doc.secrets.has(m.client) && doc.secrets.get(m.client) !== m.secret) { this.direct(m.client, { type: P + "reject", document: m.document, reason: "forbidden" }); return; }
        const type = m.type.slice(P.length);
        if (type === "join") {
            if (!doc) {
                const tokens = Ot.expand(m.state);
                if (!this.valid(tokens)) { this.direct(m.client, { type: P + "reject", document: m.document, reason: "invalid" }); return; }
                doc = { version: 0, tokens, initialState: Ot.compact(tokens), history: [], clients: {}, acks: new Map(), secrets: new Map(), members: new Set(), first: 1 };
                this.docs.set(m.document, doc);
            }
            doc.secrets.set(m.client, m.secret); doc.members.add(m.client);
            this.direct(m.client, { type: P + "state", document: m.document, version: doc.version, state: Ot.compact(doc.tokens), clients: { ...doc.clients } });
            return;
        }
        if (!doc) { this.direct(m.client, { type: P + "reject", document: m.document, reason: "unknown" }); return; }
        doc.secrets.set(m.client, m.secret); doc.members.add(m.client);
        if (type === "resume") {
            if (m.version + 1 < doc.first) this.direct(m.client, { type: P + "state", document: m.document, version: doc.version, state: Ot.compact(doc.tokens), clients: { ...doc.clients } });
            else this.direct(m.client, { type: P + "operations", document: m.document, resumed: true, operations: doc.history.filter(op => op.version > m.version) });
            return;
        }
        if (type !== "submit") return;
        for (const op of m.operations) {
            const known = doc.acks.get(op.client + ":" + op.seq);
            if (known !== undefined) { this.direct(m.client, { type: P + "ack", document: m.document, version: doc.version, operations: [{ id: op.id, seq: op.seq, version: known }] }); continue; }
            if (op.base !== doc.version) {
                if (op.base + 1 < doc.first) this.direct(m.client, { type: P + "reject", document: m.document, reason: "version", seq: op.seq, version: doc.version, operations: [], state: Ot.compact(doc.tokens), clients: { ...doc.clients } });
                else this.direct(m.client, { type: P + "reject", document: m.document, reason: "version", seq: op.seq, version: doc.version, operations: doc.history.filter(h => h.version > op.base) });
                return;
            }
            let applied;
            try { applied = Ot.apply(doc.tokens, op.steps); } catch { applied = null; }
            if (!applied || !this.valid(applied.tokens)) { this.direct(m.client, { type: P + "reject", document: m.document, reason: "invalid", seq: op.seq, version: doc.version }); return; }
            doc.version++; doc.tokens = applied.tokens;
            const entry = { id: op.id, client: op.client, seq: op.seq, base: op.base, version: doc.version, steps: applied.steps };
            doc.history.push(entry); doc.clients[op.client] = op.seq; doc.acks.set(op.client + ":" + op.seq, doc.version);
            while (doc.history.length > this.retain) { doc.history.shift(); doc.first++; }
            this.direct(m.client, { type: P + "ack", document: m.document, version: doc.version, operations: [{ id: op.id, seq: op.seq, version: doc.version }] });
            for (const member of doc.members) this.reply(member, { type: P + "operations", document: m.document, operations: [entry] });
        }
    }
}

/**
 * A shared control without a DOM: it edits through the shipped reducer and implements the
 * collaboration methods the session uses.
 */
export class HeadlessEditor {
    /**
     * Initializes the control.
     * @param {object} rt - The runtime.
     * @param {object} state - The validated initial editor state.
     */
    constructor(rt, state) {
        this.rt = rt; this.state = rt.Model.clone(state); this.applied = [];
        this.history = rt.sandbox.webexpress.webui.OtHistory ? new rt.sandbox.webexpress.webui.OtHistory({ now: () => 0 }) : null;
    }

    get collaborationKind() { return "richtext"; }

    getCollaborationTokens() { return this.rt.Ot.compact(this.rt.Model.tokens(this.state.doc)); }

    loadCollaborationTokens(tokens) {
        const { Model, Ot } = this.rt;
        try { this.state.doc = Model.check(Model.fromTokens(Ot.expand(tokens), { id: this.state.doc.id })); } catch { return false; }
        this.state.selection = { anchor: 0, focus: 0 };
        return true;
    }

    checkCollaborationTokens(tokens) {
        const { Model, Ot } = this.rt;
        try { Model.check(Model.fromTokens(Ot.expand(tokens))); return true; } catch { return false; }
    }

    repairCollaborationTokens(tokens) {
        const { Model, Ot } = this.rt;
        try { return Ot.compact(Model.repairTokens(Ot.expand(tokens))); } catch { return null; }
    }

    applyRemoteSteps(steps) {
        const { Model, Ot } = this.rt;
        const tokens = Model.tokens(this.state.doc);
        let doc, result;
        try { result = Ot.apply(tokens, steps); doc = Model.check(Model.fromTokens(result.tokens, { id: this.state.doc.id })); } catch { return false; }
        const from = Model.linearMap(this.state.doc), to = Model.linearMap(doc);
        const sel = Ot.mapSelection({ anchor: Model.toLinear(this.state.doc, this.state.selection.anchor, from), focus: Model.toLinear(this.state.doc, this.state.selection.focus, from) }, result.steps, 1);
        this.state = { version: 1, doc, selection: { anchor: Model.fromLinear(doc, sel.anchor, to), focus: Model.fromLinear(doc, sel.focus, to) }, storedMarks: null };
        this.history?.remote(result.steps);
        return true;
    }

    getModelSelection() {
        const { Model } = this.rt;
        return { anchor: Model.toLinear(this.state.doc, this.state.selection.anchor), focus: Model.toLinear(this.state.doc, this.state.selection.focus) };
    }

    /**
     * Performs one random edit through the reducer and returns its applied steps.
     * @param {Function} rnd - The random source.
     * @param {string} tag - The client tag for inserted text and ids.
     * @returns {Array<object>} The applied steps.
     */
    /**
     * Performs one reducer action, records it for selective undo and returns its applied steps.
     * @param {object} action - The action, including its selection.
     * @returns {Array<object>} The applied steps.
     */
    act(action) {
        const { Model, Ot } = this.rt;
        const before = this.state;
        this.state = Model.reduce(before, action);
        if (before.doc === this.state.doc) return [];
        const tokens = Model.tokens(before.doc);
        const from = action.selection ?? before.selection;
        const steps = Ot.diff(tokens, Model.tokens(this.state.doc), Model.toLinear(before.doc, Math.min(from.anchor, from.focus)));
        const applied = steps.length ? Ot.apply(tokens, steps).steps : [];
        if (applied.length) this.history?.record(applied);
        return applied;
    }

    /**
     * Undoes the own most recent change that still has an effect.
     * @returns {Array<object>} The applied inverse steps.
     */
    undo() {
        const { Model, Ot } = this.rt;
        let applied = [];
        this.history.undo(steps => {
            let result, doc;
            try { result = Ot.apply(Model.tokens(this.state.doc), steps); doc = Model.check(Model.fromTokens(result.tokens, { id: this.state.doc.id })); } catch { return null; }
            this.state = { ...this.state, doc };
            return (applied = result.steps);
        });
        return applied;
    }

    /**
     * Returns the text of each text block, for readable assertions.
     * @returns {Array<string>} The block texts.
     */
    blocks() {
        const { Model } = this.rt;
        return Model.entries(this.state.doc).filter(e => Model.TEXT_BLOCKS.has(e.node.type)).map(e => Model.leaves(e.node).map(n => n.type === "text" ? n.text : "[" + n.type + "]").join(""));
    }

    edit(rnd, tag) {
        const { Model, Ot } = this.rt;
        Model.idTag = tag;
        const size = Model.size(this.state.doc);
        const a = Math.floor(rnd() * size), b = Math.min(size - 1, a + Math.floor(rnd() * 6));
        const selection = rnd() < 0.6 ? { anchor: a, focus: a } : { anchor: a, focus: b };
        const pick = rnd();
        const cells = Model.entries(this.state.doc).filter(e => e.node.type === "td" || e.node.type === "th").map(e => e.node.id);
        const cell = () => cells[Math.floor(rnd() * cells.length)];
        let action;
        if (pick < 0.3) action = { type: "insertText", text: ["x", "yz", " ", tag][Math.floor(rnd() * 4)] };
        else if (pick < 0.42) action = { type: "delete", direction: rnd() < 0.5 ? -1 : 1 };
        else if (pick < 0.5) action = { type: "split" };
        else if (pick < 0.6) action = { type: "format", mark: ["bold", "italic", "subscript", "superscript"][Math.floor(rnd() * 4)] };
        else if (pick < 0.64) action = { type: "format", mark: "color", value: ["#ff0000", "#00ff00"][Math.floor(rnd() * 2)] };
        else if (pick < 0.72) action = { type: "list", command: ["insertunorderedlist", "insertorderedlist", "indent", "outdent"][Math.floor(rnd() * 4)] };
        else if (pick < 0.76) action = { type: "block", block: ["h1", "p", "blockquote"][Math.floor(rnd() * 3)] };
        else if (pick < 0.8) action = { type: "insertNodes", nodes: [Model.node("table", [Model.node("tbody", [Model.node("tr", [Model.node("td", [Model.node("p")]), Model.node("td", [Model.node("p")])])])])] };
        else if (pick < 0.9 && cells.length) action = { type: "table", ids: [cell(), ...(rnd() < 0.3 ? [cell()] : [])], command: ["insertRowBelow", "insertColumnRight", "deleteRow", "deleteColumn", "mergeCells", "splitCell", "background"][Math.floor(rnd() * 7)], color: "#eeeeee" };
        else if (pick < 0.94) action = { type: "comment", text: "note " + tag };
        else if (pick < 0.97) action = { type: "insertNodes", nodes: [Model.node("hr")] };
        else action = { type: "layout", command: rnd() < 0.5 ? "addColumn" : "addRow" };
        const before = this.state;
        const next = Model.reduce(before, { ...action, selection });
        this.state = next;
        if (before.doc === next.doc) return [];
        const tokens = Model.tokens(before.doc);
        const steps = Ot.diff(tokens, Model.tokens(next.doc), Model.toLinear(before.doc, Math.min(selection.anchor, selection.focus)));
        return steps.length ? Ot.apply(tokens, steps).steps : [];
    }
}

/**
 * A network between the clients and the server with failures under the control of a seed.
 */
export class Network {
    /**
     * Initializes the network.
     * @param {Function} rnd - The random source.
     * @param {object} [faults] - Probabilities of reordering, duplication and dropping.
     */
    constructor(rnd, faults = {}) {
        this.rnd = rnd; this.up = []; this.down = new Map(); this.faults = { reorder: 0.1, duplicate: 0.05, ...faults };
    }

    /**
     * Sends a message from a client to the server.
     * @param {object} message - The message.
     */
    send(message) {
        const copy = JSON.parse(JSON.stringify(message));
        this.up.push(copy);
        if (this.rnd() < this.faults.duplicate) this.up.push(JSON.parse(JSON.stringify(copy)));
    }

    /**
     * Takes the server's replies into the per-client queues.
     * @param {Server} server - The server.
     * @param {Set<string>} online - The clients currently connected.
     */
    collect(server, online) {
        for (const { client, message } of server.outbox.splice(0)) {
            if (!online.has(client)) continue;
            const queue = this.down.get(client) ?? this.down.set(client, []).get(client);
            queue.push(message);
            if (this.rnd() < this.faults.duplicate) queue.push(JSON.parse(JSON.stringify(message)));
            if (queue.length > 1 && this.rnd() < this.faults.reorder) {
                const i = queue.length - 1, j = Math.floor(this.rnd() * queue.length);
                [queue[i], queue[j]] = [queue[j], queue[i]];
            }
        }
    }
}

/**
 * Runs one randomized scenario and returns everything a test needs to judge convergence.
 * @param {object} options - The scenario.
 * @param {number} options.seed - The seed.
 * @param {number} [options.clients=3] - The number of clients.
 * @param {number} [options.rounds=60] - The number of random steps.
 * @param {number} [options.retain=Infinity] - The server's history retention.
 * @param {object} [options.faults] - The network faults.
 * @returns {object} The server, the clients and the runtime.
 */
export function scenario(options) {
    const rt = loadRuntime();
    options.setup?.(rt);
    const rnd = random(options.seed);
    const server = new Server(rt, { retain: options.retain });
    const net = new Network(rnd, options.faults);
    const initial = rt.Model.validate({ version: 1, doc: rt.Model.node("doc", [rt.Model.node("p", [{ type: "text", text: "hello world", marks: {} }]), rt.Model.node("p", [{ type: "text", text: "second", marks: {} }])]) });
    const online = new Set();
    const clients = [];
    for (let i = 0; i < (options.clients ?? 3); i++) {
        const name = "c" + i;
        const editor = new HeadlessEditor(rt, initial);
        const conflicts = [];
        const session = new rt.Session({ document: "scope/field", token: "t", client: name, secret: "s" + i, target: editor, send: m => net.send(m), onConflict: c => conflicts.push(c) });
        clients.push({ name, editor, session, conflicts });
        online.add(name); session.connect();
    }
    const deliverUp = () => { for (const m of net.up.splice(0)) { options.trace?.("server", m); server.receive(m); } net.collect(server, online); };
    const deliverDown = (client, all) => {
        const queue = net.down.get(client.name) ?? [];
        const count = all ? queue.length : Math.floor(rnd() * (queue.length + 1));
        for (const m of queue.splice(0, count)) { options.trace?.(client.name, m, client.session); client.session.receive(m); }
    };
    for (let round = 0; round < (options.rounds ?? 60); round++) {
        const client = clients[Math.floor(rnd() * clients.length)], pick = rnd();
        if (pick < 0.55) {
            if (!client.session._confirmed && !online.has(client.name)) continue;
            const steps = client.editor.edit(rnd, client.name + "t");
            client.session.local(steps);
        } else if (pick < 0.75) deliverUp();
        else if (pick < 0.93) deliverDown(client, false);
        else if (online.has(client.name)) {
            online.delete(client.name); client.session.disconnect();
            net.down.delete(client.name);
            net.up = net.up.filter(m => m.client !== client.name || rnd() < 0.5);
        } else { online.add(client.name); client.session.connect(); }
    }
    for (const client of clients) if (!online.has(client.name)) { online.add(client.name); client.session.connect(); }
    for (let i = 0; i < 500 && (net.up.length || [...net.down.values()].some(q => q.length) || clients.some(c => c.session.pending)); i++) {
        deliverUp();
        for (const client of clients) deliverDown(client, true);
    }
    return { rt, server, clients };
}
