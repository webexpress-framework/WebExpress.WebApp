using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// The schema of shared workbooks, as the spreadsheet control shares them: a workbook leaf,
    /// then per sheet a sheet leaf followed by its column leaves and its row leaves; the cells
    /// are attributes of their row leaf, keyed by column id.
    /// </summary>
    /// <remarks>
    /// Mirrors SpreadsheetCollab.check of the client. Attribute values are bounded plain JSON
    /// data; the client renders cell values as text and validates styles before they become css,
    /// so the server only has to keep the structure intact and the size bounded.
    /// </remarks>
    public sealed partial class SpreadsheetSchema : ICollaborativeSchema
    {
        private const int MaxTokens = 2000000;
        private const int MaxRows = 1048576;
        private const int MaxColumns = 16384;
        private const int MaxDepth = 6;

        private static readonly HashSet<string> _cellKeys = new(StringComparer.Ordinal) { "v", "f", "t", "s", "st", "c", "m" };

        [GeneratedRegex("^[A-Za-z_][A-Za-z0-9_-]{0,63}\\z", RegexOptions.CultureInvariant)]
        private static partial Regex IdPattern();

        /// <summary>
        /// Returns the document kind.
        /// </summary>
        public string Kind => "spreadsheet";

        /// <summary>
        /// Checks a document.
        /// </summary>
        /// <param name="tokens">The tokens of the document.</param>
        /// <param name="reason">The violated rule.</param>
        /// <returns>True if the document is valid.</returns>
        public bool Validate(IReadOnlyList<OtToken> tokens, out string reason)
        {
            reason = null;

            if (tokens.Count == 0 || tokens.Count > MaxTokens)
            {
                reason = "workbook size out of range";
                return false;
            }

            var book = tokens[0];

            if (book.Kind != OtToken.Leaf || book.Type != "book" || book.Id != "book" || !IsBookAttributes(book.Attributes))
            {
                reason = "a workbook starts with its book leaf";
                return false;
            }

            var ids = new HashSet<string>(StringComparer.Ordinal);
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var sheets = 0;
            int? columns = null, rows = null;

            bool Complete() => columns is null || columns > 0 && rows > 0 && columns <= MaxColumns && rows <= MaxRows;

            for (var i = 1; i < tokens.Count; i++)
            {
                var token = tokens[i];

                if (token.Kind != OtToken.Leaf || token.Id is null || !IdPattern().IsMatch(token.Id) || !ids.Add(token.Type + ":" + token.Id))
                {
                    reason = "malformed or repeated leaf at " + i;
                    return false;
                }

                switch (token.Type)
                {
                    case "sheet":
                        if (!Complete())
                        {
                            reason = "a sheet needs at least one column and one row";
                            return false;
                        }

                        var name = OtDocument.ReadString(token.Attributes, "name");

                        if (string.IsNullOrWhiteSpace(name) || name.Length > 100 || name.IndexOfAny(['[', ']', ':', '*', '?', '/', '\\']) >= 0 || !names.Add(name))
                        {
                            reason = "invalid or repeated sheet name";
                            return false;
                        }

                        if (!IsData(token.Attributes, 0, 1000))
                        {
                            reason = "unsupported sheet properties";
                            return false;
                        }

                        sheets++;
                        columns = 0;
                        rows = 0;
                        break;
                    case "col":
                        if (columns is null || rows > 0 || !IsData(token.Attributes, 0, 10))
                        {
                            reason = "misplaced or malformed column";
                            return false;
                        }

                        columns++;
                        break;
                    case "row":
                        if (columns is null or 0 || !IsRow(token.Attributes))
                        {
                            reason = "misplaced or malformed row";
                            return false;
                        }

                        rows++;
                        break;
                    default:
                        reason = "unknown leaf " + token.Type;
                        return false;
                }
            }

            if (sheets == 0 || !Complete())
            {
                reason = "a workbook needs complete sheets";
                return false;
            }

            return true;
        }

        /// <summary>
        /// Checks the attributes of the workbook leaf.
        /// </summary>
        /// <param name="attributes">The attributes.</param>
        /// <returns>True if valid.</returns>
        private static bool IsBookAttributes(JsonObject attributes)
        {
            if (attributes is null)
            {
                return true;
            }

            if (attributes["order"] is { } order && (order is not JsonArray list || list.Any(id => id is not JsonValue v || v.GetValueKind() != JsonValueKind.String)))
            {
                return false;
            }

            return IsData(attributes, 0, 10000);
        }

        /// <summary>
        /// Checks the attributes of a row leaf: cells keyed by column id and the row properties.
        /// </summary>
        /// <param name="attributes">The attributes.</param>
        /// <returns>True if valid.</returns>
        private static bool IsRow(JsonObject attributes)
        {
            if (attributes is null)
            {
                return true;
            }

            if (attributes.Count > MaxColumns + 1)
            {
                return false;
            }

            foreach (var (key, value) in attributes)
            {
                if (!IdPattern().IsMatch(key) || key == "__proto__" || value is not JsonObject cell || !IsData(cell, 1, 64))
                {
                    return false;
                }

                if (key != "_p" && !cell.All(entry => _cellKeys.Contains(entry.Key)))
                {
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
        /// <param name="width">The largest number of entries of an object or an array.</param>
        /// <returns>True if the value is allowed.</returns>
        private static bool IsData(JsonNode node, int depth, int width)
        {
            if (depth > MaxDepth)
            {
                return false;
            }

            return node switch
            {
                null => true,
                JsonObject obj => obj.Count <= Math.Max(width, 1000) && obj.All(p => p.Key != "__proto__" && p.Key.Length <= 255 && IsData(p.Value, depth + 1, width)),
                JsonArray array => array.Count <= Math.Max(width, 10000) && array.All(v => IsData(v, depth + 1, width)),
                JsonValue value => value.GetValueKind() switch
                {
                    JsonValueKind.String => value.GetValue<string>().Length <= 32767,
                    JsonValueKind.Number => double.IsFinite(Canonical.Number(value)),
                    _ => true
                },
                _ => false
            };
        }
    }
}
