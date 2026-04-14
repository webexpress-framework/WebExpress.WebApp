using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a configuration option for a row in a REST API-based CRUD table.
    /// </summary>
    [JsonPolymorphic]
    [JsonDerivedType(typeof(RestApiOptionHeader), "RestApiCrudTableRowOptionHeader")]
    [JsonDerivedType(typeof(RestApiOptionSeparator), "RestApiCrudTableRowOptionSeparator")]
    [JsonDerivedType(typeof(RestApiOptionEdit), "RestApiCrudTableRowOptionEdit")]
    [JsonDerivedType(typeof(RestApiOptionClone), "RestApiCrudTableRowOptionClone")]
    [JsonDerivedType(typeof(RestApiOptionDelete), "RestApiCrudTableRowOptionDelete")]
    [JsonDerivedType(typeof(RestApiOptionCustom), "RestApiCrudTableRowOptionCustom")]
    public abstract class RestApiOption
    {
        /// <summary>
        /// Gets or sets the id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets the request object associated with the current operation.
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
            Id = RandomId.Create();
        }

        /// <summary>
        /// Returns a string that represents the current object, formatted 
        /// according to the specified action type.
        /// </summary>
        /// <returns>
        /// A string representation of the current object, formatted based 
        /// on the provided action type.
        /// </returns>
        public virtual Dictionary<string, object> ToJson()
        {
            var json = new Dictionary<string, object>
            {
                { "id", Id }
            };

            return json;
        }
    }
}
