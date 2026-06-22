using System.Collections.Generic;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents an <see cref="IAction"/> that issues a fire-and-forget HTTP
    /// request through the service layer when triggered on the client
    /// (typically by a button click), without navigating away from the current
    /// page. This is the right fit for endpoints whose only observable result
    /// arrives through a different channel - for example a server that pushes a
    /// popup over the MessageQueue WebSocket in response to the call: a full
    /// page navigation would unload the very page that is meant to receive the
    /// live push, so the request is sent in the background instead.
    /// </summary>
    public class ActionRequest : IAction
    {
        /// <summary>
        /// Gets or sets the URI of the endpoint to call.
        /// </summary>
        public IUri Uri { get; set; }

        /// <summary>
        /// Gets or sets the HTTP method used for the request. Defaults to
        /// <c>GET</c>.
        /// </summary>
        public string Method { get; set; } = "GET";

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        public ActionRequest()
        {
        }

        /// <summary>
        /// Initializes a new instance with the endpoint to call.
        /// </summary>
        /// <param name="uri">The URI of the endpoint to call.</param>
        /// <param name="method">The HTTP method. Defaults to <c>GET</c>.</param>
        public ActionRequest(IUri uri, string method = "GET")
        {
            Uri = uri;
            Method = method;
        }

        /// <summary>
        /// Applies the <c>data-wx-{primary|secondary}-*</c> attributes that the
        /// client-side <c>request</c> action reads to issue the call.
        /// </summary>
        /// <param name="htmlNode">The HTML node to decorate.</param>
        /// <param name="typeAction">The slot (primary or secondary).</param>
        /// <returns>The current instance for method chaining.</returns>
        public IAction ApplyUserAttributes(IHtmlNode htmlNode, TypeAction typeAction)
        {
            if (htmlNode is null)
            {
                return this;
            }

            var prefix = typeAction == TypeAction.Secondary ? "secondary" : "primary";

            htmlNode.AddUserAttribute($"data-wx-{prefix}-action", "request");

            if (Uri is not null)
            {
                htmlNode.AddUserAttribute($"data-wx-{prefix}-uri", Uri.ToString());
            }
            if (!string.IsNullOrEmpty(Method))
            {
                htmlNode.AddUserAttribute($"data-wx-{prefix}-method", Method);
            }

            return this;
        }

        /// <summary>
        /// Returns the JSON representation of the action for declarative
        /// configurations.
        /// </summary>
        public virtual Dictionary<string, object> ToJson()
        {
            var dict = new Dictionary<string, object>
            {
                ["action"] = "request"
            };

            if (Uri is not null)
            {
                dict["uri"] = Uri.ToString();
            }
            if (!string.IsNullOrEmpty(Method))
            {
                dict["method"] = Method;
            }

            return dict;
        }
    }
}
