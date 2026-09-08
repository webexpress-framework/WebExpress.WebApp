/**
 * Client control for ControlLike: joins a like and repaints the figure from the answer.
 *
 * The server renders the figure with the count it already knows, so the number is on the page
 * before any script runs. This controller adds the one thing markup cannot express - posting the
 * toggle - and is therefore attached only to the actionable form of the control:
 *
 *     <button class="wx-webapp-like wx-webapp-like-action wx-webapp-like-mount"
 *             data-uri="/api/1/objects/like"
 *             data-payload='{"object":"SD-43011"}'
 *             aria-pressed="false">
 *       <span class="wx-webapp-like-value">7</span><i class="wx-webapp-like-icon …"></i>
 *     </button>
 *
 * A figure without an address renders as a span and gets no controller at all: there is nothing
 * to join, so there is nothing to wire.
 *
 * The endpoint answers { value, active } and the figure is repainted from that rather than
 * counted up here. Two readers clicking at once would otherwise each see their own click and
 * neither the other's, and the number would drift from the one the next page load shows.
 *
 * Dispatched events (CustomEvent on the host element, bubbles):
 * - webexpress.webui.Event.CHANGE_VALUE_EVENT with { value, active }
 */
webexpress.webapp.LikeCtrl = class extends webexpress.webui.Ctrl {
    /**
     * Creates the controller and wires the click.
     * @param {HTMLElement} element - The host element of the control.
     */
    constructor(element) {
        super(element);

        this._value = element.querySelector(".wx-webapp-like-value");
        this._onClick = () => this.toggle();

        element.addEventListener("click", this._onClick);
    }

    /**
     * Posts the toggle and repaints the figure from the answer.
     *
     * The figure is disabled for the duration of the request, so a reader clicking twice in
     * quick succession cannot send a second toggle that undoes the first before its answer has
     * arrived.
     *
     * @returns {Promise<void>}
     */
    async toggle() {
        const element = this._element;
        const uri = element.dataset.uri;

        if (!uri || element.disabled) {
            return;
        }

        element.disabled = true;

        try {
            const response = await fetch(uri, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: element.dataset.payload || "{}"
            });

            if (!response.ok) {
                return;
            }

            this.apply(await response.json());
        } catch {
            // a failed request leaves the figure as it was: the next page load shows the truth,
            // and a count that moved without the server agreeing would be worse than one that
            // did not move at all
        } finally {
            element.disabled = false;
        }
    }

    /**
     * Repaints the figure from an answer.
     * @param {object} answer - The answer of the endpoint, { value, active }.
     * @returns {void}
     */
    apply(answer) {
        if (!answer) {
            return;
        }

        if (this._value && answer.value !== undefined && answer.value !== null) {
            this._value.textContent = String(answer.value);
        }

        const active = !!answer.active;

        this._element.classList.toggle("wx-webapp-like-active", active);
        this._element.setAttribute("aria-pressed", active ? "true" : "false");

        this._element.dispatchEvent(new CustomEvent(webexpress.webui.Event.CHANGE_VALUE_EVENT, {
            bubbles: true,
            detail: { value: answer.value, active: active }
        }));
    }

    /**
     * Removes the click handler.
     * @returns {void}
     */
    destroy() {
        this._element.removeEventListener("click", this._onClick);
    }
};

// register the control with the controller for auto-instantiation. the registered class is a
// mount marker rather than one of the styling hooks, because the controller consumes it - keying
// the look off it would strip the figure of its styling the moment it was wired. only the
// actionable form carries it: a figure without an address is a number, and a controller on it
// would have nothing to do
webexpress.webui.Controller.registerClass("wx-webapp-like-mount", webexpress.webapp.LikeCtrl);
