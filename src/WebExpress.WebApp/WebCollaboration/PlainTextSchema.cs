using System.Collections.Generic;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// The schema of shared plain text, such as a WQL prompt: characters without marks or
    /// structure, up to a length limit.
    /// </summary>
    public sealed class PlainTextSchema : ICollaborativeSchema
    {
        /// <summary>
        /// The maximum number of characters.
        /// </summary>
        public const int MaxLength = 100000;

        /// <summary>
        /// Returns the document kind.
        /// </summary>
        public string Kind => "text";

        /// <summary>
        /// Checks a document.
        /// </summary>
        /// <param name="tokens">The tokens of the document.</param>
        /// <param name="reason">The violated rule.</param>
        /// <returns>True if the document is valid.</returns>
        public bool Validate(IReadOnlyList<OtToken> tokens, out string reason)
        {
            reason = null;

            if (tokens.Count > MaxLength)
            {
                reason = "text limit exceeded";
                return false;
            }

            foreach (var token in tokens)
            {
                if (token.Kind != OtToken.Character || token.Marks is { Count: > 0 } || token.Value == '\r')
                {
                    reason = "plain text holds only unformatted characters";
                    return false;
                }
            }

            return true;
        }
    }
}
