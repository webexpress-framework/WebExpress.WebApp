using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// The login dialog of the application layer: a <see cref="ControlModalLogin"/>
    /// framing the REST-backed <see cref="ControlDataLogin"/>, so signing in through the
    /// session endpoint - with the rate limiting and the lockout the REST login brings -
    /// happens on top of the page the user is on.
    /// </summary>
    /// <remarks>
    /// The service, the state and the redirect are those of the framed login: they are
    /// emitted on its host, where the client-side <c>webexpress.webapp.LoginCtrl</c> reads
    /// them, and only forwarded here so the dialog is authored the way every data control
    /// is - <c>new ControlDataModalLogin().DataService&lt;Session&gt;()</c>.
    /// </remarks>
    public class ControlDataModalLogin : ControlModalLogin, IControlData, IDataIsland
    {
        private readonly ControlDataLogin _login;

        /// <summary>
        /// Gets the data service descriptors of the framed login, emitted as wx-service
        /// island elements on its host. The data service authenticates the credentials
        /// with POST.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories => _login.ServiceFactories;

        /// <summary>
        /// Gets or sets the single data service descriptor of the framed login.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory { get => _login.ServiceFactory; set => _login.ServiceFactory = value; }

        /// <summary>
        /// Gets or sets the optional template reference of the framed login.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get => _login.TemplateFactory; set => _login.TemplateFactory = value; }

        /// <summary>
        /// Gets or sets the optional initial state of the framed login.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get => _login.StateFactory; set => _login.StateFactory = value; }

        /// <summary>
        /// Gets or sets the URI the page moves on to after a successful login. Without
        /// one the page is reloaded, which is what a dialog opened on the page to stay
        /// on usually wants.
        /// </summary>
        public Func<IRenderControlContext, IUri> RedirectUri { get => _login.RedirectUri; set => _login.RedirectUri = value; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public ControlDataModalLogin()
            : this(DeterministicId.Create())
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        /// <param name="content">Further content shown below the login, such as a hint or a link to a password reset.</param>
        public ControlDataModalLogin(string id, params IControl[] content)
            : this(id, new ControlDataLogin(id is not null ? $"{id}_login" : null), content)
        {
        }

        /// <summary>
        /// Initializes a new instance of the class around the given REST login.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        /// <param name="login">The REST login the dialog frames.</param>
        /// <param name="content">Further content shown below the login.</param>
        private ControlDataModalLogin(string id, ControlDataLogin login, params IControl[] content)
            : base(id, login, content)
        {
            _login = login;
        }
    }
}
