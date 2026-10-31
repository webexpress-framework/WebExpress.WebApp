using System;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using WebExpress.WebApp.WebCollaboration;

namespace WebExpress.WebApp.Test.WebCollaboration
{
    /// <summary>
    /// Replays the cross-language fixture (JsTest/collaborative.fixture.json), which the
    /// JavaScript client generated, against the server's apply and schema. The server never
    /// transforms, but it must apply every step and judge every document exactly like the
    /// client, or clients and server would disagree on the shared state.
    /// </summary>
    public class UnitTestCollaborativeFixture
    {
        private static readonly Lazy<JsonObject> _fixture = new(() =>
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);

            while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "JsTest", "collaborative.fixture.json")))
            {
                directory = directory.Parent;
            }

            Assert.NotNull(directory);

            return JsonNode.Parse(File.ReadAllText(Path.Combine(directory.FullName, "JsTest", "collaborative.fixture.json"))).AsObject();
        });

        /// <summary>
        /// Every history the client simulation sequenced yields the same final document on the
        /// server, and every intermediate document passes the server's schema.
        /// </summary>
        [Fact]
        public void Histories_ReplayToTheClientsResult()
        {
            var schema = new RichTextSchema();

            foreach (var history in _fixture.Value["histories"].AsArray().Select(x => x.AsObject()))
            {
                var tokens = OtDocument.Expand(history["initial"]);
                Assert.True(schema.Validate(tokens, out var initial), initial);

                foreach (var steps in history["operations"].AsArray())
                {
                    tokens = OtDocument.Apply(tokens, steps);
                    Assert.True(schema.Validate(tokens, out var reason), reason);
                }

                Assert.True(JsonNode.DeepEquals(history["final"], OtDocument.Compact(tokens)), "the server reaches the clients' document");
            }
        }

        /// <summary>
        /// The server's rich text schema accepts and rejects exactly the documents the client's
        /// check accepts and rejects, including hostile attributes and marks and broken structure.
        /// </summary>
        [Fact]
        public void Verdicts_MatchTheClientsSchemaCheck()
        {
            var schemas = new ICollaborativeSchema[] { new RichTextSchema(), new PlainTextSchema(), new GraphSchema() }.ToDictionary(x => x.Kind);
            var index = 0;

            foreach (var verdict in _fixture.Value["verdicts"].AsArray().Select(x => x.AsObject()))
            {
                var valid = schemas[(string)verdict["kind"]].Validate(OtDocument.Expand(verdict["state"]), out var reason);

                Assert.True((bool)verdict["valid"] == valid, $"verdict {index}: client says {verdict["valid"]}, server says {valid} ({reason})");
                index++;
            }
        }

        /// <summary>
        /// Steps apply to the identical result on both sides, and malformed or out-of-range steps
        /// are refused by both instead of being clamped.
        /// </summary>
        [Fact]
        public void Applies_MatchTheClientsResult()
        {
            var index = 0;

            foreach (var entry in _fixture.Value["applies"].AsArray().Select(x => x.AsObject()))
            {
                var tokens = OtDocument.Expand(entry["tokens"]);
                JsonNode result;

                try
                {
                    result = OtDocument.Compact(OtDocument.Apply(tokens, entry["steps"]));
                }
                catch (OtException)
                {
                    result = null;
                }

                Assert.True(JsonNode.DeepEquals(entry["result"], result), $"apply {index}: {entry["steps"].ToJsonString()}");
                index++;
            }
        }
    }
}
