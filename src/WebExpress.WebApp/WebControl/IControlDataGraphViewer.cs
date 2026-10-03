using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed graph viewer control.
    /// </summary>
    public interface IControlDataGraphViewer : IControl, IControlData
    {
        /// <summary>
        /// Gets the style used to render nodes that carry no style of their own.
        /// </summary>
        Func<IRenderControlContext, TypeStyleGraphNode> NodeStyle { get; }

        /// <summary>
        /// Gets the style used to route the edges.
        /// </summary>
        Func<IRenderControlContext, TypeStyleGraphEdge> EdgeStyle { get; }

        /// <summary>
        /// Gets a value indicating whether the layout simulation places the nodes
        /// that arrive without coordinates.
        /// </summary>
        Func<IRenderControlContext, bool> Physics { get; }

        /// <summary>
        /// Gets the cell size of the background grid, in canvas units.
        /// </summary>
        Func<IRenderControlContext, int> Grid { get; }

        /// <summary>
        /// Gets a value indicating whether dragging a node snaps it to the grid.
        /// </summary>
        Func<IRenderControlContext, bool> GridSnap { get; }

        /// <summary>
        /// Gets the accessible name announced for the canvas.
        /// </summary>
        Func<IRenderControlContext, string> Label { get; }
    }
}
