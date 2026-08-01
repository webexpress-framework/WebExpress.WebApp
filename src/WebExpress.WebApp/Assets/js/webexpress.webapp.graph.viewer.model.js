var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST graph viewer control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can be
 * unit tested in isolation. The control composes them with a RestService whose
 * query loads the graph; the helpers read the wire format with its aliases,
 * complete the node and edge records the viewer renders and drop the edges whose
 * endpoints the payload does not carry.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.graphViewerModel = {
    /**
     * Reads a graph response into the nodes and edges the viewer renders,
     * accepting the nodes/items and edges/links aliases and tolerating a missing
     * or malformed payload, so the renderer always receives two arrays.
     * @param {*} response - The raw graph response.
     * @returns {{nodes: Array<object>, edges: Array<object>}} The normalised graph.
     */
    normalizeGraph(response) {
        response = response || {};

        const nodesIn = Array.isArray(response.nodes)
            ? response.nodes
            : (Array.isArray(response.items) ? response.items : []);
        const edgesIn = Array.isArray(response.edges)
            ? response.edges
            : (Array.isArray(response.links) ? response.links : []);

        const nodes = nodesIn
            .filter((node) => node && typeof node === "object")
            .map((node) => this.normalizeNode(node));
        const edges = edgesIn
            .filter((edge) => edge && typeof edge === "object")
            .map((edge) => this.normalizeEdge(edge));

        return this.dropDanglingEdges({ nodes: nodes, edges: edges });
    },

    /**
     * Completes a single node record with the fields the viewer reads. A node
     * without coordinates is left without them rather than placed at the origin,
     * because that is what tells the layout simulation it may position the node.
     * @param {object} node - The raw node record.
     * @returns {object} The normalised node.
     */
    normalizeNode(node) {
        node = node || {};

        const out = {
            id: node.id != null ? String(node.id) : "",
            label: node.label || (node.id != null ? String(node.id) : ""),
            shape: this._text(node.shape).toLowerCase(),
            layout: this._text(node.layout || node.nodeStyle).toLowerCase(),
            icon: this._text(node.icon),
            image: this._text(node.image),
            uri: this._text(node.uri),
            foregroundColor: this._text(node.foregroundColor),
            foregroundCss: this._text(node.foregroundCss),
            backgroundColor: this._text(node.backgroundColor),
            backgroundCss: this._text(node.backgroundCss)
        };

        const x = this._coordinate(node.x);
        const y = this._coordinate(node.y);
        if (x !== null && y !== null) {
            out.x = x;
            out.y = y;
        }

        return out;
    },

    /**
     * Completes a single edge record, mapping the source/target alias onto the
     * from/to the viewer reads.
     * @param {object} edge - The raw edge record.
     * @returns {object} The normalised edge.
     */
    normalizeEdge(edge) {
        edge = edge || {};

        return {
            id: edge.id != null ? String(edge.id) : "",
            from: this._text(edge.from !== undefined ? edge.from : edge.source),
            to: this._text(edge.to !== undefined ? edge.to : edge.target),
            label: this._text(edge.label),
            color: this._text(edge.color),
            colorCss: this._text(edge.colorCss),
            dasharray: this._text(edge.dasharray),
            waypoints: this.normalizeWaypoints(edge.waypoints)
        };
    },

    /**
     * Reads the waypoints of an edge, accepting both the array and the JSON
     * string form the endpoints use, and dropping the points that carry no
     * usable pair of coordinates.
     * @param {*} waypoints - The raw waypoints.
     * @returns {Array<{x: number, y: number}>} The normalised waypoints.
     */
    normalizeWaypoints(waypoints) {
        let list = waypoints;

        if (typeof list === "string") {
            try {
                list = JSON.parse(list);
            } catch (e) {
                list = [];
            }
        }

        return (Array.isArray(list) ? list : [])
            .map((point) => {
                if (!point || typeof point !== "object") {
                    return null;
                }
                const x = this._coordinate(point.x);
                const y = this._coordinate(point.y);
                return x !== null && y !== null ? { x: x, y: y } : null;
            })
            .filter((point) => point !== null);
    },

    /**
     * Removes the edges whose endpoints the graph does not carry. The renderer
     * skips such an edge anyway, so keeping it would only let the model report a
     * connection that is never drawn - which is exactly the case a caller
     * inspecting the model needs to be able to trust.
     * @param {{nodes: Array<object>, edges: Array<object>}} graph - The graph.
     * @returns {{nodes: Array<object>, edges: Array<object>}} The graph without dangling edges.
     */
    dropDanglingEdges(graph) {
        graph = graph || {};
        const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
        const edges = Array.isArray(graph.edges) ? graph.edges : [];
        const known = new Set(nodes.map((node) => node && node.id));

        return {
            nodes: nodes,
            edges: edges.filter((edge) => edge && known.has(edge.from) && known.has(edge.to))
        };
    },

    /**
     * Coerces a raw coordinate into a finite number, accepting the numeric and
     * the string form the endpoints use.
     * @param {*} value - The raw coordinate.
     * @returns {number|null} The coordinate, or null when there is none.
     */
    _coordinate(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    },

    /**
     * Coerces a raw field into a string, mapping every non-string value onto the
     * empty string so a numeric or null field never reaches the renderer as a
     * class name or a colour.
     * @param {*} value - The raw value.
     * @returns {string} The text.
     */
    _text(value) {
        return typeof value === "string" ? value : (value != null && typeof value === "number" ? String(value) : "");
    }
};
