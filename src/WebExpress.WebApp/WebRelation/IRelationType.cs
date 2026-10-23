using System.Collections.Generic;

namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// A registered relation type: the meaning of a link, together with the rules
    /// that decide where it may be established. A type owns both labels of the
    /// relation - the one read from the source and the one read from the target -
    /// because a relation is one fact told from two sides, and storing it once
    /// keeps the two sides from drifting apart.
    /// </summary>
    public interface IRelationType
    {
        /// <summary>
        /// Gets the stable id of the type, which is what a link stores in
        /// <see cref="Relation.Type"/>.
        /// </summary>
        string Id { get; }

        /// <summary>
        /// Gets the label read from the source, for example <c>blocks</c>, or the
        /// i18n key it is translated through.
        /// </summary>
        string Label { get; }

        /// <summary>
        /// Gets the label read from the target, for example <c>is blocked by</c>,
        /// or the i18n key it is translated through. It is empty for a type that
        /// exists only on the source, which is what a plain web link is.
        /// </summary>
        string InverseLabel { get; }

        /// <summary>
        /// Gets a value indicating whether both ends are named alike, which makes
        /// the relation reciprocal - "similar to" reads the same from either
        /// side.
        /// </summary>
        bool Symmetric { get; }

        /// <summary>
        /// Gets the id of the link system that offers the type.
        /// </summary>
        string System { get; }

        /// <summary>
        /// Gets the classes a target may have. An empty enumeration means every
        /// class is accepted, which is what the surface renders as "all classes".
        /// </summary>
        IEnumerable<string> TargetClasses { get; }

        /// <summary>
        /// Gets how many links of the type may meet at each end.
        /// </summary>
        RelationCardinality Cardinality { get; }

        /// <summary>
        /// Gets the effect a link of the type has on the workflow of its source.
        /// </summary>
        RelationEffect Effect { get; }

        /// <summary>
        /// Gets a value indicating whether the type may still be used. A
        /// deactivated type keeps rendering its existing links but is no longer
        /// offered, which is how a relation is retired without rewriting history.
        /// </summary>
        bool Active { get; }

        /// <summary>
        /// Gets the symbolic icon name the link surface renders next to the
        /// group heading of the relation.
        /// </summary>
        string Icon { get; }

        /// <summary>
        /// Gets the position of the type in the administered order. The order is
        /// a property of the type rather than of a surface, so the type table,
        /// the link surface and the type picker of the add dialog all list the
        /// relations in the sequence an administrator arranged them in.
        /// </summary>
        int Order { get; }

        /// <summary>
        /// Gets the explanation shown to the person picking the type, or the
        /// i18n key of it.
        /// </summary>
        string Description { get; }
    }
}
