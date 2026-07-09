var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the permission control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService
 * whose query loads the group-to-policy assignments, whose create assigns one
 * and whose remove revokes one, plus a groups and a policies service for the
 * assign selects.
 *
 * An assignment is the pair (groupId, policyId): a group may carry several
 * policies, so the pair is the identity of a row, mirroring
 * IIdentityGroup.Policies in the identity model.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.permissionModel = {
    /**
     * Normalises an assignment list response into { items, total,
     * assignedPairs }, tolerating a flat array (the total then equals the
     * length) and a missing or malformed payload, so the renderer always
     * receives a list and a count. When the response carries no explicit
     * pair set, it is derived from the items, which keeps a single-page
     * response consistent.
     * @param {*} data - The raw response payload.
     * @returns {{items: Array<object>, total: number, assignedPairs: Array<object>}} The normalised page.
     */
    normalizeList(data) {
        const pairsOf = (items) => items.map((a) => ({ groupId: a.groupId, policyId: a.policyId }));

        if (Array.isArray(data)) {
            return { items: data, total: data.length, assignedPairs: pairsOf(data) };
        }
        if (data && Array.isArray(data.items)) {
            const total = Number(data.total);
            const assignedPairs = Array.isArray(data.assignedPairs)
                ? data.assignedPairs
                : pairsOf(data.items);
            return {
                items: data.items,
                total: Number.isFinite(total) ? total : data.items.length,
                assignedPairs: assignedPairs
            };
        }
        return { items: [], total: 0, assignedPairs: [] };
    },

    /**
     * Returns the groups that can still receive an assignment. A group drops
     * out of the select only once it carries every policy of the directory;
     * with an empty policy directory no group is excluded, because coverage
     * cannot be determined.
     * @param {Array<object>} groups - The group directory records.
     * @param {Array<object>} assignedPairs - The assigned (groupId, policyId) pairs.
     * @param {Array<object>} policies - The policy directory records.
     * @returns {Array<object>} The groups that can still be assigned.
     */
    availableGroups(groups, assignedPairs, policies) {
        const policyIds = (Array.isArray(policies) ? policies : []).map((p) => p.id);
        if (policyIds.length === 0) {
            return (Array.isArray(groups) ? groups : []).slice();
        }

        const byGroup = new Map();
        for (const pair of Array.isArray(assignedPairs) ? assignedPairs : []) {
            if (!byGroup.has(pair.groupId)) {
                byGroup.set(pair.groupId, new Set());
            }
            byGroup.get(pair.groupId).add(pair.policyId);
        }

        return (Array.isArray(groups) ? groups : []).filter((g) => {
            const assigned = byGroup.get(g.id);
            return !assigned || policyIds.some((id) => !assigned.has(id));
        });
    },

    /**
     * Returns the policies that can still be assigned to a group, excluding
     * the ones the group already carries. Without a selected group the full
     * directory is offered, because there is no pair to exclude yet.
     * @param {Array<object>} policies - The policy directory records.
     * @param {Array<object>} assignedPairs - The assigned (groupId, policyId) pairs.
     * @param {string} groupId - The id of the selected group, may be empty.
     * @returns {Array<object>} The policies that can still be assigned.
     */
    availablePolicies(policies, assignedPairs, groupId) {
        const all = (Array.isArray(policies) ? policies : []).slice();
        if (!groupId) {
            return all;
        }

        const assigned = new Set((Array.isArray(assignedPairs) ? assignedPairs : [])
            .filter((pair) => pair.groupId === groupId)
            .map((pair) => pair.policyId));

        return all.filter((p) => !assigned.has(p.id));
    },

    /**
     * Computes the number of pages for a total and a page size. An empty
     * result still spans one page, so the pager math never divides by zero.
     * @param {number} total - The total number of assignments.
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
     * Returns the window of page indices the pager renders, centered on the
     * current page and clamped to the ends, so a long page list stays compact.
     * @param {number} page - The zero-based current page.
     * @param {number} pageCount - The page count.
     * @param {number} [maxVisible=5] - The maximum number of page buttons.
     * @returns {Array<number>} The zero-based page indices to render.
     */
    pages(page, pageCount, maxVisible = 5) {
        const count = Math.max(1, Number(pageCount) || 1);
        const visible = Math.max(1, Number(maxVisible) || 1);
        let start = this.clampPage(page, count) - Math.floor(visible / 2);
        start = Math.max(0, Math.min(start, count - visible));
        const result = [];
        for (let i = start; i < Math.min(start + visible, count); i++) {
            result.push(i);
        }
        return result;
    },

    /**
     * Builds the delete path segments for an assignment pair.
     * @param {string} groupId - The id of the assigned group.
     * @param {string} policyId - The id of the assigned policy.
     * @returns {string} The path appended to the base uri.
     */
    removePath(groupId, policyId) {
        return "/" + encodeURIComponent(groupId) + "/" + encodeURIComponent(policyId);
    }
};
