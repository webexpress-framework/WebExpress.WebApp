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
    _orderBy = null;      // current sort column id
    _orderDir = null;     // current sort direction ('asc'/'desc')
    
    _filter = "";
    _page = 0;
    _pageSize = 50;

    // placeholder data for initial state
    _previewColumns = [
        { label: "Loading...", width: null, visible: true },
        { label: "Loading...", width: null, visible: true },
        { label: "Loading...", width: null, visible: true }
    ];
    _previewBody = [
        { cells: [{ content: "..." }, { content: "..." }, { content: "..." }] },
        { cells: [{ content: "..." }, { content: "..." }, { content: "..." }] },
        { cells: [{ content: "..." }, { content: "..." }, { content: "..." }] }
    ];

    /**
     * Constructor for the TableCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");

        this._initPersistenceListeners(element);

        // set initial placeholder state
        this._columns = this._previewColumns;
        this._rows = this._previewBody;
        this._table.classList.add("placeholder-glow");

        this.render();

        // setup sort event listener
        document.addEventListener(webexpress.webui.Event.TABLE_SORT_EVENT, (e) => {
            const detail = e.detail || {};
            // filter: Respond only if this specific table triggered the sort
            if (detail.columnId && (!detail.id || detail.id === this._element.id)) {
                this._orderBy = detail.columnId;
                this._orderDir = detail.sortDirection;
                
                // if standalone (REST URI present), reload internally
                if (this._restUri) {
                    this._receiveData();
                } else {
                    // dispatch a specific request event for external controllers (ViewCtrl)
                    this._element.dispatchEvent(new CustomEvent("wx-req-sort", {
                        bubbles: true,
                        detail: { 
                            orderBy: this._orderBy, 
                            orderDir: this._orderDir 
                        }
                    }));
                }
            }
        });

        // trigger initial fetch if configured as standalone
        if (this._restUri) {
            this._receiveData();
        }
    }

    /**
     * Fetches data from the configured REST endpoint (Standalone Mode).
     */
    _receiveData() {
        if (!this._restUri) return;

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
                if (!res.ok) throw new Error("Request failed");
                return res.json();
            })
            .then((response) => {
                this.updateData(response);
                
                // dispatch event so other components (e.g. external paginator) can update
                this._element.dispatchEvent(new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: { id: this._element.id, response: response }
                }));
            })
            .catch((error) => {
                console.error("TableCtrl Request failed:", error);
            });
    }

    /**
     * Public API to update the table with new data.
     * Used by _receiveData (internal) or ViewCtrl (external).
     * @param {Object} response - The API response object containing 'rows' and 'columns'.
     */
    updateData(response) {
        if (!response) return;

        // process Columns
        this._columns = (response.columns || []).map((c, idx) => {
            // correct parsing of template structure
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
                id: c.id || `col_${idx}`,
                label: c.label || c.id,
                name: c.name || null,
                visible: typeof c.visible === "boolean" ? c.visible : true,
                sort: null, // reset, applied below
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

        // apply current sort state to columns so arrows render correctly
        if (this._orderBy) {
            const targetCol = this._columns.find(c => c.id === this._orderBy);
            if (targetCol) {
                targetCol.sort = this._orderDir || "asc";
            }
        }

        // process Rows
        this._rows = (response.rows || []).map((row) => {
            if (!row.cells) {
                row.cells = [];
            }
            return row;
        });

        // determine if options column is needed
        this._hasOptions = (this._options && this._options.length > 0)
            || this._rows.some((r) => { return r.options && r.options.length > 0; });

        // remove loading state and render
        this._table.classList.remove("placeholder-glow");
        this.render();
    }

    /**
     * Initializes listeners for layout changes (column reorder/visibility).
     * @param {HTMLElement} element Host element.
     */
    _initPersistenceListeners(element) {
       
        const notifyStateChange = (type) => {
            const colOrder = this._columns
                .filter((c) => c.visible)
                .map((c) => c.id)
                .join(",");
            
            const rowOrder = this._rows.map((r) => r.id).join(",");

            // notify parent controller or listener
            this._element.dispatchEvent(new CustomEvent("wx-req-update-state", {
                bubbles: true,
                detail: {
                    type: type,
                    columnOrder: colOrder,
                    rowOrder: rowOrder
                }
            }));
            
            if (this._restUri) {
                this._sendStateToServer(type === "row-reorder" ? { r: rowOrder } : { c: colOrder });
            }
        };

        element.addEventListener(webexpress.webui.Event.COLUMN_REORDER_EVENT, () => notifyStateChange("column-reorder"));
        element.addEventListener(webexpress.webui.Event.COLUMN_VISIBILITY_EVENT, () => notifyStateChange("column-visibility"));
        element.addEventListener(webexpress.webui.Event.ROW_REORDER_EVENT, () => notifyStateChange("row-reorder"));
    }

    /**
     * Sends state update to server (Standalone mode).
     */
    _sendStateToServer(stateObj) {
        if (!this._restUri) return;
        
        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stateObj)
        }).catch(err => console.error("Update state failed", err));
    }

    /**
     * Renders a single row into the provided document fragment.
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
     * Renders cell content.
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
                const val = (cell.content !== undefined && cell.content !== null) ? cell.content : (cell.value || "");

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
                wrap.textContent = (cell.content !== undefined && cell.content !== null) ? cell.content : (cell.value || "");
            }
        } else {
            wrap.appendChild(document.createTextNode(cell.content || ""));
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