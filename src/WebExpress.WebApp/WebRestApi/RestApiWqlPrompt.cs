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
            //var queryParams = HttpUtility.ParseQueryString(request.Uri.Query);

            // handle history endpoint
            if (last?.Equals("history") ?? false)
            {
                return new RestApiWqlPromptHistoryResult()
                {
                    History = GetHistory(request)
                }
                    .ToResponse();
            }

            // handle suggestions endpoint
            if (last?.Equals("suggestions") ?? false)
            {
                //var type = queryParams["type"];
                //var prefix = (queryParams["prefix"] ?? "").ToLower();
                //var attribute = queryParams["attribute"];

                //var items = GetSuggestions(type, prefix, attribute);
                //return new ResponseJson(JsonSerializer.Serialize(new { items = items }));
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
                   .FirstOrDefault();

                return new RestApiWqlPromptParseResult()
                {
                    Lookahead = ila,
                    CurrentExpressionType = currentToken?.ExpreesionType ?? WqlExpressionType.None
                }
                    .ToResponse();
            }

            // default response
            return new ResponseOK();
        }

        /// <summary>
        /// Processes an HTTP POST request and returns a response based on the request's 
        /// URI path segment.
        /// </summary>
        /// <param name="request">
        /// The HTTP request to process. Must not be null. The request's URI determines 
        /// which endpoint is handled.
        /// </param>
        /// <returns>
        /// An object that implements the IResponse interface, representing the result 
        /// of the request. Returns a successful response for recognized endpoints or a 
        /// default response otherwise.
        /// </returns>
        [Method(RequestMethod.POST)]
        public IResponse Post(IRequest request)
        {
            // extract path segments to determine endpoint
            var path = request.Uri;
            var last = path.PathSegments.LastOrDefault()?.Value;

            // handle validate endpoint
            if (last?.Equals("validate") ?? false)
            {
                //var queryText = queryParams["query"] ?? "";
                //var error = parser.Validate(queryText);
                //var valid = string.IsNullOrEmpty(error);
                //if (valid && !queryHistory.Contains(queryText))
                //{
                //    queryHistory.Add(queryText);
                //}
                //return new ResponseJson(JsonSerializer.Serialize(new { valid = valid, error = error }));
                return new RestApiWqlPromptValidateResult()
                    .ToResponse();
            }

            // default response
            return new ResponseBadRequest();
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
    }
}