namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// The kind of change a data change message announces. The operation lets
    /// a client distinguish a structural change (create, delete) from a value
    /// change (update) without inspecting the data, for example to decide
    /// whether a paging total may have shifted.
    /// </summary>
    public enum DataChangeOperation
    {
        /// <summary>
        /// A new item was created.
        /// </summary>
        Created,

        /// <summary>
        /// An existing item was updated.
        /// </summary>
        Updated,

        /// <summary>
        /// An existing item was deleted.
        /// </summary>
        Deleted
    }
}
