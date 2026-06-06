var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST input selection control (View, State and
 * Service migration). The control performs a debounced, abortable search
 * through the shared request, so it keeps its own abort handling. The model
 * owns the request shaping (url and init) and the response mapping, which carry
 * no DOM or network dependency and can be unit tested in isolation.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.inputSelectionModel = {
    /**
     * Builds the request url. For GET it appends the query and page parameters
     * with the correct separator and encoding; for other methods the endpoint is
     * returned unchanged (the term travels in the body).
     * @param {object} config - The endpoint configuration.
     * @param {string} term - The search term.
     * @returns {string} The request url.
     */
    buildUrl(config, term) {
        if (config.httpMethod !== "GET") {
            return config.apiEndpoint;
        }
        const hasQuery = config.apiEndpoint.includes("?");
        const sep = hasQuery ? "&" : "?";
        const qp = `${encodeURIComponent(config.queryParam)}=${encodeURIComponent(term)}`;
        const pp = `${encodeURIComponent(config.pageParam)}=${encodeURIComponent(config.page)}`;
        return `${config.apiEndpoint}${sep}${qp}&${pp}`;
    },

    /**
     * Builds the fetch init. A POST carries the term and page in a json body, a
     * GET only carries the abort signal and the accept header.
     * @param {object} config - The endpoint configuration.
     * @param {string} term - The search term.
     * @param {AbortSignal} signal - The abort signal.
     * @returns {object} The fetch init.
     */
    buildRequestInit(config, term, signal) {
        const headers = { "Accept": "application/json" };
        if (config.httpMethod === "POST") {
            headers["Content-Type"] = "application/json";
            return {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    [config.queryParam]: term,
                    [config.pageParam]: config.page
                }),
                signal: signal
            };
        }
        return {
            method: "GET",
            headers: headers,
            signal: signal
        };
    },

    /**
     * Maps a raw API item to the internal input selection item format, choosing
     * field aliases defensively and turning the data and aria objects into
     * prefixed attribute tuples.
     * @param {object} apiItem - The raw item from the API.
     * @returns {object} A normalized input selection item.
     */
    mapApiItem(apiItem) {
        const id = apiItem.id || null;
        const uri = apiItem.uri || apiItem.url || "javascript:void(0);";
        const content = apiItem.content || apiItem.name || apiItem.text || apiItem.title || "";
        const icon = apiItem.icon || null;
        const image = apiItem.image || apiItem.img || null;
        const color = apiItem.color || null;
        const disabled = Boolean(apiItem.disabled);
        const role = apiItem.role || null;

        // transform data/aria objects into prefixed attribute tuples
        const dataTuples = [];
        if (apiItem.data && typeof apiItem.data === "object") {
            Object.keys(apiItem.data).forEach((k) => {
                const key = k.startsWith("data-") ? k : "data-" + k;
                dataTuples.push([key, String(apiItem.data[k])]);
            });
        }

        const ariaTuples = [];
        if (apiItem.aria && typeof apiItem.aria === "object") {
            Object.keys(apiItem.aria).forEach((k) => {
                const key = k.startsWith("aria-") ? k : "aria-" + k;
                ariaTuples.push([key, String(apiItem.aria[k])]);
            });
        }

        return {
            id: id,
            value: id,
            label: content,
            content: content,
            uri: uri,
            image: image,
            icon: icon,
            color: color,
            disabled: disabled,
            data: dataTuples,
            aria: ariaTuples,
            role: role,

            // action attributes mapping
            primaryAction: apiItem.primaryAction || null,
            primaryTarget: apiItem.primaryTarget || null,
            primaryUri: apiItem.primaryUri || null,
            secondaryAction: apiItem.secondaryAction || null,
            secondaryTarget: apiItem.secondaryTarget || null,
            secondaryUri: apiItem.secondaryUri || null
        };
    }
};
