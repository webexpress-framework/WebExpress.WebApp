using System.Collections.Generic;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents an action that triggers a logout by delegating session
    /// invalidation to the REST API endpoint responsible for session management.
    /// </summary>
    public class ActionLogout : IAction
    {
        /// <summary>
        /// Gets or sets the URI of the REST API endpoint that handles
        /// session invalidation (i.e. the RestApiSession route).
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Gets or sets the target URI associated with this instance.
        /// </summary>
        public IUri TargetUri { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="restUri">
        /// The URI of the REST API endpoint that corresponds to RestApiSession.
        /// </param>
        public ActionLogout(IUri restUri)
        {
            RestUri = restUri;
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="restUri">
        /// The URI of the REST API endpoint that corresponds to RestApiSession.
        /// </param>
        public ActionLogout(IUri restUri, IUri targetUri)
        {
            RestUri = restUri;
            TargetUri = targetUri;
        }

        /// <summary>
        /// Applies user-defined attributes to the specified HTML node.
        /// </summary>
        /// <param name="htmlNode">
        /// The HTML node to which user attributes will be applied. Cannot be null.
        /// </param>
        /// <param name="typeAction">
        /// The type of action being applied, which may influence how attributes are applied.
        /// </param>
        /// <returns>The current instance for method chaining.</returns>
        public IAction ApplyUserAttributes(IHtmlNode htmlNode, TypeAction typeAction)
        {
            var uri = RestUri?.ToString();
            var target = TargetUri?.ToString();

            switch (typeAction)
            {
                case TypeAction.Secondary:
                    htmlNode?.AddUserAttribute("data-wx-secondary-action", "logout");
                    htmlNode?.AddUserAttribute("data-wx-secondary-uri", uri);
                    if (TargetUri is not null)
                    {
                        htmlNode?.AddUserAttribute("data-wx-secondary-target", target);
                    }
                    break;
                default:
                    htmlNode?.AddUserAttribute("data-wx-primary-action", "logout");
                    htmlNode?.AddUserAttribute("data-wx-primary-uri", uri);
                    if (TargetUri is not null)
                    {
                        htmlNode?.AddUserAttribute("data-wx-primary-target", target);
                    }
                    break;
            }

            return this;
        }

        /// <summary>
        /// Returns a string that represents the value of the property.
        /// </summary>
        /// <returns>A string that contains the value of the property.</returns>
        public virtual Dictionary<string, object> ToJson()
        {
            var dict = new Dictionary<string, object>
            {
                ["action"] = "logout"
            };

            if (RestUri is not null)
            {
                dict["uri"] = RestUri.ToString();
            }
            if (TargetUri is not null)
            {
                dict["target"] = TargetUri.ToString();
            }

            return dict;
        }
    }
}
