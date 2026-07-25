var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the workflow editor control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService:
 * the load is fetched through the shared request (it keeps its own abort and
 * loading state), the meta, catalog and graph are read out of the wire format
 * through the model and the debounced autosave is persisted with the service
 * update from a wire payload the model builds.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.workflowEditorModel = {
    /**
     * Reads the workflow meta fields out of a response, defaulting each to an
     * empty string.
     * @param {object} response - The raw workflow response.
     * @returns {object} The meta object.
     */
    normalizeMeta(response) {
        response = response || {};
        return {
            id: response.id || "",
            name: response.name || "",
            state: response.state || "",
            version: response.version || "",
            description: response.description || ""
        };
    },

    /**
     * Reads the rule catalog (guards, validations, postfunctions) out of a
     * response, defaulting each to an empty array.
     * @param {object} response - The raw workflow response.
     * @returns {object} The catalog object.
     */
    normalizeCatalog(response) {
        response = response || {};
        return {
            guards: Array.isArray(response.guards) ? response.guards : [],
            validations: Array.isArray(response.validations) ? response.validations : [],
            postfunctions: Array.isArray(response.postfunctions) ? response.postfunctions : []
        };
    },

    /**
     * Reads the graph out of the wire format, accepting the nodes/states and
     * edges/transitions aliases and mapping the source/target edge alias to
     * from/to. Each node and edge is shallow copied so the response is not
     * mutated.
     * @param {object} response - The raw workflow response.
     * @returns {{nodes: Array<object>, edges: Array<object>}} The graph.
     */
    fromWireFormat(response) {
        response = response || {};
        const nodesIn = Array.isArray(response.nodes)
            ? response.nodes
            : (Array.isArray(response.states) ? response.states : []);
        const edgesIn = Array.isArray(response.edges)
            ? response.edges
            : (Array.isArray(response.transitions) ? response.transitions : []);

        const nodes = nodesIn.map((n) => Object.assign({}, n));
        const edges = edgesIn.map((e) => {
            const out = Object.assign({}, e);
            // accept the prototype's source/target alias for compatibility
            if (out.from === undefined && out.source !== undefined) { out.from = out.source; }
            if (out.to === undefined && out.target !== undefined) { out.to = out.target; }
            return out;
        });

        return { nodes: nodes, edges: edges };
    },

    /**
     * Builds the wire payload for the autosave, mirroring the nodes and edges
     * under the states and transitions names so a backend can read either field.
     * @param {object} meta - The workflow meta fields.
     * @param {object} model - The graph model with nodes and edges.
     * @returns {object} The wire payload.
     */
    toWirePayload(meta, model) {
        meta = meta || {};
        model = model || {};
        const nodes = (model.nodes || []).map((n) => webexpress.webapp.workflowEditorModel._roundPosition(n));
        const edges = (model.edges || []).map((e) => webexpress.webapp.workflowEditorModel._roundWaypoints(e));
        return {
            id: meta.id,
            name: meta.name,
            state: meta.state,
            version: meta.version,
            description: meta.description,
            nodes: nodes,
            edges: edges,
            states: nodes,
            transitions: edges
        };
    },

    /**
     * Copies a node with its position rounded to whole numbers.
     *
     * The canvas works in continuous space, so a dragged state carries a
     * fractional position. A consumer that models a coordinate as a whole number
     * rejects the payload over it, which turns the first drag into the last
     * successful save. Sub-pixel precision carries no meaning for a stored
     * layout, so it is dropped here rather than defended against downstream.
     * @param {object} node - The node.
     * @returns {object} The copy with whole-number coordinates.
     */
    _roundPosition(node) {
        const out = Object.assign({}, node);
        if (Number.isFinite(out.x)) { out.x = Math.round(out.x); }
        if (Number.isFinite(out.y)) { out.y = Math.round(out.y); }
        return out;
    },

    /**
     * Copies an edge with its waypoint positions rounded to whole numbers.
     * @param {object} edge - The edge.
     * @returns {object} The copy with whole-number waypoints.
     */
    _roundWaypoints(edge) {
        const out = Object.assign({}, edge);
        if (Array.isArray(out.waypoints)) {
            out.waypoints = out.waypoints.map((wp) => webexpress.webapp.workflowEditorModel._roundPosition(wp));
        }
        return out;
    }
};
