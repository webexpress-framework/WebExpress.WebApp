using System;
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

        // history storage for queries
        private static readonly List<string> queryHistory = new List<string>();

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
            //var queryParams = HttpUtility.ParseQueryString(request.Uri.Query);

            // handle history endpoint
            if (path.Contains("/history"))
            {
                //return new ResponseJson(JsonSerializer.Serialize(new { history = queryHistory }));
                return new ResponseOK();
            }

            // handle parse endpoint
            if (path.Contains("/parse"))
            {
                //var text = request.GetParameter("text")?.Value ?? "";
                //var cursorPos = int.TryParse(queryParams["cursorPos"], out var pos) ? pos : 0;
                //var context = parser.DetermineContext(text, cursorPos);
                //return new ResponseJson(JsonSerializer.Serialize(new { context = context }));
                return new ResponseOK();
            }

            // handle suggestions endpoint
            if (path.Contains("/suggestions"))
            {
                //var type = queryParams["type"];
                //var prefix = (queryParams["prefix"] ?? "").ToLower();
                //var attribute = queryParams["attribute"];

                //var items = GetSuggestions(type, prefix, attribute);
                //return new ResponseJson(JsonSerializer.Serialize(new { items = items }));
            }

            // handle validate endpoint
            if (path.Contains("/validate"))
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
        /// Gets suggestions based on type, prefix, and attribute.
        /// </summary>
        /// <param name="type">The type of suggestion.</param>
        /// <param name="prefix">The prefix to filter by.</param>
        /// <param name="attribute">The attribute for parameter suggestions.</param>
        /// <returns>List of suggestion items.</returns>
        private List<string> GetSuggestions(string type, string prefix, string attribute)
        {
            var items = new List<string>();

            switch (type)
            {
                case "attribute":
                    items = availableAttributes.ToList();
                    break;

                case "operator":
                    items = operators.ToList();
                    break;

                case "parameter":
                case "set_parameter":
                case "parenthesis_open":
                    // for parameters, suggest based on attribute type or known values
                    // this is simplified; in full implementation, query index for unique values
                    items = GetAttributeValues(attribute);
                    break;

                case "after_parameter":
                    items = new List<string> { "and", "or", "~", ":", "order by", "take", "skip" };
                    break;

                case "logical_operator":
                    items = new List<string> { "and", "or", "order by", "take", "skip" };
                    break;

                case "set_next":
                    items = new List<string> { ",", ")" };
                    break;

                case "set_operator":
                    items = new List<string> { "in", "not in" };
                    break;

                case "order_direction":
                    items = new List<string> { "asc", "desc" };
                    break;

                case "number":
                    items = new List<string> { "1", "5", "10", "100" };
                    break;

                default:
                    items = new List<string>();
                    break;
            }

            // filter by prefix
            if (!string.IsNullOrEmpty(prefix))
            {
                if (new[] { "~", ":", ",", ")", "(" }.Contains(prefix))
                {
                    items = items.Where(i => i.StartsWith(prefix)).ToList();
                }
                else
                {
                    items = items.Where(i => i.ToLower().StartsWith(prefix)).ToList();
                }
            }

            return items;
        }

        /// <summary>
        /// Gets possible values for a given attribute from the index or known types.
        /// </summary>
        /// <param name="attribute">The attribute name.</param>
        /// <returns>List of possible values.</returns>
        private List<string> GetAttributeValues(string attribute)
        {
            // simplified: in real implementation, query the index for distinct values
            // for now, return generic examples or type-based suggestions
            var property = typeof(TIndexItem).GetProperty(attribute, BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);
            if (property != null)
            {
                var type = property.PropertyType;
                if (type == typeof(string))
                {
                    return new List<string> { "example1", "example2", "value" };
                }
                else if (type.IsEnum)
                {
                    return Enum.GetNames(type).ToList();
                }
                else if (type == typeof(bool))
                {
                    return new List<string> { "true", "false" };
                }
                else if (type == typeof(int) || type == typeof(long))
                {
                    return new List<string> { "1", "10", "100" };
                }
            }
            return new List<string> { "value1", "value2" };
        }
    }
}