using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebCluster;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// The default sequencer of shared documents.
    /// </summary>
    /// <remarks>
    /// Messages of one document are processed one at a time: within an instance by a gate per
    /// document, across the instances of a cluster additionally by a cluster-wide lock around
    /// every write, so exactly one place sequences a document at any time. The current state
    /// is cached per instance and brought up to date from the store whenever another instance
    /// advanced it. Accepted operations reach the members connected to this instance directly
    /// and the members of the other instances over the cluster bus.
    /// </remarks>
    public sealed class CollaborativeDocumentManager : ICollaborativeDocumentManager, IDisposable
    {
        /// <summary>
        /// The protocol version this server speaks.
        /// </summary>
        public const int Protocol = 1;

        /// <summary>
        /// The bus topic accepted operations travel on between instances.
        /// </summary>
        internal const string ClusterTopic = "webexpress.collaborative.ot";

        private const int MinimumHistory = 100;
        private static readonly Regex _client = new("^[A-Za-z0-9_-]{1,64}\\z", RegexOptions.CultureInvariant);

        private readonly IMessageQueueManager _queue;
        private readonly Func<IClusterManager> _cluster;
        private readonly ConcurrentDictionary<string, SemaphoreSlim> _gates = new(StringComparer.Ordinal);
        private readonly ConcurrentDictionary<string, Document> _documents = new(StringComparer.Ordinal);
        private readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, byte>> _members = new(StringComparer.Ordinal);
        private readonly ConcurrentDictionary<string, ICollaborativeSchema> _schemas = new(StringComparer.Ordinal);
        private readonly IDisposable _subscription;
        private ICollaborativeDocumentStore _store;

        /// <summary>
        /// The cached state of one document.
        /// </summary>
        private sealed class Document
        {
            public string Id;
            public string Kind;
            public long Version;
            public List<OtToken> Tokens;
            public Dictionary<string, CollaborativeClient> Clients = new(StringComparer.Ordinal);
            public long HistoryStart = 1;
            public long SnapshotVersion;
        }

        /// <summary>
        /// The form an accepted operation takes between instances.
        /// </summary>
        private sealed record ClusterEnvelope
        (
            [property: JsonPropertyName("document")] string Document,
            [property: JsonPropertyName("json")] string Json,
            [property: JsonPropertyName("exclude")] Guid Exclude
        );

        /// <summary>
        /// Addresses a fixed set of connections of this instance; it is never forwarded, because
        /// the members on other instances are reached through the document's own bus topic.
        /// </summary>
        private sealed class ConnectionAddress(IEnumerable<Guid> connections) : IAddress
        {
            private readonly HashSet<Guid> _connections = [.. connections];

            public bool IsEmpty => _connections.Count == 0;

            public bool Matches(IClientSession session) => session is not null && _connections.Contains(session.ConnectionId);

            public AddressDescriptor Describe() => null;
        }

        /// <summary>
        /// Gets or sets the persistence of documents. While several instances share a cluster
        /// store, the default keeps the documents there.
        /// </summary>
        public ICollaborativeDocumentStore Store
        {
            get => _store ??= _cluster()?.Store is { IsShared: true } shared
                ? new ClusterCollaborativeDocumentStore(shared)
                : new MemoryCollaborativeDocumentStore();
            set
            {
                _store = value;
                _documents.Clear();
            }
        }

        /// <summary>
        /// Gets or sets the optional access policy.
        /// </summary>
        public ICollaborativeAccessPolicy AccessPolicy { get; set; }

        /// <summary>
        /// Gets or sets the optional source of initial content.
        /// </summary>
        public ICollaborativeDocumentProvider Provider { get; set; }

        /// <summary>
        /// Gets or sets after how many operations a snapshot is written.
        /// </summary>
        public int SnapshotInterval { get; set; } = 100;

        /// <summary>
        /// Gets or sets how long a client may resume from the history.
        /// </summary>
        public TimeSpan Retention { get; set; } = TimeSpan.FromHours(1);

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="queue">The message queue replies and operations are sent through.</param>
        /// <param name="cluster">Returns the cluster manager, or null on a single instance.</param>
        public CollaborativeDocumentManager(IMessageQueueManager queue, Func<IClusterManager> cluster = null)
        {
            _queue = queue ?? throw new ArgumentNullException(nameof(queue));
            _cluster = cluster ?? (() => null);

            RegisterSchema(new RichTextSchema());
            RegisterSchema(new PlainTextSchema());
            RegisterSchema(new GraphSchema());

            _subscription = _cluster()?.Subscribe(ClusterTopic, OnClusterMessage);
        }

        /// <summary>
        /// Adds the schema of a further document kind.
        /// </summary>
        /// <param name="schema">The schema.</param>
        public void RegisterSchema(ICollaborativeSchema schema)
        {
            ArgumentNullException.ThrowIfNull(schema);

            _schemas[schema.Kind] = schema;
        }

        /// <summary>
        /// Forgets a closed connection.
        /// </summary>
        /// <param name="connectionId">The connection.</param>
        public void Disconnect(Guid connectionId)
        {
            foreach (var members in _members.Values)
            {
                members.TryRemove(connectionId, out _);
            }
        }

        /// <summary>
        /// Processes an operation message.
        /// </summary>
        /// <param name="source">The socket the message arrived on.</param>
        /// <param name="rawPayload">The message.</param>
        /// <param name="cancellationToken">Cancels the processing.</param>
        /// <returns>A task that completes once all replies were sent.</returns>
        public async Task HandleAsync(IMessageQueueSocket source, string rawPayload, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(source);

            JsonObject message;

            try
            {
                message = JsonNode.Parse(rawPayload) as JsonObject;
            }
            catch (JsonException)
            {
                return;
            }

            var type = OtDocument.ReadString(message ?? [], "type");
            var document = OtDocument.ReadString(message ?? [], "document");
            var client = OtDocument.ReadString(message ?? [], "client");
            var secret = OtDocument.ReadString(message ?? [], "secret");

            if (type is null || !type.StartsWith(CollaborativeMessageTypes.OperationPrefix, StringComparison.Ordinal)
                || document is not { Length: > 0 and <= 500 } || client is null || !_client.IsMatch(client) || secret is not { Length: > 0 and <= 200 })
            {
                return;
            }

            var connection = source.ClientSession?.ConnectionId ?? Guid.Empty;

            if (message["protocol"] is JsonValue protocol && protocol.GetValueKind() == JsonValueKind.Number && (int)Math.Floor(Canonical.Number(protocol)) != Protocol)
            {
                await ReplyAsync(connection, Addressed(Reject(document, "protocol"), client), cancellationToken);
                return;
            }

            if (!CollaborativeAccess.TryValidate(OtDocument.ReadString(message, "token"), document, out var write)
                || AccessPolicy is { } policy && !policy.CanRead(source.ClientSession, document))
            {
                await ReplyAsync(connection, Addressed(Reject(document, "forbidden"), client), cancellationToken);
                return;
            }

            write = write && (AccessPolicy?.CanWrite(source.ClientSession, document) ?? true);

            var gate = _gates.GetOrAdd(document, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync(cancellationToken);

            try
            {
                var replies = new List<(IEnumerable<Guid> To, JsonObject Message)>();
                var lockName = "webexpress.collaborative:" + document;
                var clustered = _cluster() is { IsClustered: true } cluster ? cluster : null;

                using var handle = clustered?.Lock(lockName, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(10));

                if (clustered is not null && handle is null)
                {
                    // another instance holds the document; the client asks again
                    replies.Add(([connection], Reject(document, "busy", (message["operations"] as JsonArray)?.FirstOrDefault()?["seq"] is JsonValue busy && busy.GetValueKind() == JsonValueKind.Number ? (long)Canonical.Number(busy) : null)));
                }
                else
                {
                    var state = Refresh(document);

                    if (state is not null && !Identify(state, client, secret))
                    {
                        replies.Add(([connection], Reject(document, "forbidden")));
                    }
                    else
                    {
                        switch (type[CollaborativeMessageTypes.OperationPrefix.Length..])
                        {
                            case "join":
                                Join(state, message, document, client, connection, write, replies);
                                break;
                            case "resume":
                                Resume(state, message, document, client, connection, replies);
                                break;
                            case "submit":
                                Submit(state, message, document, client, connection, write, replies);
                                break;
                        }
                    }
                }

                foreach (var (to, reply) in replies)
                {
                    // a reply is meant for one session, a distribution for all of the document
                    if (!((string)reply["type"]).EndsWith(".operations", StringComparison.Ordinal) || reply["resumed"] is not null)
                    {
                        reply["to"] = client;
                    }

                    await ReplyAsync(to, reply, cancellationToken);
                }
            }
            finally
            {
                gate.Release();
            }
        }

        /// <summary>
        /// Releases the cluster subscription.
        /// </summary>
        public void Dispose()
        {
            _subscription?.Dispose();
        }

        /// <summary>
        /// Admits a client and sends it the state; a document nobody holds yet is created from
        /// the provider or from the content the first writing client offers.
        /// </summary>
        private void Join(Document state, JsonObject message, string document, string client, Guid connection, bool write, List<(IEnumerable<Guid>, JsonObject)> replies)
        {
            if (state is null)
            {
                var kind = OtDocument.ReadString(message, "kind");

                if (!write || kind is null || !_schemas.TryGetValue(kind, out var schema))
                {
                    replies.Add(([connection], Reject(document, write ? "invalid" : "forbidden")));
                    return;
                }

                List<OtToken> tokens;

                try
                {
                    tokens = OtDocument.Expand(Provider?.GetInitialState(document, kind) ?? message["state"]);
                }
                catch (OtException)
                {
                    replies.Add(([connection], Reject(document, "invalid")));
                    return;
                }

                if (!schema.Validate(tokens, out _))
                {
                    replies.Add(([connection], Reject(document, "invalid")));
                    return;
                }

                state = new Document { Id = document, Kind = kind, Version = 0, Tokens = tokens };
                _documents[document] = state;
                Identify(state, client, OtDocument.ReadString(message, "secret"));
                Snapshot(state);
            }

            Member(document, connection);
            Seen(state, client, state.Version);
            replies.Add(([connection], State(state, client, "state")));
        }

        /// <summary>
        /// Sends a returning client what it missed, or the state when the history no longer
        /// reaches back far enough.
        /// </summary>
        private void Resume(Document state, JsonObject message, string document, string client, Guid connection, List<(IEnumerable<Guid>, JsonObject)> replies)
        {
            if (state is null)
            {
                replies.Add(([connection], Reject(document, "unknown")));
                return;
            }

            Member(document, connection);

            var version = message["version"] is JsonValue v && v.GetValueKind() == JsonValueKind.Number ? (long)Canonical.Number(v) : -1;

            if (version < 0 || version > state.Version || version + 1 < state.HistoryStart)
            {
                replies.Add(([connection], State(state, client, "state")));
                return;
            }

            Seen(state, client, version);

            var operations = new JsonArray();

            foreach (var op in Store.LoadOperations(document, version))
            {
                operations.Add(op.ToJson());
            }

            replies.Add(([connection], Envelope("operations", document, new JsonObject { ["resumed"] = true, ["operations"] = operations })));
        }

        /// <summary>
        /// Sequences operations: each must be based on the current version and keep the
        /// document valid. A repeated operation is acknowledged again without being applied.
        /// </summary>
        private void Submit(Document state, JsonObject message, string document, string client, Guid connection, bool write, List<(IEnumerable<Guid>, JsonObject)> replies)
        {
            if (state is null)
            {
                replies.Add(([connection], Reject(document, "unknown")));
                return;
            }

            if (!write)
            {
                replies.Add(([connection], Reject(document, "forbidden")));
                return;
            }

            Member(document, connection);

            if (message["operations"] is not JsonArray operations)
            {
                return;
            }

            var schema = _schemas[state.Kind];

            foreach (var item in operations)
            {
                if (item is not JsonObject op || OtDocument.ReadString(op, "client") != client
                    || !TryLong(op["seq"], out var seq) || seq < 1 || !TryLong(op["base"], out var baseVersion) || op["steps"] is not JsonArray steps)
                {
                    replies.Add(([connection], Reject(document, "invalid")));
                    return;
                }

                var record = state.Clients[client];

                if (seq <= record.LastSeq)
                {
                    // a repeated delivery: answered with the version it got the first time
                    replies.Add(([connection], Ack(document, state.Version, OtDocument.ReadString(op, "id"), seq, seq == record.LastSeq ? record.LastVersion : state.Version)));
                    continue;
                }

                if (baseVersion != state.Version)
                {
                    replies.Add(([connection], Outdated(state, client, document, seq, baseVersion)));
                    return;
                }

                List<OtToken> tokens;

                try
                {
                    tokens = OtDocument.Apply(state.Tokens, steps);
                }
                catch (OtException)
                {
                    replies.Add(([connection], Reject(document, "invalid", seq, state.Version)));
                    return;
                }

                if (!schema.Validate(tokens, out _))
                {
                    replies.Add(([connection], Reject(document, "invalid", seq, state.Version)));
                    return;
                }

                var operation = new CollaborativeOperation
                {
                    Id = OtDocument.ReadString(op, "id") ?? client + ":" + seq,
                    Client = client,
                    Seq = seq,
                    Base = baseVersion,
                    Version = state.Version + 1,
                    Steps = (JsonArray)steps.DeepClone()
                };

                Store.AppendOperation(document, operation);
                state.Tokens = tokens;
                state.Version = operation.Version;
                record.LastSeq = seq;
                record.LastVersion = operation.Version;
                Seen(state, client, operation.Version);

                replies.Add(([connection], Ack(document, state.Version, operation.Id, seq, operation.Version)));

                var broadcast = Envelope("operations", document, new JsonObject { ["operations"] = new JsonArray(operation.ToJson()) });
                // the sender's connection is included: several shared controls of one page share it,
                // and a session recognizes its own operation as acknowledged
                replies.Add((Members(document), broadcast));
                Publish(document, broadcast, connection);

                if (state.Version - state.SnapshotVersion >= SnapshotInterval)
                {
                    Snapshot(state);
                }
            }
        }

        /// <summary>
        /// Answers an operation on an outdated base: with the operations since, or with the
        /// state when the history no longer reaches back to the base.
        /// </summary>
        private JsonObject Outdated(Document state, string client, string document, long seq, long baseVersion)
        {
            if (baseVersion < 0 || baseVersion > state.Version || baseVersion + 1 < state.HistoryStart)
            {
                var reply = State(state, client, "reject");
                reply["reason"] = "version";
                reply["seq"] = seq;
                reply["operations"] = new JsonArray();

                return reply;
            }

            var operations = new JsonArray();

            foreach (var op in Store.LoadOperations(document, baseVersion))
            {
                operations.Add(op.ToJson());
            }

            var result = Reject(document, "version", seq, state.Version);
            result["operations"] = operations;

            return result;
        }

        /// <summary>
        /// Brings the cached state up to the store's version, replaying the operations another
        /// instance added, or loads the document on first use.
        /// </summary>
        /// <param name="document">The document id.</param>
        /// <returns>The state, or null for an unknown document.</returns>
        private Document Refresh(string document)
        {
            var head = Store.GetVersion(document);
            _documents.TryGetValue(document, out var state);

            if (head < 0)
            {
                // the store forgot the document (it expired or the store was replaced)
                _documents.TryRemove(document, out _);

                return null;
            }

            if (state is not null && state.Version >= head)
            {
                return state;
            }

            if (state is not null)
            {
                var missing = Store.LoadOperations(document, state.Version);

                if (missing.Count == head - state.Version && Replay(state, missing))
                {
                    return state;
                }
            }

            var snapshot = Store.LoadSnapshot(document);

            if (snapshot is null)
            {
                return null;
            }

            state = new Document
            {
                Id = document,
                Kind = snapshot.Kind,
                Version = snapshot.Version,
                Tokens = OtDocument.Expand(snapshot.State),
                Clients = snapshot.Clients.ToDictionary(x => x.Key, x => CollaborativeClient.FromJson(x.Value.ToJson()), StringComparer.Ordinal),
                HistoryStart = snapshot.HistoryStart,
                SnapshotVersion = snapshot.Version
            };

            Replay(state, Store.LoadOperations(document, snapshot.Version));
            _documents[document] = state;

            return state;
        }

        /// <summary>
        /// Applies stored operations to a cached state.
        /// </summary>
        /// <param name="state">The state.</param>
        /// <param name="operations">The operations, ascending and contiguous.</param>
        /// <returns>True if all applied.</returns>
        private static bool Replay(Document state, IReadOnlyList<CollaborativeOperation> operations)
        {
            foreach (var op in operations)
            {
                if (op.Version != state.Version + 1)
                {
                    return false;
                }

                try
                {
                    state.Tokens = OtDocument.Apply(state.Tokens, op.Steps);
                }
                catch (OtException)
                {
                    return false;
                }

                state.Version = op.Version;

                if (!state.Clients.TryGetValue(op.Client, out var record))
                {
                    state.Clients[op.Client] = record = new CollaborativeClient();
                }

                record.LastSeq = Math.Max(record.LastSeq, op.Seq);
                record.LastVersion = op.Version;
            }

            return true;
        }

        /// <summary>
        /// Writes a snapshot and drops the history no client can still need: operations older
        /// than what every recently seen client holds, never more than the snapshot covers and
        /// never the most recent ones.
        /// </summary>
        /// <param name="state">The state.</param>
        private void Snapshot(Document state)
        {
            var cutoff = DateTime.UtcNow.Ticks - Retention.Ticks;
            var needed = state.Clients.Values.Where(x => x.SeenAt >= cutoff).Select(x => x.Seen).DefaultIfEmpty(state.Version).Min();
            var trim = Math.Min(Math.Min(needed, state.Version), state.Version - MinimumHistory);

            if (trim >= state.HistoryStart)
            {
                Store.TrimOperations(state.Id, trim);
                state.HistoryStart = trim + 1;
            }

            Store.SaveSnapshot(new CollaborativeSnapshot
            {
                Document = state.Id,
                Kind = state.Kind,
                Version = state.Version,
                State = OtDocument.Compact(state.Tokens),
                HistoryStart = state.HistoryStart,
                Clients = state.Clients.ToDictionary(x => x.Key, x => CollaborativeClient.FromJson(x.Value.ToJson()))
            });

            state.SnapshotVersion = state.Version;
        }

        /// <summary>
        /// Recognizes a client by its secret; a client seen for the first time is registered.
        /// </summary>
        /// <returns>False if the client id is taken by someone with another secret.</returns>
        private static bool Identify(Document state, string client, string secret)
        {
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret ?? "")));

            if (state.Clients.TryGetValue(client, out var record))
            {
                if (record.SecretHash is null)
                {
                    record.SecretHash = hash;
                }

                return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(record.SecretHash), Encoding.ASCII.GetBytes(hash));
            }

            state.Clients[client] = new CollaborativeClient { SecretHash = hash, SeenAt = DateTime.UtcNow.Ticks };

            return true;
        }

        /// <summary>
        /// Notes the version a client is known to hold.
        /// </summary>
        private static void Seen(Document state, string client, long version)
        {
            if (state.Clients.TryGetValue(client, out var record))
            {
                record.Seen = version;
                record.SeenAt = DateTime.UtcNow.Ticks;
            }
        }

        /// <summary>
        /// Adds a connection as a member of a document.
        /// </summary>
        private void Member(string document, Guid connection)
        {
            _members.GetOrAdd(document, _ => new ConcurrentDictionary<Guid, byte>())[connection] = 0;
        }

        /// <summary>
        /// Returns the members of a document on this instance.
        /// </summary>
        private IEnumerable<Guid> Members(string document)
        {
            return _members.TryGetValue(document, out var members) ? [.. members.Keys] : [];
        }

        /// <summary>
        /// Builds the state message for a client; of the client records it reveals only the
        /// client's own, which tells it whether its last operation was applied.
        /// </summary>
        private static JsonObject State(Document state, string client, string type)
        {
            var clients = new JsonObject();

            if (state.Clients.TryGetValue(client, out var record))
            {
                clients[client] = record.LastSeq;
            }

            return Envelope(type, state.Id, new JsonObject
            {
                ["version"] = state.Version,
                ["state"] = OtDocument.Compact(state.Tokens),
                ["clients"] = clients
            });
        }

        /// <summary>
        /// Builds an acknowledgement.
        /// </summary>
        private static JsonObject Ack(string document, long current, string id, long seq, long version)
        {
            return Envelope("ack", document, new JsonObject
            {
                ["version"] = current,
                ["operations"] = new JsonArray(new JsonObject { ["id"] = id, ["seq"] = seq, ["version"] = version })
            });
        }

        /// <summary>
        /// Builds a rejection.
        /// </summary>
        private static JsonObject Reject(string document, string reason, long? seq = null, long? version = null)
        {
            var reply = Envelope("reject", document, new JsonObject { ["reason"] = reason });

            if (seq is { } s)
            {
                reply["seq"] = s;
            }

            if (version is { } v)
            {
                reply["version"] = v;
            }

            return reply;
        }

        /// <summary>
        /// Addresses a reply to the session of one client, since several sessions may share a connection.
        /// </summary>
        private static JsonObject Addressed(JsonObject message, string client)
        {
            message["to"] = client;

            return message;
        }

        /// <summary>
        /// Builds a message with the fields every operation message carries.
        /// </summary>
        private static JsonObject Envelope(string type, string document, JsonObject fields)
        {
            var message = new JsonObject
            {
                ["type"] = CollaborativeMessageTypes.OperationPrefix + type,
                ["protocol"] = Protocol,
                ["document"] = document
            };

            foreach (var (key, value) in fields.ToList())
            {
                fields.Remove(key);
                message[key] = value;
            }

            return message;
        }

        /// <summary>
        /// Sends a message to connections of this instance.
        /// </summary>
        private async Task ReplyAsync(IEnumerable<Guid> connections, JsonObject message, CancellationToken cancellationToken)
        {
            var address = new ConnectionAddress(connections);

            if (!address.IsEmpty)
            {
                await _queue.SendAsync(address, ToMessage(message), cancellationToken);
            }
        }

        /// <summary>
        /// Sends a message to one connection of this instance.
        /// </summary>
        private Task ReplyAsync(Guid connection, JsonObject message, CancellationToken cancellationToken)
        {
            return ReplyAsync([connection], message, cancellationToken);
        }

        /// <summary>
        /// Converts a reply into a queue message, keeping the wire format flat.
        /// </summary>
        private static IMessage ToMessage(JsonObject message)
        {
            var result = new CollaborativeMessage((string)message["type"]);

            foreach (var (key, value) in message)
            {
                if (key != "type")
                {
                    result.AdditionalProperties[key] = JsonSerializer.SerializeToElement(value);
                }
            }

            return result;
        }

        /// <summary>
        /// Hands an accepted operation to the other instances of a cluster.
        /// </summary>
        private void Publish(string document, JsonObject message, Guid exclude)
        {
            if (_cluster() is not { Transport: not null } cluster)
            {
                return;
            }

            var payload = JsonSerializer.SerializeToUtf8Bytes(new ClusterEnvelope(document, ToMessage(message).ToJson(), exclude));

            _ = cluster.PublishAsync(ClusterTopic, payload);
        }

        /// <summary>
        /// Delivers an operation another instance accepted to the local members.
        /// </summary>
        private void OnClusterMessage(ClusterMessage message)
        {
            ClusterEnvelope envelope;

            try
            {
                envelope = JsonSerializer.Deserialize<ClusterEnvelope>(message.Payload);
            }
            catch (JsonException)
            {
                return;
            }

            if (envelope?.Document is null || string.IsNullOrEmpty(envelope.Json))
            {
                return;
            }

            var address = new ConnectionAddress(Members(envelope.Document).Where(x => x != envelope.Exclude));

            if (!address.IsEmpty)
            {
                _ = _queue.SendAsync(address, new ForwardedMessage(envelope.Json), CancellationToken.None);
            }
        }

        /// <summary>
        /// Reads an integer the way Number.isInteger accepts it.
        /// </summary>
        private static bool TryLong(JsonNode node, out long value)
        {
            value = 0;

            if (node is not JsonValue json || json.GetValueKind() != JsonValueKind.Number)
            {
                return false;
            }

            var number = Canonical.Number(json);

            if (number != Math.Floor(number) || Math.Abs(number) > 9007199254740991)
            {
                return false;
            }

            value = (long)number;

            return true;
        }
    }
}
