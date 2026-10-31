namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// A visual separator that breaks the dropdown item stream into groups, for instance
    /// between a pinned section and the remaining results. The client renders it as a
    /// divider because its <see cref="RestApiDropdownItem.Type"/> is
    /// <see cref="RestApiDropdownItem.TypeDivider"/>.
    /// </summary>
    public class RestApiDropdownItemDivider : RestApiDropdownItem
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiDropdownItemDivider()
        {
            Type = TypeDivider;
        }
    }
}
