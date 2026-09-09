using System.Text.Json;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for the table column template descriptors. Each
    /// descriptor serializes into <c>{ type, options }</c>, and the option
    /// names must match what the client-side renderer of the same type reads,
    /// so these tests pin the wire contract of every template.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiTableColumnTemplate
    {
        /// <summary>
        /// Parses the serialized template into its root element.
        /// </summary>
        /// <param name="template">The template descriptor.</param>
        /// <returns>The parsed root element.</returns>
        private static JsonElement Parse(IRestApiTableColumnTemplate template)
        {
            using var doc = JsonDocument.Parse(template.ToJson());

            return doc.RootElement.Clone();
        }

        /// <summary>
        /// Verifies the wire contract of the text template.
        /// </summary>
        [Fact]
        public void Text()
        {
            var root = Parse(new RestApiTableColumnTemplateText(true, TypeColorText.Info, "Enter value"));
            var options = root.GetProperty("options");

            Assert.Equal("text", root.GetProperty("type").GetString());
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.Equal("text-info", options.GetProperty("colorCss").GetString());
            Assert.Equal("Enter value", options.GetProperty("placeholder").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the numeric template, including the
        /// optional range that is only emitted when set.
        /// </summary>
        [Fact]
        public void Numeric()
        {
            var root = Parse(new RestApiTableColumnTemplateNumeric(true) { Min = 0, Max = 100, Step = 5 });
            var options = root.GetProperty("options");

            Assert.Equal("numeric", root.GetProperty("type").GetString());
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.Equal(0, options.GetProperty("min").GetDouble());
            Assert.Equal(100, options.GetProperty("max").GetDouble());
            Assert.Equal(5, options.GetProperty("step").GetDouble());

            var plain = Parse(new RestApiTableColumnTemplateNumeric());
            Assert.False(plain.GetProperty("options").TryGetProperty("min", out _));
        }

        /// <summary>
        /// Verifies the wire contract of the date template.
        /// </summary>
        [Fact]
        public void Date()
        {
            var root = Parse(new RestApiTableColumnTemplateDate(true));
            var options = root.GetProperty("options");

            Assert.Equal("date", root.GetProperty("type").GetString());
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.Equal("yyyy-MM-dd", options.GetProperty("format").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the calendar template.
        /// </summary>
        [Fact]
        public void Calendar()
        {
            var root = Parse(new RestApiTableColumnTemplateCalendar(false, "dd.MM.yyyy"));
            var options = root.GetProperty("options");

            Assert.Equal("calendar", root.GetProperty("type").GetString());
            Assert.False(options.GetProperty("editable").GetBoolean());
            Assert.Equal("dd.MM.yyyy", options.GetProperty("format").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the selection template, whose items
        /// travel as an embedded JSON string the renderer parses.
        /// </summary>
        [Fact]
        public void Selection()
        {
            var root = Parse(new RestApiTableColumnTemplateSelection(true, true)
            {
                Items =
                [
                    new RestApiTableColumnTemplateItem() { Id = "a", Text = "Option A", Color = "text-primary" },
                    new RestApiTableColumnTemplateItem() { Id = "b", Text = "Option B" }
                ]
            });
            var options = root.GetProperty("options");

            Assert.Equal("selection", root.GetProperty("type").GetString());
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.True(options.GetProperty("multiselection").GetBoolean());

            using var items = JsonDocument.Parse(options.GetProperty("options").GetString());
            var list = items.RootElement.EnumerateArray().ToList();
            Assert.Equal(2, list.Count);
            Assert.Equal("a", list[0].GetProperty("id").GetString());
            Assert.Equal("Option A", list[0].GetProperty("label").GetString());
            Assert.Equal("text-primary", list[0].GetProperty("labelColor").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the combo template, whose items use
        /// the value and text names the native select renderer reads.
        /// </summary>
        [Fact]
        public void Combo()
        {
            var root = Parse(new RestApiTableColumnTemplateCombo(true)
            {
                Items = [new RestApiTableColumnTemplateItem() { Id = "pirate", Text = "Pirate" }]
            });
            var options = root.GetProperty("options");

            Assert.Equal("combo", root.GetProperty("type").GetString());

            using var items = JsonDocument.Parse(options.GetProperty("options").GetString());
            var list = items.RootElement.EnumerateArray().ToList();
            Assert.Single(list);
            Assert.Equal("pirate", list[0].GetProperty("value").GetString());
            Assert.Equal("Pirate", list[0].GetProperty("text").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the move template.
        /// </summary>
        [Fact]
        public void Move()
        {
            var root = Parse(new RestApiTableColumnTemplateMove(true)
            {
                Items = [new RestApiTableColumnTemplateItem() { Id = "sword", Text = "Sword" }]
            });
            var options = root.GetProperty("options");

            Assert.Equal("move", root.GetProperty("type").GetString());

            using var items = JsonDocument.Parse(options.GetProperty("options").GetString());
            var list = items.RootElement.EnumerateArray().ToList();
            Assert.Single(list);
            Assert.Equal("sword", list[0].GetProperty("id").GetString());
            Assert.Equal("Sword", list[0].GetProperty("label").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the color template.
        /// </summary>
        [Fact]
        public void Color()
        {
            var root = Parse(new RestApiTableColumnTemplateColor(true, "The favorite color"));
            var options = root.GetProperty("options");

            Assert.Equal("color", root.GetProperty("type").GetString());
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.Equal("The favorite color", options.GetProperty("tooltip").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the editor template.
        /// </summary>
        [Fact]
        public void Editor()
        {
            var root = Parse(new RestApiTableColumnTemplateEditor(true));

            Assert.Equal("editor", root.GetProperty("type").GetString());
            Assert.True(root.GetProperty("options").GetProperty("editable").GetBoolean());
        }

        /// <summary>
        /// Verifies the wire contract of the rating template.
        /// </summary>
        [Fact]
        public void Rating()
        {
            var root = Parse(new RestApiTableColumnTemplateRating(true, 10));
            var options = root.GetProperty("options");

            Assert.Equal("rating", root.GetProperty("type").GetString());
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.Equal(10u, options.GetProperty("stars").GetUInt32());
        }

        /// <summary>
        /// Verifies the wire contract of the traffic light template.
        /// </summary>
        [Fact]
        public void TrafficLight()
        {
            var root = Parse(new RestApiTableColumnTemplateTrafficLight(true, horizontal: true, size: "sm"));
            var options = root.GetProperty("options");

            Assert.Equal("traffic-light", root.GetProperty("type").GetString());
            Assert.Equal("horizontal", options.GetProperty("orientation").GetString());
            Assert.Equal("sm", options.GetProperty("size").GetString());

            var vertical = Parse(new RestApiTableColumnTemplateTrafficLight());
            Assert.Equal("vertical", vertical.GetProperty("options").GetProperty("orientation").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the status template, which is
        /// read-only by design.
        /// </summary>
        [Fact]
        public void Status()
        {
            var template = new RestApiTableColumnTemplateStatus(true);
            var root = Parse(template);

            Assert.Equal("status", root.GetProperty("type").GetString());
            Assert.True(root.GetProperty("options").GetProperty("showLabel").GetBoolean());
            Assert.False(template.Editable);
        }

        /// <summary>
        /// Verifies the wire contract of the rest combo template.
        /// </summary>
        [Fact]
        public void RestCombo()
        {
            var root = Parse(new RestApiTableColumnTemplateRestCombo(true, "Pick one")
            {
                Uri = new UriEndpoint("https://example.com/api/items")
            });
            var options = root.GetProperty("options");

            Assert.Equal("rest_combo", root.GetProperty("type").GetString());
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.Equal("Pick one", options.GetProperty("placeholder").GetString());
            Assert.Equal("https://example.com/api/items", options.GetProperty("uri").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the rest tag template.
        /// </summary>
        [Fact]
        public void RestTag()
        {
            var root = Parse(new RestApiTableColumnTemplateRestTag(true, "Add tag")
            {
                Uri = new UriEndpoint("https://example.com/api/tags")
            });
            var options = root.GetProperty("options");

            Assert.Equal("rest_tag", root.GetProperty("type").GetString());
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.Equal("Add tag", options.GetProperty("placeholder").GetString());
            Assert.Equal("https://example.com/api/tags", options.GetProperty("uri").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the dnf template, whose terms travel as
        /// an embedded JSON string the renderer parses. The defaults - an unlimited
        /// number of conjunctions and a clipped read state - are expressed by the
        /// absence of an option rather than by a value the renderer would have to
        /// special case.
        /// </summary>
        [Fact]
        public void Dnf()
        {
            var root = Parse(new RestApiTableColumnTemplateDnf(true, "Pick a term", 3, false)
            {
                Items =
                [
                    new RestApiTableColumnTemplateItem() { Id = "a", Text = "Amsterdam", Color = "wx-selection-primary" },
                    new RestApiTableColumnTemplateItem() { Id = "b", Text = "Berlin" }
                ]
            });
            var options = root.GetProperty("options");

            Assert.Equal("dnf", root.GetProperty("type").GetString());
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.Equal("Pick a term", options.GetProperty("placeholder").GetString());
            Assert.Equal(3, options.GetProperty("maxGroups").GetInt32());
            Assert.Equal("false", options.GetProperty("compact").GetString());

            using var items = JsonDocument.Parse(options.GetProperty("options").GetString());
            var list = items.RootElement.EnumerateArray().ToList();
            Assert.Equal(2, list.Count);
            Assert.Equal("a", list[0].GetProperty("id").GetString());
            Assert.Equal("Amsterdam", list[0].GetProperty("label").GetString());
            Assert.Equal("wx-selection-primary", list[0].GetProperty("color").GetString());

            var plain = Parse(new RestApiTableColumnTemplateDnf()).GetProperty("options");
            Assert.Equal(JsonValueKind.Null, plain.GetProperty("maxGroups").ValueKind);
            Assert.Equal(JsonValueKind.Null, plain.GetProperty("compact").ValueKind);
        }

        /// <summary>
        /// Verifies the wire contract of the rest dnf template, whose terms are
        /// queried from an endpoint instead of travelling with the table.
        /// </summary>
        [Fact]
        public void RestDnf()
        {
            var root = Parse(new RestApiTableColumnTemplateRestDnf(true, "Pick a term")
            {
                Uri = new UriEndpoint("https://example.com/api/terms")
            });
            var options = root.GetProperty("options");

            Assert.Equal("rest_dnf", root.GetProperty("type").GetString());
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.Equal("Pick a term", options.GetProperty("placeholder").GetString());
            Assert.Equal("https://example.com/api/terms", options.GetProperty("uri").GetString());
        }

        /// <summary>
        /// Verifies the wire contract of the markdown template, which is
        /// read-only and carries no options.
        /// </summary>
        [Fact]
        public void Markdown()
        {
            var template = new RestApiTableColumnTemplateMarkdown();
            var root = Parse(template);

            Assert.Equal("markdown", root.GetProperty("type").GetString());
            Assert.Empty(root.GetProperty("options").EnumerateObject());
            Assert.False(template.Editable);
        }

        /// <summary>
        /// Verifies the wire contract of the html template, which is
        /// read-only and carries no options.
        /// </summary>
        [Fact]
        public void Html()
        {
            var template = new RestApiTableColumnTemplateHtml();
            var root = Parse(template);

            Assert.Equal("html", root.GetProperty("type").GetString());
            Assert.Empty(root.GetProperty("options").EnumerateObject());
            Assert.False(template.Editable);
        }

        /// <summary>
        /// Verifies that a base-class descriptor flows through the interface
        /// json converter when a column is serialized, so the template
        /// arrives as an embedded object rather than a string.
        /// </summary>
        [Fact]
        public void ColumnEmbedsTemplateAsObject()
        {
            var column = new RestApiTableColumn()
            {
                Id = "value",
                Name = "Value",
                Label = "Value",
                Template = new RestApiTableColumnTemplateMarkdown()
            };

            var json = JsonSerializer.Serialize(column, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            using var doc = JsonDocument.Parse(json);
            var template = doc.RootElement.GetProperty("template");

            Assert.Equal(JsonValueKind.Object, template.ValueKind);
            Assert.Equal("markdown", template.GetProperty("type").GetString());
        }
    }
}
