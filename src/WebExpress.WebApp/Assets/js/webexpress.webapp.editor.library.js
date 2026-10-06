/**
 * The searchable list behind the link and image pages WebApp adds to the editor's dialogs.
 * It loads the entries of a service address through the service layer - a file result like
 * the one of the file view, or a list of links - and lets one entry be chosen. A double click
 * chooses and submits the dialog, so picking a well-known entry is one gesture.
 */
webexpress.webapp.EditorLibrary = class {
    static SEARCH_DELAY = 250;

    /**
     * Creates the list.
     * @param {object} options - The list options.
     * @param {string} options.uri - The service address the entries are loaded from; empty for a list
     *   that only shows the entries added to it.
     * @param {string} options.className - The css class of the list root.
     * @param {Function} options.render - Builds the content of an entry from an item.
     * @param {Function} [options.accept] - Decides whether an item can be offered at all.
     * @param {Function} [options.activate] - Called on a double click, after the entry was chosen.
     */
    constructor(options) {
        this._options = options;
        this._items = [];
        this._selected = null;
        this._current = null;
        this._generation = 0;
        this._timer = null;

        this.element = document.createElement("div");
        this.element.className = options.className;

        this._search = document.createElement("input");
        this._search.type = "search";
        this._search.className = "form-control mb-2";
        this._search.placeholder = webexpress.webui.I18N.translate("webexpress.webapp:editor.library.search");
        this._search.setAttribute("aria-label", this._search.placeholder);
        this._search.hidden = !options.uri;
        this._search.addEventListener("input", () => {
            clearTimeout(this._timer);
            this._timer = setTimeout(() => this.load(), this.constructor.SEARCH_DELAY);
        });

        this._list = document.createElement("div");
        this._list.className = "wx-webapp-editor-library-items";
        this._list.setAttribute("role", "listbox");

        this._status = document.createElement("div");
        this._status.className = "wx-webapp-editor-library-status form-text";
        this._status.setAttribute("role", "status");

        this.element.appendChild(this._search);
        this.element.appendChild(this._list);
        this.element.appendChild(this._status);
    }

    /**
     * Gets the chosen item.
     * @returns {object|null} The item, or null while nothing is chosen.
     */
    get selected() {
        return this._selected;
    }

    /**
     * Starts a new opening of the dialog: no choice, no search, and the entry that stands for
     * what is being edited chosen as soon as it is listed.
     * @param {string|null} [current=null] - The address being edited.
     */
    reset(current = null) {
        clearTimeout(this._timer);
        this._selected = null;
        this._current = current || null;
        this._search.value = "";
        this._items = [];
        this._renderItems();
    }

    /**
     * Loads the entries matching the search. A response that arrives after a newer request was
     * sent is dropped, so a slow answer never replaces the list of the current search.
     * @returns {Promise<void>} Settles once the list shows the result.
     */
    async load() {
        if (!this._options.uri) {
            this._renderItems();
            return;
        }

        const generation = ++this._generation;
        this._status.textContent = webexpress.webui.I18N.translate("webexpress.webapp:editor.library.loading");
        const result = await webexpress.webapp.ServiceRegistry.request(this.constructor.url(this._options.uri, this._search.value), {
            method: "GET",
            headers: { Accept: "application/json" }
        });
        if (generation !== this._generation) {
            return;
        }
        if (!result.ok) {
            this._items = [];
            this._renderItems(webexpress.webui.I18N.translate("webexpress.webapp:editor.library.failed"));
            return;
        }

        // an entry added by an upload stays in front until the library lists it itself
        const loaded = this.constructor.items(result.data);
        const added = this._items.filter(item => item._added && !loaded.some(other => other.uri === item.uri));
        this._items = [...added, ...loaded];
        this._renderItems();
    }

    /**
     * Puts an item in front of the list and chooses it, for an entry that was just created.
     * @param {object} item - The item.
     */
    add(item) {
        const entry = Object.assign({}, item, { _added: true });
        this._items = [entry, ...this._items.filter(other => other.uri !== entry.uri)];
        this._selected = entry;
        this._renderItems();
    }

    /**
     * Builds the request address of a search, keeping a query the service address already carries.
     * @param {string} uri - The service address.
     * @param {string} [query=""] - The search text.
     * @returns {string} The request address.
     */
    static url(uri, query = "") {
        const text = String(query || "").trim();
        if (!text) {
            return uri;
        }
        return uri + (uri.includes("?") ? "&" : "?") + "q=" + encodeURIComponent(text);
    }

    /**
     * Reads the items of a response, which is either a result with items or a plain array.
     * @param {*} data - The parsed response.
     * @returns {Array<object>} The items that carry an address.
     */
    static items(data) {
        const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        return items.filter(item => item && typeof item.uri === "string" && item.uri.trim() !== "");
    }

    /**
     * Names an item for a link text or an alternative text: its title, its name without the
     * file extension, or the last segment of its address.
     * @param {object} item - The item.
     * @returns {string} The name.
     */
    static label(item) {
        if (item.title) {
            return String(item.title);
        }
        if (item.name) {
            return String(item.name).replace(/\.[^.\s]+$/, "");
        }
        return decodeURIComponent(String(item.uri).split(/[?#]/)[0].split("/").filter(Boolean).pop() || item.uri);
    }

    /**
     * Shows the items, with the chosen one marked and a status line for an empty or failed list.
     * @param {string} [message] - The status to show instead of the default.
     */
    _renderItems(message) {
        const accept = this._options.accept || (() => true);
        const items = this._items.filter(accept);
        if (!this._selected && this._current) {
            this._selected = items.find(item => item.uri === this._current) || null;
        }

        const frag = document.createDocumentFragment();
        for (const item of items) {
            const entry = document.createElement("button");
            entry.type = "button";
            entry.className = "wx-webapp-editor-library-item";
            entry.setAttribute("role", "option");
            entry.setAttribute("aria-selected", String(item === this._selected));
            entry.title = item.uri;
            entry.appendChild(this._options.render(item));
            entry.addEventListener("click", () => {
                this._selected = item;
                this._renderItems();
            });
            entry.addEventListener("dblclick", () => {
                this._selected = item;
                this._renderItems();
                this._options.activate?.(item);
            });
            frag.appendChild(entry);
        }
        while (this._list.firstChild) {
            this._list.removeChild(this._list.firstChild);
        }
        this._list.appendChild(frag);

        this._status.textContent = message
            || (items.length === 0 && this._options.uri ? webexpress.webui.I18N.translate("webexpress.webapp:editor.library.empty") : "");
    }
};
