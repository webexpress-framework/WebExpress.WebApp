using System.Collections.Generic;
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
    /// Represents the result of a REST API operation that analyze a wql.
    /// </summary>
    public class RestApiWqlPromptAnalyzeResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        /// <summary>
        /// Gets or sets the lookahead configuration used for query execution.
        /// </summary>
        public IWqlLookahead Lookahead { get; set; }

        /// <summary>
        /// Gets or sets the type of WQL expression currently being processed.
        /// </summary>
        public WqlExpressionType CurrentExpressionType { get; set; }

        /// <summary>
        /// Gets or sets the collection of expression types that are valid to 
        /// follow the current expression in a WQL query.
        /// </summary>
        public IEnumerable<WqlExpressionType> NextExpressionTypes { get; set; } = [];

        /// <summary>
        /// Gets or sets the error message that describes the result of the
        /// current wql.
        /// </summary>
        public string ErrorMessage { get; set; }

        /// <summary>
        /// Gets or sets the part of the current token before the cursor; the
        /// client uses it to replace the partial input when applying a suggestion.
        /// </summary>
        public string Prefix { get; set; }

        /// <summary>
        /// Gets or sets the attribute name the cursor context belongs to; the
        /// client uses it to request attribute-specific value suggestions.
        /// </summary>
        public string Attribute { get; set; }

        /// <summary>
        /// Gets or sets whether the cursor is inside an open string literal; the
        /// client then skips the automatic quoting of applied suggestions.
        /// </summary>
        public bool Quoted { get; set; }

        /// <summary>
        /// Gets or sets the list of suggestion items.
        /// </summary>
        public IEnumerable<string> Suggestions { get; set; } = [];

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
                    type = x.ExpressionType,
                    offset = x.Token.Offset,
                    length = x.Token.Length,
                    value = x.Token.Value
                }),
                isValidSoFar = Lookahead.IsValidSoFar,
                lastExpressionType = Lookahead.LastExpressionType,
                currentExpressionType = CurrentExpressionType,
                nextExpressionTypes = NextExpressionTypes,
                suggestions = Suggestions,
                errorMessage = ErrorMessage,
                prefix = Prefix,
                attribute = Attribute,
                quoted = Quoted
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
