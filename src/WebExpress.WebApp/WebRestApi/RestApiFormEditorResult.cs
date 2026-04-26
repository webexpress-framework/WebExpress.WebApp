using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a REST API operation that retrieves or persists
    /// a form structure for the visual form editor.
    /// </summary>
    public class RestApiFormEditorResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };

        /// <summary>
        /// Gets or sets the form structure to send back to the client.
        /// </summary>
        public RestApiFormEditorItem Data { get; set; }

        /// <summary>
        /// Converts the current instance into a response object. Wraps the
        /// payload as <c>{ "data": { ... } }</c> to match the JSON envelope
        /// expected by <c>webexpress.webapp.RestFormEditorCtrl</c>.
        /// </summary>
        /// <returns>A response carrying the serialized form structure.</returns>
        public virtual IResponse ToResponse()
        {
            var jsonData = JsonSerializer.Serialize(new { data = Data }, _jsonOptions);
            var content = Encoding.UTF8.GetBytes(jsonData);

            return new ResponseOK
            {
                Content = content
            }
                .AddHeaderContentType("application/json");
        }
    }
}
