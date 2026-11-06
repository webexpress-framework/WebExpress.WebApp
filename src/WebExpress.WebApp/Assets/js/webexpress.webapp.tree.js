/**
 * A tree over a REST endpoint that loads one level per expansion, so a hierarchy of any size -
 * pages, org units, configuration items - opens as fast as its first level.
 *
 * The endpoint answers GET without parameters with the root nodes, GET ?node=<id> with the
 * children of a node, and GET ?reveal=<id> with { path, levels }: the ids from the root down to
 * the node and, by parent id ("" for the root), every level the path passes. A node is
 * { id, label, icon, uri, hasChildren, droppable }. A movable tree sends a move as PUT
 * { node, target, position } and reloads the levels it touched, whatever the answer.
 *
 * The expansion lives in the state, seeded from data-expanded or the wx-state island ("expanded",
 * a json array), and survives every reload, including the one a data change of the service triggers.
 * It is also a view preference that outlives the page: the nodes the user opened are stored through
 * webexpress.webui.LocalStorage under data-persist-key, or a key derived from the host id, and are
 * opened again the next time the page loads.
 *
 * The following events are triggered:
 * - webexpress.webui.Event.CLICK_EVENT { node }
 * - webexpress.webui.Event.CHANGE_VALUE_EVENT { value } - the selected id, as a field announces it
 * - webexpress.webui.Event.SELECT_ITEM_EVENT { node }
 * - webexpress.webui.Event.BEFORE_SAVE_EVENT, SAVED_EVENT, TASK_START_EVENT, TASK_FINISH_EVENT - for a move
 * - webexpress.webui.Event.CHANGE_VISIBILITY_EVENT { node, expanded }
 * - webexpress.webui.Event.MOVE_EVENT { node, target, position } - as the static tree
 * - webexpress.webui.Event.DATA_ERROR_EVENT { action, error }
 */
webexpress.webapp.TreeCtrl = class extends webexpress.webapp.Data {
    /** The parent key of the root level. */
    static ROOT = "";

    /** The drag kind of a tree node in the drag-and-drop protocol. */
    static KIND = "tree-node";

    /**
     * Creates the tree and loads its first level.
     * @param {HTMLElement} element - The host element.
     */
    constructor(element) {
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        const seed = webexpress.webapp.Data.readState(element);
        const selected = element.getAttribute("data-selected") || seed.selected || null;
        const authored = webexpress.webapp.TreeCtrl._readList(element.getAttribute("data-expanded")) || seed.expanded;
        const storageKey = element.getAttribute("data-persist-key") || (element.id ? "wx_tree_expanded_" + element.id : null);
        const stored = webexpress.webapp.TreeCtrl._readList(webexpress.webui.LocalStorage.getItem(storageKey));
        // the page names the part of the hierarchy it is about, the user what they opened last time
        const expanded = [...new Set([...(Array.isArray(authored) ? authored : []), ...(stored || [])].map(String))];

        super(element, {
            services,
            state: {
                levels: {},
                expanded: expanded,
                selected: selected,
                loading: [],
                error: null
            }
        });

        this._service = this.useService("data");
        this._storageKey = storageKey;
        this._movable = element.getAttribute("data-movable") === "true";
        this._reveal = selected;
        this._focus = null;
        this._uid = element.id || ("wx-tree-" + Math.random().toString(36).slice(2, 8));

        element.removeAttribute("data-movable");
        element.removeAttribute("data-selected");
        element.removeAttribute("data-expanded");
        element.removeAttribute("data-persist-key");
        element.textContent = "";
        element.classList.add("wx-tree", "wx-webapp-tree");

        this._onKeyDownBound = (e) => this._onKeyDown(e);
        this._onDropCheckBound = (e) => this._onDropCheck(e);
        this._onDropBound = (e) => this._onDrop(e);
        element.addEventListener("keydown", this._onKeyDownBound);
        element.addEventListener(webexpress.webui.Event.DROP_CHECK_EVENT, this._onDropCheckBound);
        element.addEventListener(webexpress.webui.Event.DROP_EVENT, this._onDropBound);

        this.mount();
        void this.load();
    }

    /**
     * Gets the id of the selected node.
     * @returns {string|null} The id.
     */
    get value() {
        return this.state.selected;
    }

    /**
     * Selects a node by id, revealing it first when it is not loaded.
     * @param {string|null} id - The node id.
     */
    set value(id) {
        void this.select(id);
    }

    /**
     * Loads the root level and every level the expansion opens, then reveals a node that was
     * asked for before the tree had loaded. A reload keeps the expansion.
     * @returns {Promise<void>} Resolves when the levels are loaded.
     */
    async load() {
        if (!(await this._loadLevel(webexpress.webapp.TreeCtrl.ROOT))) {
            return;
        }

        await this._loadOpen(webexpress.webapp.TreeCtrl.ROOT);

        // a closed branch would otherwise keep what the server held when it was last open, and
        // opening it again would show that instead of the current children
        this._dropClosed();

        if (this._reveal) {
            const id = this._reveal;
            this._reveal = null;
            await this.reveal(id);
        }
    }

    /**
     * Loads the open levels below a parent, from the top down: a level can only be asked for
     * once its parent is known.
     * @param {string} parent - The parent key.
     * @returns {Promise<void>} Resolves when the open levels are loaded.
     */
    async _loadOpen(parent) {
        for (const node of this.state.levels[parent] || []) {
            if (node.hasChildren && this.state.expanded.includes(node.id) && await this._loadLevel(node.id)) {
                await this._loadOpen(node.id);
            }
        }
    }

    /**
     * Forgets the levels that are not shown, so a closed branch is asked for again when it opens.
     */
    _dropClosed() {
        const root = webexpress.webapp.TreeCtrl.ROOT;
        const levels = {};
        for (const [parent, nodes] of Object.entries(this.state.levels)) {
            if (parent === root || (this.state.expanded.includes(parent) && this._isShown(parent, this.state))) {
                levels[parent] = nodes;
            }
        }
        if (Object.keys(levels).length !== Object.keys(this.state.levels).length) {
            this.setState({ levels: levels });
        }
    }

    /**
     * Stores the expansion as a view preference of the page.
     */
    _persistExpansion() {
        webexpress.webui.LocalStorage.setItem(this._storageKey, JSON.stringify(this.state.expanded));
    }

    /**
     * Opens or closes a node; opening loads its children the first time.
     * @param {string} id - The node id.
     * @param {boolean} [expand] - True to open, false to close, omitted to toggle.
     * @returns {Promise<void>} Resolves when an opened level is loaded.
     */
    async toggle(id, expand) {
        const expanded = this.state.expanded.includes(id);
        const open = expand === undefined ? !expanded : !!expand;
        if (open === expanded) {
            return;
        }

        // a closed node takes the tab stop from a node it hides, or the tree could not be tabbed into
        if (!open && this._focus && this._isAncestor(id, this._focus)) {
            this._focus = id;
        }

        this.setState({
            expanded: open ? [...this.state.expanded, id] : this.state.expanded.filter((x) => x !== id)
        });
        this._persistExpansion();
        this._dispatch(webexpress.webui.Event.CHANGE_VISIBILITY_EVENT, { node: id, expanded: open });

        // a branch whose level was forgotten is asked for again, with the open levels below it
        if (open && !this.state.levels[id] && await this._loadLevel(id)) {
            await this._loadOpen(id);
        }
    }

    /**
     * Selects a node. A node that is not loaded yet is revealed through the endpoint.
     * @param {string|null} id - The node id, or null to clear the selection.
     * @returns {Promise<boolean>} True when the node is shown and selected.
     */
    async select(id) {
        if (id === null || id === undefined || id === "") {
            this._choose(null);
            return true;
        }

        const node = String(id);
        if (this._parentOf(node) === undefined) {
            return this.reveal(node);
        }

        // a loaded node below a closed one is shown as well: its ancestors are loaded, so they
        // only need to be opened
        const expanded = new Set(this.state.expanded);
        let parent = this._parentOf(node);
        while (parent) {
            expanded.add(parent);
            parent = this._parentOf(parent);
        }
        if (expanded.size !== this.state.expanded.length) {
            this.setState({ expanded: [...expanded] });
            this._persistExpansion();
        }

        this._choose(node);
        this._scrollTo(node);
        return true;
    }

    /**
     * Loads the path to a node, opens every ancestor and selects the node.
     * @param {string} id - The node id.
     * @returns {Promise<boolean>} True when the endpoint knew the node.
     */
    async reveal(id) {
        if (!this._service || !id) {
            return false;
        }

        const result = await this._service.query({ reveal: id }, { channel: "tree:reveal" });
        if (!result.ok) {
            this._fail("reveal", result);
            return false;
        }

        const data = result.data || {};
        const path = Array.isArray(data.path) ? data.path.map(String) : [];
        if (path.length === 0) {
            return false;
        }

        const levels = Object.assign({}, this.state.levels);
        for (const [parent, nodes] of Object.entries(data.levels || {})) {
            levels[parent] = webexpress.webapp.TreeCtrl.normalize(nodes);
        }

        const expanded = new Set(this.state.expanded);
        path.slice(0, -1).forEach((x) => expanded.add(x));

        this.setState({ levels: levels, expanded: [...expanded] });
        this._persistExpansion();
        this._choose(id);
        this._scrollTo(id);

        return true;
    }

    /**
     * Brings a node into view. The render is batched, so it is applied first: before that, the
     * node a reveal or a selection just opened is not on the page yet.
     * @param {string} id - The node id.
     */
    _scrollTo(id) {
        this._store.flush?.();
        const item = this._item(id);
        if (item && typeof item.scrollIntoView === "function") {
            item.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
    }

    /**
     * Reads a json array attribute.
     * @param {string|null} text - The attribute value.
     * @returns {Array|null} The array, or null when absent or malformed.
     */
    static _readList(text) {
        if (!text) {
            return null;
        }
        try {
            const value = JSON.parse(text);
            return Array.isArray(value) ? value : null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Turns an endpoint answer into nodes; an answer may be the array or { items }.
     * @param {*} data - The answer.
     * @returns {Array<object>} The nodes.
     */
    static normalize(data) {
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : []);
        return list
            .filter((x) => x && x.id !== undefined && x.id !== null)
            .map((x) => ({
                id: String(x.id),
                label: x.label ?? x.text ?? String(x.id),
                icon: x.icon || null,
                uri: x.uri || null,
                hasChildren: !!x.hasChildren,
                droppable: x.droppable !== false
            }));
    }

    /**
     * Renders the levels that are loaded and open.
     * @param {object} state - The state.
     * @returns {Array<object>} The virtual node tree.
     */
    render(state) {
        const h = webexpress.webui.h;
        const root = webexpress.webapp.TreeCtrl.ROOT;

        return [
            h("ul", {
                key: "tree",
                role: "tree",
                "aria-busy": state.loading.includes(root) ? "true" : null
            }, ...this._renderLevel(state, root, 1))
        ];
    }

    /**
     * Renders the nodes of one level.
     * @param {object} state - The state.
     * @param {string} parent - The parent key.
     * @param {number} level - The nesting level, from 1.
     * @returns {Array<object>} The list items.
     */
    _renderLevel(state, parent, level) {
        const nodes = state.levels[parent] || [];
        return nodes.map((node, index) => this._renderNode(state, node, parent, level, index, nodes.length));
    }

    /**
     * Renders one node with its indicator and, when open, its children.
     * @param {object} state - The state.
     * @param {object} node - The node.
     * @param {string} parent - The parent key.
     * @param {number} level - The nesting level.
     * @param {number} index - The position among its siblings.
     * @param {number} size - The number of siblings.
     * @returns {object} The list item.
     */
    _renderNode(state, node, parent, level, index, size) {
        const h = webexpress.webui.h;
        const expanded = node.hasChildren && state.expanded.includes(node.id);
        const selected = state.selected === node.id;
        const groupId = this._uid + "-" + node.id + "-group";
        const movable = this._movable;

        const indicator = node.hasChildren
            ? h("i", {
                class: ["wx-tree-indicator-angle", webexpress.webui.IconSet.resolve("angle-down"), expanded ? "wx-tree-expand" : null],
                // the pointer target is decoration for a reader: the arrow keys do the same
                "aria-hidden": "true",
                on: { click: () => this.toggle(node.id) }
            })
            : h("i", { class: ["wx-tree-indicator-dot", webexpress.webui.IconSet.resolve("dot")], "aria-hidden": "true" });

        const label = h(node.uri ? "a" : "button", {
            key: "label",
            class: ["wx-tree-label-container", selected ? "active" : null],
            type: node.uri ? null : "button",
            href: node.uri || null,
            role: "treeitem",
            "aria-level": String(level),
            "aria-setsize": String(size),
            "aria-posinset": String(index + 1),
            "aria-expanded": node.hasChildren ? String(expanded) : null,
            "aria-selected": String(selected),
            "aria-owns": expanded ? groupId : null,
            tabindex: this._tabStop(state) === node.id ? "0" : "-1",
            "data-wx-node": node.id,
            "data-wx-parent": parent,
            draggable: movable ? "true" : null,
            "data-wx-drag": movable ? node.id : null,
            "data-wx-drag-kind": movable ? webexpress.webapp.TreeCtrl.KIND : null,
            "data-wx-drop": node.id,
            "data-wx-drop-kind": webexpress.webapp.TreeCtrl.KIND,
            "data-wx-drop-position": movable ? "edges" : null,
            "data-wx-drop-into": node.droppable ? null : "false",
            on: {
                click: () => this._onClick(node),
                dblclick: () => node.hasChildren && this.toggle(node.id)
            }
        }, ...this._renderIcon(node), h("span", null, node.label));

        let group = null;
        if (expanded) {
            const children = state.levels[node.id];
            group = h("ul", {
                key: "group",
                id: groupId,
                role: "group",
                "aria-busy": children ? null : "true"
            }, ...(children
                ? this._renderLevel(state, node.id, level + 1)
                : [h("li", { key: "loading", role: "none", class: "wx-tree-node placeholder-glow" }, h("span", { class: "placeholder col-4" }))]));
        }

        return h("li", { key: node.id, role: "none", class: "wx-tree-node" }, h("div", { key: "row" }, indicator, label), group);
    }

    /**
     * Renders the icon of a node: a picture for an address, an icon font class otherwise.
     * @param {object} node - The node.
     * @returns {Array<object>} The icon, or nothing.
     */
    _renderIcon(node) {
        const h = webexpress.webui.h;
        if (!node.icon) {
            return [];
        }
        // the picture repeats the label beside it
        return /^(https?:|data:|\.{0,2}\/)/i.test(node.icon)
            ? [h("img", { class: "wx-icon", src: node.icon, alt: "" })]
            : [h("i", { class: node.icon, "aria-hidden": "true" })];
    }

    /**
     * Returns the node that holds the tab stop: the focused one, else the selected one, else
     * the first root node - each only while it is shown, since a hidden tab stop would leave the
     * tree without one.
     * @param {object} state - The state.
     * @returns {string|null} The node id.
     */
    _tabStop(state) {
        if (this._focus && this._isShown(this._focus, state)) {
            return this._focus;
        }
        if (state.selected && this._isShown(state.selected, state)) {
            return state.selected;
        }
        const roots = state.levels[webexpress.webapp.TreeCtrl.ROOT] || [];
        return roots.length > 0 ? roots[0].id : null;
    }

    /**
     * Tells whether a node is rendered: it is loaded and every ancestor is open.
     * @param {string} id - The node id.
     * @param {object} state - The state.
     * @returns {boolean} True when the node is on screen.
     */
    _isShown(id, state) {
        let parent = this._parentOf(id, state);
        while (parent !== undefined) {
            if (parent === webexpress.webapp.TreeCtrl.ROOT) {
                return true;
            }
            if (!state.expanded.includes(parent)) {
                return false;
            }
            parent = this._parentOf(parent, state);
        }
        return false;
    }

    /**
     * Selects a clicked node and announces it. A node with an address navigates natively.
     * @param {object} node - The node.
     */
    _onClick(node) {
        this._dispatch(webexpress.webui.Event.CLICK_EVENT, { node: node.id });
        this._choose(node.id);
    }

    /**
     * Makes a node the selected one and the tab stop, and announces a real change as a field
     * does; choosing the selected node again announces nothing.
     * @param {string|null} id - The node id, or null to clear the selection.
     */
    _choose(id) {
        if (id) {
            this._focus = id;
        }
        if (this.state.selected === id) {
            return;
        }

        this.setState({ selected: id });
        this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { value: id });
        if (id) {
            this._dispatch(webexpress.webui.Event.SELECT_ITEM_EVENT, { node: id });
        }
    }

    /**
     * Walks, opens and closes the nodes with the keys of the ARIA tree pattern. Enter and space
     * open or close a node with children and select it, as a click and a double click do with
     * the pointer; on a node that is a link, Enter follows the link as a link does. The asterisk
     * opens every sibling of the focused node.
     * @param {KeyboardEvent} event - The key event.
     */
    _onKeyDown(event) {
        const item = event.target && event.target.closest ? event.target.closest("[role=\"treeitem\"]") : null;
        if (!item || event.defaultPrevented) {
            return;
        }

        const id = item.getAttribute("data-wx-node");
        const items = Array.from(this._element.querySelectorAll("[role=\"treeitem\"]"));
        const index = items.indexOf(item);
        const expanded = item.getAttribute("aria-expanded");
        let next = null;

        switch (event.key) {
            case "ArrowDown":
                next = items[index + 1] || null;
                break;
            case "ArrowUp":
                next = items[index - 1] || null;
                break;
            case "Home":
                next = items[0] || null;
                break;
            case "End":
                next = items[items.length - 1] || null;
                break;
            case "ArrowRight":
                if (expanded === "false") {
                    void this.toggle(id, true);
                } else if (expanded === "true") {
                    const first = (this.state.levels[id] || [])[0];
                    next = first ? this._item(first.id) : null;
                }
                break;
            case "ArrowLeft":
                if (expanded === "true") {
                    void this.toggle(id, false);
                } else {
                    const parent = item.getAttribute("data-wx-parent");
                    next = parent ? this._item(parent) : null;
                }
                break;
            case "Enter":
            case " ":
                // a link keeps its own activation, and a leaf has nothing to open
                if (expanded === null || (item.tagName === "A" && event.key === "Enter")) {
                    return;
                }
                this._choose(id);
                void this.toggle(id);
                break;
            case "*": {
                const parent = item.getAttribute("data-wx-parent") || webexpress.webapp.TreeCtrl.ROOT;
                for (const sibling of this.state.levels[parent] || []) {
                    if (sibling.hasChildren) {
                        void this.toggle(sibling.id, true);
                    }
                }
                break;
            }
            default:
                return;
        }

        event.preventDefault();
        if (next) {
            this._moveFocus(next);
        }
    }

    /**
     * Moves the tab stop and the focus to an item.
     * @param {HTMLElement} item - The tree item.
     */
    _moveFocus(item) {
        this._focus = item.getAttribute("data-wx-node");
        for (const other of this._element.querySelectorAll("[role=\"treeitem\"]")) {
            other.setAttribute("tabindex", other === item ? "0" : "-1");
        }
        // the browser's own scroll on focus centers the item and jumps the page; the nearest
        // scroll only moves as far as it takes to show an item that left the view
        item.focus({ preventScroll: true });
        item.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }

    /**
     * Refuses a move of a node into its own subtree, which would detach the subtree from the tree.
     * @param {CustomEvent} event - The check event of the drag-and-drop protocol.
     */
    _onDropCheck(event) {
        if (!this._isOwnMove(event.detail)) {
            return;
        }
        const { sources, target } = event.detail;

        for (const source of sources) {
            if (source.id === target.id || this._isAncestor(source.id, target.id)) {
                event.preventDefault();
                return;
            }
        }
    }

    /**
     * Moves a node that was dropped on another node of this tree.
     * @param {CustomEvent} event - The drop event of the drag-and-drop protocol.
     */
    _onDrop(event) {
        if (!this._isOwnMove(event.detail) || event.detail.sources.length !== 1) {
            return;
        }
        const { sources, target } = event.detail;

        event.stopPropagation();
        void this.move(sources[0].id, target.id, target.position === "into" ? "child" : target.position);
    }

    /**
     * Moves a node above, below or into another, announces the move and stores it the way a
     * control stores a change it applies at once: the cancelable before-save event, the task
     * events around the request, the saved event, and on a refusal the reason and the stored
     * state read back. A vetoed move is taken back without a word of failure.
     * @param {string} node - The moved node.
     * @param {string} target - The node it is placed at.
     * @param {string} position - "above", "below" or "child".
     * @returns {Promise<boolean>} True when the endpoint stored the move.
     */
    async move(node, target, position) {
        const from = this._parentOf(node);
        const to = position === "child" ? target : this._parentOf(target);
        if (from === undefined || to === undefined) {
            return false;
        }

        this.setState({ levels: webexpress.webapp.TreeCtrl.moveLocal(this.state.levels, node, target, position) });
        this._dispatch(webexpress.webui.Event.MOVE_EVENT, { node: node, target: target, position: position });

        if (!this._service) {
            return true;
        }

        // the endpoint decides where the node ends up, so the touched levels are read back in every case
        const readBack = async () => {
            for (const parent of new Set([from, to])) {
                await this._loadLevel(parent);
            }
        };

        this._dispatch(webexpress.webui.Event.TASK_START_EVENT, { name: "move" });
        let result;
        try {
            result = await this._saveAction("move", { node: node, target: target, position: position },
                (sent) => this._service.update(sent), () => { void readBack(); });
        } finally {
            this._dispatch(webexpress.webui.Event.TASK_FINISH_EVENT, { name: "move" });
        }

        if (!result.ok && result.error && result.error.kind === "abort") {
            return false;
        }

        if (!result.ok) {
            this._fail("move", result);
            webexpress.webapp.ErrorChannel.present(result, {
                service: this._service.name,
                heading: this._i18n("webexpress.webapp:tree.heading", "Tree"),
                message: this._i18n("webexpress.webapp:tree.move.rejected", "The move was not saved and has been taken back.")
            });
        }

        await readBack();
        return result.ok;
    }

    /**
     * Moves a node within the loaded levels.
     * @param {object} levels - The levels by parent key.
     * @param {string} node - The moved node.
     * @param {string} target - The node it is placed at.
     * @param {string} position - "above", "below" or "child".
     * @returns {object} The new levels.
     */
    static moveLocal(levels, node, target, position) {
        const next = {};
        let moved = null;
        for (const [parent, nodes] of Object.entries(levels)) {
            next[parent] = nodes.filter((x) => {
                if (x.id === node) {
                    moved = x;
                    return false;
                }
                return true;
            });
        }
        if (!moved) {
            return levels;
        }

        if (position === "child") {
            // the target now has children, which its indicator has to show
            for (const parent of Object.keys(next)) {
                next[parent] = next[parent].map((x) => (x.id === target && !x.hasChildren ? Object.assign({}, x, { hasChildren: true }) : x));
            }
            if (next[target]) {
                next[target] = [...next[target], moved];
            }
            return next;
        }

        for (const parent of Object.keys(next)) {
            const at = next[parent].findIndex((x) => x.id === target);
            if (at >= 0) {
                next[parent] = [...next[parent]];
                next[parent].splice(position === "below" ? at + 1 : at, 0, moved);
                break;
            }
        }
        return next;
    }

    /**
     * Tells whether a drop moves nodes of this tree onto a node of this tree. The ids alone do
     * not tell: two trees on a page may hold the same ids, so the drag has to have started in
     * this tree. A copy is no move and is left to the page.
     * @param {object} detail - The detail of the check or drop event.
     * @returns {boolean} True for a move inside the tree.
     */
    _isOwnMove(detail) {
        const { sources, origin, target, effect } = detail || {};
        return !!(this._movable && effect !== "copy" &&
            origin && this._element.contains(origin) &&
            target && target.kind === webexpress.webapp.TreeCtrl.KIND &&
            (!target.element || this._element.contains(target.element)) &&
            Array.isArray(sources) && sources.length > 0 &&
            sources.every((x) => x.kind === webexpress.webapp.TreeCtrl.KIND && this._parentOf(x.id) !== undefined));
    }

    /**
     * Tells whether a node lies above another in the loaded hierarchy.
     * @param {string} ancestor - The possible ancestor.
     * @param {string} id - The node.
     * @returns {boolean} True when the ancestor is on the node's path.
     */
    _isAncestor(ancestor, id) {
        let parent = this._parentOf(id);
        while (parent) {
            if (parent === ancestor) {
                return true;
            }
            parent = this._parentOf(parent);
        }
        return false;
    }

    /**
     * Returns the parent key of a loaded node.
     * @param {string} id - The node id.
     * @param {object} [state] - The state to look in.
     * @returns {string|undefined} The parent key, "" for a root node, undefined when not loaded.
     */
    _parentOf(id, state = this.state) {
        for (const [parent, nodes] of Object.entries(state.levels)) {
            if (nodes.some((x) => x.id === id)) {
                return parent;
            }
        }
        return undefined;
    }

    /**
     * Returns the item element of a node.
     * @param {string} id - The node id.
     * @returns {HTMLElement|null} The tree item.
     */
    _item(id) {
        return Array.from(this._element.querySelectorAll("[role=\"treeitem\"]"))
            .find((x) => x.getAttribute("data-wx-node") === id) || null;
    }

    /**
     * Loads one level; levels load side by side, so each has its own request channel.
     * @param {string} parent - The parent key.
     * @returns {Promise<boolean>} True when the level arrived.
     */
    async _loadLevel(parent) {
        if (!this._service) {
            return false;
        }

        this.setState({ loading: [...this.state.loading.filter((x) => x !== parent), parent] });
        const result = await this._service.query(parent ? { node: parent } : {}, { channel: "tree:" + parent });
        this.setState({ loading: this.state.loading.filter((x) => x !== parent) });

        if (!result.ok) {
            this._fail("load", result);
            return false;
        }

        const levels = Object.assign({}, this.state.levels, { [parent]: webexpress.webapp.TreeCtrl.normalize(result.data) });
        this.setState({ levels: levels, error: null });
        return true;
    }

    /**
     * Reports a failed request; a request a newer one replaced is no failure.
     * @param {string} action - The action that failed.
     * @param {object} result - The service result.
     */
    _fail(action, result) {
        if (result.error && result.error.kind === "abort") {
            return;
        }
        this.setState({ error: result.error || null });
        this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, { action: action, error: result.error });
    }

    /**
     * Removes the listeners of the host.
     */
    destroy() {
        this._element.removeEventListener("keydown", this._onKeyDownBound);
        this._element.removeEventListener(webexpress.webui.Event.DROP_CHECK_EVENT, this._onDropCheckBound);
        this._element.removeEventListener(webexpress.webui.Event.DROP_EVENT, this._onDropBound);
        super.destroy();
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-tree", webexpress.webapp.TreeCtrl);
