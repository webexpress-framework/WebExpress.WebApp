var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST file view control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService:
 * the load is fetched through the shared request, the response is mapped into
 * the file shape the file list and the tile board both render, and a description
 * change is turned into the update payload.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.fileViewModel = {
    /**
     * The presentations the control offers out of the box. The label key and
     * the glyph live here rather than on the server, so both presentations stay
     * described in one place.
     */
    presentations: {
        list: { icon: "list", label: "webexpress.webapp:fileview.list", fallback: "List" },
        tile: { icon: "grid", label: "webexpress.webapp:fileview.tile", fallback: "Tiles" }
    },

    /**
     * Builds the logical query parameters from the current state. The search,
     * wql and filter parameters are always included, mirroring the other data
     * query controls, so an endpoint sees the same request shape whichever
     * control asked.
     * @param {object} state - The file view state.
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
     * Maps the response items to the file shape the file list and the tile
     * board render. The size and the date arrive as display strings, because
     * only the server knows the culture the page is rendered in.
     * @param {object} response - The raw response containing items.
     * @returns {Array<object>} The mapped files.
     */
    mapFiles(response) {
        const items = (response && Array.isArray(response.items)) ? response.items : [];

        return items.map((item) => ({
            id: item.id || null,
            version: Number(item.version) || 0,
            name: item.name || item.title || "",
            uri: item.uri || "#",
            icon: item.icon || null,
            image: item.image || null,
            size: item.size || null,
            date: item.date || null,
            description: item.description || null
        }));
    },

    /**
     * Folds the files that share a name into one entry per name: the newest
     * version becomes the entry, the earlier ones travel behind it in a versions
     * array that the presentations fold open on demand.
     * @remarks
     * Uploading a file again is a new version of it, not a second file, so a
     * repeated name has to read as one entry. The grouping happens here rather
     * than on the server because both presentations render from the same list
     * and would otherwise each have to fold it themselves.
     * @param {Array<object>} files - The files, newest and earlier versions mixed.
     * @returns {Array<object>} One entry per name, each carrying its earlier versions.
     */
    groupVersions(files) {
        const list = Array.isArray(files) ? files : [];
        const groups = new Map();

        for (const file of list) {
            const group = groups.get(file.name);

            if (group) {
                group.push(file);
            } else {
                groups.set(file.name, [file]);
            }
        }

        return Array.from(groups.values()).map((group) => {
            const sorted = group.slice().sort((a, b) => (b.version || 0) - (a.version || 0));

            return Object.assign({}, sorted[0], { versions: sorted.slice(1) });
        });
    },

    /**
     * Adds an uploaded file to the files on screen. A file whose name is already
     * there becomes the newest version of that entry, pushing what was shown
     * into its earlier versions; a name nobody has seen becomes a new entry.
     * @param {Array<object>} files - The files currently on screen.
     * @param {object} entry - The optimistic entry of the uploaded file.
     * @returns {Array<object>} The files to show.
     */
    addUpload(files, entry) {
        const list = Array.isArray(files) ? files : [];

        if (!entry) {
            return list;
        }

        const current = list.find((file) => file.name === entry.name);

        if (!current) {
            return list.concat([Object.assign({ versions: [] }, entry)]);
        }

        // the version number is a guess until the reload answers, and it only has
        // to sort above the versions already on screen
        const previous = Object.assign({}, current);
        const earlier = previous.versions || [];
        delete previous.versions;

        const head = Object.assign({}, entry, {
            version: (current.version || 0) + 1,
            description: current.description,
            versions: [previous].concat(earlier)
        });

        return list.map((file) => (file === current ? head : file));
    },

    /**
     * Determines the total record count, preferring an explicit total from the
     * response and otherwise inferring it from the page, the page size and the
     * number of received rows.
     * @param {object} response - The raw response.
     * @param {number} receivedItems - The number of rows on this page.
     * @param {number} page - The zero based page index.
     * @param {number} pageSize - The page size.
     * @returns {number} The total record count.
     */
    reduceTotal(response, receivedItems, page, pageSize) {
        const total = response ? (response.total ?? null) : null;

        if (total !== null && total !== undefined) {
            return Number(total) || 0;
        }

        return (page * pageSize) + receivedItems;
    },

    /**
     * Builds the entry shown for a file that has just been uploaded, before the
     * reload replaced it with the server's own record. Only the name and the
     * size are known at that point; the uri stays empty because the file has no
     * address on the server that this client could guess.
     * @param {File} file - The uploaded file.
     * @returns {object|null} The optimistic entry, or null without a file.
     */
    fromUpload(file) {
        if (!file || !file.name) {
            return null;
        }

        return {
            id: null,
            version: 0,
            name: file.name,
            uri: "#",
            icon: null,
            image: null,
            size: this.formatSize(file.size),
            date: null,
            description: null,
            pending: true
        };
    },

    /**
     * Formats a byte count the way the server formats it, so an optimistic
     * entry does not visibly change its unit once the reload replaced it.
     * @param {number} bytes - The byte count.
     * @returns {string|null} The formatted size, or null when unknown.
     */
    formatSize(bytes) {
        const size = Number(bytes);

        if (!Number.isFinite(size) || size < 0) {
            return null;
        }

        const units = [
            { limit: 1024 * 1024 * 1024, suffix: "GB" },
            { limit: 1024 * 1024, suffix: "MB" },
            { limit: 1024, suffix: "kB" }
        ];

        for (const unit of units) {
            if (size > unit.limit) {
                return `${(size / unit.limit).toFixed(1)} ${unit.suffix}`;
            }
        }

        return `${size.toFixed(1)}  B`;
    },

    /**
     * Merges the files a load returned into the files on screen, keeping an
     * optimistic upload entry that the response does not cover yet.
     * @remarks
     * An upload is announced by the browser and reloaded from the server in the
     * same breath, and an endpoint that indexes asynchronously may answer that
     * reload before it knows the new file. Dropping the optimistic entry then
     * makes the file the user just uploaded disappear again; keeping it until a
     * response carries the same name makes the view settle either way.
     * @param {Array<object>} loaded - The files the response carried.
     * @param {Array<object>} shown - The files currently on screen.
     * @returns {Array<object>} The files to show.
     */
    mergePending(loaded, shown) {
        const files = Array.isArray(loaded) ? loaded : [];
        const previous = Array.isArray(shown) ? shown : [];
        const names = new Set(files.map((file) => file.name));

        return files.concat(previous.filter((file) => file.pending && !names.has(file.name)));
    },

    /**
     * Builds the payload of a description change.
     * @param {object} file - The file whose description changed.
     * @param {string} description - The new description.
     * @returns {object} The update payload.
     */
    describePayload(file, description) {
        return {
            id: file ? file.id : null,
            description: description == null ? "" : String(description)
        };
    }
};
