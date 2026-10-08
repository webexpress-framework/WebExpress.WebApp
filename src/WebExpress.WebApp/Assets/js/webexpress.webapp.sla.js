/**
 * SlaCtrl is the REST-backed service level agreement of a domain object. It is
 * the WebUI agreement widget with its state sourced from data: it loads the
 * state from the configured endpoint, requests a pause, a resume or a manual
 * settlement there, and optionally re-reads the state on an interval so several
 * visitors of the same agreement stay in step.
 *
 * Everything else - the countdown, the move between the states, the cycle
 * rollover, the localisation - is inherited unchanged from
 * webexpress.webui.SlaCtrl, which is what keeps the data-driven and the static
 * agreement from ever disagreeing about what a status means.
 *
 * The following events are triggered in addition to those of the base control:
 * - webexpress.webapp.Event.CHANGE_STATUS_EVENT after a transition was persisted
 */
webexpress.webapp.SlaCtrl = class extends webexpress.webui.SlaCtrl {
    /**
     * Constructor: connects the inherited widget to its data service.
     * @param {HTMLElement} element - Host element for the control.
     */
    constructor(element) {
        // the service island has to be consumed before the base constructor
        // reads the host, otherwise the wx-service child is still in the tree
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        this._service = services.data || null;

        if (this._service) {
            this._load();

            const interval = parseInt(element.dataset.refreshInterval, 10);
            if (!isNaN(interval) && interval > 0) {
                this._poll = setInterval(() => this._load(), interval * 1000);
            }
        }
    }

    /**
     * Reads the state from the endpoint and adopts it.
     * @returns {Promise<void>} Resolves when the state is loaded.
     */
    async _load() {
        try {
            const res = await this._service.load();

            if (!res.ok) {
                throw new Error("http " + res.status);
            }

            this.apply(res.data);
        } catch (error) {
            this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, { error: String(error) });
        }
    }

    /**
     * Requests a transition from the endpoint and adopts the state it answers
     * with. It replaces the raw request of the base control, so the endpoint,
     * the headers and the retry policy stay where the framework authors them -
     * in the service descriptor.
     * @param {string} action - The transition: pause, resume or fulfill.
     * @returns {Promise<void>} Resolves when the transition is persisted.
     */
    async _persist(action) {
        if (!this._service) {
            // without a service the base control falls back to its own action
            // uri, which is what a widget configured by hand still uses
            return super._persist(action);
        }

        try {
            const res = await this._service.update({ action: action });

            if (!res.ok && res.status !== 204) {
                throw new Error("http " + res.status);
            }

            this.apply(res.data);

            this._dispatch(webexpress.webapp.Event.CHANGE_STATUS_EVENT, {
                action: action,
                status: this.status
            });
        } catch (error) {
            this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, { action: action, error: String(error) });
        }
    }

    /**
     * Stops the countdown and the poll.
     */
    destroy() {
        if (this._poll) {
            clearInterval(this._poll);
            this._poll = null;
        }

        super.destroy();
    }
};

// register the control
webexpress.webui.Controller.registerClass("wx-webapp-sla", webexpress.webapp.SlaCtrl);
