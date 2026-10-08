using WebExpress.WebCore.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebFragment
{
    /// <summary>
    /// A further presentation of the relation surface contributed as a fragment,
    /// so a plugin adds a way of reading the relations without the page that
    /// hosts the surface knowing about it. The fragment is placed through one of
    /// the <c>SectionRelationView*</c> sections, which decides where its entry
    /// appears in the presentation switch.
    /// </summary>
    public interface IFragmentControlDataRelationViewItem : IFragmentWebUIElement<IRenderControlContext, IVisualTreeControl>, IFragmentBase
    {
    }
}
