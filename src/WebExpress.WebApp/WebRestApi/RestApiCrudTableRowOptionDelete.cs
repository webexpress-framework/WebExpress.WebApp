using System.Text.Json.Serialization;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a configuration option for a row in a REST API-based CRUD table.
    /// </summary>
    public class RestApiCrudTableRowOptionDelete : RestApiCrudTableRowOption
    {
        /// <summary>
        /// Returns or sets the command.
        /// </summary>
        [JsonPropertyName("command")]
        public override string Command => "delete";

        /// <summary>
        /// Returns the label.
        /// </summary>
        [JsonPropertyName("content")]
        public override string Label => I18N.Translate(Request, "webexpress.webapp:delete.label");

        /// <summary>
        /// Returns the icon.
        /// </summary>
        [JsonPropertyName("icon")]
        public override string Icon => "fa fa-trash";

        /// <summary>
        /// Returns or sets the text color.
        /// </summary>
        [JsonPropertyName("color")]
        public override string Color => "text-danger";

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiCrudTableRowOptionDelete(Request request)
            : base(request)
        {
        }
    }
}
