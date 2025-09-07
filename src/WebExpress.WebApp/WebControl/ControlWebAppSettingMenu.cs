using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control for the settings menu in the web application.
    /// </summary>
    public class ControlWebAppSettingMenu : ControlWebAppSidebar
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppSettingMenu(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Retrieves the items to be displayed in the control.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>A collection of dropdown items.</returns>
        protected override IEnumerable<IControl> GetItems(IRenderControlContext renderContext)
        {
            var settinPageManager = WebEx.ComponentHub.SettingPageManager;
            var appicationContext = renderContext.PageContext?.ApplicationContext;
            var settingPageContext = renderContext.PageContext as ISettingPageContext;
            var currentCategory = settingPageContext?.SettingGroup?.SettingCategory;
            var groups = settinPageManager.GetSettingGroups(renderContext.PageContext?.ApplicationContext, currentCategory);
            var controls = new List<IControl>();

            foreach (var group in groups.OrderBy(x => x))
            {
                var settingPages = settinPageManager.GetSettingPages(appicationContext, group);
                var listCtrl = new ControlList(null) { Layout = TypeLayoutList.Flush };

                controls.Add(new ControlText() { Text = group?.Name });
                controls.Add(listCtrl);

                foreach (var page in settingPages
                    .Where(x => x.Section == SettingSection.Preferences)
                    .OrderBy(x => I18N.Translate(renderContext, x.PageTitle)))
                {
                    if (!page.Hide && (!page.Conditions.Any() || page.Conditions.All(x => x.Fulfillment(renderContext.Request))))
                    {
                        listCtrl.Add(new ControlListItemLink()
                        {
                            Text = page.PageTitle,
                            Icon = page.PageIcon,
                            Uri = page?.Route.ToUri(),
                            Active = page == renderContext.PageContext ? TypeActive.Active : TypeActive.None
                        });
                    }
                }

                foreach (var page in settingPages
                    .Where(x => x.Section == SettingSection.Primary)
                    .OrderBy(x => I18N.Translate(renderContext, x.PageTitle)))
                {
                    if (!page.Hide && (!page.Conditions.Any() || page.Conditions.All(x => x.Fulfillment(renderContext.Request))))
                    {
                        listCtrl.Add(new ControlListItemLink()
                        {
                            Text = page.PageTitle,
                            Icon = page.PageIcon,
                            Uri = page?.Route.ToUri(),
                            Active = page == renderContext.PageContext ? TypeActive.Active : TypeActive.None
                        });
                    }
                }

                foreach (var page in settingPages
                    .Where(x => x.Section == SettingSection.Secondary)
                    .OrderBy(x => I18N.Translate(renderContext, x.PageTitle)))
                {
                    if (!page.Hide && (!page.Conditions.Any() || page.Conditions.All(x => x.Fulfillment(renderContext.Request))))
                    {
                        listCtrl.Add(new ControlListItemLink()
                        {
                            Text = page.PageTitle,
                            Icon = page.PageIcon,
                            Uri = page?.Route.ToUri(),
                            Active = page == renderContext.PageContext ? TypeActive.Active : TypeActive.None
                        });
                    }
                }
            }

            foreach (var item in Header.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionSidebarHeader>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }

            foreach (var item in Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionSidebarPreferences>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }

            foreach (var control in controls)
            {
                yield return control;
            }

            foreach (var item in Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionSidebarPrimary>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }

            foreach (var item in Secondary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionSidebarSecondary>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }
        }
    }
}
