using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a minimal in-memory implementation of <see cref="RestApiComment"/>
    /// used to exercise the base class's HTTP wiring and sub-path routing.
    /// </summary>
    public sealed class TestRestApiComment : RestApiComment
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

        /// <inheritdoc/>
        protected override IEnumerable<RestApiCommentItem> RetrieveComments(IRequest request) => _comments;

        /// <inheritdoc/>
        protected override RestApiCommentItem CreateComment(RestApiCommentPayload payload, IRequest request)
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

        /// <inheritdoc/>
        protected override RestApiCommentItem UpdateComment(string id, RestApiCommentPayload payload, IRequest request)
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

        /// <inheritdoc/>
        protected override bool DeleteComment(string id, IRequest request)
        {
            var existing = _comments.FirstOrDefault(x => x.Id == id);
            if (existing is null)
            {
                return false;
            }

            _comments.Remove(existing);
            return true;
        }

        /// <inheritdoc/>
        protected override IEnumerable<string> ToggleLike(string id, string userId, IRequest request)
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

        /// <inheritdoc/>
        protected override bool? TogglePin(string id, IRequest request)
        {
            var item = _comments.FirstOrDefault(x => x.Id == id);
            if (item is null)
            {
                return null;
            }

            item.Pinned = !item.Pinned;
            return item.Pinned;
        }

        /// <inheritdoc/>
        protected override IDictionary<string, IEnumerable<string>> ToggleReaction(string id, string emoji, string userId, IRequest request)
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

        /// <inheritdoc/>
        protected override RestApiCommentReply AppendReply(string id, string body, IRequest request)
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

        /// <inheritdoc/>
        protected override string ResolveCurrentUser(IRequest request) => _currentUser;
    }
}
