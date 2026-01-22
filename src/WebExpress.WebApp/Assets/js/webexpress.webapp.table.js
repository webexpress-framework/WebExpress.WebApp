/**
 * A rest table control extending the reorderable table class with REST-API integration.
 * Fetches data and columns from a REST endpoint.
 * Supports rich cell rendering via registered TableTemplates.
 * Sends optimized command-based updates (PUT) to the server.
 *
 * The following events are triggered:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.TableCtrl = class extends webexpress.webui.TableCtrlReorderable {

    _restUri = "";
    _titleDiv = null;
    _progressDiv = null;
    _filterDiv = null;
    _statusDiv = null;
    _paginationDiv = null;

    _filterCtrl = null;
    _paginationCtrl = null;

    _filter = null;
    _page = 0;
    _hasOptions = false;

    _columnSearchTimer = null;

    _orderBy = null;      // sort column id ('o')
    _orderDir = null;     // sort direction ('d')
    _pageSize = 50;       // page size ('limit'), default 50

    // placeholder data for loading state
    _previewColumns = [
        { label: "Loading...", width: null, visible: true },
        { label: "Loading...", width: null, visible: true },
        { label: "Loading...", width: null, visible: true }
    ];
    _previewBody = [
        { cells: [{ text: "..." }, { text: "..." }, { text: "..." }] },
        { cells: [{ text: "..." }, { text: "..." }, { text: "..." }] },
        { cells: [{ text: "..." }, { text: "..." }, { text: "..." }] }
    ];

    /**
     * Constructor for the TableCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");

        this._initRestUi(element);
        this._initPersistenceListeners(element);

        this._columns = this._previewColumns;
        this._rows = this._previewBody;
        this._table.classList.add("placeholder-glow");

        this.render();

        // set up sort event handler to use 'o'/'d' as state
        document.addEventListener(webexpress.webui.Event.TABLE_SORT_EVENT, (e) => {
            const detail = e.detail || {};
            if (detail.columnId) {
                this._orderBy = detail.columnId;
                this._orderDir = detail.sortDirection;
                this._receiveData();
            }
        });

        this._receiveData();
    }

    /**
     * Initializes the REST specific UI elements (toolbar, statusbar).
     * @param {HTMLElement} element Host element.
     */
    _initRestUi(element) {
        const createDiv = (cls) => {
            const d = document.createElement("div");
            if (cls) {
                d.className = cls;
            }
            return d;
        };

        this._titleDiv = document.createElement("h3");
        this._titleDiv.className = "me-auto";

        this._filterDiv = createDiv("col-3");

        const toolbar = createDiv("wx-toolbar");
        toolbar.appendChild(this._titleDiv);
        toolbar.appendChild(this._filterDiv);

        this._progressDiv = createDiv("progress");
        this._progressDiv.setAttribute("role", "status");
        this._progressDiv.style.height = "0.5em";
        
        const bar = createDiv("progress-bar progress-bar-striped progress-bar-animated");
        bar.style.width = "100%";
        this._progressDiv.appendChild(bar);

        element.insertBefore(toolbar, this._table);
        element.insertBefore(this._progressDiv, this._table);

        this._statusDiv = document.createElement("span");
        this._paginationDiv = createDiv("justify-content-end");

        const statusbar = createDiv("wx-table-statusbar");
        statusbar.appendChild(this._statusDiv);
        statusbar.appendChild(this._paginationDiv);

        element.appendChild(statusbar);

        this._filterCtrl = new webexpress.webui.SearchCtrl(this._filterDiv);
        this._paginationCtrl = new webexpress.webui.PaginationCtrl(this._paginationDiv);

        document.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, (event) => {
            const data = event.detail || {};
            if (data.sender && data.sender === this._filterDiv) {
                this._filter = data.value;
                this._page = 0;
                this._receiveData();
            }
        });

        document.addEventListener(webexpress.webui.Event.CHANGE_PAGE_EVENT, (event) => {
            const data = event.detail || {};
            if (data.sender && data.sender === this._paginationDiv) {
                this._page = data.page;
                this._receiveData();
            }
        });

        document.addEventListener(webexpress.webapp.Event.UPDATE_EVENT, (event) => {
            this._receiveData();
        });
    }

    /**
     * Initializes listeners for layout changes to persist them via REST.
     * @param {HTMLElement} element Host element.
     */
    _initPersistenceListeners(element) {
        element.addEventListener(webexpress.webui.Event.COLUMN_REORDER_EVENT, (e) => {
            // Send visible column ids in order as 'c' per spec. Only IDs, not names/labels.
            const colOrder = this._columns
                .filter((c) => c.visible)
                .map((c) => c.id)
                .join(",");
            this._sendStateToServer({ c: colOrder });
        });

        element.addEventListener(webexpress.webui.Event.COLUMN_VISIBILITY_EVENT, (e) => {
            // Also send the full new visible column ids as 'c' per spec after any vis toggle.
            const colOrder = this._columns
                .filter((c) => c.visible)
                .map((c) => c.id)
                .join(",");
            this._sendStateToServer({ c: colOrder });
        });

        element.addEventListener(webexpress.webui.Event.ROW_REORDER_EVENT, (e) => {
            // Send current row ids in order as 'r' per spec. Only IDs.
            const rowOrder = this._rows.map((r) => r.id).join(",");
            this._sendStateToServer({ r: rowOrder });
        });

        // Sort event triggers a reload with o/d parameters, not persisted via server PUT/POST.
    }

    /**
     * Sends the current column or row state (with ids) to the server using PUT, per REST-API conventions.
     * Only the relevant property is sent: { c: "..."} or { r: "..." }.
     * Always uses only ids and only sends changed order.
     * @param {Object} stateObj Eg {c: "..."} or {r: "..."}
     */
    _sendStateToServer(stateObj) {
        if (!this._restUri) {
            return;
        }

        if (this._progressDiv) {
            this._progressDiv.style.visibility = "visible";
        }

        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stateObj)
        })
        .then((res) => {
            if (!res.ok) {
                throw new Error("Update failed");
            }
        })
        .catch((err) => {
            console.error(`Failed to update table state:`, err);
        })
        .finally(() => {
            if (this._progressDiv) {
                this._progressDiv.style.visibility = "hidden";
            }
        });
    }

    /**
     * Fetches table data from the configured REST endpoint using correct new API parameters.
     * Uses only IDs and correct param names for sort (o/d), page (p), pagesize (limit), filter (q).
     */
    _receiveData() {
        if (this._progressDiv) {
            this._progressDiv.style.visibility = "visible";
        }

        const filter = encodeURIComponent(this._filter ?? "");
        const separator = this._restUri.includes("?") ? "&" : "?";
        let url = `${this._restUri}${separator}q=${filter}&p=${this._page}&limit=${this._pageSize}`;

        if (this._orderBy) {
            url += `&o=${encodeURIComponent(this._orderBy)}`;
            if (this._orderDir) {
                url += `&d=${encodeURIComponent(this._orderDir)}`;
            }
        }

        fetch(url)
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Request failed");
                }
                return res.json();
            })
            .then((response) => {
                const page = response.pagination?.page ?? 0;
                const pageSize = response.pagination?.pageSize ?? 50;
                const total = response.pagination?.total ?? 0;
                const totalPages = Math.ceil(total / pageSize);
                const startIndex = page * pageSize + 1;
                const endIndex = Math.min(startIndex + pageSize - 1, total);

                this._columns = (response.columns || []).map((c, idx) => {
                    // correct parsing of template structure
                    let rType = c.rendererType || null;
                    let rOpts = c.rendererOptions || {};

                    if (c.template && typeof c.template === "object") {
                        rType = c.template.type;
                        rOpts = c.template.options || {};
                        // propagate editable flag if present in template
                        if (c.template.editable) {
                            rOpts.editable = c.template.editable;
                        }
                    }

                    return {
                        id: c.id || `col_${idx}`,
                        label: c.label || c.id,
                        name: c.name || null,
                        visible: typeof c.visible === "boolean" ? c.visible : true,
                        sort: null, // always reset, will set below
                        width: c.width || null,
                        minWidth: c.minWidth || null,
                        resizable: typeof c.resizable === "boolean" ? c.resizable : true,
                        icon: c.icon || null,
                        image: c.image || null,
                        color: c.color || null,
                        rendererType: rType,
                        rendererOptions: rOpts
                    };
                });

                // sort indicator handling (for header arrow)
                for (const col of this._columns) {
                    col.sort = null;
                }
                if (this._orderBy) {
                    const targetCol = this._columns.find(c => c.id === this._orderBy);
                    if (targetCol) {
                        targetCol.sort = this._orderDir || "asc";
                    }
                }

                if (this._titleDiv) {
                    this._titleDiv.textContent = response.title || "";
                }
                if (this._statusDiv) {
                    this._statusDiv.textContent = `${startIndex} - ${endIndex} / ${total}`;
                }

                this._element.dispatchEvent(new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: { id: this._element.id, response: response }
                }));

                if (this._paginationCtrl) {
                    this._paginationCtrl.total = totalPages;
                    this._paginationCtrl.page = page;
                }

                this._table.classList.remove("placeholder-glow");

                this._rows = (response.rows || []).map((row) => {
                    if (!row.cells) {
                        row.cells = [];
                    }
                    return row;
                });

                this._hasOptions = (this._options && this._options.length > 0)
                    || this._rows.some((r) => { return r.options && r.options.length > 0; });

                requestAnimationFrame(() => {
                    this.render();
                    if (this._progressDiv) {
                        this._progressDiv.style.visibility = "hidden";
                    }
                });
            })
            .catch((error) => {
                console.error("Request failed:", error);
                if (this._progressDiv) {
                    this._progressDiv.style.visibility = "hidden";
                }
            });
    }

    /**
     * Debounces remote column search requests. Ensures that the search
     * operation is only triggered after the user stops typing for a short
     * period, reducing unnecessary network calls.
     *
     * @param {string} term - The search term entered by the user.
     */
    _searchColumnsDebounced(term) {
        if (this._columnSearchTimer) {
            clearTimeout(this._columnSearchTimer);
        }
        this._columnSearchTimer = setTimeout(() => {
            this._searchColumns(term);
        }, 250);
    }

    /**
     * Performs a remote column search against the configured REST endpoint.
     * The server is expected to return a list of column definitions, which
     * are merged into the existing column set. Newly discovered columns are
     * added, while existing ones are updated without overriding visibility.
     *
     * @param {string} term - The search term entered by the user.
     */
    _searchColumns(term) {
        if (!this._restUri) {
            return;
        }
        const q = term.trim();
        if (!q) {
            return;
        }

        const separator = this._restUri.includes("?") ? "&" : "?";
        const url = `${this._restUri}${separator}columnSearch=${encodeURIComponent(q)}&columnsOnly=true`;

        fetch(url)
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Column search failed");
                }
                return res.json();
            })
            .then((resp) => {
                const fetched = (resp.columns || []).map((c, idx) => {
                    let rType = c.rendererType || null;
                    let rOpts = c.rendererOptions || {};

                    if (c.template && typeof c.template === "object") {
                        rType = c.template.type;
                        rOpts = c.template.options || {};
                        if (c.template.editable) {
                            rOpts.editable = c.template.editable;
                        }
                    }

                    return {
                        id: c.id || `col_search_${idx}`,
                        label: c.label || c.id || `Column ${idx + 1}`,
                        name: c.name || null,
                        visible: typeof c.visible === "boolean" ? c.visible : false,
                        sort: null,
                        width: c.width || null,
                        minWidth: c.minWidth || null,
                        resizable: typeof c.resizable === "boolean" ? c.resizable : true,
                        icon: c.icon || null,
                        image: c.image || null,
                        color: c.color || null,
                        rendererType: rType,
                        rendererOptions: rOpts
                    };
                });

                const byId = new Map(this._columns.map((c) => {
                    return [c.id, c];
                }));
                fetched.forEach((col) => {
                    const existing = byId.get(col.id);
                    if (existing) {
                        const keepVisible = typeof existing.visible === "boolean" ? existing.visible : col.visible;
                        Object.assign(existing, col, { visible: keepVisible });
                    } else {
                        this._columns.push(col);
                        byId.set(col.id, col);
                    }
                });

                this.render();

                if (this._columnsSidebarPanel && typeof this._columnsSidebarPanel.isShown === "function" && this._columnsSidebarPanel.isShown()) {
                    if (typeof this._columnsSidebarPanel.show === "function") {
                        this._columnsSidebarPanel.show();
                    }
                }
            })
            .catch((err) => {
                console.error("Column search failed:", err);
            });
    }

    /**
     * Renders a single row into the provided document fragment, including
     * drag handles, cells, action menus, and optional tree toggles.
     *
     * @param {Object} row - The row definition containing cells, styling, and metadata.
     * @param {number} depth - The hierarchical depth of the row (for tree mode).
     * @param {DocumentFragment} fragment - The fragment to append the rendered row to.
     * @param {Set<string>} [changedIds] - Optional set of row keys that changed since the last render.
     * @param {Set<string>} [newIds] - Optional set of newly added row keys.
     */
    _addRow(row, depth, fragment, changedIds, newIds) {
        const tr = document.createElement("div");
        tr.className = "wx-grid-row";
        tr.setAttribute("role", "row");

        this._addClasses(tr, row.color);
        this._addClasses(tr, row.class);
        if (row.style) {
            tr.style.cssText = row.style;
        }

        const key = this._getRowKey(row);
        if (key) {
            if (changedIds && changedIds.has(key)) {
                tr.classList.add("wx-change-flash");
            }
        }

        tr._dataRowRef = row;
        row._anchorTr = tr;
        row._depth = depth;

        if (this._movableRow) {
            const tdDrag = document.createElement("div");
            tdDrag.className = "wx-grid-cell wx-table-drag-handle";
            tdDrag.setAttribute("role", "gridcell");
            tdDrag.textContent = "⠿";
            tdDrag.tabIndex = 0;
            tdDrag.setAttribute("role", "button");
            tdDrag.style.cursor = "grab";
            tr.appendChild(tdDrag);
        }

        let visibleColCounter = 0;
        const len = this._columns.length;

        for (let i = 0; i < len; i++) {
            const colDef = this._columns[i];
            if (!colDef.visible) {
                continue;
            }

            const td = document.createElement("div");
            td.className = "wx-grid-cell";
            td.setAttribute("role", "gridcell");
            td.style.overflow = "hidden";

            const cell = row.cells[i];
            const isFirstVisible = (visibleColCounter === 0);
            visibleColCounter++;

            if (cell) {
                this._addClasses(td, cell.color);
                this._addClasses(td, cell.class);
                if (cell.style) {
                    td.style.cssText += (td.style.cssText ? "; " : "") + cell.style;
                }

                const wrap = this._renderCell(row, colDef, cell, isFirstVisible);
                td.appendChild(wrap);
            } else {
                td.textContent = "";
            }
            tr.appendChild(td);
        }

        if (this._hasOptions || this._allowColumnRemove) {
            const effectiveOptions = (row.options && row.options.length) ? row.options : this._options;
            const tdOpt = document.createElement("div");
            tdOpt.className = "wx-grid-cell wx-table-actions";
            tdOpt.setAttribute("role", "gridcell");

            if (effectiveOptions && effectiveOptions.length > 0) {
                const div = document.createElement("div");
                div.dataset.icon = "fas fa-cog";
                div.dataset.size = "btn-sm";
                div.dataset.border = "false";
                tdOpt.appendChild(div);
                const ctrl = new webexpress.webui.DropdownCtrl(div);
                ctrl.items = effectiveOptions;
            }
            tr.appendChild(tdOpt);
        }

        if (this._isTree) {
            this._injectTreeToggle(tr, row, depth);
        }

        fragment.appendChild(tr);
    }

    /**
     * Renders the content of a single table cell, including icons, images,
     * template-based renderers, and optional hyperlink wrapping.
     *
     * @param {Object} row - The row object containing metadata and cell values.
     * @param {Object} colDef - The column definition, including template configuration.
     * @param {Object} cell - The cell data (text, value, icon, image, uri, etc.).
     * @param {boolean} isFirstVisible - Indicates whether this is the first visible column in the row.
     * @returns {HTMLElement} The rendered cell content wrapper.
     */
    _renderCell(row, colDef, cell, isFirstVisible) {
        const wrap = document.createElement("div");
        wrap.className = "wx-cell-content";

        if (isFirstVisible) {
            if (row.icon) {
                const i = document.createElement("i");
                i.className = row.icon;
                wrap.appendChild(i);
            } else if (row.image) {
                const img = document.createElement("img");
                img.className = "wx-icon";
                img.src = row.image;
                img.alt = "";
                wrap.appendChild(img);
            }
        }

        if (cell.image) {
            const img = document.createElement("img");
            img.className = "wx-icon";
            img.src = cell.image;
            img.alt = "";
            wrap.appendChild(img);
        }
        if (cell.icon) {
            const i = document.createElement("i");
            i.className = cell.icon;
            wrap.appendChild(i);
        }

        const renderType = cell.type || colDef.rendererType;

        if (renderType) {
            const renderer = webexpress.webui.TableTemplates.get(renderType);

            if (renderer) {
                const opts = Object.assign({}, renderer.options, colDef.rendererOptions || {});

                const val = (cell.text !== undefined && cell.text !== null) ? cell.text : (cell.value || "");

                try {
                    const result = renderer.fn(val, this, row, cell, colDef.name || colDef.id, opts);
                    if (result instanceof Node) {
                        wrap.appendChild(result);
                    } else {
                        wrap.textContent = String(result ?? "");
                    }
                } catch (e) {
                    console.error(`Error in table renderer '${renderType}':`, e);
                    wrap.textContent = val;
                }
            } else {
                console.warn(`Table renderer type '${renderType}' not found.`);
                wrap.textContent = (cell.text !== undefined && cell.text !== null) ? cell.text : (cell.value || "");
            }
        } else {
            wrap.appendChild(document.createTextNode(cell.text || ""));
        }

        const cellHref = cell.uri || null;
        const cellTarget = cell.target || null;
        const rowHref = isFirstVisible ? (row.uri || null) : null;
        const rowTarget = isFirstVisible ? (row.target || null) : null;

        const hrefToUse = cellHref || rowHref;
        const targetToUse = cellTarget || rowTarget;

        if (hrefToUse) {
            const a = document.createElement("a");
            a.href = hrefToUse;
            a.className = "wx-link";
            if (targetToUse) {
                a.target = targetToUse;
            }
            a.rel = "noopener noreferrer";

            while (wrap.firstChild) {
                a.appendChild(wrap.firstChild);
            }
            wrap.appendChild(a);
        }

        return wrap;
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-table", webexpress.webapp.TableCtrl);