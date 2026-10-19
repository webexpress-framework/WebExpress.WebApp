using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using WebExpress.WebCore.WebCluster;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Keeps shared documents in the cluster store, so every instance of a cluster reads the
    /// same state and history and a document survives the restart of any one instance.
    /// </summary>
    /// <remarks>
    /// Each document is a scope of its own: the snapshot, the newest version and one entry per
    /// operation, keyed by its zero-padded version so the entries list in order.
    /// </remarks>
    public sealed class ClusterCollaborativeDocumentStore : ICollaborativeDocumentStore
    {
        private const string ScopePrefix = "webexpress.collaborative:";
        private const string OperationPrefix = "op/";
        private readonly IClusterStore _store;
        private readonly TimeSpan _lifetime;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="store">The cluster store.</param>
        /// <param name="lifetime">How long a document nobody writes to is kept; seven days by default.</param>
        public ClusterCollaborativeDocumentStore(IClusterStore store, TimeSpan? lifetime = null)
        {
            _store = store ?? throw new ArgumentNullException(nameof(store));
            _lifetime = lifetime ?? TimeSpan.FromDays(7);
        }

        /// <summary>
        /// Returns the newest version of a document.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <returns>The version, or -1.</returns>
        public long GetVersion(string document)
        {
            var value = _store.Get(Scope(document), "head");

            return value is null ? -1 : long.Parse(Encoding.UTF8.GetString(value), CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// Returns the newest snapshot of a document.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <returns>The snapshot, or null.</returns>
        public CollaborativeSnapshot LoadSnapshot(string document)
        {
            var value = _store.Get(Scope(document), "snapshot");

            return value is null ? null : CollaborativeSnapshot.FromJson(JsonNode.Parse(value).AsObject());
        }

        /// <summary>
        /// Stores a snapshot.
        /// </summary>
        /// <param name="snapshot">The snapshot.</param>
        public void SaveSnapshot(CollaborativeSnapshot snapshot)
        {
            var scope = Scope(snapshot.Document);

            _store.Set(scope, "snapshot", Encoding.UTF8.GetBytes(snapshot.ToJson().ToJsonString()), _lifetime);

            if (GetVersion(snapshot.Document) < snapshot.Version)
            {
                SetHead(scope, snapshot.Version);
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
            return [.. _store.List(Scope(document))
                .Where(x => x.Key.StartsWith(OperationPrefix, StringComparison.Ordinal))
                .Select(x => CollaborativeOperation.FromJson(JsonNode.Parse(x.Value).AsObject()))
                .Where(x => x.Version > afterVersion)
                .OrderBy(x => x.Version)];
        }

        /// <summary>
        /// Appends a sequenced operation.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <param name="operation">The operation.</param>
        public void AppendOperation(string document, CollaborativeOperation operation)
        {
            var scope = Scope(document);

            _store.Set(scope, Key(operation.Version), Encoding.UTF8.GetBytes(operation.ToJson().ToJsonString()), _lifetime);
            SetHead(scope, operation.Version);
        }

        /// <summary>
        /// Removes the operations up to and including a version.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <param name="upToVersion">The newest version to remove.</param>
        public void TrimOperations(string document, long upToVersion)
        {
            var scope = Scope(document);

            foreach (var key in _store.List(scope).Select(x => x.Key).Where(x => x.StartsWith(OperationPrefix, StringComparison.Ordinal)).ToList())
            {
                if (long.Parse(key[OperationPrefix.Length..], CultureInfo.InvariantCulture) <= upToVersion)
                {
                    _store.Remove(scope, key);
                }
            }
        }

        /// <summary>
        /// Writes the newest version.
        /// </summary>
        /// <param name="scope">The document scope.</param>
        /// <param name="version">The version.</param>
        private void SetHead(string scope, long version)
        {
            _store.Set(scope, "head", Encoding.UTF8.GetBytes(version.ToString(CultureInfo.InvariantCulture)), _lifetime);
        }

        /// <summary>
        /// Returns the store scope of a document.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <returns>The scope.</returns>
        private static string Scope(string document) => ScopePrefix + document;

        /// <summary>
        /// Returns the key of an operation.
        /// </summary>
        /// <param name="version">The version.</param>
        /// <returns>The key.</returns>
        private static string Key(long version) => OperationPrefix + version.ToString("D19", CultureInfo.InvariantCulture);
    }
}
