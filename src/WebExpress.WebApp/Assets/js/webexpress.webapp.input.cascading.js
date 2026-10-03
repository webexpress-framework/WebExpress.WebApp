/**
 * A cascading selection control that retrieves its option levels from a REST
 * endpoint. The endpoint is authored in C# through the wx-service island (see
 * ControlDataFormItemInputCascading); without an island the control behaves
 * exactly like the static WebUI base and renders the declarative children.
 *
 * Remote levels are fetched on demand: the root without a parameter, the
 * children of a selected node via the parent query parameter. Responses are
 * cached per parent so revisiting a level does not repeat the request.
 */
webexpress.webapp.InputCascadingCtrl = class extends webexpress.webui.InputCascadingCtrl {
    /**
     * Constructor: consumes the service island and, in remote mode, replaces
     * the statically parsed tree with the root level from the endpoint.
     * @param {HTMLElement} element - Host element containing optional .wx-cascading-item children or a wx-service island.
     */
    constructor(element) {
        // consume the island before the base constructor parses the
        // declarative children; the read caches on the element
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        this._service = islandServices.data || null;
        this._apiBase = this._service ? this._service.baseUri : null;
        this._remoteCache = new Map();
        this._useRemote = !!this._apiBase;

        // the base constructor already rendered the static children; in
        // remote mode they are only a placeholder and yield to the API root
        if (this._useRemote) {
            while (this._levelsContainer.firstChild) {
                this._levelsContainer.removeChild(this._levelsContainer.firstChild);
            }
            this._path = [];
            this._tree = null;
            this._loadRoot();
        }
    }

    /**
     * Fetches the nodes of a parent from the REST endpoint. Results are
     * cached per parent; a failed request is cached as an empty level so a
     * broken endpoint does not cause a request storm while the user
     * navigates the levels.
     * @param {string|null} parentId - The id of the parent node or null for the root.
     * @returns {Promise<Array>} The normalized node objects of the level.
     */
    async _fetchNodes(parentId) {
        const key = parentId == null ? "__root__" : String(parentId);

        if (this._remoteCache.has(key)) {
            return this._remoteCache.get(key);
        }

        let url = this._apiBase;
        if (parentId != null) {
            const sep = url.includes("?") ? "&" : "?";
            url += `${sep}parent=${encodeURIComponent(parentId)}`;
        }

        let nodes = [];
        try {
            const result = await webexpress.webapp.ServiceRegistry.request(url, { method: "GET" });
            if (!result.ok) {
                throw new Error(result.error?.message || `request failed with status ${result.status}`);
            }
            nodes = (Array.isArray(result.data) ? result.data : []).map((n) => this._normalizeNode(n));
        } catch (err) {
            console.error("failed to fetch cascading options:", err);
        }

        this._remoteCache.set(key, nodes);
        return nodes;
    }

    /**
     * Normalizes a raw endpoint node into the shape of the base control's
     * option tree. Nested children are normalized recursively; omitted
     * children mark a node whose level is fetched on demand.
     * @param {object} n - The raw node from the endpoint.
     * @returns {object} The normalized node.
     */
    _normalizeNode(n) {
        return {
            id: n.id != null ? String(n.id) : null,
            label: n.label != null ? String(n.label) : (n.name != null ? String(n.name) : null),
            labelColor: n.labelColor || n["label-color"] || null,
            icon: n.icon || null,
            image: n.image || null,
            content: n.content != null ? String(n.content) : (n.html != null ? String(n.html) : ""),
            disabled: !!n.disabled,
            children: Array.isArray(n.children) ? n.children.map((c) => this._normalizeNode(c)) : null
        };
    }

    /**
     * Loads the root level from the endpoint and renders it.
     * @returns {Promise<void>} Resolves when the root level is rendered.
     */
    async _loadRoot() {
        this._tree = await this._fetchNodes(null);
        this._renderLevel(0, this._tree);
    }

    /**
     * Renders a single level. In remote mode a null nodes argument means the
     * level content is unknown and must be fetched for the selected parent;
     * without a selected parent the deeper levels are cleared through the
     * base implementation instead.
     * @param {number} level - The depth level (0 = root).
     * @param {Array|null} nodes - The node objects of the level or null to fetch remotely.
     */
    _renderLevel(level, nodes) {
        if (this._useRemote && nodes == null) {
            const parentId = level === 0 ? null : (this._path[level - 1] ?? null);

            // a cleared selection has no parent to expand; fetching with a
            // null parent would wrongly render the root nodes on this level
            if (level > 0 && parentId == null) {
                super._renderLevel(level, null);
                return;
            }

            this._fetchNodes(parentId).then((fetched) => super._renderLevel(level, fetched));
            return;
        }

        super._renderLevel(level, nodes);
    }

    /**
     * Finds the children of a node. Returns null for a remote node whose
     * children were omitted by the endpoint, so _renderLevel fetches them.
     * @param {Array} nodes - The nodes to search.
     * @param {string|null} id - The id to find.
     * @returns {Array|null} The child nodes or null.
     */
    _findChildren(nodes, id) {
        if (!id) {
            return null;
        }

        const node = nodes.find((n) => n.id === id);
        if (node) {
            if (this._useRemote && node.children == null) {
                return null;
            }
            return node.children && node.children.length > 0 ? node.children : null;
        }

        return null;
    }
};

webexpress.webui.Controller.registerClass("wx-webapp-input-cascading", webexpress.webapp.InputCascadingCtrl);
