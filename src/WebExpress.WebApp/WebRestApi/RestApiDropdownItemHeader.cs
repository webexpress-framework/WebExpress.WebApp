namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// A non-clickable caption prepended to dropdown results to title the items below it,
    /// for example a "Recently opened" heading above dynamically loaded entries. It rides
    /// in the same stream as selectable items; the client renders it as a heading because
    /// its <see cref="RestApiDropdownItem.Type"/> is <see cref="RestApiDropdownItem.TypeHeader"/>.
    /// </summary>
    public class RestApiDropdownItemHeader : RestApiDropdownItem
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="text">The heading text, already localized by the caller.</param>
        public RestApiDropdownItemHeader(string text = null)
        {
            Type = TypeHeader;
            Text = text;
        }
    }
}
