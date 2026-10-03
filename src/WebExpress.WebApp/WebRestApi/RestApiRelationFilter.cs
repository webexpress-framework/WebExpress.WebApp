using System;
using WebExpress.WebApp.WebRelation;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The criteria a link query is narrowed by. The filter is handed to the
    /// implementation as one object rather than as a parameter list, so a further
    /// criterion does not change every override, and it is read from the request
    /// in one place, so every link endpoint understands the same query names.
    /// </summary>
    public class RestApiRelationFilter
    {
        /// <summary>
        /// Gets or sets the key of the object whose links are asked for. It is
        /// the source of the surface; a bidirectional link is answered for it
        /// even when the object is the stored target.
        /// </summary>
        public string Source { get; set; }

        /// <summary>
        /// Gets or sets the key of the object the links must point at.
        /// </summary>
        public string Target { get; set; }

        /// <summary>
        /// Gets or sets the id of the relation type the links must carry.
        /// </summary>
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets the id of the link system the links must belong to.
        /// </summary>
        public string System { get; set; }

        /// <summary>
        /// Gets or sets the status the links must be in.
        /// </summary>
        public RelationStatus? Status { get; set; }

        /// <summary>
        /// Gets or sets the category the links must belong to. It backs the two
        /// tabs of the surface; absent, both categories are answered, which is
        /// what the counts are computed from.
        /// </summary>
        public RelationKind? Kind { get; set; }

        /// <summary>
        /// Gets or sets the free text the links are searched by, matched against
        /// the key, the title and the note.
        /// </summary>
        public string Search { get; set; }

        /// <summary>
        /// Reads the filter from the query parameters of a request. Unknown
        /// tokens are ignored rather than rejected, so a stale bookmark still
        /// answers the unfiltered surface.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The filter.</returns>
        public static RestApiRelationFilter From(IRequest request)
        {
            var status = request?.GetParameter("status")?.Value;
            var kind = request?.GetParameter("kind")?.Value;

            return new RestApiRelationFilter
            {
                Source = Trim(request?.GetParameter("source")?.Value),
                Target = Trim(request?.GetParameter("target")?.Value),
                Type = Trim(request?.GetParameter("type")?.Value),
                System = Trim(request?.GetParameter("system")?.Value),
                Search = Trim(request?.GetParameter("q")?.Value),
                Status = string.IsNullOrWhiteSpace(status) ? null : RestApiRelationWire.Status(status),
                Kind = string.IsNullOrWhiteSpace(kind) ? null : RestApiRelationWire.Kind(kind)
            };
        }

        /// <summary>
        /// Returns the filter without its category criterion. The endpoint
        /// queries with it and narrows afterwards, because the surface shows the
        /// number of the category it is not displaying next to the one it is,
        /// and a query that already dropped the other category could not answer
        /// that number.
        /// </summary>
        /// <returns>The copy without the category.</returns>
        public RestApiRelationFilter WithoutKind()
        {
            return new RestApiRelationFilter
            {
                Source = Source,
                Target = Target,
                Type = Type,
                System = System,
                Status = Status,
                Search = Search
            };
        }

        /// <summary>
        /// Determines whether a link satisfies the filter, which is the shared
        /// in-memory fallback for an implementation that answers all links of an
        /// object and lets the endpoint narrow them.
        /// </summary>
        /// <param name="link">The link to test.</param>
        /// <param name="kind">The category the link belongs to.</param>
        /// <returns><see langword="true"/> when the link passes every criterion.</returns>
        public bool Matches(Relation link, RelationKind kind)
        {
            if (link == null)
            {
                return false;
            }

            if (Kind.HasValue && Kind.Value != kind)
            {
                return false;
            }

            if (Status.HasValue && Status.Value != link.Status)
            {
                return false;
            }

            if (!string.IsNullOrEmpty(Type) && !string.Equals(Type, link.Type, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!string.IsNullOrEmpty(System) && !string.Equals(System, link.System, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!string.IsNullOrEmpty(Target) && !string.Equals(Target, link.Target?.Key, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return string.IsNullOrEmpty(Search) || MatchesSearch(link);
        }

        /// <summary>
        /// Determines whether the free text matches one of the fields a person
        /// would search a link by.
        /// </summary>
        /// <param name="link">The link to test.</param>
        /// <returns><see langword="true"/> when the text was found.</returns>
        private bool MatchesSearch(Relation link)
        {
            return Contains(link.Target?.Key)
                || Contains(link.Target?.Title)
                || Contains(link.Target?.Uri)
                || Contains(link.Source?.Key)
                || Contains(link.Source?.Title)
                || Contains(link.Comment);
        }

        /// <summary>
        /// Determines whether a field carries the searched text.
        /// </summary>
        /// <param name="value">The field.</param>
        /// <returns><see langword="true"/> when the text was found.</returns>
        private bool Contains(string value)
        {
            return value != null && value.Contains(Search, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Normalises a query parameter, turning an empty value into an absent
        /// criterion.
        /// </summary>
        /// <param name="value">The raw parameter value.</param>
        /// <returns>The trimmed value, or <see langword="null"/>.</returns>
        private static string Trim(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
    }
}
