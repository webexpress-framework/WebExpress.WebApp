namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// Determines whether a link is read from one side only or from both. The
    /// direction is a property of the single stored link rather than of the two
    /// objects, so a bidirectional relation is stored once and rendered on both
    /// ends through the inverse label of its type.
    /// </summary>
    public enum RelationDirection
    {
        /// <summary>
        /// The link is only visible on its source, for example a plain web link
        /// that the external address knows nothing about.
        /// </summary>
        Unidirectional,

        /// <summary>
        /// The link is visible on both ends, the target rendering it under the
        /// inverse label of its type.
        /// </summary>
        Bidirectional
    }
}
