using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a test implementation of the form editor draft REST API, backed by
    /// an in-memory store, so the revision contract of the base class can be
    /// exercised end to end: a draft save edited on top of another revision has to
    /// be rejected rather than silently overwrite another editor's draft.
    /// </summary>
    public class TestRestApiFormEditorDraft : RestApiFormEditorDraft<TestIndexItem>
    {
        private readonly Dictionary<string, RestApiFormEditorDraftItem> _drafts = [];

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestRestApiFormEditorDraft()
        {
        }

        /// <summary>
        /// Gets the structures the store hook received, in the order they arrived.
        /// </summary>
        public List<RestApiFormEditorItem> Stores { get; } = [];

        /// <summary>
        /// Gets or sets a write that lands between the revision check of the base
        /// class and the store, the way a concurrent editor's save would.
        /// </summary>
        public Action<string> ConcurrentWrite { get; set; }

        /// <summary>
        /// Gets whether the form has a draft.
        /// </summary>
        /// <param name="formId">The id of the form.</param>
        /// <returns>True when a draft is stored.</returns>
        public bool HasDraft(string formId)
        {
            return _drafts.ContainsKey(formId);
        }

        /// <inheritdoc/>
        protected override RestApiFormEditorDraftItem RetrieveDraft(string formId, IQueryContext context, IRequest request)
        {
            return _drafts.TryGetValue(formId, out var draft) ? draft : null;
        }

        /// <inheritdoc/>
        protected override RestApiFormEditorDraftItem StoreDraft(string formId, RestApiFormEditorItem item, IQueryContext context, IRequest request)
        {
            var concurrent = ConcurrentWrite;
            ConcurrentWrite = null;
            concurrent?.Invoke(formId);

            var revision = _drafts.TryGetValue(formId, out var stored) ? stored.Revision : 0;

            // compared again where the write happens, since the check of the base
            // class ran before it
            if (item.DraftRevision != revision)
            {
                return null;
            }

            Stores.Add(item);

            // every write moves the revision on, which is what makes a concurrent
            // editor's next draft save conflict
            var draft = new RestApiFormEditorDraftItem
            {
                Structure = item,
                Updated = DateTime.UtcNow,
                Revision = revision + 1
            };

            _drafts[formId] = draft;

            return draft;
        }

        /// <inheritdoc/>
        protected override void DeleteDraft(string formId, IQueryContext context, IRequest request)
        {
            _drafts.Remove(formId);
        }
    }
}
