/**
 * A composite controller combining a Table (Master) and a Frame (Detail)
 * separated by a resizable Splitter.
 * Layout: Table (Left/Main) | Splitter | Detail Frame (Right/Side)
 */
webexpress.webapp.TableDetailsCtrl = class extends webexpress.webui.Ctrl {

    _tableCtrl = null;
    _frameCtrl = null;
    _splitCtrl = null;
    
    // Internal references
    _mainPane = null;
    _sidePane = null;

    /**
     * Constructor.
     * @param {HTMLElement} element - The host DOM element.
     */
    constructor(element) {
        super(element);

        // 1. Extract configuration
        const config = {
            uri: element.dataset.uri || "",
            splitSize: element.dataset.splitSize || "40%", // Default width of detail view
            minSide: element.dataset.minSide || "300px",
            phText: element.dataset.placeholderText || "Please select a record.",
            phIcon: element.dataset.placeholderIcon || "fas fa-arrow-left"
        };

        // 2. Clean up attributes
        ["data-uri", "data-split-size", "data-min-side", "data-placeholder-text", "data-placeholder-icon"]
            .forEach(attr => element.removeAttribute(attr));

        // 3. Build Layout Synchronously
        this._buildLayout(element, config);

        // 4. Initialize Controllers
        // We use requestAnimationFrame to ensure the DOM is painted and dimensions are calculated
        // before the SplitCtrl and TableCtrl start their work.
        requestAnimationFrame(() => {
            this._setupInteraction();
        });
    }

    /**
     * Constructs the DOM structure for a Horizontal Split (Left-Right).
     * @param {HTMLElement} host - The container element.
     * @param {Object} config - Configuration object.
     */
    _buildLayout(host, config) {
        // clear host and setup container
        host.innerHTML = "";
        
        // data attributes for the SplitCtrl logic
        host.dataset.orientation = "horizontal";
        host.dataset.minSide="200";
        
        this._sidePane = document.createElement("div");
        this._sidePane.className = "wx-side-pane";
        this._sidePane.style.width = config.splitSize;
        this._sidePane.style.minWidth = config.minSide;
        this._table = document.createElement("div");
        this._table.className = "wx-webapp-table overflow-hidden";
        this._table.dataset.uri = config.uri;
        this._sidePane.appendChild(this._table);
        
        host.appendChild(this._sidePane);

        this._mainPane = document.createElement("div");
        this._mainPane.className = "wx-main-pane";
        const frameDiv = document.createElement("div");
        frameDiv.className = "wx-webui-frame";
        frameDiv.dataset.autoload = "false";
        
        const wrapper = document.createElement("div");
        wrapper.className = "d-flex h-100 align-items-center justify-content-center text-muted user-select-none";
        const inner = document.createElement("div");
        inner.className = "text-center";
        const icon = document.createElement("i");
        icon.className = `${config.phIcon} fa-2x mb-3`;
        const br = document.createElement("br");
        const text = document.createElement("span");
        text.textContent = config.phText;

        inner.appendChild(icon);
        inner.appendChild(br);
        inner.appendChild(text);

        wrapper.appendChild(inner);

        frameDiv.innerHTML = "";
        frameDiv.appendChild(wrapper);

        this._mainPane.appendChild(frameDiv);
        
        host.appendChild(this._mainPane);
        
        this._splitCtrl = new webexpress.webui.SplitCtrl(host);
    }

    /**
     * Sets up interaction listeners (Table Click -> Frame Update).
     */
    _setupInteraction() {
        
        document.addEventListener(webexpress.webui.Event?.SELECT_ROW_EVENT, (e) => {
            if (e.detail && e.detail.row) {
                this._handleRowSelect(e.detail.row);
            }
        });
        
        
        if (!this._tableCtrl) return;

        // Get the interactive element from the table controller
        const tableElement = this._tableCtrl._element || this._tableCtrl.element;
        if (!tableElement) return;

        // 1. Listen for the specific SELECT_ROW_EVENT from TableCtrl
        const selectEventName = webexpress.webui.Event?.SELECT_ROW_EVENT || "wx-select-row";
        
        tableElement.addEventListener(selectEventName, (e) => {
            // The event detail contains { row: object, rowId: string, ... }
            if (e.detail && e.detail.row) {
                this._handleRowSelect(e.detail.row);
            }
        });

        // 2. Fallback: Listen for generic item select (e.g. from ListCtrl if swapped)
        tableElement.addEventListener("wx-select-item", (e) => {
             if (e.detail && e.detail.item) {
                 this._handleRowSelect(e.detail.item);
             }
        });
    }

    /**
     * Handles row selection logic.
     * @param {Object} rowData - The data object of the selected row.
     */
    _handleRowSelect(rowData) {
        if (!rowData) return;

        // Determine target URI: 'detailUri' (specific) takes precedence over 'uri' (self)
        const targetUri = rowData.detailUri || rowData.uri;

        if (targetUri && this._frameCtrl) {
            // Load detail view
            this._frameCtrl.setUri(targetUri, true);

            // If we are on mobile or the split is collapsed, expand the side pane
            if (this._splitCtrl) {
                // Check if the split control has a method to ensure visibility
                if (typeof this._splitCtrl.expandSidePane === "function") {
                    this._splitCtrl.expandSidePane();
                } else if (typeof this._splitCtrl.setSizes === "function") {
                    // Fallback: Reset sizes if side pane is hidden (width ~0)
                    const sideWidth = this._sidePane.getBoundingClientRect().width;
                    if (sideWidth < 50) {
                        this._splitCtrl.setSizes([60, 40]); // Example ratio
                    }
                }
            }
        }
    }

    /**
     * Refreshes both master and detail views.
     */
    refresh() {
        // Refresh Table
        if (this._tableCtrl) {
            if (typeof this._tableCtrl.refresh === "function") {
                this._tableCtrl.refresh();
            } else if (typeof this._tableCtrl._receiveData === "function") {
                this._tableCtrl._receiveData(); // Access protected method if necessary
            }
        }

        // Refresh Detail Frame
        if (this._frameCtrl && typeof this._frameCtrl.refresh === "function") {
            this._frameCtrl.refresh();
        }
    }
};

// register the class in the controller registry
webexpress.webui.Controller.registerClass("wx-webapp-table-details", webexpress.webapp.TableDetailsCtrl);