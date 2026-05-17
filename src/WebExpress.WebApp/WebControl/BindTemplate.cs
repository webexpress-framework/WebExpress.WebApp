using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a declarative template binding for REST tab templates.
    /// Generates the unified binding attributes used by the tab controller:
    /// <c>data-wx-bind</c> and optional per-key metadata attributes.
    /// </summary>
    public class BindTemplate : IBind
    {
        private readonly Dictionary<string, (TypeBindMode Mode, string Target, string Name)> _keys = new(StringComparer.Ordinal);

        /// <summary>
        /// Returns the binding name list as a comma-separated key sequence.
        /// </summary>
        public string Name => string.Join(", ", _keys.Keys);

        /// <summary>
        /// Gets the configured binding keys in insertion order.
        /// </summary>
        public IEnumerable<string> Keys => _keys.Keys;

        /// <summary>
        /// Adds a binding key with optional per-key binding options.
        /// </summary>
        /// <param name="key">The source key to bind.</param>
        /// <param name="mode">Optional mode. Default is <see cref="TypeBindMode.Text"/>.</param>
        /// <param name="target">Optional target selector. Default is <c>self</c>.</param>
        /// <param name="name">Optional mode-specific name.</param>
        /// <returns>The current instance for method chaining.</returns>
        public BindTemplate Add(string key, TypeBindMode mode = TypeBindMode.Text, string target = null, string name = null)
        {
            var normalizedKey = key?.Trim();
            if (string.IsNullOrWhiteSpace(normalizedKey))
            {
                return this;
            }

            _keys[normalizedKey] =
            (
                mode,
                target?.Trim(),
                name?.Trim()
            );

            return this;
        }

        /// <summary>
        /// Removes a key from the binding definition.
        /// </summary>
        /// <param name="key">The key to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public BindTemplate Remove(string key)
        {
            var normalizedKey = key?.Trim();
            if (!string.IsNullOrWhiteSpace(normalizedKey))
            {
                _keys.Remove(normalizedKey);
            }

            return this;
        }

        /// <summary>
        /// Applies template binding attributes to the specified HTML node.
        /// </summary>
        /// <param name="htmlNode">The HTML node to decorate.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IBind ApplyUserAttributes(IHtmlNode htmlNode)
        {
            if (htmlNode == null || _keys.Count == 0)
            {
                return this;
            }

            htmlNode.RemoveUserAttribute("data-wx-bind");
            htmlNode.AddUserAttribute("data-wx-bind", Name);

            foreach (var key in _keys)
            {
                var keyName = key.Key;
                var mode = key.Value.Mode;
                var target = key.Value.Target;
                var name = key.Value.Name;

                if (mode != TypeBindMode.Text)
                {
                    htmlNode.AddUserAttribute($"data-wx-bind-{keyName}-mode", mode.ToString().ToLowerInvariant());
                }

                if (!string.IsNullOrWhiteSpace(target) && !string.Equals(target, "self", StringComparison.OrdinalIgnoreCase))
                {
                    htmlNode.AddUserAttribute($"data-wx-bind-{keyName}-target", target);
                }

                if (!string.IsNullOrWhiteSpace(name))
                {
                    htmlNode.AddUserAttribute($"data-wx-bind-{keyName}-name", name);
                }
            }

            return this;
        }

        /// <summary>
        /// Returns a JSON representation of the template binding definition.
        /// </summary>
        /// <returns>A dictionary containing binding keys and per-key options.</returns>
        public virtual Dictionary<string, object> ToJson()
        {
            var keys = _keys.Keys.ToArray();
            var options = _keys.ToDictionary(
                x => x.Key,
                x => (object)new Dictionary<string, string>
                {
                    ["mode"] = x.Value.Mode.ToString().ToLowerInvariant(),
                    ["target"] = string.IsNullOrWhiteSpace(x.Value.Target) ? "self" : x.Value.Target,
                    ["name"] = string.IsNullOrWhiteSpace(x.Value.Name) ? string.Empty : x.Value.Name
                });

            return new Dictionary<string, object>
            {
                ["bind"] = Name,
                ["keys"] = keys,
                ["options"] = options
            };
        }
    }
}
