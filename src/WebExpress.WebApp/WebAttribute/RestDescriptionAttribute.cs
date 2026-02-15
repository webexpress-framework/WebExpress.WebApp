using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Indicates that the decorated property represents the description attribute in a REST API response.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestDescriptionAttribute : Attribute
    {
        /// <summary>
        /// Specifies the name of a property in a REST API response.
        /// </summary>
        public RestDescriptionAttribute()
        {
        }
    }
}
