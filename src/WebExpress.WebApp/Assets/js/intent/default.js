/**
 * Default intent definitions for the WebExpress.WebUI intent registry.
 * Registers the generic, reusable intents that controls and binds compose with.
 * Domain specific intents, for example list search or tab add, are registered
 * by the controls that own them during their migration.
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
