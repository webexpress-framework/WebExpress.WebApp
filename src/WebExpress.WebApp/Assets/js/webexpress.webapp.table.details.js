/**
 * A composite controller combining a Table (Master) and a Frame (Detail)
 * separated by a resizable Splitter.
 */
webexpress.webapp.TableDetailsCtrl = class extends webexpress.webui.Ctrl {

    _tableCtrl = null;
    _frameCtrl = null;
    _splitCtrl = null;

    /**
     * Constructor.
     * @param {HTMLElement} element - The host DOM element.
     */
    constructor(element) {
        super(element);

        // extract configuration from data attributes
        const config = {
            uri: element.dataset.uri || "",
            splitSize: element.dataset.splitSize || "50%",
            minSide: element.dataset.minSide || "300",
            phText: element.dataset.placeholderText || "Please select a record.",
            phIcon: element.dataset.placeholderIcon || "fas fa-arrow-left"
        };

        // clean up attributes to keep the DOM clean
        element.removeAttribute("data-uri");
        element.removeAttribute("data-split-size");
        element.removeAttribute("data-min-side");
        element.removeAttribute("data-placeholder-text");
        element.removeAttribute("data-placeholder-icon");

        // build internal dom structure
        this._buildLayout(element, config);

        // initialize child controllers
        this._initControllers();

        // setup event listeners
        this._setupInteraction();
    }

    /**
     * Constructs the DOM structure required for the SplitCtrl.
     * Creates a main pane for the table and a side pane for the frame.
     * @param {HTMLElement} host - The container element.
     * @param {Object} config - Configuration object.
     */
    _buildLayout(host, config) {
        // configure split control attributes on host
        host.setAttribute("data-orientation", "horizontal");
        host.setAttribute("data-order", "main-side");
        host.setAttribute("data-size", config.splitSize);
        host.setAttribute("data-min-side", config.minSide);
        host.classList.add("wx-split-container"); 

        // ensure host has explicit height for split calculation
        if (!host.style.height) {
            host.style.height = "100%";
        }

        // create main pane (table wrapper)
        const mainPane = document.createElement("div");
        mainPane.className = "wx-main-pane h-100 overflow-hidden";
        
        const tableHost = document.createElement("div");
        tableHost.className = "wx-webapp-table h-100";
        if (config.uri) {
            tableHost.dataset.uri = config.uri;
        }
        mainPane.appendChild(tableHost);

        // create side pane (detail frame wrapper)
        const sidePane = document.createElement("div");
        sidePane.className = "wx-side-pane h-100 border-start bg-white";

        const frameHost = document.createElement("div");
        frameHost.className = "wx-webui-frame h-100 p-3 overflow-auto";
        frameHost.dataset.autoload = "false"; 
        
        // render placeholder state
        frameHost.innerHTML = `
            <div class="d-flex h-100 align-items-center justify-content-center text-muted user-select-none">
                <div class="text-center">
                    <i class="${config.phIcon} fa-2x mb-3"></i><br>
                    <span>${config.phText}</span>
                </div>
            </div>
        `;

        sidePane.appendChild(frameHost);

        // 3. append panes to host (SplitCtrl handles the divider)
        host.appendChild(mainPane);
        host.appendChild(sidePane);

        // store references for controller initialization
        this._tableHost = tableHost;
        this._frameHost = frameHost;
    }

    /**
     * Initializes the child controllers (Table, Frame, Split).
     */
    _initControllers() {
        // initialize table controller
        if (webexpress.webapp.TableCtrl) {
            this._tableCtrl = new webexpress.webapp.TableCtrl(this._tableHost);
        } else {
            console.error("TableDetailsCtrl: 'webexpress.webapp.TableCtrl' not found.");
        }

        // initialize frame controller
        if (webexpress.webui.FrameCtrl) {
            this._frameCtrl = new webexpress.webui.FrameCtrl(this._frameHost);
        } else {
            console.error("TableDetailsCtrl: 'webexpress.webui.FrameCtrl' not found.");
        }

        // initialize split controller on the main host
        if (webexpress.webui.SplitCtrl) {
            this._splitCtrl = new webexpress.webui.SplitCtrl(this._element);
        } else {
            console.error("TableDetailsCtrl: 'webexpress.webui.SplitCtrl' not found.");
        }
    }

    /**
     * Sets up event listeners to link the Table selection to the Frame.
     */
    _setupInteraction() {
        if (!this._tableCtrl || !this._frameCtrl) {
            return;
        }

        // access the dom element of the table controller
        // fallback to _element if public getter is missing in base class
        const tableEl = this._tableCtrl.element || this._tableCtrl._element;

        if (tableEl) {
            // listen for generic click events to detect row selection
            tableEl.addEventListener(webexpress.webui.Event.CLICK_EVENT, (e) => this._handleTableClick(e));
            
            // support potential specific row select event
            tableEl.addEventListener("wx-row-select", (e) => this._handleTableClick(e));
        }
    }

    /**
     * Handles clicks from the table to update the frame.
     * @param {CustomEvent} e - The event object.
     */
    _handleTableClick(e) {
        const data = e.detail?.data;

        if (!data) {
            return;
        }

        // ignore clicks on interactive elements inside the row (buttons, links, inputs)
        // preventing the detail view update when user intends to perform a row action
        if (e.detail.originalEvent) {
            const target = e.detail.originalEvent.target;
            if (target && target.closest("a, button, input, select, .wx-table-actions")) {
                return;
            }
        }

        // resolve the uri to load: 'detailUri' takes precedence over 'uri'
        const targetUri = data.detailUri || data.uri;

        if (targetUri) {
            this._frameCtrl.setUri(targetUri, true);

            // if split view is collapsed (e.g. on mobile), expand it automatically
            if (this._splitCtrl && this._splitCtrl._sidePaneCollapsed) {
                if (typeof this._splitCtrl.expandSidePane === "function") {
                    this._splitCtrl.expandSidePane();
                }
            }
        }
    }

    /**
     * Refreshes both the table and the frame.
     */
    refresh() {
        // refresh table
        if (this._tableCtrl) {
            if (typeof this._tableCtrl.refresh === "function") {
                this._tableCtrl.refresh();
            } else if (typeof this._tableCtrl._receiveData === "function") {
                // fallback to protected method if public refresh is missing
                this._tableCtrl._receiveData();
            }
        }

        // refresh frame
        if (this._frameCtrl && typeof this._frameCtrl.refresh === "function") {
            this._frameCtrl.refresh();
        }
    }
};

// register the class in the controller registry
webexpress.webui.Controller.registerClass("wx-webapp-table-details", webexpress.webapp.TableDetailsCtrl);