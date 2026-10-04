using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebCluster;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebIndex
{
    /// <summary>
    /// Manages the index for the web application and handles component registration and removal.
    /// </summary>
    /// <remarks>
    /// In a cluster every instance keeps a copy of the index of its own: the index files are
    /// opened exclusively, so instances cannot share them, and a search must not wait for another
    /// instance. The copies stay in step by replaying each single-item change on the other
    /// instances. A copy that starts later - a new or restarted instance - holds only what it
    /// receives from then on, so in a cluster the index has to be a projection of a primary data
    /// store that the application re-indexes from at start.
    /// </remarks>
    public sealed class IndexManager : WebExpress.WebIndex.IndexManager, IIndexManager
    {
        /// <summary>
        /// The topic index changes travel on between instances.
        /// </summary>
        internal const string ClusterTopic = "webexpress.index";

        // set while a change from another instance is applied, so it is not sent back out
        [ThreadStatic]
        private static bool _replaying;

        private static readonly MethodInfo ApplyMethod = typeof(IndexManager)
            .GetMethod(nameof(Apply), BindingFlags.Instance | BindingFlags.NonPublic);

        private readonly IHttpServerContext _httpServerContext;
        private readonly IComponentHub _componentHub;
        private readonly IDisposable _clusterSubscription;

        // the newest change applied per item and the last clear per document; the transport may
        // deliver two changes of one item out of order, and the older must not win
        private readonly ConcurrentDictionary<(Type, Guid), long> _versions = new();
        private readonly ConcurrentDictionary<Type, long> _cleared = new();

        /// <summary>
        /// The form an index change takes between instances.
        /// </summary>
        /// <param name="Type">The item type, by full name and assembly name.</param>
        /// <param name="Kind">The kind of change.</param>
        /// <param name="Id">The id of the changed item.</param>
        /// <param name="Time">When the change happened, in utc ticks.</param>
        /// <param name="Item">The changed item, absent for a deletion or a clear.</param>
        private sealed record ClusterChange
        (
            [property: JsonPropertyName("type")] string Type,
            [property: JsonPropertyName("kind")] IndexChangeKind Kind,
            [property: JsonPropertyName("id")] Guid Id,
            [property: JsonPropertyName("time")] long Time,
            [property: JsonPropertyName("item")] JsonElement? Item
        );

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="httpServerContext">The reference to the context of the host.</param>
        /// <param name="componentHub">The component hub.</param>
        internal IndexManager(IHttpServerContext httpServerContext, IComponentHub componentHub)
        {
            _httpServerContext = httpServerContext;
            _componentHub = componentHub;

            // webindex is a library rather than a plugin, so the plugin scan never reaches its
            // language files and the wql parser's messages would surface as raw keys
            var webIndex = typeof(WebExpress.WebIndex.IndexManager).Assembly;
            (_componentHub?.InternationalizationManager as InternationalizationManager)?
                .Register(webIndex, webIndex.GetName().Name.ToLower());

            _componentHub?.PluginManager?.AddPlugin += (s, pluginContext) =>
            {
                Register(pluginContext);
            };

            _componentHub?.PluginManager?.RemovePlugin += (s, pluginContext) =>
            {
                Remove(pluginContext);
            };

            _httpServerContext?.Log?.Debug
            (
                I18N.Translate("webexpress.webapp:indexmanager.initialization")
            );

            var cluster = _componentHub?.ClusterManager;

            // an instance of a cluster keeps its copy apart from the shared data directory, whose
            // index files another instance already holds open
            var directory = cluster is { IsClustered: true }
                ? Path.Combine(Path.GetTempPath(), "webexpress", "index", string.Concat(cluster.NodeId.Select(x => char.IsLetterOrDigit(x) || x is '-' or '.' ? x : '_')))
                : Path.Combine(httpServerContext.DataPath, "index");

            Initialization(new IndexContext() { IndexDirectory = directory });

            if (cluster is not null)
            {
                Changed += OnIndexChanged;
                _clusterSubscription = cluster.Subscribe(ClusterTopic, OnClusterMessage);
            }
        }

        /// <summary>
        /// Discovers and registers entries from the specified plugin.
        /// </summary>
        /// <param name="pluginContext">A context of a plugin whose elements are to be registered.</param>
        public void Register(IPluginContext pluginContext)
        {

        }

        /// <summary>
        /// Discovers and registers entries from the specified plugin.
        /// </summary>
        /// <param name="pluginContexts">A list with plugin contexts that contain the components.</param>
        public void Register(IEnumerable<IPluginContext> pluginContexts)
        {
            foreach (var pluginContext in pluginContexts)
            {
                Register(pluginContext);
            }
        }

        /// <summary>
        /// Removes all components associated with the specified plugin context.
        /// </summary>
        /// <param name="pluginContext">The context of the plugin that contains the components to remove.</param>
        public void Remove(IPluginContext pluginContext)
        {

        }

        /// <summary>
        /// Stops following the other instances and releases the index.
        /// </summary>
        public new void Dispose()
        {
            _clusterSubscription?.Dispose();
            Changed -= OnIndexChanged;

            base.Dispose();
        }

        /// <summary>
        /// Sends a change made on this instance to the other instances.
        /// </summary>
        /// <param name="sender">The index manager.</param>
        /// <param name="e">The change.</param>
        private void OnIndexChanged(object sender, IndexChangedEventArgs e)
        {
            if (_replaying || _componentHub?.ClusterManager is not { Transport: not null } cluster)
            {
                return;
            }

            var change = new ClusterChange
            (
                TypeName(e.ItemType),
                e.Kind,
                e.Item?.Id ?? Guid.Empty,
                DateTime.UtcNow.Ticks,
                e.Item is null ? null : JsonSerializer.SerializeToElement(e.Item, e.ItemType)
            );

            _ = cluster.PublishAsync(ClusterTopic, JsonSerializer.SerializeToUtf8Bytes(change));
        }

        /// <summary>
        /// Replays a change another instance made.
        /// </summary>
        /// <param name="message">The cluster message.</param>
        private void OnClusterMessage(ClusterMessage message)
        {
            ClusterChange change;

            try
            {
                change = JsonSerializer.Deserialize<ClusterChange>(message.Payload);
            }
            catch (JsonException)
            {
                return;
            }

            // only types with a document here are recreated, so the message cannot make this
            // instance deserialize an arbitrary type
            var type = DocumentTypes.FirstOrDefault(x => TypeName(x) == change?.Type);

            if (type is null)
            {
                return;
            }

            try
            {
                ApplyMethod.MakeGenericMethod(type).Invoke(this, [change]);
            }
            catch (TargetInvocationException ex)
            {
                _httpServerContext?.Log?.Exception(ex.InnerException ?? ex);
            }
        }

        /// <summary>
        /// Applies a change of another instance to the copy of this instance.
        /// </summary>
        /// <typeparam name="TIndexItem">The item type.</typeparam>
        /// <param name="change">The change.</param>
        private void Apply<TIndexItem>(ClusterChange change)
            where TIndexItem : IIndexItem
        {
            var type = typeof(TIndexItem);
            var document = GetIndexDocument<TIndexItem>();

            if (document is null)
            {
                return;
            }

            if (change.Kind == IndexChangeKind.Clear)
            {
                _cleared.AddOrUpdate(type, change.Time, (_, time) => Math.Max(time, change.Time));
                _versions.Keys.Where(x => x.Item1 == type).ToList().ForEach(x => _versions.TryRemove(x, out _));
            }
            else if ((_cleared.TryGetValue(type, out var cleared) && change.Time <= cleared)
                || (_versions.TryGetValue((type, change.Id), out var known) && change.Time <= known))
            {
                // older than what this copy already reflects
                return;
            }
            else
            {
                _versions[(type, change.Id)] = change.Time;
            }

            _replaying = true;

            try
            {
                var existing = change.Id == Guid.Empty ? default : document.DocumentStore.GetItem(change.Id);

                switch (change.Kind)
                {
                    case IndexChangeKind.Insert or IndexChangeKind.Update when change.Item is { } element:
                        var item = element.Deserialize<TIndexItem>();

                        // applied as an upsert, since the copy may have missed the insert
                        if (existing is null)
                        {
                            Insert(item);
                        }
                        else
                        {
                            Update(item);
                        }

                        break;
                    case IndexChangeKind.Delete when existing is not null:
                        Delete(existing);
                        break;
                    case IndexChangeKind.Clear:
                        Clear<TIndexItem>();
                        break;
                }
            }
            finally
            {
                _replaying = false;
            }
        }

        /// <summary>
        /// Returns the name an item type travels under: full name and assembly name, without
        /// version, so instances running different builds of a plugin still match.
        /// </summary>
        /// <param name="type">The item type.</param>
        /// <returns>The name.</returns>
        private static string TypeName(Type type)
        {
            return type.FullName + ", " + type.Assembly.GetName().Name;
        }
    }
}
