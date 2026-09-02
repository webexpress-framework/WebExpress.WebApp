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
 *
 *   data-wx-bind="search"           - drives a data component from a search box
 *     data-wx-source-search="#id"   - the search box whose term is applied
 *
 *   data-wx-bind="paging"           - drives a data component from a pager
 *     data-wx-source-paging="#id"   - the pager whose page is applied
 *
 *   data-wx-bind="filter"           - drives a data component from the
 *                                     quickfilter bar; the filter registry owns
 *                                     the selection and announces it globally,
 *                                     so no source selector is needed
 *
 *   data-wx-bind="upload"           - shows what an upload control uploaded
 *     data-wx-source-upload="#id"   - the upload control to follow
 *
 * The source binds are declared on the data component (the reader), not on
 * the surface that produces the value, which is why they carry a selector rather
 * than a store path: the component subscribes to the control named by the
 * selector and translates its event into its own dispatch surface. That keeps a
 * search box or a pager reusable for any reader and free of knowledge about who
 * listens.
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

    /**
     * Resolves the reader a source bind drives: the control the bind is declared
     * on, or else the Data component that control sits in.
     * @remarks
     * A reader is whatever answers the dispatch surface the bind speaks, and
     * that is not necessarily a Data component. The paged data controls (table,
     * list, tile) own their query state and their intent dispatch while
     * extending the WebUI control base rather than webexpress.webapp.Data, so
     * they expose neither a store nor a setState and never announce a mount - a
     * resolution insisting on those finds nothing for them and the bind stays
     * silent forever. The element's own instance is therefore accepted for the
     * methods it exposes, and only a bind declared on something that is not
     * itself a reader climbs to the enclosing Data component.
     * @param {HTMLElement} element - The bound element.
     * @param {Array<string>} methods - The method names the bind may call.
     * @returns {object|null} The reader, or null while none exists.
     */
    function readerOf(element, methods) {
        const speaks = (candidate) => !!candidate && methods.some((name) => typeof candidate[name] === "function");
        const own = webexpress.webui.Controller.getInstanceByElement(element);

        if (speaks(own)) {
            return own;
        }

        const enclosing = componentOf(element);

        return speaks(enclosing) ? enclosing : (own || enclosing);
    }

    /**
     * Subscribes a reader to one event of the surface a source bind names, and
     * forwards it to the reader.
     * @remarks
     * The listener sits on the document and resolves both the named surface and
     * the reader when the event arrives rather than when the bind runs.
     * Document order decides whether a search box above a list or a pager below
     * it exists yet, and the controller constructs the reader's own instance
     * after the bind has run; resolving late removes both ordering questions -
     * by the time an event is dispatched, everything it concerns is
     * constructed.
     * @param {HTMLElement} element - The bound data control.
     * @param {string} name - The bind name, which also names the source attribute.
     * @param {string} eventName - The event the surface dispatches.
     * @param {Array<string>} methods - The method names the bind may call.
     * @param {Function} apply - Receives the reader and the event detail.
     */
    function forward(element, name, eventName, methods, apply) {
        const selector = element.getAttribute("data-wx-source-" + name);

        if (!selector) {
            console.warn(name + " bind without data-wx-source-" + name, element);
            return;
        }

        const handler = (event) => {
            const sender = event.detail && event.detail.sender;

            // the events bubble, so the sender is matched against the named
            // surface; without it any search box on the page would drive
            // every list on it
            if (!sender || sender !== document.querySelector(selector)) {
                return;
            }

            const reader = readerOf(element, methods);

            if (!reader) {
                return;
            }

            apply(reader, event.detail);
        };

        document.addEventListener(eventName, handler);
        onRemove(element, () => document.removeEventListener(eventName, handler));
    }

    // search bind - applies the term of a search box to the data component that
    // renders the result. The component owns what a search means (it dispatches
    // its own search intent and re-queries), the bind only carries the term
    webexpress.webui.Binds.register("search", {
        bind(element) {
            forward(element, "search", webexpress.webui.Event.CHANGE_FILTER_EVENT, ["search"], (component, detail) => {
                if (typeof component.search !== "function") {
                    console.warn("search bind on a component without a search method", element);
                    return;
                }

                component.search(detail.value == null ? "" : String(detail.value), detail.searchType || "basic");
            });
        }
    });

    // paging bind - applies the page a pager was moved to. The reverse direction
    // (the component reporting its page count back to the pager) is owned by the
    // component, which knows the total only once a response has arrived.
    // paging() is the method name of the data control families and therefore the
    // contract; page() is accepted as well, because a component that keeps its
    // page under that name answers the same request
    webexpress.webui.Binds.register("paging", {
        bind(element) {
            forward(element, "paging", webexpress.webui.Event.CHANGE_PAGE_EVENT, ["paging", "page"], (component, detail) => {
                const apply = typeof component.paging === "function"
                    ? component.paging
                    : (typeof component.page === "function" ? component.page : null);

                if (!apply) {
                    console.warn("paging bind on a component without a paging method", element);
                    return;
                }

                apply.call(component, Number(detail.page) || 0);
            });
        }
    });

    // upload bind - shows a file the named upload control just finished
    // uploading in the data component that lists the files, so the user sees the
    // result of an upload without reloading the page. The component owns what a
    // new file means (it shows it and re-queries), the bind only carries the file
    webexpress.webui.Binds.register("upload", {
        bind(element) {
            const selector = element.getAttribute("data-wx-source-upload");

            if (!selector) {
                console.warn("upload bind without data-wx-source-upload", element);
                return;
            }

            const handler = (event) => {
                if (!isUpload(event, selector)) {
                    return;
                }

                const component = readerOf(element, ["uploaded"]);

                if (!component) {
                    return;
                }

                if (typeof component.uploaded !== "function") {
                    console.warn("upload bind on a component without an uploaded method", element);
                    return;
                }

                component.uploaded(event.detail.file);
            };

            document.addEventListener(webexpress.webui.Event.UPLOAD_SUCCESS_EVENT, handler);
            onRemove(element, () => document.removeEventListener(webexpress.webui.Event.UPLOAD_SUCCESS_EVENT, handler));
        }
    });

    /**
     * Tells whether an upload event came from the upload control a selector
     * names.
     * @remarks
     * The upload control moves the id of its host onto the hidden file input it
     * builds, so that the input is what a label and a form refer to. A selector
     * naming the control therefore resolves to that input once the control is
     * mounted, while the event reports the host as its sender - which is why the
     * host containing the resolved element counts as a match and a plain
     * identity check, as the other source binds use, would never match.
     * @param {Event} event - The upload event.
     * @param {string} selector - The selector naming the upload control.
     * @returns {boolean} True when the event came from that control.
     */
    function isUpload(event, selector) {
        const sender = event.detail && event.detail.sender;
        const named = document.querySelector(selector);

        if (!sender || !named) {
            return false;
        }

        return sender === named || (typeof sender.contains === "function" && sender.contains(named));
    }

    // filter bind - applies the quickfilter selection to the data control that
    // renders the result.
    //
    // The filter registry owns the selection and announces it on the document
    // without a sender, which is what tells its event apart from the search
    // box's: only the registry's carries the active filter list. A control bound
    // to a ViewState resource is driven by the quickfilter through the shared
    // state instead - the quickfilter writes the selection there and re-queries
    // centrally - so it is deliberately left alone here and does not query twice
    webexpress.webui.Binds.register("filter", {
        bind(element) {
            if (element.getAttribute("data-wx-resource") || element.getAttribute("data-wx-model-query")) {
                return;
            }

            const handler = (event) => {
                const filters = event.detail && event.detail.activeFilters;

                if (!Array.isArray(filters)) {
                    return;
                }

                const component = readerOf(element, ["filter"]);

                if (!component) {
                    return;
                }

                if (typeof component.filter !== "function") {
                    console.warn("filter bind on a component without a filter method", element);
                    return;
                }

                component.filter(filters.join(","));
            };

            document.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, handler);
            onRemove(element, () => document.removeEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, handler));
        }
    });
})();
