using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Test implementation for RestApiTab.
    /// </summary>
    [Title("my title")]
    public sealed class TestRestApiTab : RestApiTab<TestIndexItem>
    {
        private readonly IEnumerable<RestApiTabView> _views;

        /// <summary>
        /// Gets the last template id received in create requests.
        /// </summary>
        public string LastCreateTemplateId { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="views">The views returned for GET requests.</param>
        public TestRestApiTab(IEnumerable<RestApiTabView> views = null)
        {
            _views = views ?? [];
        }

        /// <summary>
        /// Retrieves tab views.
        /// </summary>
        protected override IEnumerable<RestApiTabView> RetrieveViews(IQueryContext context, IRequest request)
        {
            return _views;
        }

        /// <summary>
        /// Creates a new tab view for POST requests.
        /// </summary>
        protected override IRestApiTabView CreateView(IQueryContext context, IRequest request)
        {
            return new RestApiTabView
            {
                Id = "new-tab",
                Title = "New Tab",
                Name = "Created Tab",
                Icon = "fas fa-star",
                TemplateId = "defaultTemplate",
                Binding = new
                {
                    title = "Created Tab",
                    name = "Created Tab"
                }
            };
        }

        /// <summary>
        /// Creates a new tab view and remembers the requested template id.
        /// </summary>
        protected override IRestApiTabView CreateView(IQueryContext context, IRequest request, string templateId)
        {
            LastCreateTemplateId = templateId;

            return base.CreateView(context, request, templateId);
        }
    }
}
