using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a configuration option for a row in a REST API-based CRUD table.
    /// </summary>
    [JsonPolymorphic]
    [JsonDerivedType(typeof(RestApiCrudTableRowOptionHeader), "RestApiCrudTableRowOptionHeader")]
    [JsonDerivedType(typeof(RestApiCrudTableRowOptionSeperator), "RestApiCrudTableRowOptionSeperator")]
    [JsonDerivedType(typeof(RestApiCrudTableRowOptionEdit), "RestApiCrudTableRowOptionEdit")]
    [JsonDerivedType(typeof(RestApiCrudTableRowOptionDelete), "RestApiCrudTableRowOptionDelete")]
    public class RestApiCrudTableRowOption
    {
        /// <summary>
        /// Returns or sets the id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

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
