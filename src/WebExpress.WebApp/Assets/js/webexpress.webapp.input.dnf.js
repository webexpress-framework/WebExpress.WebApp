/**
 * A DNF input whose terms come from a REST endpoint.
 *
 * The structure of the expression, the operators and the group handling are
 * inherited unchanged; what the REST variant replaces is the picker of a
 * conjunction. Every group is a REST backed selection, so each one lazily loads
 * when its dropdown opens, filters server side with its own debounced and
 * abortable request, and reports the telemetry events the data layer expects.
 * Filtering has to stay per group - two conjunctions are searched
 * independently - which is exactly what a selection per group gives.
 *
 * A group added later starts from the terms already received rather than empty,
 * so the list is on screen before its own request returns.
 *
 * The following events are triggered in addition to those of the base control:
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.InputDnfCtrl = class extends webexpress.webui.InputDnfCtrl {
    /**
     * The configuration a group inherits from the host, in the dataset spelling
     * the REST selection reads it back in.
     */
    static GROUP_SETTINGS = ["method", "queryParam", "pageParam", "page", "debounce", "maxitems"];

    /**
     * Initializes a new instance of the REST backed DNF input.
     * @param {HTMLElement} element - The host element of the control.
     */
    constructor(element) {
        // the island is consumed before the base constructor clears the children,
        // and it is stashed on the element because the base builds the first group
        // while the fields of this class are not initialized yet
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        element._wxDnfService = islandServices.data || null;
        element._wxDnfSettings = webexpress.webapp.InputDnfCtrl._readSettings(element);

        super(element);

        this._service = element._wxDnfService;
        this._settings = element._wxDnfSettings;

        // the received terms are shared: a group that is added later renders from
        // them at once instead of showing an empty list until its own request
        // returns
        this._received = [];

        this._groups.forEach((group) => this._observeGroup(group));
    }

    /**
     * Reads the endpoint settings off the host, so a group can be configured the
     * way the REST selection expects to find them.
     * @param {HTMLElement} element - The host element.
     * @returns {object} The settings.
     */
    static _readSettings(element) {
        const settings = {};

        if (!element || !element.dataset) {
            return settings;
        }

        for (const key of webexpress.webapp.InputDnfCtrl.GROUP_SETTINGS) {
            if (typeof element.dataset[key] === "string") {
                settings[key] = element.dataset[key];
            }
        }

        return settings;
    }

    /**
     * Builds the picker of one conjunction as a REST backed selection, carrying
     * its own copy of the service island and of the endpoint settings.
     * @param {HTMLElement} editor - The host element of the picker.
     * @returns {object} The selection control of the group.
     */
    _createGroupControl(editor) {
        const service = this._element._wxDnfService;
        const settings = this._element._wxDnfSettings || {};

        Object.keys(settings).forEach((key) => { editor.dataset[key] = settings[key]; });

        if (service) {
            editor.appendChild(webexpress.webapp.ServiceRegistry.islandElement({
                name: "data",
                kind: "rest",
                baseUri: service.baseUri,
                method: service.method,
                domains: service.domains
            }));
        }

        return new webexpress.webapp.InputSelectionCtrl(editor);
    }

    /**
     * Adopts what a group received: the terms are kept for the groups added later
     * and the arrival is announced once on the control, so a host listening on the
     * DNF input hears about the data without subscribing to every group.
     * @param {object} group - The group record.
     */
    _observeGroup(group) {
        group.editor.addEventListener(webexpress.webui.Event.DATA_ARRIVED_EVENT, (e) => {
            e.stopPropagation();

            // only the unfiltered answer describes the whole term set; a filtered
            // one is the answer to one group's search and would seed the next
            // group with a list the user never asked it to show
            if (!e.detail || !e.detail.term) {
                this._received = group.ctrl.options || [];
            }

            this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, e.detail);
        });
    }

    /**
     * Returns the terms the expression is labelled against.
     *
     * The terms are queried by the groups, so the declared list of the static
     * control stays empty here. The read view of the smart edit asks this control
     * for the labels, and it has to be given the ones that actually arrived -
     * otherwise a finished edit falls back to showing raw term ids.
     *
     * @returns {Array} The items.
     */
    get options() {
        return (this._received && this._received.length > 0) ? this._received : super.options;
    }

    /**
     * Replaces the options of every group.
     * @param {Array} items - The new items.
     */
    set options(items) {
        super.options = items;
    }

    /**
     * Builds a conjunction and seeds it from the terms already received.
     * @param {Array<string>} terms - The term ids of the conjunction.
     * @returns {object} The group record.
     */
    _appendGroup(terms) {
        const group = super._appendGroup(terms);

        // the constructor builds the first group before this field exists; that
        // group has nothing to be seeded from anyway, because nothing arrived yet
        if (this._received && this._received.length > 0) {
            group.ctrl.options = this._received;
            group.ctrl.value = terms || [];
        }

        if (this._received) {
            this._observeGroup(group);
        }

        return group;
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-input-dnf", webexpress.webapp.InputDnfCtrl);
