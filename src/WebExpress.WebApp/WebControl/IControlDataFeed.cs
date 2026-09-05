using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed feed control: entries stacked newest first, with a
    /// button that fetches the next page and appends it.
    /// </summary>
    public interface IControlDataFeed : IControl, IControlData
    {
        /// <summary>
        /// Gets the number of entries fetched per page, and therefore the number shown before the
        /// reader asks for more.
        /// </summary>
        Func<IRenderControlContext, int> PageSize { get; }
    }
}
