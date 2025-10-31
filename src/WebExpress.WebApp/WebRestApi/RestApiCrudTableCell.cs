using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a cell in a table used for REST API CRUD operations.
    /// </summary>
    public class RestApiCrudTableCell
    {
        /// <summary>
        /// Returns or sets the id.
        /// </summary>
        [JsonPropertyName("text")]
        public string Text { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiCrudTableCell()
        {
        }
    }
}
