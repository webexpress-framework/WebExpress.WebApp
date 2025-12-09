using System.Text.Json.Serialization;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a separator option in a REST API.
    /// </summary>
    public class RestApiCrudOptionHeader : RestApiCrudOption
    {
        private string _label = "";

        /// <summary>
        /// Returns the type of the element, represented as a string.
        /// </summary>
        [JsonPropertyName("type")]
        public virtual string Type => "header";

        /// <summary>
        /// Returns or sets the label.
        /// </summary>
        [JsonPropertyName("text")]
        public virtual string Label
        {
            get { return I18N.Translate(Request, _label); }
            set { _label = value; }
        }

        /// <summary>
        /// Returns the icon.
        /// </summary>
        [JsonPropertyName("icon")]
        public virtual string Icon { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiCrudOptionHeader(Request request)
            : base(request)
        {
        }
    }
}
