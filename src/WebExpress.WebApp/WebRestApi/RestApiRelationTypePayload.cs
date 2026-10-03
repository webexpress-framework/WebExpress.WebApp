using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebApp.WebRelation;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The body of a create or update request of the type administration. It
    /// mirrors the fields of the type editor: both labels of the relation, the
    /// classes it accepts, its cardinality and its workflow effect.
    /// </summary>
    public class RestApiRelationTypePayload
    {
        /// <summary>
        /// Gets or sets the stable id of the type. On a create it may be absent,
        /// in which case the endpoint derives one from the label.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the label read from the source.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the label read from the target.
        /// </summary>
        [JsonPropertyName("inverse")]
        public string Inverse { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether both ends are named alike, in
        /// which case the inverse label follows the label.
        /// </summary>
        [JsonPropertyName("symmetric")]
        public bool Symmetric { get; set; }

        /// <summary>
        /// Gets or sets the id of the link system that offers the type. Absent,
        /// the type joins the native object system.
        /// </summary>
        [JsonPropertyName("system")]
        public string System { get; set; }

        /// <summary>
        /// Gets or sets the classes a target may have. An empty list accepts
        /// every class.
        /// </summary>
        [JsonPropertyName("targetClasses")]
        public IEnumerable<string> TargetClasses { get; set; }

        /// <summary>
        /// Gets or sets the cardinality token.
        /// </summary>
        [JsonPropertyName("cardinality")]
        public string Cardinality { get; set; }

        /// <summary>
        /// Gets or sets the workflow effect token.
        /// </summary>
        [JsonPropertyName("effect")]
        public string Effect { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the type may be used.
        /// </summary>
        [JsonPropertyName("active")]
        public bool Active { get; set; } = true;

        /// <summary>
        /// Gets or sets the explanation shown to the person picking the type.
        /// </summary>
        [JsonPropertyName("description")]
        public string Description { get; set; }

        /// <summary>
        /// Gets or sets the symbolic icon name of the relation. Absent, the
        /// generic link icon is used.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the position of the type in the administered order. The
        /// editor carries it through unchanged; the order itself is rearranged
        /// through the reorder request.
        /// </summary>
        [JsonPropertyName("order")]
        public int Order { get; set; }

        /// <summary>
        /// Builds the type the payload describes. A symmetric type takes its
        /// label for both ends, so the two sides cannot drift apart through the
        /// editor.
        /// </summary>
        /// <param name="id">The id to use, which the endpoint resolved.</param>
        /// <returns>The type.</returns>
        public RelationType ToRelationType(string id)
        {
            var type = new RelationType
            {
                Id = id,
                Label = Label,
                InverseLabel = Symmetric ? Label : Inverse,
                Symmetric = Symmetric,
                System = string.IsNullOrWhiteSpace(System) ? RelationSystem.Object : System,
                Cardinality = RestApiRelationWire.Cardinality(Cardinality),
                Effect = RestApiRelationWire.Effect(Effect),
                Active = Active,
                Description = Description,
                Icon = string.IsNullOrWhiteSpace(Icon) ? "link" : Icon,
                Order = Order
            };

            foreach (var targetClass in TargetClasses ?? [])
            {
                if (!string.IsNullOrWhiteSpace(targetClass))
                {
                    type.TargetClasses.Add(targetClass);
                }
            }

            return type;
        }
    }
}
