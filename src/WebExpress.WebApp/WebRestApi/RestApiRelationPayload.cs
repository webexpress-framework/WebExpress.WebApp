using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebApp.WebRelation;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The body of a create or update request of the link endpoint. It is one
    /// payload for both link categories, because the two natively supported
    /// systems share the generic entity: an object link fills the target fields,
    /// a web link fills the address and the title, and both may carry a note.
    /// </summary>
    public class RestApiRelationPayload
    {
        /// <summary>
        /// Gets or sets the id of the link system the link is created in.
        /// </summary>
        [JsonPropertyName("system")]
        public string System { get; set; }

        /// <summary>
        /// Gets or sets the id of the relation type.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets the key of the target object, for a link inside an object
        /// system.
        /// </summary>
        [JsonPropertyName("targetKey")]
        public string TargetKey { get; set; }

        /// <summary>
        /// Gets or sets the class of the target object, which the target class
        /// rules of the type are checked against.
        /// </summary>
        [JsonPropertyName("targetClass")]
        public string TargetClass { get; set; }

        /// <summary>
        /// Gets or sets the external address, for a link inside an external
        /// system.
        /// </summary>
        [JsonPropertyName("address")]
        public string Address { get; set; }

        /// <summary>
        /// Gets or sets the display title of the target, which an external link
        /// carries in place of a resolved object title.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the note explaining why the two ends belong together.
        /// </summary>
        [JsonPropertyName("comment")]
        public string Comment { get; set; }

        /// <summary>
        /// Gets or sets the direction token. Absent, the link is bidirectional,
        /// which is what an object relation usually is.
        /// </summary>
        [JsonPropertyName("direction")]
        public string Direction { get; set; }

        /// <summary>
        /// Gets or sets the status token. Absent, the link is active.
        /// </summary>
        [JsonPropertyName("status")]
        public string Status { get; set; }

        /// <summary>
        /// Gets or sets the open key-value extension of the link, which a plugin
        /// panel fills with whatever its system needs to carry.
        /// </summary>
        [JsonPropertyName("metadata")]
        public IDictionary<string, string> Metadata { get; set; }

        /// <summary>
        /// Builds the link the payload describes, from the object the surface was
        /// rendered on. The result is not yet validated; the endpoint hands it to
        /// <see cref="RelationRegistry.Validate"/> together with the neighbourhood it
        /// alone can resolve.
        /// </summary>
        /// <param name="source">The object the link is created from.</param>
        /// <returns>The link.</returns>
        public Relation ToLink(RelationReference source)
        {
            var link = new Relation
            {
                System = System,
                Type = Type,
                Direction = RestApiRelationWire.Direction(Direction),
                Status = RestApiRelationWire.Status(Status),
                Source = source,
                Comment = Comment,
                Target = new RelationReference
                {
                    Key = TargetKey,
                    Class = TargetClass,
                    Title = Title,
                    Uri = string.IsNullOrWhiteSpace(TargetKey) ? Address : null
                }
            };

            foreach (var entry in Metadata ?? new Dictionary<string, string>())
            {
                link.Metadata[entry.Key] = entry.Value;
            }

            return link;
        }
    }
}
