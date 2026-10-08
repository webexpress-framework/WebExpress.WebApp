using System;
using System.Collections.Generic;

namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// The generic relation entity of the hybrid link system. One instance
    /// describes one semantic connection between a source and a target, whatever
    /// that connection means: an object relation such as blocks, causes or is a
    /// duplicate of, or a plain web link to an address outside the application.
    ///
    /// The entity is generic on purpose. The meaning of a link lives in its
    /// registered <see cref="Type"/> and its <see cref="System"/>, never in a
    /// subclass, so a plugin adds a relation by registering a type rather than by
    /// extending the model - and the application, which only interprets this
    /// structure, needs no change to render it.
    /// </summary>
    public class Relation
    {
        /// <summary>
        /// Gets or sets the identity of the link. It addresses the link itself,
        /// which is what the update and the delete of the REST contract operate
        /// on, and is independent of the two ends.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the id of the link system that owns the link, for
        /// example <see cref="RelationSystem.Object"/> or a plugin's own system. The
        /// system decides how a target is addressed and resolved.
        /// </summary>
        public string System { get; set; }

        /// <summary>
        /// Gets or sets the id of the registered relation type that classifies
        /// the link, for example <c>blocks</c>. The type carries the label, the
        /// inverse label, the accepted classes, the cardinality and the workflow
        /// effect.
        /// </summary>
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets whether the link is read from its source only or from
        /// both ends.
        /// </summary>
        public RelationDirection Direction { get; set; } = RelationDirection.Bidirectional;

        /// <summary>
        /// Gets or sets the lifecycle state of the link.
        /// </summary>
        public RelationStatus Status { get; set; } = RelationStatus.Active;

        /// <summary>
        /// Gets or sets the end the link is authored from. The source is the
        /// object whose surface the link was created on, which is what decides
        /// which of the two type labels is rendered on which end.
        /// </summary>
        public RelationReference Source { get; set; }

        /// <summary>
        /// Gets or sets the end the link points at. For an external system the
        /// target carries the address and the title instead of a key.
        /// </summary>
        public RelationReference Target { get; set; }

        /// <summary>
        /// Gets or sets the free text note explaining why the two ends belong
        /// together. It is the one field the person creating the link writes in
        /// their own words, and it is shared by both link categories.
        /// </summary>
        public string Comment { get; set; }

        /// <summary>
        /// Gets or sets the moment the link was established, which is the "since"
        /// the link surface renders.
        /// </summary>
        public DateTime Created { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Gets or sets the identity that established the link.
        /// </summary>
        public string CreatedBy { get; set; }

        /// <summary>
        /// Gets the open key-value extension of the link. It is the seam a plugin
        /// uses to carry system specific facts - a pull request number, a page
        /// version, a synchronisation timestamp - without a schema change, and it
        /// is passed through untouched by the application.
        /// </summary>
        public IDictionary<string, string> Metadata { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Returns the end opposite to the given one, so a caller that holds the
        /// object a link was rendered on gets the other side without repeating
        /// the comparison.
        /// </summary>
        /// <param name="key">The key of the end the caller holds.</param>
        /// <returns>The opposite end, or the target when the key matches neither.</returns>
        public RelationReference Opposite(string key)
        {
            return string.Equals(Target?.Key, key, StringComparison.OrdinalIgnoreCase) ? Source : Target;
        }

        /// <summary>
        /// Determines whether the link is rendered under the inverse label of its
        /// type for the given object, which is the case on the target end of a
        /// bidirectional link.
        /// </summary>
        /// <param name="key">The key of the object the link is rendered on.</param>
        /// <returns><see langword="true"/> when the inverse label applies.</returns>
        public bool IsInverseFor(string key)
        {
            return Direction == RelationDirection.Bidirectional
                && string.Equals(Target?.Key, key, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Returns the link in a form that identifies it in a log or an error
        /// message.
        /// </summary>
        /// <returns>The two ends joined by the type.</returns>
        public override string ToString()
        {
            return $"{Source} -{Type}-> {Target}";
        }
    }
}
