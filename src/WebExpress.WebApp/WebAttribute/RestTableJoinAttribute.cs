using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies that the decorated property represents a join to another table in a 
    /// REST-based data model.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestTableJoinAttribute : Attribute
    {
        /// <summary>
        /// Returns or sets the character used to separate items in the output.
        /// </summary>
        public char Separator { get; set; }

        /// <summary>
        /// Initializes a new instance of the class with the specified separator character.
        /// </summary>
        /// <param name="seprator">
        /// The character used to separate table names or fields in the join operation.
        /// </param>
        public RestTableJoinAttribute(char seprator)
        {
            Separator = seprator;
        }
    }
}
