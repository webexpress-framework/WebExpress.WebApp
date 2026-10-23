using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A dummy tool for the toolbar of the permission surface. It is scoped to
    /// the control type, which is what the toolbar sections resolve against.
    /// </summary>
    [Section<SectionPermissionToolbarPrimary>()]
    [Scope<ControlDataPermission>]
    public sealed class TestFragmentPermissionToolbarText : FragmentControlText
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestFragmentPermissionToolbarText(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
            Text = _ => "Tool";
        }
    }
}
