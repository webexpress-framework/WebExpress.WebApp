namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Specifies the mode of a form in a RESTful application.
    /// </summary>
    /// <remarks>This enumeration is used to indicate whether a form is being used to create a new resource or
    /// to edit an existing one.</remarks>
    public enum TypeRestFormMode
    {
        /// <summary>
        /// Represents the default value or behavior for the associated type or member.
        /// </summary>
        Default,

        /// <summary>
        /// Initializes a new instance of the class or creates a new object, depending on the context.
        /// </summary>
        /// <remarks>This member is typically used to indicate the creation of a new instance or object.</remarks>
        Add,

        /// <summary>
        /// Represents an operation to edit an existing entity or resource.
        /// </summary>
        Edit,

        /// <summary>
        /// Represents a delete operation or action.
        /// </summary>
        Delete
    }

    /// <summary>
    /// Provides extension methods for the <see cref="TypeRestFormMode"/> enumeration.
    /// </summary>
    public static class TypeRestFormModeExtensions
    {
        /// <summary>
        /// Converts the enumeration value to a string representation.
        /// </summary>
        /// <param name="mode">The mode to convert.</param>
        /// <returns>A string representation of the mode.</returns>
        public static string ToMode(this TypeRestFormMode mode)
        {
            return mode switch
            {
                TypeRestFormMode.Add => "new",
                TypeRestFormMode.Edit => "edit",
                TypeRestFormMode.Delete => "delete",
                _ => ""
            };
        }
    }
}
