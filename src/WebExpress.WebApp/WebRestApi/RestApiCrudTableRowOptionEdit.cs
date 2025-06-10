using System.Text.Json.Serialization;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents an "edit" option for a table row in a REST API CRUD operation.
    /// </summary>
    public class RestApiCrudTableRowOptionEdit : RestApiCrudTableRowOption
    {
        /// <summary>
        /// Returns the type of the element, represented as a string.
        /// </summary>
        [JsonPropertyName("type")]
        public virtual string Type => "item";

        /// <summary>
        /// Returns the command.
        /// </summary>
        [JsonPropertyName("command")]
        public virtual string Command => "edit";

        /// <summary>
        /// Returns the edit form uri.
        /// </summary>
        [JsonPropertyName("uri")]
        public virtual string Uri { get; set; }

        /// <summary>
        /// Returns the label.
        /// </summary>
        [JsonPropertyName("content")]
        public virtual string Label => I18N.Translate(Request, "webexpress.webapp:edit.label");

        /// <summary>
        /// Returns the icon.
        /// </summary>
        [JsonPropertyName("icon")]
        public virtual string Icon => "fa fa-pen";

        /// <summary>
        /// Returns or sets the text color.
        /// </summary>
        [JsonPropertyName("color")]
        public virtual string Color => "text-primary";

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiCrudTableRowOptionEdit(Request request)
            : base(request)
        {
        }
    }
}
