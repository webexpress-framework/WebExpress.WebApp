using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a minimal in-memory implementation of <see cref="RestApiTag"/>
    /// used to exercise the base class's HTTP wiring and sub-path routing.
    /// </summary>
    public sealed class TestRestApiTag : RestApiTag
    {
        private readonly List<RestApiTagItem> _tags;
        private readonly List<RestApiTagItem> _vocabulary;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="seed">Optional seed of pre-existing tags.</param>
        /// <param name="vocabulary">Optional vocabulary used to serve suggestions.</param>
        public TestRestApiTag(IEnumerable<RestApiTagItem> seed = null, IEnumerable<RestApiTagItem> vocabulary = null)
        {
            _tags = seed?.ToList() ?? [];
            _vocabulary = vocabulary?.ToList() ?? [];
        }

        /// <summary>
        /// Gets the tags currently held in memory.
        /// </summary>
        public IReadOnlyList<RestApiTagItem> Tags => _tags;

        /// <summary>
        /// Returns the tags currently attached to the object.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The current tags.</returns>
        protected override IEnumerable<RestApiTagItem> RetrieveTags(IRequest request) => _tags;

        /// <summary>
        /// Returns the vocabulary entries whose value contains the search term.
        /// </summary>
        /// <param name="term">The search term.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The matching suggestions.</returns>
        protected override IEnumerable<RestApiTagItem> SuggestTags(string term, IRequest request) =>
            _vocabulary.Where(t => t.Value != null && t.Value.Contains(term, StringComparison.OrdinalIgnoreCase));

        /// <summary>
        /// Adds a tag unless an equal value is already present.
        /// </summary>
        /// <param name="payload">The create payload.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The created (or already existing) tag.</returns>
        protected override RestApiTagItem CreateTag(RestApiTagPayload payload, IRequest request)
        {
            var value = payload.Value.Trim();
            var existing = _tags.FirstOrDefault(t => string.Equals(t.Value, value, StringComparison.OrdinalIgnoreCase));
            if (existing is not null)
            {
                return existing;
            }

            var item = new RestApiTagItem { Value = value };
            _tags.Add(item);
            return item;
        }

        /// <summary>
        /// Removes the tag with the given value.
        /// </summary>
        /// <param name="value">The value of the tag to delete.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns><see langword="true"/> when the tag existed and was deleted.</returns>
        protected override bool DeleteTag(string value, IRequest request)
        {
            var existing = _tags.FirstOrDefault(t => string.Equals(t.Value, value, StringComparison.OrdinalIgnoreCase));
            if (existing is null)
            {
                return false;
            }

            _tags.Remove(existing);
            return true;
        }
    }
}
