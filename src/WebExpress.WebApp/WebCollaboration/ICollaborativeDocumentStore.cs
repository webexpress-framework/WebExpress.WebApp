using System.Collections.Generic;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Persists shared documents: snapshots at regular intervals and the operation history
    /// after them. The store is exchangeable, so an application can keep documents in its own
    /// database; the default keeps them in memory, or in the cluster store while several
    /// instances share one.
    /// </summary>
    /// <remarks>
    /// The sequencer serializes all writes of one document, across instances by a cluster-wide
    /// lock, so implementations need no locking of their own beyond thread safety.
    /// </remarks>
    public interface ICollaborativeDocumentStore
    {
        /// <summary>
        /// Returns the newest version of a document.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <returns>The version, or -1 for an unknown document.</returns>
        long GetVersion(string document);

        /// <summary>
        /// Returns the newest snapshot of a document.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <returns>The snapshot, or null for an unknown document.</returns>
        CollaborativeSnapshot LoadSnapshot(string document);

        /// <summary>
        /// Stores a snapshot, replacing the previous one.
        /// </summary>
        /// <param name="snapshot">The snapshot.</param>
        void SaveSnapshot(CollaborativeSnapshot snapshot);

        /// <summary>
        /// Returns the kept operations after a version, ascending.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <param name="afterVersion">The version the caller already has.</param>
        /// <returns>The operations.</returns>
        IReadOnlyList<CollaborativeOperation> LoadOperations(string document, long afterVersion);

        /// <summary>
        /// Appends a sequenced operation and makes its version the newest.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <param name="operation">The operation.</param>
        void AppendOperation(string document, CollaborativeOperation operation);

        /// <summary>
        /// Removes the operations up to and including a version, which no client can need any more.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <param name="upToVersion">The newest version to remove.</param>
        void TrimOperations(string document, long upToVersion);
    }
}
