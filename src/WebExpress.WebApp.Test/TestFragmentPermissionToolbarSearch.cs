using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A dummy search box for the toolbar of the permission surface, which the
    /// control binds to itself.
    /// </summary>
    [Section<SectionPermissionToolbarSecondary>()]
    [Scope<ControlDataPermission>]
    public sealed class TestFragmentPermissionToolbarSearch : FragmentControlSearch
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestFragmentPermissionToolbarSearch(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
        }
    }
}
