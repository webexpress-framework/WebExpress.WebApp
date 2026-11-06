namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Specifies what a rest form does once the server accepted it, after its own success
    /// handling - closing the dialog, showing the confirmation - has run.
    /// </summary>
    public enum TypeRestFormSuccess
    {
        /// <summary>
        /// The form stays on the page; a dialog around it closes.
        /// </summary>
        None,

        /// <summary>
        /// The page reloads, so everything it shows reflects the saved record.
        /// </summary>
        Reload,

        /// <summary>
        /// The browser follows the <c>uri</c> of the json answer, such as the page of a record
        /// that was just created or cloned.
        /// </summary>
        FollowUri
    }

    /// <summary>
    /// Provides extension methods for the <see cref="TypeRestFormSuccess"/> enumeration.
    /// </summary>
    public static class TypeRestFormSuccessExtensions
    {
        /// <summary>
        /// Returns the value the client reads from the form's data-wx-success attribute.
        /// </summary>
        /// <param name="success">The success action.</param>
        /// <returns>The attribute value, or null for none.</returns>
        public static string ToValue(this TypeRestFormSuccess success)
        {
            return success switch
            {
                TypeRestFormSuccess.Reload => "reload",
                TypeRestFormSuccess.FollowUri => "follow-uri",
                _ => null
            };
        }
    }
}
