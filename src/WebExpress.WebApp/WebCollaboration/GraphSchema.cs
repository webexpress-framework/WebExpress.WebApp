using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// The schema of shared graphs, as the graph editor shares them: one leaf per node and per
    /// edge, the properties as attributes, every edge connecting two existing nodes.
    /// </summary>
    /// <remarks>
    /// Mirrors GraphEditorCtrl.checkCollaborationTokens. Property values are plain JSON data
    /// of bounded size; the graph renders them as text and coordinates, never as markup.
    /// </remarks>
    public sealed class GraphSchema : ICollaborativeSchema
    {
        private const int MaxItems = 20000;
        private const int MaxDepth = 4;

        private static readonly Regex _id = new("^[^\\u0000-\\u001f]{1,200}\\z", RegexOptions.CultureInvariant);
        private static readonly Regex _key = new("^[A-Za-z_][A-Za-z0-9_-]{0,63}\\z", RegexOptions.CultureInvariant);

        /// <summary>
        /// Returns the document kind.
        /// </summary>
        public string Kind => "graph";

        /// <summary>
        /// Checks a document.
        /// </summary>
        /// <param name="tokens">The tokens of the document.</param>
        /// <param name="reason">The violated rule.</param>
        /// <returns>True if the document is valid.</returns>
        public bool Validate(IReadOnlyList<OtToken> tokens, out string reason)
        {
            reason = null;

            if (tokens.Count > MaxItems)
            {
                reason = "graph limit exceeded";
                return false;
            }

            var nodes = new HashSet<string>(StringComparer.Ordinal);
            var edges = new HashSet<string>(StringComparer.Ordinal);

            foreach (var token in tokens)
            {
                if (token.Kind != OtToken.Leaf || token.Type is not ("node" or "edge") || token.Id is null || !_id.IsMatch(token.Id))
                {
                    reason = "a graph holds node and edge leaves only";
                    return false;
                }

                if (!(token.Type == "node" ? nodes : edges).Add(token.Id))
                {
                    reason = "duplicate id " + token.Id;
                    return false;
                }

                if (!IsData(token.Attributes, 1))
                {
                    reason = "unsupported properties on " + token.Id;
                    return false;
                }
            }

            foreach (var token in tokens.Where(t => t.Type == "edge"))
            {
                if (OtDocument.ReadString(token.Attributes, "from") is not { } from || !nodes.Contains(from)
                    || OtDocument.ReadString(token.Attributes, "to") is not { } to || !nodes.Contains(to))
                {
                    reason = "edge " + token.Id + " misses an end";
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// Determines whether a value is bounded plain data.
        /// </summary>
        /// <param name="node">The value.</param>
        /// <param name="depth">The nesting depth.</param>
        /// <returns>True if the value is allowed.</returns>
        private static bool IsData(JsonNode node, int depth)
        {
            if (depth > MaxDepth)
            {
                return false;
            }

            return node switch
            {
                null => true,
                JsonObject obj => obj.Count <= 64 && obj.All(p => _key.IsMatch(p.Key) && p.Key != "__proto__" && IsData(p.Value, depth + 1)),
                JsonArray array => array.Count <= 1000 && array.All(v => IsData(v, depth + 1)),
                JsonValue value => value.GetValueKind() switch
                {
                    JsonValueKind.String => value.GetValue<string>().Length <= 10000,
                    JsonValueKind.Number => double.IsFinite(Canonical.Number(value)),
                    _ => true
                },
                _ => false
            };
        }
    }
}
