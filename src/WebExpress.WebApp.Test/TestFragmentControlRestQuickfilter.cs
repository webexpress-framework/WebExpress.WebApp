using WebExpress.WebApp.WebFragment;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A dummy fragment for testing purposes.
    /// </summary>
    [Section<SectionContentSecondary>()]
    [Scope<TestPageA>]
    public sealed class TestFragmentControlRestQuickfilter : FragmentControlRestQuickfilter
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestFragmentControlRestQuickfilter(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
        }
    }
}
