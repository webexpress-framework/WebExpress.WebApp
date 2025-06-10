using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a separator option for a CRUD table row in a REST API context.
    /// </summary>
    public class RestApiCrudTableRowOptionSeperator : RestApiCrudTableRowOption
    {
        /// <summary>
        /// Returns the type of the element, represented as a string.
        /// </summary>
        [JsonPropertyName("type")]
        public virtual string Type => "divider";

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiCrudTableRowOptionSeperator(Request request)
            : base(request)
        {
        }
    }
}
