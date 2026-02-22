using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a REST API operation that parse a wql.
    /// </summary>
    public class RestApiWqlPromptParseResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        /// <summary>
        /// Returns or sets the lookahead configuration used for query execution.
        /// </summary>
        public IWqlLookahead Lookahead { get; set; }

        /// <summary>
        /// Returns or sets the type of WQL expression currently being processed.
        /// </summary>
        public WqlExpressionType CurrentExpressionType { get; set; }

        /// <summary>
        /// Converts the current instance into a response object.
        /// </summary>
        /// <returns>A Response object representing the result of the conversion.</returns>
        public virtual IResponse ToResponse()
        {
            var data = new
            {
                tokens = Lookahead.Items.Select(x => new
                {
                    type = x.ExpreesionType,
                    offset = x.Token.Offset,
                    length = x.Token.Length,
                    value = x.Token.Value
                }),
                isValidSoFar = Lookahead.IsValidSoFar,
                lastExpressionType = Lookahead.LastExpressionType,
                currentExpressionType = CurrentExpressionType
            };

            var jsonData = JsonSerializer.Serialize(data, _jsonOptions);
            var content = Encoding.UTF8.GetBytes(jsonData);

            return new ResponseOK
            {
                Content = content
            }
            .AddHeaderContentType("application/json");
        }
    }
}
