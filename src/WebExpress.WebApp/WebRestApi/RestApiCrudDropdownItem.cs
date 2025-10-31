using System;
using WebExpress.WebCore.WebUri;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a lightweight DTO for dropdown entries returned by a REST endpoint.
    /// </summary>
    public class RestApiCrudDropdownItem : IRestApiCrudDropdownItem
    {
        /// <summary>
        /// Returns or sets the unique item identifier.
        /// </summary>
        public Guid Id { get; set; }

        /// <summary>
        /// Returns or sets the display text of the item.
        /// </summary>
        public string Text { get; set; }

        /// <summary>
        /// Returns or sets the target uri for the item.
        /// </summary>
        public IUri Uri { get; set; }
    }
}
