using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// A form that edits one document - a title and a rich-text body - and separates the two
    /// things a single save button normally has to pretend are one: <i>do not lose what I have
    /// written</i> and <i>let the readers see this</i>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The control writes every change into an unpublished draft within a second of the typing
    /// stopping, and the submit button publishes. A form that only saves on submit loses an
    /// afternoon to a closed tab; a form that saves continuously publishes every unfinished
    /// sentence to whoever is reading the page. Neither is acceptable for a document, and both
    /// are fine for an issue - which is why this is a control of its own and not a change to
    /// <see cref="ControlDataFormEdit"/>.
    /// </para>
    /// <para>
    /// The two meanings of save are two endpoints, and the control never decides how anything is
    /// stored. The record service loads the values the editor opens on - the endpoint decides
    /// whether that is the draft or the published text - and its <c>PUT</c> <b>is</b> the
    /// publication, which ends the draft inside its own transaction. The draft service stores,
    /// answers and drops the unpublished text. The control never deletes a draft as part of
    /// publishing: a delete racing a publish that failed would destroy the only copy of the text.
    /// </para>
    /// <para>
    /// Drafting is optional. Without a declared draft service - or with <see cref="Draft"/>
    /// resolving to false - there is no indicator, no overflow menu and no autosave, and the
    /// submit reads as save beside the dialog's cancel: the control is then an ordinary edit
    /// form.
    /// </para>
    /// <para>
    /// The control <b>is</b> the dialog rather than a form somebody else opens as one, because a
    /// writing surface is only right at that size: the title belongs on the title bar the dialog
    /// needs anyway, and the body has to end exactly where the dialog does. It renders closed and
    /// is opened by a trigger addressing its id, for example
    /// <c>PrimaryAction = _ =&gt; new ActionModal("editor")</c>, or by <see cref="Show"/> where
    /// the page is the editor.
    /// </para>
    /// </remarks>
    public class ModalDataEditor : ControlDataFormEdit, IModalDataEditor
    {
        /// <summary>
        /// The css class the client controller is registered for. The controller registry strips
        /// the class from the element at mount, so nothing may be styled through it.
        /// </summary>
        private const string ControllerClass = "wx-webapp-editor-form";

        private readonly List<IControlDropdownItem> _moreItems = [];

        /// <summary>
        /// Gets the input for the document's name.
        /// </summary>
        /// <remarks>
        /// It is rendered into the form's header rather than as one of its items, which makes it
        /// the title of the dialog the editor is opened as. A document has exactly one name, the
        /// dialog needs one anyway, and a caption reading "Title" over the name of the thing on
        /// screen explains nothing. It stays inside the form, so it is loaded and published with
        /// the body.
        /// </remarks>
        public ControlFormItemInputText Title { get; } = new()
        {
            Classes = ["wx-editor-form-title-input"],
            Required = _ => true,

            // the header is a bar, not a stack: the default bottom margin of an input would
            // push the title off the centre of the dialog's title row
            Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.None)
        };

        /// <summary>
        /// Gets the input for the document's rich-text body.
        /// </summary>
        /// <remarks>
        /// The body is the work, so it is the only thing in the content area and takes all of it
        /// - which is what <see cref="ControlFormItemInputText.Fill"/> says. It carries no label
        /// either: with the title in the dialog's own title bar there is nothing left for a
        /// caption to distinguish it from.
        /// </remarks>
        public ControlFormItemInputText Body { get; } = new()
        {
            Format = _ => TypeEditTextFormat.Wysiwyg,
            Required = _ => false,
            Fill = _ => true
        };

        /// <summary>
        /// Gets or sets the resolver of the draft service descriptor.
        /// </summary>
        /// <remarks>
        /// The draft is deliberately not one of the <see cref="ControlDataForm.ServiceFactories"/>:
        /// assigning <see cref="ControlDataForm.ServiceFactory"/> replaces every declared service,
        /// and a record service declared after the draft would silently drop the autosave. Kept
        /// apart, the two meanings of save cannot overwrite each other in either order.
        /// </remarks>
        public Func<IRenderControlContext, DataServiceDescriptor> DraftServiceFactory { get; set; }

        /// <summary>
        /// Gets or sets the resolver deciding whether the surface drafts at all.
        /// </summary>
        /// <remarks>
        /// Turned off, the surface is an ordinary edit form - it saves once, on submit, and the
        /// button reads save beside the dialog's cancel. That is the honest reading for a document
        /// nobody may hold an unpublished version of, and for a reader who is allowed to edit but
        /// not to keep a draft. It is a resolver rather than a fixed value for exactly that
        /// second case: whether a draft may exist is often a question about the request.
        /// <para>
        /// It is kept apart from <see cref="DraftServiceFactory"/> so that turning drafting off
        /// does not mean withdrawing the endpoint: the host declares its two endpoints once and
        /// decides per request which of the two meanings of save the surface offers.
        /// </para>
        /// </remarks>
        public Func<IRenderControlContext, bool> Draft { get; set; } = _ => true;

        /// <summary>
        /// Gets or sets the resolver of the idle time in milliseconds after which a change is
        /// written to the draft.
        /// </summary>
        public Func<IRenderControlContext, uint> Debounce { get; set; } = _ => 900;

        /// <summary>
        /// Gets or sets the resolver of the time in milliseconds after which a change is written
        /// however continuous the typing is.
        /// </summary>
        public Func<IRenderControlContext, uint> MaxDelay { get; set; } = _ => 5000;

        /// <summary>
        /// Gets or sets the resolver deciding whether the save state is legible.
        /// </summary>
        /// <remarks>
        /// Turned off the indicator is hidden rather than dropped, because it is also the host of
        /// the client controller: a document without an indicator would be a document without an
        /// autosave.
        /// </remarks>
        public Func<IRenderControlContext, bool> ShowState { get; set; } = _ => true;

        /// <summary>
        /// Gets or sets the resolver of the dialog size.
        /// </summary>
        /// <remarks>
        /// A document defaults to the fullscreen dialog, because the writing surface takes the
        /// whole of the content and a measure that fits a form does not fit a text.
        /// </remarks>
        public Func<IRenderControlContext, TypeModalSize> Size { get; set; } = _ => TypeModalSize.Fullscreen;

        /// <summary>
        /// Gets or sets the label of the dialog's close button.
        /// </summary>
        public Func<IRenderControlContext, string> CloseLabel { get; set; } = _ => "webexpress.webui:modal.close.label";

        /// <summary>
        /// Gets or sets the resolver deciding whether the dialog opens with the page.
        /// </summary>
        /// <remarks>
        /// The dialog renders closed and is opened by a trigger addressing its id, which is the
        /// usual case: the editor is reached from a reading view. A page that <i>is</i> the editor
        /// has nothing to be triggered from, and turns this on instead.
        /// </remarks>
        public Func<IRenderControlContext, bool> Show { get; set; } = _ => false;

        /// <summary>
        /// Gets or sets the resolver deciding whether the writing surface is shared.
        /// </summary>
        public Func<IRenderControlContext, bool> Collaborative { get; set; } = _ => false;

        /// <summary>
        /// Gets or sets the resolver of the collaboration channel.
        /// </summary>
        /// <remarks>
        /// The container id <b>is</b> the channel the framework filters incoming messages by, so
        /// everybody editing the same document has to be given the same one and nobody else may
        /// be. Left unset, the channel falls back to the control id, which shares a document
        /// between two sessions of the same page but not between two pages that edit it.
        /// </remarks>
        public Func<IRenderControlContext, string> CollaborationId { get; set; }

        /// <summary>
        /// Gets the entries the host adds to the overflow menu.
        /// </summary>
        public IList<IControlDropdownItem> MoreItems => _moreItems;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ModalDataEditor(string id = null)
            : base(id)
        {
            // the button is the publication decision, not the save - the save happened while the
            // author was typing. Where nothing drafted, nothing saved either, so it means save
            // again; both are resolved at render time, when the declaration is complete.
            Submit.Text = renderContext => IsDrafting(renderContext)
                ? "webexpress.webapp:editorform.publish.label"
                : "webexpress.webui:edit.label";
            Submit.Icon = renderContext => IsDrafting(renderContext)
                ? new IconPaperPlane()
                : (IIcon)new IconFloppyDisk();

            Add(Body);
        }

        /// <summary>
        /// Renders the editor as a dialog: the document's name on the title bar, the writing
        /// surface as the whole of the dialog's content, and the save state, who else is here and
        /// the overflow menu on the footer bar the publish button sits on.
        /// </summary>
        /// <remarks>
        /// <para>
        /// The base control renders the form in one piece and it is recomposed here into the three
        /// sections the modal controller lifts onto the dialog it builds. The dialog is placed
        /// <i>inside</i> the form rather than around it, which is what makes the surface one
        /// control: the form still owns the submit, the fields and the hidden islands it hydrates
        /// from, while the dialog is only how they are presented.
        /// </para>
        /// <para>
        /// The islands stay direct children of the form, ahead of the dialog, because the client
        /// resolves them from the form's own children rather than from its descendants - and
        /// because the modal controller moves everything it recognizes out of where it was
        /// authored.
        /// </para>
        /// </remarks>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="items">The form items.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlFormContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControlFormItem> items)
        {
            var node = base.Render(renderContext, visualTree, items);

            if (node is not IHtmlElement form)
            {
                return node;
            }

            var draft = IsDrafting(renderContext)
                ? DraftServiceFactory(renderContext)?.BindPathVariables(renderContext?.Request)
                : null;
            var collaborative = Collaborative?.Invoke(renderContext) ?? false;
            var size = Size?.Invoke(renderContext) ?? TypeModalSize.Fullscreen;
            var children = form.Elements.ToList();
            var islands = children.Where(IsIsland).ToList();
            var header = children.OfType<HtmlElementSectionHeader>().FirstOrDefault();
            var main = children.OfType<HtmlElementSectionMain>().FirstOrDefault();
            var footer = children.OfType<HtmlElementSectionFooter>().FirstOrDefault();

            // whatever the base put beside the three sections and the islands is the button panel,
            // and the publish button belongs on the bar the save state comments on
            var loose = children
                .Where(x => x != header && x != main && x != footer && !IsIsland(x))
                .ToList();

            Title.Initialize(renderContext);

            var title = new HtmlElementTextContentDiv()
            {
                Class = "wx-modal-header wx-editor-form-header"
            }
                .Add(Title.Render(renderContext, visualTree))
                .Add(header?.Elements ?? []);

            var content = new HtmlElementTextContentDiv(RenderContent(renderContext, visualTree, main, collaborative))
            {
                Class = "wx-modal-content wx-editor-form-content"
            };

            var bar = new HtmlElementTextContentDiv()
            {
                Class = "wx-modal-footer wx-editor-form-footer"
            }
                .Add(RenderBar(renderContext, visualTree, draft, collaborative))
                .Add(footer?.Elements ?? [])
                .Add(loose);

            var modal = new HtmlElementTextContentDiv(title, content, bar)
            {
                Id = Id,
                Class = "wx-webui-modal wx-editor-form",
                Role = "dialog"
            }
                .AddUserAttribute("data-size", size.ToClass())
                .AddUserAttribute("data-close-label", I18N.Translate(renderContext, CloseLabel?.Invoke(renderContext)))

                // the writing surface is the height of the dialog and scrolls inside itself, so a
                // scrolling body would put a second scrollbar around the first one
                .AddUserAttribute("data-scrollable", "false")
                .AddUserAttribute("data-auto-show", (Show?.Invoke(renderContext) ?? false) ? "true" : null);

            // the dialog is what carries the control id, so a trigger opens it with
            // ActionModal(id); the form keeps an id derived from it, the way the framework's own
            // modal form control does
            form.Id = Id + "_form";

            form.Clear();
            form.Add(islands);

            if (draft != null)
            {
                form.Add(draft.ToIslandElement());
            }

            form.Add(modal);

            return form;
        }

        /// <summary>
        /// Renders what the control puts on the footer bar, ahead of the publish button: the save
        /// state, who else is in the document, and the overflow menu.
        /// </summary>
        /// <remarks>
        /// Who is here comes first, at the left end of the bar: it is a fact about the document
        /// rather than about the draft, and it is there whether or not anything is being saved.
        /// The save state follows and takes the free width, which pushes the overflow menu to the
        /// right edge of the form's own box - directly left of the publish button, the dialog
        /// having appended its close button last.
        /// </remarks>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="draft">The resolved draft service descriptor, or null when nothing drafts.</param>
        /// <param name="collaborative">Whether the document is shared.</param>
        /// <returns>The bar contents, in reading order.</returns>
        private IEnumerable<IHtmlNode> RenderBar(IRenderControlContext renderContext, IVisualTreeControl visualTree, DataServiceDescriptor draft, bool collaborative)
        {
            if (collaborative)
            {
                // an empty slot: the collaborative controller docks its own presence bar in here,
                // so who is here is rendered once, by the control that knows it
                yield return new HtmlElementTextContentDiv()
                {
                    Id = Id + "_presence",
                    Class = "wx-editor-form-presence"
                };
            }

            if (draft != null)
            {
                yield return RenderState(renderContext, draft);
                yield return RenderMenu(renderContext, visualTree);
            }
        }

        /// <summary>
        /// Renders the visible content, which is the writing surface and nothing else, wrapped in
        /// the collaborative container when the document is shared.
        /// </summary>
        /// <remarks>
        /// Only the content is wrapped. The header and the footer stay direct children of the
        /// form, because the modal controller reads them from there - moving them into the
        /// container would leave the document without a title bar and its save state without a
        /// bar to sit on.
        /// </remarks>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="main">The content section the base rendered.</param>
        /// <returns>The content node.</returns>
        private IHtmlNode RenderContent(IRenderControlFormContext renderContext, IVisualTreeControl visualTree, HtmlElementSectionMain main, bool collaborative)
        {
            main ??= new HtmlElementSectionMain();

            if (!collaborative)
            {
                return main;
            }

            var id = CollaborationId?.Invoke(renderContext);

            var host = new ControlCollaborative(string.IsNullOrWhiteSpace(id) ? Id : id)
            {
                Classes = ["wx-editor-form-collaborative"],

                // who is here belongs on the bar rather than over the text: the chips would
                // otherwise float in the corner of the writing surface, where they cover the
                // first line of what is being written
                PresenceHost = _ => Id + "_presence"
            };

            var html = host.Render(renderContext, visualTree);

            if (html is IHtmlElement element)
            {
                element.Add(main);
            }

            return html;
        }

        /// <summary>
        /// Renders the save indicator, which is also the host of the client controller and
        /// therefore carries the whole autosave configuration.
        /// </summary>
        /// <remarks>
        /// The controller is mounted here rather than on the form, because the controller
        /// registry keeps one instance per element and the form already carries the rest form
        /// controller that loads and publishes. The state is written as one attribute rather than
        /// as a set of classes, so the controller swaps a value instead of juggling a set.
        /// </remarks>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="draft">The resolved draft service descriptor.</param>
        /// <returns>The indicator element.</returns>
        private IHtmlNode RenderState(IRenderControlContext renderContext, DataServiceDescriptor draft)
        {
            var show = ShowState?.Invoke(renderContext) ?? true;
            var debounce = Debounce?.Invoke(renderContext) ?? 900;
            var maxDelay = MaxDelay?.Invoke(renderContext) ?? 5000;

            // the server cannot know whether an unpublished draft exists - only the draft
            // endpoint can - so the surface opens on "nothing unsaved" and the controller
            // corrects it from the answer of its first request
            var element = new HtmlElementTextContentDiv(new HtmlText(Translate(renderContext, "idle")))
            {
                Id = Id + "_state",
                Class = Css.Concatenate(ControllerClass, "wx-editor-form-state")
            }
                .AddUserAttribute("data-wx-state", "idle")
                .AddUserAttribute("data-wx-debounce", debounce.ToString(CultureInfo.InvariantCulture))
                .AddUserAttribute("data-wx-max-delay", maxDelay.ToString(CultureInfo.InvariantCulture))
                .AddUserAttribute("data-wx-menu", Id + "_menu")
                .AddUserAttribute("data-wx-discard", Id + "_discard");

            if (!show)
            {
                element.AddUserAttribute("hidden");
            }

            return element;
        }

        /// <summary>
        /// Renders the overflow menu of the footer bar.
        /// </summary>
        /// <remarks>
        /// <para>
        /// Discard sits in a menu rather than on the bar, and so does whatever the host added:
        /// both are rare next to publishing and one of them is destructive, so an author reaching
        /// for the publish button must not be able to discard their afternoon by being slightly
        /// off.
        /// </para>
        /// <para>
        /// The menu is rendered whether or not a draft exists, because the server cannot tell;
        /// the controller reveals it once the draft endpoint has answered that there is something
        /// to discard.
        /// </para>
        /// </remarks>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>The menu element.</returns>
        private IHtmlNode RenderMenu(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var menu = new ControlDropdown(Id + "_menu")
            {
                Icon = _ => new IconEllipsis(),
                Tooltip = _ => "webexpress.webapp:editorform.menu.tooltip",
                Color = _ => new PropertyColorButton(TypeColorButton.Light),
                AlignmentMenu = _ => TypeAlignmentDropdownMenu.Right,
                Classes = ["wx-editor-form-menu", "wx-editor-form-menu-empty"]
            };

            menu.Add(_moreItems);

            if (_moreItems.Count > 0)
            {
                menu.AddSeparator();
            }

            // the discard is driven by the client controller, which owns the draft endpoint and
            // has to stop saving before the row is dropped - a link would race its own pending
            // write. The controller finds the entry by the id the indicator names, because a
            // dropdown rebuilds its entries into fresh anchors and only the id and the data
            // attributes survive that.
            menu.Add(new ControlDropdownItemLink(Id + "_discard")
            {
                Text = _ => "webexpress.webapp:editorform.discard.label",
                Icon = _ => new IconTrash(),
                Color = _ => TypeColorText.Danger
            });

            return menu.Render(renderContext, visualTree);
        }

        /// <summary>
        /// Translates one save state.
        /// </summary>
        /// <param name="renderContext">The render context carrying the culture.</param>
        /// <param name="state">The state token, matching the suffix of the i18n key.</param>
        /// <returns>The translated text.</returns>
        private static string Translate(IRenderControlContext renderContext, string state)
        {
            return I18N.Translate(renderContext, "webexpress.webapp:editorform.state." + state);
        }

        /// <summary>
        /// Reports whether the surface drafts, which takes both a declared endpoint and a request
        /// that is allowed to hold an unpublished version. Everything the draft brings with it -
        /// the indicator, the menu, the island and the publish label - hangs off this one answer,
        /// so that a surface can never be half-drafting.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns><see langword="true"/> when the surface saves into a draft.</returns>
        private bool IsDrafting(IRenderControlContext renderContext)
        {
            return DraftServiceFactory != null && (Draft?.Invoke(renderContext) ?? true);
        }

        /// <summary>
        /// Reports whether a child of the form is one of the hidden data islands the client
        /// hydrates from.
        /// </summary>
        /// <param name="node">The child node.</param>
        /// <returns><see langword="true"/> when the child is an island.</returns>
        private static bool IsIsland(IHtmlNode node)
        {
            return node is IHtmlElement element
                && element.Attributes.Any(x => string.Equals(x.Name, "hidden", StringComparison.OrdinalIgnoreCase));
        }
    }
}
