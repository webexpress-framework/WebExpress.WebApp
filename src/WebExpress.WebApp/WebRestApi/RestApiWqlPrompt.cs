using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;

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

        // available attributes derived from TIndexItem properties
        private static readonly string[] availableAttributes = typeof(TIndexItem).GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => p.CanRead)
            .Select(p => p.Name.ToLower())
            .ToArray();

        // operators supported in WQL
        private static readonly string[] operators = { "=", "!=", ">", "<", ">=", "<=", "~", "is", "is not", "in", "not in" };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiWqlPrompt()
        {
        }

        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
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

            // handle parse endpoint
            if (last?.Equals("parse") ?? false)
            {
                //var text = request.GetParameter("text")?.Value ?? "";
                //var cursorPos = int.TryParse(queryParams["cursorPos"], out var pos) ? pos : 0;
                //var context = parser.DetermineContext(text, cursorPos);
                //return new ResponseJson(JsonSerializer.Serialize(new { context = context }));
                return new ResponseOK();
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
    }
}