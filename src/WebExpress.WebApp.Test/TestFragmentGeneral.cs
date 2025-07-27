using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A dummy fragment for testing purposes.
    /// </summary>
    [Section<SectionAppNavigationPrimary>()]
    [Scope<IScopeGeneral>]
    public sealed class TestFragmentGeneral : FragmentControlDropdownItemLink
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestFragmentGeneral(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
            Label = "Hello World";
        }
    }
}
