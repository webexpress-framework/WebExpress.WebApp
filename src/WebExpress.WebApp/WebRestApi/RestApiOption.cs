using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a configuration option for a row in a REST API-based CRUD table.
    /// </summary>
    [JsonPolymorphic]
    [JsonDerivedType(typeof(RestApiOptionHeader), "RestApiCrudTableRowOptionHeader")]
    [JsonDerivedType(typeof(RestApiOptionSeperator), "RestApiCrudTableRowOptionSeperator")]
    [JsonDerivedType(typeof(RestApiOptionEdit), "RestApiCrudTableRowOptionEdit")]
    [JsonDerivedType(typeof(RestApiOptionClone), "RestApiCrudTableRowOptionClone")]
    [JsonDerivedType(typeof(RestApiOptionDelete), "RestApiCrudTableRowOptionDelete")]
    [JsonDerivedType(typeof(RestApiOptionCustom), "RestApiCrudTableRowOptionCustom")]
    public abstract class RestApiOption
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
        protected IRequest Request { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiOption(IRequest request)
        {
            Request = request;
        }
    }
}
