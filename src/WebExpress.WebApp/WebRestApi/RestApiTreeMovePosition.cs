namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Where a moved tree node is placed relative to the node it was dropped on.
    /// </summary>
    public enum RestApiTreeMovePosition
    {
        /// <summary>
        /// Before the target, among the target's siblings.
        /// </summary>
        Above,

        /// <summary>
        /// After the target, among the target's siblings.
        /// </summary>
        Below,

        /// <summary>
        /// As the last child of the target.
        /// </summary>
        Child
    }
}
