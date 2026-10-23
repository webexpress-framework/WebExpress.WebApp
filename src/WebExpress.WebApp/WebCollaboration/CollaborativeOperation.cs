using System.Text.Json.Nodes;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// A sequenced change of a shared document: the steps one client sent, with the identity
    /// that makes a repeated delivery recognizable and the version the server assigned.
    /// </summary>
    public sealed class CollaborativeOperation
    {
        /// <summary>
        /// Returns the unique id the client gave the operation.
        /// </summary>
        public string Id { get; init; }

        /// <summary>
        /// Returns the id of the client that made the change.
        /// </summary>
        public string Client { get; init; }

        /// <summary>
        /// Returns the client's running number of the operation.
        /// </summary>
        public long Seq { get; init; }

        /// <summary>
        /// Returns the version the operation was based on.
        /// </summary>
        public long Base { get; init; }

        /// <summary>
        /// Returns the version the operation produced.
        /// </summary>
        public long Version { get; init; }

        /// <summary>
        /// Returns the primitive steps, exactly as they were applied.
        /// </summary>
        public JsonArray Steps { get; init; }

        /// <summary>
        /// Converts the operation into its wire form.
        /// </summary>
        /// <returns>The JSON object.</returns>
        public JsonObject ToJson()
        {
            return new JsonObject
            {
                ["id"] = Id,
                ["client"] = Client,
                ["seq"] = Seq,
                ["base"] = Base,
                ["version"] = Version,
                ["steps"] = Steps.DeepClone()
            };
        }

        /// <summary>
        /// Reads an operation from its wire form.
        /// </summary>
        /// <param name="json">The JSON object.</param>
        /// <returns>The operation.</returns>
        public static CollaborativeOperation FromJson(JsonObject json)
        {
            return new CollaborativeOperation
            {
                Id = (string)json["id"],
                Client = (string)json["client"],
                Seq = (long)json["seq"],
                Base = (long)json["base"],
                Version = (long)json["version"],
                Steps = json["steps"]?.DeepClone() as JsonArray ?? []
            };
        }
    }
}
