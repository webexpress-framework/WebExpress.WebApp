using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a configuration option for a row in a REST API-based CRUD table.
    /// </summary>
    public class RestApiCrudTableRowOption
    {
        /// <summary>
        /// Returns or sets the id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Returns the command.
        /// </summary>
        [JsonPropertyName("command")]
        public virtual string Command => "custom";

        /// <summary>
        /// Returns or sets the label.
        /// </summary>
        [JsonPropertyName("content")]
        public virtual string Label { get; set; }

        /// <summary>
        /// Returns or sets the icon.
        /// </summary>
        [JsonPropertyName("icon")]
        public virtual string Icon { get; set; }

        /// <summary>
        /// Returns or sets the text color.
        /// </summary>
        [JsonPropertyName("color")]
        public virtual string Color { get; set; }

        /// <summary>
        /// Returns or sets the width of the table column in percentage, null for auto.
        /// </summary>
        [JsonPropertyName("width")]
        public uint? Width { get; set; }

        /// <summary>
        /// Returns or sets the Javascript code that renders the data of the cell.
        /// </summary>
        [JsonPropertyName("render")]
        public string Render { get; set; }

        /// <summary>
        /// Returns the request object associated with the current operation.
        /// </summary>
        [JsonIgnore]
        protected Request Request { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiCrudTableRowOption(Request request)
        {
            Request = request;
        }
    }
}
