using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element of the relation type administration: the table of
    /// the relations a class may hold, with both of their labels, the classes
    /// they accept, their cardinality, their effect on the workflow, how often
    /// they are already used and whether they may still be used at all, plus the
    /// editor that defines and changes them.
    ///
    /// The control only emits the placeholder div; the table and its editor are
    /// built by the client-side <c>webexpress.webapp.RelationEditorCtrl</c>, which
    /// talks to the configured data service. This is the administrative half of
    /// the link system - the surface that renders the links themselves is
    /// <see cref="ControlDataRelationView"/>.
    /// </summary>
    public class ControlDataRelationEditor : Control, IControlData, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service backs the load, the
        /// definition, the change, the reordering and the removal of the types.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the
        /// first declared service, assigning replaces all declared services.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory
        {
            get => ServiceFactories.Count > 0 ? ServiceFactories[0] : null;
            set
            {
                ServiceFactories.Clear();

                if (value != null)
                {
                    ServiceFactories.Add(value);
                }
            }
        }

        /// <summary>
        /// Gets or sets the optional template reference, emitted as the
        /// data-wx-template attribute.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets or sets the class whose relations are administered. It narrows
        /// the table to the types that accept the class and is the class the
        /// preview of the editor is written from.
        /// </summary>
        public Func<IRenderControlContext, string> Class { get; set; }

        /// <summary>
        /// Gets or sets the example key the editor renders its preview with, for
        /// example <c>BUG-00123</c>. Absent, the client falls back to the class
        /// name, so the preview still reads as a sentence.
        /// </summary>
        public Func<IRenderControlContext, string> Sample { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the surface is read-only. When
        /// <see langword="true"/>, the definition, the editor, the reordering and
        /// the activation toggle are suppressed.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataRelationEditor(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to its HTML representation.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>The rendered HTML node.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var enable = Enable?.Invoke(renderContext) ?? true;
            if (!enable)
            {
                return null;
            }

            var readOnly = Readonly?.Invoke(renderContext) ?? false;

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-relation-editor", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-class", Class?.Invoke(renderContext))
                .AddUserAttribute("data-sample", Sample?.Invoke(renderContext))
                .AddUserAttribute("data-readonly", readOnly ? "true" : null);
        }
    }
}
