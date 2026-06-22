/**
 * Default intent definitions for the intent registry.
 * Registers the generic, reusable intents that controls and binds compose
 * with, plus the query intents of the data query control families: the list,
 * the table and the tile share the query state contract (search, wql, filter,
 * page) and the load surface, so one definition serves all three domains and
 * each family keeps its own domain name per the naming convention. Domain
 * specific intents that belong to a single control, for example tab add, are
 * registered by the control that owns them.
 *
 * An intent definition has an optional reduce, which is a pure state transition
 * that returns a patch, and an optional effect, which performs input or output.
 */

// wx/patch - applies the payload as a shallow patch to the store. This is the
// generic state setter used by the model bind and by simple actions.
webexpress.webapp.Intents.register("wx/patch", {
    reduce(state, payload) {
        return (payload && typeof payload === "object") ? payload : null;
    }
});

// wx/set - sets a single key to a value. The payload is { key, value }. This is
// a convenience for declarative bindings that carry a single field.
webexpress.webapp.Intents.register("wx/set", {
    reduce(state, payload) {
        if (!payload || typeof payload.key !== "string") {
            return null;
        }
        const patch = {};
        patch[payload.key] = payload.value;
        return patch;
    }
});

// the query intents of the data query control families (list, table, tile).
// each reducer is a pure state transition and each effect triggers the load
// through the dispatching component, so a test can dispatch an intent and
// assert the resulting state without involving the network.
(function () {
    const loadEffect = (context) => (
        typeof context.component?.load === "function" ? context.component.load() : undefined
    );

    for (const domain of ["list", "table", "tile"]) {
        // <domain>/search - sets the search or wql pattern, resets the page and loads
        webexpress.webapp.Intents.register(domain + "/search", {
            reduce(state, payload) {
                const searchType = payload && payload.searchType != null ? payload.searchType : "basic";
                const pattern = payload && payload.pattern != null ? payload.pattern : "";
                return {
                    search: searchType === "basic" ? pattern : null,
                    wql: searchType === "wql" ? pattern : null,
                    page: 0
                };
            },
            effect: loadEffect
        });

        // <domain>/filter - sets the filter, resets the page and loads
        webexpress.webapp.Intents.register(domain + "/filter", {
            reduce(state, payload) {
                return {
                    filter: payload && payload.pattern != null ? payload.pattern : "",
                    page: 0
                };
            },
            effect: loadEffect
        });

        // <domain>/page - sets the page and loads
        webexpress.webapp.Intents.register(domain + "/page", {
            reduce(state, payload) {
                return { page: payload && payload.page != null ? Number(payload.page) || 0 : 0 };
            },
            effect: loadEffect
        });
    }
})();
