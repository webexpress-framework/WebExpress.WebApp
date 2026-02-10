/**
 * ViewCtrl - Fixed Selectors & Hybrid Mode Support
 * Centralized data manager and UI container.
 * Supports both centralized data (URI on View) and distributed data (URIs on sub-components).
 */
webexpress.webapp.ViewCtrl = class extends webexpress.webui.Ctrl {

    // core state
    _restUri = "";
    _page = 0;
    _pageSize = 50;
    _filter = "";
    _orderBy = null;
    _orderDir = null;

    // request handling
    _abortController = null;
    _debounceTimer = null;
    _lastResponse = null;

    // layout mode
    _mode = "table";
    _viewConfig = [
        { id: "table", label: "Table", icon: "fa-table" },
        { id: "table-detail", label: "Table & Detail", icon: "fa-table-columns" },
        { id: "tiles", label: "Tiles", icon: "fa-border-all" },
        { id: "graph", label: "Graph", icon: "fa-diagram-project" },
        { id: "frame", label: "Frame", icon: "fa-window-maximize" }
    ];

    // ui references
    _views = {
        toolbar: null,
        statusbar: null,
        content: null,
        tableContainer: null,     
        detailContainer: null,    
        detailSidePane: null,     
        tilesContainer: null,
        graphContainer: null,
        frameContainer: null
    };

    _ctrls = {
        table: null,
        tile: null,
        graph: null,
        frame: null,
        detailFrame: null,
        split: null,
        pagination: null
    };

    _elements = {
        title: null,
        searchInput: null,
        progressBar: null,
        statusText: null,
        viewBtnLabel: null
    };

    constructor(element) {
        super(element);

        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");

        const initialMode = (element.dataset.mode || "table").toLowerCase();
        if (this._viewConfig.some(c => c.id === initialMode)) {
            this._mode = initialMode;
        }

        this._initLayout(element);
        this._initControllers();
        this._setupGlobalEvents();

        this.setMode(this._mode);

        // Only fetch centrally if a URI is configured on the ViewCtrl itself
        if (this._restUri) {
            this._fetchData();
        }
    }

    _initLayout(host) {
        host.classList.add("wx-view", "d-flex", "flex-column");
        host.style.height = "100%";

        const frag = document.createDocumentFragment();
        while (host.firstChild) {
            frag.appendChild(host.firstChild);
        }

        this._buildToolbar(host);

        const progress = document.createElement("div");
        progress.className = "progress wx-view-progress";
        progress.style.height = "0.25em";
        progress.style.visibility = "hidden";
        progress.innerHTML = '<div class="progress-bar progress-bar-striped progress-bar-animated w-100"></div>';
        this._elements.progressBar = progress;
        host.appendChild(progress);

        const content = document.createElement("div");
        content.className = "wx-view-content flex-fill position-relative overflow-hidden";
        this._views.content = content;
        host.appendChild(content);

        this._buildStatusbar(host);
        
        // Critical: Distribute markup with correct selectors
        this._distributeMarkup(frag, content);
    }

    _buildToolbar(host) {
        const tb = document.createElement("div");
        tb.className = "wx-view-toolbar d-flex align-items-center p-2 border-bottom bg-light";

        this._elements.title = document.createElement("h4");
        this._elements.title.className = "mb-0 me-auto text-truncate";
        this._elements.title.textContent = "Data View"; // Default title
        tb.appendChild(this._elements.title);

        // Search
        const searchGroup = document.createElement("div");
        searchGroup.className = "input-group input-group-sm w-auto me-2";
        const addon = document.createElement("span");
        addon.className = "input-group-text bg-white";
        addon.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
        this._elements.searchInput = document.createElement("input");
        this._elements.searchInput.type = "text";
        this._elements.searchInput.className = "form-control";
        this._elements.searchInput.placeholder = "Search...";
        this._elements.searchInput.addEventListener("input", () => this._handleSearchInput());
        searchGroup.appendChild(addon);
        searchGroup.appendChild(this._elements.searchInput);
        tb.appendChild(searchGroup);

        // View Switcher
        const dropdown = document.createElement("div");
        dropdown.className = "dropdown me-2";
        const ddBtn = document.createElement("button");
        ddBtn.className = "btn btn-sm btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2";
        ddBtn.type = "button";
        ddBtn.setAttribute("data-bs-toggle", "dropdown");
        this._elements.viewBtnLabel = document.createElement("span");
        this._elements.viewBtnLabel.className = "d-none d-md-inline";
        this._elements.viewBtnLabel.textContent = "View";
        ddBtn.innerHTML = '<i class="fa-solid fa-layer-group"></i>';
        ddBtn.appendChild(this._elements.viewBtnLabel);

        const ddMenu = document.createElement("ul");
        ddMenu.className = "dropdown-menu dropdown-menu-end";
        this._viewConfig.forEach(cfg => {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.className = "dropdown-item d-flex align-items-center gap-2";
            a.href = "#";
            a.innerHTML = `<i class="fa-solid ${cfg.icon} fa-fw"></i> ${cfg.label}`;
            a.addEventListener("click", (e) => {
                e.preventDefault();
                this.setMode(cfg.id);
            });
            li.appendChild(a);
            ddMenu.appendChild(li);
        });
        dropdown.appendChild(ddBtn);
        dropdown.appendChild(ddMenu);
        tb.appendChild(dropdown);

        // Refresh
        const refreshBtn = document.createElement("button");
        refreshBtn.className = "btn btn-sm btn-outline-secondary";
        refreshBtn.title = "Refresh";
        refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
        refreshBtn.addEventListener("click", () => this._fetchData());
        tb.appendChild(refreshBtn);

        host.appendChild(tb);
        this._views.toolbar = tb;
    }

    _buildStatusbar(host) {
        const sb = document.createElement("div");
        sb.className = "wx-view-statusbar d-flex align-items-center p-2 border-top bg-light small";
        this._elements.statusText = document.createElement("span");
        this._elements.statusText.className = "me-auto text-muted";
        sb.appendChild(this._elements.statusText);
        const pagContainer = document.createElement("div");
        sb.appendChild(pagContainer);
        this._ctrls.pagination = new webexpress.webui.PaginationCtrl(pagContainer);
        host.appendChild(sb);
        this._views.statusbar = sb;
    }

    _distributeMarkup(fragment, contentContainer) {
        // Table: look for .wx-table, .wx-webapp-table
        this._views.tableContainer = document.createElement("div");
        this._views.tableContainer.className = "h-100 overflow-auto";
        const exTable = fragment.querySelector(".wx-table, .wx-webapp-table, .wx-table-reorderable");
        if (exTable) {
            exTable.classList.add("wx-table-reorderable");
            this._views.tableContainer.appendChild(exTable);
        } else {
            const t = document.createElement("div");
            t.className = "wx-table-reorderable";
            this._views.tableContainer.appendChild(t);
        }
        contentContainer.appendChild(this._views.tableContainer);

        // Split: look for .wx-table-details, .wx-webapp-table-details
        this._views.detailContainer = document.createElement("div");
        this._views.detailContainer.className = "h-100 d-flex";
        this._views.detailContainer.style.display = "none";
        this._views.detailSidePane = document.createElement("div");
        this._views.detailSidePane.className = "wx-side-pane border-start";
        this._views.detailSidePane.style.minWidth = "300px";
        
        const exDetailHost = fragment.querySelector(".wx-table-details, .wx-webapp-table-details");
        const fh = document.createElement("div");
        fh.className = "wx-detail-frame-host h-100";
        if (exDetailHost && exDetailHost.dataset.uri) {
             fh.dataset.uri = exDetailHost.dataset.uri;
        }
        this._views.detailSidePane.appendChild(fh);
        this._views.detailContainer.appendChild(this._views.detailSidePane);
        contentContainer.appendChild(this._views.detailContainer);

        // Tiles: look for .wx-tile, .wx-webapp-tile
        this._views.tilesContainer = document.createElement("div");
        this._views.tilesContainer.className = "h-100 overflow-auto p-2";
        this._views.tilesContainer.style.display = "none";
        
        const exTile = fragment.querySelector(".wx-tile, .wx-tiles, .wx-webapp-tile");
        if (exTile) {
            this._views.tilesContainer.appendChild(exTile);
        } else {
            const t = document.createElement("div");
            t.className = "wx-tile-host";
            this._views.tilesContainer.appendChild(t);
        }
        contentContainer.appendChild(this._views.tilesContainer);

        // Graph: look for .wx-graph, .wx-webapp-graph
        this._views.graphContainer = document.createElement("div");
        this._views.graphContainer.className = "h-100 w-100";
        this._views.graphContainer.style.display = "none";
        
        const exGraph = fragment.querySelector(".wx-graph, .wx-webapp-graph");
        if (exGraph) {
            exGraph.style.height = "100%";
            this._views.graphContainer.appendChild(exGraph);
        } else {
            const g = document.createElement("div");
            g.className = "wx-graph-host h-100";
            this._views.graphContainer.appendChild(g);
        }
        contentContainer.appendChild(this._views.graphContainer);

        // Frame
        this._views.frameContainer = document.createElement("div");
        this._views.frameContainer.className = "h-100 w-100";
        this._views.frameContainer.style.display = "none";
        const exFrame = fragment.querySelector(".wx-frame");
        if (exFrame) {
            this._views.frameContainer.appendChild(exFrame);
        } else {
            const f = document.createElement("div");
            f.className = "wx-frame-host h-100";
            this._views.frameContainer.appendChild(f);
        }
        contentContainer.appendChild(this._views.frameContainer);
    }

    _initControllers() {
        // Table
        const tblEl = this._views.tableContainer.querySelector(".wx-table-reorderable, .wx-webapp-table");
        if (tblEl && webexpress.webapp.TableCtrl) {
            this._ctrls.table = new webexpress.webapp.TableCtrl(tblEl);
            tblEl.addEventListener("wx-req-sort", (e) => {
                const d = e.detail;
                if (d) {
                    this._orderBy = d.orderBy;
                    this._orderDir = d.orderDir;
                    this._fetchData();
                }
            });
        }

        // Tiles - Expanded selector
        const tileEl = this._views.tilesContainer.querySelector(".wx-tile-host, .wx-tile, .wx-webapp-tile");
        if (tileEl && webexpress.webui.TileCtrl) {
            this._ctrls.tile = new webexpress.webui.TileCtrl(tileEl);
        }

        // Graph - Expanded selector
        const graphEl = this._views.graphContainer.querySelector(".wx-graph-host, .wx-graph, .wx-webapp-graph");
        if (graphEl && webexpress.webui.GraphViewerCtrl) {
            this._ctrls.graph = new webexpress.webui.GraphViewerCtrl(graphEl);
        }

        // Frame
        const frameEl = this._views.frameContainer.querySelector(".wx-frame-host, .wx-frame");
        if (frameEl && webexpress.webui.FrameCtrl) {
            this._ctrls.frame = new webexpress.webui.FrameCtrl(frameEl);
        }
    }

    _setupGlobalEvents() {
        document.addEventListener(webexpress.webui.Event.CHANGE_PAGE_EVENT, (e) => {
            const d = e.detail || {};
            if (this._ctrls.pagination && d.sender === this._ctrls.pagination.element) {
                this._page = d.page;
                this._fetchData();
            }
        });

        document.addEventListener(webexpress.webui.Event.CLICK_EVENT, (e) => {
            if (this._mode === "table-detail" && this._ctrls.detailFrame && e.detail?.data) {
                const uri = e.detail.data.detailUri || e.detail.data.uri;
                if (uri) this._ctrls.detailFrame.setUri(uri, true);
            }
        });
    }

    _handleSearchInput() {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this._filter = this._elements.searchInput.value;
            this._page = 0;
            this._fetchData();
        }, 300);
    }

    _fetchData() {
        if (!this._restUri) return;
        if (this._abortController) this._abortController.abort();
        this._abortController = new AbortController();
        const signal = this._abortController.signal;

        if (this._elements.progressBar) this._elements.progressBar.style.visibility = "visible";

        const filter = encodeURIComponent(this._filter ?? "");
        const separator = this._restUri.includes("?") ? "&" : "?";
        let url = `${this._restUri}${separator}q=${filter}&p=${this._page}&limit=${this._pageSize}`;
        if (this._orderBy) {
            url += `&o=${encodeURIComponent(this._orderBy)}`;
            if (this._orderDir) url += `&d=${encodeURIComponent(this._orderDir)}`;
        }

        fetch(url, { signal })
            .then(res => {
                if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                return res.json();
            })
            .then(data => this._handleData(data))
            .catch(err => {
                if (err.name !== "AbortError") console.error("ViewCtrl Fetch Error:", err);
            })
            .finally(() => {
                if (!signal.aborted && this._elements.progressBar) this._elements.progressBar.style.visibility = "hidden";
            });
    }

    _handleData(response) {
        this._lastResponse = response;
        if (this._elements.title) this._elements.title.textContent = response.title || "Data View";
        if (this._ctrls.pagination && response.pagination) {
            const p = response.pagination;
            const totalPages = Math.ceil((p.total || 0) / (p.pageSize || 50));
            this._ctrls.pagination.total = totalPages;
            this._ctrls.pagination.page = p.page || 0;
            const start = (p.page || 0) * (p.pageSize || 50) + 1;
            const end = Math.min(start + (p.pageSize || 50) - 1, p.total || 0);
            this._elements.statusText.textContent = `${start} - ${end} / ${p.total || 0}`;
        }
        if (this._ctrls.table && typeof this._ctrls.table.updateData === "function") {
            this._ctrls.table.updateData(response);
        }
        this._updateActiveViewData();
    }

    _updateActiveViewData() {
        if (!this._lastResponse) return;
        const resp = this._lastResponse;
        const rows = resp.rows || [];

        if (this._mode === "tiles" && this._ctrls.tile) {
            const tiles = rows.map((r, idx) => {
                const c0 = (r.cells && r.cells[0]) ? r.cells[0] : {};
                return {
                    id: r.id || `tile_${idx}`,
                    label: r.label || r.title || c0.content || c0.value || `Item ${idx}`,
                    icon: r.icon || c0.icon || null,
                    image: r.image || c0.image || null,
                    colorCss: r.colorCss || r.color || c0.color || null,
                    html: r.html || r.description || null,
                    class: r.class || null,
                    visible: true,
                    _lc_id: null, 
                    _lc_label: null
                };
            });
            this._ctrls.tile._filterTerm = "";
            this._ctrls.tile._tiles = tiles;
            this._ctrls.tile._searchCacheDirty = true;
            this._ctrls.tile.render();
        }

        if (this._mode === "graph" && this._ctrls.graph) {
            let model;
            if (resp.graph) {
                model = resp.graph;
            } else {
                const nodes = rows.map((r, idx) => ({
                    id: r.id, 
                    label: r.label || `Node ${idx}`, 
                    x: r.x || Math.random() * 500, 
                    y: r.y || Math.random() * 500, 
                    icon: r.icon
                }));
                const edges = [];
                rows.forEach(r => {
                    if (r.parentId) edges.push({ from: r.parentId, to: r.id });
                });
                model = { nodes, edges };
            }
            this._ctrls.graph.model = model;
        }

        if (this._mode === "frame" && this._ctrls.frame && resp.frameUri) {
            this._ctrls.frame.setUri(resp.frameUri, false);
        }
    }

    setMode(modeId) {
        if (!this._viewConfig.some(c => c.id === modeId)) return;
        this._mode = modeId;

        const activeCfg = this._viewConfig.find(c => c.id === modeId);
        if (activeCfg && this._elements.viewBtnLabel) {
            this._elements.viewBtnLabel.textContent = activeCfg.label;
        }

        [this._views.tableContainer, this._views.detailContainer, this._views.tilesContainer, 
         this._views.graphContainer, this._views.frameContainer].forEach(el => {
            if (el) el.style.display = "none";
        });

        const tblCtrlEl = this._ctrls.table ? this._ctrls.table.element : this._views.tableContainer.firstElementChild;
        
        switch (modeId) {
            case "table":
                this._views.tableContainer.style.display = "";
                if (tblCtrlEl && tblCtrlEl.parentElement !== this._views.tableContainer) {
                    this._views.tableContainer.appendChild(tblCtrlEl);
                }
                break;
            case "table-detail":
                this._views.detailContainer.style.display = "";
                if (tblCtrlEl && tblCtrlEl.parentElement !== this._views.detailContainer) {
                    this._views.detailContainer.insertBefore(tblCtrlEl, this._views.detailSidePane);
                }
                if (!this._ctrls.split && webexpress.webui.SplitCtrl) {
                    this._ctrls.split = new webexpress.webui.SplitCtrl(this._views.detailContainer);
                }
                if (!this._ctrls.detailFrame && webexpress.webui.FrameCtrl) {
                    const host = this._views.detailSidePane.querySelector(".wx-detail-frame-host");
                    if (host) this._ctrls.detailFrame = new webexpress.webui.FrameCtrl(host);
                }
                break;
            case "tiles":
                this._views.tilesContainer.style.display = "";
                if (tblCtrlEl && tblCtrlEl.parentElement !== this._views.tableContainer) {
                    this._views.tableContainer.appendChild(tblCtrlEl);
                }
                this._updateActiveViewData();
                break;
            case "graph":
                this._views.graphContainer.style.display = "";
                if (tblCtrlEl && tblCtrlEl.parentElement !== this._views.tableContainer) {
                    this._views.tableContainer.appendChild(tblCtrlEl);
                }
                this._updateActiveViewData();
                break;
            case "frame":
                this._views.frameContainer.style.display = "";
                if (tblCtrlEl && tblCtrlEl.parentElement !== this._views.tableContainer) {
                    this._views.tableContainer.appendChild(tblCtrlEl);
                }
                this._updateActiveViewData();
                break;
        }
    }
};

webexpress.webui.Controller.registerClass("wx-webapp-view", webexpress.webapp.ViewCtrl);