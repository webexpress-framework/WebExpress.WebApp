namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// The presentations a file view control offers out of the box.
    /// </summary>
    /// <remarks>
    /// The label and the glyph a switcher shows for a built-in view are owned by
    /// the client, so the two presentations stay described in one place instead
    /// of being spelled out again at every call site.
    /// </remarks>
    public enum TypeFileView
    {
        /// <summary>
        /// The tabular file list, which shows name, description, size and date
        /// side by side and is the presentation to scan a long set of files in.
        /// </summary>
        List,

        /// <summary>
        /// The tile presentation, which shows a card per file with a large
        /// preview and is the presentation to recognise images and documents by
        /// their appearance in.
        /// </summary>
        Tile
    }

    /// <summary>
    /// Extension methods for the <see cref="TypeFileView"/> enum.
    /// </summary>
    public static class TypeFileViewExtensions
    {
        /// <summary>
        /// Converts the view to its data attribute representation.
        /// </summary>
        /// <param name="view">The view to be converted.</param>
        /// <returns>The data attribute value corresponding to the view.</returns>
        public static string ToValue(this TypeFileView view)
        {
            return view switch
            {
                TypeFileView.Tile => "tile",
                _ => "list",
            };
        }
    }
}
