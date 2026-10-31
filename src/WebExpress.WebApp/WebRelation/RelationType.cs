using System.Collections.Generic;

namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// The default implementation of a relation type, which a plugin instantiates
    /// and hands to <see cref="RelationRegistry.RegisterType"/>, and which the type
    /// administration surface creates and edits. The ids of the natively shipped
    /// types are exposed as constants so a caller names them instead of repeating
    /// the string.
    /// </summary>
    public class RelationType : IRelationType
    {
        /// <summary>
        /// The id of the native "blocks" relation.
        /// </summary>
        public const string Blocks = "blocks";

        /// <summary>
        /// The id of the native "causes" relation.
        /// </summary>
        public const string Causes = "causes";

        /// <summary>
        /// The id of the native "references" relation.
        /// </summary>
        public const string References = "references";

        /// <summary>
        /// The id of the native "similar to" relation.
        /// </summary>
        public const string Similar = "similar";

        /// <summary>
        /// The id of the native "duplicate of" relation.
        /// </summary>
        public const string Duplicate = "duplicate";

        /// <summary>
        /// The id of the native "parent of" relation.
        /// </summary>
        public const string Parent = "parent";

        /// <summary>
        /// The id of the native "replaces" relation.
        /// </summary>
        public const string Replaces = "replaces";

        /// <summary>
        /// The id of the native web link relation, the only type of the external
        /// system.
        /// </summary>
        public const string WebLink = "weblink";

        /// <summary>
        /// Gets or sets the stable id of the type.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the label read from the source, or the i18n key it is
        /// translated through.
        /// </summary>
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the label read from the target, or the i18n key it is
        /// translated through.
        /// </summary>
        public string InverseLabel { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether both ends are named alike.
        /// </summary>
        public bool Symmetric { get; set; }

        /// <summary>
        /// Gets or sets the id of the link system that offers the type.
        /// </summary>
        public string System { get; set; } = RelationSystem.Object;

        /// <summary>
        /// Gets the classes a target may have. Left empty, every class is
        /// accepted.
        /// </summary>
        public IList<string> TargetClasses { get; } = [];

        /// <summary>
        /// Gets the classes a target may have.
        /// </summary>
        IEnumerable<string> IRelationType.TargetClasses => TargetClasses;

        /// <summary>
        /// Gets or sets how many links of the type may meet at each end.
        /// </summary>
        public RelationCardinality Cardinality { get; set; } = RelationCardinality.ManyToMany;

        /// <summary>
        /// Gets or sets the effect a link of the type has on the workflow of its
        /// source.
        /// </summary>
        public RelationEffect Effect { get; set; } = RelationEffect.None;

        /// <summary>
        /// Gets or sets a value indicating whether the type may still be used.
        /// </summary>
        public bool Active { get; set; } = true;

        /// <summary>
        /// Gets or sets the symbolic icon name the link surface renders next to
        /// the group heading of the relation.
        /// </summary>
        public string Icon { get; set; } = "link";

        /// <summary>
        /// Gets or sets the position of the type in the administered order.
        /// </summary>
        public int Order { get; set; }

        /// <summary>
        /// Gets or sets the explanation shown to the person picking the type, or
        /// the i18n key of it.
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// Returns the label that applies when the link is read from the given
        /// end. A symmetric type reads alike from both, so it answers its label
        /// either way.
        /// </summary>
        /// <param name="inverse">Whether the link is read from its target.</param>
        /// <returns>The applicable label.</returns>
        public string LabelFor(bool inverse)
        {
            return inverse && !Symmetric ? (InverseLabel ?? Label) : Label;
        }
    }
}
