using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.WebFragment
{
    /// <summary>
    /// Marks a fragment as a ViewState host, so the WebApp visual tree can find
    /// the ViewStates by their type and render them, independently of the layout
    /// section a fragment otherwise targets. A ViewState host is a hidden island
    /// host, not page content, so it is identified by this type rather than
    /// placed into a content section.
    /// </summary>
    public interface IFragmentControlViewState : IFragmentControl
    {
    }
}
