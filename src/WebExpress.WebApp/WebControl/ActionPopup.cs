using System.Collections.Generic;
using System.Globalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents an <see cref="IAction"/> that, when triggered on the
    /// client (typically by a button click), displays a popup notification
    /// through the existing
    /// <c>webexpress.webapp.PopupNotificationCtrl</c> pipeline. The action
    /// runs entirely on the client — no HTTP roundtrip or server
    /// notification is required.
    /// </summary>
    public class ActionPopup : IAction
    {
        /// <summary>
        /// Gets or sets the heading text of the popup notification.
        /// </summary>
        public string Heading { get; set; }

        /// <summary>
        /// Gets or sets the message body (HTML allowed) of the popup
        /// notification.
        /// </summary>
        public string Message { get; set; }

        /// <summary>
        /// Gets or sets the Bootstrap alert class (e.g. <c>alert-success</c>,
        /// <c>alert-info</c>, <c>alert-warning</c>, <c>alert-danger</c>).
        /// Defaults to <c>alert-primary</c> when omitted on the client.
        /// </summary>
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets the optional icon URL displayed next to the
        /// message.
        /// </summary>
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the lifetime of the popup in milliseconds. A
        /// negative value keeps the popup pinned until the user closes it.
        /// </summary>
        public int Durability { get; set; } = 5000;

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        public ActionPopup()
        {
        }

        /// <summary>
        /// Initializes a new instance with the most common configuration.
        /// </summary>
        /// <param name="heading">The heading text.</param>
        /// <param name="message">The message body.</param>
        /// <param name="type">The Bootstrap alert class.</param>
        /// <param name="durability">The lifetime in milliseconds.</param>
        public ActionPopup(string heading, string message, string type = null, int durability = 5000)
        {
            Heading = heading;
            Message = message;
            Type = type;
            Durability = durability;
        }

        /// <summary>
        /// Applies the <c>data-wx-{primary|secondary}-*</c> attributes that
        /// the client-side <c>popup</c> action reads to build the
        /// notification.
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

            htmlNode.AddUserAttribute($"data-wx-{prefix}-action", "popup");

            if (!string.IsNullOrEmpty(Heading))
            {
                htmlNode.AddUserAttribute($"data-wx-{prefix}-heading", Heading);
            }
            if (!string.IsNullOrEmpty(Message))
            {
                htmlNode.AddUserAttribute($"data-wx-{prefix}-message", Message);
            }
            if (!string.IsNullOrEmpty(Type))
            {
                htmlNode.AddUserAttribute($"data-wx-{prefix}-type", Type);
            }
            if (!string.IsNullOrEmpty(Icon))
            {
                htmlNode.AddUserAttribute($"data-wx-{prefix}-icon", Icon);
            }
            htmlNode.AddUserAttribute
            (
                $"data-wx-{prefix}-durability",
                Durability.ToString(CultureInfo.InvariantCulture)
            );

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
                ["action"] = "popup",
                ["durability"] = Durability
            };

            if (!string.IsNullOrEmpty(Heading))
            {
                dict["heading"] = Heading;
            }
            if (!string.IsNullOrEmpty(Message))
            {
                dict["message"] = Message;
            }
            if (!string.IsNullOrEmpty(Type))
            {
                dict["type"] = Type;
            }
            if (!string.IsNullOrEmpty(Icon))
            {
                dict["icon"] = Icon;
            }

            return dict;
        }
    }
}
