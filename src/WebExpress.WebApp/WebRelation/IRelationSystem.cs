using System.Collections.Generic;

namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// A registered link system: the origin a link is established against. Two
    /// systems are native - the application's own objects and plain external
    /// addresses - and a plugin registers further ones, for example an issue
    /// tracker or a wiki. A system is the unit the add dialog offers as an entry
    /// in its sidebar and the unit the validation resolves a target through.
    /// </summary>
    public interface IRelationSystem
    {
        /// <summary>
        /// Gets the stable id of the system, which is what a link stores in
        /// <see cref="Relation.System"/>.
        /// </summary>
        string Id { get; }

        /// <summary>
        /// Gets the display name of the system, or the i18n key it is translated
        /// through.
        /// </summary>
        string Label { get; }

        /// <summary>
        /// Gets the sentence the add dialog shows above the fields, explaining
        /// what a link in this system connects, or the i18n key of it.
        /// </summary>
        string Description { get; }

        /// <summary>
        /// Gets the category of the system, which decides whether a target is
        /// addressed by key or by address.
        /// </summary>
        RelationKind Kind { get; }

        /// <summary>
        /// Gets the short badge text of the system, at most three characters,
        /// rendered as the tile in the dialog sidebar.
        /// </summary>
        string Badge { get; }

        /// <summary>
        /// Gets the css color of the badge, which is what distinguishes the
        /// systems at a glance in the sidebar.
        /// </summary>
        string Color { get; }

        /// <summary>
        /// Gets the id of the plugin that contributed the system, or
        /// <see langword="null"/> for a native system. The dialog groups the
        /// native systems above the contributed ones, so the user sees at once
        /// what belongs to the application itself.
        /// </summary>
        string Plugin { get; }

        /// <summary>
        /// Gets the version of the contributing plugin, shown next to the entry.
        /// </summary>
        string Version { get; }

        /// <summary>
        /// Gets a value indicating whether the system currently accepts new
        /// links. A disabled system stays visible but is not offered, so its
        /// existing links keep rendering and the user understands why the entry
        /// cannot be picked.
        /// </summary>
        bool Enabled { get; }

        /// <summary>
        /// Gets the ids of the relation types the system offers. An empty
        /// enumeration means the system accepts every registered type, which is
        /// what a general purpose system such as the application's own objects
        /// does.
        /// </summary>
        IEnumerable<string> Types { get; }
    }
}
