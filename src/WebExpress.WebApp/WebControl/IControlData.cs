using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Marker interface for controls that participate in the data layer. The
    /// endpoint and service contract are authored through the fluent data surface
    /// (IDataIsland / .Service()); the legacy RestUri/data-uri path is no longer
    /// part of this interface.
    /// </summary>
    public interface IControlData : IControl
    {
    }
}
