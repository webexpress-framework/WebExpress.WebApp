using System;
using System.Security.Cryptography;
using System.Text;
using WebExpress.WebCore;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Issues and verifies the access tokens of shared documents.
    /// </summary>
    /// <remarks>
    /// A page that renders a collaborative container is the proof that its user may see the
    /// documents in it, so the container carries a token the server signed for exactly that
    /// document scope and access mode. The socket then needs no knowledge of pages or records:
    /// a client without the token of a scope can neither read nor change its documents. The
    /// signing key is shared through the cluster store, so a token rendered by one instance is
    /// accepted by every other.
    /// </remarks>
    public static class CollaborativeAccess
    {
        private static readonly object _gate = new();
        private static byte[] _key;

        /// <summary>
        /// Creates the token for a document scope.
        /// </summary>
        /// <param name="scope">The scope; every document id below it ("scope/field") is covered.</param>
        /// <param name="write">True to allow changes, false to allow reading only.</param>
        /// <returns>The token.</returns>
        public static string CreateToken(string scope, bool write)
        {
            ArgumentException.ThrowIfNullOrEmpty(scope);

            var mode = write ? "w" : "r";

            return Encode(Encoding.UTF8.GetBytes(scope)) + "." + mode + "." + Encode(Sign(mode, scope));
        }

        /// <summary>
        /// Verifies a token for a document.
        /// </summary>
        /// <param name="token">The token.</param>
        /// <param name="document">The document id.</param>
        /// <param name="write">Receives whether the token allows changes.</param>
        /// <returns>True if the token is genuine and covers the document.</returns>
        public static bool TryValidate(string token, string document, out bool write)
        {
            write = false;

            if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(document) || token.Length > 2000)
            {
                return false;
            }

            var parts = token.Split('.');

            if (parts.Length != 3 || parts[1] is not ("w" or "r"))
            {
                return false;
            }

            string scope;
            byte[] signature;

            try
            {
                scope = Encoding.UTF8.GetString(Decode(parts[0]));
                signature = Decode(parts[2]);
            }
            catch (FormatException)
            {
                return false;
            }

            if (!CryptographicOperations.FixedTimeEquals(signature, Sign(parts[1], scope)))
            {
                return false;
            }

            if (document != scope && !document.StartsWith(scope + "/", StringComparison.Ordinal))
            {
                return false;
            }

            write = parts[1] == "w";

            return true;
        }

        /// <summary>
        /// Replaces the signing key, for tests and for applications that manage keys themselves.
        /// </summary>
        /// <param name="key">The key, at least 32 bytes.</param>
        public static void UseKey(byte[] key)
        {
            if (key is null || key.Length < 32)
            {
                throw new ArgumentException("The key needs at least 32 bytes.", nameof(key));
            }

            lock (_gate)
            {
                _key = (byte[])key.Clone();
            }
        }

        /// <summary>
        /// Signs a mode and scope.
        /// </summary>
        /// <param name="mode">The access mode.</param>
        /// <param name="scope">The scope.</param>
        /// <returns>The signature.</returns>
        private static byte[] Sign(string mode, string scope)
        {
            return HMACSHA256.HashData(Key, Encoding.UTF8.GetBytes(mode + "|" + scope));
        }

        /// <summary>
        /// Returns the signing key, taking the cluster's shared one when there is a shared store.
        /// </summary>
        private static byte[] Key
        {
            get
            {
                lock (_gate)
                {
                    if (_key is not null)
                    {
                        return _key;
                    }

                    var candidate = RandomNumberGenerator.GetBytes(32);

                    if (WebEx.ComponentHub?.ClusterManager?.Store is { IsShared: true } store)
                    {
                        store.TryAdd("webexpress.collaborative", "key", candidate, TimeSpan.FromDays(3650));
                        candidate = store.Get("webexpress.collaborative", "key") ?? candidate;
                    }

                    return _key = candidate;
                }
            }
        }

        /// <summary>
        /// Encodes bytes as URL-safe base64 without padding.
        /// </summary>
        private static string Encode(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        /// <summary>
        /// Decodes URL-safe base64 without padding.
        /// </summary>
        private static byte[] Decode(string value)
        {
            var text = value.Replace('-', '+').Replace('_', '/');

            return Convert.FromBase64String(text + new string('=', (4 - text.Length % 4) % 4));
        }
    }
}
