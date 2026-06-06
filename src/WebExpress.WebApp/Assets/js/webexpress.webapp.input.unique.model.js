var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the unique input control (View, State and Service
 * migration). The control performs a single bespoke uniqueness check (GET with
 * query parameters or POST with a json body) through the shared request, so it
 * keeps its own abort handling rather than a configured service. The model owns
 * the response interpretation and the request shaping that carry no DOM or
 * network dependency, so they can be unit tested in isolation.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.inputUniqueModel = {
    /**
     * Parses the data-headers attribute into a plain object of string to string
     * pairs, tolerating absent or invalid json and dropping non string values.
     * @param {string} headersJson - The raw data-headers attribute.
     * @returns {Object<string, string>} The parsed headers.
     */
    parseHeaders(headersJson) {
        if (!headersJson) {
            return {};
        }
        try {
            const obj = JSON.parse(headersJson);
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
                const out = {};
                for (const [k, v] of Object.entries(obj)) {
                    if (typeof k === "string" && typeof v === "string") {
                        out[k] = v;
                    }
                }
                return out;
            }
        } catch (e) {
            // ignore invalid json
        }
        return {};
    },

    /**
     * Builds the request body for a non GET uniqueness check.
     * @param {string} param - The configured value parameter name.
     * @param {string} value - The value being checked.
     * @returns {Object} The request body.
     */
    requestBody(param, value) {
        return { [param]: value };
    },

    /**
     * Extracts the availability flag from the API response, preferring the
     * configured response field and otherwise applying heuristics for common
     * status and code shapes. Returns true when available, false when taken and
     * null when the response is undecidable.
     * @param {*} data - The parsed API response.
     * @param {string} responseField - The configured availability field name.
     * @returns {boolean|null} The availability, or null when undecidable.
     */
    extractAvailability(data, responseField) {
        // prefer configured field if present
        if (data && Object.prototype.hasOwnProperty.call(data, responseField)) {
            const raw = data[responseField];
            if (typeof raw === "boolean") {
                return raw;
            }
            if (typeof raw === "string") {
                const s = raw.trim().toLowerCase();
                if (s === "true") {
                    return true;
                }
                if (s === "false") {
                    return false;
                }
            }
            if (typeof raw === "number") {
                if (raw === 1) {
                    return true;
                }
                if (raw === 0) {
                    return false;
                }
            }
        }

        // heuristics for common shapes
        if (data && typeof data === "object") {
            if (typeof data.status === "string") {
                const st = data.status.toLowerCase();
                if (st === "free" || st === "available") {
                    return true;
                }
                if (st === "taken" || st === "unavailable" || st === "exists" || st === "in_use") {
                    return false;
                }
            }
            if (typeof data.code === "string") {
                const cd = data.code.toLowerCase();
                if (cd === "available") {
                    return true;
                }
                if (cd === "unavailable") {
                    return false;
                }
            }
        }

        return null;
    }
};
