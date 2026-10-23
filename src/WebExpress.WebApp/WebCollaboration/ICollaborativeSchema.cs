using System.Collections.Generic;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Decides which documents of one kind are valid. The server checks every operation's
    /// result against the schema of its document, so a manipulated client can neither break
    /// the structure nor smuggle in markup, unsafe addresses or styles.
    /// </summary>
    /// <remarks>
    /// A schema must accept exactly what the client-side check of the same kind accepts. A
    /// laxer server would sequence documents the clients refuse to show; a stricter one rejects
    /// edits the user already sees, which the client then offers back as a conflict.
    /// </remarks>
    public interface ICollaborativeSchema
    {
        /// <summary>
        /// Returns the document kind, as the shared controls name it ("richtext", "text", "graph", "spreadsheet").
        /// </summary>
        string Kind { get; }

        /// <summary>
        /// Checks a document.
        /// </summary>
        /// <param name="tokens">The tokens of the document.</param>
        /// <param name="reason">The violated rule, for logs.</param>
        /// <returns>True if the document is valid.</returns>
        bool Validate(IReadOnlyList<OtToken> tokens, out string reason);
    }
}
