using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebSession.Model;
using WebExpress.WebCore.WebUri;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Represents a client session for interacting with a service or resource.
    /// </summary>
    public interface IClientSession
    {
        /// <summary>
        /// Gets the request method (e.g. POST).
        /// </summary>
        RequestMethod Method { get; }

        /// <summary>
        /// Gets the uri.
        /// </summary>
        IUri Uri { get; internal set; }

        /// <summary>
        /// Gets the session.
        /// </summary>
        Session Session { get; }

        /// <summary>
        /// Gets the options from the header.
        /// </summary>
        RequestHeaderFields Header { get; }

        /// <summary>
        /// Gets the ip address and port number of the client from which the request originated.
        /// </summary>
        EndPoint RemoteEndPoint { get; }

        /// <summary>
        /// Gets the culture.
        /// </summary>
        CultureInfo Culture { get; }

        /// <summary>
        /// Gets the collection of parameters associated with the request.
        /// </summary>
        IEnumerable<IParameter> Parameters { get; }

        /// <summary>
        /// Gets the name of the WebSocket subprotocol that is supported by the connection.
        /// </summary>
        string SupportedSubProtocol { get; }

        /// <summary>
        /// Gets the unique identifier for the current connection.
        /// </summary>
        Guid ConnectionId { get; }

        /// <summary>
        /// Gets the endpoint id.
        /// </summary>
        IComponentId EndpointId { get; }

        /// <summary>
        /// Gets the associated plugin context.
        /// </summary>
        IPluginContext PluginContext { get; }

        /// <summary>
        /// Gets the corresponding application context.
        /// </summary>
        IApplicationContext ApplicationContext { get; }

        /// <summary>
        /// Gets the collection of domain names associated with the current context.
        /// </summary>
        IEnumerable<string> Domains { get; }
    }
}
