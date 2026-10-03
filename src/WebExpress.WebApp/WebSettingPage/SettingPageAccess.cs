using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebSettingPage;

namespace WebExpress.WebApp.WebSettingPage
{
    /// <summary>
    /// Lets the settings navigation offer only the pages the requesting identity may open, so a
    /// protected page such as the certificate overview neither reveals itself to other accounts
    /// nor leads them into the forbidden response the server answers with.
    /// </summary>
    internal static class SettingPageAccess
    {
        /// <summary>
        /// Returns the setting pages of a category that the requesting identity may open.
        /// </summary>
        /// <param name="request">The request whose identity is evaluated against the page policies.</param>
        /// <param name="applicationContext">The application owning the setting pages.</param>
        /// <param name="categoryContext">The category whose pages are offered.</param>
        /// <returns>The accessible setting pages.</returns>
        public static IEnumerable<ISettingPageContext> GetSettingPages(IRequest request, IApplicationContext applicationContext, ISettingCategoryContext categoryContext)
        {
            return Accessible(request, WebEx.ComponentHub.SettingPageManager.GetSettingPages(applicationContext, categoryContext));
        }

        /// <summary>
        /// Returns the setting pages of a group that the requesting identity may open.
        /// </summary>
        /// <param name="request">The request whose identity is evaluated against the page policies.</param>
        /// <param name="applicationContext">The application owning the setting pages.</param>
        /// <param name="groupContext">The group whose pages are offered.</param>
        /// <returns>The accessible setting pages.</returns>
        public static IEnumerable<ISettingPageContext> GetSettingPages(IRequest request, IApplicationContext applicationContext, ISettingGroupContext groupContext)
        {
            return Accessible(request, WebEx.ComponentHub.SettingPageManager.GetSettingPages(applicationContext, groupContext));
        }

        /// <summary>
        /// Returns the page a category link opens, skipping pages the requesting identity may not open
        /// so the link of a partly protected category still lands on a page that is served.
        /// </summary>
        /// <param name="request">The request whose identity is evaluated against the page policies.</param>
        /// <param name="applicationContext">The application owning the setting pages.</param>
        /// <param name="categoryContext">The category the link leads to.</param>
        /// <returns>The first accessible setting page, or null when the category offers none.</returns>
        public static ISettingPageContext GetFirstSettingPage(IRequest request, IApplicationContext applicationContext, ISettingCategoryContext categoryContext)
        {
            // same order as the setting page manager, so an administrator lands on the same page as before
            return GetSettingPages(request, applicationContext, categoryContext)
                .OrderBy(x => x.Section)
                .ThenBy(x => x.PageTitle)
                .FirstOrDefault();
        }

        /// <summary>
        /// Applies the policy check the server performs before it serves a page.
        /// </summary>
        /// <param name="request">The request whose identity is evaluated against the page policies.</param>
        /// <param name="pages">The candidate setting pages.</param>
        /// <returns>The setting pages whose policies the identity satisfies.</returns>
        private static IEnumerable<ISettingPageContext> Accessible(IRequest request, IEnumerable<ISettingPageContext> pages)
        {
            var identityManager = WebEx.ComponentHub.IdentityManager;
            var identity = identityManager?.GetCurrentIdentity(request);

            return pages.Where(x => !(x.Policies?.Any() ?? false) || (identityManager?.CheckAccess(identity, x) ?? false));
        }
    }
}
