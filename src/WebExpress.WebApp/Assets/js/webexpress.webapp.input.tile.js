/**
 * REST-backed tile picker control with loading placeholders.
 * The search field appears as a dropdown below the search button.
 * Selected tiles always remain visible even when not matching the current filter.
 * Inherits from webexpress.webui.InputTileCtrl.
 */
webexpress.webapp.InputTileCtrl = class extends webexpress.webui.InputTileCtrl {

    _restUri = "";
    _progressDiv = null;
    _searchBtn = null;
    _dropdownDiv = null;
    _filterCtrl = null;
    _filter = null;
    _loading = false;
    _dropdownVisible = false;
    _dropdownInputAttached = false;

    // static placeholder tiles (shown until data is loaded)
    _placeholderTiles = [
        { id: "ph1", label: "", icon: null, image: null, colorCss: "placeholder-glow", html: `<div class="placeholder col-8" style="height:2em"></div>` },
        { id: "ph2", label: "", icon: null, image: null, colorCss: "placeholder-glow", html: `<div class="placeholder col-7" style="height:2em"></div>` },
        { id: "ph3", label: "", icon: null, image: null, colorCss: "placeholder-glow", html: `<div class="placeholder col-4" style="height:2em"></div>` }
    ];

    /**
     * Constructs the REST tile picker.
     * @param {HTMLElement} element The root element.
     */
    constructor(element) {
        super(element);

        // read REST URI and remove attribute
        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");

        // toolbar with search button
        const toolbarDiv = document.createElement("div");
        toolbarDiv.className = "d-flex justify-content-end align-items-center mb-2 gap-2";
        this._searchBtn = document.createElement("button");
        this._searchBtn.type = "button";
        this._searchBtn.className = "btn btn-outline-secondary btn-sm position-relative";
        this._searchBtn.innerHTML = '<i class="fas fa-search"></i>';
        this._searchBtn.setAttribute("aria-label", "Show search field");
        toolbarDiv.appendChild(this._searchBtn);
        element.insertBefore(toolbarDiv, this._tileList);

        // dropdown for search input
        this._dropdownDiv = document.createElement("div");
        this._dropdownDiv.className = "wx-tile-search-dropdown border rounded shadow-sm p-2 bg-body position-absolute";
        this._dropdownDiv.style.display = "none";
        this._dropdownDiv.style.zIndex = "1040";
        this._dropdownDiv.style.minWidth = "260px";
        this._dropdownDiv.style.right = "0";
        this._dropdownDiv.style.top = "110%";
        this._searchBtn.style.position = "relative";
        this._searchBtn.parentElement.style.position = "relative";
        this._searchBtn.parentElement.appendChild(this._dropdownDiv);

        // progress bar
        this._progressDiv = document.createElement("div");
        this._progressDiv.className = "progress mb-2";
        this._progressDiv.style.height = "0.5em";
        this._progressDiv.innerHTML = `<div class="progress-bar progress-bar-striped progress-bar-animated" style="width:100%"></div>`;
        this._progressDiv.style.visibility = "hidden";
        element.insertBefore(this._progressDiv, this._tileList);

        // search button show/hide dropdown
        this._searchBtn.addEventListener("click", () => {
            if (!this._dropdownVisible) {
                this._showDropdown();
            } else {
                this._hideDropdown();
            }
        });

        // click-outside closes dropdown
        window.addEventListener("mousedown", e => {
            if (this._dropdownVisible &&
                !this._dropdownDiv.contains(e.target) &&
                !this._searchBtn.contains(e.target)
            ) {
                this._hideDropdown();
            }
        });

        this._loading = true;
        this._showPlaceholders();
        this._receiveData();
    }

    /**
     * Shows the dropdown with the search input.
     */
    _showDropdown() {
        if (!this._filterCtrl) {
            this._dropdownDiv.innerHTML = "";
            this._filterCtrl = new webexpress.webui.SearchCtrl(this._dropdownDiv);
        }
        this._dropdownDiv.style.display = "block";
        this._dropdownVisible = true;

        const bindInputHandler = () => {
            const inp = this._dropdownDiv.querySelector("input");
            if (!inp) {
                setTimeout(bindInputHandler, 10);
                return;
            }
            if (this._filter) {
                inp.value = this._filter;
            }
            inp.focus();
            const cleanInput = inp.cloneNode(true);
            inp.parentNode.replaceChild(cleanInput, inp);

            cleanInput.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    this._filter = cleanInput.value;
                    this._hideDropdown();
                    this._receiveData();
                }
                if (e.key === "Escape") {
                    this._hideDropdown();
                }
            });
            cleanInput.addEventListener("blur", () => {
                setTimeout(() => {
                    if (!this._searchBtn.matches(":hover")) {
                        this._hideDropdown();
                    }
                }, 160);
            });
        };
        bindInputHandler();
    }

    /**
     * Hides the search dropdown.
     */
    _hideDropdown() {
        this._dropdownDiv.style.display = "none";
        this._dropdownVisible = false;
    }

    /**
     * Displays loading placeholders while loading tiles.
     */
    _showPlaceholders() {
        this.tiles = this._placeholderTiles;
        this._progressDiv.style.visibility = "visible";
        this._loading = true;
    }

    /**
     * Loads tiles from REST endpoint, always making selected tiles visible.
     */
    _receiveData() {
        this._showPlaceholders();
        let url = this._restUri;
        let filter = this._filter ? String(this._filter).trim() : "";
        if (filter.length) {
            url += (url.includes("?") ? "&" : "?") + "q=" + encodeURIComponent(filter);
        }

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error("Request failed");
                return res.json();
            })
            .then(response => {
                let tiles = Array.isArray(response) ? response : response.items;
                if (!Array.isArray(tiles)) tiles = [];
                // always append selected tiles, even if not in filter result
                const selectedIds = this._getSelectedIds();
                const seen = new Set();
                for (const t of tiles) {
                    if (t.id) seen.add(t.id);
                }
                for (const selId of selectedIds) {
                    if (!seen.has(selId)) {
                        const fallback = this.tiles.find(tile => tile.id === selId)
                            || { id: selId, label: selId, html: "", class: "", icon: null, image: null, colorCss: "bg-secondary", colorStyle: null, visible: true };
                        tiles.push(fallback);
                        seen.add(selId);
                    }
                }
                this.tiles = tiles.map(t => ({
                    id: t.id,
                    label: t.label || t.text || t.name || t.id,
                    html: t.html ?? "",
                    class: t.class ?? "",
                    icon: t.icon ?? null,
                    image: t.image ?? null,
                    colorCss: t.colorCss ?? t.color ?? null,
                    colorStyle: t.colorStyle ?? null,
                    visible: t.visible !== false,
                    
                    // map action attributes from API response
                    primaryAction: t.primaryAction || null,
                    primaryTarget: t.primaryTarget || null,
                    primaryUri: t.primaryUri || null,
                    secondaryAction: t.secondaryAction || null,
                    secondaryTarget: t.secondaryTarget || null,
                    secondaryUri: t.secondaryUri || null
                }));
                this._progressDiv.style.visibility = "hidden";
                this._loading = false;
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    sender: this._element,
                    response
                });
            })
            .catch(error => {
                this._progressDiv.style.visibility = "hidden";
                this.tiles = [];
                this._loading = false;
                console.error("Failed to load tiles:", error);
            });
    }

    /**
     * Returns all selected tile ids as array (multi- and single-select).
     * @returns {string[]}
     */
    _getSelectedIds() {
        if (this._multiselect) {
            if (Array.isArray(this._value)) return this._value.slice();
            if (typeof this._value === "string") return this._value.split(";").map(s => s.trim()).filter(Boolean);
            return [];
        } else {
            if (typeof this._value === "string" && this._value) return [this._value];
            return [];
        }
    }

    /**
     * Builds a tile card. Highlights placeholders visually while loading.
     * @param {Object} tile Tile data.
     * @returns {HTMLDivElement} Tile card element.
     */
    _createTileCard(tile) {
        const card = super._createTileCard(tile);
        if (
            (tile.label === "" || !tile.label) &&
            !tile.icon &&
            !tile.image &&
            (tile.colorCss && tile.colorCss.includes("placeholder"))
        ) {
            card.classList.add("bg-transparent", "border-0");
            card.querySelectorAll("*").forEach(e => {
                e.classList.add("placeholder", "bg-secondary", "rounded");
                e.textContent = "";
            });
            card.tabIndex = -1;
            card.style.pointerEvents = "none";
        }
        return card;
    }
};

// register controller class
webexpress.webui.Controller.registerClass("wx-webapp-input-tile", webexpress.webapp.InputTileCtrl);