/**
 * Default service definitions for the WebExpress.WebUI service registry.
 * Registers the built in service kinds. The rest kind is the default and is
 * used when a service descriptor does not name a kind.
 *
 * A service factory receives a descriptor and returns a configured service
 * instance. Additional kinds, for example a websocket service or a static
 * data service, are registered the same way by plugins.
 */

// rest service - the default network service backed by fetch
webexpress.webapp.ServiceRegistry.register("rest", (descriptor) => {
    return new webexpress.webapp.RestService(descriptor);
});

// the WebUI controls reach the network through their transport; on a WebApp page that
// transport is the service layer, so a frame, a dialog, an inline editor or an upload
// shares its result contract and reports on its error channel like every data control.
// An upload keeps the built-in progress reporting and only adds the report.
webexpress.webui.Transport.use({
    request: (url, init) => webexpress.webapp.ServiceRegistry.request(url, init),
    upload: (url, body, options) => webexpress.webui.Transport.builtIn.upload(url, body, Object.assign({}, options, { report: false })).then((result) => {
        if (!result.ok && result.error.kind !== "abort") {
            webexpress.webapp.ErrorChannel.report(result, { service: "shared", operation: options && options.method ? options.method : "POST" });
        }
        return result;
    })
});
