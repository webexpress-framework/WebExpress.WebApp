using System;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Refuses a rest request for a reason the caller is meant to read.
    /// </summary>
    /// <remarks>
    /// <see cref="RestApiFault"/> keeps every exception out of the response, because an exception
    /// raised while handling a request usually describes the implementation rather than the
    /// request. A refusal is the opposite case: the application decided against the request - a
    /// workflow rule forbids a transition, a record was locked meanwhile - and the user can only
    /// act on that decision when they learn the reason. The message therefore travels to the
    /// client verbatim and must be written for the user: translated, free of internals, and
    /// revealing nothing the caller is not allowed to see.
    /// </remarks>
    public class RestApiRefusal : Exception
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="message">The reason shown to the user.</param>
        public RestApiRefusal(string message)
            : base(message)
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="message">The reason shown to the user.</param>
        /// <param name="innerException">
        /// The failure that led to the refusal. It stays on the server; only the message is sent.
        /// </param>
        public RestApiRefusal(string message, Exception innerException)
            : base(message, innerException)
        {
        }
    }
}
