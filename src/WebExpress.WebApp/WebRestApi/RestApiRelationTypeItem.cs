using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using WebExpress.WebApp.WebRelation;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// One relation type as the type administration renders it. Next to the
    /// registered definition it carries the usage count, because the question an
    /// administrator asks before deactivating or narrowing a type is how many
    /// links already depend on it.
    /// </summary>
    public class RestApiRelationTypeItem
    {
        /// <summary>
        /// Gets or sets the stable id of the type.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the label read from the source, already translated.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the label read from the target, already translated. It is
        /// empty for a type that exists only on the source.
        /// </summary>
        [JsonPropertyName("inverse")]
        public string Inverse { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether both ends are named alike.
        /// </summary>
        [JsonPropertyName("symmetric")]
        public bool Symmetric { get; set; }

        /// <summary>
        /// Gets or sets the id of the link system that offers the type.
        /// </summary>
        [JsonPropertyName("system")]
        public string System { get; set; }

        /// <summary>
        /// Gets or sets the classes a target may have. An empty list together
        /// with <see cref="AllClasses"/> reads as "all classes" in the table.
        /// </summary>
        [JsonPropertyName("targetClasses")]
        public IEnumerable<string> TargetClasses { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the type accepts every class.
        /// </summary>
        [JsonPropertyName("allClasses")]
        public bool AllClasses { get; set; }

        /// <summary>
        /// Gets or sets the cardinality token, in the <c>n:n</c> notation the
        /// table renders.
        /// </summary>
        [JsonPropertyName("cardinality")]
        public string Cardinality { get; set; }

        /// <summary>
        /// Gets or sets the workflow effect token.
        /// </summary>
        [JsonPropertyName("effect")]
        public string Effect { get; set; }

        /// <summary>
        /// Gets or sets the number of stored links of this type.
        /// </summary>
        [JsonPropertyName("usage")]
        public int Usage { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the type may still be used.
        /// </summary>
        [JsonPropertyName("active")]
        public bool Active { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the type is shipped by the
        /// framework or a plugin rather than created by an administrator. A
        /// shipped type is edited and deactivated but never deleted, so its
        /// existing links keep their meaning.
        /// </summary>
        [JsonPropertyName("builtin")]
        public bool Builtin { get; set; }

        /// <summary>
        /// Gets or sets the explanation shown to the person picking the type,
        /// already translated.
        /// </summary>
        [JsonPropertyName("description")]
        public string Description { get; set; }

        /// <summary>
        /// Gets or sets the position of the type in the administered order, which
        /// is also the order the link surface groups by.
        /// </summary>
        [JsonPropertyName("order")]
        public int Order { get; set; }

        /// <summary>
        /// Gets or sets the symbolic icon name of the relation.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Projects a registered type onto the wire. The labels are translated by
        /// the caller, which holds the culture of the request.
        /// </summary>
        /// <param name="type">The registered type.</param>
        /// <param name="label">The translated label.</param>
        /// <param name="inverse">The translated inverse label.</param>
        /// <param name="description">The translated description.</param>
        /// <returns>The wire item, or <see langword="null"/> when the type is absent.</returns>
        public static RestApiRelationTypeItem From(IRelationType type, string label, string inverse, string description)
        {
            if (type == null)
            {
                return null;
            }

            var classes = type.TargetClasses?.ToList() ?? [];

            return new RestApiRelationTypeItem
            {
                Id = type.Id,
                Label = label,
                Inverse = inverse,
                Symmetric = type.Symmetric,
                System = type.System,
                TargetClasses = classes,
                AllClasses = classes.Count == 0,
                Cardinality = RestApiRelationWire.Token(type.Cardinality),
                Effect = RestApiRelationWire.Token(type.Effect),
                Active = type.Active,
                Description = description,
                Icon = type.Icon,
                Order = type.Order
            };
        }
    }
}
