using System.Collections.Generic;

namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// The default implementation of a link system, which a plugin instantiates
    /// and hands to <see cref="RelationRegistry.RegisterSystem"/> rather than writing
    /// its own type. The two native systems are exposed as constants here so a
    /// caller names them instead of repeating their id.
    /// </summary>
    public class RelationSystem : IRelationSystem
    {
        /// <summary>
        /// The id of the native system that links two items of the application.
        /// </summary>
        public const string Object = "webexpress.webapp.relation.object";

        /// <summary>
        /// The id of the native system that links an item to an external
        /// address.
        /// </summary>
        public const string Web = "webexpress.webapp.relation.web";

        /// <summary>
        /// Gets or sets the stable id of the system.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display name of the system, or the i18n key it is
        /// translated through.
        /// </summary>
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the sentence the add dialog shows above the fields, or
        /// the i18n key of it.
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// Gets or sets the category of the system.
        /// </summary>
        public RelationKind Kind { get; set; } = RelationKind.Object;

        /// <summary>
        /// Gets or sets the short badge text of the system.
        /// </summary>
        public string Badge { get; set; }

        /// <summary>
        /// Gets or sets the css color of the badge.
        /// </summary>
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets the id of the contributing plugin, or
        /// <see langword="null"/> for a native system.
        /// </summary>
        public string Plugin { get; set; }

        /// <summary>
        /// Gets or sets the version of the contributing plugin.
        /// </summary>
        public string Version { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the system accepts new links.
        /// </summary>
        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Gets the ids of the relation types the system offers. Left empty, the
        /// system accepts every registered type.
        /// </summary>
        public IList<string> Types { get; } = [];

        /// <summary>
        /// Gets the ids of the relation types the system offers.
        /// </summary>
        IEnumerable<string> IRelationSystem.Types => Types;
    }
}
