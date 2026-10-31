namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a selectable item of an embedded column template
    /// (selection, combo or move). The id is a free string, because it must
    /// match the cell values of the column rather than an entity key.
    /// </summary>
    public class RestApiTableColumnTemplateItem
    {
        /// <summary>
        /// Gets or sets the value of the item, matched against the cell value.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display text of the item.
        /// </summary>
        public string Text { get; set; }

        /// <summary>
        /// Gets or sets the optional color of the item label.
        /// </summary>
        public string Color { get; set; }
    }
}
