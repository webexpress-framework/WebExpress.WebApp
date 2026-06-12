var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST form control (phase two of the View, State
 * and Service migration). These functions carry no DOM dependency, so they can
 * be unit tested in isolation. They cover the request shaping, the response
 * classification and the server error normalisation. The control composes them
 * with a Store and a RestService.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.restFormModel = {
    /**
     * Builds the load url, which carries the optional id and the mode as query
     * parameters, matching the historical behaviour.
     * @param {string} api - The form endpoint.
     * @param {string|number|null} id - The optional record id.
     * @param {string} mode - The form mode (new, edit or delete).
     * @param {string} origin - The base origin used to resolve a relative endpoint.
     * @returns {string} The absolute load url.
     */
    buildLoadUrl(api, id, mode, origin) {
        const url = new URL(api, origin);
        if (id) {
            url.searchParams.append("id", String(id || ""));
        }
        url.searchParams.append("mode", mode);
        return url.toString();
    },

    /**
     * Builds the submit url and the fetch init from the options and the payload.
     * For GET, HEAD and DELETE the payload becomes query parameters (DELETE only
     * carries the id); for POST, PUT and PATCH the payload becomes a json or a
     * form encoded body, and the id is appended as a query parameter. This
     * reproduces the historical request shaping.
     * @param {string} endpoint - The submit endpoint.
     * @param {object} options - The form options (method, headers, credentials, json, id).
     * @param {object} payload - The form payload.
     * @param {string} origin - The base origin used to resolve a relative endpoint.
     * @returns {{url: string, init: object}} The request configuration.
     */
    buildRequest(endpoint, options, payload, origin) {
        options = options || {};
        payload = payload || {};

        const method = options.method;
        const init = {
            method: method,
            headers: Object.assign({}, options.headers || {}),
            credentials: options.credentials || "same-origin"
        };

        const urlObj = new URL(endpoint, origin);
        let requestUrl = endpoint;

        const appendParams = (target, data) => {
            for (const [k, v] of Object.entries(data)) {
                const values = Array.isArray(v) ? v : [v];
                values.forEach((val) => {
                    target.searchParams.append(k, val == null ? "" : String(val));
                });
            }
        };

        if (["GET", "HEAD", "DELETE"].includes(method)) {
            // remove content-type for these methods
            Object.keys(init.headers).forEach((h) => {
                if (h.toLowerCase() === "content-type") {
                    delete init.headers[h];
                }
            });

            if (method === "DELETE") {
                const idParam = options.id || payload.id || payload.Id;
                if (idParam) {
                    urlObj.searchParams.append("id", String(idParam));
                }
            } else {
                appendParams(urlObj, payload);
            }
            requestUrl = urlObj.toString();
        } else {
            // post/put/patch
            if (options.json) {
                init.body = JSON.stringify(payload);
                if (!Object.keys(init.headers).some((k) => k.toLowerCase() === "content-type")) {
                    init.headers["Content-Type"] = "application/json; charset=utf-8";
                }
            } else {
                const params = new URLSearchParams();
                for (const [k, v] of Object.entries(payload)) {
                    const values = Array.isArray(v) ? v : [v];
                    values.forEach((val) => {
                        params.append(k, val == null ? "" : String(val));
                    });
                }
                init.body = params.toString();
                if (!Object.keys(init.headers).some((k) => k.toLowerCase() === "content-type")) {
                    init.headers["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8";
                }
            }

            if (options.id && !urlObj.searchParams.has("id")) {
                urlObj.searchParams.append("id", String(options.id));
                requestUrl = urlObj.toString();
            }
        }

        return { url: requestUrl, init: init };
    },

    /**
     * Classifies a normalised service result into a success, a validation or a
     * system error outcome, and extracts the confirmation and closing hints on
     * success. This reproduces the historical response handling without touching
     * the DOM or performing input or output.
     * @param {boolean} ok - Whether the request succeeded.
     * @param {number} status - The http status.
     * @param {object} data - The parsed response body.
     * @returns {object} The classification.
     */
    classifyResponse(ok, status, data) {
        if (ok) {
            const dataBlock = (data && data.data) ? data.data : data;
            const confirmHtml = (dataBlock && dataBlock.confirmHtml) || (data && data.confirmHtml) || null;
            const message = (dataBlock && dataBlock.message) || (data && (data.confirmMessage || data.message)) || null;
            const closeModal = !!(data && (!data.message || data.hideForm === true));
            return { kind: "success", confirmHtml: confirmHtml, message: message, closeModal: closeModal };
        }

        if (status === 400) {
            if (Array.isArray(data)) {
                return { kind: "validation", errors: this.normalizeArrayErrors(data), message: null };
            }
            if (data && data.errors) {
                return { kind: "validation", errors: this.normalizeFieldErrors(data.errors), message: null };
            }
            return { kind: "validation", errors: [], message: (data && (data.message || data.error)) || null };
        }

        return { kind: "error", status: status };
    },

    /**
     * Normalises a field error map into a list of field and message pairs.
     * @param {object} errors - A map of field name to message.
     * @returns {Array<{field: string, message: string}>} The normalised errors.
     */
    normalizeFieldErrors(errors) {
        if (!errors || typeof errors !== "object") {
            return [];
        }
        return Object.entries(errors).map(([name, msg]) => ({ field: name, message: msg }));
    },

    /**
     * Normalises an error array into a list of field and message pairs, reading
     * the message and the field from the several casings the server may use.
     * @param {Array} errorsArray - The error array.
     * @returns {Array<{field: (string|null), message: string}>} The normalised errors.
     */
    normalizeArrayErrors(errorsArray) {
        if (!Array.isArray(errorsArray)) {
            return [];
        }

        const out = [];
        for (const err of errorsArray) {
            if (!err) {
                continue;
            }
            const msg = err.message || err.msg || err.Message || JSON.stringify(err);
            const field = err.field || err.Field || null;
            out.push({ field: field, message: msg });
        }
        return out;
    }
};
