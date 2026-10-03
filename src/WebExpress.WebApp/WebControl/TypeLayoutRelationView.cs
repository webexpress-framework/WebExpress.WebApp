namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// The layout options for the relation surface.
    /// </summary>
    public enum TypeLayoutRelationView
    {
        /// <summary>
        /// The surface is a card: a bordered, rounded box with a filled toolbar,
        /// which sets it apart from whatever surrounds it. The default, for a
        /// page that shows the relations as one of several framed panels.
        /// </summary>
        Default,

        /// <summary>
        /// The surface is a flat section: no border, no card and no filled
        /// toolbar - only the quiet upper-case label with its count, a hairline
        /// running across the remaining width, and the relations below it. For a
        /// page that reads as one column of sections, where a second frame would
        /// claim a separation the content does not have.
        /// </summary>
        Flat
    }

    /// <summary>
    /// Extension methods for the <see cref="TypeLayoutRelationView"/> enum.
    /// </summary>
    public static class TypeLayoutRelationViewExtensions
    {
        /// <summary>
        /// Converts the layout to a CSS class.
        /// </summary>
        /// <param name="layout">The layout to be converted.</param>
        /// <returns>The CSS class corresponding to the layout, or an empty string for the default.</returns>
        public static string ToClass(this TypeLayoutRelationView layout)
        {
            return layout switch
            {
                TypeLayoutRelationView.Flat => "wx-relation-view-flat",
                _ => string.Empty,
            };
        }
    }
}
