using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the assignee of a domain object as one row: a round portrait or the initials,
    /// a small caption above the name and, for a caller who may change it, the action at the
    /// end of the row. The client-side <c>webexpress.webapp.AssignmentCtrl</c> takes the row
    /// over and stores a change through the data service without reloading the page.
    /// </summary>
    /// <remarks>
    /// The row is rendered on the server already, so the page shows the assignee before the
    /// script runs and without it. The seed comes from <see cref="Assignee"/>,
    /// <see cref="Self"/> and <see cref="MayChange"/>; when one of them is set the control
    /// also emits them as the <c>wx-state</c> island and the client renders without a first
    /// request. Left unset, the server renders the empty row and the client loads the state
    /// from the data service. The data service is declared with
    /// <c>DataService&lt;TEndpoint&gt;()</c> against a <see cref="RestApiAssignment{TIndexItem}"/>,
    /// the optional users service with <c>UsersService&lt;TEndpoint&gt;()</c>, which adds the
    /// "assign to" search.
    ///
    /// The control is ViewState-capable: bound to a resource of an enclosing
    /// <see cref="ControlViewState"/> through <c>Resource&lt;TResource&gt;()</c>, it emits the
    /// <c>data-wx-resource</c> binding (and the users service bound with
    /// <c>UsersService&lt;TEndpoint&gt;()</c>) instead of its service islands, renders the
    /// slice the ViewState loads centrally and writes through the ViewState's service, after
    /// which the ViewState re-queries the resource for every bound control. The server side
    /// row and the seed stay in both modes, so the bound row is not blank before the
    /// ViewState answered.
    /// </remarks>
    public class ControlDataAssignment : Control, IDataIsland, IViewStateBoundUsers
    {
        /// <summary>
        /// The name of the service island that backs the "assign to" search.
        /// </summary>
        private const string UsersServiceName = "users";

        /// <summary>
        /// Gets or sets the resolver of the ViewState resource the control renders. Set type-safely
        /// through <c>Resource&lt;TResource&gt;()</c>. When null, the control is standalone and
        /// owns its own islands.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the control binds to, emitted as the
        /// <c>data-wx-viewstate</c> attribute. When null, the control resolves its ViewState by the
        /// resource it binds to.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets the resolver of the ViewState users service the "assign to" search uses
        /// when the control is bound to a resource, set type-safely through
        /// UsersService&lt;TEndpoint&gt;().
        /// </summary>
        public Func<IRenderControlContext, string> UsersFactory { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as wx-service island
        /// elements: the data service backs the assignment and the optional users service
        /// backs the "assign to" search.
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
        /// Gets or sets the assignee rendered on the server and seeded into the client, or
        /// <see langword="null"/> for an unassigned object.
        /// </summary>
        public Func<IRenderControlContext, RestApiAssignmentItem> Assignee { get; set; }

        /// <summary>
        /// Gets or sets the person viewing the page, which decides between "assign to me"
        /// and "unassign" before the client asked the endpoint.
        /// </summary>
        public Func<IRenderControlContext, RestApiAssignmentItem> Self { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the viewer may change the assignment. It
        /// only decides which action is drawn; the endpoint enforces the right on every write.
        /// </summary>
        public Func<IRenderControlContext, bool> MayChange { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the row is read-only. When
        /// <see langword="true"/>, no action is offered regardless of the caller's rights.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Gets or sets the caption above the name, an i18n key or text. Defaults to
        /// "Assignee". The member is not called Role, which <see cref="Control"/> already
        /// uses for the ARIA role.
        /// </summary>
        public Func<IRenderControlContext, string> Caption { get; set; }

        /// <summary>
        /// Gets or sets the text shown in place of the name of a missing assignee, an i18n
        /// key or text. Defaults to "Unassigned".
        /// </summary>
        public Func<IRenderControlContext, string> Placeholder { get; set; }

        /// <summary>
        /// Gets or sets the text of the action that assigns the object to the viewer, an
        /// i18n key or text. Defaults to "Assign to me".
        /// </summary>
        public Func<IRenderControlContext, string> AssignToMeText { get; set; }

        /// <summary>
        /// Gets or sets the text of the action that removes the viewer's assignment, an
        /// i18n key or text. Defaults to "Unassign".
        /// </summary>
        public Func<IRenderControlContext, string> UnassignText { get; set; }

        /// <summary>
        /// Gets or sets the text of the action that opens the search for another assignee,
        /// an i18n key or text. Defaults to "Assign to …".
        /// </summary>
        public Func<IRenderControlContext, string> AssignToText { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataAssignment(string id = null)
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

            var culture = renderContext?.Request?.Culture;
            var assignee = Assignee?.Invoke(renderContext);
            var self = Self?.Invoke(renderContext);
            var mayChange = MayChange?.Invoke(renderContext) ?? false;
            var readOnly = Readonly?.Invoke(renderContext) ?? false;
            var caption = Translate(culture, Caption?.Invoke(renderContext));
            var placeholder = Translate(culture, Placeholder?.Invoke(renderContext));
            var assignToMe = Translate(culture, AssignToMeText?.Invoke(renderContext));
            var unassign = Translate(culture, UnassignText?.Invoke(renderContext));
            var assignTo = Translate(culture, AssignToText?.Invoke(renderContext));
            // a bound row reaches the search through the ViewState, a standalone one through its island
            var bound = !string.IsNullOrEmpty(ResourceFactory?.Invoke(renderContext));
            var pickable = (bound && !string.IsNullOrEmpty(UsersFactory?.Invoke(renderContext)))
                || ServiceFactories
                    .Select(factory => factory?.Invoke(renderContext))
                    .Any(descriptor => descriptor?.Name == UsersServiceName);

            var host = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-assignment", assignee is null ? "wx-assignment-empty" : null, GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            };

            host.Add(RenderAvatar(assignee));
            host.Add(RenderText(assignee, caption ?? I18N.Translate(culture, "webexpress.webapp:assignment.caption"), placeholder ?? I18N.Translate(culture, "webexpress.webapp:assignment.placeholder")));

            if (mayChange && !readOnly && (self is not null || pickable))
            {
                var actions = new HtmlElementTextSemanticsSpan()
                {
                    Class = "wx-assignment-actions"
                };

                // without a known viewer there is nobody to assign to "me", so only the search remains
                if (self is not null)
                {
                    actions.Add(assignee?.Id == self.Id
                        ? RenderAction(renderContext, visualTree, "unassign", new IconUserXmark(), unassign ?? I18N.Translate(culture, "webexpress.webapp:assignment.unassign"))
                        : RenderAction(renderContext, visualTree, "assign", new IconUserPlus(), assignToMe ?? I18N.Translate(culture, "webexpress.webapp:assignment.assign.me")));
                }

                if (pickable)
                {
                    actions.Add(RenderAction(renderContext, visualTree, "pick", new IconUserPen(), assignTo ?? I18N.Translate(culture, "webexpress.webapp:assignment.assign.to")));
                }

                host.Add(actions);
            }

            if (Assignee is not null || Self is not null || MayChange is not null)
            {
                host.AddFirst(DataState.Create()
                    .Set("assignee", assignee)
                    .Set("self", self)
                    .Set("mayChange", mayChange)
                    .ToIslandElement());
            }

            // only overridden texts travel to the client, whose dictionary holds the defaults
            return host
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-readonly", readOnly ? "true" : null)
                .AddUserAttribute("data-caption", caption)
                .AddUserAttribute("data-placeholder", placeholder)
                .AddUserAttribute("data-assign-to-me", assignToMe)
                .AddUserAttribute("data-unassign", unassign)
                .AddUserAttribute("data-assign-to", assignTo);
        }

        /// <summary>
        /// Returns the initials of a name: the first letters of its first two words.
        /// </summary>
        /// <param name="name">The name.</param>
        /// <returns>The initials, upper-cased; empty for a blank name.</returns>
        public static string InitialsOf(string name)
        {
            var words = (name ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            return string.Concat(words.Take(2).Select(x => char.ToUpperInvariant(x[0])));
        }

        /// <summary>
        /// Renders the portrait, the initials or, for an unassigned object, the empty circle.
        /// The name is spoken from the text beside it, so the picture is hidden from
        /// assistive technology.
        /// </summary>
        /// <param name="assignee">The assignee, or <see langword="null"/>.</param>
        /// <returns>The avatar node.</returns>
        private static IHtmlNode RenderAvatar(RestApiAssignmentItem assignee)
        {
            var avatar = new HtmlElementTextSemanticsSpan()
            {
                Class = "wx-assignment-avatar"
            };

            avatar.AddUserAttribute("aria-hidden", "true");

            if (assignee is not null && !string.IsNullOrWhiteSpace(assignee.Image))
            {
                // an empty Alt is dropped by the element, which would leave the image unnamed
                avatar.Add(new HtmlElementMultimediaImg() { Src = assignee.Image }.AddUserAttribute("alt"));
            }
            else if (assignee is not null)
            {
                var initials = string.IsNullOrWhiteSpace(assignee.Initials) ? InitialsOf(assignee.Name) : assignee.Initials;
                avatar.Add(new HtmlText(WebUtility.HtmlEncode(initials)));
            }

            return avatar;
        }

        /// <summary>
        /// Renders the caption and the name. The pair is a polite live region, so a screen
        /// reader announces the new assignee once the client redrew the row.
        /// </summary>
        /// <param name="assignee">The assignee, or <see langword="null"/>.</param>
        /// <param name="caption">The translated caption.</param>
        /// <param name="placeholder">The translated placeholder.</param>
        /// <returns>The text node.</returns>
        private static IHtmlNode RenderText(RestApiAssignmentItem assignee, string caption, string placeholder)
        {
            var text = new HtmlElementTextSemanticsSpan()
            {
                Class = "wx-assignment-text"
            };

            text.AddUserAttribute("aria-live", "polite");
            text.Add(new HtmlElementTextSemanticsSpan(new HtmlText(WebUtility.HtmlEncode(caption)))
            {
                Class = "wx-assignment-caption"
            });
            text.Add(new HtmlElementTextSemanticsSpan(new HtmlText(WebUtility.HtmlEncode(assignee is null ? placeholder : assignee.Name ?? string.Empty)))
            {
                Class = "wx-assignment-name"
            });

            return text;
        }

        /// <summary>
        /// Renders one action button. The kind travels as a data attribute, because the
        /// client hooks its behavior on it rather than on a class.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="kind">The action: assign, unassign or pick.</param>
        /// <param name="icon">The icon in front of the text.</param>
        /// <param name="text">The translated text, which is the accessible name.</param>
        /// <returns>The button node.</returns>
        private static IHtmlNode RenderAction(IRenderControlContext renderContext, IVisualTreeControl visualTree, string kind, IIcon icon, string text)
        {
            var button = new HtmlElementFieldButton()
            {
                Type = "button",
                Class = "wx-assignment-action"
            };

            button.AddUserAttribute("data-wx-assignment-action", kind);

            if (new ControlIcon() { Icon = _ => icon }.Render(renderContext, visualTree) is HtmlElement symbol)
            {
                symbol.AddUserAttribute("aria-hidden", "true");
                button.Add(symbol);
            }

            button.Add(new HtmlElementTextSemanticsSpan(new HtmlText(WebUtility.HtmlEncode(text))));

            return button;
        }

        /// <summary>
        /// Translates an overridden text, leaving an unset one unset so the default applies.
        /// </summary>
        /// <param name="culture">The culture of the request.</param>
        /// <param name="text">The i18n key or text, or <see langword="null"/>.</param>
        /// <returns>The translated text, or <see langword="null"/>.</returns>
        private static string Translate(System.Globalization.CultureInfo culture, string text)
        {
            return string.IsNullOrWhiteSpace(text) ? null : I18N.Translate(culture, text);
        }
    }
}
