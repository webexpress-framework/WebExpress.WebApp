using WebExpress.WebApp.WebRelation;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a minimal in-memory implementation of
    /// <see cref="RestApiRelationType"/>. It administers its own catalog rather than
    /// the process wide registry, so a test cannot leak a relation into the next
    /// one.
    /// </summary>
    public sealed class TestRestApiRelationType : RestApiRelationType
    {
        private readonly List<IRelationType> _types;
        private readonly IDictionary<string, int> _usage;
        private readonly ISet<string> _builtin;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="seed">Optional seed of administered types.</param>
        /// <param name="usage">Optional usage counts by type id.</param>
        /// <param name="builtin">Optional ids of the types that are shipped by code.</param>
        public TestRestApiRelationType(IEnumerable<IRelationType> seed = null, IDictionary<string, int> usage = null, IEnumerable<string> builtin = null)
        {
            _types = seed?.ToList() ?? [];
            _usage = usage ?? new Dictionary<string, int>();
            _builtin = new HashSet<string>(builtin ?? [], StringComparer.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Gets the types currently held in memory.
        /// </summary>
        public IReadOnlyList<IRelationType> Types => _types;

        /// <summary>
        /// Gets the classes the editor offers as target classes.
        /// </summary>
        public IList<RestApiRelationClassItem> Classes { get; } =
        [
            new() { Id = "Bug", Label = "Bug" },
            new() { Id = "Change", Label = "Change" }
        ];

        /// <summary>
        /// Returns the administered types.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The types.</returns>
        protected override IEnumerable<IRelationType> RetrieveTypes(IRequest request) => _types;

        /// <summary>
        /// Stores a created or edited type, replacing an earlier version.
        /// </summary>
        /// <param name="type">The type to store.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The stored type.</returns>
        protected override IRelationType StoreType(RelationType type, IRequest request)
        {
            var index = _types.FindIndex(x => string.Equals(x.Id, type.Id, StringComparison.OrdinalIgnoreCase));

            if (index >= 0)
            {
                _types[index] = type;
            }
            else
            {
                _types.Add(type);
            }

            return type;
        }

        /// <summary>
        /// Removes a type.
        /// </summary>
        /// <param name="id">The id of the type.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>True when the type existed.</returns>
        protected override bool RemoveType(string id, IRequest request)
        {
            var type = _types.FirstOrDefault(x => string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase));

            return type != null && _types.Remove(type);
        }

        /// <summary>
        /// Returns how many stored links carry the type.
        /// </summary>
        /// <param name="id">The id of the type.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The number of links.</returns>
        protected override int RetrieveUsage(string id, IRequest request)
        {
            return _usage.TryGetValue(id, out var usage) ? usage : 0;
        }

        /// <summary>
        /// Returns the classes a type may accept as a target.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The classes.</returns>
        protected override IEnumerable<RestApiRelationClassItem> RetrieveClasses(IRequest request) => Classes;

        /// <summary>
        /// Determines whether a type is shipped by code.
        /// </summary>
        /// <param name="type">The type.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>True when the type is shipped.</returns>
        protected override bool IsBuiltin(IRelationType type, IRequest request) => _builtin.Contains(type.Id);
    }
}
