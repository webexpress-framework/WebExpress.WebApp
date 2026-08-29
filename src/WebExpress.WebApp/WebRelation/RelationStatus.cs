namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// The lifecycle state of a link. A link is never silently deleted when the
    /// relation it describes stops holding, because the fact that it once held
    /// is part of the history of both objects; it is marked obsolete instead.
    /// </summary>
    public enum RelationStatus
    {
        /// <summary>
        /// The relation holds and is rendered normally.
        /// </summary>
        Active,

        /// <summary>
        /// The relation was reviewed by a person and is trusted, which
        /// distinguishes a curated link from one an import or a heuristic
        /// proposed.
        /// </summary>
        Confirmed,

        /// <summary>
        /// The relation no longer holds. The link is kept for the history and
        /// rendered muted rather than removed.
        /// </summary>
        Obsolete
    }
}
