namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// The category of the two natively supported link systems. It decides how a
    /// link's target is addressed and therefore which surface the link renders
    /// in: an object link resolves to another item of the application, an
    /// external link to an address outside of it.
    /// </summary>
    public enum RelationKind
    {
        /// <summary>
        /// A relation between two abstract items of the application, addressed by
        /// the target's key.
        /// </summary>
        Object,

        /// <summary>
        /// A relation to an address outside of the application, addressed by its
        /// uri.
        /// </summary>
        External
    }
}
