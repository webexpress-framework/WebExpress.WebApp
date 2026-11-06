using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The endpoint of a <see cref="WebControl.ControlDataTree"/>: it answers one level of a
    /// hierarchy per request, so a tree of any size loads only what is opened.
    /// </summary>
    /// <remarks>
    /// <list type="bullet">
    /// <item>GET without parameters answers the root nodes, GET ?node=&lt;id&gt; the children of
    /// a node - each an array of <see cref="RestApiTreeNode"/>.</item>
    /// <item>GET ?reveal=&lt;id&gt; answers { path, levels }: the ids from the root down to the
    /// node, and every level the path passes by parent id ("" for the root). The tree opens
    /// a node it has not loaded with a single request.</item>
    /// <item>PUT { node, target, position } moves a node; position is "above", "below" or
    /// "child". It answers 400 when <see cref="MoveNode"/> refuses.</item>
    /// </list>
    /// </remarks>
    /// <typeparam name="TIndexItem">The type of the items the tree shows.</typeparam>
    public abstract class RestApiTree<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        /// <summary>
        /// Answers a level of the tree, or the path to a node.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The nodes as json.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var reveal = request.GetParameter("reveal")?.Value;

                if (!string.IsNullOrWhiteSpace(reveal))
                {
                    return Reveal(reveal, context, request);
                }

                var node = request.GetParameter("node")?.Value;
                var nodes = RetrieveChildren(string.IsNullOrWhiteSpace(node) ? null : node, context, request) ?? [];

                return Json(nodes.ToArray());
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error retrieving tree nodes.");
            }
        }

        /// <summary>
        /// Moves a node.
        /// </summary>
        /// <param name="request">The request with { node, target, position }.</param>
        /// <returns>200 when the move was stored, 400 when it was refused or malformed.</returns>
        [Method(RequestMethod.PUT)]
        public IResponse Update(IRequest request)
        {
            try
            {
                var content = (request as Request)?.Content;
                if (content is null || content.Length == 0)
                {
                    return new ResponseBadRequest(new StatusMessage("Missing request body."));
                }

                var move = JsonSerializer.Deserialize<MoveRequest>(content, _jsonOptions);
                if (string.IsNullOrWhiteSpace(move?.Node) || string.IsNullOrWhiteSpace(move.Target) ||
                    ParsePosition(move.Position) is not RestApiTreeMovePosition position ||
                    move.Node == move.Target)
                {
                    return new ResponseBadRequest(new StatusMessage("Invalid move."));
                }

                using var context = CreateContext();

                // a node placed into its own subtree would leave the tree, whatever the client checked
                if (position == RestApiTreeMovePosition.Child
                    ? IsInSubtree(move.Node, move.Target, context, request)
                    : IsInSubtree(move.Node, RetrieveParent(move.Target, context, request), context, request))
                {
                    return new ResponseBadRequest(new StatusMessage("A node cannot be moved into its own subtree."));
                }

                return MoveNode(move.Node, move.Target, position, context, request)
                    ? Json(new { node = move.Node, target = move.Target, position = move.Position.ToLowerInvariant() })
                    : new ResponseBadRequest(new StatusMessage("The move was refused."));
            }
            catch (JsonException)
            {
                return new ResponseBadRequest(new StatusMessage("Invalid move."));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error moving the tree node.");
            }
        }

        /// <summary>
        /// Creates the query context the hooks run in.
        /// </summary>
        /// <returns>The context.</returns>
        protected virtual IQueryContext CreateContext()
        {
            return new DefaultQueryContext();
        }

        /// <summary>
        /// Returns the children of a node in their order.
        /// </summary>
        /// <param name="parentId">The parent, or null for the root nodes.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The request.</param>
        /// <returns>The children.</returns>
        protected abstract IEnumerable<RestApiTreeNode> RetrieveChildren(string parentId, IQueryContext context, IRequest request);

        /// <summary>
        /// Returns the parent of a node, which the tree needs to reveal a node it has not loaded.
        /// </summary>
        /// <param name="id">The node.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The request.</param>
        /// <returns>The parent id, or null for a root node.</returns>
        protected abstract string RetrieveParent(string id, IQueryContext context, IRequest request);

        /// <summary>
        /// Stores a move. The default refuses every move; a tree whose control is movable overrides it.
        /// </summary>
        /// <param name="node">The moved node.</param>
        /// <param name="target">The node it was dropped on.</param>
        /// <param name="position">Where it is placed relative to the target.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The request.</param>
        /// <returns>True when the move was stored.</returns>
        protected virtual bool MoveNode(string node, string target, RestApiTreeMovePosition position, IQueryContext context, IRequest request)
        {
            return false;
        }

        /// <summary>
        /// Reads the position of a move. Only the three names of the contract are taken: a number
        /// or another enum name would reach the move hook as a position it does not know.
        /// </summary>
        /// <param name="position">The position as sent.</param>
        /// <returns>The position, or null for anything else.</returns>
        private static RestApiTreeMovePosition? ParsePosition(string position)
        {
            return position?.ToLowerInvariant() switch
            {
                "above" => RestApiTreeMovePosition.Above,
                "below" => RestApiTreeMovePosition.Below,
                "child" => RestApiTreeMovePosition.Child,
                _ => null
            };
        }

        /// <summary>
        /// Answers the path to a node and the levels it passes.
        /// </summary>
        /// <param name="id">The node.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The request.</param>
        /// <returns>{ path, levels }, or 404 when the node is unknown.</returns>
        private IResponse Reveal(string id, IQueryContext context, IRequest request)
        {
            var path = new List<string> { id };
            var parent = RetrieveParent(id, context, request);

            while (parent is not null)
            {
                // a cycle in the data would otherwise never end the walk
                if (path.Contains(parent))
                {
                    return new ResponseBadRequest(new StatusMessage("The hierarchy contains a cycle."));
                }

                path.Insert(0, parent);
                parent = RetrieveParent(parent, context, request);
            }

            var levels = new Dictionary<string, RestApiTreeNode[]>
            {
                [""] = [.. RetrieveChildren(null, context, request) ?? []]
            };

            foreach (var ancestor in path.Take(path.Count - 1))
            {
                levels[ancestor] = [.. RetrieveChildren(ancestor, context, request) ?? []];
            }

            var owner = path.Count > 1 ? levels[path[^2]] : levels[""];
            if (!owner.Any(x => x.Id == id))
            {
                return new ResponseNotFound(new StatusMessage($"Unknown node '{id}'."));
            }

            return Json(new { path, levels });
        }

        /// <summary>
        /// Tells whether a node lies in the subtree of another, the root of the subtree included.
        /// </summary>
        /// <param name="root">The root of the subtree.</param>
        /// <param name="id">The node, or null for the root level.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The request.</param>
        /// <returns>True when the node is the root or one of its descendants.</returns>
        private bool IsInSubtree(string root, string id, IQueryContext context, IRequest request)
        {
            var seen = new HashSet<string>();

            while (id is not null && seen.Add(id))
            {
                if (id == root)
                {
                    return true;
                }

                id = RetrieveParent(id, context, request);
            }

            return false;
        }

        /// <summary>
        /// Serializes an answer.
        /// </summary>
        /// <param name="data">The answer.</param>
        /// <returns>The json response.</returns>
        private static IResponse Json(object data)
        {
            return new ResponseOK
            {
                Content = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(data, _jsonOptions))
            }
                .AddHeaderContentType("application/json");
        }

        /// <summary>
        /// The body of a move.
        /// </summary>
        private sealed class MoveRequest
        {
            /// <summary>
            /// Gets or sets the moved node.
            /// </summary>
            public string Node { get; set; }

            /// <summary>
            /// Gets or sets the node it was dropped on.
            /// </summary>
            public string Target { get; set; }

            /// <summary>
            /// Gets or sets the position: above, below or child.
            /// </summary>
            public string Position { get; set; }
        }
    }
}
