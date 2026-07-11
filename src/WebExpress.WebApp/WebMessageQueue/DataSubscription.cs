using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// The runtime domain subscription of one WebSocket connection. A page
    /// registers its initial domains through the connect url, but a
    /// ViewState learns the domains of its services only on the client, after
    /// the page rendered; it subscribes them through an inbound
    /// <see cref="DataChangedMessageTypes.Subscribe"/> message. This class
    /// parses those messages and accumulates the subscribed domains, so the
    /// socket can merge them into its session metadata without carrying the
    /// parsing itself. Subscriptions are additive for the lifetime of the
    /// connection, because a ViewState that unsubscribes gains nothing: an
    /// unmatched change message is simply ignored on the client.
    /// </summary>
    public sealed class DataSubscription
    {
        private readonly HashSet<string> _domains = new(StringComparer.OrdinalIgnoreCase);
        private readonly object _lock = new();

        /// <summary>
        /// Gets a snapshot of the currently subscribed domains.
        /// </summary>
        public IEnumerable<string> Domains
        {
            get
            {
                lock (_lock)
                {
                    return [.. _domains];
                }
            }
        }

        /// <summary>
        /// Interprets an inbound payload of the data change family. A
        /// subscribe message adds its domains to the subscription; every other
        /// or malformed payload is ignored, because a misbehaving client must
        /// not be able to push the socket pipeline into an error state.
        /// </summary>
        /// <param name="rawPayload">The raw text payload.</param>
        /// <returns>
        /// <c>true</c> if the payload was a well formed subscribe message;
        /// otherwise <c>false</c>.
        /// </returns>
        public bool Handle(string rawPayload)
        {
            if (string.IsNullOrWhiteSpace(rawPayload))
            {
                return false;
            }

            JsonDocument document;
            try
            {
                document = JsonDocument.Parse(rawPayload);
            }
            catch (JsonException)
            {
                return false;
            }

            using (document)
            {
                var root = document.RootElement;
                if (root.ValueKind != JsonValueKind.Object)
                {
                    return false;
                }

                if (!root.TryGetProperty("type", out var type)
                    || type.ValueKind != JsonValueKind.String
                    || type.GetString() != DataChangedMessageTypes.Subscribe)
                {
                    return false;
                }

                if (!root.TryGetProperty("domains", out var domains)
                    || domains.ValueKind != JsonValueKind.Array)
                {
                    return false;
                }

                var parsed = domains.EnumerateArray()
                    .Where(x => x.ValueKind == JsonValueKind.String)
                    .Select(x => x.GetString())
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim().ToLower())
                    .ToArray();

                if (parsed.Length == 0)
                {
                    return false;
                }

                lock (_lock)
                {
                    foreach (var domain in parsed)
                    {
                        _domains.Add(domain);
                    }
                }

                return true;
            }
        }
    }
}
