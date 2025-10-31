using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Indicates that the decorated property represents the primary attribute in a REST API response.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestListPrimaryAttribute : Attribute
    {
        /// <summary>
        /// Returns the name associated with the current column.
        /// </summary>
        public string Name { get; }

        /// <summary>
        /// Specifies the name of a property in a REST API response.
        /// </summary>
        /// <param name="name">The name of the property. This value cannot be null or empty.</param>
        public RestListPrimaryAttribute(string name)
        {
            Name = name;
        }
    }
}
