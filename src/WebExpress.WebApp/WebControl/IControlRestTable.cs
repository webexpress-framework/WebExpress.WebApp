using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control that provides table-like functionality for 
    /// REST-based user interfaces.
    /// </summary>
    public interface IControlRestTable : IControlRest
    {
        /// <summary>
        /// Retruns the number of items to display on each page in a 
        /// paginated collection.
        /// </summary>
        uint PageSize { get; }

        /// <summary>
        /// Returns the binding.
        /// </summary>
        IBinding Bind { get; }
    }
}
