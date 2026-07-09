/**
 * A control managing the group-to-policy assignments of a protected resource
 * (see the identity model: Identity -> Group -> Policy -> Permission). It is
 * typically hosted inside a modal ("Manage permissions for ...") and renders
 * an assign row (group select, policy select, assign button), a searchable,
 * paged table of the current assignments and a remove affordance per row.
 * The search box is the existing basic search control
 * (webexpress.webui.SearchCtrl), instantiated on a nested host.
 *
 * An assignment is the pair (groupId, policyId): a group may carry several
 * policies, mirroring IIdentityGroup.Policies in the identity model. The
 * selects therefore exclude assigned pairs: the policy select drops the
 * policies the selected group already carries, and a group only disappears
 * from the group select once it carries every policy.
 *
 * Declarative configuration: the host carries a wx-service island named
 * "data" for the assignment endpoint plus two islands named "groups" and
 * "policies" that feed the assign selects.
 *
 * REST contract:
 *   GET  {data}?q=…&p=…&l=…                        → { items: [{ groupId, groupName, policyId, policyName }], total, assignedPairs }
 *   POST {data}     body { groupId, policyId }     → { groupId, groupName, policyId, policyName }
 *   DELETE {data}/{groupId}/{policyId}             → 204
 *   GET  {groups}?q=…                              → [{ id, name }]
 *   GET  {policies}?q=…                            → [{ id, name, description }]
 *
 * assignedPairs spans all pages, so the exclusion holds beyond the visible
 * window. A POST for an already assigned pair is idempotent on the server.
 *
 * Events dispatched on the host element:
 *   webexpress.webapp.Event.PERMISSION_ASSIGNED_EVENT detail: { assignment }
 *   webexpress.webapp.Event.PERMISSION_REMOVED_EVENT  detail: { assignment }
 */
webexpress.webapp.PermissionCtrl = class extends webexpress.webapp.Data {
    /**
     * Construct a new PermissionCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        // resolve the services and the initial state before super, so the
        // Component seeds its store from the optional wx-state island and owns
        // the service map
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        const initialState = Object.assign(
            { assignments: [], total: 0, page: 0, search: "" },
            webexpress.webapp.Data.readState(element)
        );
        // a seeded island rarely carries the full pair set; deriving it from the
        // seeded assignments keeps the first paint of the selects consistent
        if (!Array.isArray(initialState.assignedPairs)) {
            initialState.assignedPairs = (initialState.assignments || [])
                .map((a) => ({ groupId: a.groupId, policyId: a.policyId }));
        }

        super(element, { state: initialState, services: services });

        this._pageSize = parseInt(element.dataset.pageSize || "10", 10);
        this._readonly = element.dataset.readonly === "true";
        this._service = this.useService("data");
        this._groups = this.useService("groups");
        this._policies = this.useService("policies");

        this._searchTimer = null;
        this._groupRecords = [];
        this._policyRecords = [];

        // clean host
        element.textContent = "";
        element.removeAttribute("data-page-size");
        element.removeAttribute("data-readonly");
        element.classList.add("wx-permission");

        this._buildDom();
        this._attachEventHandlers();

        // subscribe to the store, perform the first render and run onMount
        this.mount();

        this._loadOptions();

        // when the server seeded the assignments through the wx-state island the
        // first paint needs no round trip; otherwise load them from the endpoint
        if (this._assignments.length === 0) {
            this._load();
        }
    }

    /**
     * The assignments, backed by the component store so the store is the
     * single source of truth and a change triggers a re-render through the
     * subscription.
     * @returns {Array<Object>} The current assignments.
     */
    get _assignments() {
        return this.state.assignments || [];
    }

    /**
     * Renders the table and the pager on the first paint.
     */
    onMount() {
        this._render();
    }

    /**
     * Renders the table and the pager whenever the assignment state changes.
     */
    onUpdate() {
        this._render();
    }

    /**
     * Builds the static DOM scaffold (assign row, search toolbar, table and
     * pager). Only the table body, the pager and the select options are
     * re-rendered on updates.
     */
    _buildDom() {
        if (!this._readonly) {
            this._assignRow = document.createElement("div");
            this._assignRow.className = "wx-permission-assign";

            this._groupSelect = this._makeSelect(
                this._i18n("webexpress.webapp:permission.assign.group.label", "Assign group"));
            this._policySelect = this._makeSelect(
                this._i18n("webexpress.webapp:permission.assign.policy.label", "Policy"));

            this._assignBtn = document.createElement("button");
            this._assignBtn.type = "button";
            this._assignBtn.className = "wx-permission-assign-btn";
            this._assignBtn.appendChild(webexpress.webui.Icon.create("fas fa-plus"));
            this._assignBtn.appendChild(document.createTextNode(
                " " + this._i18n("webexpress.webapp:permission.assign", "Assign")));

            this._assignRow.appendChild(this._groupSelect.wrapper);
            this._assignRow.appendChild(this._policySelect.wrapper);
            this._assignRow.appendChild(this._assignBtn);
            this._element.appendChild(this._assignRow);
        }

        this._toolbar = document.createElement("div");
        this._toolbar.className = "wx-permission-toolbar";

        // the search box is the existing basic search control on a nested
        // host; in the headless harness the control class is absent and the
        // surface simply renders without a search box
        this._searchHost = document.createElement("div");
        this._searchHost.className = "wx-permission-search";
        this._searchHost.setAttribute("placeholder",
            this._i18n("webexpress.webapp:permission.search.placeholder", "Search…"));
        this._toolbar.appendChild(this._searchHost);
        this._element.appendChild(this._toolbar);

        try {
            this._searchCtrl = new webexpress.webui.SearchCtrl(this._searchHost);
        } catch (err) {
            console.warn("PermissionCtrl: failed to initialize search", err);
            this._searchCtrl = null;
        }

        this._table = document.createElement("table");
        this._table.className = "wx-permission-table";

        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const thGroup = document.createElement("th");
        thGroup.textContent = this._i18n("webexpress.webapp:permission.column.group", "Assigned group");
        const thPolicy = document.createElement("th");
        thPolicy.textContent = this._i18n("webexpress.webapp:permission.column.policy", "Effective policy");
        const thAction = document.createElement("th");
        thAction.className = "wx-permission-action";
        headRow.appendChild(thGroup);
        headRow.appendChild(thPolicy);
        headRow.appendChild(thAction);
        thead.appendChild(headRow);

        this._tbody = document.createElement("tbody");
        this._table.appendChild(thead);
        this._table.appendChild(this._tbody);
        this._element.appendChild(this._table);

        this._empty = document.createElement("div");
        this._empty.className = "wx-permission-empty";
        this._empty.textContent = this._i18n("webexpress.webapp:permission.empty", "No assignments yet");
        this._element.appendChild(this._empty);

        this._pager = document.createElement("nav");
        this._pager.className = "wx-permission-pager";
        this._element.appendChild(this._pager);
    }

    /**
     * Builds a labeled select for the assign row.
     * @param {string} label - The visible label text.
     * @returns {{wrapper: HTMLElement, select: HTMLSelectElement}}
     */
    _makeSelect(label) {
        const wrapper = document.createElement("label");
        wrapper.className = "wx-permission-field";

        const caption = document.createElement("span");
        caption.className = "wx-permission-field-label";
        caption.textContent = label;

        const select = document.createElement("select");
        select.className = "wx-permission-select";
        select.appendChild(this._makePlaceholderOption());

        wrapper.appendChild(caption);
        wrapper.appendChild(select);

        return { wrapper: wrapper, select: select };
    }

    /**
     * Builds the placeholder option of an assign select.
     * @returns {HTMLOptionElement}
     */
    _makePlaceholderOption() {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = this._i18n("webexpress.webapp:permission.select.placeholder", "Please select…");
        return placeholder;
    }

    /**
     * Wires the assign button, the debounced search filter and the group
     * selection, which narrows the policy options to the unassigned ones.
     */
    _attachEventHandlers() {
        if (!this._readonly) {
            this._assignBtn.addEventListener("click", () => this._assign());
            this._groupSelect.select.addEventListener("change", () => this._renderPolicyOptions());
        }

        // the embedded search control announces its value through the filter
        // event; the debounce keeps fast typing to a single query
        this._searchHost.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, (e) => {
            const value = ((e.detail && e.detail.value) || "").trim();
            clearTimeout(this._searchTimer);
            this._searchTimer = setTimeout(() => {
                this.setState({ search: value, page: 0 });
                this._load();
            }, 250);
        });
    }

    /**
     * Loads the group and policy directories for the assign selects. Runs
     * once on construction; a readonly surface carries no selects and skips it.
     */
    async _loadOptions() {
        if (this._readonly) {
            return;
        }
        await Promise.all([this._loadGroups(), this._loadPolicies()]);
    }

    /**
     * Queries the groups service and keeps the raw directory records; the
     * options themselves are rebuilt from these records on every render, so
     * fully assigned groups drop out of the select as the assignments change.
     */
    async _loadGroups() {
        if (!this._groups) {
            return;
        }
        try {
            const res = await this._groups.query({});
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));
            this._groupRecords = Array.isArray(res.data) ? res.data : [];
            this._renderGroupOptions();
        } catch (e) {
            console.warn("PermissionCtrl: groups load failed", e);
        }
    }

    /**
     * Queries the policies service and keeps the raw directory records; the
     * options are rebuilt on every render and on group selection, excluding
     * the policies the selected group already carries.
     */
    async _loadPolicies() {
        if (!this._policies) {
            return;
        }
        try {
            const res = await this._policies.query({});
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));
            this._policyRecords = Array.isArray(res.data) ? res.data : [];
            this._renderPolicyOptions();
            // group coverage depends on the policy directory size
            this._renderGroupOptions();
        } catch (e) {
            console.warn("PermissionCtrl: policies load failed", e);
        }
    }

    /**
     * Loads the assignment page described by the current state. When a
     * removal empties the last page, the page is clamped and re-queried, so
     * the user never faces an empty window while rows remain.
     */
    async _load() {
        if (!this._service) {
            this.setState({ assignments: [], total: 0 });
            return;
        }
        try {
            const params = { page: this.state.page, pageSize: this._pageSize };
            if (this.state.search) {
                params.search = this.state.search;
            }
            const res = await this._service.query(params);
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));

            const model = webexpress.webapp.permissionModel;
            const page = model.normalizeList(res.data);
            const clamped = model.clampPage(this.state.page, model.pageCount(page.total, this._pageSize));
            if (clamped !== this.state.page && page.items.length === 0 && page.total > 0) {
                this.setState({ page: clamped });
                return this._load();
            }

            this.setState({ assignments: page.items, total: page.total, assignedPairs: page.assignedPairs });
        } catch (e) {
            console.warn("PermissionCtrl: load failed", e);
            this.setState({ assignments: [], total: 0, assignedPairs: [] });
        }
    }

    /**
     * Renders the table body, the empty hint, the pager and the select
     * options from the state.
     */
    _render() {
        this._tbody.replaceChildren();
        for (const assignment of this._assignments) {
            this._tbody.appendChild(this._makeRow(assignment));
        }

        this._empty.style.display = this._assignments.length === 0 ? "" : "none";
        this._table.style.display = this._assignments.length === 0 ? "none" : "";

        this._renderPager();
        this._renderGroupOptions();
        this._renderPolicyOptions();
    }

    /**
     * Rebuilds the group select from the directory records, excluding the
     * groups that already carry every policy. A still-assignable selection
     * survives the rebuild; a selection that just got fully assigned falls
     * back to the placeholder.
     */
    _renderGroupOptions() {
        if (this._readonly || !this._groupSelect) {
            return;
        }

        const select = this._groupSelect.select;
        const current = select.value;
        const available = webexpress.webapp.permissionModel.availableGroups(
            this._groupRecords, this.state.assignedPairs, this._policyRecords);

        select.replaceChildren(this._makePlaceholderOption());
        for (const group of available) {
            const option = document.createElement("option");
            option.value = group.id;
            option.textContent = group.name;
            select.appendChild(option);
        }

        select.value = available.some((g) => g.id === current) ? current : "";
    }

    /**
     * Rebuilds the policy select from the directory records, excluding the
     * policies the selected group already carries. A still-assignable
     * selection survives the rebuild.
     */
    _renderPolicyOptions() {
        if (this._readonly || !this._policySelect) {
            return;
        }

        const select = this._policySelect.select;
        const current = select.value;
        const available = webexpress.webapp.permissionModel.availablePolicies(
            this._policyRecords, this.state.assignedPairs, this._groupSelect.select.value);

        select.replaceChildren(this._makePlaceholderOption());
        for (const policy of available) {
            const option = document.createElement("option");
            option.value = policy.id;
            option.textContent = policy.name;
            if (policy.description) {
                option.title = policy.description;
            }
            select.appendChild(option);
        }

        select.value = available.some((p) => p.id === current) ? current : "";
    }

    /**
     * Builds a single assignment row with the remove affordance.
     * @param {Object} assignment - The assignment record.
     * @returns {HTMLElement}
     */
    _makeRow(assignment) {
        const row = document.createElement("tr");

        const group = document.createElement("td");
        group.className = "wx-permission-group";
        group.textContent = assignment.groupName || assignment.groupId;

        const policy = document.createElement("td");
        policy.className = "wx-permission-policy";
        policy.textContent = assignment.policyName || assignment.policyId;

        const action = document.createElement("td");
        action.className = "wx-permission-action";
        if (!this._readonly) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "wx-permission-remove";
            remove.title = this._i18n("webexpress.webapp:permission.remove", "Remove assignment");
            remove.setAttribute("aria-label", remove.title);
            remove.appendChild(webexpress.webui.Icon.create("fas fa-xmark"));
            remove.addEventListener("click", () => this._remove(assignment));
            action.appendChild(remove);
        }

        row.appendChild(group);
        row.appendChild(policy);
        row.appendChild(action);
        return row;
    }

    /**
     * Renders the pager (prev, windowed page numbers, next). A single page
     * needs no pager and renders nothing.
     */
    _renderPager() {
        const model = webexpress.webapp.permissionModel;
        const count = model.pageCount(this.state.total, this._pageSize);

        this._pager.replaceChildren();
        if (count <= 1) {
            return;
        }

        const current = model.clampPage(this.state.page, count);

        const prev = this._makePagerButton(
            "‹ " + this._i18n("webexpress.webapp:permission.pager.prev", "Prev"),
            current - 1, current === 0);
        prev.classList.add("wx-permission-pager-prev");
        this._pager.appendChild(prev);

        for (const page of model.pages(current, count)) {
            const btn = this._makePagerButton(String(page + 1), page, false);
            if (page === current) {
                btn.classList.add("wx-permission-pager-current");
                btn.setAttribute("aria-current", "page");
            }
            this._pager.appendChild(btn);
        }

        const next = this._makePagerButton(
            this._i18n("webexpress.webapp:permission.pager.next", "Next") + " ›",
            current + 1, current === count - 1);
        next.classList.add("wx-permission-pager-next");
        this._pager.appendChild(next);
    }

    /**
     * Builds a single pager button that navigates to a page on click.
     * @param {string} label - The button label.
     * @param {number} page - The zero-based target page.
     * @param {boolean} disabled - Whether the button is inert.
     * @returns {HTMLElement}
     */
    _makePagerButton(label, page, disabled) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-permission-pager-btn";
        btn.textContent = label;
        btn.disabled = disabled;
        if (!disabled) {
            btn.addEventListener("click", () => {
                this.setState({ page: page });
                this._load();
            });
        }
        return btn;
    }

    /**
     * Assigns the selected policy to the selected group through POST and
     * reloads the current page, so paging and filtering stay authoritative
     * on the server.
     */
    async _assign() {
        const groupId = this._groupSelect.select.value;
        const policyId = this._policySelect.select.value;
        if (!groupId || !policyId || !this._service) {
            return;
        }
        try {
            const res = await this._service.create({ groupId: groupId, policyId: policyId });
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));
            const assignment = res.data;
            this._groupSelect.select.value = "";
            this._policySelect.select.value = "";
            await this._load();
            this._dispatch(webexpress.webapp.Event.PERMISSION_ASSIGNED_EVENT, { assignment: assignment });
        } catch (e) {
            console.warn("PermissionCtrl: assign failed", e);
        }
    }

    /**
     * Revokes an assignment pair through DELETE and reloads the current page.
     * @param {Object} assignment - The assignment to revoke.
     */
    async _remove(assignment) {
        if (!this._service) {
            return;
        }
        try {
            const path = webexpress.webapp.permissionModel.removePath(assignment.groupId, assignment.policyId);
            const res = await this._service.remove({ path: path });
            if (!res.ok && res.status !== 204) throw new Error(res.error ? res.error.message : String(res.status));
            await this._load();
            this._dispatch(webexpress.webapp.Event.PERMISSION_REMOVED_EVENT, { assignment: assignment });
        } catch (e) {
            console.warn("PermissionCtrl: remove failed", e);
        }
    }

    /**
     * Re-fetches the current page from the server (useful after external
     * state changes).
     */
    refresh() {
        return this._load();
    }

    /**
     * Gets the assignments of the currently loaded page.
     * @returns {Array<Object>}
     */
    get value() {
        return this._assignments.slice();
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-permission", webexpress.webapp.PermissionCtrl);
