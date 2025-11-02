using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies the text attribute of the corresponding dropdown in a REST API for the decorated class.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestDropdownTextAttribute : Attribute
    {
        /// <summary>
        /// Specifies the text attribute of a dropdown in a REST API response.
        /// </summary>
        public RestDropdownTextAttribute()
        {
        }
    }
}
