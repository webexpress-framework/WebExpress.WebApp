using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Indicates that a property should be excluded from the table column representation in a REST API response.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestTableColumnHiddenAttribute : Attribute
    {
        /// <summary>
        /// Specifies the name of a table column in a REST API response.
        /// </summary>
        public RestTableColumnHiddenAttribute()
        {
        }
    }
}
