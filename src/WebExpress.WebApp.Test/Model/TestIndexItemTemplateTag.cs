using WebExpress.WebApp.WebAttribute;
using WebExpress.WebIndex;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.Test.Model
{
    /// <summary>
    /// Represents an index item that contains a unique identifier and a collection 
    /// of associated names for testing purposes.
    /// </summary>
    public class TestIndexItemTemplateTag : IIndexItem
    {
        /// <summary>
        /// Returns or sets the unique identifier of the current entity.
        /// </summary>
        [RestTableColumnHidden]
        public Guid Id { get; set; }

        /// <summary>
        /// Returns or sets the collection of tags associated with the current entity.
        /// </summary>
        [RestTableColumnName("Tags1")]
        [RestApiTableColumnTemplateTag(true)]
        [RestTableJoin(';')]
        public IEnumerable<string> Tags1 { get; set; }

        /// <summary>
        /// Returns or sets the collection of tags associated with the current entity.
        /// </summary>
        [RestTableColumnName("Tags2")]
        [RestApiTableColumnTemplateTag(color: TypeColorTag.Warning)]
        [RestTableJoin(';')]
        public IEnumerable<string> Tags2 { get; set; }

        /// <summary>
        /// Returns or sets the collection of tags associated with the current entity.
        /// </summary>
        [RestTableColumnName("Tags3")]
        [RestApiTableColumnTemplateTag(placeholder: "hello webexpress")]
        [RestTableJoin(';')]
        public IEnumerable<string> Tags3 { get; set; }
    }
}
