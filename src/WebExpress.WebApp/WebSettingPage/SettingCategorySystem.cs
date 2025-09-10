using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebSettingPage
{
    /// <summary>
    /// Represents the sestem settings category for the web application.
    /// </summary>
    [WebIcon<IconCog>]
    [Name("webexpress.webapp:setting.category.system.name")]
    [Description("webexpress.webapp:setting.category.system.description")]
    [SettingSection(SettingSection.Secondary)]
    public sealed class SettingCategorySystem : ISettingCategory
    {

    }
}
