using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A dummy fragment for testing purposes.
    /// </summary>
    [Section<SectionContentPrimary>()]
    [Section<SectionAppNavigationPrimary>()]
    [Scope<TestPageA>]
    public sealed class TestFragmentPageA : FragmentControlPanel
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestFragmentPageA(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
            Add(new ControlText() { Text = _ => "Hello World" });
        }
    }
}
