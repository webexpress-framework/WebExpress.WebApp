using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// The schema of shared rich text documents, the server half of EditorModel.check in
    /// webexpress.webui.editor.model.js.
    /// </summary>
    /// <remarks>
    /// A document is valid when its structure follows the content rules and every attribute and
    /// mark is already in the form the client's sanitizer produces. Comparing against the
    /// sanitized form instead of sanitizing keeps unsafe addresses and styles out without the
    /// server ever rewriting a document. The regular expressions spell out ASCII classes and
    /// the JavaScript whitespace set, because .NET's \w, \d, \s and case-insensitive matching
    /// cover more characters than JavaScript's and the two sides must agree on every input.
    /// </remarks>
    public sealed class RichTextSchema : ICollaborativeSchema
    {
        private const int MaxDepth = 40;
        private const int MaxNodes = 50000;
        private const int MaxText = 2000000;
        private const string JsWhitespace = "\\t\\n\\v\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF";

        private static readonly HashSet<string> _textBlocks = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "pre"];
        private static readonly HashSet<string> _containers = ["doc", "row", "region", "blockquote", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "addon"];
        private static readonly HashSet<string> _marks = ["bold", "italic", "underline", "strikethrough", "superscript", "subscript", "code", "color", "background", "font", "size", "link", "comment"];
        private static readonly HashSet<string> _flags = ["bold", "italic", "underline", "strikethrough", "superscript", "subscript", "code"];
        private static readonly string[] _alignments = ["left", "right", "center", "justify", "start", "end"];

        private static readonly Dictionary<string, (string Content, int Min)> _content = new()
        {
            ["doc"] = ("row", 1),
            ["row"] = ("region", 1),
            ["region"] = ("block", 1),
            ["blockquote"] = ("block", 1),
            ["li"] = ("block", 1),
            ["td"] = ("block", 1),
            ["th"] = ("block", 1),
            ["addon"] = ("block", 1),
            ["ul"] = ("li", 1),
            ["ol"] = ("li", 1),
            ["table"] = ("section", 0),
            ["thead"] = ("tr", 0),
            ["tbody"] = ("tr", 0),
            ["tfoot"] = ("tr", 0),
            ["tr"] = ("cell", 0),
            ["p"] = ("inline", 0),
            ["h1"] = ("inline", 0),
            ["h2"] = ("inline", 0),
            ["h3"] = ("inline", 0),
            ["h4"] = ("inline", 0),
            ["h5"] = ("inline", 0),
            ["h6"] = ("inline", 0),
            ["pre"] = ("inline", 0)
        };

        private static readonly Regex _id = new("^n[0-9]{1,15}(?:-[a-z0-9]{1,12})?\\z", RegexOptions.CultureInvariant);
        private static readonly Regex _commentId = new("^[A-Za-z0-9_-]{1,100}\\z", RegexOptions.CultureInvariant);
        private static readonly Regex _forbiddenUrl = new("[\\u0000-\\u0020\\u007f-\\u009f\\\\]", RegexOptions.CultureInvariant);
        private static readonly Regex _http = new("^[Hh][Tt][Tt][Pp][Ss]?:", RegexOptions.CultureInvariant);
        private static readonly Regex _mailOrPhone = new("^(?:[Mm][Aa][Ii][Ll][Tt][Oo]:|[Tt][Ee][Ll]:)", RegexOptions.CultureInvariant);
        private static readonly Regex _scheme = new("^[^/?#]*:", RegexOptions.CultureInvariant);
        private static readonly Regex _color = new("^(?:#[0-9A-Fa-f]{3,8}|[A-Za-z]{1,24}|(?:[Rr][Gg][Bb]|[Rr][Gg][Bb][Aa]|[Hh][Ss][Ll]|[Hh][Ss][Ll][Aa])\\([0-9" + JsWhitespace + ".,%+-]+\\))\\z", RegexOptions.CultureInvariant);
        private static readonly Regex _font = new("^[A-Za-z0-9_ ,'-]{1,100}\\z", RegexOptions.CultureInvariant);
        private static readonly Regex _size = new("^(?:[0-9]+(?:\\.[0-9]+)?)(?:px|pt|em|rem|%)\\z", RegexOptions.CultureInvariant);
        private static readonly Regex _dimension = new("^(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:px|%)?\\z", RegexOptions.CultureInvariant);
        private static readonly Regex _addonName = new("^[A-Za-z0-9_.-]{1,100}\\z", RegexOptions.CultureInvariant);
        private static readonly Regex _dataKey = new("^[A-Za-z][A-Za-z0-9_-]{0,80}\\z", RegexOptions.CultureInvariant);
        private static readonly Regex _number = new("^[0-9]*\\.?[0-9]+", RegexOptions.CultureInvariant);

        /// <summary>
        /// Returns the document kind.
        /// </summary>
        public string Kind => "richtext";

        /// <summary>
        /// A node of the tree rebuilt from the tokens.
        /// </summary>
        private sealed class Node
        {
            public string Type;
            public string Id;
            public JsonObject Attributes;
            public JsonObject Marks;
            public int TextLength;
            public bool Leaf;
            public readonly List<Node> Children = [];
        }

        /// <summary>
        /// Checks a document.
        /// </summary>
        /// <param name="tokens">The tokens of the document.</param>
        /// <param name="reason">The violated rule.</param>
        /// <returns>True if the document is valid.</returns>
        public bool Validate(IReadOnlyList<OtToken> tokens, out string reason)
        {
            reason = null;

            var doc = Build(tokens, ref reason);

            if (doc is null)
            {
                return false;
            }

            var ids = new HashSet<string>(StringComparer.Ordinal);
            var count = 0;
            var text = 0;

            reason = Walk(doc, 0, ids, ref count, ref text);

            return reason is null;
        }

        /// <summary>
        /// Rebuilds the tree strictly: every closing token must close the innermost open node,
        /// leaves must be atomic and openings must not.
        /// </summary>
        /// <param name="tokens">The tokens.</param>
        /// <param name="reason">The violated rule.</param>
        /// <returns>The root, or null when the tokens are unbalanced.</returns>
        private static Node Build(IReadOnlyList<OtToken> tokens, ref string reason)
        {
            var doc = new Node { Type = "doc", Attributes = [] };
            var stack = new Stack<Node>();
            stack.Push(doc);
            Node run = null;

            foreach (var token in tokens)
            {
                var parent = stack.Peek();

                if (token.Kind == OtToken.Character)
                {
                    if (run is not null && parent.Children.Count > 0 && parent.Children[^1] == run && Canonical.Equal(run.Marks, token.Marks ?? []))
                    {
                        run.TextLength++;
                    }
                    else
                    {
                        run = new Node { Type = "text", Marks = token.Marks ?? [], TextLength = 1 };
                        parent.Children.Add(run);
                    }

                    continue;
                }

                run = null;

                if (token.Kind == OtToken.Close)
                {
                    if (stack.Count < 2 || parent.Id != token.Id || parent.Type != token.Type)
                    {
                        reason = "unbalanced tokens";
                        return null;
                    }

                    stack.Pop();
                    continue;
                }

                var node = new Node { Type = token.Type, Id = token.Id, Attributes = token.Attributes ?? [], Leaf = token.Kind == OtToken.Leaf };

                if (Atomic(node) != node.Leaf)
                {
                    reason = "unbalanced tokens";
                    return null;
                }

                parent.Children.Add(node);

                if (!node.Leaf)
                {
                    stack.Push(node);
                }
            }

            if (stack.Count != 1)
            {
                reason = "unbalanced tokens";
                return null;
            }

            return doc;
        }

        /// <summary>
        /// Checks a node and its descendants.
        /// </summary>
        /// <returns>The violated rule, or null.</returns>
        private static string Walk(Node node, int depth, HashSet<string> ids, ref int count, ref int text)
        {
            if (++count > MaxNodes || depth > MaxDepth)
            {
                return "structural limit exceeded";
            }

            if (node.Type == "text")
            {
                text += node.TextLength;

                if (text > MaxText)
                {
                    return "text limit exceeded";
                }

                return IsCanonicalMarks(node.Marks) ? null : "unsupported marks";
            }

            if (!_textBlocks.Contains(node.Type) && !_containers.Contains(node.Type) && node.Type is not ("image" or "atom" or "br" or "hr") || node.Type == "doc" && depth > 0)
            {
                return "unknown node " + node.Type;
            }

            if (depth > 0)
            {
                if (node.Id is null || !_id.IsMatch(node.Id) || !ids.Add(node.Id))
                {
                    return "invalid or duplicate id " + node.Id;
                }

                if (!IsCanonicalAttributes(node.Type, node.Attributes))
                {
                    return "unsupported attributes on " + node.Type;
                }

                if (node.Type == "image" && string.IsNullOrEmpty(OtDocument.ReadString(node.Attributes, "src")))
                {
                    return "image without source";
                }
            }

            if (Atomic(node))
            {
                return node.Children.Count > 0 ? node.Type + " holds children" : null;
            }

            var (content, min) = _content[node.Type];

            if (node.Children.Count < min)
            {
                return node.Type + " needs content";
            }

            foreach (var child in node.Children)
            {
                if (!Accepts(content, child))
                {
                    return child.Type + " inside " + node.Type;
                }

                var failure = Walk(child, depth + 1, ids, ref count, ref text);

                if (failure is not null)
                {
                    return failure;
                }
            }

            return null;
        }

        /// <summary>
        /// Determines whether a node holds no editable children.
        /// </summary>
        private static bool Atomic(Node node)
        {
            return node.Type is "image" or "atom" or "br" or "hr" || node.Type == "addon" && !Truthy(node.Attributes["container"]);
        }

        /// <summary>
        /// Determines whether a node is text-level content.
        /// </summary>
        private static bool Inline(Node node)
        {
            return node.Type is "text" or "image" or "atom" or "br" || node.Type == "addon" && Truthy(node.Attributes["inline"]);
        }

        /// <summary>
        /// Determines whether a content group accepts a node.
        /// </summary>
        private static bool Accepts(string group, Node node)
        {
            return group switch
            {
                "inline" => Inline(node),
                "block" => !Inline(node) && (_textBlocks.Contains(node.Type) || node.Type is "ul" or "ol" or "blockquote" or "table" or "hr" or "addon"),
                "section" => node.Type is "thead" or "tbody" or "tfoot",
                "cell" => node.Type is "td" or "th",
                _ => node.Type == group
            };
        }

        /// <summary>
        /// Applies JavaScript truthiness to a JSON value.
        /// </summary>
        private static bool Truthy(JsonNode node)
        {
            if (node is null)
            {
                return false;
            }

            return node.GetValueKind() switch
            {
                JsonValueKind.False or JsonValueKind.Null => false,
                JsonValueKind.Number => Canonical.Number(node.AsValue()) != 0,
                JsonValueKind.String => node.GetValue<string>().Length > 0,
                _ => true
            };
        }

        /// <summary>
        /// Determines whether marks are exactly what the client's sanitizer produces from them.
        /// </summary>
        /// <param name="marks">The marks.</param>
        /// <returns>True if the marks are canonical.</returns>
        internal static bool IsCanonicalMarks(JsonObject marks)
        {
            if (marks.ContainsKey("subscript") && marks.ContainsKey("superscript"))
            {
                return false;
            }

            foreach (var (name, value) in marks)
            {
                if (!_marks.Contains(name))
                {
                    return false;
                }

                var valid = name switch
                {
                    "comment" => IsCanonicalComment(value),
                    "link" => IsCanonicalLink(value),
                    "color" or "background" or "font" or "size" => value is JsonValue v && v.GetValueKind() == JsonValueKind.String && Style(name, v.GetValue<string>()) is { Length: > 0 } s && s == v.GetValue<string>(),
                    _ => _flags.Contains(name) && value is JsonValue flag && flag.GetValueKind() == JsonValueKind.True
                };

                if (!valid)
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// A comment anchor: an id, and optionally its text when no comment store holds it.
        /// </summary>
        private static bool IsCanonicalComment(JsonNode value)
        {
            if (value is not JsonObject comment || comment.Any(p => p.Key is not ("id" or "text")))
            {
                return false;
            }

            if (OtDocument.ReadString(comment, "id") is not { } id || !_commentId.IsMatch(id))
            {
                return false;
            }

            if (!comment.ContainsKey("text"))
            {
                return true;
            }

            var text = OtDocument.ReadString(comment, "text");

            return text is not null && text.Length is > 0 and <= 10000 && JsTrim(text) == text;
        }

        /// <summary>
        /// A link: a safe address and an optional new-window target.
        /// </summary>
        private static bool IsCanonicalLink(JsonNode value)
        {
            if (value is not JsonObject link || link.Count != 2)
            {
                return false;
            }

            var href = OtDocument.ReadString(link, "href");
            var target = OtDocument.ReadString(link, "target");

            return href is { Length: > 0 } && Url(href, false) == href && target is "" or "_blank";
        }

        /// <summary>
        /// Determines whether attributes are exactly what the client's sanitizer produces.
        /// </summary>
        /// <param name="type">The node type.</param>
        /// <param name="attributes">The attributes.</param>
        /// <returns>True if the attributes are canonical.</returns>
        internal static bool IsCanonicalAttributes(string type, JsonObject attributes)
        {
            var required = new List<string>();
            var allowed = new HashSet<string>(["align", "dir", "indent", "background"]);

            switch (type)
            {
                case "region": required.Add("weight"); break;
                case "td": case "th": required.AddRange(["colspan", "rowspan"]); allowed.Add("scope"); break;
                case "table": allowed.Add("widths"); break;
                case "ol": required.Add("start"); break;
                case "image": required.AddRange(["src", "alt"]); allowed.UnionWith(["width", "height", "link"]); break;
                case "atom": required.AddRange(["kind", "text", "value", "format"]); break;
                case "addon": required.AddRange(["name", "inline", "container", "data"]); break;
            }

            allowed.UnionWith(required);

            if (required.Any(k => !attributes.ContainsKey(k)) || attributes.Any(p => !allowed.Contains(p.Key)))
            {
                return false;
            }

            foreach (var (key, value) in attributes)
            {
                if (!IsCanonicalAttribute(type, key, value, attributes))
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// Checks one attribute value against its sanitized form.
        /// </summary>
        private static bool IsCanonicalAttribute(string type, string key, JsonNode value, JsonObject attributes)
        {
            var text = value is JsonValue s && s.GetValueKind() == JsonValueKind.String ? s.GetValue<string>() : null;
            var number = value is JsonValue n && n.GetValueKind() == JsonValueKind.Number ? Canonical.Number(n) : (double?)null;
            var integer = number is { } i && i == Math.Floor(i);

            switch (key)
            {
                case "align":
                    return text is not null && (_alignments.Contains(text) || type == "image" && text == "inline");
                case "dir":
                    return text is "ltr" or "rtl";
                case "indent":
                    return integer && number is >= 0 and <= 12;
                case "background":
                    return text is { Length: > 0 } && Style("background", text) == text;
                case "weight":
                    return number is >= 1 and <= 12;
                case "colspan":
                case "rowspan":
                    return integer && number is >= 1 and <= 100;
                case "scope":
                    return text is "row" or "col";
                case "widths":
                    return value is JsonArray widths && widths.Count <= 100
                        && widths.All(w => w is JsonValue v && v.GetValueKind() == JsonValueKind.Number && Canonical.Number(v) is >= 30 and <= 2000);
                case "start":
                    return integer && number is >= 1 and <= 100000;
                case "src":
                    return text is not null && Url(text, true) == text;
                case "alt":
                case "text" when type == "atom":
                case "value":
                case "format":
                    return text is not null && text.Length <= 10000;
                case "width":
                case "height":
                    return text is not null && _dimension.IsMatch(text) && ParseFloat(text) > 0 && (text.EndsWith("px", StringComparison.Ordinal) || text.EndsWith('%'));
                case "link":
                    return IsCanonicalLink(value);
                case "kind":
                    return text is "instruction" or "mention" or "date";
                case "name":
                    return text is not null && (text == "" || _addonName.IsMatch(text));
                case "inline":
                    return value is JsonValue b && b.GetValueKind() is JsonValueKind.True or JsonValueKind.False;
                case "container":
                    return value is JsonValue c && (c.GetValueKind() == JsonValueKind.False || c.GetValueKind() == JsonValueKind.True && attributes["inline"]?.GetValueKind() == JsonValueKind.False);
                case "data":
                    return value is JsonObject data && data.Count <= 100 && data.All(p =>
                        _dataKey.IsMatch(p.Key) && p.Key is not ("constructor" or "prototype" or "__proto__")
                        && p.Value is JsonValue v && v.GetValueKind() == JsonValueKind.String && v.GetValue<string>().Length <= 10000);
                default:
                    return false;
            }
        }

        /// <summary>
        /// The client's address filter: http(s) everywhere, mailto and tel for links, relative
        /// addresses without a scheme, and nothing with control characters or backslashes.
        /// </summary>
        /// <param name="value">The address.</param>
        /// <param name="image">Whether the address is an image source.</param>
        /// <returns>The accepted address, or an empty string.</returns>
        internal static string Url(string value, bool image)
        {
            var text = JsTrim(value ?? "");

            if (text.Length == 0 || _forbiddenUrl.IsMatch(text))
            {
                return "";
            }

            if (_http.IsMatch(text) || !image && _mailOrPhone.IsMatch(text))
            {
                return text;
            }

            return !_scheme.IsMatch(text) && !text.StartsWith("//", StringComparison.Ordinal) ? text : "";
        }

        /// <summary>
        /// The client's style filter for inline colors, fonts and sizes.
        /// </summary>
        /// <param name="name">The mark or attribute name.</param>
        /// <param name="value">The value.</param>
        /// <returns>The accepted value, or an empty string.</returns>
        internal static string Style(string name, string value)
        {
            var text = JsTrim(value ?? "");

            return name switch
            {
                "color" or "background" => _color.IsMatch(text) ? text : "",
                "font" => _font.IsMatch(text) ? text : "",
                "size" => _size.IsMatch(text) ? text : "",
                _ => ""
            };
        }

        /// <summary>
        /// Trims the whitespace JavaScript's String.prototype.trim removes, which includes
        /// characters .NET does not count as whitespace, such as the byte order mark.
        /// </summary>
        /// <param name="value">The text.</param>
        /// <returns>The trimmed text.</returns>
        internal static string JsTrim(string value)
        {
            static bool Space(char c) => c is '\t' or '\n' or '\v' or '\f' or '\r' or ' ' or '\u00A0' or '\u1680' or '\u2028' or '\u2029' or '\u202F' or '\u205F' or '\u3000' or '\uFEFF' || c >= '\u2000' && c <= '\u200A';

            var start = 0;
            var end = value.Length;

            while (start < end && Space(value[start]))
            {
                start++;
            }

            while (end > start && Space(value[end - 1]))
            {
                end--;
            }

            return value[start..end];
        }

        /// <summary>
        /// Reads the leading number of a dimension the way parseFloat does for the inputs the
        /// dimension pattern admits.
        /// </summary>
        private static double ParseFloat(string text)
        {
            var match = _number.Match(text);

            return match.Success ? double.Parse(match.Value, CultureInfo.InvariantCulture) : double.NaN;
        }
    }
}
