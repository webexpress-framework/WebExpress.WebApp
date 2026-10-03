using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Visual form-editor control. Renders a <c>&lt;div class="wx-webapp-restform-editor"&gt;</c>
    /// host element with declarative <c>data-*</c> attributes. The associated
    /// <c>webexpress.webapp.RestFormEditorCtrl</c> JavaScript controller hydrates the
    /// host element with the full Designer UI (tab bar, structure tree, live
    /// preview, QuickAdd picker, drag-and-drop, keyboard shortcuts).
    /// </summary>
    /// <remarks>
    /// <para>
    /// A form definition has the two meanings of save a document has: <i>do not
    /// lose what I have built</i> and <i>let the forms out there use this</i>.
    /// With only the data service declared the two coincide: every mutation is
    /// written to it, which is right for a form nobody fills in yet. With a draft
    /// service declared as well, every mutation goes to the draft instead - no
    /// version, nothing the forms in use see - and the data service is reached
    /// only through the publish button, whose <c>PUT</c> <b>is</b> the
    /// publication and ends the draft inside its own transaction. The draft
    /// service stores, answers and drops the unpublished structure. The control
    /// never deletes a draft as part of publishing: a delete racing a publish that
    /// failed would destroy the only copy of the work.
    /// </para>
    /// <para>
    /// Drafting is optional. Without a declared draft service - or with
    /// <see cref="Draft"/> resolving to false - there is no publish button, no
    /// discard action and no draft state: the editor then autosaves into the form
    /// itself.
    /// </para>
    /// </remarks>
    public class ControlDataFormEditor : Control, IControlDataFormEditor, IDataIsland
    {
        public const int _defaultIndent = 18;

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service loads the form definition
        /// and, with no draft declared, persists it; with a draft declared its
        /// <c>PUT</c> is the publication.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the resolver of the draft service descriptor.
        /// </summary>
        /// <remarks>
        /// The draft is deliberately not one of the <see cref="ServiceFactories"/>:
        /// assigning <see cref="ServiceFactory"/> replaces every declared service,
        /// and a data service declared after the draft would silently drop the
        /// autosave. Kept apart, the two meanings of save cannot overwrite each
        /// other in either order.
        /// </remarks>
        public Func<IRenderControlContext, DataServiceDescriptor> DraftServiceFactory { get; set; }

        /// <summary>
        /// Gets or sets the resolver deciding whether the editor drafts at all.
        /// </summary>
        /// <remarks>
        /// Turned off, the editor autosaves into the form itself, as it does with
        /// no draft service declared. It is a resolver rather than a fixed value
        /// because whether a draft may exist is often a question about the
        /// request - a user allowed to edit but not to hold an unpublished
        /// version. It is kept apart from <see cref="DraftServiceFactory"/> so
        /// that turning drafting off does not mean withdrawing the endpoint.
        /// </remarks>
        public Func<IRenderControlContext, bool> Draft { get; set; } = _ => true;

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
        /// Gets or sets a value indicating whether preview mode is enabled.
        /// </summary>
        public Func<IRenderControlContext, bool> Preview { get; set; } = _ => true;

        /// <summary>
        /// Gets or sets the number of spaces used for each indentation level.
        /// </summary>
        public Func<IRenderControlContext, int> Indent { get; set; } = _ => _defaultIndent;

        /// <summary>
        /// Gets or sets a value indicating whether the object is read-only.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Gets or sets whether the editor takes the height its host offers
        /// instead of growing with the form it edits.
        /// </summary>
        /// <remarks>
        /// An editor that grows is the right shape for one block among others on
        /// a page. Where the editor *is* the view, it is the wrong one: the page
        /// scrolls around it and takes the head and the foot along, so the form
        /// name above and the save state below leave the screen while the user
        /// works. Filling bounds the editor instead, and the structure tree and
        /// the preview scroll on their own between chrome that stays.
        ///
        /// A host that is a flex column - which the WebApp content panel becomes
        /// on its own for a filling control - drives the height. A host that hands
        /// nothing down falls back to the self-imposed default of the
        /// <c>--wx-form-editor-height</c> custom property, never to the content:
        /// the panes only scroll while the editor is bounded.
        /// </remarks>
        public Func<IRenderControlContext, bool> Fill { get; set; } = _ => false;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        public ControlDataFormEditor(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var indent = Indent?.Invoke(renderContext) ?? _defaultIndent;
            var preview = Preview?.Invoke(renderContext) ?? true;
            var @readonly = Readonly?.Invoke(renderContext) ?? false;
            var role = Role?.Invoke(renderContext);
            var fill = Fill?.Invoke(renderContext) ?? false;
            var classes = Classes.ToList();

            indent = indent < 8 ? 8 : indent > 32 ? 32 : indent;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-restform-editor", [fill ? "wx-fill" : null, .. classes]),
                Style = GetStyles(renderContext),
                Role = role
            };

            html.EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-preview", !preview ? "false" : null)
                .AddUserAttribute("data-indent", indent != 18 ? indent.ToString(CultureInfo.InvariantCulture) : null)
                .AddUserAttribute("data-readonly", @readonly ? "true" : null);

            // the draft island follows the data islands, so the client finds the
            // two services side by side and the mode is one lookup away
            var draft = IsDrafting(renderContext)
                ? DraftServiceFactory(renderContext)?.BindPathVariables(renderContext?.Request)
                : null;

            if (draft != null)
            {
                html.Add(draft.ToIslandElement());
            }

            return html;
        }

        /// <summary>
        /// Reports whether the editor drafts, which takes both a declared endpoint
        /// and a request that is allowed to hold an unpublished version.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns><see langword="true"/> when mutations are written to a draft.</returns>
        private bool IsDrafting(IRenderControlContext renderContext)
        {
            return DraftServiceFactory != null && (Draft?.Invoke(renderContext) ?? true);
        }
    }
}
