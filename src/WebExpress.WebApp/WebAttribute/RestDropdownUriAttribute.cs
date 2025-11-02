using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies the uri attribute of the corresponding dropdown in a REST API for the decorated class.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestDropdownUriAttribute : Attribute
    {
        /// <summary>
        /// Specifies the uri attribute of a dropdown in a REST API response.
        /// </summary>
        public RestDropdownUriAttribute()
        {
        }
    }
}
