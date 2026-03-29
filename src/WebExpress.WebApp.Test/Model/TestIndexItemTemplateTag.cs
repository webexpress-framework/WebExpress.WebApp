using WebExpress.WebIndex;

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
        public Guid Id { get; set; }

        /// <summary>
        /// Returns or sets the collection of tags associated with the current entity.
        /// </summary>
        public IEnumerable<string> Tags1 { get; set; }

        /// <summary>
        /// Returns or sets the collection of tags associated with the current entity.
        /// </summary>
        public IEnumerable<string> Tags2 { get; set; }

        /// <summary>
        /// Returns or sets the collection of tags associated with the current entity.
        /// </summary>
        public IEnumerable<string> Tags3 { get; set; }
    }
}
