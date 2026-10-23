using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// The state of a shared document at one version, written at regular intervals, so loading
    /// a document replays only the operations after it.
    /// </summary>
    public sealed class CollaborativeSnapshot
    {
        /// <summary>
        /// Returns the document id.
        /// </summary>
        public string Document { get; init; }

        /// <summary>
        /// Returns the document kind.
        /// </summary>
        public string Kind { get; init; }

        /// <summary>
        /// Returns the version the state belongs to.
        /// </summary>
        public long Version { get; init; }

        /// <summary>
        /// Returns the state as packed tokens.
        /// </summary>
        public JsonArray State { get; init; }

        /// <summary>
        /// Returns the first version whose operation is still kept for resuming clients.
        /// </summary>
        public long HistoryStart { get; init; }

        /// <summary>
        /// Returns what the server knows about each client, for recognizing repeated
        /// operations and impostors after a restart.
        /// </summary>
        public IReadOnlyDictionary<string, CollaborativeClient> Clients { get; init; } = new Dictionary<string, CollaborativeClient>();

        /// <summary>
        /// Converts the snapshot into JSON for a store.
        /// </summary>
        /// <returns>The JSON object.</returns>
        public JsonObject ToJson()
        {
            var clients = new JsonObject();

            foreach (var (id, client) in Clients)
            {
                clients[id] = client.ToJson();
            }

            return new JsonObject
            {
                ["document"] = Document,
                ["kind"] = Kind,
                ["version"] = Version,
                ["historyStart"] = HistoryStart,
                ["state"] = State.DeepClone(),
                ["clients"] = clients
            };
        }

        /// <summary>
        /// Reads a snapshot from JSON.
        /// </summary>
        /// <param name="json">The JSON object.</param>
        /// <returns>The snapshot.</returns>
        public static CollaborativeSnapshot FromJson(JsonObject json)
        {
            return new CollaborativeSnapshot
            {
                Document = (string)json["document"],
                Kind = (string)json["kind"],
                Version = (long)json["version"],
                HistoryStart = (long?)json["historyStart"] ?? 1,
                State = json["state"]?.DeepClone() as JsonArray ?? [],
                Clients = (json["clients"] as JsonObject)?
                    .Where(p => p.Value is JsonObject)
                    .ToDictionary(p => p.Key, p => CollaborativeClient.FromJson((JsonObject)p.Value)) ?? []
            };
        }
    }

    /// <summary>
    /// What the server keeps about one client of a shared document.
    /// </summary>
    public sealed class CollaborativeClient
    {
        /// <summary>
        /// Gets or sets the hash of the secret the client proves its identity with.
        /// </summary>
        public string SecretHash { get; set; }

        /// <summary>
        /// Gets or sets the running number of the client's last applied operation.
        /// </summary>
        public long LastSeq { get; set; }

        /// <summary>
        /// Gets or sets the version the client's last applied operation produced.
        /// </summary>
        public long LastVersion { get; set; }

        /// <summary>
        /// Gets or sets the newest version the client is known to hold.
        /// </summary>
        public long Seen { get; set; }

        /// <summary>
        /// Gets or sets when the client was last heard of, in UTC ticks.
        /// </summary>
        public long SeenAt { get; set; }

        /// <summary>
        /// Converts the record into JSON.
        /// </summary>
        /// <returns>The JSON object.</returns>
        public JsonObject ToJson()
        {
            return new JsonObject
            {
                ["secret"] = SecretHash,
                ["seq"] = LastSeq,
                ["version"] = LastVersion,
                ["seen"] = Seen,
                ["seenAt"] = SeenAt
            };
        }

        /// <summary>
        /// Reads a record from JSON.
        /// </summary>
        /// <param name="json">The JSON object.</param>
        /// <returns>The record.</returns>
        public static CollaborativeClient FromJson(JsonObject json)
        {
            return new CollaborativeClient
            {
                SecretHash = (string)json["secret"],
                LastSeq = (long?)json["seq"] ?? 0,
                LastVersion = (long?)json["version"] ?? 0,
                Seen = (long?)json["seen"] ?? 0,
                SeenAt = (long?)json["seenAt"] ?? 0
            };
        }
    }
}
