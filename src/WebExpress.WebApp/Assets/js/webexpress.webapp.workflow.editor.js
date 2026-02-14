/**
 * App-level workflow editor: extends base editor, loads model via REST.
 * Supports per-state foreground/background colors and icons, per-transition stroke color/dash pattern.
 */
webexpress.webapp.WorkflowEditorCtrl = class extends webexpress.webui.GraphEditorCtrl {
    /**
     * @param {HTMLElement} element host element
     */
    constructor(element) {
        const children = Array.from(element.children);
        super(element);
        this._restApi = element.dataset.restApi || element.dataset.restUri || "/api/workflows";
        this._workflowId = element.dataset.workflowId || "";

        element.removeAttribute("data-rest-api");
        element.removeAttribute("data-rest-uri");
        element.removeAttribute("data-workflow-id");

        if (this._workflowId) {
            this._loadFromRest();
        } else {
            element.innerHTML = "";
            this._model = this._normalizeModel(this._readFromChildren(children));
            this._svg = this._createSvg();
            this._edgeLayer = this._createGroup("edges");
            this._waypointLayer = this._createGroup("waypoints");
            this._nodeLayer = this._createGroup("nodes");
            this._svg.appendChild(this._edgeLayer);
            this._svg.appendChild(this._waypointLayer);
            this._svg.appendChild(this._nodeLayer);
            element.appendChild(this._svg);
            this.render();
        }
    }

    /**
     * Reads model from preserved children.
     */
    _readFromChildren(children) {
        const states = children.filter(el => { return el.hasAttribute("data-state"); }).map(el => {
            return {
                id: el.dataset.id || "",
                label: el.dataset.label || el.dataset.id || "",
                x: parseFloat(el.dataset.x || "0"),
                y: parseFloat(el.dataset.y || "0"),
                foreground: el.dataset.foreground || "",
                background: el.dataset.background || "",
                icon: el.dataset.icon || ""
            };
        });
        const transitions = children.filter(el => { return el.hasAttribute("data-transition"); }).map(el => {
            let waypoints = [];
            try {
                waypoints = JSON.parse(el.dataset.waypoints || "[]");
            } catch (e) {
                waypoints = [];
            }
            return {
                id: el.dataset.id || "",
                from: el.dataset.from || "",
                to: el.dataset.to || "",
                waypoints: Array.isArray(waypoints) ? waypoints : [],
                color: el.dataset.color || "",
                dasharray: el.dataset.dasharray || ""
            };
        });
        return { states, transitions };
    }

    /**
     * Loads model from REST.
     */
    async _loadFromRest() {
        const base = this._restApi.replace(/\/+$/, "");
        const url = `${base}/${encodeURIComponent(this._workflowId)}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`load failed ${res.status}`);
            }
            const data = await res.json();
            const states = Array.isArray(data.states) ? data.states : [];
            const transitions = Array.isArray(data.transitions) ? data.transitions : [];
            this.model = this._normalizeModel({ states, transitions });
        } catch (err) {
            console.error("[WorkflowEditor] rest load error", err);
        }
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-workflow-editor", webexpress.webapp.WorkflowEditorCtrl);