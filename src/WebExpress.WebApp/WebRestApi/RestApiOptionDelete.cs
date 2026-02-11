using System.Text.Json.Serialization;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a delete option in a REST API.
    /// </summary>
    public class RestApiOptionDelete : RestApiOption
    {
        /// <summary>
        /// Returns the type of the element, represented as a string.
        /// </summary>
        [JsonPropertyName("type")]
        public virtual string Type => "item";

        /// <summary>
        /// Returns or sets the command.
        /// </summary>
        [JsonPropertyName("command")]
        public virtual string Command => "delete";

        /// <summary>
        /// Returns the label.
        /// </summary>
        [JsonPropertyName("text")]
        public virtual string Label => I18N.Translate(Request, "webexpress.webui:delete.label");

        /// <summary>
        /// Returns the icon.
        /// </summary>
        [JsonPropertyName("icon")]
        public virtual string Icon => "fa fa-trash";

        /// <summary>
        /// Returns the edit form uri.
        /// </summary>
        [JsonPropertyName("uri")]
        public virtual string Uri { get; set; }

        /// <summary>
        /// Returns or sets the text color.
        /// </summary>
        [JsonPropertyName("color")]
        public virtual string Color => "text-danger";

        /// <summary>
        /// Returns or sets the primary action, typically invoked on a single click.
        /// </summary>
        [JsonPropertyName("primaryaction")]
        public virtual IAction PrimaryAction { get; set; }

        /// <summary>
        /// Returns or sets the secondary action, typically invoked on a double‑click.
        /// </summary>
        [JsonPropertyName("secondaryaction")]
        public virtual IAction SecondaryAction { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiOptionDelete(IRequest request)
            : base(request)
        {
        }
    }
}
