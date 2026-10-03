using System.Collections.Generic;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Action for plugin package management operations.
    /// </summary>
    public class ActionPluginPackage : IAction
    {
        /// <summary>
        /// Gets or sets the target REST API uri.
        /// </summary>
        public IUri RestEndpoint { get; set; }

        /// <summary>
        /// Gets or sets the HTTP method.
        /// </summary>
        public string Method { get; set; } = "POST";

        /// <summary>
        /// Gets or sets whether file upload is required.
        /// </summary>
        public bool RequireFile { get; set; }

        /// <summary>
        /// Gets or sets the confirm message.
        /// </summary>
        public string ConfirmText { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="restEndpoint">The REST uri.</param>
        /// <param name="method">The HTTP method.</param>
        /// <param name="requireFile">True if upload is required.</param>
        public ActionPluginPackage(IUri restEndpoint, string method = "POST", bool requireFile = false)
        {
            RestEndpoint = restEndpoint;
            Method = method;
            RequireFile = requireFile;
        }

        /// <summary>
        /// Applies user attributes.
        /// </summary>
        /// <param name="htmlNode">The html node.</param>
        /// <param name="typeAction">The action type.</param>
        /// <returns>The action.</returns>
        public IAction ApplyUserAttributes(IHtmlNode htmlNode, TypeAction typeAction)
        {
            var prefix = typeAction == TypeAction.Secondary ? "secondary" : "primary";

            htmlNode?.AddUserAttribute($"data-wx-{prefix}-action", "plugin-package");
            htmlNode?.AddUserAttribute($"data-wx-{prefix}-uri", RestEndpoint?.ToString());
            htmlNode?.AddUserAttribute($"data-wx-{prefix}-method", Method);
            htmlNode?.AddUserAttribute($"data-wx-{prefix}-require-file", RequireFile ? "true" : null);
            htmlNode?.AddUserAttribute($"data-wx-{prefix}-confirm", ConfirmText);

            return this;
        }

        /// <summary>
        /// Converts to json.
        /// </summary>
        /// <returns>A json dictionary.</returns>
        public Dictionary<string, object> ToJson()
        {
            var dict = new Dictionary<string, object>
            {
                ["action"] = "plugin-package"
            };

            if (RestEndpoint is not null)
            {
                dict["uri"] = RestEndpoint.ToString();
            }

            if (!string.IsNullOrWhiteSpace(Method))
            {
                dict["method"] = Method;
            }

            if (RequireFile)
            {
                dict["requireFile"] = true;
            }

            if (!string.IsNullOrWhiteSpace(ConfirmText))
            {
                dict["confirm"] = ConfirmText;
            }

            return dict;
        }
    }
}
