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
