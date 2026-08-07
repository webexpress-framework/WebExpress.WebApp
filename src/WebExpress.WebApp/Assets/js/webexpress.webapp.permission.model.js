var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the permission control. These functions carry no DOM
 * or network dependency, so they can be unit tested in isolation. The control
 * composes them with a RestService whose query loads the group entries, whose
 * create adds a group, whose update replaces the policy set of a group and
 * whose remove revokes a group, plus a groups and a policies directory service.
 *
 * A row of the surface is a group with all policies it carries, mirroring
 * IIdentityGroup.Policies in the identity model, so the group id is the row
 * identity and the policy set is the edited value.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.permissionModel = {
    /**
     * Normalises an entry list response into { items, total, assignedGroupIds },
     * tolerating a flat array (the total then equals the length) and a missing
     * or malformed payload, so the renderer always receives a list and a count.
     * When the response carries no explicit group set, it is derived from the
     * items, which keeps a single-page response consistent.
     * @param {*} data - The raw response payload.
     * @returns {{items: Array<object>, total: number, assignedGroupIds: Array<string>}} The normalised page.
     */
    normalizeList(data) {
        const idsOf = (items) => items.map((x) => x.groupId).filter((id) => id != null);

        if (Array.isArray(data)) {
            return { items: data, total: data.length, assignedGroupIds: idsOf(data) };
        }
        if (data && Array.isArray(data.items)) {
            const total = Number(data.total);
            return {
                items: data.items,
                total: Number.isFinite(total) ? total : data.items.length,
                assignedGroupIds: Array.isArray(data.assignedGroupIds)
                    ? data.assignedGroupIds
                    : idsOf(data.items)
            };
        }
        return { items: [], total: 0, assignedGroupIds: [] };
    },

    /**
     * Returns the policy ids of an entry as an array, tolerating the serialized
     * form the move control emits, so a value coming back from the inline
     * editor and a value coming from the endpoint are handled alike.
     * @param {*} value - An array of ids, a semicolon separated string or an entry.
     * @returns {Array<string>} The policy ids.
     */
    policyIds(value) {
        const source = (value && !Array.isArray(value) && typeof value === "object")
            ? value.policyIds
            : value;

        if (Array.isArray(source)) {
            return source.map(String).filter((id) => id.length > 0);
        }
        if (typeof source === "string") {
            return source.split(";").map((id) => id.trim()).filter((id) => id.length > 0);
        }
        return [];
    },

    /**
     * Returns the groups the add row still offers, which are the ones that do
     * not carry a policy yet. The exclusion spans all pages, because the
     * endpoint reports the assigned group ids independently of the paging.
     * @param {Array<object>} groups - The group directory records.
     * @param {Array<string>} assignedGroupIds - The ids of the groups that already have a row.
     * @returns {Array<object>} The groups that can still be added.
     */
    availableGroups(groups, assignedGroupIds) {
        const assigned = new Set((Array.isArray(assignedGroupIds) ? assignedGroupIds : []).map(String));

        return (Array.isArray(groups) ? groups : []).filter((group) => !assigned.has(String(group.id)));
    },

    /**
     * Maps the policy directory records onto the option shape of the move
     * control, which identifies an option by id and labels it by name.
     * @param {Array<object>} policies - The policy directory records.
     * @returns {Array<object>} The move options.
     */
    policyOptions(policies) {
        return (Array.isArray(policies) ? policies : []).map((policy) => ({
            id: policy.id,
            label: policy.name || policy.id
        }));
    },

    /**
     * Computes the number of pages for a total and a page size. An empty
     * result still spans one page, so the pager math never divides by zero.
     * @param {number} total - The total number of entries.
     * @param {number} pageSize - The page size.
     * @returns {number} The page count, at least 1.
     */
    pageCount(total, pageSize) {
        const size = Number(pageSize) > 0 ? Number(pageSize) : 1;
        return Math.max(1, Math.ceil((Number(total) || 0) / size));
    },

    /**
     * Clamps a page index into the valid range, so removing the last row of
     * the last page navigates back instead of showing an empty window.
     * @param {number} page - The zero-based page index.
     * @param {number} pageCount - The page count.
     * @returns {number} The clamped zero-based page index.
     */
    clampPage(page, pageCount) {
        const count = Math.max(1, Number(pageCount) || 1);
        return Math.min(Math.max(0, Number(page) || 0), count - 1);
    },

    /**
     * Builds the path segment that addresses a single group entry, used by the
     * update and the remove request.
     * @param {string} groupId - The id of the group.
     * @returns {string} The path appended to the base uri.
     */
    entryPath(groupId) {
        return "/" + encodeURIComponent(groupId);
    }
};
