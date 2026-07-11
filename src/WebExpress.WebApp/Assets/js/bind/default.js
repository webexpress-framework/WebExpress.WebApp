/**
 * The state oriented default binds of WebExpress.WebApp, part of the View,
 * State and Service architecture. They complete the existing declarative
 * binds of WebExpress.WebUI with the read direction of a controlled component
 * (the state bind) and the controlled input pattern (the model bind). Both
 * resolve a store and feed the same unidirectional loop that actions and
 * intents use. The store is the enclosing ViewState when the element binds a
 * resource, so a writing surface (a quickfilter, a search box, a form field)
 * writes into the shared state and triggers a central re-query exactly like a
 * control that renders the resource; otherwise it is the store of the Data
 * component the element belongs to. Both are a ViewState, so one uniform store
 * surface serves both.
 *
 * Markup contract:
 *   data-wx-bind="state"            - reflects a store path on the element
 *     data-wx-bind-store="id"       - id of the owning component (optional,
 *                                     default: the nearest ancestor component)
 *     data-wx-bind-path="a.b"       - the observed state path
 *     data-wx-bind-as="text|value|show|class" - the reflection (default text)
 *     data-wx-bind-class="cls"      - the class toggled when as="class"
 *
 *   data-wx-bind="model"            - two way binding for inputs
 *     data-wx-model="a.b"           - the bound state path
 *     data-wx-model-query="res"     - resource to re-query on write, so a write
 *                                     routes through the viewstate/query intent
 *                                     (a search or filter surface); without it a
 *                                     write is a plain state patch
 *     data-wx-resource="res"        - binds the enclosing ViewState as the store
 *     data-wx-bind-store="id"       - id of the owning component (optional)
 */
(function () {
    /**
     * Reads a dotted path from a state object.
     * @param {object} state - The state.
     * @param {string} path - The dotted path.
     * @returns {*} The value at the path, or undefined.
     */
    function readPath(state, path) {
        return String(path || "")
            .split(".")
            .filter((key) => key.length > 0)
            .reduce((current, key) => (current == null ? undefined : current[key]), state);
    }

    /**
     * Builds a shallow top level patch that sets a dotted path to a value.
     * Nested objects along the path are copied, so the patch stays compatible
     * with the shallow merge contract of the store.
     * @param {object} state - The current state.
     * @param {string} path - The dotted path.
     * @param {*} value - The new value.
     * @returns {object} The patch.
     */
    function buildPatch(state, path, value) {
        const keys = String(path || "").split(".").filter((key) => key.length > 0);

        if (keys.length === 0) {
            return {};
        }

        if (keys.length === 1) {
            return { [keys[0]]: value };
        }

        const root = Object.assign({}, state ? state[keys[0]] : null);
        let cursor = root;

        for (let i = 1; i < keys.length - 1; i++) {
            cursor[keys[i]] = Object.assign({}, cursor[keys[i]]);
            cursor = cursor[keys[i]];
        }

        cursor[keys[keys.length - 1]] = value;

        return { [keys[0]]: root };
    }

    /**
     * Returns the Data component that owns the given element, by walking up
     * the ancestors until an instance with a store is found.
     * @param {HTMLElement} element - The starting element.
     * @returns {object|null} The component or null.
     */
    function componentOf(element) {
        let current = element;

        while (current) {
            const instance = webexpress.webui.Controller.getInstanceByElement(current);
            if (instance && instance.store && typeof instance.setState === "function") {
                return instance;
            }
            current = current.parentElement;
        }

        return null;
    }

    /**
     * Resolves the store a bound element targets and invokes the callback once
     * it is available. The target is the enclosing ViewState when the element
     * binds a resource (data-wx-resource) or names a ViewState
     * (data-wx-viewstate), so a writing surface feeds the shared state and a
     * central re-query; otherwise it is the store of the Data component the
     * element belongs to, resolved by an explicit data-wx-bind-store id or by
     * the nearest ancestor. Either target is a ViewState, so the caller reads
     * and writes through one uniform surface. The store may not exist yet when
     * the bind runs, in which case resolution waits: for a ViewState through the
     * registry, for a component through the mount event every Data component
     * dispatches.
     * @param {HTMLElement} element - The bound element.
     * @param {Function} callback - Receives the resolved store.
     */
    function withStore(element, callback) {
        const explicitComponentId = element.getAttribute("data-wx-bind-store");
        const viewStateId = element.getAttribute("data-wx-viewstate");
        const resource = element.getAttribute("data-wx-resource");

        // a writing surface bound to a ViewState resource resolves that
        // ViewState, so the model write and the re-query land on the shared
        // state; an explicit component store id still wins, because it names a
        // component rather than the enclosing ViewState
        if (!explicitComponentId && (viewStateId || resource)) {
            webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, callback);
            return;
        }

        const resolve = () => {
            if (explicitComponentId) {
                const host = document.getElementById(explicitComponentId);
                const instance = host ? webexpress.webui.Controller.getInstanceByElement(host) : null;
                return instance && instance.store ? instance.store : null;
            }
            const component = componentOf(element);
            return component ? component.store : null;
        };

        const store = resolve();

        if (store) {
            callback(store);
            return;
        }

        const handler = () => {
            const resolved = resolve();
            if (resolved) {
                document.removeEventListener("webexpress.webapp.data.mount", handler);
                callback(resolved);
            }
        };

        document.addEventListener("webexpress.webapp.data.mount", handler);
    }

    /**
     * Registers a cleanup that the controller runs when the element is
     * removed from the document, so a bind subscription has a deterministic
     * owner and teardown.
     * @param {HTMLElement} element - The bound element.
     * @param {Function} cleanup - The cleanup function.
     */
    function onRemove(element, cleanup) {
        (element._wxCleanup = element._wxCleanup || []).push(cleanup);
    }

    // state bind - subscribes an element to a store path and reflects it as
    // text, as a value, as visibility or as a class (the read direction of a
    // controlled component)
    webexpress.webui.Binds.register("state", {
        bind(element) {
            const path = element.getAttribute("data-wx-bind-path") || "";

            if (!path) {
                console.warn("state bind without data-wx-bind-path", element);
                return;
            }

            withStore(element, (store) => {
                const as = element.getAttribute("data-wx-bind-as") || "text";
                const cls = element.getAttribute("data-wx-bind-class") || "";

                const apply = (value) => {
                    if (as === "value") {
                        const next = value == null ? "" : String(value);
                        if (element.value !== next) {
                            element.value = next;
                        }
                    } else if (as === "show") {
                        element.style.display = value ? "" : "none";
                    } else if (as === "class") {
                        if (cls) {
                            element.classList.toggle(cls, !!value);
                        }
                    } else {
                        element.textContent = value == null ? "" : String(value);
                    }
                };

                const unsubscribe = store.watch((state) => readPath(state, path), apply);
                apply(readPath(store.getState(), path));
                onRemove(element, unsubscribe);
            });
        }
    });

    // model bind - two way binding for inputs: an input event patches the
    // store path and a store change updates the input (the controlled input
    // pattern expressed declaratively)
    webexpress.webui.Binds.register("model", {
        bind(element) {
            const path = element.getAttribute("data-wx-model") || element.getAttribute("data-wx-bind-path") || "";

            if (!path) {
                console.warn("model bind without data-wx-model", element);
                return;
            }

            // when the element names a resource to re-query, a write is routed
            // through the viewstate/query intent so the shared state is patched
            // and the resource re-loads in one step (a search or filter surface);
            // without it a write is a plain state patch (a controlled input)
            const queryResource = element.getAttribute("data-wx-model-query");

            withStore(element, (store) => {
                const isCheckbox = element.type === "checkbox";
                const eventName = isCheckbox || element.tagName === "SELECT" ? "change" : "input";

                const write = (value) => {
                    if (isCheckbox) {
                        element.checked = !!value;
                        return;
                    }
                    const next = value == null ? "" : String(value);
                    if (document.activeElement !== element && element.value !== next) {
                        element.value = next;
                    }
                };

                const onInput = () => {
                    const value = isCheckbox ? !!element.checked : element.value;
                    const patch = buildPatch(store.getState(), path, value);
                    if (queryResource && typeof store.dispatch === "function") {
                        store.dispatch("viewstate/query", { resource: queryResource, patch: patch });
                    } else {
                        store.setState(patch);
                    }
                };

                element.addEventListener(eventName, onInput);

                const unsubscribe = store.watch((state) => readPath(state, path), write);
                write(readPath(store.getState(), path));

                onRemove(element, () => {
                    element.removeEventListener(eventName, onInput);
                    unsubscribe();
                });
            });
        }
    });
})();
