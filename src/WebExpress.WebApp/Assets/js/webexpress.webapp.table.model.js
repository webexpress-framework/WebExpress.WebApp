var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST table control (phase two of the View, State
 * and Service migration). These functions carry no DOM or network dependency,
 * so they can be unit tested in isolation. The control composes them with a
 * Store and a RestService.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.tableModel = {
    /**
     * Builds the legacy service descriptor used when the host element does not
     * carry a data-wx-service island. It reproduces the historical query
     * parameter names and uses PUT for the layout state update, which matches
     * the historical behaviour.
     * @param {string} restUri - The REST endpoint backing the table.
     * @returns {object} A rest service descriptor.
     */
    legacyDescriptor(restUri) {
        return {
            name: "data",
            kind: "rest",
            baseUri: restUri || "",
            method: "GET",
            updateMethod: "PUT",
            query: {
                search: "q",
                wql: "wql",
                filter: "f",
                page: "p",
                pageSize: "l",
                orderBy: "o",
                orderDir: "d"
            },
            response: { rows: "rows", total: "total" }
        };
    },

    /**
     * Builds the logical query parameters from the current state. The order
     * parameters are only included when an order field is set.
     * @param {object} state - The table state.
     * @returns {object} The logical query parameters.
     */
    queryParams(state) {
        state = state || {};

        const params = {
            search: state.search || "",
            wql: state.wql || "",
            filter: state.filter || "",
            page: state.page || 0,
            pageSize: state.pageSize || 50
        };

        if (state.orderBy) {
            params.orderBy = state.orderBy;
            if (state.orderDir) {
                params.orderDir = state.orderDir;
            }
        }

        return params;
    },

    /**
     * Reduces a server response into a state patch carrying the total record
     * count and the clamped page index. When the response omits the total, it
     * is inferred from the current page, the page size and the number of rows
     * received, which matches the historical behaviour.
     * @param {object} state - The current table state.
     * @param {object} response - The raw server response.
     * @returns {object} A state patch.
     */
    reduceResponse(state, response) {
        state = state || {};
        response = response || {};

        const pageSize = state.pageSize || 50;
        const receivedRows = Array.isArray(response.rows) ? response.rows.length : 0;
        const totalFromResponse = response.total ?? null;
        const total = totalFromResponse !== null
            ? (Number(totalFromResponse) || 0)
            : ((state.page || 0) * pageSize) + receivedRows;

        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        let page = state.page || 0;
        if (page >= totalPages) {
            page = totalPages - 1;
        }

        return { total: total, page: page, error: null };
    },

    /**
     * Slices a raw row array to the page size, leaving non array values
     * untouched, which matches the historical behaviour.
     * @param {Array} rows - The raw rows.
     * @param {number} pageSize - The page size.
     * @returns {Array} The sliced rows.
     */
    sliceRows(rows, pageSize) {
        if (!Array.isArray(rows)) {
            return rows || [];
        }
        return rows.length > pageSize ? rows.slice(0, pageSize) : rows;
    },

    /**
     * Normalises the response columns into the internal column representation
     * and applies the current sort to the matching column.
     * @param {object} response - The raw server response.
     * @param {string|null} orderBy - The current order column id.
     * @param {string|null} orderDir - The current order direction.
     * @returns {Array<object>} The normalised columns.
     */
    normalizeColumns(response, orderBy, orderDir) {
        response = response || {};

        const columns = (response.columns || []).map((c, idx) => {
            let rType = c.rendererType || null;
            let rOpts = c.rendererOptions || {};

            if (c.template && typeof c.template === "object") {
                rType = c.template.type;
                rOpts = c.template.options || {};
                if (c.template.editable) {
                    rOpts.editable = c.template.editable;
                }
            }

            let isVisible = true;
            if (typeof c.visible === "boolean") {
                isVisible = c.visible;
            }

            let isResizable = true;
            if (typeof c.resizable === "boolean") {
                isResizable = c.resizable;
            }

            return {
                id: c.id || `col_${idx}`,
                label: c.label || c.id,
                name: c.name || null,
                visible: isVisible,
                sort: null,
                width: c.width || null,
                minWidth: c.minWidth || null,
                resizable: isResizable,
                icon: c.icon || null,
                image: c.image || null,
                color: c.color || null,
                rendererType: rType,
                rendererOptions: rOpts
            };
        });

        if (orderBy) {
            const targetCol = columns.find((c) => c.id === orderBy);
            if (targetCol) {
                targetCol.sort = orderDir || "asc";
            }
        }

        return columns;
    },

    /**
     * Normalises the response rows into the internal row representation,
     * recursing into children and slicing to the page size.
     * @param {object} response - The raw server response.
     * @param {number} pageSize - The page size.
     * @returns {Array<object>} The normalised rows.
     */
    normalizeRows(response, pageSize) {
        response = response || {};

        const normalizeRow = (r, parent = null) => {
            let isExpanded = true;
            if (typeof r.expanded === "boolean") {
                isExpanded = r.expanded;
            }

            const row = {
                id: r.id || null,
                class: r.class || null,
                style: r.style || null,
                color: r.color || null,
                image: r.image || null,
                icon: r.icon || null,
                uri: r.uri || r.url || null,
                target: r.target || null,
                primaryAction: r.primaryAction || null,
                secondaryAction: r.secondaryAction || null,
                bind: r.bind || null,
                cells: r.cells || [],
                options: r.options || null,
                children: [],
                parent: parent,
                expanded: isExpanded
            };

            if (Array.isArray(r.children)) {
                row.children = r.children.map((child) => normalizeRow(child, row));
            }

            return row;
        };

        let newRows = (response.rows || []).map((r) => normalizeRow(r, null));

        if (newRows.length > pageSize) {
            newRows = newRows.slice(0, pageSize);
        }

        return newRows;
    }
};
