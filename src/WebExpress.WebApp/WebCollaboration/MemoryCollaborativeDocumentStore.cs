using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Keeps shared documents in the process. Documents survive as long as the server runs,
    /// which suits a single instance without durable requirements and the tests.
    /// </summary>
    public sealed class MemoryCollaborativeDocumentStore : ICollaborativeDocumentStore
    {
        private readonly ConcurrentDictionary<string, Entry> _documents = new(StringComparer.Ordinal);

        /// <summary>
        /// The stored data of one document.
        /// </summary>
        private sealed class Entry
        {
            public CollaborativeSnapshot Snapshot;
            public readonly SortedList<long, CollaborativeOperation> Operations = [];
            public long Version = -1;
        }

        /// <summary>
        /// Returns the newest version of a document.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <returns>The version, or -1 for an unknown document.</returns>
        public long GetVersion(string document)
        {
            if (!_documents.TryGetValue(document, out var entry))
            {
                return -1;
            }

            lock (entry)
            {
                return entry.Version;
            }
        }

        /// <summary>
        /// Returns the newest snapshot of a document.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <returns>The snapshot, or null.</returns>
        public CollaborativeSnapshot LoadSnapshot(string document)
        {
            if (!_documents.TryGetValue(document, out var entry))
            {
                return null;
            }

            lock (entry)
            {
                return entry.Snapshot;
            }
        }

        /// <summary>
        /// Stores a snapshot.
        /// </summary>
        /// <param name="snapshot">The snapshot.</param>
        public void SaveSnapshot(CollaborativeSnapshot snapshot)
        {
            var entry = _documents.GetOrAdd(snapshot.Document, _ => new Entry());

            lock (entry)
            {
                entry.Snapshot = CollaborativeSnapshot.FromJson(snapshot.ToJson());
                entry.Version = Math.Max(entry.Version, snapshot.Version);
            }
        }

        /// <summary>
        /// Returns the kept operations after a version.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <param name="afterVersion">The version the caller already has.</param>
        /// <returns>The operations, ascending.</returns>
        public IReadOnlyList<CollaborativeOperation> LoadOperations(string document, long afterVersion)
        {
            if (!_documents.TryGetValue(document, out var entry))
            {
                return [];
            }

            lock (entry)
            {
                return [.. entry.Operations.Values.Where(x => x.Version > afterVersion)];
            }
        }

        /// <summary>
        /// Appends a sequenced operation.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <param name="operation">The operation.</param>
        public void AppendOperation(string document, CollaborativeOperation operation)
        {
            var entry = _documents.GetOrAdd(document, _ => new Entry());

            lock (entry)
            {
                entry.Operations[operation.Version] = operation;
                entry.Version = Math.Max(entry.Version, operation.Version);
            }
        }

        /// <summary>
        /// Removes the operations up to and including a version.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <param name="upToVersion">The newest version to remove.</param>
        public void TrimOperations(string document, long upToVersion)
        {
            if (!_documents.TryGetValue(document, out var entry))
            {
                return;
            }

            lock (entry)
            {
                while (entry.Operations.Count > 0 && entry.Operations.Keys[0] <= upToVersion)
                {
                    entry.Operations.RemoveAt(0);
                }
            }
        }
    }
}
