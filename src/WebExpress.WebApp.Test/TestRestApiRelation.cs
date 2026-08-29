using WebExpress.WebApp.WebRelation;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a minimal in-memory implementation of <see cref="RestApiRelation"/>
    /// used to exercise the grouping, the perspective and the validation the
    /// base class performs.
    /// </summary>
    public sealed class TestRestApiRelation : RestApiRelation
    {
        private readonly List<Relation> _links;
        private readonly HashSet<string> _objects;
        private readonly RelationReference _subject;
        private int _sequence;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="subject">The object the surface belongs to, or null to answer none.</param>
        /// <param name="seed">Optional seed of pre-existing links.</param>
        /// <param name="objects">The keys the existence check resolves. When omitted, every key resolves.</param>
        public TestRestApiRelation(RelationReference subject = null, IEnumerable<Relation> seed = null, IEnumerable<string> objects = null)
        {
            _subject = subject;
            _links = seed?.ToList() ?? [];
            _objects = objects != null ? new HashSet<string>(objects, StringComparer.OrdinalIgnoreCase) : null;
        }

        /// <summary>
        /// Gets the links currently held in memory.
        /// </summary>
        public IReadOnlyList<Relation> Links => _links;

        /// <summary>
        /// Returns the object the surface belongs to.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The object, or null.</returns>
        protected override RelationReference RetrieveSubject(IRequest request) => _subject;

        /// <summary>
        /// Returns the links matching the filter, narrowed in memory.
        /// </summary>
        /// <param name="filter">The criteria.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The links.</returns>
        protected override IEnumerable<Relation> RetrieveLinks(RestApiRelationFilter filter, IRequest request)
        {
            return _links
                .Where(x => filter.Source == null || Touches(x, filter.Source))
                .Where(x => filter.Matches(x, KindOf(x)));
        }

        /// <summary>
        /// Returns a single stored link.
        /// </summary>
        /// <param name="id">The identity of the link.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The link, or null.</returns>
        protected override Relation RetrieveLink(string id, IRequest request)
        {
            return _links.FirstOrDefault(x => x.Id == id);
        }

        /// <summary>
        /// Stores a validated link under a generated identity.
        /// </summary>
        /// <param name="link">The validated link.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The stored link.</returns>
        protected override Relation CreateLink(Relation link, IRequest request)
        {
            link.Id = $"l{++_sequence}";
            _links.Add(link);

            return link;
        }

        /// <summary>
        /// Confirms the changes of a link that is already held by reference.
        /// </summary>
        /// <param name="link">The validated link.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The stored link.</returns>
        protected override Relation UpdateLink(Relation link, IRequest request) => link;

        /// <summary>
        /// Removes a link.
        /// </summary>
        /// <param name="id">The identity of the link.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>True when the link existed.</returns>
        protected override bool DeleteLink(string id, IRequest request)
        {
            var link = _links.FirstOrDefault(x => x.Id == id);

            return link != null && _links.Remove(link);
        }

        /// <summary>
        /// Resolves whether a referenced object exists.
        /// </summary>
        /// <param name="reference">The reference to resolve.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>True when the object exists.</returns>
        protected override bool Exists(RelationReference reference, IRequest request)
        {
            return _objects == null || !reference.IsObject() || _objects.Contains(reference.Key);
        }

        /// <summary>
        /// Determines whether a link touches an object with either of its ends.
        /// </summary>
        /// <param name="link">The link.</param>
        /// <param name="key">The key of the object.</param>
        /// <returns>True when one of the ends is the object.</returns>
        private static bool Touches(Relation link, string key)
        {
            return string.Equals(link.Source?.Key, key, StringComparison.OrdinalIgnoreCase)
                || string.Equals(link.Target?.Key, key, StringComparison.OrdinalIgnoreCase);
        }
    }
}
