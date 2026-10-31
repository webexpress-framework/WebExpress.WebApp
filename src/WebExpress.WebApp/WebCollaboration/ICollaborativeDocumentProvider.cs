using System.Text.Json.Nodes;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Supplies the initial content of a shared document the server does not hold yet, for
    /// applications that load documents from their own storage. Without a provider, the first
    /// client with write access seeds the document with the content its page was rendered with.
    /// </summary>
    public interface ICollaborativeDocumentProvider
    {
        /// <summary>
        /// Returns the initial state of a document.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <param name="kind">The document kind the client announced.</param>
        /// <returns>The packed tokens, or null to let the first client seed the document.</returns>
        JsonArray GetInitialState(string document, string kind);
    }
}
