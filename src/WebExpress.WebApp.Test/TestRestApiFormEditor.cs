using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a test implementation of the form editor REST API, backed by an
    /// in-memory store, so the concurrency contract of the base class can be
    /// exercised end to end: a structure edited on top of an outdated version has
    /// to be rejected rather than silently overwrite a newer one.
    /// </summary>
    public class TestRestApiFormEditor : RestApiFormEditor<TestIndexItem>
    {
        private readonly Dictionary<string, RestApiFormEditorItem> _forms = [];

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestRestApiFormEditor()
        {
        }

        /// <summary>
        /// Gets the structures the update hook received, in the order they arrived.
        /// </summary>
        public List<RestApiFormEditorItem> Updates { get; } = [];

        /// <summary>
        /// Gets or sets the published version an endpoint that serves drafts through
        /// RetrieveItem checks against, or null for the version of the stored item.
        /// </summary>
        public int? PublishedVersion { get; set; }

        /// <summary>
        /// Seeds the store with a form.
        /// </summary>
        /// <param name="formId">The id of the form.</param>
        /// <param name="item">The stored structure.</param>
        public void Seed(string formId, RestApiFormEditorItem item)
        {
            _forms[formId] = item;
        }

        /// <inheritdoc/>
        protected override IEnumerable<RestApiFormEditorFieldItem> RetrieveCatalog(string formId, IQueryContext context, IRequest request)
        {
            return [];
        }

        /// <inheritdoc/>
        protected override RestApiFormEditorItem RetrieveItem(string formId, IQueryContext context, IRequest request)
        {
            return _forms.TryGetValue(formId, out var item) ? item : null;
        }

        /// <inheritdoc/>
        protected override int? RetrieveVersion(string formId, IQueryContext context, IRequest request)
        {
            return PublishedVersion ?? base.RetrieveVersion(formId, context, request);
        }

        /// <inheritdoc/>
        protected override RestApiFormEditorItem UpdateItem(string formId, RestApiFormEditorItem item, IQueryContext context, IRequest request)
        {
            Updates.Add(item);

            // a write advances the version, which is what makes a concurrent
            // editor's next save conflict
            item.Version = (_forms.TryGetValue(formId, out var stored) ? stored.Version : 0) + 1;
            _forms[formId] = item;

            return item;
        }
    }
}
