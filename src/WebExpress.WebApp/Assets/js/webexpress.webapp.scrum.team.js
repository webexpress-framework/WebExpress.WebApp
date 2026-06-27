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
 * REST contract:
 *   GET {data} → [{ id, name, team, initials, color, points }]
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

        this._buildDom();

        // subscribe to the store, perform the first render and run onMount
        this.mount();

        // when the server seeded the members through the wx-state island the
        // first paint needs no round trip; otherwise load them from the endpoint
        if (this._members.length === 0) {
            this._load();
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
     * Renders the avatar row on the first paint.
     */
    onMount() {
        this._render();
    }

    /**
     * Renders the avatar row whenever the member state changes.
     */
    onUpdate() {
        this._render();
    }

    /**
     * Builds the static DOM scaffold (the avatar row).
     */
    _buildDom() {
        this._row = document.createElement("div");
        // the people render as an overlapping avatar group (webexpress.webui)
        this._row.className = "wx-avatar-group";
        this._element.appendChild(this._row);
    }

    /**
     * Reloads the members from the configured endpoint.
     */
    refresh() {
        this._load();
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
     * Renders the avatar row from `this._members`.
     */
    _render() {
        this._row.replaceChildren();

        const members = this._members;
        if (members.length === 0) {
            const empty = document.createElement("span");
            empty.className = "wx-scrum-team-empty-row";
            empty.textContent = this._i18n("webexpress.webapp:scrum.team.empty", "No people in this sprint.");
            this._row.appendChild(empty);
            this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
            return;
        }

        const visible = members.slice(0, this._maxVisible);
        const overflow = members.length - visible.length;

        for (const m of visible) {
            this._row.appendChild(this._makeAvatar(m));
        }

        if (overflow > 0) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "wx-avatar-group-more wx-scrum-team-more";
            more.textContent = "+" + overflow;
            more.title = members.slice(this._maxVisible).map(m => m.name).join(", ");
            more.addEventListener("click", () => this._openModal());
            this._row.appendChild(more);
        }

        const total = document.createElement("button");
        total.type = "button";
        total.className = "wx-scrum-team-total";
        total.title = this._i18n("webexpress.webapp:scrum.team.show_all", "Show all people");
        total.appendChild(this._makePointsBadge(webexpress.webapp.scrumTeamModel.totalPoints(members), "Σ"));
        total.addEventListener("click", () => this._openModal());
        this._row.appendChild(total);

        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
    }

    /**
     * Builds a single avatar element for a member, badged with their points.
     * Clicking the avatar opens the full table modal.
     * @param {object} member - The member record.
     * @returns {HTMLElement}
     */
    _makeAvatar(member) {
        const av = document.createElement("button");
        av.type = "button";
        av.className = "wx-avatar-group-avatar wx-scrum-team-avatar";
        av.title = member.name
            + (member.team ? " · " + member.team : "")
            + " · " + member.completed + "/" + member.points + " " + this._i18n("webexpress.webapp:scrum.team.points_abbr", "pts")
            + " " + this._i18n("webexpress.webapp:scrum.team.completed", "completed").toLowerCase();
        av.setAttribute("aria-label", av.title);
        av.style.background = member.color || "#888";
        av.appendChild(document.createTextNode(member.initials));

        const badge = document.createElement("span");
        badge.className = "wx-scrum-team-badge";
        badge.textContent = String(member.points);
        this._applyColor(badge, this._colors.points);
        av.appendChild(badge);

        av.addEventListener("click", () => this._openModal());
        return av;
    }

    /**
     * Builds a labelled points pill, used by the trailing total chip.
     * @param {number} points - The point value.
     * @param {string} prefix - A short prefix symbol shown ahead of the value.
     * @returns {HTMLElement}
     */
    _makePointsBadge(points, prefix) {
        const pill = document.createElement("span");
        pill.className = "wx-scrum-team-total-pill";
        pill.textContent = prefix + " " + points + " " + this._i18n("webexpress.webapp:scrum.team.points_abbr", "pts");
        return pill;
    }

    /**
     * Opens the modal that lists every member with their story points as a
     * table, sorted by descending points and closed by a total row.
     */
    _openModal() {
        const sorted = webexpress.webapp.scrumTeamModel.sortByPoints(this._members);

        const host = document.createElement("div");
        host.setAttribute("data-size", "modal-lg");

        const header = document.createElement("span");
        header.className = "wx-modal-header";
        header.textContent = this._i18n("webexpress.webapp:scrum.team.title", "Sprint team");
        host.appendChild(header);

        const content = document.createElement("div");
        content.className = "wx-modal-content px-3 py-2";
        content.appendChild(this._buildTable(sorted));
        host.appendChild(content);

        document.body.appendChild(host);

        const modal = new webexpress.webui.ModalCtrl(host);
        host.addEventListener(webexpress.webui.Event.MODAL_HIDE_EVENT, () => host.remove());
        modal.show();
    }

    /**
     * Builds the people-vs-points table for the modal, breaking the load down
     * into the completed and the planned story points per person and closing
     * with a total row for each.
     * @param {Array<object>} members - The members, already sorted.
     * @returns {HTMLTableElement}
     */
    _buildTable(members) {
        const plannedTotal = webexpress.webapp.scrumTeamModel.totalPoints(members);
        const completedTotal = webexpress.webapp.scrumTeamModel.completedPoints(members);

        const table = document.createElement("table");
        table.className = "wx-scrum-team-table";

        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        headRow.appendChild(this._th(this._i18n("webexpress.webapp:scrum.team.person", "Person")));
        headRow.appendChild(this._th(this._i18n("webexpress.webapp:scrum.team.completed", "Completed"), true));
        headRow.appendChild(this._th(this._i18n("webexpress.webapp:scrum.team.planned", "Planned"), true));
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        if (members.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 3;
            td.className = "wx-scrum-team-empty";
            td.textContent = this._i18n("webexpress.webapp:scrum.team.empty", "No people in this sprint.");
            tr.appendChild(td);
            tbody.appendChild(tr);
        } else {
            for (const m of members) {
                tbody.appendChild(this._buildTableRow(m));
            }
        }
        table.appendChild(tbody);

        const tfoot = document.createElement("tfoot");
        const footRow = document.createElement("tr");
        const footLabel = document.createElement("td");
        footLabel.textContent = this._i18n("webexpress.webapp:scrum.team.total", "Total");
        footRow.appendChild(footLabel);
        footRow.appendChild(this._pointsCell(completedTotal, "done"));
        footRow.appendChild(this._pointsCell(plannedTotal));
        tfoot.appendChild(footRow);
        table.appendChild(tfoot);

        return table;
    }

    /**
     * Builds a single table row for a member, with the completion progress bar
     * under the name and the completed and planned points in their columns.
     * @param {object} member - The member record.
     * @returns {HTMLTableRowElement}
     */
    _buildTableRow(member) {
        const tr = document.createElement("tr");

        const tdPerson = document.createElement("td");
        const person = document.createElement("div");
        person.className = "wx-scrum-team-person";

        const avatar = document.createElement("span");
        avatar.className = "wx-scrum-team-avatar-sm";
        avatar.style.background = member.color || "#888";
        avatar.textContent = member.initials;
        person.appendChild(avatar);

        const body = document.createElement("span");
        body.className = "wx-scrum-team-person-body";

        const name = document.createElement("span");
        name.className = "wx-scrum-team-person-name";
        name.textContent = member.name;
        body.appendChild(name);

        if (member.team) {
            const team = document.createElement("span");
            team.className = "wx-scrum-team-person-team";
            team.textContent = member.team;
            body.appendChild(team);
        }

        body.appendChild(this._buildProgress(member));
        person.appendChild(body);
        tdPerson.appendChild(person);

        tr.appendChild(tdPerson);
        tr.appendChild(this._pointsCell(member.completed, "done"));
        tr.appendChild(this._pointsCell(member.points));
        return tr;
    }

    /**
     * Builds the per-member completion bar visualising the completed share of
     * the planned points.
     * @param {object} member - The member record.
     * @returns {HTMLElement}
     */
    _buildProgress(member) {
        const pct = member.points > 0 ? Math.round((member.completed / member.points) * 100) : 0;

        const bar = document.createElement("span");
        bar.className = "wx-scrum-team-progress";
        bar.title = member.completed + "/" + member.points + " " + this._i18n("webexpress.webapp:scrum.team.points_abbr", "pts");

        const fill = document.createElement("span");
        fill.style.width = pct + "%";
        this._applyColor(fill, this._colors.completed);
        bar.appendChild(fill);

        return bar;
    }

    /**
     * Builds a right-aligned points table header cell.
     * @param {string} text - The header text.
     * @param {boolean} [numeric=false] - Whether the column holds points.
     * @returns {HTMLTableCellElement}
     */
    _th(text, numeric = false) {
        const th = document.createElement("th");
        if (numeric) {
            th.className = "wx-scrum-team-points-col";
        }
        th.textContent = text;
        return th;
    }

    /**
     * Builds a right-aligned points table cell carrying a badge.
     * @param {number} points - The point value.
     * @param {string} [variant] - An optional badge variant, for example "done".
     * @returns {HTMLTableCellElement}
     */
    _pointsCell(points, variant) {
        const td = document.createElement("td");
        td.className = "wx-scrum-team-points-col";

        const badge = document.createElement("span");
        badge.className = "wx-scrum-team-points-badge" + (variant ? " " + variant : "");
        badge.textContent = String(points);
        if (variant === "done") {
            this._applyColor(badge, this._colors.completed);
        }
        td.appendChild(badge);

        return td;
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
     * Applies a color descriptor to an element, preferring the CSS class and
     * falling back to the inline style declaration. A null or empty descriptor
     * leaves the element's stylesheet default untouched.
     * @param {HTMLElement} element - The target element.
     * @param {{css: (string|null), style: (string|null)}} color - The descriptor.
     */
    _applyColor(element, color) {
        if (!element || !color) {
            return;
        }

        if (color.css) {
            for (const cls of color.css.split(/\s+/)) {
                if (cls) {
                    element.classList.add(cls);
                }
            }
        } else if (color.style) {
            element.style.cssText += ";" + color.style;
        }
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
