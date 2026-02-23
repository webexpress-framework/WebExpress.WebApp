using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides a base class for REST API endpoints that support WQL (Web Query Language) prompt 
    /// operations over index items of a specified type.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of index item that the API operates on. Must implement the IIndexItem interface.
    /// </typeparam>
    [IncludeSubPaths(true)]
    public abstract class RestApiWqlPrompt<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        // parser instance for WQL operations
        //private static readonly WqlParser<TIndexItem> parser = new ();
        private static readonly string[] availableAttributes = typeof(TIndexItem).GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => p.CanRead)
            .Select(p => p.Name.ToLower())
            .ToArray();
        private static readonly string[] operators = { "=", "!=", ">", "<", ">=", "<=", "~", "is", "is not", "in", "not in" };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiWqlPrompt()
        {
        }

        /// <summary>
        /// Processes an incoming HTTP GET request and routes it to the appropriate 
        /// REST API endpoint based on the request URI.
        /// </summary>
        /// <param name="request">
        /// The request object containing details of the incoming HTTP request, including 
        /// the URI and any associated parameters. Cannot be null.</param>
        /// <returns>
        /// An IResponse object representing the result of the request processing. The 
        /// response varies depending on the endpoint accessed and may include history
        /// data, parsing results, suggestions, validation feedback, or a
        /// generic success response.
        /// </returns>
        [Method(RequestMethod.GET)]
        public IResponse Get(IRequest request)
        {
            // extract path segments to determine endpoint
            var path = request.Uri;
            var last = path.PathSegments.LastOrDefault()?.Value;

            // handle history endpoint
            if (last?.Equals("history") ?? false)
            {
                return new RestApiWqlPromptHistoryResult()
                {
                    History = GetHistory(request)
                }
                    .ToResponse();
            }

            // handle analyze endpoint
            if (last?.Equals("analyze") ?? false)
            {
                var wql = request.GetParameter("wql")?.Value ?? "";
                var cursorPosition = request.GetParameter("c")?.Value ?? "0";
                var ila = GetLookahead(wql, request);
                var pos = Convert.ToInt32(cursorPosition);

                var currentToken = ila.Items
                    .Where(x => x.Token.Offset <= pos && pos <= x.Token.Offset + x.Token.Length)
                    .FirstOrDefault()
                    ?? ila.Items
                        .Where(x => x.Token.Offset <= pos)
                        .LastOrDefault();

                var currentExpressionType = currentToken?.ExpressionType ?? WqlExpressionType.None;

                // extract prefix - part of the token before the cursor
                var prefix = "";
                if (currentToken is not null)
                {
                    // get prefix safely using Range and Math.Min
                    var offset = Math.Max(0, Math.Min(pos - currentToken.Token.Offset, currentToken.Token.Value.Length));
                    prefix = currentToken.Token.Value[..offset];
                }

                // find the current attribute (example: look backwards for last attribute-type token)
                string currentAttribute = null;
                if (currentToken is not null)
                {
                    var items = ila.Items.ToList();
                    var idx = items.IndexOf(currentToken);

                    var previousAttribute = items
                        .Take(idx)
                        .Reverse()
                        .FirstOrDefault(x => x.ExpressionType == WqlExpressionType.Attribute);

                    if (previousAttribute is not null)
                    {
                        currentAttribute = previousAttribute.Token.Value;
                    }
                }

                var nextExpressionTypes = currentToken?.ExpectedNextTokens ?? [];
                var errorMessage = ila.IsValidSoFar
                    ? null
                    : "Query is invalid or incomplete.";

                // call GetSuggestions with type, prefix, attribute
                var suggestions = GetSuggestions(currentExpressionType, prefix, currentAttribute);

                return new RestApiWqlPromptAnalyzeResult()
                {
                    Lookahead = ila,
                    CurrentExpressionType = currentExpressionType,
                    NextExpressionTypes = nextExpressionTypes,
                    ErrorMessage = errorMessage,
                    Suggestions = suggestions
                }
                    .ToResponse();
            }

            // default response
            return new ResponseOK();
        }

        /// <summary>
        /// Retrieves a collection of historical entries associated with the specified request.
        /// </summary>
        /// <remarks>
        /// Override this method in a derived class to provide custom history retrieval
        /// logic.
        /// </remarks>
        /// <param name="request">
        /// The request for which to retrieve history. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of strings representing the history entries for the 
        /// specified request. The collection is empty if no history is available.
        /// </returns>
        protected virtual IEnumerable<string> GetHistory(IRequest request)
        {
            return [];
        }

        /// <summary>
        /// Analyzes the specified WQL query and returns lookahead information that 
        /// describes the query's structure and expected elements.
        /// </summary>
        /// <param name="wql">
        /// The WQL query string to analyze. This parameter must not be null or empty.
        /// </param>
        /// <param name="request">
        /// The request context used for analysis. This parameter cannot be null.
        /// </param>
        /// <returns>
        /// An instance of IWqlLookahead containing information about the parsed WQL 
        /// query.
        /// </returns>
        protected virtual IWqlLookahead GetLookahead(string wql, IRequest request)
        {
            var parser = new WqlParser<TIndexItem>();
            var ila = parser.Analyze(wql);

            return ila;
        }

        /// <summary>
        /// Retrieves a list of suggested values based on the specified type, prefix, 
        /// and attribute.
        /// </summary>
        /// <param name="type">
        /// The type of suggestions to retrieve.
        /// </param>
        /// <param name="prefix">
        /// An optional string used to filter the suggestions based on the starting 
        /// characters. If provided, only suggestions that start with this prefix 
        /// will be included.
        /// </param>
        /// <param name="attribute">
        /// An optional attribute name that influences the suggestions returned for 
        /// certain types, such as 'type' or 'status'.
        /// </param>
        /// <returns>
        /// An enumerable collection of strings containing the suggested values 
        /// based on the provided parameters. The collection may be empty if no 
        /// suggestions are applicable.
        /// </returns>
        protected virtual IEnumerable<string> GetSuggestions(WqlExpressionType type, string prefix, string attribute)
        {
            // get all property names of the type as attribute suggestions
            var attributes = typeof(TIndexItem)
                .GetProperties()
                .Select(p => p.Name);

            var operators = new List<string>
            {
                "=", "!=", ">", "<", ">=", "<=", "~", "is", "is not", "in", "not in"
            };

            var items = new List<string>();

            switch (type)
            {
                case WqlExpressionType.Attribute:
                    items.AddRange(attributes);
                    break;
                case WqlExpressionType.Operator:
                    items = operators;
                    break;
                default:
                    items.AddRange(attributes);
                    break;
            }

            return items;
        }
    }
}