using System;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Signals a step or a document the shared document format does not allow.
    /// </summary>
    public sealed class OtException : Exception
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="message">The reason, for logs only; clients learn just that it was invalid.</param>
        public OtException(string message)
            : base(message)
        {
        }
    }
}
