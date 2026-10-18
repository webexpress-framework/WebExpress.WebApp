/**
 * A control showing the people working in the current sprint as a compact row
 * of avatars, each carrying a small badge with the story points assigned to that
 * person. Only the first N people are rendered inline; the rest collapse into a
 * "+N" overflow chip. Clicking an avatar, the overflow chip or the trailing
 * total chip opens a modal that lists every person with their story points as a
 * table, sorted by the heaviest load first and closed by a total row.
 *
 * The layout mirrors webexpress.webapp.WatcherCtrl so the two avatar surfaces
 * read alike; unlike the watcher this control is read-only and adds the modal
 * with the full table.
 *
 * Declarative configuration: the host carries a wx-service island named "data"
 * for the team endpoint.
 *
 * The avatar row and the modal table are pure functions of the state, turned into DOM by the
 * keyed reconciler: the row by the Data base on every state change, the table when the modal opens.
 *
 * It is ViewState-capable: when the host carries a data-wx-resource binding the
 * members are a slice of an enclosing ViewState, so the control
 * subscribes to that slice and the ViewState owns the central load; without a
 * binding it owns its own wx-service island and loads itself (standalone).
 *
 * REST contract:
 *   GET {data} → [{ id, name, team, initials, color, image, points }]
 *
 * Events dispatched on the host element:
 *   webexpress.webui.Event.DATA_REQUESTED_EVENT
 *   webexpress.webui.Event.DATA_ARRIVED_EVENT
 *   webexpress.webui.Event.UPDATED_EVENT
 */
webexpress.webapp.ScrumTeamCtrl = class extends webexpress.webapp.Data {
    /**
     * Construct a new ScrumTeamCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        // resolve the service and the initial state before super, so the
        // Component seeds its store from the optional wx-state island and owns
        // the service map
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        const initialState = Object.assign({ members: [] }, webexpress.webapp.Data.readState(element));

        super(element, { state: initialState, services: services });

        this._maxVisible = parseInt(element.dataset.maxVisible || "6", 10);
        // the resource a ViewState renders; when present the members are a pure
        // view of a central resource the enclosing ViewState owns, when absent the
        // control loads itself (standalone)
        this._resource = (element.dataset && element.dataset.wxResource) || null;
        this._service = this.useService("data");

        // the avatar badge and the completed accent colors are authored in C# and
        // emitted either as a CSS class (system color) or an inline style
        // (user-defined color); both paths are honored when painting
        this._colors = {
            points: this._readColor(element, "color-points"),
            completed: this._readColor(element, "color-completed")
        };

        // clean host
        element.textContent = "";
        element.removeAttribute("data-max-visible");
        element.classList.add("wx-scrum-team");

        // stable handler, so a render does not swap the listeners of unchanged nodes
        this._onOpen = () => this._openModal();

        // subscribe to the store, perform the first render and run onMount
        this.mount();

        // when the server seeded the members through the wx-state island the
        // first paint needs no round trip; otherwise load them from the endpoint
        if (this._resource) {
            this._attachToViewState(element);
        } else if (this._members.length === 0) {
            this._load();
        }
    }

    /**
     * Attaches the control to the enclosing ViewState and renders its
     * resource slice. The ViewState owns the central load and the service; this
     * control becomes a pure view that re-renders whenever the ViewState re-queries
     * the resource.
     * @param {HTMLElement} element - The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
            }

            const unsubscribe = viewState.watch((state) => viewState.slice(this._resource, state), (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.slice(this._resource));
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        if (slice.data) {
            this._members = webexpress.webapp.scrumTeamModel.normalizeList(slice.data);
        }
    }

    /**
     * The members, backed by the component store so the store is the single
     * source of truth and a change triggers a re-render through the subscription.
     * @returns {Array<object>} The current members.
     */
    get _members() {
        return this.state.members || [];
    }

    set _members(value) {
        this.setState({ members: value });
    }

    /**
     * Announces the first paint.
     */
    onMount() {
        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
    }

    /**
     * Announces every later paint.
     */
    onUpdate() {
        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
    }

    /**
     * Reloads the members, in ViewState mode through the ViewState's central re-query
     * and standalone from the configured endpoint.
     */
    refresh() {
        if (this._viewState && this._resource) {
            this._viewState.reload(this._resource);
        } else {
            this._load();
        }
    }

    /**
     * Loads the members from the configured service and renders them.
     */
    async _load() {
        if (!this._service) {
            this._members = [];
            return;
        }

        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, {});
        try {
            const res = await this._service.query({});
            if (!res.ok) {
                throw new Error(res.error ? res.error.message : String(res.status));
            }
            this._members = webexpress.webapp.scrumTeamModel.normalizeList(res.data);
            this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {});
        } catch (e) {
            console.warn("ScrumTeamCtrl: load failed", e);
            this._members = [];
        }
    }

    /**
     * Renders the avatar row: the first members, an overflow chip and the total chip, or a
     * hint when nobody works in the sprint.
     * @param {object} state - The current state.
     * @returns {Array<object>} The virtual node tree of the host.
     */
    render(state) {
        const h = webexpress.webui.h;
        const members = state.members || [];

        // the people render as an overlapping avatar group (webexpress.webui)
        if (members.length === 0) {
            return [h("div", { key: "row", class: "wx-avatar-group" },
                h("span", { class: "wx-scrum-team-empty-row" },
                    this._i18n("webexpress.webapp:scrum.team.empty", "No people in this sprint.")))];
        }

        const hidden = members.slice(this._maxVisible);
        return [h("div", { key: "row", class: "wx-avatar-group" },
            members.slice(0, this._maxVisible).map((member) => this._renderAvatar(member)),
            hidden.length > 0 && h("button", {
                key: "more",
                type: "button",
                class: "wx-avatar-group-more wx-scrum-team-more",
                title: hidden.map((member) => member.name).join(", "),
                on: { click: this._onOpen }
            }, "+" + hidden.length),
            h("button", {
                key: "total",
                type: "button",
                class: "wx-scrum-team-total",
                title: this._i18n("webexpress.webapp:scrum.team.show_all", "Show all people"),
                on: { click: this._onOpen }
            }, h("span", { class: "wx-scrum-team-total-pill" },
                "Σ " + webexpress.webapp.scrumTeamModel.totalPoints(members) + " "
                + this._i18n("webexpress.webapp:scrum.team.points_abbr", "pts"))))];
    }

    /**
     * Renders a single avatar for a member, badged with their points. Clicking the avatar
     * opens the full table modal.
     * @param {object} member - The member record.
     * @returns {object} The avatar virtual node.
     */
    _renderAvatar(member) {
        const h = webexpress.webui.h;
        const title = member.name
            + (member.team ? " · " + member.team : "")
            + " · " + member.completed + "/" + member.points + " " + this._i18n("webexpress.webapp:scrum.team.points_abbr", "pts")
            + " " + this._i18n("webexpress.webapp:scrum.team.completed", "completed").toLowerCase();

        return h("button", {
            key: member.id,
            type: "button",
            class: "wx-avatar-group-avatar wx-scrum-team-avatar",
            title: title,
            "aria-label": title,
            style: member.image ? {} : { background: member.color || "#888" },
            on: { click: this._onOpen }
        },
            member.image
                ? h("img", { class: "wx-avatar-group-img", src: member.image, alt: member.name || "" })
                : member.initials,
            h("span", this._colored("wx-scrum-team-badge", "", this._colors.points), String(member.points)));
    }

    /**
     * Opens the modal that lists every member with their story points as a
     * table, sorted by descending points and closed by a total row.
     */
    _openModal() {
        const sorted = webexpress.webapp.scrumTeamModel.sortByPoints(this._members);

        const host = document.createElement("dialog");
        host.setAttribute("data-size", "modal-lg");

        const header = document.createElement("span");
        header.className = "wx-modal-header";
        header.textContent = this._i18n("webexpress.webapp:scrum.team.title", "Sprint team");
        host.appendChild(header);

        const content = document.createElement("div");
        content.className = "wx-modal-content px-3 py-2";
        webexpress.webui.Renderer.patch(content, this._renderTable(sorted));
        host.appendChild(content);

        document.body.appendChild(host);

        const modal = new webexpress.webui.ModalCtrl(host);
        host.addEventListener(webexpress.webui.Event.MODAL_HIDE_EVENT, () => host.remove());
        modal.show();
    }

    /**
     * Renders the people-vs-points table for the modal, breaking the load down
     * into the completed and the planned story points per person and closing
     * with a total row for each.
     * @param {Array<object>} members - The members, already sorted.
     * @returns {object} The table virtual node.
     */
    _renderTable(members) {
        const h = webexpress.webui.h;
        const head = (text, numeric) => h("th", { class: numeric ? "wx-scrum-team-points-col" : null }, text);

        return h("table", { class: "wx-scrum-team-table" },
            h("thead", null, h("tr", null,
                head(this._i18n("webexpress.webapp:scrum.team.person", "Person")),
                head(this._i18n("webexpress.webapp:scrum.team.completed", "Completed"), true),
                head(this._i18n("webexpress.webapp:scrum.team.planned", "Planned"), true))),
            h("tbody", null, members.length === 0
                ? h("tr", null, h("td", { colspan: 3, class: "wx-scrum-team-empty" },
                    this._i18n("webexpress.webapp:scrum.team.empty", "No people in this sprint.")))
                : members.map((member) => this._renderTableRow(member))),
            h("tfoot", null, h("tr", null,
                h("td", null, this._i18n("webexpress.webapp:scrum.team.total", "Total")),
                this._renderPointsCell(webexpress.webapp.scrumTeamModel.completedPoints(members), "done"),
                this._renderPointsCell(webexpress.webapp.scrumTeamModel.totalPoints(members)))));
    }

    /**
     * Renders a single table row for a member, with the completion progress bar
     * under the name and the completed and planned points in their columns.
     * @param {object} member - The member record.
     * @returns {object} The row virtual node.
     */
    _renderTableRow(member) {
        const h = webexpress.webui.h;
        const pct = member.points > 0 ? Math.round((member.completed / member.points) * 100) : 0;

        return h("tr", { key: member.id },
            h("td", null, h("div", { class: "wx-scrum-team-person" },
                member.image
                    ? h("img", { class: "wx-scrum-team-avatar-sm", src: member.image, alt: member.name || "" })
                    : h("span", { class: "wx-scrum-team-avatar-sm", style: { background: member.color || "#888" } }, member.initials),
                h("span", { class: "wx-scrum-team-person-body" },
                    h("span", { class: "wx-scrum-team-person-name" }, member.name),
                    member.team && h("span", { class: "wx-scrum-team-person-team" }, member.team),
                    h("span", {
                        class: "wx-scrum-team-progress",
                        title: member.completed + "/" + member.points + " " + this._i18n("webexpress.webapp:scrum.team.points_abbr", "pts")
                    }, h("span", this._colored(null, "width:" + pct + "%", this._colors.completed)))))),
            this._renderPointsCell(member.completed, "done"),
            this._renderPointsCell(member.points));
    }

    /**
     * Renders a right-aligned points table cell carrying a badge.
     * @param {number} points - The point value.
     * @param {string} [variant] - An optional badge variant, for example "done".
     * @returns {object} The cell virtual node.
     */
    _renderPointsCell(points, variant) {
        const h = webexpress.webui.h;
        const className = "wx-scrum-team-points-badge" + (variant ? " " + variant : "");
        const badge = variant === "done"
            ? this._colored(className, "", this._colors.completed)
            : { class: className };

        return h("td", { class: "wx-scrum-team-points-col" }, h("span", badge, String(points)));
    }

    /**
     * Reads a user-definable color authored on the host as a `data-{name}-css`
     * class (system color) and a `data-{name}-style` inline declaration
     * (user-defined color), removing the source attributes so the host is left
     * clean after the configuration has been consumed.
     * @param {HTMLElement} element - The host element.
     * @param {string} name - The attribute base name, for example "color-points".
     * @returns {{css: (string|null), style: (string|null)}} The color descriptor.
     */
    _readColor(element, name) {
        const cssAttr = "data-" + name + "-css";
        const styleAttr = "data-" + name + "-style";

        const color = {
            css: element.getAttribute(cssAttr) || null,
            style: element.getAttribute(styleAttr) || null
        };

        element.removeAttribute(cssAttr);
        element.removeAttribute(styleAttr);

        return color;
    }

    /**
     * Combines the class and the inline style of a colored element, preferring the color's
     * CSS class and falling back to its inline declaration. A null or empty descriptor leaves
     * the stylesheet default untouched.
     * @param {string|null} className - The element's own classes.
     * @param {string} style - The element's own inline style.
     * @param {{css: (string|null), style: (string|null)}} color - The descriptor.
     * @returns {{class: (string|null), style: string}} The props of the element.
     */
    _colored(className, style, color) {
        if (color && color.css) {
            return { class: [className, ...color.css.split(/\s+/)].filter(Boolean).join(" "), style: style };
        }
        if (color && color.style) {
            return { class: className, style: style + ";" + color.style };
        }
        return { class: className, style: style };
    }

    /**
     * Gets the current list of members.
     * @returns {Array<object>}
     */
    get value() {
        return this._members.slice();
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-scrum-team", webexpress.webapp.ScrumTeamCtrl);
