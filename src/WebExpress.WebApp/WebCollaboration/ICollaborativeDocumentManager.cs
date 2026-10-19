using System;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebApp.WebMessageQueue;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Sequences the operations of shared documents. It is the single authority on the order of
    /// changes: it accepts an operation only on the current version, validates it against the
    /// document's schema, assigns the next version, stores it and distributes it. It never
    /// transforms; clients rebase their own changes onto what they missed.
    /// </summary>
    public interface ICollaborativeDocumentManager
    {
        /// <summary>
        /// Gets or sets the persistence of documents and their histories.
        /// </summary>
        ICollaborativeDocumentStore Store { get; set; }

        /// <summary>
        /// Gets or sets the optional policy checked in addition to the access token.
        /// </summary>
        ICollaborativeAccessPolicy AccessPolicy { get; set; }

        /// <summary>
        /// Gets or sets the optional source of initial document content.
        /// </summary>
        ICollaborativeDocumentProvider Provider { get; set; }

        /// <summary>
        /// Gets or sets after how many operations a snapshot is written.
        /// </summary>
        int SnapshotInterval { get; set; }

        /// <summary>
        /// Gets or sets how long a disconnected client may still resume from the history
        /// instead of receiving the complete state.
        /// </summary>
        TimeSpan Retention { get; set; }

        /// <summary>
        /// Adds the schema of a further document kind.
        /// </summary>
        /// <param name="schema">The schema.</param>
        void RegisterSchema(ICollaborativeSchema schema);

        /// <summary>
        /// Processes an operation message of a client.
        /// </summary>
        /// <param name="source">The socket the message arrived on.</param>
        /// <param name="rawPayload">The message as received.</param>
        /// <param name="cancellationToken">Cancels the processing.</param>
        /// <returns>A task that completes once all replies were sent.</returns>
        Task HandleAsync(IMessageQueueSocket source, string rawPayload, CancellationToken cancellationToken = default);

        /// <summary>
        /// Forgets a closed connection as a member of all documents.
        /// </summary>
        /// <param name="connectionId">The connection.</param>
        void Disconnect(Guid connectionId);
    }
}
