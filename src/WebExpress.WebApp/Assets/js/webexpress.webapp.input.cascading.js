/**
 * InputCascadingCtrl that retrieves options from a REST endpoint.
 */
webexpress.webapp.InputCascadingCtrl = class extends webexpress.webui.InputCascadingCtrl {
    /**
     * Constructor initializes remote-enabled cascading control.
     * @param {HTMLElement} element - host element containing optional .wx-selection-item children or data-api attribute
     */
    constructor(element) {
        // call base constructor (will parse any declarative DOM and render briefly)
        super(element);

        // read api base from host attributes; prefer data-uri
        this._apiBase = element.getAttribute("data-uri") || null;
        // cache for fetched nodes keyed by parent id (use "__root__" for root)
        this._remoteCache = {};
        // flag if remote mode is enabled
        this._useRemote = !!this._apiBase;

        // if remote mode is active, discard the statically parsed tree and reload from API
        if (this._useRemote) {
            // remove any levels rendered by base constructor
            while (this._levelsContainer.firstChild) {
                this._levelsContainer.removeChild(this._levelsContainer.firstChild);
            }
            // reset internal path and tree
            this._path = [];
            this._tree = null;
            // load root nodes asynchronously and render
            this._loadRoot();
        }
    }

    /**
     * Fetch nodes for a given parent id from the REST API.
     * @param {string|null} parentId - id of parent node or null for root
     * @returns {Promise<Array>} Promise resolving to an array of node objects
     */
    _fetchNodes(parentId) {
        // build cache key
        const key = parentId == null ? "__root__" : String(parentId);
        // return cached result if available
        if (this._remoteCache.hasOwnProperty(key)) {
            return Promise.resolve(this._remoteCache[key]);
        }

        // construct request url; parent query param used when parentId provided
        let url = this._apiBase;
        if (parentId != null) {
            // append parent param safely
            const sep = url.indexOf("?") === -1 ? "?" : "&";
            url += sep + "parent=" + encodeURIComponent(parentId);
        }

        // perform fetch and normalize response
        return fetch(url, { method: "GET", credentials: "same-origin" })
            .then(function (resp) {
                if (!resp.ok) {
                    throw new Error("Network response was not ok");
                }
                return resp.json();
            })
            .then(function (data) {
                // expect data to be an array of nodes; normalize shape
                const nodes = Array.isArray(data) ? data.map(function (n) {
                    return {
                        id: n.id != null ? String(n.id) : null,
                        label: n.label != null ? String(n.label) : (n.name != null ? String(n.name) : null),
                        labelColor: n.labelColor || n["label-color"] || null,
                        icon: n.icon || null,
                        image: n.image || null,
                        content: n.content != null ? String(n.content) : (n.html != null ? String(n.html) : ""),
                        disabled: !!n.disabled,
                        // children may be omitted for remote nodes; set null so children are fetched on demand
                        children: n.children && Array.isArray(n.children) ? n.children : null
                    };
                }) : [];
                // cache and return
                this._remoteCache[key] = nodes;
                return nodes;
            }.bind(this))
            .catch(function (err) {
                // on error, cache empty array to avoid repeated failing requests
                this._remoteCache[key] = [];
                return [];
            }.bind(this));
    }

    /**
     * Load and render root nodes from API.
     * @returns {Promise<void>} resolves when root rendered
     */
    _loadRoot() {
        // fetch root nodes and render level 0
        return this._fetchNodes(null).then(function (nodes) {
            this._tree = nodes;
            // render root level using overridden _renderLevel
            this._renderLevel(0, this._tree);
        }.bind(this));
    }

    /**
     * Renders a single level using InputSelectionCtrl.
     * If nodes is null and remote mode active, fetch children from API and render asynchronously.
     * @param {number} level - depth level (0 = root)
     * @param {Array|null} nodes - array of node objects for this level or null to fetch remotely
     */
    _renderLevel(level, nodes) {
        // if remote mode and nodes is null, fetch children for the parent at previous level
        if (this._useRemote && (nodes == null)) {
            const parentId = level === 0 ? null : (this._path[level - 1] || null);
            // fetch nodes then call base render
            this._fetchNodes(parentId).then(function (fetched) {
                // call base implementation with fetched nodes
                webexpress.webui.InputCascadingCtrl.prototype._renderLevel.call(this, level, fetched);
            }.bind(this));
            return;
        }

        // otherwise delegate to base class behavior
        webexpress.webui.InputCascadingCtrl.prototype._renderLevel.call(this, level, nodes);
    }

    /**
     * Finds children for a given id inside nodes.
     * If children are not present and remote mode is active, returns null so _renderLevel will fetch them.
     * @param {Array} nodes - nodes to search
     * @param {string|null} id - id to find
     * @returns {Array|null} child nodes array or null
     */
    _findChildren(nodes, id) {
        // reuse base logic but if found node has children === null and remote mode active, return null
        if (!id) {
            return null;
        }
        for (let i = 0; i < nodes.length; i += 1) {
            const n = nodes[i];
            if (n.id === id) {
                if (this._useRemote && (n.children == null)) {
                    // children must be fetched from API
                    return null;
                }
                return n.children && n.children.length > 0 ? n.children : null;
            }
        }
        return null;
    }
};

// register control class
webexpress.webui.Controller.registerClass("wx-webapp-input-cascading", webexpress.webapp.InputCascadingCtrl);