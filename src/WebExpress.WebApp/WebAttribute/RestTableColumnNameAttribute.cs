using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies the name of the corresponding table column in a REST API for the decorated class.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestTableColumnNameAttribute : Attribute
    {
        /// <summary>
        /// Returns the name associated with the current column.
        /// </summary>
        public string Name { get; }

        /// <summary>
        /// Specifies the name of a table column in a REST API response.
        /// </summary>
        /// <param name="name">The name of the table column. This value cannot be null or empty.</param>
        public RestTableColumnNameAttribute(string name)
        {
            Name = name;
        }
    }
}
