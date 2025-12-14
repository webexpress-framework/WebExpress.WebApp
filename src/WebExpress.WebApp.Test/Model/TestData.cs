using WebExpress.WebIndex;

namespace WebExpress.WebApp.Test.Model
{
    /// <summary>
    /// Represents a data object with a unique identifier and an associated 
    /// name for use in indexing or test scenarios.
    /// </summary>
    public class TestData : IIndexItem
    {
        /// <summary>
        /// Returns a new unique identifier each time the property is accessed.
        /// </summary>
        public Guid Id => Guid.NewGuid();

        /// <summary>
        /// Returns or sets the name associated with the object.
        /// </summary>
        public string Name { get; set; }
    }
}
