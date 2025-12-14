using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a customizable row option for a CRUD table in a REST API context.
    /// </summary>
    public abstract class RestApiOptionCustom : RestApiOption
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
        public virtual string Command => "custom";

        /// <summary>
        /// Returns or sets the command args.
        /// </summary>
        [JsonPropertyName("arg")]
        public virtual string CommandArg { get; set; }

        /// <summary>
        /// Returns the label.
        /// </summary>
        [JsonPropertyName("text")]
        public virtual string Label { get; set; }

        /// <summary>
        /// Returns the icon.
        /// </summary>
        [JsonPropertyName("icon")]
        public virtual string Icon { get; set; }

        /// <summary>
        /// Returns or sets the text color.
        /// </summary>
        [JsonPropertyName("color")]
        public virtual string Color { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiOptionCustom(Request request)
            : base(request)
        {
        }
    }
}
