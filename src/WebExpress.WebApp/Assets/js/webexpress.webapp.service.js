var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Helpers that build the normalised result shape used by every service
 * operation. A result is { ok, data, error, status }, where error is null on
 * success and { kind, status, message, retriable } on failure.
 */
webexpress.webapp.ServiceResult = {
    /**
     * Builds a successful result.
     * @param {*} data - The payload.
     * @param {number} [status=200] - The http status.
     * @returns {object} The normalised success result.
     */
    ok(data, status = 200) {
        return { ok: true, data: data, error: null, status: status };
    },

    /**
     * Builds a failed result.
     * @param {string} kind - One of "network", "http", "parse", "abort", "validation".
     * @param {number} [status=0] - The http status when applicable.
     * @param {string} [message=""] - A human readable message.
     * @param {boolean} [retriable=false] - Whether retrying may succeed.
     * @returns {object} The normalised failure result.
     */
    fail(kind, status = 0, message = "", retriable = false) {
        return {
            ok: false,
            data: null,
            error: { kind: kind, status: status, message: message, retriable: retriable },
            status: status
        };
    }
};

/**
 * Base class for services. It holds the descriptor configuration and provides
 * a no operation abort. Concrete services implement the operations they
 * support and call into the network.
 */
webexpress.webapp.Service = class {
    /**
     * Creates a service from a descriptor.
     * @param {object} [descriptor={}] - The service descriptor.
     */
    constructor(descriptor = {}) {
        this._descriptor = descriptor || {};
        this._name = this._descriptor.name || null;
    }

    /**
     * Returns the service name.
     * @returns {string|null} The name.
     */
    get name() {
        return this._name;
    }

    /**
     * Returns the base address the service calls, from its descriptor. Controls
     * derive their data uri from this instead of the legacy data-uri attribute.
     * @returns {string} The base address, or an empty string.
     */
    get baseUri() {
        return this._descriptor.baseUri || "";
    }

    /**
     * Aborts any request that is in flight. The base implementation does
     * nothing.
     */
    abort() {
    }
};

/**
 * The default REST service. It maps logical parameters to wire parameters,
 * builds a url against the document base, performs the request with fetch,
 * cancels a superseded query through an AbortController and normalises both
 * success and failure.
 *
 * Descriptor shape:
 *   {
 *     name: "data",
 *     kind: "rest",
 *     baseUri: "/api/orders",
 *     method: "GET",
 *     updateMethod: "PUT",
 *     query: { search: "q", page: "p", pageSize: "l" },
 *     response: { items: "items", total: "total" },
 *     headers: { ... },
 *     errors: { "404": "webexpress.webapp:error.notfound" }
 *   }
 */
webexpress.webapp.RestService = class extends webexpress.webapp.Service {
    /**
     * Creates a REST service from a descriptor.
     * @param {object} descriptor - The service descriptor.
     */
    constructor(descriptor) {
        super(descriptor);
        this._abort = null;
    }

    /**
     * Aborts the query that is currently in flight, if any.
     */
    abort() {
        if (this._abort) {
            this._abort.abort("aborted");
            this._abort = null;
        }
    }

    /**
     * Loads data with a GET request. Alias of query with a load semantic.
     * @param {object} [params={}] - Logical query parameters.
     * @param {object} [options={}] - Request options such as path.
     * @returns {Promise<object>} A normalised result.
     */
    load(params = {}, options = {}) {
        return this.query(params, options);
    }

    /**
     * Queries data with a GET request. A new query aborts the previous one.
     * @param {object} [params={}] - Logical query parameters.
     * @param {object} [options={}] - Request options such as path.
     * @returns {Promise<object>} A normalised result.
     */
    query(params = {}, options = {}) {
        return this._send(this._descriptor.method || "GET", {
            params: params,
            path: options.path,
            abortable: true
        });
    }

    /**
     * Creates a resource with a POST request.
     * @param {*} body - The request body, serialised as JSON.
     * @param {object} [options={}] - Request options such as path and params.
     * @returns {Promise<object>} A normalised result.
     */
    create(body, options = {}) {
        return this._send("POST", {
            params: options.params,
            path: options.path,
            body: body,
            abortable: false
        });
    }

    /**
     * Updates a resource with a PUT or PATCH request.
     * @param {*} body - The request body, serialised as JSON.
     * @param {object} [options={}] - Request options such as path, params and method.
     * @returns {Promise<object>} A normalised result.
     */
    update(body, options = {}) {
        return this._send(options.method || this._descriptor.updateMethod || "PUT", {
            params: options.params,
            path: options.path,
            body: body,
            abortable: false
        });
    }

    /**
     * Removes a resource with a DELETE request.
     * @param {object} [options={}] - Request options such as path and params.
     * @returns {Promise<object>} A normalised result.
     */
    remove(options = {}) {
        return this._send("DELETE", {
            params: options.params,
            path: options.path,
            abortable: false
        });
    }

    /**
     * Performs an arbitrary request with a caller supplied url and fetch init,
     * and normalises the outcome. The response body is parsed by content type,
     * as json when the content type is application/json and as { text }
     * otherwise. The parsed body is returned on both success and failure, so a
     * control can inspect a validation response. This lets controls with a
     * bespoke request shape, for example forms, route their network access
     * through the service layer. The result also carries the raw response and
     * the content type.
     * @param {string} url - The request url.
     * @param {object} [init={}] - The fetch init, used as provided.
     * @returns {Promise<object>} A normalised result with response and contentType.
     */
    async request(url, init = {}) {
        try {
            const response = await fetch(url, init);
            const contentType = (response.headers && typeof response.headers.get === "function"
                ? response.headers.get("content-type")
                : "") || "";

            let data = null;
            if (response.status !== 204) {
                if (contentType.includes("application/json")) {
                    try { data = await response.json(); } catch (parseError) { data = null; }
                } else {
                    try { data = { text: await response.text() }; } catch (parseError) { data = null; }
                }
            }

            if (!response.ok) {
                const mapped = this._descriptor.errors && this._descriptor.errors[String(response.status)];
                const message = mapped || ("request failed with status " + response.status);
                return {
                    ok: false,
                    data: data,
                    error: { kind: "http", status: response.status, message: message, retriable: response.status >= 500 },
                    status: response.status,
                    response: response,
                    contentType: contentType
                };
            }

            return { ok: true, data: data, error: null, status: response.status, response: response, contentType: contentType };
        } catch (networkError) {
            const kind = (networkError && networkError.name === "AbortError") ? "abort" : "network";
            const result = webexpress.webapp.ServiceResult.fail(kind, 0, networkError ? networkError.message : "network error", kind === "network");
            result.response = null;
            result.contentType = "";
            return result;
        }
    }

    /**
     * Projects a raw response into the configured shape, returning the items
     * and the total when a response mapping is present in the descriptor.
     * @param {object} data - The raw response payload.
     * @returns {object} An object with items and total.
     */
    project(data) {
        const map = this._descriptor.response || {};
        const itemsKey = map.items || "items";
        const totalKey = map.total || "total";
        const items = data && Array.isArray(data[itemsKey]) ? data[itemsKey] : [];
        const total = data && data[totalKey] != null ? Number(data[totalKey]) : items.length;

        return { items: items, total: total };
    }

    /**
     * Builds the request url from the base uri and the mapped query parameters.
     * @param {object} params - Logical query parameters.
     * @param {string} [path] - An optional path segment appended to the base.
     * @returns {string} The request url, absolute or root relative.
     */
    _buildUrl(params, path) {
        const base = (this._descriptor.baseUri || "") + (path ? path : "");
        const url = new URL(base, document.baseURI);
        const map = this._descriptor.query || {};

        for (const logical of Object.keys(params || {})) {
            const value = params[logical];
            if (value === undefined || value === null) {
                continue;
            }
            const wire = map[logical] || logical;
            url.searchParams.set(wire, String(value));
        }

        return base.startsWith("http") ? url.href : url.pathname + url.search;
    }

    /**
     * Performs a request and normalises the outcome. A superseded abortable
     * request is cancelled, and the abort channel is only cleared when the
     * request that owns it completes, so that a newer request is not affected.
     * @param {string} method - The http method.
     * @param {object} request - The request descriptor.
     * @returns {Promise<object>} A normalised result.
     */
    async _send(method, request) {
        let abort = null;

        if (request.abortable) {
            if (this._abort) {
                this._abort.abort("replaced");
            }
            abort = new AbortController();
            this._abort = abort;
        }

        const url = this._buildUrl(request.params, request.path);
        const headers = Object.assign({ "Accept": "application/json" }, this._descriptor.headers || {});
        const init = { method: method, headers: headers };

        if (request.body !== undefined) {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(request.body);
        }

        if (abort) {
            init.signal = abort.signal;
        }

        try {
            const response = await fetch(url, init);

            if (!response.ok) {
                const mapped = this._descriptor.errors && this._descriptor.errors[String(response.status)];
                const message = mapped || ("request failed with status " + response.status);
                return webexpress.webapp.ServiceResult.fail("http", response.status, message, response.status >= 500);
            }

            if (response.status === 204 || method === "DELETE") {
                return webexpress.webapp.ServiceResult.ok(null, response.status);
            }

            try {
                const data = await response.json();
                return webexpress.webapp.ServiceResult.ok(data, response.status);
            } catch (parseError) {
                return webexpress.webapp.ServiceResult.fail("parse", response.status, "response was not valid json", false);
            }
        } catch (networkError) {
            if (networkError && networkError.name === "AbortError") {
                return webexpress.webapp.ServiceResult.fail("abort", 0, "request was aborted", false);
            }
            return webexpress.webapp.ServiceResult.fail("network", 0, networkError ? networkError.message : "network error", true);
        } finally {
            if (abort && this._abort === abort) {
                this._abort = null;
            }
        }
    }
};

/**
 * Registry of service factories keyed by descriptor kind. The default kind is
 * "rest". A descriptor is turned into a configured service through create, and
 * a host element's data-wx-service island is turned into a map of named
 * services through fromElement.
 */
webexpress.webapp.ServiceRegistry = new class {
    /**
     * Creates the registry.
     */
    constructor() {
        this._factories = new Map();
        this._shared = null;
    }

    /**
     * Registers a factory for a descriptor kind.
     * @param {string} kind - The descriptor kind, for example "rest".
     * @param {Function} factory - Receives a descriptor and returns a service.
     * @returns {this} The registry for chaining.
     */
    register(kind, factory) {
        if (typeof kind === "string" && typeof factory === "function") {
            this._factories.set(kind, factory);
        }
        return this;
    }

    /**
     * Returns whether a factory exists for the given kind.
     * @param {string} kind - The descriptor kind.
     * @returns {boolean} True when registered.
     */
    has(kind) {
        return this._factories.has(kind);
    }

    /**
     * Creates a configured service from a descriptor.
     * @param {object} descriptor - The service descriptor.
     * @returns {webexpress.webapp.Service|null} The service or null.
     */
    create(descriptor) {
        if (!descriptor || typeof descriptor !== "object") {
            return null;
        }

        const kind = descriptor.kind || "rest";
        const factory = this._factories.get(kind);

        if (!factory) {
            console.warn(`Service kind "${kind}" is not registered.`);
            return null;
        }

        return factory(descriptor);
    }

    /**
     * Performs a single arbitrary request through a shared rest service, so that
     * one off calls (for example a bespoke autocomplete, theme or validator
     * endpoint) route through the service layer without the caller configuring a
     * dedicated service. The shared service is created lazily on first use and
     * reused afterwards. The url is taken as given, so callers pass an absolute
     * or already resolved path. Returns the same normalised result as
     * RestService.request.
     * @param {string} url - The request url.
     * @param {object} [init={}] - The fetch init, for example method and body.
     * @returns {Promise<object>} A normalised result.
     */
    request(url, init) {
        if (!this._shared) {
            this._shared = this.create({ kind: "rest", name: "shared", baseUri: "" });
        }

        return this._shared.request(url, init);
    }

    /**
     * Reads the data-wx-service island of a host element and returns a map of
     * named services. The island is a json object or an array of descriptors,
     * each of which carries a name.
     * @param {HTMLElement} element - The host element.
     * @returns {object} A map of service name to service instance.
     */
    fromElement(element) {
        const services = {};

        if (!element || typeof element.getAttribute !== "function") {
            return services;
        }

        const raw = element.getAttribute("data-wx-service");

        if (!raw) {
            return services;
        }

        let parsed = null;

        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            console.warn("invalid data-wx-service island", error);
            return services;
        }

        const descriptors = Array.isArray(parsed) ? parsed : [parsed];

        for (const descriptor of descriptors) {
            if (!descriptor || typeof descriptor !== "object") {
                continue;
            }
            const service = this.create(descriptor);
            if (service) {
                services[descriptor.name || "default"] = service;
            }
        }

        return services;
    }

    /**
     * Removes all factories. Useful for tests.
     */
    clear() {
        this._factories.clear();
    }
};
