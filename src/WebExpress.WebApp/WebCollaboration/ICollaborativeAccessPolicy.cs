using WebExpress.WebApp.WebMessageQueue;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Decides beyond the access token whether a connection may read or change a shared
    /// document, for applications whose permissions can change while a page stays open.
    /// </summary>
    public interface ICollaborativeAccessPolicy
    {
        /// <summary>
        /// Determines whether the session may receive the document.
        /// </summary>
        /// <param name="session">The connection's session.</param>
        /// <param name="document">The document id.</param>
        /// <returns>True if reading is allowed.</returns>
        bool CanRead(IClientSession session, string document);

        /// <summary>
        /// Determines whether the session may change the document.
        /// </summary>
        /// <param name="session">The connection's session.</param>
        /// <param name="document">The document id.</param>
        /// <returns>True if writing is allowed.</returns>
        bool CanWrite(IClientSession session, string document);
    }
}
