using System.Text.Json.Serialization;
using WebExpress.WebApp.WebRelation;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// One end of a link on the wire, and at the same time the shape the target
    /// search answers with, so a candidate the user picks in the add dialog is
    /// already the reference the link is created from.
    /// </summary>
    public class RestApiRelationReference
    {
        /// <summary>
        /// Gets or sets the business key of the referenced item, empty for an
        /// external address.
        /// </summary>
        [JsonPropertyName("key")]
        public string Key { get; set; }

        /// <summary>
        /// Gets or sets the class of the referenced item, which is what the
        /// target class rules of a type are checked against.
        /// </summary>
        [JsonPropertyName("class")]
        public string Class { get; set; }

        /// <summary>
        /// Gets or sets the display title of the referenced item.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the address the reference resolves to.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the workflow state rendered next to the link.
        /// </summary>
        [JsonPropertyName("status")]
        public string Status { get; set; }

        /// <summary>
        /// Gets or sets the semantic color token of the status.
        /// </summary>
        [JsonPropertyName("statusColor")]
        public string StatusColor { get; set; }

        /// <summary>
        /// Projects a domain reference onto the wire.
        /// </summary>
        /// <param name="reference">The reference, may be absent.</param>
        /// <returns>The wire reference, or <see langword="null"/>.</returns>
        public static RestApiRelationReference From(RelationReference reference)
        {
            return reference == null ? null : new RestApiRelationReference
            {
                Key = reference.Key,
                Class = reference.Class,
                Title = reference.Title,
                Uri = reference.Uri,
                Status = reference.Status,
                StatusColor = reference.StatusColor
            };
        }

        /// <summary>
        /// Reads a wire reference back into the domain.
        /// </summary>
        /// <returns>The domain reference.</returns>
        public RelationReference ToRelationReference()
        {
            return new RelationReference
            {
                Key = Key,
                Class = Class,
                Title = Title,
                Uri = Uri,
                Status = Status,
                StatusColor = StatusColor
            };
        }
    }
}
