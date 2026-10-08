using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebApp.WebRelation;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// One link as the link surface renders it. The item keeps both ends and
    /// marks with <see cref="Inverse"/> which of them the rendering object is,
    /// so the client picks the opposite end and the matching label without
    /// knowing the relation semantics.
    /// </summary>
    public class RestApiRelationItem
    {
        /// <summary>
        /// Gets or sets the identity of the link, which the update and the delete
        /// address.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the id of the link system the link belongs to.
        /// </summary>
        [JsonPropertyName("system")]
        public string System { get; set; }

        /// <summary>
        /// Gets or sets the id of the relation type.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets the direction token, <c>unidirectional</c> or
        /// <c>bidirectional</c>.
        /// </summary>
        [JsonPropertyName("direction")]
        public string Direction { get; set; }

        /// <summary>
        /// Gets or sets the status token, <c>active</c>, <c>confirmed</c> or
        /// <c>obsolete</c>.
        /// </summary>
        [JsonPropertyName("status")]
        public string Status { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the link is read from its
        /// target, in which case the surface renders the inverse label of the
        /// type and the source as the opposite end.
        /// </summary>
        [JsonPropertyName("inverse")]
        public bool Inverse { get; set; }

        /// <summary>
        /// Gets or sets the note explaining why the two ends belong together.
        /// </summary>
        [JsonPropertyName("comment")]
        public string Comment { get; set; }

        /// <summary>
        /// Gets or sets the moment the link was established, which the surface
        /// renders as the "since" of the row.
        /// </summary>
        [JsonPropertyName("created")]
        public DateTime Created { get; set; }

        /// <summary>
        /// Gets or sets the identity that established the link.
        /// </summary>
        [JsonPropertyName("createdBy")]
        public string CreatedBy { get; set; }

        /// <summary>
        /// Gets or sets the end the link was authored from.
        /// </summary>
        [JsonPropertyName("source")]
        public RestApiRelationReference Source { get; set; }

        /// <summary>
        /// Gets or sets the end the link points at.
        /// </summary>
        [JsonPropertyName("target")]
        public RestApiRelationReference Target { get; set; }

        /// <summary>
        /// Gets or sets the open key-value extension a plugin carries on its
        /// links. It is passed through untouched.
        /// </summary>
        [JsonPropertyName("metadata")]
        public IDictionary<string, string> Metadata { get; set; }

        /// <summary>
        /// Projects a link onto the wire, as read from the given object. The
        /// perspective decides the inverse flag, so the same stored link renders
        /// as "blocks" on one end and as "is blocked by" on the other.
        /// </summary>
        /// <param name="link">The link.</param>
        /// <param name="key">The key of the object the surface renders, may be absent.</param>
        /// <returns>The wire item, or <see langword="null"/> when the link is absent.</returns>
        public static RestApiRelationItem From(Relation link, string key = null)
        {
            return link == null ? null : new RestApiRelationItem
            {
                Id = link.Id,
                System = link.System,
                Type = link.Type,
                Direction = RestApiRelationWire.Token(link.Direction),
                Status = RestApiRelationWire.Token(link.Status),
                Inverse = key != null && link.IsInverseFor(key),
                Comment = link.Comment,
                Created = link.Created,
                CreatedBy = link.CreatedBy,
                Source = RestApiRelationReference.From(link.Source),
                Target = RestApiRelationReference.From(link.Target),
                Metadata = link.Metadata.Count > 0 ? new Dictionary<string, string>(link.Metadata) : null
            };
        }
    }
}
