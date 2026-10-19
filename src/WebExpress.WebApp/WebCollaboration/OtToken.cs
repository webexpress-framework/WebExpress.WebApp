using System.Text.Json.Nodes;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// One position of a linearized shared document: a character, the opening or the closing of
    /// a structured node, or an atomic leaf.
    /// </summary>
    /// <remarks>
    /// The server mirrors the token model of the JavaScript transformation core
    /// (webexpress.webui.ot.js) so it can apply and validate operations. It never transforms
    /// them; that logic exists only on the client, where a single implementation cannot drift
    /// from a second one.
    /// </remarks>
    public sealed class OtToken
    {
        /// <summary>
        /// The kind of a character token.
        /// </summary>
        public const char Character = 'c';

        /// <summary>
        /// The kind of the token opening a structured node.
        /// </summary>
        public const char Open = 'o';

        /// <summary>
        /// The kind of the token closing a structured node.
        /// </summary>
        public const char Close = 'e';

        /// <summary>
        /// The kind of an atomic leaf.
        /// </summary>
        public const char Leaf = 'l';

        /// <summary>
        /// Returns the kind of the token.
        /// </summary>
        public char Kind { get; init; }

        /// <summary>
        /// Returns the UTF-16 code unit of a character token.
        /// </summary>
        public char Value { get; init; }

        /// <summary>
        /// Returns the node type of a node token.
        /// </summary>
        public string Type { get; init; }

        /// <summary>
        /// Returns the node id of a node token.
        /// </summary>
        public string Id { get; init; }

        /// <summary>
        /// Returns the attributes of an opening or leaf token. Tokens are immutable by
        /// convention: a change replaces the token, so documents may share token instances.
        /// </summary>
        public JsonObject Attributes { get; init; }

        /// <summary>
        /// Returns the marks of a character token, shared like the attributes.
        /// </summary>
        public JsonObject Marks { get; init; }
    }
}
