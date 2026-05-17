using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Minimal index item used to satisfy the generic constraint of
    /// <see cref="RestApiComment{TIndexItem}"/>; tests only exercise the
    /// HTTP wiring, not the index integration.
    /// </summary>
    public sealed class TestCommentIndexItem : IIndexItem
    {
        public System.Guid Id { get; set; }
    }

    /// <summary>
    /// Provides a minimal in-memory implementation of <see cref="RestApiComment{TIndexItem}"/>
    /// used to exercise the base class's HTTP wiring and sub-path routing.
    /// </summary>
    public sealed class TestRestApiComment : RestApiComment<TestCommentIndexItem>
    {
        private readonly List<RestApiCommentItem> _comments;
        private int _nextId = 1;
        private string _currentUser = "u-test";

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="seed">Optional seed of pre-existing comments.</param>
        public TestRestApiComment(IEnumerable<RestApiCommentItem> seed = null)
        {
            _comments = seed?.ToList() ?? [];
        }

        /// <summary>
        /// Gets or sets the id returned by <see cref="ResolveCurrentUser"/>.
        /// </summary>
        public string CurrentUser
        {
            get => _currentUser;
            set => _currentUser = value;
        }

        /// <summary>
        /// Gets the comments currently held in memory.
        /// </summary>
        public IReadOnlyList<RestApiCommentItem> Comments => _comments;

        /// <summary>
        /// Returns the current set of comments to be rendered by the
        /// client-side controller.
        /// </summary>
        /// <param name="query">
        /// The query that defines the criteria for selecting Scrum items. Cannot 
        /// be null.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The comments.</returns>
        protected override IEnumerable<RestApiCommentItem> RetrieveComments(IQuery<TestCommentIndexItem> query, IQueryContext context, IRequest request) => _comments;

        /// <summary>
        /// Persists a newly created comment.
        /// </summary>
        /// <param name="payload">The create payload.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The created comment, or <see langword="null"/> when creation failed.
        /// </returns>
        protected override RestApiCommentItem CreateComment(RestApiCommentPayload payload, IQueryContext context, IRequest request)
        {
            var item = new RestApiCommentItem
            {
                Id = "c" + _nextId++,
                Author = _currentUser,
                Body = payload.Body,
                Category = payload.Category ?? "general",
                Labels = payload.Labels?.ToList() ?? [],
                Likes = [],
                Reactions = new Dictionary<string, IEnumerable<string>>(),
                Replies = [],
                When = "now"
            };

            _comments.Add(item);
            return item;
        }

        /// <summary>
        /// Updates the body / category / labels of an existing comment.
        /// </summary>
        /// <param name="id">The id of the comment to update.</param>
        /// <param name="payload">The new field values.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The incoming request.
        /// </param>
        /// <returns>
        /// The updated comment, or <see langword="null"/> when not found.
        /// </returns>
        protected override RestApiCommentItem UpdateComment(string id, RestApiCommentPayload payload, IQueryContext context, IRequest request)
        {
            var item = _comments.FirstOrDefault(x => x.Id == id);
            if (item is null)
            {
                return null;
            }

            item.Body = payload.Body;
            item.Category = payload.Category ?? item.Category;
            item.Labels = payload.Labels?.ToList() ?? item.Labels;
            item.Edited = new RestApiCommentEditInfo { When = "now", By = _currentUser };
            return item;
        }

        /// <summary>
        /// Permanently removes a comment.
        /// </summary>
        /// <param name="id">The id of the comment to delete.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the comment existed and was deleted.
        /// </returns>
        protected override bool DeleteComment(string id, IQueryContext context, IRequest request)
        {
            var existing = _comments.FirstOrDefault(x => x.Id == id);
            if (existing is null)
            {
                return false;
            }

            _comments.Remove(existing);
            return true;
        }

        /// <summary>
        /// Toggles the like for the specified user on the comment with the
        /// given id.
        /// </summary>
        /// <param name="id">The comment id.</param>
        /// <param name="userId">The user toggling the like.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The new like collection, or <see langword="null"/> when the 
        /// comment does not exist.
        /// </returns>
        protected override IEnumerable<string> ToggleLike(string id, string userId, IQueryContext context, IRequest request)
        {
            var item = _comments.FirstOrDefault(x => x.Id == id);
            if (item is null)
            {
                return null;
            }

            var likes = item.Likes?.ToList() ?? [];
            if (likes.Contains(userId))
            {
                likes.Remove(userId);
            }
            else
            {
                likes.Add(userId);
            }

            item.Likes = likes;
            return likes;
        }

        /// <summary>
        /// Toggles the pinned state of a comment.
        /// </summary>
        /// <param name="id">The comment id.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The new pinned state, or <see langword="null"/> when the comment 
        /// does not exist.
        /// </returns>
        protected override bool? TogglePin(string id, IQueryContext context, IRequest request)
        {
            var item = _comments.FirstOrDefault(x => x.Id == id);
            if (item is null)
            {
                return null;
            }

            item.Pinned = !item.Pinned;
            return item.Pinned;
        }

        /// <summary>
        /// Toggles a reaction emoji for the specified user on the comment
        /// with the given id.
        /// </summary>
        /// <param name="id">The comment id.</param>
        /// <param name="emoji">The emoji glyph.</param>
        /// <param name="userId">The user toggling the reaction.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The incoming request.
        /// </param>
        /// <returns>
        /// The new reactions map, or <see langword="null"/> when the comment 
        /// does not exist.
        /// </returns>
        protected override IDictionary<string, IEnumerable<string>> ToggleReaction(string id, string emoji, string userId, IQueryContext context, IRequest request)
        {
            var item = _comments.FirstOrDefault(x => x.Id == id);
            if (item is null)
            {
                return null;
            }

            var reactions = item.Reactions?.ToDictionary(x => x.Key, x => (IEnumerable<string>)x.Value.ToList())
                ?? [];

            if (!reactions.TryGetValue(emoji, out var users))
            {
                users = new List<string>();
            }

            var list = users.ToList();
            if (list.Contains(userId))
            {
                list.Remove(userId);
            }
            else
            {
                list.Add(userId);
            }

            if (list.Count == 0)
            {
                reactions.Remove(emoji);
            }
            else
            {
                reactions[emoji] = list;
            }

            item.Reactions = reactions;
            return reactions;
        }

        /// <summary>
        /// Appends a reply to the specified parent comment.
        /// </summary>
        /// <param name="id">The parent comment id.</param>
        /// <param name="body">The reply body.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The created reply, or <see langword="null"/> when the parent 
        /// does not exist.
        /// </returns>
        protected override RestApiCommentReply AppendReply(string id, string body, IQueryContext context, IRequest request)
        {
            var item = _comments.FirstOrDefault(x => x.Id == id);
            if (item is null)
            {
                return null;
            }

            var reply = new RestApiCommentReply
            {
                Id = "r" + _nextId++,
                Author = _currentUser,
                Body = body,
                When = "now"
            };

            var replies = item.Replies?.ToList() ?? [];
            replies.Add(reply);
            item.Replies = replies;
            return reply;
        }

        /// <summary>
        /// Returns the id of the user driving the current request. Override
        /// to plug a real identity provider in; the default implementation
        /// returns <see langword="null"/>.
        /// </summary>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The user id.</returns>
        protected override string ResolveCurrentUser(IQueryContext context, IRequest request) => _currentUser;
    }
}
