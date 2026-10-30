using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Transfers table presentation without owning application persistence.
    /// </summary>
    public sealed class RestApiTableLayout
    {
        /// <summary>
        /// Gets or sets the version shared with the client layout API.
        /// </summary>
        [JsonPropertyName("version")]
        public int Version { get; set; } = 1;
        /// <summary>
        /// Gets or sets column settings in display order.
        /// </summary>
        [JsonPropertyName("columns")]
        public IList<RestApiTableColumnUpdate> Columns { get; set; } = [];

        /// <summary>
        /// Captures only presentation settings from current column definitions.
        /// </summary>
        /// <param name="columns">The current columns in display order.</param>
        /// <returns>A detached layout snapshot.</returns>
        public static RestApiTableLayout Capture(IEnumerable<RestApiTableColumn> columns)
        {
            ArgumentNullException.ThrowIfNull(columns);
            return new() { Columns = columns.Select(column => new RestApiTableColumnUpdate
            {
                Id = column.Id, Visible = column.Visible, Width = column.Width
            }).ToList() };
        }

        /// <summary>
        /// Serializes the layout for storage chosen by the application.
        /// </summary>
        /// <returns>The versioned layout JSON.</returns>
        public string ToJson() => JsonSerializer.Serialize(this);

        /// <summary>
        /// Validates persisted presentation before it reaches table rendering.
        /// </summary>
        /// <param name="value">The versioned layout JSON.</param>
        /// <returns>The validated layout.</returns>
        /// <exception cref="JsonException">The layout has an unsupported or invalid shape.</exception>
        public static RestApiTableLayout Parse(string value)
        {
            using var document = JsonDocument.Parse(value);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("version", out var version) ||
                version.ValueKind != JsonValueKind.Number || !version.TryGetInt32(out var number) || number != 1 ||
                !root.TryGetProperty("columns", out var columns) || columns.ValueKind != JsonValueKind.Array)
                throw new JsonException("Invalid table layout.");
            var layout = JsonSerializer.Deserialize<RestApiTableLayout>(value);
            if (layout is null || layout.Version != 1 || layout.Columns is null || layout.Columns.Any(column =>
                column is null || string.IsNullOrEmpty(column.Id) || column.Width == 0))
                throw new JsonException("Invalid table layout.");
            return layout;
        }

        /// <summary>
        /// Returns request-local columns with stored presentation and current definitions.
        /// </summary>
        /// <param name="columns">The current server columns. New columns are appended and removed columns are ignored.</param>
        /// <returns>Column copies in display order without mutating shared definitions.</returns>
        public IReadOnlyList<RestApiTableColumn> Apply(IEnumerable<RestApiTableColumn> columns)
        {
            ArgumentNullException.ThrowIfNull(columns);
            var source = columns.ToList();
            var settings = Columns.Where(column => column is not null).GroupBy(column => column.Id)
                .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);
            var order = Columns.Select(column => column?.Id).Concat(source.Select(column => column.Id)).Distinct();
            var byId = source.ToDictionary(column => column.Id, StringComparer.Ordinal);
            return order.Where(id => id is not null && byId.ContainsKey(id)).Select(id =>
            {
                var column = byId[id];
                settings.TryGetValue(id, out var setting);
                return new RestApiTableColumn
                {
                    Id = column.Id, Name = column.Name, Label = column.Label, Icon = column.Icon,
                    Template = column.Template, Visible = setting?.Visible ?? column.Visible,
                    Width = setting is null ? column.Width : setting.Width
                };
            }).ToList();
        }
    }
}
