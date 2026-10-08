using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class of the endpoint the add dialog searches its targets
    /// through. It answers the same reference shape a link is built from, so a
    /// candidate the user picks needs no second lookup, and it answers something
    /// for an empty term as well - the suggestions the dialog shows before the
    /// user has typed anything.
    ///
    /// The relation type travels with the query, because which objects are
    /// sensible targets depends on it: a type restricted to certain classes
    /// should not offer the others in the first place.
    ///
    /// The contract is:
    /// <code>
    /// GET {base}?q=&amp;type=&amp;system=&amp;source=&amp;l= -> RestApiRelationReference[]
    /// </code>
    /// </summary>
    public abstract class RestApiRelationTarget : IRestApi
    {
        /// <summary>
        /// The number of candidates answered when the request names none. It is
        /// small because the list is a suggestion below a search field, not a
        /// browsable result.
        /// </summary>
        private const int DefaultLimit = 10;

        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        /// <summary>
        /// Handles <c>GET {base}</c>: answers the candidates for the target of a
        /// link.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                var search = request.GetParameter("q")?.Value ?? string.Empty;
                var type = request.GetParameter("type")?.Value;
                var system = request.GetParameter("system")?.Value;
                var source = request.GetParameter("source")?.Value;
                var limit = request.ParseIntParameter("l", DefaultLimit);

                var candidates = (RetrieveTargets(search.Trim(), type, system, request) ?? [])
                    .Where(x => x != null)
                    // the object a link is created from is never a target of
                    // itself, so it is dropped before the user can pick it
                    .Where(x => string.IsNullOrEmpty(source) || !string.Equals(x.Key, source, StringComparison.OrdinalIgnoreCase))
                    .Take(limit < 1 ? DefaultLimit : limit)
                    .ToList();

                return Json(candidates);
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Returns the candidates for a search term. An empty term asks for the
        /// suggestions the dialog opens with, which is where an implementation
        /// offers what the user recently touched rather than nothing.
        /// </summary>
        /// <param name="search">The search term, possibly empty.</param>
        /// <param name="type">The id of the relation type the link will carry, may be absent.</param>
        /// <param name="system">The id of the link system, may be absent.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The candidates.</returns>
        protected abstract IEnumerable<RestApiRelationReference> RetrieveTargets(string search, string type, string system, IRequest request);

        /// <summary>
        /// Builds an <c>application/json</c> 200 response containing the
        /// serialized payload.
        /// </summary>
        /// <param name="payload">The payload to serialize.</param>
        /// <returns>The HTTP response.</returns>
        private static IResponse Json(object payload)
        {
            var json = JsonSerializer.Serialize(payload, _jsonOptions);

            return new ResponseOK
            {
                Content = Encoding.UTF8.GetBytes(json)
            }
                .AddHeaderContentType("application/json");
        }
    }
}
