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
    public sealed class TestFragmentControlRestDropdown : FragmentControlRestDropdown
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestFragmentControlRestDropdown(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
        }
    }
}
