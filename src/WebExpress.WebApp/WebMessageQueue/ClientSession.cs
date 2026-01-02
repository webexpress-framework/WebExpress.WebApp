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
    /// Default implementation of a client session used for WebSocket communication.
    /// </summary>
    internal sealed class ClientSession : IClientSession
    {
        /// <summary>
        /// Returns or sets the request method (e.g. POST).
        /// </summary>
        public RequestMethod Method { get; set; }

        /// <summary>
        /// Returns or sets the uri.
        /// </summary>
        public IUri Uri { get; set; }

        /// <summary>
        /// Returns or sets the session.
        /// </summary>
        public Session Session { get; set; }

        /// <summary>
        /// Returns or sets the options from the header.
        /// </summary>
        public RequestHeaderFields Header { get; set; }

        /// <summary>
        /// Returns or sets the ip address and port number of the client from which the request originated.
        /// </summary>
        public EndPoint RemoteEndPoint { get; set; }

        /// <summary>
        /// Returns or sets the culture.
        /// </summary>
        public CultureInfo Culture { get; set; }

        /// <summary>
        /// Returns or sets the collection of parameters associated with the request.
        /// </summary>
        public IEnumerable<IParameter> Parameters { get; set; }

        /// <summary>
        /// Returns the name of the WebSocket subprotocol that is supported by the connection.
        /// </summary>
        public string SupportedSubProtocol { get; set; }

        /// <summary>
        /// Returns or sets the unique identifier for the current connection.
        /// </summary>
        public Guid ConnectionId { get; set; }

        /// <summary>
        /// Returns or sets the endpoint id.
        /// </summary>
        public IComponentId EndpointId { get; set; }

        /// <summary>
        /// Returns or sets the associated plugin context.
        /// </summary>
        public IPluginContext PluginContext { get; set; }

        /// <summary>
        /// Returns or sets the corresponding application context.
        /// </summary>
        public IApplicationContext ApplicationContext { get; set; }

        /// <summary>
        /// Returns or sets the collection of domain names associated with the current context.
        /// </summary>
        public IEnumerable<string> Domains { get; set; }

        /// <summary>
        /// Creates a new client session instance.
        /// </summary>
        public ClientSession()
        {
        }
    }
}