using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Applies the primitive steps of the shared document format to a token sequence and
    /// converts between the packed wire form and tokens.
    /// </summary>
    /// <remarks>
    /// The behavior is the server half of webexpress.webui.Ot: every step the client accepts is
    /// accepted here with the identical result, and every malformed or out-of-range step is
    /// rejected instead of being clamped, because a server that quietly adjusted a step would
    /// sequence a document no client ever computed.
    /// </remarks>
    public static class OtDocument
    {
        /// <summary>
        /// Marks that exclude each other; adding one removes its partners in the same step.
        /// </summary>
        private static readonly Dictionary<string, string[]> _exclusive = new(StringComparer.Ordinal)
        {
            ["subscript"] = ["superscript"],
            ["superscript"] = ["subscript"]
        };

        /// <summary>
        /// Unpacks a wire slice into tokens and rejects malformed input.
        /// </summary>
        /// <param name="slice">The packed tokens.</param>
        /// <returns>The tokens.</returns>
        /// <exception cref="OtException">Thrown when a token is malformed.</exception>
        public static List<OtToken> Expand(JsonNode slice)
        {
            if (slice is not JsonArray array)
            {
                throw new OtException("A slice must be an array of tokens.");
            }

            var tokens = new List<OtToken>(array.Count);

            foreach (var item in array)
            {
                if (item is not JsonObject raw)
                {
                    throw new OtException("A token must be an object.");
                }

                var kind = ReadString(raw, "t");

                if (kind == "s" || kind == "c")
                {
                    var value = ReadString(raw, "v");

                    if (string.IsNullOrEmpty(value) || kind == "c" && value.Length != 1)
                    {
                        throw new OtException("A character token needs text.");
                    }

                    var marks = ReadObject(raw, "m", "Marks must be an object.") ?? [];

                    foreach (var unit in value)
                    {
                        tokens.Add(new OtToken { Kind = OtToken.Character, Value = unit, Marks = marks });
                    }
                }
                else if (kind == "o" || kind == "l" || kind == "e")
                {
                    var type = ReadString(raw, "n");
                    var id = ReadString(raw, "id");

                    if (string.IsNullOrEmpty(type) || id is null)
                    {
                        throw new OtException("A node token needs a type and an id.");
                    }

                    tokens.Add(kind == "e"
                        ? new OtToken { Kind = OtToken.Close, Type = type, Id = id }
                        : new OtToken { Kind = kind[0], Type = type, Id = id, Attributes = ReadObject(raw, "a", "Attributes must be an object.") ?? [] });
                }
                else
                {
                    throw new OtException("Unknown token kind.");
                }
            }

            return tokens;
        }

        /// <summary>
        /// Packs tokens into the wire form, joining characters with equal marks into runs.
        /// </summary>
        /// <param name="tokens">The tokens.</param>
        /// <returns>The packed slice.</returns>
        public static JsonArray Compact(IEnumerable<OtToken> tokens)
        {
            var result = new JsonArray();
            StringBuilder run = null;
            JsonObject runMarks = null;

            void Flush()
            {
                if (run is null)
                {
                    return;
                }

                result.Add(new JsonObject { ["t"] = "s", ["v"] = run.ToString(), ["m"] = runMarks.DeepClone() });
                run = null;
            }

            foreach (var token in tokens)
            {
                if (token.Kind == OtToken.Character)
                {
                    if (run is not null && (ReferenceEquals(runMarks, token.Marks) || Canonical.Equal(runMarks, token.Marks)))
                    {
                        run.Append(token.Value);
                        continue;
                    }

                    Flush();
                    run = new StringBuilder().Append(token.Value);
                    runMarks = token.Marks ?? [];
                    continue;
                }

                Flush();

                result.Add(token.Kind == OtToken.Close
                    ? new JsonObject { ["t"] = "e", ["n"] = token.Type, ["id"] = token.Id }
                    : new JsonObject { ["t"] = token.Kind.ToString(), ["n"] = token.Type, ["id"] = token.Id, ["a"] = (token.Attributes ?? []).DeepClone() });
            }

            Flush();

            return result;
        }

        /// <summary>
        /// Applies steps in order to a copy of the document.
        /// </summary>
        /// <param name="tokens">The document; it is not modified.</param>
        /// <param name="steps">The steps.</param>
        /// <returns>The new document.</returns>
        /// <exception cref="OtException">Thrown when a step is malformed or out of range.</exception>
        public static List<OtToken> Apply(IReadOnlyList<OtToken> tokens, JsonNode steps)
        {
            if (steps is not JsonArray list)
            {
                throw new OtException("Steps must be an array.");
            }

            var doc = new List<OtToken>(tokens);

            foreach (var item in list)
            {
                if (item is not JsonObject step)
                {
                    throw new OtException("A step must be an object.");
                }

                ApplyStep(doc, step);
            }

            return doc;
        }

        /// <summary>
        /// Applies one primitive in place.
        /// </summary>
        /// <param name="doc">The working copy.</param>
        /// <param name="step">The primitive.</param>
        private static void ApplyStep(List<OtToken> doc, JsonObject step)
        {
            switch (ReadString(step, "type"))
            {
                case "replace":
                    {
                        if (!TryInteger(step["from"], doc.Count, out var from) || !TryInteger(step["to"], doc.Count, out var to) || to < from)
                        {
                            throw new OtException("Replace range outside the document.");
                        }

                        var inserted = Expand(step["slice"] ?? new JsonArray());
                        doc.RemoveRange(from, to - from);
                        doc.InsertRange(from, inserted);
                        return;
                    }
                case "addMark":
                case "removeMark":
                    {
                        if (!TryInteger(step["from"], doc.Count, out var from) || !TryInteger(step["to"], doc.Count, out var to) || to < from)
                        {
                            throw new OtException("Mark range outside the document.");
                        }

                        var name = ReadString(step, "name");

                        if (string.IsNullOrEmpty(name))
                        {
                            throw new OtException("A mark step needs a name.");
                        }

                        var adding = ReadString(step, "type") == "addMark";
                        var value = step["value"];

                        if (adding && (value is null || value.GetValueKind() == JsonValueKind.False))
                        {
                            throw new OtException("An added mark needs a value.");
                        }

                        var names = adding && _exclusive.TryGetValue(name, out var partners) ? [name, .. partners] : new[] { name };

                        for (var i = from; i < to; i++)
                        {
                            var token = doc[i];

                            if (token.Kind != OtToken.Character)
                            {
                                continue;
                            }

                            var marks = (JsonObject)(token.Marks ?? []).DeepClone();

                            foreach (var remove in names)
                            {
                                marks.Remove(remove);
                            }

                            if (adding)
                            {
                                marks[name] = value.DeepClone();
                            }

                            doc[i] = new OtToken { Kind = OtToken.Character, Value = token.Value, Marks = marks };
                        }

                        return;
                    }
                case "setAttr":
                    {
                        if (!TryInteger(step["pos"], doc.Count - 1, out var pos))
                        {
                            throw new OtException("Attribute target outside the document.");
                        }

                        var key = ReadString(step, "key");

                        if (string.IsNullOrEmpty(key))
                        {
                            throw new OtException("An attribute step needs a key.");
                        }

                        var token = doc[pos];

                        if (token.Kind != OtToken.Open && token.Kind != OtToken.Leaf)
                        {
                            throw new OtException("Attributes belong to nodes only.");
                        }

                        if (step["id"] is JsonNode id && (id.GetValueKind() != JsonValueKind.String || id.GetValue<string>() != token.Id))
                        {
                            throw new OtException("Attribute target does not match the node.");
                        }

                        var attributes = (JsonObject)(token.Attributes ?? []).DeepClone();
                        var value = step["value"];

                        if (value is null)
                        {
                            attributes.Remove(key);
                        }
                        else
                        {
                            attributes[key] = value.DeepClone();
                        }

                        doc[pos] = new OtToken { Kind = token.Kind, Type = token.Type, Id = token.Id, Attributes = attributes };
                        return;
                    }
                default:
                    throw new OtException("Unknown step type.");
            }
        }

        /// <summary>
        /// Reads an integer position the way Number.isInteger accepts it.
        /// </summary>
        /// <param name="node">The JSON value.</param>
        /// <param name="max">The largest allowed value.</param>
        /// <param name="value">The position.</param>
        /// <returns>True if the value is an integer in [0, max].</returns>
        private static bool TryInteger(JsonNode node, int max, out int value)
        {
            value = 0;

            if (node is not JsonValue json || json.GetValueKind() != JsonValueKind.Number)
            {
                return false;
            }

            var number = Canonical.Number(json);

            if (number != Math.Floor(number) || number < 0 || number > max)
            {
                return false;
            }

            value = (int)number;

            return true;
        }

        /// <summary>
        /// Reads a string property, or null when it is missing or of another type.
        /// </summary>
        /// <param name="obj">The object.</param>
        /// <param name="name">The property.</param>
        /// <returns>The string or null.</returns>
        internal static string ReadString(JsonObject obj, string name)
        {
            return obj[name] is JsonValue value && value.GetValueKind() == JsonValueKind.String ? value.GetValue<string>() : null;
        }

        /// <summary>
        /// Reads an optional object property and rejects every other type.
        /// </summary>
        /// <param name="obj">The object.</param>
        /// <param name="name">The property.</param>
        /// <param name="error">The message for a wrong type.</param>
        /// <returns>The object, or null when absent.</returns>
        private static JsonObject ReadObject(JsonObject obj, string name, string error)
        {
            if (!obj.TryGetPropertyValue(name, out var node))
            {
                return null;
            }

            // an explicit null is rejected like any other non-object, as the client does
            return node as JsonObject ?? throw new OtException(error);
        }

        /// <summary>
        /// Returns the total length of the text in a document.
        /// </summary>
        /// <param name="tokens">The tokens.</param>
        /// <returns>The number of character tokens.</returns>
        public static int TextLength(IEnumerable<OtToken> tokens) => tokens.Count(t => t.Kind == OtToken.Character);
    }
}
