using WebExpress.WebApp.WebFragment;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A dummy fragment for testing purposes.
    /// </summary>
    [Section<SectionBodySecondary>()]
    [Scope<TestPageA>]
    public sealed class TestFragmentControlModalRemoteForm : FragmentControlModalRemoteForm
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestFragmentControlModalRemoteForm(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
        }
    }
}
