using System;
using System.Collections.Generic;
using System.Linq;
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
    public abstract class RestApiWqlPrompt<TIndexItem> : RestApiWql<TIndexItem>
        where TIndexItem : IIndexItem
    {
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
            var last = path.PathSegments.LastOrDefault()?.Value.Trim('/');

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
                // one parser serves the whole request, so the suggested names are the ones the
                // statement is analyzed with
                var parser = CreateWqlParser();
                var ila = GetLookahead(parser, wql, request);
                var pos = Convert.ToInt32(cursorPosition);
                var lastToken = default(IWqlLookaheadToken);
                var currentToken = default(IWqlLookaheadToken);

                foreach (var item in ila.Items)
                {
                    if (item.Token.Offset <= pos && pos <= item.Token.Offset + item.Token.Length)
                    {
                        currentToken = item;

                        break;
                    }

                    lastToken = item;
                }

                // the cursor directly after a punctuation token (quote,
                // parenthesis, separator) belongs to the position AFTER the
                // token: punctuation cannot be extended by typing, so the
                // permissible followers are offered instead (e.g. "and" after
                // a closing quote)
                var afterPunctuation = currentToken is not null
                    && pos == currentToken.Token.Offset + currentToken.Token.Length
                    && (currentToken.ExpressionType == WqlExpressionType.Quotation
                        || currentToken.ExpressionType == WqlExpressionType.OpenParenthesis
                        || currentToken.ExpressionType == WqlExpressionType.CloseParenthesis
                        || currentToken.ExpressionType == WqlExpressionType.Separator);

                var referenceToken = currentToken ?? lastToken;
                var followMode = currentToken is null || afterPunctuation;

                var currentExpressionType = followMode
                    ? referenceToken?.ExpectedNextTokens.FirstOrDefault() ?? WqlExpressionType.None
                    : currentToken.ExpressionType;

                // extract prefix - part of the token before the cursor
                var prefix = "";
                if (!followMode)
                {
                    // get prefix safely using Range and Math.Min
                    var offset = Math.Max(0, Math.Min(pos - currentToken.Token.Offset, currentToken.Token.Value.Length));
                    prefix = currentToken.Token.Value[..offset];
                }

                // find the current attribute (look backwards for the last attribute-type token);
                // the arguments of a predicate belong to no attribute, so the search ends at its name
                string currentAttribute = null;
                if (referenceToken is not null)
                {
                    var items = ila.Items.ToList();
                    var idx = items.IndexOf(referenceToken);

                    var previousAttribute = items
                        .Take(idx)
                        .Reverse()
                        .FirstOrDefault(x => x.ExpressionType is WqlExpressionType.Attribute or WqlExpressionType.Predicate);

                    if (previousAttribute?.ExpressionType == WqlExpressionType.Attribute)
                    {
                        currentAttribute = previousAttribute.Token.Value;
                    }
                }

                var nextExpressionTypes = referenceToken?.ExpectedNextTokens ?? [];

                // a parse that fails right at the end of the input is an
                // incomplete statement the user is still typing (e.g. an
                // attribute without an operator yet), not an invalid one;
                // only report an error when unconsumed input remains before
                // the cursor
                var trimmedLength = wql.TrimEnd().Length;
                var lastItem = ila.Items.LastOrDefault();
                var consumedEnd = lastItem is null
                    ? 0
                    : lastItem.Token.Offset + lastItem.Token.Length;
                var incomplete = consumedEnd >= trimmedLength - 1;

                var errorMessage = ila.IsValidSoFar || incomplete
                    ? null
                    : "Query is invalid or incomplete.";

                // the cursor sits inside an open string literal when an odd
                // number of quotation tokens precedes it
                var quoted = ila.Items
                    .Count(x => x.ExpressionType == WqlExpressionType.Quotation && x.Token.Offset < pos) % 2 == 1;

                // in follow mode every permissible next type contributes its
                // suggestions (e.g. logical operators and order keywords after
                // a completed condition); otherwise the current token's type. a
                // name being typed is read as an attribute until its parenthesis
                // follows, so it may still become a predicate wherever the token
                // before it lets a condition start
                var suggestionTypes = (followMode
                    ? referenceToken?.ExpectedNextTokens ?? []
                    : currentExpressionType == WqlExpressionType.Attribute &&
                        (lastToken is null || lastToken.ExpectedNextTokens.Contains(WqlExpressionType.Predicate))
                        ? [WqlExpressionType.Attribute, WqlExpressionType.Predicate]
                        : [currentExpressionType])
                    .SelectMany(type => type == WqlExpressionType.None
                        ? new[] { WqlExpressionType.Attribute, WqlExpressionType.Predicate }
                        : [type])
                    .Distinct()
                    .ToList();

                var suggestions = new List<string>();
                var calls = new List<string>();

                foreach (var type in suggestionTypes)
                {
                    var names = GetSuggestions(parser, type, prefix, currentAttribute).ToList();

                    suggestions.AddRange(names);

                    if (type is WqlExpressionType.Predicate or WqlExpressionType.Function)
                    {
                        calls.AddRange(names);
                    }
                }

                suggestions = suggestions.Distinct().ToList();

                var preceding = referenceToken is null
                    ? []
                    : ila.Items.Take(ila.Items.ToList().IndexOf(referenceToken) + 1).ToList();

                // a filter operand may be negated, the attribute of a sort order may not
                var negatable = (suggestionTypes.Any(x => x is WqlExpressionType.Attribute or WqlExpressionType.None) ||
                    !followMode && currentToken.ExpressionType == WqlExpressionType.LogicalOperator &&
                    currentToken.Token.Value.Equals("not", StringComparison.OrdinalIgnoreCase)) &&
                    !preceding.Any(x => x.ExpressionType == WqlExpressionType.Order);

                if (negatable && "not".StartsWith(prefix, StringComparison.OrdinalIgnoreCase) && !suggestions.Contains("not"))
                {
                    suggestions.Add("not");
                }

                // between the bounds of a range only its "and" may follow, as "or" would cut the range off
                var lastOperator = preceding.LastOrDefault(x => x.ExpressionType is WqlExpressionType.Operator or WqlExpressionType.LogicalOperator);

                if (lastOperator?.ExpressionType == WqlExpressionType.Operator &&
                    lastOperator.Token.Value.Replace(" ", "").ToLowerInvariant() is "between" or "notbetween")
                {
                    suggestions.Remove("or");
                }

                return new RestApiWqlPromptAnalyzeResult()
                {
                    Lookahead = ila,
                    CurrentExpressionType = currentExpressionType,
                    NextExpressionTypes = nextExpressionTypes,
                    ErrorMessage = errorMessage,
                    Suggestions = suggestions,
                    Calls = calls.Distinct().Where(suggestions.Contains).ToList(),
                    Prefix = prefix,
                    Attribute = currentAttribute,
                    Quoted = quoted
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
        /// <param name="parser">
        /// The parser of the request, from <see cref="RestApiWql{TIndexItem}.CreateWqlParser"/>. The
        /// suggested predicate and function names are taken from it, so an override analyzes with
        /// it rather than with a parser of its own, and registers its predicates in
        /// CreateWqlParser instead.
        /// </param>
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
        protected virtual IWqlLookahead GetLookahead(WqlParser<TIndexItem> parser, string wql, IRequest request)
        {
            return parser.Analyze(wql);
        }

        /// <summary>
        /// Retrieves a list of suggested values based on the specified type, prefix,
        /// and attribute.
        /// </summary>
        /// <param name="parser">
        /// The parser of the request, which names the predicates and functions a statement may call.
        /// </param>
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
        protected virtual IEnumerable<string> GetSuggestions(WqlParser<TIndexItem> parser, WqlExpressionType type, string prefix, string attribute)
        {
            var items = new List<string>();

            switch (type)
            {
                case WqlExpressionType.Attribute:
                case WqlExpressionType.Predicate:
                case WqlExpressionType.Function:
                    var names = type switch
                    {
                        WqlExpressionType.Attribute => typeof(TIndexItem).GetProperties().Select(p => p.Name),
                        WqlExpressionType.Predicate => parser.PredicateNames,
                        _ => parser.FunctionNames
                    };

                    items.AddRange
                    (
                        names
                            .Where
                            (
                                name =>
                                prefix == null ||
                                name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                            )
                    );
                    break;
                case WqlExpressionType.Operator:

                    var operators = new List<string>
                    {
                        "~", "!~", "=", "!=", ">", "<", ">=", "<=", "is", "is not", "in", "not in",
                        "between", "not between", "starts with", "ends with", "contains"
                    };

                    items.AddRange
                    (
                        operators.Where
                        (
                            x =>
                            prefix == null ||
                            x.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                        )
                    );
                    break;
                case WqlExpressionType.Parameter:
                    items.AddRange
                    (
                        GetSuggestions(prefix, attribute)
                    );
                    break;
                case WqlExpressionType.LogicalOperator:

                    var logicOperators = new List<string>
                    {
                        "and", "or"
                    };

                    items.AddRange
                    (
                        logicOperators.Where
                        (
                            x =>
                            prefix == null ||
                            x.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                        )
                    );
                    break;
                case WqlExpressionType.Order:
                    items.AddRange
                    (
                        new[] { "order by" }.Where
                        (
                            x =>
                            prefix == null ||
                            x.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                        )
                    );
                    break;
                case WqlExpressionType.PartitioningOperator:
                    items.AddRange
                    (
                        new[] { "take", "skip" }.Where
                        (
                            x =>
                            prefix == null ||
                            x.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                        )
                    );
                    break;
                // punctuation cannot be typed partially, so it is offered without a prefix
                case WqlExpressionType.OpenParenthesis:
                    items.Add("(");
                    break;
                case WqlExpressionType.CloseParenthesis:
                    items.Add(")");
                    break;
                case WqlExpressionType.Separator:
                    items.Add(",");
                    break;
                default:
                    break;
            }

            return items;
        }

        /// <summary>
        /// Retrieves a collection of suggested strings that match the specified prefix 
        /// and are influenced by the provided attribute.
        /// </summary>
        /// <param name="prefix">The prefix used to filter suggestions. This parameter must not be null or empty.</param>
        /// <param name="attribute">
        /// The attribute the value is compared with, which affects the context or criteria for
        /// generating suggestions. It is null where a value belongs to no attribute, such as an
        /// argument of a predicate call like within("SD-12"), so an override must not rely on it.
        /// </param>
        /// <returns>
        /// An enumerable collection of strings containing suggestions that correspond
        /// to the given prefix and attribute. The collection will be empty if no suggestions are found.
        /// </returns>
        protected virtual IEnumerable<string> GetSuggestions(string prefix, string attribute)
        {
            return [];
        }
    }
}