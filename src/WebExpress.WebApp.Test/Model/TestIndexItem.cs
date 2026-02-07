using WebExpress.WebApp.WebAttribute;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebUri;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.Test.Model
{
    /// <summary>
    /// Represents an item in a test index, providing key information, state, 
    /// and associated metadata for display and identification purposes.
    /// </summary>
    public class TestIndexItem : IIndexItem
    {
        /// <summary>
        /// Returns or sets the unique identifier of the current entity.
        /// </summary>
        [RestTableColumnHidden]
        public Guid Id { get; set; }

        /// <summary>
        /// Retuens or sets the unique key associated with the current entity.
        /// </summary>
        [RestTableColumnName("Key")]
        public string Key { get; set; }

        /// <summary>
        /// Returns or sets the collection of names associated with the current entity.
        /// </summary>
        [RestTableColumnName("Names")]
        public IEnumerable<string> Names { get; set; }

        /// <summary>
        /// Returns or sets the state of the current entity.
        /// </summary>
        [RestTableColumnName("State")]
        public string State { get; set; }

        /// <summary>
        /// Returns or sets the description of the current entity.
        /// </summary>
        [RestTableColumnName("Description")]
        [RestTableColumnHidden]
        public string Description { get; set; }

        /// <summary>
        /// Returns or sets the icon associated with the table row.
        /// </summary>
        [RestTableRowIcon]
        public IIcon Icon { get; set; }

        /// <summary>
        /// Returns or sets the URI associated with the table row.
        /// </summary>
        public IUri Uri { get; set; }
    }
}
